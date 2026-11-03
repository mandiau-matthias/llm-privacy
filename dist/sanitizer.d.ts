/** Structured pattern redaction for outbound text. Covers selected email, URL, Belgian identifier, phone and digit-run patterns. Compose with name and amount tokenization to process an invoice. */
export interface SanitizedUnmappedLedgerLine {
    ledger_code: string;
    description: string;
}
export declare function sanitizeLedgerDescriptionForLlm(raw: string, maxLen?: number): string;
/** Sector / NACE hint only — no free-form addresses */
export declare function sanitizeSectorHintForLlm(raw: string, maxLen?: number): string;
export declare function sanitizeUnmappedLedgerLinesForLlm(lines: Array<{
    account_code: string;
    description: string;
}>, maxDesc?: number): SanitizedUnmappedLedgerLine[];
/** If nothing substantive remains, skip the LLM call (cost + unnecessary subprocessor exposure). */
export declare function sanitizedLedgerPayloadHasSignal(lines: SanitizedUnmappedLedgerLine[]): boolean;
/** Strip accidental echoes of PII from model-generated rationales before DB/UI. */
export declare function sanitizeLlmRationaleText(raw: string, maxLen?: number): string;
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
export declare function redactStructuredPii(raw: string | null | undefined): string;
