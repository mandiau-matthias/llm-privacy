/** Add a local audit digest to the same preview used in the browser. */
import { createHash, createHmac } from "node:crypto";
import {
	scrubText,
	type EgressScrubInput,
	type LeakFinding,
	type ScrubPreview,
} from "./scrub.js";
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

function sha256Hex(source: string): string {
	return createHash("sha256").update(source).digest("hex");
}

function createAuditDigest(
	payload: unknown,
	auditSecret?: string | null,
): string {
	const body = JSON.stringify(payload) ?? "";
	const key = typeof auditSecret === "string" ? auditSecret.trim() : "";
	if (key.length > 0) {
		return createHmac("sha256", key).update(body).digest("hex");
	}
	return sha256Hex(body);
}

export function scrubForEgress(
	input: EgressScrubInput,
	strict = true,
	options: EgressScrubOptions = {},
): EgressScrubResult {
	const preview = scrubText(input, strict);
	const auditHash = createAuditDigest(
		{
			preDigest: sha256Hex(typeof input.text === "string" ? input.text : ""),
			postDigest: sha256Hex(preview.sanitized),
			amountCount: preview.amountRedactions.length,
			nameCount: preview.nameRedactions.length,
			leakCount: preview.leaks.length,
		},
		options.auditSecret,
	);
	return { ...preview, auditHash };
}

export class EgressBlockedError extends Error {
	readonly code = "EGRESS_BLOCKED";
	constructor(
		message: string,
		readonly leaks: LeakFinding[],
		readonly auditHash: string,
	) {
		super(message);
		this.name = "EgressBlockedError";
	}
}
