import openai from "../config/openai";
import { buildMigrationPrompt } from "../prompts/migrationPrompt";
import { getMigrationRulesPrompt } from "../prompts/upgradePrompt";
import { buildAuditFixPrompt } from "../prompts/auditPrompt";

export async function getMigrationSuggestion(
  fileName: string,
  code: string,
  warning: string
): Promise<{
  codeUpdated: string;
  explanation: string;
  suggestedPrompt: string;
}> {
  const prompt = buildMigrationPrompt(fileName, code, warning);

  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      { role: "system", content: "You are a senior Angular migration expert." },
      { role: "user", content: prompt },
    ],
    temperature: 0.2,
  });

  try {
    const message = response.choices[0].message?.content || "{}";
    const parsed = JSON.parse(message);
    return {
      codeUpdated: parsed.codeUpdated || "",
      explanation: parsed.explanation || "",
      suggestedPrompt: parsed.suggestedPrompt || "",
    };
  } catch (err) {
    throw new Error("Unable to parse OpenAI response as valid JSON.");
  }
}

export async function fetchMigrationRules(
  fromVersion: number,
  toVersion: number
) {
  const prompt = getMigrationRulesPrompt(fromVersion, toVersion);

  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      { role: "system", content: "You are a senior Angular migration expert." },
      { role: "user", content: prompt },
    ],
    temperature: 0.2,
  });

  const content = response.choices[0].message.content;
  try {
    return JSON.parse(content || "[]");
  } catch (err) {
    throw new Error("Invalid JSON response from AI");
  }
}

export async function getAuditFixSuggestionService(dep: string, advisory: string) {
  const prompt = buildAuditFixPrompt(dep, advisory);
  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      { role: "system", content: "You are a Node.js security expert" },
      { role: "user", content: prompt },
    ],
    temperature: 0.2,
  });

  return JSON.parse(response.choices[0].message?.content || "{}");
}