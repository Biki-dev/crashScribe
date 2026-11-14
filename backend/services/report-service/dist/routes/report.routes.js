"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportRouter = void 0;
const express_1 = require("express");
const report_controller_js_1 = require("../controllers/report.controller.js");
exports.reportRouter = (0, express_1.Router)();
// Ingestion and sync endpoints
exports.reportRouter.post('/sync', report_controller_js_1.ReportController.syncReports);
exports.reportRouter.get('/:id', report_controller_js_1.ReportController.getReport);
exports.reportRouter.get('/', report_controller_js_1.ReportController.listReports);
