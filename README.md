<p align="center">
  <img src="https://moxiedocs.com/moxie-fox.svg" alt="Moxie Docs" width="120" />
  <br />
  <a href="https://moxiedocs.com">Visit Moxie Docs</a>
</p>

# Moxie Docs — MCP & Agent Tools

[![npm version](https://img.shields.io/npm/v/moxie-docs.svg)](https://www.npmjs.com/package/moxie-docs)
[![smithery badge](https://smithery.ai/badge/caden/moxie-docs)](https://smithery.ai/servers/caden/moxie-docs)

The **Moxie Docs** Model Context Protocol (MCP) server, the agent **skills** Moxie installs into your repository, and the **`moxie-docs` CLI** that wires it all up — `npx moxie-docs setup`.

This repo is also the open-source home of the **`moxie-docs` npm package**: a setup CLI plus the MCP *interface* (tool catalog, prompts, server metadata, and skill renderers) you can import. The hosted server, indexing pipeline, and your generated docs stay in the private Moxie service.

Moxie Docs indexes a connected GitHub repository and keeps its documentation alive — generating docs, discovering conventions, tracking documentation gaps and drift, and opening pull requests that keep docs in sync with code. The MCP server exposes that living context to coding agents (Claude Code, Cursor, VS Code, Codex, and any MCP-capable client) so they ground their work in how *your* repository actually does things — and keep the docs current as they change code.

- **Website / dashboard:** https://moxiedocs.com
- **Human docs for the MCP server:** https://moxiedocs.com/mcp
- **MCP endpoint:** `https://moxiedocs.com/api/mcp`

This repository is documentation and distribution assets only. The hosted server, indexing pipeline, and your repositories' documentation are not stored here.

---

## Contents

- [Quick start](#quick-start)
- [CLI](#cli)
- [The MCP server](#the-mcp-server)
  - [Connection](#connection)
  - [Authentication](#authentication)
  - [Client configuration](#client-configuration)
  - [Tools](#tools)
  - [Prompts](#prompts)
- [Skills](#skills)
  - [The `moxie-docs` skill](#the-moxie-docs-skill)
  - [What Moxie installs into your repository](#what-moxie-installs-into-your-repository)
- [Use as a library](#use-as-a-library)
- [Discovery endpoints](#discovery-endpoints)
- [License](#license)

---

## Quick start

The fastest path — from your repository's directory:

```bash
npx moxie-docs setup
```

This signs you in (OAuth in your browser), writes the MCP config for your editor, installs the `moxie-docs` skill + `AGENTS.md` guidance, and verifies the connection. After that, your agent reads live context with `moxie.get_ai_context` before editing and proposes doc updates that land in the same PR.

Prefer to do it by hand? Connect a repository at https://moxiedocs.com, then add the server to your agent with a [config block](#client-configuration).

---

## CLI

The `moxie-docs` CLI (Node ≥ 18, zero runtime dependencies) sets up and manages the connection. Run it with `npx moxie-docs <command>` or install it globally (`npm i -g moxie-docs`).

| Command | What it does |
| --- | --- |
| `moxie-docs setup` | End-to-end: sign in, configure your MCP client, install the skill + `AGENTS.md` block, and smoke-test. |
| `moxie-docs login` | Sign in via the browser (OAuth 2.1 + PKCE) and store credentials in `~/.moxie-docs/`. |
| `moxie-docs status` | Show your scope, connected repositories, and available tool count. |
| `moxie-docs config <client>` | Write the `moxie-docs` server entry into a client config (`claude-code`, `cursor`, or `vscode`). |
| `moxie-docs install-skill` | Install the `moxie-docs` skill and `AGENTS.md` guidance into the current repo. |
| `moxie-docs logout` | Remove stored credentials. |

Useful flags: `--client <name>`, `--token <dashboard-token>`, `--repo owner/name`, `--no-browser`, `--yes`.

**How authentication is written.** By default `setup`/`config` write a **URL-only** server entry and let your editor perform its own OAuth sign-in on first use — so nothing in your committed config expires. The CLI's own browser sign-in (used for `status` and the setup smoke-test) stores a short-lived token plus a refresh token under `~/.moxie-docs/` (file mode `0600`); it is **never** written into a client config. If you'd rather pin a static `Authorization` header, pass a long-lived dashboard token with `--token` and the CLI writes that instead. The CLI never logs token values, and it refuses to overwrite a client config it can't safely parse rather than discarding your other MCP servers.

---

## The MCP server

### Connection

| | |
| --- | --- |
| **Transport** | Streamable HTTP MCP |
| **Endpoint** | `https://moxiedocs.com/api/mcp` |
| **Protocol version** | `2025-06-18` |
| **Repository selection** | Tools accept an optional `repository` argument (`owner/name`, e.g. `acme/app`). It is required only when a token serves multiple repositories and no single default applies. Matching is case-insensitive. |

All write tools are **proposals** — Moxie returns the file path and content for *you* (the agent) to write into your own branch. Moxie never edits your repository directly through MCP, and never merges. Reads return compact, citation-backed context rather than raw code dumps.

### Authentication

**Bearer token (available today).** Create a token in the dashboard and send it as a header:

```
Authorization: Bearer <MOXIE_TOKEN>
```

Moxie stores only the token hash (plus an encrypted copy so you can reveal it), a prefix, scope, and a last-used timestamp. You can reveal, rotate, or revoke tokens from the dashboard at any time.

**OAuth 2.1 sign-in (for clients that support it).** MCP clients that implement the OAuth authorization flow can connect by signing in through the browser instead of pasting a token — the client discovers the server's OAuth metadata, registers itself dynamically (RFC 7591), and obtains a token via the authorization-code + PKCE flow. Discovery documents:

- Protected resource metadata: `https://moxiedocs.com/.well-known/oauth-protected-resource`
- Authorization server metadata: `https://moxiedocs.com/.well-known/oauth-authorization-server`

Both authentication paths resolve to the same token model, so either works with the same tools. Connected applications can be reviewed and revoked from the dashboard.

### Client configuration

Most agents accept a remote MCP server with a URL and headers. Replace `<MOXIE_TOKEN>` with a token from the dashboard.

**Claude Code** — `.mcp.json` (or `claude mcp add`):

```json
{
  "mcpServers": {
    "moxie-docs": {
      "url": "https://moxiedocs.com/api/mcp",
      "headers": {
        "Authorization": "Bearer <MOXIE_TOKEN>"
      }
    }
  }
}
```

**Cursor** — `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "moxie-docs": {
      "url": "https://moxiedocs.com/api/mcp",
      "headers": { "Authorization": "Bearer <MOXIE_TOKEN>" }
    }
  }
}
```

**VS Code** — `.vscode/mcp.json`:

```json
{
  "servers": {
    "moxie-docs": {
      "type": "http",
      "url": "https://moxiedocs.com/api/mcp",
      "headers": { "Authorization": "Bearer <MOXIE_TOKEN>" }
    }
  }
}
```

> Keep tokens out of source control. Reference an environment variable where your client supports it, or paste the token only into local, untracked config.

### Tools

All tools are read-only except the two `propose_*` tools, which return a proposal for the agent to apply in its own branch.

| Tool | Purpose |
| --- | --- |
| `moxie.get_ai_context` | Compact pre-edit briefing: repo status, verified commands, top conventions, open gaps, team notes. Read this first. |
| `moxie.get_doc_impact` | Given the paths you're about to change (and any you're deleting), returns the conventions, gaps, and existing docs whose evidence overlaps them — and flags net-new/undocumented surfaces. |
| `moxie.get_conventions` | Discovered coding conventions, grouped by category, with confidence scores, agent guidance, and source-file citations. |
| `moxie.search_docs` | Semantic + keyword search over generated docs, conventions, gaps, and AI context. |
| `moxie.get_doc_gaps` | Unresolved documentation gaps with severity and the paths they concern. |
| `moxie.get_documentation_opportunities` | Recommended doc work: missing docs, drift repairs, and PR templates. |
| `moxie.get_documentation_patterns` | How the repository organizes and maintains its docs (where new docs belong). |
| `moxie.list_docs` | Paginated, section-grouped table of contents of every generated doc. |
| `moxie.propose_doc_update` | Add or update a doc as part of your current change; returns the target path + Markdown to write into your branch. |
| `moxie.propose_doc_removal` | Remove a Moxie-tracked doc your change makes obsolete; returns the path to delete in your branch. |

### Prompts

The server also exposes MCP prompts that script the common workflows:

| Prompt | Purpose |
| --- | --- |
| `document-this-change` | Runs the doc-impact check on your changed paths and walks you through proposing the doc updates so they land in the same PR. |
| `fix-stale-docs` | Finds the repository's open documentation gaps and drift opportunities and repairs them through Moxie. |

---

## Skills

[Agent Skills](https://github.com/cloudflare/agent-skills-discovery-rfc) are small, triggered instruction files that teach an agent *when* and *how* to use a capability. Moxie publishes one skill, `moxie-docs`, that wires an agent into the edit-then-document workflow.

### The `moxie-docs` skill

The canonical skill lives in this repo at [`skills/moxie-docs/SKILL.md`](skills/moxie-docs/SKILL.md) and is also served from the website (with a published SHA-256 digest) at:

```
https://moxiedocs.com/.well-known/agent-skills/moxie-docs/SKILL.md
```

It tells an agent to read live context before editing (`get_ai_context`, `get_doc_impact`), follow the repository's real conventions and verified commands, and propose doc updates/removals that ship in the **same PR** as the code change — never inventing filler docs.

### What Moxie installs into your repository

When Moxie connects a repository it opens one **"Add Moxie agent guidance"** PR that adds three self-healing, deterministic files (regenerated only when they drift or the repo is renamed — never churning on every index):

| File | Purpose |
| --- | --- |
| `AGENTS.md` | A short, always-on pointer block (between `<!-- moxie-docs:start -->` / `<!-- moxie-docs:end -->` markers) telling any agent to use the MCP server and the `moxie-docs` skill. Human-added content outside the markers is preserved. See [`templates/AGENTS.md`](templates/AGENTS.md). |
| `.claude/skills/moxie-docs/SKILL.md` | The repo-specific `moxie-docs` skill for Claude Code. |
| `.agents/skills/moxie-docs/SKILL.md` | The same skill for `.agents`-aware clients. |

The installed skill is the repo-specific variant of [`skills/moxie-docs/SKILL.md`](skills/moxie-docs/SKILL.md): identical workflow, with your `owner/name` baked in so multi-repo tokens target the right repository. Everything Moxie writes is deterministic and contains no volatile data — live conventions and commands always come from the MCP server, not the committed file.

---

## Use as a library

The package also exports the open-source MCP **interface** — the backend-independent contract — so you can build tooling against Moxie without depending on the private server. It carries no secrets and no server logic.

```ts
import {
  moxieMcpTools,            // the tool catalog (names, descriptions, input schemas, annotations)
  moxieMcpPrompts,          // the document-this-change / fix-stale-docs prompt descriptors
  moxieMcpServerInfo,       // { name, version }
  moxieMcpProtocolVersion,  // "2025-06-18"
  moxieMcpCapabilities,
  renderSkillMarkdown,      // ({ repository }) => the moxie-docs SKILL.md for a repo
  renderAgentsGuidanceBlock,// ({ repository }) => the AGENTS.md guidance block
  moxieDocsSkillMarkdown,   // the canonical published skill, as a string
  MOXIE_MCP_ENDPOINT,       // "https://moxiedocs.com/api/mcp"
  MOXIE_SITE_URL,
} from "moxie-docs";
```

What it does **not** include: the tool handlers, the indexing/doc-generation pipeline, AI/vector-search, the database layer, or token storage — those remain in the hosted Moxie service.

---

## MCP Registry

Moxie Docs is published to the [Official MCP Registry](https://registry.modelcontextprotocol.io/) as `io.github.jackalope-dev/moxie-docs`. The metadata lives in [`server.json`](server.json) in this repo.

To publish an update after changing `server.json` or bumping the npm version:

```bash
# Authenticate once (GitHub device flow)
mcp-publisher login github

# From this repo root
mcp-publisher publish
```

PulseMCP and other directories ingest from the official registry weekly. After publishing, email [hello@pulsemcp.com](mailto:hello@pulsemcp.com) if you want the listing refreshed sooner.

## Discovery endpoints

Moxie publishes a small machine-discoverable surface so agents and crawlers can find the server:

| Endpoint | What it serves |
| --- | --- |
| `/.well-known/mcp/server-card.json` | MCP server card: `serverInfo`, protocol version, transport, capabilities. |
| `/.well-known/api-catalog` | RFC 9727 catalog linking to the server card and human docs. |
| `/.well-known/agent-skills/index.json` | Agent Skills discovery index (skills + SHA-256 digests). |
| `/.well-known/agent-skills/moxie-docs/SKILL.md` | The published `moxie-docs` skill. |
| `/.well-known/oauth-protected-resource` | OAuth protected-resource metadata (RFC 9728). |
| `/.well-known/oauth-authorization-server` | OAuth authorization-server metadata (RFC 8414). |

---

## License

[MIT](LICENSE) © Jackalope Dev. The contents of this repository (documentation, skill files, and templates) are open source. The hosted Moxie Docs service, indexing pipeline, and generated documentation are not part of this repository.
