/** Helpers for reading operator-provided environment settings. These values do not establish provider retention or enforce data handling on a remote service. */
/** Read the application environment classification. */
export declare function isDeployedLikeEnv(): boolean;
/** Read the operator’s retention attestation. No provider setting is changed or checked. */
export declare function readZdrEnabled(): boolean;
