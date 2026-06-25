<!--
This is the AGENTS.md block Moxie Docs adds to a connected repository, shown for
reference. Moxie writes it between the markers below into your repo's root
AGENTS.md, preserving any human-authored content outside the markers. `${repository}`
is replaced with your `owner/name`. The block is deterministic and self-healing:
Moxie only re-opens a PR for it if the committed block drifts from this template
or the repository is renamed — not on every index.
-->

# Repository Instructions

<!-- moxie-docs:start -->
## Moxie Docs Agent Guidance

Before editing ${repository}, use the Moxie Docs MCP server for live repository conventions, documentation patterns, gaps, and verified commands. The **moxie-docs** skill (`.claude/skills/moxie-docs/`) has the full edit-then-document workflow — follow it when changing code.

When your Moxie Docs token serves more than one repository, pass `repository: "${repository}"` in every Moxie tool call from this repo so the context targets ${repository}.
<!-- moxie-docs:end -->
