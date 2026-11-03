/** Replace registered company, person and entity literals with local placeholders. Register all names and variants you want the scrubber to recognize. Original values stay in the returned local map. */
/** One name registered with the tokeniser. */
export interface NameRegistration {
    /** Display name as the system knows it, e.g. "Canal Works BVBA". */
    value: string;
    /** Category drives the token prefix and the audit category label. */
    kind: "company" | "person" | "entity";
}
/** One redaction emitted by the tokeniser, in match order. */
export interface NameRedactionEntry {
    /** Token rendered into the sanitised text, e.g. `[COMPANY_1]`. */
    token: string;
    /** Original substring captured from the input. Preserves the user's casing
     *  and surrounding form (with corporate suffix if present). */
    original: string;
    kind: "company" | "person" | "entity";
    /** The registered display name that this match was attributed to. Useful
     *  for audit ("did we redact the right thing?"). */
    attributedTo: string;
}
export interface NameTokenizationResult {
    text: string;
    redactions: NameRedactionEntry[];
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
export declare function tokenizeNames(input: string, registrations: NameRegistration[]): NameTokenizationResult;
/**
 * Order registrations so that LONGER literals match BEFORE shorter ones that
 * are substrings of them. Without this, "Acme" → `[COMPANY_1]` would fire
 * first and leave the trailing " Industries" exposed.
 *
 * Caller-friendly: pass any list and get back a re-ordered copy that's safe
 * to hand to `tokenizeNames` directly. The original input array is not mutated.
 */
export declare function sortRegistrationsByLength(registrations: NameRegistration[]): NameRegistration[];
