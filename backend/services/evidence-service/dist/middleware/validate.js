"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfirmUploadSchema = exports.RequestPresignedUrlSchema = void 0;
const zod_1 = require("zod");
exports.RequestPresignedUrlSchema = zod_1.z.object({
    report_id: zod_1.z.string().uuid('Invalid report_id UUID'),
    client_evidence_id: zod_1.z.string().uuid('Invalid client_evidence_id UUID'),
    file_name: zod_1.z.string().min(1, 'File name is required'),
    file_type: zod_1.z.enum(['image/jpeg', 'image/jpg', 'image/png', 'image/heic', 'image/webp'], {
        errorMap: () => ({ message: 'Only image files (JPEG, PNG, HEIC, WebP) are accepted as evidence' }),
    }),
    file_size_bytes: zod_1.z.number().int().positive().max(15 * 1024 * 1024, 'Max allowed image size is 15MB'),
    sha256_hash: zod_1.z.string().length(64, 'SHA-256 hash must be 64 hexadecimal characters'),
    caption: zod_1.z.string().optional().nullable(),
    gps_lat: zod_1.z.number().optional().nullable(),
    gps_long: zod_1.z.number().optional().nullable(),
});
exports.ConfirmUploadSchema = zod_1.z.object({
    client_evidence_id: zod_1.z.string().uuid('Invalid client_evidence_id UUID'),
});
