import { z } from 'zod';

export const RequestPresignedUrlSchema = z.object({
  report_id: z.string().uuid('Invalid report_id UUID'),
  client_evidence_id: z.string().uuid('Invalid client_evidence_id UUID'),
  file_name: z.string().min(1, 'File name is required'),
  file_type: z.enum(['image/jpeg', 'image/jpg', 'image/png', 'image/heic', 'image/webp'], {
    errorMap: () => ({ message: 'Only image files (JPEG, PNG, HEIC, WebP) are accepted as evidence' }),
  }),
  file_size_bytes: z.number().int().positive().max(15 * 1024 * 1024, 'Max allowed image size is 15MB'),
  sha256_hash: z.string().length(64, 'SHA-256 hash must be 64 hexadecimal characters'),
  caption: z.string().optional().nullable(),
  gps_lat: z.number().optional().nullable(),
  gps_long: z.number().optional().nullable(),
});

export const ConfirmUploadSchema = z.object({
  client_evidence_id: z.string().uuid('Invalid client_evidence_id UUID'),
});
