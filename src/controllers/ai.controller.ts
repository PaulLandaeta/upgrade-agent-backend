import { Request, Response } from 'express';
import { getMigrationSuggestion } from '../services/ai.service';

export const suggestMigration = async (req: Request, res: Response) => {
  const { fileName, code, warning } = req.body;

  if (!fileName || !code || !warning) {
    return res.status(400).json({ error: 'Faltan parámetros requeridos: fileName, code, warning' });
  }

  try {
    const { codeUpdated, explanation } = await getMigrationSuggestion(fileName, code, warning);
    return res.status(200).json({ codeUpdated, explanation });
  } catch (error) {
    console.error('Error al consultar OpenAI:', error);
    return res.status(500).json({ error: 'Error al consultar OpenAI.', details: error });
  }
};