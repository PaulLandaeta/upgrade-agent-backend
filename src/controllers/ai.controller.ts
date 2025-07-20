import { Request, Response } from "express";
import {
  fetchMigrationRules,
  getAuditFixSuggestionService,
  getMigrationSuggestion,
} from "../services/ai.service";
import { getMigrationSuggestion as getFrameworkMigrationSuggestion } from "../services/ai.frameworkMigrationService";

export const suggestMigration = async (req: Request, res: Response) => {
  const { fileName, code, warning } = req.body;

  if (!fileName || !code || !warning) {
    return res
      .status(400)
      .json({ error: "Faltan parámetros requeridos: fileName, code, warning" });
  }

  try {
    const { codeUpdated, explanation, suggestedPrompt } =
      await getMigrationSuggestion(fileName, code, warning);
    return res.status(200).json({ codeUpdated, explanation, suggestedPrompt });
  } catch (error) {
    console.error("Error al consultar OpenAI:", error);
    return res
      .status(500)
      .json({ error: "Error al consultar OpenAI.", details: error });
  }
};

export const getMigrationRules = async (req: Request, res: Response) => {
  const { from, to } = req.query;

  if (!from || !to)
    return res
      .status(400)
      .json({ error: "Missing 'from' and 'to' version params" });

  try {
    const rules = await fetchMigrationRules(Number(from), Number(to));
    res.json({ rules });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch migration rules", details: error });
  }
};

export const getAuditFixSuggestion = async (req: Request, res: Response ) => {
  const { module, title } = req.body;

  if (!module || !title) {
    return res.status(400).json({ error: "Missing module or title" });
  }

  try {
    const fix = await getAuditFixSuggestionService(module, title);
    res.json(fix);
  } catch (err) {
    res.status(500).json({ error: "AI failed to suggest a fix" });
  }
};

export const suggestFrameworkMigration = async (req: Request, res: Response) => {
  const isDebug = process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true';
  
  if (isDebug) {
    console.log("🚀 Framework migration request received");
    console.log("📦 Request body:", req.body);
  }
  
  const { projectPath, projectSource } = req.body;

  if (!projectPath) {
    if (isDebug) console.log("❌ Missing projectPath parameter");
    return res
      .status(400)
      .json({ error: "Missing required parameter: projectPath" });
  }

  if (isDebug) console.log("📂 Project path:", projectPath);

  // Default project source if not provided
  const source = projectSource || { type: 'upload' };

  try {
    if (isDebug) console.log("🔄 Starting framework migration process...");
    const migrationResult = await getFrameworkMigrationSuggestion(projectPath, source);
    if (isDebug) {
      console.log("✅ Migration completed successfully");
      console.log("📊 Migration result keys:", Object.keys(migrationResult));
      console.log("📊 Result type:", typeof migrationResult);
    }
    return res.status(200).json(migrationResult);
  } catch (error) {
    console.error("❌ Error during framework migration:", error);
    if (isDebug) {
      console.error("📍 Error stack:", error instanceof Error ? error.stack : "No stack trace");
    }
    return res
      .status(500)
      .json({ error: "Error during framework migration", details: error });
  }
};

export const debugFrameworkMigration = async (req: Request, res: Response) => {
  const { projectPath } = req.body;
  
  try {
    // Check if project path exists
    const fs = require('fs');
    const path = require('path');
    
    const debugInfo = {
      timestamp: new Date().toISOString(),
      projectPath,
      projectExists: fs.existsSync(projectPath),
      projectIsDirectory: fs.existsSync(projectPath) ? fs.lstatSync(projectPath).isDirectory() : false,
      projectContents: fs.existsSync(projectPath) ? fs.readdirSync(projectPath) : [],
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        OPENAI_API_KEY: process.env.OPENAI_API_KEY ? "SET" : "NOT_SET"
      }
    };
    
    return res.status(200).json(debugInfo);
  } catch (error) {
    return res.status(500).json({ error: "Debug failed", details: error });
  }
};
