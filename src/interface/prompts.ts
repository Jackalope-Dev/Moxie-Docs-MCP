export type McpPromptDescriptor = {
  name: string;
  description: string;
  arguments: Array<{ name: string; description: string; required: false }>;
};

export const moxieMcpPrompts: McpPromptDescriptor[] = [
  {
    name: "document-this-change",
    description:
      "Document the code change you are making so the docs land in the same PR. Runs Moxie's doc-impact check on your changed paths and walks you through proposing the doc updates.",
    arguments: [
      {
        name: "changedPaths",
        description:
          "Comma- or space-separated repository-relative paths you are changing. Omit to have the agent gather its own diff first.",
        required: false,
      },
      {
        name: "deletedPaths",
        description:
          "Comma- or space-separated paths your change DELETES, so Moxie can flag docs to remove.",
        required: false,
      },
      {
        name: "repository",
        description:
          'Optional owner/name reference like "acme/app". Needed only when the token serves multiple repos.',
        required: false,
      },
    ],
  },
  {
    name: "fix-stale-docs",
    description:
      "Find this repo's open documentation gaps and drift opportunities and repair them, proposing updates through Moxie.",
    arguments: [
      {
        name: "severity",
        description: "Optional severity filter: high, medium, low, or info.",
        required: false,
      },
      {
        name: "repository",
        description:
          'Optional owner/name reference like "acme/app". Needed only when the token serves multiple repos.',
        required: false,
      },
    ],
  },
];
