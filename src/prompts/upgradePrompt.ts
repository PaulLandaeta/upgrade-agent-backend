export const getMigrationRulesPrompt = (fromVersion: number, toVersion: number) => `
You are an expert in Angular migrations.

Provide a list of **breaking changes**, **deprecations**, and **API changes** when migrating from Angular ${fromVersion} to Angular ${toVersion}.

Format the response as a JSON array with this schema:
[
  {
    "title": "Description of the change",
    "reason": "Why the change happened",
    "fileTypes": [".ts", ".html"],
    "pattern": "String to look for or regex",
    "recommendation": "What should be done instead"
  }
]
Only include concrete patterns that can be searched programmatically.
`;
