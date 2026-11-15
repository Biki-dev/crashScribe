import { AuthSession } from '../types/auth.types';
import { LocalReport, SyncStatus } from '../types/edar.types';

const STORAGE_KEYS = {
  SESSION: 'crashscribe_officer_session',
  REPORTS: 'crashscribe_local_reports',
  SETTINGS: 'crashscribe_user_settings',
  AI_MODELS: 'crashscribe_ai_models',
};

export class StorageService {
  /**
   * Session Management (Cached credentials for offline authorization)
   */
  static getSession(): AuthSession | null {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SESSION);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  static saveSession(session: AuthSession): void {
    localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session));
  }

  static clearSession(): void {
    localStorage.removeItem(STORAGE_KEYS.SESSION);
  }

  /**
   * Offline Report Storage
   */
  static getAllReports(): LocalReport[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.REPORTS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  static getReport(clientReportId: string): LocalReport | null {
    const reports = this.getAllReports();
    return reports.find((r) => r.client_report_id === clientReportId) || null;
  }

  static saveReport(report: LocalReport): void {
    const reports = this.getAllReports();
    const existingIndex = reports.findIndex((r) => r.client_report_id === report.client_report_id);

    if (existingIndex >= 0) {
      reports[existingIndex] = {
        ...report,
        updated_at: new Date().toISOString(),
      };
    } else {
      reports.unshift(report);
    }

    localStorage.setItem(STORAGE_KEYS.REPORTS, JSON.stringify(reports));
  }

  static getPendingReports(): LocalReport[] {
    return this.getAllReports().filter(
      (r) => r.status === 'SAVED_LOCAL' || r.status === 'PENDING_SYNC' || r.status === 'FAILED'
    );
  }

  static getSyncedReports(): LocalReport[] {
    return this.getAllReports().filter((r) => r.status === 'SYNCED');
  }

  static updateSyncStatus(
    clientReportId: string,
    status: SyncStatus,
    serverReportId?: string,
    error?: string
  ): void {
    const reports = this.getAllReports();
    const target = reports.find((r) => r.client_report_id === clientReportId);
    if (target) {
      target.status = status;
      if (serverReportId) target.server_report_id = serverReportId;
      if (status === 'SYNCED') {
        target.synced_at = new Date().toISOString();
        target.last_error = undefined;
      }
      if (error) {
        target.last_error = error;
      }
      target.updated_at = new Date().toISOString();
      localStorage.setItem(STORAGE_KEYS.REPORTS, JSON.stringify(reports));
    }
  }

  static deleteReport(clientReportId: string): void {
    const reports = this.getAllReports().filter((r) => r.client_report_id !== clientReportId);
    localStorage.setItem(STORAGE_KEYS.REPORTS, JSON.stringify(reports));
  }
}
