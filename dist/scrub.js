/** Scrub structured identifiers, supplied names and financial amounts, then check the remaining text. Only the sanitized string is a candidate outbound payload. Keep the redaction maps and findings local. */
import { tokenizeAmounts, } from "./amount-tokenizer.js";
import { sortRegistrationsByLength, tokenizeNames, } from "./name-tokenizer.js";
import { sanitizeLedgerDescriptionForLlm } from "./sanitizer.js";
/** Patterns the leak detector sweeps for AFTER name+amount tokenisation. */
const IBAN_REMNANT_RE = /\b[A-Z]{2}\d{2}[\sA-Z0-9]{10,34}\b/gi;
const BE_VAT_REMNANT_RE = /\bBE\s?0?\d{9,10}\b/gi;
const KBO_REMNANT_RE = /\b\d{4}\.\d{3}\.\d{3}\b/g;
const EMAIL_REMNANT_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
const PHONE_REMNANT_RE = /(?:\+32|0032|\+31|0031|0)(?:[\s./-]?\d){8,12}\b/g;
const EURO_ADJACENT_RE = /(?:€|EUR|USD|\$|£|GBP|CHF)\s*-?\d/gi;
const LARGE_BARE_NUMBER_RE = /\b\d{6,}\b/g;
/** Build a small excerpt around an offset for local inspection. Truncates the
 *  match itself to 60 chars and pads ±12 of surrounding context. */
function makeExcerpt(source, offset, matchLen) {
    const start = Math.max(0, offset - 12);
    const end = Math.min(source.length, offset + matchLen + 12);
    return source.slice(start, end).slice(0, 96);
}
function sweep(source, re, kind, out) {
    // Reset state on the regex — global flag retains lastIndex across calls.
    re.lastIndex = 0;
    let m = re.exec(source);
    while (m !== null) {
        out.push({
            kind,
            excerpt: makeExcerpt(source, m.index, m[0].length),
            offset: m.index,
        });
        // Guard against zero-length matches in pathological regex states.
        if (m.index === re.lastIndex)
            re.lastIndex += 1;
        m = re.exec(source);
    }
}
/**
 * Pure leak-detector. Returns every residual high-risk pattern found in
 * `sanitized` AFTER the tokenisers ran. Order is not guaranteed and exact
 * count is informational — the caller decides whether any leak is a hard
 * block via `decideBlock`.
 */
export function detectLeaks(sanitized) {
    const out = [];
    if (typeof sanitized !== "string" || sanitized.length === 0)
        return out;
    sweep(sanitized, IBAN_REMNANT_RE, "iban_remnant", out);
    sweep(sanitized, BE_VAT_REMNANT_RE, "be_vat_remnant", out);
    sweep(sanitized, KBO_REMNANT_RE, "kbo_remnant", out);
    sweep(sanitized, EMAIL_REMNANT_RE, "email_remnant", out);
    sweep(sanitized, PHONE_REMNANT_RE, "phone_remnant", out);
    sweep(sanitized, EURO_ADJACENT_RE, "euro_adjacent_number", out);
    sweep(sanitized, LARGE_BARE_NUMBER_RE, "large_bare_number", out);
    return out;
}
/** Classify which leak kinds are hard blocks. Large bare numbers are blocked
 *  in strict mode for financial products because exact unlabelled figures are
 *  often the most sensitive part of a prompt, and IDs should not reach the LLM
 *  either if they survived tokenisation. */
const HARD_BLOCK_KINDS = new Set([
    "iban_remnant",
    "be_vat_remnant",
    "kbo_remnant",
    "email_remnant",
    "phone_remnant",
    "euro_adjacent_number",
    "large_bare_number",
]);
export function decideBlock(leaks, strict) {
    if (!strict)
        return { blocked: false };
    const blocker = leaks.find((l) => HARD_BLOCK_KINDS.has(l.kind));
    if (!blocker)
        return { blocked: false };
    return {
        blocked: true,
        reason: `Egress blocked: residual ${blocker.kind} detected after sanitisation`,
    };
}
export function scrubText(input, strict = true) {
    const text = typeof input.text === "string" ? input.text : "";
    const piiStripped = sanitizeLedgerDescriptionForLlm(text, Number.MAX_SAFE_INTEGER);
    const ordered = sortRegistrationsByLength(input.names ?? []);
    const nameStep = tokenizeNames(piiStripped, ordered);
    const amountStep = tokenizeAmounts(nameStep.text);
    const leaks = detectLeaks(amountStep.text);
    const blockDecision = decideBlock(leaks, strict);
    return {
        sanitized: amountStep.text,
        amountRedactions: amountStep.redactions,
        nameRedactions: nameStep.redactions,
        leaks,
        blocked: blockDecision.blocked,
        blockedReason: blockDecision.reason,
    };
}
