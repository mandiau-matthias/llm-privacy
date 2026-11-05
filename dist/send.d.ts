import { type EgressScrubInput } from "./scrub.js";
export type PrivateSendResult<T> = {
    blocked: true;
    reason: "residual_patterns";
} | {
    blocked: false;
    response: T;
};
/** Run strict scrubbing, then hand ONLY the sanitized string to the supplied sender.
 * Original text, reversible token maps and diagnostic snippets stay out of its arguments.
 * Sender failures propagate; there is no retry with the original text.
 */
export declare function sendWithPrivacy<T>(input: EgressScrubInput, send: (sanitizedText: string) => Promise<T>): Promise<PrivateSendResult<T>>;
