export interface Officer {
  id: string;
  official_id: string;
  name: string;
  email: string;
  phone: string;
  district: string;
  police_station: string;
  designation: string;
  role: 'OFFICER' | 'DISTRICT_SP' | 'SUPER_ADMIN';
  is_active?: boolean;
}

export interface AuthSession {
  officer: Officer;
  accessToken: string;
  refreshToken: string;
  timestamp: string;
}
