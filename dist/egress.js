/** Add a local audit digest to the same preview used in the browser. */
import { createHash, createHmac } from "node:crypto";
import { scrubText, } from "./scrub.js";
export * from "./scrub.js";
function sha256Hex(source) {
    return createHash("sha256").update(source).digest("hex");
}
function createAuditDigest(payload, auditSecret) {
    const body = JSON.stringify(payload) ?? "";
    const key = typeof auditSecret === "string" ? auditSecret.trim() : "";
    if (key.length > 0) {
        return createHmac("sha256", key).update(body).digest("hex");
    }
    return sha256Hex(body);
}
export function scrubForEgress(input, strict = true, options = {}) {
    const preview = scrubText(input, strict);
    const auditHash = createAuditDigest({
        preDigest: sha256Hex(typeof input.text === "string" ? input.text : ""),
        postDigest: sha256Hex(preview.sanitized),
        amountCount: preview.amountRedactions.length,
        nameCount: preview.nameRedactions.length,
        leakCount: preview.leaks.length,
    }, options.auditSecret);
    return { ...preview, auditHash };
}
export class EgressBlockedError extends Error {
    leaks;
    auditHash;
    code = "EGRESS_BLOCKED";
    constructor(message, leaks, auditHash) {
        super(message);
        this.leaks = leaks;
        this.auditHash = auditHash;
        this.name = "EgressBlockedError";
    }
}
