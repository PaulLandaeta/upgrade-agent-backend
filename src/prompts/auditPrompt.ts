export function buildAuditFixPrompt(
  dependency: string,
  advisory: string
): string {
  return `
You are a Node.js security expert. I have a project with a vulnerable dependency: **${dependency}**.

Security Advisory:
${advisory}

Please provide a solution in the following JSON format:

{
  "fix": "exact npm command to fix the vulnerability (e.g., npm install ${dependency}@latest or npm uninstall ${dependency})",
  "explanation": "Explain why this fix resolves the issue and any impact it may have"
}

Respond with only valid JSON, no extra text.
`.trim();
}
