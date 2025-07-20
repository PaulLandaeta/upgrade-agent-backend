export function buildMigrationPrompt(
  fileName: string,
  code: string,
  warning: string
): string {
  return `
You are an expert Angular developer assisting in migrating legacy Angular code to the latest version (Angular 8).

I have the following file named: ${fileName}

\`\`\`ts
${code}
\`\`\`

During static analysis, we identified this issue:

${warning}

Please provide a structured migration suggestion in the following JSON format:

{
  "codeUpdated": "The updated Angular 8-compliant code.",
  "explanation": "A clear and concise explanation of the changes made and why they are necessary.",
  "suggestedPrompt": "A long, helpful follow-up prompt the user can use to refine or adjust the migration. How can they improve the migration further?"
}

Ensure the updated code follows best practices recommended in Angular 8, including module imports, HttpClient usage, RxJS operators, and strict typing where applicable. Do not include Markdown formatting or extra explanation outside the JSON.
`.trim();
}
