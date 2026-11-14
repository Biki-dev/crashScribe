"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evidenceRouter = void 0;
const express_1 = require("express");
const evidence_controller_js_1 = require("../controllers/evidence.controller.js");
exports.evidenceRouter = (0, express_1.Router)();
exports.evidenceRouter.post('/presigned-url', evidence_controller_js_1.EvidenceController.requestPresignedUrl);
exports.evidenceRouter.post('/confirm', evidence_controller_js_1.EvidenceController.confirmUpload);
exports.evidenceRouter.get('/report/:reportId', evidence_controller_js_1.EvidenceController.listByReport);
