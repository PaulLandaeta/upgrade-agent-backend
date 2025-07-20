import openai from "../config/openai";
import { buildMigrationPrompt } from "../prompts/frameworkMigrationPrompt";

export async function getMigrationSuggestion(
  projectPath: string,
  projectSource: { type: 'upload' | 'git', gitUrl?: string }
): Promise<{
  projectStructure: string;
  fileList: Array<{
    filePath: string;
    fileName: string;
    fileType: string;
    content: string;
  }>;
  migrationNotes: string;
  dependencies: string;
}> {
  const prompt = buildMigrationPrompt(projectPath, projectSource);
  console.log("📂 prompt", prompt);

  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      { role: "system", content: "You are a senior Angular to Flutter migration expert." },
      { role: "user", content: prompt },
    ],
    temperature: 0.2,
  });

  try {
    const message = response.choices[0].message?.content || "{}";
    console.log("🔍 prompt message:", message);
    console.log("🔍 typeof message:", typeof message);
    const parsed = JSON.parse(message || "{}");
    return {
      projectStructure: parsed.projectStructure || "",
      fileList: parsed.fileList || [],
      migrationNotes: parsed.migrationNotes || "",
      dependencies: parsed.dependencies || "",
    };
  } catch (err) {
    console.log("🔍 Error", err);
    throw new Error("Unable to parse OpenAI response as valid JSON.");
  }
}

