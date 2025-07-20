import fs from "fs";
import path from "path";

interface ProjectFile {
  filePath: string;
  fileName: string;
  fileType: string;
  content: string;
}

function readProjectFiles(dirPath: string, basePath: string = dirPath): ProjectFile[] {
  const files: ProjectFile[] = [];
  
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(basePath, fullPath);
      
      // Skip node_modules, dist, and other build/cache directories
      if (entry.name === 'node_modules' || 
          entry.name === 'dist' || 
          entry.name === '.git' || 
          entry.name === '.angular' ||
          entry.name.startsWith('.')) {
        continue;
      }
      
      if (entry.isDirectory()) {
        files.push(...readProjectFiles(fullPath, basePath));
      } else if (entry.isFile()) {
        // Only include relevant file types for migration
        const ext = path.extname(entry.name);
        if (['.ts', '.html', '.scss', '.css', '.json', '.md'].includes(ext)) {
          try {
            const content = fs.readFileSync(fullPath, 'utf8');
            files.push({
              filePath: relativePath,
              fileName: entry.name,
              fileType: ext,
              content: content
            });
          } catch (error) {
            console.warn(`Warning: Could not read file ${fullPath}:`, error);
          }
        }
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dirPath}:`, error);
  }
  
  return files;
}

function getProjectSourceInstruction(projectPath: string, projectSource: { type: 'upload' | 'git', gitUrl?: string }): string {
    if (projectSource.type == 'git') {
        return `I have the following Angular project ${projectSource.gitUrl}.`;
    } else {
        // Create a structured representation of the project
        const projectFiles = readProjectFiles(projectPath);
        const projectStructure = projectFiles.map(file => file.filePath).join('\n');
        const filesContent = projectFiles.map(file => 
            `File: ${file.filePath}\nType: ${file.fileType}\nContent:\n${file.content}}`
        ).join('\n\n');
        return `I have the following Angular project structure:
                ${projectStructure}
                Here are all the project files with their content:
                ${filesContent}`;
    }
}

export function buildMigrationPrompt(
  projectPath: string,
  projectSource: { type: 'upload' | 'git', gitUrl?: string }
): string {
  const projectSourceInstruction = getProjectSourceInstruction(projectPath, projectSource);

  return `
You are an expert Angular and Dart and Flutter developer assisting in migrating legacy Angular code to Dart and Flutter framework.
${projectSourceInstruction}

Analyze this Angular project and provide a new Dart and Flutter project. Ensure the updated code follows best practices recommended in Dart and Flutter.

Key requirements:
1. Maintain the same functionality as the original Angular application
2. Use Flutter widgets equivalent to Angular components
3. Implement proper state management using MVVM pattern
4. Convert TypeScript logic to Dart
5. Adapt Angular services to Dart/Flutter patterns
6. Convert HTML templates to Flutter widget trees
7. Transform CSS/SCSS styling to Flutter styling approaches

Provide a structured migration suggestion in the following JSON format:
{
  "projectStructure": "The complete project structure including directories and files for the new Flutter project",
  "fileList": [
    {
      "filePath": "relative/path/to/file",
      "fileName": "filename.dart",
      "fileType": ".dart",
      "content": "complete file content here"
    }
  ],
  "migrationNotes": "Important notes about the migration process and any manual steps required",
  "dependencies": "List of Flutter dependencies that need to be added to pubspec.yaml"
}
`.trim();
}
