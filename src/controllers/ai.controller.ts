import { Request, Response } from "express";
import {
  fetchMigrationRules,
  getMigrationSuggestion,
} from "../services/ai.service";

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
