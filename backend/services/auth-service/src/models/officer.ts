export interface Officer {
  id: string;
  official_id: string;
  name: string;
  email: string | null;
  phone: string;
  password_hash: string;
  district: string;
  police_station: string;
  designation: string;
  role: 'OFFICER' | 'DISTRICT_SP' | 'SUPER_ADMIN';
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export type SafeOfficer = Omit<Officer, 'password_hash'>;

export interface RefreshToken {
  id: string;
  officer_id: string;
  token_hash: string;
  expires_at: Date;
  revoked: boolean;
  created_at: Date;
}
