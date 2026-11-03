import { type EgressScrubInput, type LeakFinding, type ScrubPreview } from "./scrub.js";
export * from "./scrub.js";
export interface EgressScrubOptions {
    /** Optional keyed audit digest secret. Production callers should provide
     *  this from an environment-backed secret so audit hashes are not
     *  brute-forceable fingerprints of known financial prompts. */
    auditSecret?: string | null;
}
export interface EgressScrubResult extends ScrubPreview {
    auditHash: string;
}
export declare function scrubForEgress(input: EgressScrubInput, strict?: boolean, options?: EgressScrubOptions): EgressScrubResult;
export declare class EgressBlockedError extends Error {
    readonly leaks: LeakFinding[];
    readonly auditHash: string;
    readonly code = "EGRESS_BLOCKED";
    constructor(message: string, leaks: LeakFinding[], auditHash: string);
}
