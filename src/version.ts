import packageJson from "../package.json" with { type: "json" };

/** The package version, inlined from package.json at build time. */
export const PACKAGE_VERSION: string = packageJson.version;
