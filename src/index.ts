/**
 * moxie-docs — the open-source interface for the Moxie Docs MCP server.
 *
 * This package re-exports the backend-independent MCP contract: the tool
 * catalog, prompt descriptors, server metadata, and the agent skill / AGENTS
 * guidance renderers. It contains no handler logic and has zero runtime
 * dependencies, so any client can describe or generate the Moxie Docs surface
 * without the private backend.
 */
export * from "./interface/tools";
export * from "./interface/server-info";
export * from "./interface/prompts";
export * from "./interface/skill";
