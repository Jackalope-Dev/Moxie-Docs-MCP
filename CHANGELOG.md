# Changelog

All notable changes to the `moxie-docs` package are documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-07-21

### Added

- `buildMoxieMcpServerCard`, `moxieMcpServerCard`, and `moxieMcpPublicMethods` exports for the public discovery document at `/.well-known/mcp/server-card.json`, including the full tool and prompt catalogs.
- Contract drift checks for unauthenticated `tools/list` and `prompts/list` on the hosted MCP endpoint.
- `moxie-docs check` command: reads working-tree/staged changes and calls the hosted doc-impact check to fail CI (or a pre-commit hook) when a change looks like it needs a documentation update.
- MCP client configuration for Windsurf (global `~/.codeium/windsurf/mcp_config.json`, `serverUrl` + `headers`) and Zed (project-local `.zed/settings.json`, `context_servers` + `url`).

### Changed

- `moxie-docs setup`'s "configure all clients" fallback (used with `--yes` or a blank prompt answer when nothing is detected) no longer includes global-scoped clients like Windsurf. Writing Windsurf's config affects every project the user opens in it, so it's now only configured when named explicitly (`--client windsurf`) or actually detected on the machine. A one-line notice is printed whenever a global client's config is written.

## [0.1.0] - 2026-06-25

### Added

- `moxie-docs` CLI with commands `setup`, `login`, `logout`, `status`, `config <client>`, and `install-skill`.
- Browser-based OAuth 2.1 sign-in (Dynamic Client Registration + PKCE) against the hosted Moxie Docs MCP server. Credentials are stored under `~/.moxie-docs/` (file mode `0600`) with refresh-token rotation, and are never written into a client config or logged.
- MCP client configuration for Claude Code, Cursor, and VS Code. Configs default to URL-only so OAuth-capable clients sign in themselves; a static `Authorization` header is written only when a long-lived dashboard token is supplied via `--token`. Existing config files are merged (other MCP servers preserved), and the CLI aborts rather than overwrite a file it cannot safely parse.
- Local install of the `moxie-docs` agent skill (`.claude/skills/` and `.agents/skills/`) and the `AGENTS.md` guidance block, with safe marker-bounded edits.
- Open-source MCP interface library exports (`moxie-docs`): the tool catalog (`moxieMcpTools`), prompt descriptors (`moxieMcpPrompts`), server metadata, and the `renderSkillMarkdown` / `renderAgentsGuidanceBlock` renderers. No server logic, indexing, or credentials are included.

[Unreleased]: https://github.com/Jackalope-Dev/Moxie-Docs-MCP/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/Jackalope-Dev/Moxie-Docs-MCP/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/Jackalope-Dev/Moxie-Docs-MCP/releases/tag/v0.1.0
