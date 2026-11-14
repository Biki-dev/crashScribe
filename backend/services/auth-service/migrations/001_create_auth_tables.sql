-- 001_create_auth_tables.sql
-- Schema migration for crashscribe_auth database

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Officers & Police Staff Directory
CREATE TABLE IF NOT EXISTS officers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    official_id VARCHAR(50) UNIQUE NOT NULL, -- Police badge/official ID, e.g. AS-POL-10829
    name VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE,
    phone VARCHAR(20) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    district VARCHAR(100) NOT NULL,
    police_station VARCHAR(100) NOT NULL,
    designation VARCHAR(100) NOT NULL, -- Sub-Inspector, Constable, Traffic Branch Officer, etc.
    role VARCHAR(50) NOT NULL DEFAULT 'OFFICER', -- SUPER_ADMIN, DISTRICT_SP, OFFICER
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices for rapid lookup by officer identity
CREATE INDEX IF NOT EXISTS idx_officers_official_id ON officers(official_id);
CREATE INDEX IF NOT EXISTS idx_officers_district ON officers(district);
CREATE INDEX IF NOT EXISTS idx_officers_phone ON officers(phone);

-- Refresh Tokens table supporting rotation and revocation
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    officer_id UUID NOT NULL REFERENCES officers(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_officer_id ON refresh_tokens(officer_id);
