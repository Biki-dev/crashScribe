-- 001_create_evidence_tables.sql
-- Schema migration for crashscribe_evidence database

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enum for upload status
DO $$ BEGIN
    CREATE TYPE upload_status AS ENUM ('PENDING', 'COMPLETED', 'FAILED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 1. Report Evidence & Media Metadata Table
CREATE TABLE IF NOT EXISTS report_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL,                        -- Linked to accident report ID
    client_evidence_id UUID UNIQUE NOT NULL,        -- Client UUID (Idempotency Key)
    officer_id UUID NOT NULL,                       -- Uploading officer ID
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL,                 -- e.g. image/jpeg, image/png, image/heic
    file_size_bytes BIGINT NOT NULL,
    storage_key VARCHAR(500) NOT NULL,              -- Cloudflare R2 / S3 object key
    storage_provider VARCHAR(50) DEFAULT 'cloudflare_r2',
    sha256_hash VARCHAR(64) NOT NULL,               -- File integrity checksum
    caption TEXT,
    gps_lat DECIMAL(10, 8),                         -- EXIF GPS latitude if present
    gps_long DECIMAL(11, 8),                        -- EXIF GPS longitude if present
    upload_status upload_status DEFAULT 'PENDING',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    uploaded_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_evidence_report_id ON report_evidence(report_id);
CREATE INDEX IF NOT EXISTS idx_evidence_client_id ON report_evidence(client_evidence_id);
CREATE INDEX IF NOT EXISTS idx_evidence_status ON report_evidence(upload_status);
