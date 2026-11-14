import { z } from 'zod';

export const VehicleSchema = z.object({
  client_vehicle_id: z.string().uuid('Invalid client_vehicle_id UUID'),
  vehicle_category: z.string().min(1, 'Vehicle category is required'),
  registration_number: z.string().optional().nullable(),
  vehicle_make_model: z.string().optional().nullable(),
  movement_direction: z.string().optional().nullable(),
  damage_description: z.string().optional().nullable(),
});

export const PersonSchema = z.object({
  client_person_id: z.string().uuid('Invalid client_person_id UUID'),
  client_vehicle_id: z.string().uuid().optional().nullable(),
  person_role: z.string().min(1, 'Person role is required (Driver/Passenger/Pedestrian)'),
  name: z.string().optional().nullable(),
  age: z.number().int().min(0).max(120).optional().nullable(),
  gender: z.string().optional().nullable(),
  injury_status: z.enum(['Fatal', 'Grievous Injury', 'Minor Injury', 'Uninjured', 'Fatal / Dead', 'Minor', 'Grievous']),
  hospital_name: z.string().optional().nullable(),
  helmet_seatbelt_used: z.boolean().default(false).optional(),
});

export const SingleReportSchema = z.object({
  client_report_id: z.string().uuid('Invalid client_report_id UUID'),
  accident_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  accident_time: z.string().min(1, 'Time is required'),
  accident_category: z.string().min(1, 'Accident category is required'),
  accident_nature: z.string().min(1, 'Accident nature is required'),
  severity: z.string().min(1, 'Severity is required'),
  state: z.string().default('Assam').optional(),
  district: z.string().min(1, 'District is required'),
  police_station: z.string().min(1, 'Police station is required'),
  road_name: z.string().optional().nullable(),
  landmark: z.string().optional().nullable(),
  exact_location: z.string().min(1, 'Exact location is required'),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  road_type: z.string().optional().nullable(),
  surface_condition: z.string().optional().nullable(),
  weather_condition: z.string().optional().nullable(),
  visibility: z.string().optional().nullable(),
  lighting_condition: z.string().optional().nullable(),
  accident_description: z.string().min(5, 'Accident description must be at least 5 characters'),
  vehicles: z.array(VehicleSchema).min(1, 'At least one vehicle record is required'),
  persons: z.array(PersonSchema).min(1, 'At least one person/casualty record is required'),
});

export const BatchSyncSchema = z.object({
  reports: z.array(SingleReportSchema).min(1, 'At least one report required in sync payload'),
});
