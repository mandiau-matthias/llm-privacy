/** Helpers for reading operator-provided environment settings. These values do not establish provider retention or enforce data handling on a remote service. */
/** Read the application environment classification. */
export function isDeployedLikeEnv() {
    const envName = (process.env.ENVIRONMENT || "").toLowerCase();
    return (envName === "staging" ||
        envName === "production" ||
        envName === "preview" ||
        process.env.NODE_ENV === "production");
}
/** Read the operator’s retention attestation. No provider setting is changed or checked. */
export function readZdrEnabled() {
    const raw = process.env.ANTHROPIC_ZDR_ENABLED;
    if (typeof raw !== "string")
        return false;
    const s = raw.trim().toLowerCase();
    if (s === "1" || s === "true" || s === "yes" || s === "on" || s === "y")
        return true;
    return false;
}
