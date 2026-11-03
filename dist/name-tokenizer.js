/** Replace registered company, person and entity literals with local placeholders. Register all names and variants you want the scrubber to recognize. Original values stay in the returned local map. */
/** Belgian / Dutch / English legal-form suffixes commonly appended to a
 *  company name. Matched optionally after the registered literal so
 *  "Canal Works" and "Canal Works BVBA" both reduce to one redaction. */
const COMPANY_SUFFIX = String.raw `(?:\s+(?:bvba|bv|nv|sa|sprl|sarl|gmbh|ltd|limited|inc|llc|comm\.?v|cvba|cv|vof|maatschap|eenmanszaak|sole\s+proprietorship|partnership))?`;
/** Escape arbitrary string for use inside a regex character class or literal. */
function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
/** Normalise whitespace + casing in a registration before building its regex.
 *  Empty / whitespace-only registrations are rejected (would otherwise match
 *  every word boundary and obliterate the entire input). */
function buildPattern(reg) {
    const trimmed = reg.value.normalize("NFKC").trim();
    if (trimmed.length < 2)
        return null;
    const escaped = escapeRegex(trimmed).replace(/\s+/g, String.raw `\s+`);
    // For companies, allow optional trailing legal-form suffix so we also
    // capture "Canal Works BVBA" via the registration "Canal Works".
    const tail = reg.kind === "company" ? COMPANY_SUFFIX : "";
    return new RegExp(String.raw `(?<![\p{L}\p{M}\p{N}_])${escaped}${tail}(?![\p{L}\p{M}\p{N}_])`, "giu");
}
/**
 * Build a tokeniser for a fixed set of names. The returned function is pure
 * and stateless: every call returns its own redactions list keyed against
 * the same input vocabulary, so reuse across messages is safe.
 *
 * Names are matched in REGISTRATION ORDER. If the caller wants "Acme
 * Industries" to be redacted as a unit (rather than matching "Acme" alone and
 * leaving " Industries" exposed) they should register the long form FIRST.
 */
export function tokenizeNames(input, registrations) {
    if (typeof input !== "string" || input.length === 0) {
        return { text: input ?? "", redactions: [] };
    }
    if (!Array.isArray(registrations) || registrations.length === 0) {
        return { text: input, redactions: [] };
    }
    const redactions = [];
    // Per-kind running counters so tokens stay deterministic-ish.
    const counters = {
        company: 0,
        person: 0,
        entity: 0,
    };
    // Map a registration value → token, so repeated mentions of the SAME name
    // collapse to the same token (the model learns "the company" = one entity
    // rather than two unrelated placeholders).
    const tokenByValue = new Map();
    const reserved = new Set(input
        .match(/\[(?:COMPANY|PERSON|ENTITY)_\d+\]/gi)
        ?.map((token) => token.toUpperCase()) ?? []);
    let work = input.normalize("NFKC");
    for (const reg of registrations) {
        const pattern = buildPattern(reg);
        if (!pattern)
            continue;
        work = work.replace(pattern, (match) => {
            const key = reg.value.toLowerCase();
            let token = tokenByValue.get(key);
            if (!token) {
                const prefix = reg.kind === "company"
                    ? "COMPANY"
                    : reg.kind === "person"
                        ? "PERSON"
                        : "ENTITY";
                do {
                    token = `[${prefix}_${++counters[reg.kind]}]`;
                } while (reserved.has(token));
                tokenByValue.set(key, token);
            }
            redactions.push({
                token,
                original: match,
                kind: reg.kind,
                attributedTo: reg.value,
            });
            return token;
        });
    }
    return { text: work, redactions };
}
/**
 * Order registrations so that LONGER literals match BEFORE shorter ones that
 * are substrings of them. Without this, "Acme" → `[COMPANY_1]` would fire
 * first and leave the trailing " Industries" exposed.
 *
 * Caller-friendly: pass any list and get back a re-ordered copy that's safe
 * to hand to `tokenizeNames` directly. The original input array is not mutated.
 */
export function sortRegistrationsByLength(registrations) {
    return [...registrations].sort((a, b) => b.value.length - a.value.length);
}
