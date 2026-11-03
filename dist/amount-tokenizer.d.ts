/** Replace currency-marked, magnitude-marked, and contextual financial amounts with local tokens. */
/** One redaction entry — the tokeniser returns these in match order. */
export interface AmountRedactionEntry {
    /** Token rendered into the sanitised text, e.g. `[AMOUNT_1]`. */
    token: string;
    /** Original substring captured from the input (with surrounding whitespace trimmed). */
    original: string;
    /** Best-effort parsed value in the smallest unit detected. Null when the parser
     *  couldn't normalise (e.g. malformed "€-..." or a magnitude word we don't
     *  resolve). Audit-only — callers must not rely on this for billing math. */
    numericValue: number | null;
    /** Detected currency, normalised to ISO code when possible. Null when no
     *  currency marker was present (bare number in a keyword window). */
    currency: "EUR" | "USD" | "GBP" | "CHF" | null;
}
export interface AmountTokenizationResult {
    /** Input with every detected amount replaced by `[AMOUNT_n]`. */
    text: string;
    /** Ordered redactions. Use each entry’s token to resolve its original value. */
    redactions: AmountRedactionEntry[];
}
/** Parse a captured amount substring into a best-effort numeric value.
 *  Returns null when the format is too ambiguous (e.g. "1,234" — could be EU
 *  one-thousand-two-thirty-four or US one-point-two-three-four). We do not
 *  guess in ambiguous cases because the numeric is audit-only; downstream
 *  callers do not bill from it. */
export declare function parseAmountValue(captured: string): number | null;
/**
 * Replace every monetary amount in `input` with `[AMOUNT_n]` tokens. Returns
 * the redacted text + an ordered map of originals.
 *
 * The three passes run in priority order:
 *
 *   1. Currency-marked numbers (`€1.4M`, `EUR 1400000`, `320k €`)
 *   2. Magnitude-suffix-only numbers (`1.4M`, `320k`, `1.4 million`)
 *   3. Bare numbers ≥ 1000 in a financial-keyword window (`revenue 1400000`)
 *
 * Each pass uses placeholder substitution so that later passes don't re-match
 * tokens emitted by earlier passes. Date-context bare numbers are spared in
 * pass 3.
 */
export declare function tokenizeAmounts(input: string): AmountTokenizationResult;
/**
 * Re-hydrate `[AMOUNT_n]` tokens in a model-generated string using a previously
 * captured redaction map. Defensive — out-of-range tokens are left in place
 * rather than throwing, since the model may have invented tokens that weren't
 * in the input. Returns the rehydrated string.
 *
 * Phase 1 keeps this unused on the response path (we want the model talking in
 * abstract amounts so the user sees its reasoning over `[AMOUNT_1]`); the
 * helper exists so a Phase 2 rehydration UX can opt in per surface.
 */
export declare function rehydrateAmounts(text: string, redactions: AmountRedactionEntry[]): string;
