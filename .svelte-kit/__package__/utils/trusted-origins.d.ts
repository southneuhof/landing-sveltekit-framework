export declare function normalizeOrigin(value: string): string | null;
export declare function parseTrustedOrigins(config: {
    appUrl?: string | null;
    authUrl?: string | null;
    trustedOrigins?: string | null;
    authTrustedOrigins?: string | null;
    includeDefaultDevOrigins?: boolean;
}): string[];
export declare function createTrustedOriginChecker(config: {
    trustedOrigins: string[];
    nodeEnv?: string;
}): (origin: string | null) => boolean;
//# sourceMappingURL=trusted-origins.d.ts.map