export const DEFAULT_HOST = "https://ghfind.com";

export const commandCatalog = [
  {
    name: "scan",
    usage: "github-roast scan <username> [-o json|pretty]",
    summary: "Call the website /api/scan endpoint and return the scan payload.",
    api: ["POST /api/scan"],
    output: ["json", "pretty"],
    auth:
      "Production scan requests need either --api-key/GITHUB_ROAST_API_KEY or --turnstile-token/GITHUB_ROAST_TURNSTILE_TOKEN.",
    args: [{ name: "username", required: true }],
    options: ["--host", "--api-key", "--turnstile-token", "-o, --output"],
  },
  {
    name: "score",
    usage: "github-roast score <username> [-o json|pretty]",
    summary: "Call /api/scan and print only the scoring summary.",
    api: ["POST /api/scan"],
    output: ["json", "pretty"],
    auth:
      "Production scan requests need either --api-key/GITHUB_ROAST_API_KEY or --turnstile-token/GITHUB_ROAST_TURNSTILE_TOKEN.",
    args: [{ name: "username", required: true }],
    options: ["--host", "--api-key", "--turnstile-token", "-o, --output"],
  },
  {
    name: "roast",
    usage: "github-roast roast <username> [--lang zh|en] [-o json|markdown|pretty]",
    summary: "Call /api/scan, then pass the returned scan to the website /api/roast endpoint.",
    api: ["POST /api/scan", "POST /api/roast"],
    output: ["json", "markdown", "pretty"],
    auth:
      "Production scan requests need either --api-key/GITHUB_ROAST_API_KEY or --turnstile-token/GITHUB_ROAST_TURNSTILE_TOKEN.",
    args: [{ name: "username", required: true }],
    options: ["--host", "--api-key", "--turnstile-token", "--lang", "-o, --output"],
  },
  {
    name: "auth status",
    usage: "github-roast auth status [--host <url>]",
    summary: "Show the CLI target host and whether local machine-call credentials are configured.",
    api: [],
    output: ["json", "pretty"],
    auth: "Does not contact the server.",
    args: [],
    options: ["--host", "--api-key", "--turnstile-token", "-o, --output"],
  },
  {
    name: "commands",
    usage: "github-roast commands [--json]",
    summary: "List agent-callable CLI commands.",
    api: [],
    output: ["json", "pretty"],
    auth: "Does not contact the server.",
    args: [],
    options: ["--json"],
  },
  {
    name: "commands show",
    usage: "github-roast commands show <command> [--json]",
    summary: "Show one command's arguments, auth requirements, output formats, and website API calls.",
    api: [],
    output: ["json", "pretty"],
    auth: "Does not contact the server.",
    args: [{ name: "command", required: true }],
    options: ["--json"],
  },
];

export function findCommand(name) {
  return commandCatalog.find((cmd) => cmd.name === name || cmd.name.replace(/\s+/g, "-") === name);
}
