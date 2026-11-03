/** Structured pattern redaction for outbound text. Covers selected email, URL, Belgian identifier, phone and digit-run patterns. Compose with name and amount tokenization to process an invoice. */
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
/** Belgian KBO formats */
const KBO_DOTTED_RE = /\b\d{4}\.\d{3}\.\d{3}\b/g;
const BE_VAT_RE = /\bBE\s?0?\d{9,10}\b/gi;
/** Simplified IBAN (EU-style; good enough to catch accidental pastes) */
const IBAN_RE = /\b[A-Z]{2}\d{2}[\sA-Z0-9]{10,34}\b/gi;
const URL_RE = /https?:\/\/[^\s]+/gi;
const PHONE_LIKE_RE = /(?:\+32|0032|0)(?:[\s./-]?\d){8,12}\b/gi;
/** Credit card–length digit runs (avoid nuking normal account codes) */
const LONG_DIGIT_RUN_RE = /\b\d{13,}\b/g;
export function sanitizeLedgerDescriptionForLlm(raw, maxLen = 400) {
    let s = String(raw ?? "")
        .normalize("NFKC")
        .slice(0, maxLen * 2);
    s = s.replace(EMAIL_RE, "[email]");
    s = s.replace(URL_RE, "[url]");
    // Belgian VAT before IBAN — BE + digits is otherwise swallowed by generic IBAN pattern
    s = s.replace(BE_VAT_RE, "[vat]");
    s = s.replace(IBAN_RE, "[iban]");
    s = s.replace(KBO_DOTTED_RE, "[ondernemingsnummer]");
    s = s.replace(PHONE_LIKE_RE, "[telefoon]");
    s = s.replace(LONG_DIGIT_RUN_RE, "[nummer]");
    s = s.replace(/\s+/g, " ").trim();
    return s.slice(0, maxLen);
}
/** Sector / NACE hint only — no free-form addresses */
export function sanitizeSectorHintForLlm(raw, maxLen = 200) {
    let s = String(raw ?? "")
        .normalize("NFKC")
        .slice(0, maxLen * 2);
    s = s.replace(EMAIL_RE, "[email]");
    s = s.replace(URL_RE, "[url]");
    s = s.replace(BE_VAT_RE, "[vat]");
    s = s.replace(IBAN_RE, "[iban]");
    s = s.replace(KBO_DOTTED_RE, "[ondernemingsnummer]");
    s = s.replace(PHONE_LIKE_RE, "[telefoon]");
    s = s.replace(LONG_DIGIT_RUN_RE, "[nummer]");
    s = s.replace(/\s+/g, " ").trim();
    return s.slice(0, maxLen);
}
export function sanitizeUnmappedLedgerLinesForLlm(lines, maxDesc = 400) {
    return lines.map((l) => ({
        ledger_code: String(l.account_code || "").slice(0, 32),
        description: sanitizeLedgerDescriptionForLlm(l.description || "", maxDesc),
    }));
}
/** If nothing substantive remains, skip the LLM call (cost + unnecessary subprocessor exposure). */
export function sanitizedLedgerPayloadHasSignal(lines) {
    const stripPlaceholders = (t) => t
        .replace(/\[[\wà-ÿ]+\]/gi, "")
        .replace(/\s+/g, " ")
        .trim();
    return lines.some((l) => stripPlaceholders(l.description).length >= 3);
}
/** Strip accidental echoes of PII from model-generated rationales before DB/UI. */
export function sanitizeLlmRationaleText(raw, maxLen = 800) {
    return sanitizeLedgerDescriptionForLlm(raw, maxLen);
}
/**
 * Structured-PII redaction WITHOUT whitespace normalisation or length
 * truncation. Use for observability scrubbing (Sentry events, log lines,
 * breadcrumbs) where preserving the original formatting matters — a
 * stack trace with `\n`s collapsed to spaces is unreadable.
 *
 * Same regex contract as `sanitizeLedgerDescriptionForLlm` so the same
 * patterns (email, URL, IBAN, BE-VAT, KBO, EU phone, ≥13-digit runs) get
 * replaced with the same `[token]` placeholders. Use this from any code
 * that egresses text to a sub-processor (Sentry, PostHog, log
 * aggregator) where the text is not LLM-bound.
 *
 * Pure, idempotent, no allocations beyond the regex replace chain.
 * Returns `''` for null/undefined inputs (defensive default so callers
 * can always concatenate the result).
 */
export function redactStructuredPii(raw) {
    if (raw == null)
        return "";
    let s = String(raw).normalize("NFKC");
    s = s.replace(EMAIL_RE, "[email]");
    s = s.replace(URL_RE, "[url]");
    // Belgian VAT before IBAN — BE + digits is otherwise swallowed by generic IBAN
    s = s.replace(BE_VAT_RE, "[vat]");
    s = s.replace(IBAN_RE, "[iban]");
    s = s.replace(KBO_DOTTED_RE, "[ondernemingsnummer]");
    s = s.replace(PHONE_LIKE_RE, "[telefoon]");
    s = s.replace(LONG_DIGIT_RUN_RE, "[nummer]");
    return s;
}
