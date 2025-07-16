import { Router } from "express";
import * as projectController from "../controllers/project.controller";

const router = Router();

router.post("/upload", projectController.uploadProject);
router.get("/info", projectController.getProjectInfo);
router.get("/warnings", projectController.getWarnings);
router.post("/apply-suggestion", projectController.applySuggestion);
router.get("/backups", projectController.listBackups);
router.post("/restore-backup", projectController.restoreBackup);

export default router;
