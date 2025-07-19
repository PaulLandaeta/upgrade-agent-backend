import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";
import { exec } from "child_process";
import { Request, Response } from "express";
import { promisify } from "util";
import { fetchMigrationRules } from "../services/ai.service";

const execAsync = promisify(exec);
const BASE_DIR = path.resolve("projects");

export const listProjects = (req: Request, res: Response) => {
  try {
    const projectIds = fs
      .readdirSync(BASE_DIR, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);

    const projects = projectIds.map((id) => {
      const fullPath = path.join(BASE_DIR, id);
      const subfolders = fs
        .readdirSync(fullPath, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name);

      return {
        id,
        originalFolder: subfolders[0] || "unknown",
      };
    });

    return res.status(200).json(projects);
  } catch (error) {
    console.error("Error reading project folders:", error);
    return res.status(500).json({ error: "Unable to read project list." });
  }
};

export const uploadProject = (req: Request, res: Response) => {
  if (!req.file) return res.status(400).send("No file was uploaded.");

  const zipPath = req.file.path;
  const projectName = path.basename(zipPath, path.extname(zipPath));
  const extractPath = path.join("projects", projectName);

  try {
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(extractPath, true);
    fs.unlinkSync(zipPath);

    const macosxPath = path.join(extractPath, "__MACOSX");
    if (fs.existsSync(macosxPath)) {
      fs.rmSync(macosxPath, { recursive: true, force: true });
      console.log("Removed __MACOSX folder");
    }

    return res.status(200).json({
      message: "Project successfully extracted.",
      projectPath: extractPath,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ error: "Failed to extract project.", details: error });
  }
};

export const getProjectInfo = (req: Request, res: Response) => {
  const { path: projectPath } = req.query;
  if (!projectPath || typeof projectPath !== "string")
    return res.status(400).send("Missing 'path' parameter.");

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
      .json({ error: "No package.json found in the project." });
  }

  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    const dependencies = packageJson.dependencies || {};
    const angularCore = dependencies["@angular/core"] || "Not detected";

    return res
      .status(200)
      .json({ version: angularCore, dependencies, path: packageJsonPath });
  } catch (error) {
    return res
      .status(500)
      .json({ error: "Failed to read package.json.", details: error });
  }
};

//this need to be improved with AI
// export const getWarnings = (req: Request, res: Response) => {
//   const { path: projectPath } = req.query;
//   if (!projectPath || typeof projectPath !== "string")
//     return res.status(400).send("Missing 'path' parameter.");

//   const warnings: string[] = [];

//   const scanFiles = (dir: string) => {
//     const entries = fs.readdirSync(dir, { withFileTypes: true });
//     for (const entry of entries) {
//       const fullPath = path.join(dir, entry.name);
//       if (entry.isDirectory()) {
//         scanFiles(fullPath);
//       } else if (
//         entry.isFile() &&
//         (entry.name.endsWith(".ts") || entry.name.endsWith(".html"))
//       ) {
//         const content = fs.readFileSync(fullPath, "utf8");

//         if (content.includes("@angular/http")) {
//           warnings.push(
//             `[${entry.name}] Uses @angular/http (deprecated since Angular 5)`
//           );
//         }
//         if (content.includes("Http")) {
//           warnings.push(
//             `[${entry.name}] Possible legacy Http usage (should use HttpClient)`
//           );
//         }
//         if (content.match(/\.map\(/)) {
//           warnings.push(`[${entry.name}] Uses deprecated RxJS .map operator`);
//         }
//       }
//     }
//   };

//   try {
//     scanFiles(projectPath);
//     return res.status(200).json({ warnings });
//   } catch (error) {
//     return res
//       .status(500)
//       .json({ error: "Error scanning the project.", details: error });
//   }
// };

const cacheRules = async (from: number, to: number) => {
  const rulesPath = path.resolve(__dirname, `../rules/a${from}-to-a${to}.json`);

  if (!fs.existsSync(rulesPath)) {
    const rules = await fetchMigrationRules(from, to);
    fs.writeFileSync(rulesPath, JSON.stringify(rules, null, 2), "utf8");
  }

  return JSON.parse(fs.readFileSync(rulesPath, "utf8"));
};

type Warning = {
  filePath: string;
  description: string;
};

export const getWarnings = async (req: Request, res: Response) => {
  const { path: projectPath, from, to } = req.query;
  if (!projectPath || typeof projectPath !== "string") {
    return res.status(400).send("Missing 'path' parameter.");
  }
  if (!from || !to) {
    return res.status(400).send("Missing 'from' or 'to' Angular version.");
  }

  const rules = await cacheRules(Number(from), Number(to));
  const warnings: Warning[] = [];

  const scanFiles = (dir: string) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        scanFiles(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        const content = fs.readFileSync(fullPath, "utf8");

        for (const rule of rules) {
          if (!rule.fileTypes.includes(ext)) continue;
          const regex = new RegExp(rule.pattern, "g");
          const matches = content.match(regex);

          if (matches && matches.length > 0) {
            warnings.push({
              filePath: fullPath.replace(projectPath, ""),
              description: `${rule.title}: ${rule.recommendation}`,
            });
          }
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
      .json({ error: "Error scanning the project.", details: error });
  }
};

export const applySuggestion = (req: Request, res: Response) => {
  let { filePath, codeUpdated, fileName } = req.body;

  if (!filePath || !codeUpdated) {
    return res.status(400).json({
      error: "Missing required parameters: filePath and codeUpdated.",
    });
  }

  try {
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File does not exist." });
    }
    filePath = `${filePath}/rpp-ng-recon-admin/src/app/${fileName}`;
    const backupPath = `${filePath}.bak`;
    fs.copyFileSync(filePath, backupPath);
    fs.writeFileSync(filePath, codeUpdated, "utf8");

    return res.status(200).json({
      message: "File updated successfully.",
      backup: backupPath,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ error: "Failed to apply the suggestion.", details: error });
  }
};

export const listBackups = (req: Request, res: Response) => {
  const { path: projectPath } = req.query;
  if (!projectPath || typeof projectPath !== "string") {
    return res.status(400).json({ error: "Missing 'path' parameter." });
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
      .json({ error: "Error searching for backups.", details: error });
  }
};

export const restoreBackup = (req: Request, res: Response) => {
  const { filePath } = req.body;

  if (!filePath || !filePath.endsWith(".bak")) {
    return res
      .status(400)
      .json({ error: "A valid .bak file is required for restoration." });
  }

  const originalPath = filePath.replace(/\.bak$/, "");

  try {
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: ".bak file not found." });
    }

    fs.copyFileSync(filePath, originalPath);
    return res.status(200).json({
      message: "Backup restored successfully.",
      restoredTo: originalPath,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ error: "Failed to restore the file.", details: error });
  }
};

export const getFileContent = (req: Request, res: Response) => {
  console.log("getFileContent called with query:", req.query);
  const { path: projectPath, file } = req.query;

  if (
    !projectPath ||
    !file ||
    typeof projectPath !== "string" ||
    typeof file !== "string"
  ) {
    return res
      .status(400)
      .json({ error: "Missing required query params: 'path' and 'file'" });
  }
  //TODO: get file path from the other controller instead /src/app/
  const fullPath = path.join(
    `${projectPath}/rpp-ng-recon-admin/src/app/`,
    file
  );
  console.log("Full path to file:", fullPath);
  try {
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: "File not found." });
    }

    const code = fs.readFileSync(fullPath, "utf8");
    return res.status(200).json({ code });
  } catch (error) {
    return res
      .status(500)
      .json({ error: "Failed to read file content.", details: error });
  }
};

export const verifyBuild = async (req: Request, res: Response) => {
  const { path: relativePath } = req.body;

  if (!relativePath) {
    return res.status(400).json({ error: "Missing project path" });
  }

  const fullPath = path.resolve(BASE_DIR, relativePath);

  if (!fullPath.startsWith(BASE_DIR)) {
    return res.status(403).json({ error: "Invalid project path" });
  }

  try {
    const { stdout, stderr } = await execAsync("npm run build", {
      cwd: fullPath,
      timeout: 60000,
    });

    return res.json({
      success: true,
      output: stdout + stderr,
    });
  } catch (err: any) {
    return res.json({
      success: false,
      output: err.stdout + err.stderr || err.message,
    });
  }
};
