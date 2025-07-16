import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";
import { exec } from "child_process";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();
const PORT = 4000;

app.use(express.json());

const upload = multer({ dest: "uploads/" });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.post("/api/upload", upload.single("project"), (req, res) => {
  if (!req.file) return res.status(400).send("No se subió ningún archivo.");

  const zipPath = req.file.path;
  const projectName = path.basename(zipPath, path.extname(zipPath));
  const extractPath = path.join("projects", projectName);

  try {
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(extractPath, true);
    fs.unlinkSync(zipPath);

    return res.status(200).json({
      message: "Proyecto descomprimido correctamente.",
      projectPath: extractPath,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ error: "Error descomprimiendo el archivo.", details: error });
  }
});

app.get("/api/project/info", (req, res) => {
  const { path: projectPath } = req.query;
  if (!projectPath || typeof projectPath !== "string")
    return res.status(400).send("Falta parámetro path.");

  const findPackageJson = (dir: string): string | null => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isFile() && entry.name === "package.json") return fullPath;
      if (entry.isDirectory()) {
        const nested = findPackageJson(fullPath);
        if (nested) return nested;
      }
    }
    return null;
  };

  const packageJsonPath = findPackageJson(projectPath);
  if (!packageJsonPath) {
    return res
      .status(404)
      .json({ error: "No se encontró package.json en el proyecto." });
  }

  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    const dependencies = packageJson.dependencies || {};
    const angularCore = dependencies["@angular/core"] || "No detectado";

    return res
      .status(200)
      .json({ version: angularCore, dependencies, path: packageJsonPath });
  } catch (error) {
    return res
      .status(500)
      .json({ error: "No se pudo leer package.json.", details: error });
  }
});

app.get("/api/project/warnings", (req, res) => {
  const { path: projectPath } = req.query;
  if (!projectPath || typeof projectPath !== "string")
    return res.status(400).send("Falta parámetro path.");

  const warnings: string[] = [];

  const scanFiles = (dir: string) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanFiles(fullPath);
      } else if (
        entry.isFile() &&
        (entry.name.endsWith(".ts") || entry.name.endsWith(".html"))
      ) {
        const content = fs.readFileSync(fullPath, "utf8");

        if (content.includes("@angular/http")) {
          warnings.push(
            `[${entry.name}] Usa @angular/http (obsoleto desde Angular 5)`
          );
        }
        if (content.includes("Http")) {
          warnings.push(
            `[${entry.name}] Posible uso de Http antiguo (debe usar HttpClient)`
          );
        }
        if (content.match(/\.map\(/)) {
          warnings.push(
            `[${entry.name}] Uso de operador .map obsoleto de RxJS`
          );
        }
      }
    }
  };

  try {
    scanFiles(projectPath);
    return res.status(200).json({ warnings });
  } catch (error) {
    return res
      .status(500)
      .json({ error: "Error analizando el proyecto.", details: error });
  }
});

app.post("/api/ai/suggest", async (req, res) => {
  const { fileName, code, warning } = req.body;

  if (!fileName || !code || !warning) {
    return res
      .status(400)
      .json({ error: "Faltan parámetros requeridos: fileName, code, warning" });
  }

  try {
    const migrationPrompt = `Tengo el siguiente archivo llamado ${fileName} con código antiguo de Angular:

${code}

He detectado este problema: ${warning}.

Actualiza el código para que sea compatible con Angular 17. Devuelve solo el código actualizado como bloque TypeScript (\`\`\`typescript ... \`\`\`), seguido por una explicación breve.`;

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "Eres un experto en migraciones de Angular.",
        },
        { role: "user", content: migrationPrompt },
      ],
      temperature: 0.2,
    });

    const fullResponse = response.choices[0].message?.content || "";

    // Extraer el bloque de código TypeScript
    const codeMatch = fullResponse.match(/```typescript\n([\s\S]*?)```/);
    const codeUpdated = codeMatch ? codeMatch[1].trim() : "";

    // Extraer la explicación textual
    const explanation = fullResponse
      .replace(/```typescript[\s\S]*?```/, "")
      .trim();

    return res.status(200).json({ codeUpdated, explanation });
  } catch (error) {
    console.error("Error al consultar OpenAI:", error);
    return res
      .status(500)
      .json({ error: "Error al consultar OpenAI.", details: error });
  }
});

app.post("/api/project/apply-suggestion", (req, res) => {
  const { filePath, codeUpdated } = req.body;

  if (!filePath || !codeUpdated) {
    return res
      .status(400)
      .json({ error: "Faltan parámetros: filePath y codeUpdated requeridos." });
  }

  try {
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "El archivo no existe." });
    }

    // Crear copia de seguridad
    const backupPath = `${filePath}.bak`;
    fs.copyFileSync(filePath, backupPath);

    // Sobrescribir el archivo con el código nuevo
    fs.writeFileSync(filePath, codeUpdated, "utf8");

    return res
      .status(200)
      .json({
        message: "Archivo actualizado correctamente.",
        backup: backupPath,
      });
  } catch (error) {
    return res
      .status(500)
      .json({ error: "Error al aplicar la sugerencia.", details: error });
  }
});

app.get("/api/project/backups", (req, res) => {
  const { path: projectPath } = req.query;
  if (!projectPath || typeof projectPath !== "string") {
    return res.status(400).json({ error: "Falta parámetro path" });
  }

  const backups: string[] = [];

  const scanBackups = (dir: string) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanBackups(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".bak")) {
        backups.push(fullPath);
      }
    }
  };

  try {
    scanBackups(projectPath);
    return res.status(200).json({ backups });
  } catch (error) {
    return res
      .status(500)
      .json({ error: "Error buscando backups.", details: error });
  }
});

app.post("/api/project/restore-backup", (req, res) => {
  const { filePath } = req.body;

  if (!filePath || !filePath.endsWith(".bak")) {
    return res
      .status(400)
      .json({ error: "Se requiere un archivo .bak válido para restaurar." });
  }

  const originalPath = filePath.replace(/\.bak$/, "");

  try {
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "El archivo .bak no existe." });
    }

    fs.copyFileSync(filePath, originalPath);
    return res
      .status(200)
      .json({
        message: "Archivo restaurado correctamente.",
        restoredTo: originalPath,
      });
  } catch (error) {
    return res
      .status(500)
      .json({ error: "Error al restaurar el archivo.", details: error });
  }
});
app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
