export interface VehicleInput {
  client_vehicle_id: string;
  vehicle_category: string;
  registration_number?: string | null;
  vehicle_make_model?: string | null;
  movement_direction?: string | null;
  damage_description?: string | null;
}

export interface PersonInput {
  client_person_id: string;
  client_vehicle_id?: string | null;
  person_role: string; // Driver, Passenger, Pedestrian
  name?: string | null;
  age?: number | null;
  gender?: string | null;
  injury_status: string; // Fatal, Grievous, Minor, Uninjured
  hospital_name?: string | null;
  helmet_seatbelt_used?: boolean;
}

export interface AccidentReportInput {
  client_report_id: string; // UUIDv4
  accident_date: string;    // YYYY-MM-DD
  accident_time: string;    // HH:mm:ss
  accident_category: string;
  accident_nature: string;
  severity: string;
  state?: string;
  district: string;
  police_station: string;
  road_name?: string | null;
  landmark?: string | null;
  exact_location: string;
  latitude?: number | null;
  longitude?: number | null;
  road_type?: string | null;
  surface_condition?: string | null;
  weather_condition?: string | null;
  visibility?: string | null;
  lighting_condition?: string | null;
  accident_description: string;
  vehicles: VehicleInput[];
  persons: PersonInput[];
}

export interface SyncedReportResult {
  client_report_id: string;
  server_report_id: string;
  status: string;
  synced_at: string;
  is_duplicate?: boolean;
}
