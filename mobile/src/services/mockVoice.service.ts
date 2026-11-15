export class MockVoiceService {
  /**
   * Hardcoded mock transcriptions based on field type
   */
  static getMockTranscription(fieldKey: string): string {
    switch (fieldKey) {
      case 'accident_description':
        return 'Commercial truck AS-01-EC-9988 collided with two-wheeler on NH-37 near Khanapara flyover in rainy conditions. Severe impact on front axle and rider sustained grievous leg trauma.';
      case 'exact_location':
        return 'NH-37 Westbound corridor, near Khanapara overbridge crossing';
      case 'landmark':
        return 'Opposite Khanapara Police Checkpoint, near Petrol Depot';
      case 'damage_description':
        return 'Heavy front bumper deformation, fractured axle assembly, windshield shattered';
      case 'road_name':
        return 'National Highway 37 (Asian Highway 1)';
      default:
        return 'Collision reported at scene. Multiple vehicles involved with road obstruction.';
    }
  }
}
