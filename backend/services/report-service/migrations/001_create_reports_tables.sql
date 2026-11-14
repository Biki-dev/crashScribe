-- 001_create_reports_tables.sql
-- Schema migration for crashscribe_reports database

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enum for report status
DO $$ BEGIN
    CREATE TYPE report_status AS ENUM ('DRAFT', 'SYNCED', 'UNDER_INVESTIGATION', 'CLOSED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 1. Core Accident Master Table (eDAR standard)
CREATE TABLE IF NOT EXISTS accident_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_report_id UUID UNIQUE NOT NULL, -- Client-generated UUIDv4 (Idempotency Anchor)
    officer_id UUID NOT NULL,
    schema_version VARCHAR(20) DEFAULT 'eDAR-1.0',
    
    -- Accident Information
    accident_date DATE NOT NULL,
    accident_time TIME NOT NULL,
    accident_category VARCHAR(100) NOT NULL,
    accident_nature VARCHAR(100) NOT NULL,
    severity VARCHAR(50) NOT NULL, -- Fatal, Grievous Injury, Minor Injury, Non-Injury
    
    -- Location Information
    state VARCHAR(50) DEFAULT 'Assam',
    district VARCHAR(100) NOT NULL,
    police_station VARCHAR(100) NOT NULL,
    road_name VARCHAR(200),
    landmark VARCHAR(255),
    exact_location TEXT NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    
    -- Environmental Conditions
    road_type VARCHAR(100),
    surface_condition VARCHAR(100),
    weather_condition VARCHAR(100),
    visibility VARCHAR(100),
    lighting_condition VARCHAR(100),
    
    -- Narrative Description
    accident_description TEXT NOT NULL,
    
    -- Status & Sync Metadata
    status report_status DEFAULT 'SYNCED',
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    version INT DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_reports_client_id ON accident_reports(client_report_id);
CREATE INDEX IF NOT EXISTS idx_reports_officer_id ON accident_reports(officer_id);
CREATE INDEX IF NOT EXISTS idx_reports_district ON accident_reports(district);
CREATE INDEX IF NOT EXISTS idx_reports_date ON accident_reports(accident_date);

-- 2. Vehicles Involved (1-to-N)
CREATE TABLE IF NOT EXISTS vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES accident_reports(id) ON DELETE CASCADE,
    client_vehicle_id UUID NOT NULL,
    vehicle_category VARCHAR(100) NOT NULL,
    registration_number VARCHAR(50),
    vehicle_make_model VARCHAR(150),
    movement_direction VARCHAR(100),
    damage_description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vehicles_report_id ON vehicles(report_id);

-- 3. Persons Involved (1-to-N casualties / drivers / pedestrians)
CREATE TABLE IF NOT EXISTS persons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES accident_reports(id) ON DELETE CASCADE,
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
    client_person_id UUID NOT NULL,
    person_role VARCHAR(100) NOT NULL, -- Driver, Passenger, Pedestrian
    name VARCHAR(150),
    age INT,
    gender VARCHAR(20),
    injury_status VARCHAR(50) NOT NULL, -- Fatal, Grievous, Minor, Uninjured
    hospital_name VARCHAR(255),
    helmet_seatbelt_used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_persons_report_id ON persons(report_id);
CREATE INDEX IF NOT EXISTS idx_persons_injury ON persons(injury_status);

-- 4. Transactional Outbox for Reliable Event Distribution (CQRS CDC)
CREATE TABLE IF NOT EXISTS report_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregate_type VARCHAR(50) DEFAULT 'ACCIDENT_REPORT',
    aggregate_id UUID NOT NULL,
    event_type VARCHAR(100) NOT NULL, -- e.g. 'ACCIDENT_REPORT_CREATED', 'ACCIDENT_REPORT_UPDATED'
    payload JSONB NOT NULL,
    processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_outbox_unprocessed ON report_outbox(processed, created_at) WHERE processed = FALSE;
