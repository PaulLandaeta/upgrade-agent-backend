import { Router } from "express";
import * as projectController from "../controllers/project.controller";

const router = Router();

router.post("/upload", projectController.uploadProject);
router.get("/info", projectController.getProjectInfo);
router.get("/warnings", projectController.getWarnings);
router.post("/apply-suggestion", projectController.applySuggestion);
router.get("/backups", projectController.listBackups);
router.post("/restore-backup", projectController.restoreBackup);
router.get("/file", projectController.getFileContent);
router.post("/build", projectController.verifyBuild);
router.get("/list", projectController.listProjects);
router.post("/audit", projectController.auditDependencies);
router.get("/angular-modules", projectController.listAngularModules);
router.post("/create-project", projectController.createProject);

export default router;
