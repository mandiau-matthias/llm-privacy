/** Scrub structured identifiers, supplied names and financial amounts, then check the remaining text. Only the sanitized string is a candidate outbound payload. Keep the redaction maps and findings local. */
import { type AmountRedactionEntry } from "./amount-tokenizer.js";
import { type NameRedactionEntry, type NameRegistration } from "./name-tokenizer.js";
/** Categories of residual leak the detector knows how to flag. */
export type LeakKind = "iban_remnant" | "be_vat_remnant" | "kbo_remnant" | "email_remnant" | "phone_remnant" | "euro_adjacent_number" | "large_bare_number";
export interface LeakFinding {
    kind: LeakKind;
    /** Local diagnostic excerpt. It can contain sensitive text. */
    excerpt: string;
    /** Offset in the post-sanitisation string. */
    offset: number;
}
export interface EgressScrubInput {
    /** Raw outbound text — typically the user turn, optionally with system
     *  prompt context concatenated for a single egress sweep. */
    text: string;
    /** Name vocabulary to redact. Order does not matter; the scrubber re-orders
     *  by descending length to handle substring overlaps. */
    names?: NameRegistration[];
}
export interface ScrubPreview {
    /** Candidate outbound text. Only use it when the result is not blocked. */
    sanitized: string;
    /** Tokenisation map for amounts, in match order. Keep it local. */
    amountRedactions: AmountRedactionEntry[];
    /** Tokenisation map for names, in match order. Keep it local. */
    nameRedactions: NameRedactionEntry[];
    /** Residual leaks found by the post-sweep. An empty array means none of the detector patterns matched. */
    leaks: LeakFinding[];
    /** Did the gateway block this payload? When true, the caller MUST NOT call
     *  the provider — the sanitised text is returned for inspection / unit-test
     *  visibility but must not be transmitted. */
    blocked: boolean;
    /** Human-readable reason when blocked. */
    blockedReason?: string;
}
/**
 * Pure leak-detector. Returns every residual high-risk pattern found in
 * `sanitized` AFTER the tokenisers ran. Order is not guaranteed and exact
 * count is informational — the caller decides whether any leak is a hard
 * block via `decideBlock`.
 */
export declare function detectLeaks(sanitized: string): LeakFinding[];
export declare function decideBlock(leaks: LeakFinding[], strict: boolean): {
    blocked: boolean;
    reason?: string;
};
export declare function scrubText(input: EgressScrubInput, strict?: boolean): ScrubPreview;
