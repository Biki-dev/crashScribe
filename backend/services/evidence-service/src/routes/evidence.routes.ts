import { Router } from 'express';
import { EvidenceController } from '../controllers/evidence.controller.js';

export const evidenceRouter = Router();

evidenceRouter.post('/presigned-url', EvidenceController.requestPresignedUrl);
evidenceRouter.post('/confirm', EvidenceController.confirmUpload);
evidenceRouter.get('/report/:reportId', EvidenceController.listByReport);
