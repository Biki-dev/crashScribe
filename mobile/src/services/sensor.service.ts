export interface SensorLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  isSimulated?: boolean;
}

export class SensorService {
  /**
   * Captures GPS Latitude & Longitude from device hardware
   * Falls back gracefully if GPS permissions are denied or unavailable in field
   */
  static async getCurrentLocation(): Promise<SensorLocation> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        // Fallback to Assam Highway corridor (Guwahati Khanapara NH-37)
        resolve({
          latitude: 26.1285,
          longitude: 91.8123,
          accuracy: 15,
          timestamp: Date.now(),
          isSimulated: true,
        });
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            latitude: parseFloat(pos.coords.latitude.toFixed(6)),
            longitude: parseFloat(pos.coords.longitude.toFixed(6)),
            accuracy: Math.round(pos.coords.accuracy),
            timestamp: pos.timestamp,
            isSimulated: false,
          });
        },
        (err) => {
          console.warn('[GPS Hardware Warning] Using fallback coords:', err.message);
          // Assam Highway fallback (NH-37 corridor)
          resolve({
            latitude: 26.1285,
            longitude: 91.8123,
            accuracy: 25,
            timestamp: Date.now(),
            isSimulated: true,
          });
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 }
      );
    });
  }

  /**
   * Generates auto-captured local date in YYYY-MM-DD
   */
  static getCurrentDate(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Generates auto-captured local time in HH:mm:ss
   */
  static getCurrentTime(): string {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  }
}
