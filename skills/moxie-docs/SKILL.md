---
name: moxie-docs
description: Use when working in a GitHub repository connected to Moxie Docs — read its living documentation, conventions, and architecture context over the Moxie Docs MCP server before editing code, and keep those docs in sync by proposing doc updates and removals that land in the same PR as the code change.
---

# Moxie Docs MCP

Moxie Docs indexes a GitHub repository and exposes its generated documentation,
discovered conventions, documentation gaps, and AI context through a remote MCP
server. Use it to ground your work in how a specific repository actually does
things, and to keep its docs current as you change the code.

## Connect

- **Transport:** streamable-HTTP MCP
- **Endpoint:** `https://moxiedocs.com/api/mcp`
- **Protocol version:** `2025-06-18`
- **Auth:** send `Authorization: Bearer <token>`. Create a token in the Moxie
  Docs dashboard (Settings → MCP); each token is scoped to a workspace.
- **Repository selection:** tools accept an optional `repository` argument
  (`owner/name`, e.g. `acme/app`). It is required only when a token is
  authorized for multiple repositories and no default is set.

Human documentation: https://moxiedocs.com/mcp

## Before you edit code

Read context first so your change matches the repository's conventions and so
any docs work lands in the same PR:

1. `moxie.get_ai_context` — compact briefing: repo status, commands,
   conventions, doc gaps, and team notes. Read this first.
2. `moxie.get_doc_impact` — pass the file paths you are about to change
   (`changedPaths`); returns the conventions, doc gaps, and existing docs whose
   evidence overlaps those paths. List deletions in `deletedPaths` to surface
   docs that should be removed.
3. `moxie.get_conventions` / `moxie.search_docs` — look up specific
   conventions or search the generated docs for a topic.

## Keep docs in sync

When your change adds, alters, or obsoletes behavior that the docs describe:

- `moxie.propose_doc_update` — supply a `title` and the Markdown content;
  Moxie resolves the target path and returns the path + Markdown for **you** to
  write into your working branch.
- `moxie.propose_doc_removal` — name a Moxie-tracked doc your change makes
  irrelevant; Moxie validates the path and returns it for you to delete.

Moxie records the proposal and hands the file back to you — it does **not** open
a separate PR. Write the returned files into your branch so the docs ship in the
**same PR** as the code.

## All tools

| Tool | Purpose |
| --- | --- |
| `moxie.get_ai_context` | Compact pre-edit briefing for the repository. |
| `moxie.get_doc_impact` | Conventions/gaps/docs overlapping paths you will change. |
| `moxie.get_conventions` | Discovered conventions with confidence and citations. |
| `moxie.search_docs` | Search generated docs, conventions, gaps, and AI context. |
| `moxie.get_doc_gaps` | Unresolved documentation gaps with severity and paths. |
| `moxie.get_documentation_opportunities` | Recommended doc work: missing docs, drift repairs, PR templates. |
| `moxie.get_documentation_patterns` | How the repository organizes and maintains its docs. |
| `moxie.list_docs` | Paginated, section-grouped table of contents of every generated doc. |
| `moxie.propose_doc_update` | Add/update a doc as part of your current change. |
| `moxie.propose_doc_removal` | Delete an obsolete Moxie-tracked doc as part of your change. |

## Notes

- All write tools are proposals returned to you; Moxie never edits the
  repository directly through MCP.
- Tools operate only on repositories connected to Moxie Docs and authorized for
  your token.
