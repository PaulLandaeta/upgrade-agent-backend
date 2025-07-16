import { Router } from 'express';
import * as aiController from '../controllers/ai.controller';

const router = Router();

router.post('/suggest', aiController.suggestMigration);

export default router;