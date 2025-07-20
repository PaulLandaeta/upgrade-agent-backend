export function buildAngularToReactPrompt(
  componentTs: string,
  templateHtml: string,
  styles: string,
  serviceCode?: string
): string {
  return `
You are a senior developer skilled in Angular and React. I need you to help me convert an Angular component to React.

Here is the Angular component TypeScript logic:
\`\`\`ts
${componentTs}
\`\`\`

Here is the Angular template (HTML):
\`\`\`html
${templateHtml}
\`\`\`

Here are the component styles:
\`\`\`css
${styles}
\`\`\`

${serviceCode ? `This component uses a service:\n\`\`\`ts\n${serviceCode}\n\`\`\`` : ''}

Please convert this component to a React functional component using React hooks and best practices. The final result should include:
- A '.tsx' file with component logic and JSX
- A suggestion for how to organize the styles (CSS module or styled-components)
- Any changes in state management or services as needed

Return the result in this JSON format:
{
  "reactComponent": "The .tsx file code",
  "explanation": "Explanation of the changes and how it maps from Angular to React"
}
`.trim();
}
