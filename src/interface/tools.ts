export type McpToolAnnotations = {
  title: string;
  readOnlyHint: boolean;
  destructiveHint: boolean;
  idempotentHint: boolean;
  openWorldHint: boolean;
};

export type McpTool = {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
  annotations: McpToolAnnotations;
};

export const readOnlyAnnotations = (title: string): McpToolAnnotations => ({
  title,
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
});

export const repositoryArgSchema = {
  repository: {
    type: "string",
    description:
      "The target repository as \"owner/name\" (e.g. \"acme/app\"). Always pass this unless your token is scoped to a single repository. Matching is case-insensitive. If omitted when the token serves multiple repos, the call returns the list of repositories to choose from instead of an answer.",
  },
};

export const moxieMcpTools: McpTool[] = [
  {
    name: "moxie.get_conventions",
    description:
      "Get the coding conventions Moxie inferred for the repository. Read-only; no side effects. Returns a Markdown list grouped by category (e.g. testing, structure, docs, review); each convention has a title, summary, confidence score, agent guidance, and the source file paths that evidence it. Use this for the general rules to follow; when you already know the files you're about to edit, prefer moxie.get_doc_impact for conventions scoped to those paths.",
    inputSchema: {
      type: "object",
      properties: {
        ...repositoryArgSchema,
        category: {
          type: "string",
          description: "Optional category filter, such as testing, structure, docs, or review.",
        },
      },
    },
    annotations: readOnlyAnnotations("Get repository conventions"),
  },
  {
    name: "moxie.search_docs",
    description:
      "Keyword and semantic search across the connected repository's generated docs, conventions, documentation gaps, AI-context notes, and indexed code. Read-only; no side effects. Returns ranked matches in Markdown grouped into Documentation and Code sections, each with a title, snippet, and source paths. Use for open-ended lookups when you don't know which category holds the answer; when you do, the specific getters (get_conventions, get_doc_gaps, get_documentation_opportunities) are more direct. Omitting query returns recent context instead.",
    inputSchema: {
      type: "object",
      properties: {
        ...repositoryArgSchema,
        query: {
          type: "string",
          description: "Search phrase or topic. Omit to return recent context for the repository.",
        },
        limit: {
          type: "number",
          description: "Maximum matches to return (1-20, default 8).",
        },
      },
    },
    annotations: readOnlyAnnotations("Search docs and code"),
  },
  {
    name: "moxie.list_docs",
    description:
      "List the repository's generated documentation as a browsable table of contents — every doc page, not a query-filtered subset. Read-only; no side effects. Returns Markdown grouped by section, each entry with its title, slug, repository path, and source paths, plus the total count and a pagination cursor so you can tell whether more pages remain (no silent truncation). Use this to see what docs already exist before adding one (so you don't duplicate) or to find the slug to pass to propose_doc_update; when you are hunting for a specific topic, search_docs is more direct.",
    inputSchema: {
      type: "object",
      properties: {
        ...repositoryArgSchema,
        section: {
          type: "string",
          description:
            "Optional section/collection filter (case-insensitive substring), e.g. \"Backend\" or \"Billing\". Omit to list every section.",
        },
        limit: {
          type: "number",
          description: "Maximum docs to return (1-200, default 50).",
        },
        offset: {
          type: "number",
          description:
            "Number of docs to skip for pagination (default 0). Use the cursor in the response to fetch the next page.",
        },
      },
    },
    annotations: readOnlyAnnotations("List documentation pages"),
  },
  {
    name: "moxie.get_doc_gaps",
    description:
      "List the unresolved documentation gaps Moxie found — areas of the codebase that lack docs. Read-only; no side effects. Returns a Markdown list, each gap with a title, severity, summary, and suggested file paths. This is gaps only; for the full prioritized work queue that also includes drift repairs and PR-template work, use get_documentation_opportunities, and to scope gaps to files you're about to edit use get_doc_impact.",
    inputSchema: {
      type: "object",
      properties: {
        ...repositoryArgSchema,
        severity: {
          type: "string",
          description: "Optional severity filter: high, medium, low, or info.",
        },
      },
    },
    annotations: readOnlyAnnotations("List documentation gaps"),
  },
  {
    name: "moxie.get_documentation_opportunities",
    description:
      "List the actionable documentation updates Moxie recommends as a prioritized queue: missing docs, drift repairs, and PR-template work. Read-only; no side effects. Returns a Markdown list, each opportunity with a title, kind (documentation_gap | documentation_drift | pr_template), severity, summary, suggested action, estimated files changed, and source paths. Use this to pick the next doc task; it is the superset of get_doc_gaps (which lists gaps only).",
    inputSchema: {
      type: "object",
      properties: {
        ...repositoryArgSchema,
        kind: {
          type: "string",
          description:
            "Optional kind filter: documentation_gap, documentation_drift, or pr_template.",
        },
        severity: {
          type: "string",
          description: "Optional severity filter: high, medium, low, or info.",
        },
      },
    },
    annotations: readOnlyAnnotations("List documentation opportunities"),
  },
  {
    name: "moxie.get_documentation_patterns",
    description:
      "Get Moxie's summary of how THIS repository organizes and maintains documentation — where docs live relative to code and how they are kept current. Read-only; no side effects. Returns a Markdown list of pattern entries, each with a title, explanation, and source citations. Use this to decide WHERE a new doc should go before calling propose_doc_update; for the list of WHICH docs need work, use get_documentation_opportunities instead.",
    inputSchema: {
      type: "object",
      properties: {
        ...repositoryArgSchema,
      },
    },
    annotations: readOnlyAnnotations("Get documentation patterns"),
  },
  {
    name: "moxie.get_ai_context",
    description:
      "Get the compact briefing an agent should read before editing this repository: index status, verified commands, agent tips, top conventions, open documentation gaps, and queued documentation opportunities. Read-only; no side effects. Returns a single Markdown document. Call this first at the start of a task; once you know which files you'll change, follow up with get_doc_impact for path-scoped guidance.",
    inputSchema: {
      type: "object",
      properties: {
        ...repositoryArgSchema,
      },
    },
    annotations: readOnlyAnnotations("Get pre-edit AI context"),
  },
  {
    name: "moxie.get_doc_impact",
    description:
      "Given the file paths an agent is about to change (and optionally a subset being deleted), return the conventions, documentation gaps, and existing/related docs whose evidence overlaps those paths, plus a net-new/undocumented analysis and any removal candidates. Read-only; no side effects. Returns a Markdown report. Call this BEFORE writing code so doc updates land in the same PR; then use propose_doc_update to write a doc, or propose_doc_removal for an orphaned one.",
    inputSchema: {
      type: "object",
      properties: {
        ...repositoryArgSchema,
        changedPaths: {
          type: "array",
          items: { type: "string" },
          description:
            "Repository-relative file paths the agent intends to modify (e.g., apps/web/src/app/api/billing/webhook/route.ts).",
        },
        deletedPaths: {
          type: "array",
          items: { type: "string" },
          description:
            "Subset of paths that are being DELETED. Moxie flags any doc whose every cited source path is in this list as a removal candidate for moxie.propose_doc_removal.",
        },
      },
      required: ["changedPaths"],
    },
    annotations: readOnlyAnnotations("Analyze documentation impact"),
  },
  {
    name: "moxie.propose_doc_update",
    description:
      "Propose a documentation file to add or update as part of YOUR current change. Records a new proposal each call (not idempotent) and does NOT modify your repository or open a PR — Moxie resolves the target path and returns the path + Markdown for YOU to write into your working branch, so the docs land in the SAME PR as the code. Returns the resolved target path and the content to write. Provide either targetPath or baseSlug.",
    inputSchema: {
      type: "object",
      properties: {
        ...repositoryArgSchema,
        title: {
          type: "string",
          description: "Short human title for the documentation update.",
        },
        markdown: {
          type: "string",
          description: "The documentation content (Markdown) to write to the target file.",
        },
        targetPath: {
          type: "string",
          description:
            "Repository-relative path to write the doc to (e.g., docs/billing.md). Omit to resolve from baseSlug.",
        },
        baseSlug: {
          type: "string",
          description:
            "Slug of an existing generated doc to update instead of supplying targetPath.",
        },
        sourcePaths: {
          type: "array",
          items: { type: "string" },
          description: "Code paths this doc documents, for provenance.",
        },
        reason: {
          type: "string",
          description: "Why this doc is being added or changed.",
        },
      },
      required: ["title", "markdown"],
    },
    annotations: {
      title: "Propose a doc to add or update",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
  },
  {
    name: "moxie.propose_doc_removal",
    description:
      "Propose deleting a Moxie-tracked documentation file that your change makes irrelevant, as part of YOUR current change. Moxie validates the path and returns it for you to delete in your working branch; Moxie itself does not delete files or open a PR — the deletion happens in your branch, so it lands in the SAME PR as the code. Returns the resolved path to delete. Provide either slug or targetPath.",
    inputSchema: {
      type: "object",
      properties: {
        ...repositoryArgSchema,
        slug: {
          type: "string",
          description: "Slug of the existing generated doc to remove.",
        },
        targetPath: {
          type: "string",
          description:
            "Repository-relative path of the doc to remove (must be a Moxie-tracked doc). Use instead of slug.",
        },
        removedSourcePaths: {
          type: "array",
          items: { type: "string" },
          description: "Code paths being deleted that made this doc irrelevant, for provenance.",
        },
        reason: {
          type: "string",
          description: "Why this doc is no longer relevant.",
        },
      },
    },
    annotations: {
      title: "Propose a doc removal",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
  },
];
