import { Router } from 'express';
import * as aiController from '../controllers/ai.controller';

const router = Router();

router.post('/suggest', aiController.suggestMigration);
router.get("/migration-rules", aiController.getMigrationRules);
router.post('/audit-suggestion', aiController.getAuditFixSuggestion);

export default router;