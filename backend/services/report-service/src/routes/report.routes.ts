import { Router } from 'express';
import { ReportController } from '../controllers/report.controller.js';

export const reportRouter = Router();

// Ingestion and sync endpoints
reportRouter.post('/sync', ReportController.syncReports);
reportRouter.get('/:id', ReportController.getReport);
reportRouter.get('/', ReportController.listReports);
