import { StorageService } from './storage.service';
import { LocalReport } from '../types/edar.types';

const GATEWAY_BASE = 'http://localhost:8080/api/v1';

export class ApiService {
  private static getHeaders(idempotencyKey?: string): HeadersInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const session = StorageService.getSession();
    if (session?.accessToken) {
      headers['Authorization'] = `Bearer ${session.accessToken}`;
    }

    if (idempotencyKey) {
      headers['X-Idempotency-Key'] = idempotencyKey;
    }

    return headers;
  }

  /**
   * Health Check
   */
  static async checkHealth(): Promise<boolean> {
    try {
      const res = await fetch('http://localhost:8080/health', { method: 'GET', signal: AbortSignal.timeout(3000) });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Auth Endpoints
   */
  static async login(loginId: string, password: string) {
    const res = await fetch(`${GATEWAY_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login_id: loginId, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    return data;
  }

  static async signup(payload: {
    official_id: string;
    name: string;
    email: string;
    password: string;
    phone: string;
    district: string;
    police_station: string;
    designation: string;
  }) {
    const res = await fetch(`${GATEWAY_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed');
    return data;
  }

  static async getProfile() {
    const res = await fetch(`${GATEWAY_BASE}/auth/profile`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch profile');
    return data.data;
  }

  static async updateProfile(payload: { phone?: string; email?: string }) {
    const res = await fetch(`${GATEWAY_BASE}/auth/profile`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update profile');
    return data.data;
  }

  /**
   * Report Synchronization Engine
   */
  static async syncSingleReport(report: LocalReport): Promise<{ server_report_id: string; is_duplicate?: boolean }> {
    const payload = {
      client_report_id: report.client_report_id,
      accident_date: report.data.accident_date,
      accident_time: report.data.accident_time,
      accident_category: report.data.accident_category,
      accident_nature: report.data.accident_nature,
      severity: report.data.severity,
      state: report.data.state || 'Assam',
      district: report.data.district,
      police_station: report.data.police_station,
      road_name: report.data.road_name || null,
      landmark: report.data.landmark || null,
      exact_location: report.data.exact_location,
      latitude: report.data.latitude || null,
      longitude: report.data.longitude || null,
      road_type: report.data.road_type || null,
      surface_condition: report.data.surface_condition || null,
      weather_condition: report.data.weather_condition || null,
      visibility: report.data.visibility || null,
      lighting_condition: report.data.lighting_condition || null,
      accident_description: report.data.accident_description,
      vehicles: report.data.vehicles.map((v) => ({
        client_vehicle_id: v.client_vehicle_id,
        vehicle_category: v.vehicle_category,
        registration_number: v.registration_number || null,
        vehicle_make_model: v.vehicle_make_model || null,
        movement_direction: v.movement_direction || null,
        damage_description: v.damage_description || null,
      })),
      persons: report.data.persons.map((p) => ({
        client_person_id: p.client_person_id,
        client_vehicle_id: p.client_vehicle_id || null,
        person_role: p.person_role,
        name: p.name || null,
        age: p.age ? Number(p.age) : null,
        gender: p.gender || null,
        injury_status: p.injury_status,
        hospital_name: p.hospital_name || null,
        helmet_seatbelt_used: !!p.helmet_seatbelt_used,
      })),
    };

    const res = await fetch(`${GATEWAY_BASE}/reports/sync`, {
      method: 'POST',
      headers: this.getHeaders(report.client_report_id),
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      const errMsg = data.errors?.[0]?.error || data.error || 'Report synchronization failed';
      throw new Error(errMsg);
    }

    const syncedItem = data.synced[0];

    // If report has evidence items, handle media upload sequentially
    if (report.data.evidence && report.data.evidence.length > 0) {
      for (const ev of report.data.evidence) {
        try {
          // 1. Request Presigned URL
          const presignRes = await fetch(`${GATEWAY_BASE}/evidence/presigned-url`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({
              report_id: syncedItem.server_report_id,
              client_evidence_id: ev.client_evidence_id,
              file_name: ev.file_name,
              file_size_bytes: ev.file_size_bytes,
              file_type: ev.file_type,
              sha256_hash: ev.sha256_hash,
              caption: ev.caption || null,
              gps_lat: ev.gps_lat || null,
              gps_long: ev.gps_long || null,
            }),
          });

          if (presignRes.ok) {
            // 2. Confirm Upload
            await fetch(`${GATEWAY_BASE}/evidence/confirm`, {
              method: 'POST',
              headers: this.getHeaders(),
              body: JSON.stringify({ client_evidence_id: ev.client_evidence_id }),
            });
          }
        } catch (e) {
          console.warn('[Evidence Upload Warning]', e);
        }
      }
    }

    return {
      server_report_id: syncedItem.server_report_id,
      is_duplicate: syncedItem.is_duplicate,
    };
  }

  /**
   * Analytics Dashboard APIs
   */
  static async getAnalyticsSummary(district?: string) {
    const url = new URL(`${GATEWAY_BASE}/analytics/summary`);
    if (district && district !== 'All Districts') url.searchParams.append('district', district);

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch analytics summary');
    return res.json();
  }

  static async getMapClusters(district?: string, severity?: string) {
    const url = new URL(`${GATEWAY_BASE}/analytics/map-clusters`);
    if (district && district !== 'All Districts') url.searchParams.append('district', district);
    if (severity && severity !== 'All') url.searchParams.append('severity', severity);

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch map clusters');
    return res.json();
  }

  static async getBlackspots(district?: string) {
    const url = new URL(`${GATEWAY_BASE}/analytics/blackspots`);
    if (district && district !== 'All Districts') url.searchParams.append('district', district);

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch blackspots');
    return res.json();
  }

  static async getTrends(district?: string) {
    const url = new URL(`${GATEWAY_BASE}/analytics/trends`);
    if (district && district !== 'All Districts') url.searchParams.append('district', district);

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch trends');
    return res.json();
  }
}
