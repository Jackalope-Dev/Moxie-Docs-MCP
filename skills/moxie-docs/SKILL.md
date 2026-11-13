---
name: moxie-docs
description: Use when working in a GitHub repository connected to Moxie Docs - read its living documentation, conventions, and architecture context over the Moxie Docs MCP server before editing code, and keep those docs in sync by proposing doc updates and removals that land in the same PR as the code change.
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
- **Auth:** send `Authorization: Bearer <token>`. Create a token in the Moxie Docs
  Docs dashboard (Settings → MCP); each token is scoped to a workspace.
- **Repository selection:** tools accept an optional `repository` argument
  (`owner/name`, e.g. `acme/app`). It is required only when a token is
  authorized for multiple repositories and no default is set.

Human documentation: https://moxiedocs.com/mcp

## Before you edit code

Read context first so your change matches the repository's conventions and so
any docs work lands in the same PR:

1. `moxie.get_ai_context` - compact briefing: repo status, commands,
   conventions, doc gaps, and team notes. Read this first.
2. `moxie.get_doc_impact` - pass the file paths you are about to change
   (`changedPaths`); returns the conventions, doc gaps, and existing docs whose
   evidence overlaps those paths. List deletions in `deletedPaths` to surface
   docs that should be removed.
3. `moxie.get_conventions` / `moxie.search_docs` - look up specific
   conventions or search the generated docs for a topic.

## Keep docs in sync

When your change adds, alters, or obsoletes behavior that the docs describe:

- `moxie.propose_doc_update` - supply a `title` and the Markdown content;
  Moxie Docs resolves the target path and returns the path + Markdown for **you** to
  write into your working branch.
- `moxie.propose_doc_removal` - name a Moxie Docs-tracked doc your change makes
  irrelevant; Moxie Docs validates the path and returns it for you to delete.

Moxie Docs records the proposal and hands the file back to you - it does **not** open
a separate PR. Write the returned files into your branch so the docs ship in the
**same PR** as the code.

## All tools

| Tool | Purpose |
| --- | --- |
| `moxie.get_conventions` | Returns categorized repo conventions, confidence, and evidence paths agents should follow before editing. |
| `moxie.search_docs` | Searches generated docs and source-linked explanations for implementation details, APIs, flows, and patterns. |
| `moxie.list_docs` | Lists every generated doc as a paginated table of contents, grouped by section, so agents can browse what already exists before adding more. |
| `moxie.get_doc_gaps` | Lists missing or stale documentation areas with severity, summaries, and suggested doc paths. |
| `moxie.get_documentation_opportunities` | Lists recommended documentation updates agents should consider while planning or finishing code changes. |
| `moxie.get_documentation_patterns` | Explains where this repo keeps docs today so generated updates follow the team's existing structure. |
| `moxie.get_ai_context` | Provides compact agent-ready context: setup status, commands, conventions, docs, gaps, and team notes. |
| `moxie.get_doc_impact` | Given the file paths an agent plans to change, returns the matching conventions, doc gaps, and existing docs to update in the same PR, and flags net-new or undocumented paths. |
| `moxie.get_api_context` | Given the files an agent is about to touch, returns the API endpoints they map to with method, path, request and response schema, and known consumers. |
| `moxie.review_change` | Self-reviews a change before the PR opens: flags convention breaches, docs the change makes false, undocumented new surface, and doc references broken by deletions. |
| `moxie.propose_doc_update` | Resolves where a doc should live and returns the path and content for the agent to write into its own branch, so docs land in the same PR as the code change. |
| `moxie.propose_doc_removal` | Validates and returns the path of a now-irrelevant Moxie Docs-tracked doc so the agent deletes it in the same PR as the code change. |

## Notes

- All write tools are proposals returned to you; Moxie Docs never edits the
  repository directly through MCP.
- Tools operate only on repositories connected to Moxie Docs and authorized for
  your token.
