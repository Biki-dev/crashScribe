"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BatchSyncSchema = exports.SingleReportSchema = exports.PersonSchema = exports.VehicleSchema = void 0;
const zod_1 = require("zod");
exports.VehicleSchema = zod_1.z.object({
    client_vehicle_id: zod_1.z.string().uuid('Invalid client_vehicle_id UUID'),
    vehicle_category: zod_1.z.string().min(1, 'Vehicle category is required'),
    registration_number: zod_1.z.string().optional().nullable(),
    vehicle_make_model: zod_1.z.string().optional().nullable(),
    movement_direction: zod_1.z.string().optional().nullable(),
    damage_description: zod_1.z.string().optional().nullable(),
});
exports.PersonSchema = zod_1.z.object({
    client_person_id: zod_1.z.string().uuid('Invalid client_person_id UUID'),
    client_vehicle_id: zod_1.z.string().uuid().optional().nullable(),
    person_role: zod_1.z.string().min(1, 'Person role is required (Driver/Passenger/Pedestrian)'),
    name: zod_1.z.string().optional().nullable(),
    age: zod_1.z.number().int().min(0).max(120).optional().nullable(),
    gender: zod_1.z.string().optional().nullable(),
    injury_status: zod_1.z.enum(['Fatal', 'Grievous Injury', 'Minor Injury', 'Uninjured', 'Fatal / Dead', 'Minor', 'Grievous']),
    hospital_name: zod_1.z.string().optional().nullable(),
    helmet_seatbelt_used: zod_1.z.boolean().default(false).optional(),
});
exports.SingleReportSchema = zod_1.z.object({
    client_report_id: zod_1.z.string().uuid('Invalid client_report_id UUID'),
    accident_date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
    accident_time: zod_1.z.string().min(1, 'Time is required'),
    accident_category: zod_1.z.string().min(1, 'Accident category is required'),
    accident_nature: zod_1.z.string().min(1, 'Accident nature is required'),
    severity: zod_1.z.string().min(1, 'Severity is required'),
    state: zod_1.z.string().default('Assam').optional(),
    district: zod_1.z.string().min(1, 'District is required'),
    police_station: zod_1.z.string().min(1, 'Police station is required'),
    road_name: zod_1.z.string().optional().nullable(),
    landmark: zod_1.z.string().optional().nullable(),
    exact_location: zod_1.z.string().min(1, 'Exact location is required'),
    latitude: zod_1.z.number().optional().nullable(),
    longitude: zod_1.z.number().optional().nullable(),
    road_type: zod_1.z.string().optional().nullable(),
    surface_condition: zod_1.z.string().optional().nullable(),
    weather_condition: zod_1.z.string().optional().nullable(),
    visibility: zod_1.z.string().optional().nullable(),
    lighting_condition: zod_1.z.string().optional().nullable(),
    accident_description: zod_1.z.string().min(5, 'Accident description must be at least 5 characters'),
    vehicles: zod_1.z.array(exports.VehicleSchema).min(1, 'At least one vehicle record is required'),
    persons: zod_1.z.array(exports.PersonSchema).min(1, 'At least one person/casualty record is required'),
});
exports.BatchSyncSchema = zod_1.z.object({
    reports: zod_1.z.array(exports.SingleReportSchema).min(1, 'At least one report required in sync payload'),
});
