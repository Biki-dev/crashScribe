import React, { useState } from 'react';
import {
  FileText,
  MapPin,
  CloudSun,
  Truck,
  Users,
  AlignLeft,
  Camera,
  Edit3,
  Save,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Shield,
  Clock,
  Calendar,
  Share2,
} from 'lucide-react';
import { AccidentReportData, LocalReport } from '../types/edar.types';
import { StorageService } from '../services/storage.service';
import { Officer } from '../types/auth.types';

interface DraftReviewScreenProps {
  reportData: AccidentReportData;
  officer: Officer;
  onEditReport: () => void;
  onSaveCompleted: (savedReport: LocalReport) => void;
}

export const DraftReviewScreen: React.FC<DraftReviewScreenProps> = ({
  reportData,
  officer,
  onEditReport,
  onSaveCompleted,
}) => {
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [savedSuccessReport, setSavedSuccessReport] = useState<LocalReport | null>(null);

  const handleConfirmAndSaveOnDevice = () => {
    // Generate unique Client UUID
    const clientReportId = crypto.randomUUID();
    const nowIso = new Date().toISOString();

    const newLocalReport: LocalReport = {
      client_report_id: clientReportId,
      status: 'SAVED_LOCAL', // Pending Cloud Sync
      created_at: nowIso,
      updated_at: nowIso,
      officer_id: officer.id,
      officer_badge: officer.official_id,
      data: reportData,
    };

    // Save strictly to local offline database (no network upload)
    StorageService.saveReport(newLocalReport);
    setShowConfirmModal(false);
    setSavedSuccessReport(newLocalReport);
  };

  // If successfully saved on device, display the explicit Confirmation Success Screen (7.1)
  if (savedSuccessReport) {
    return (
      <div className="min-h-[80vh] flex flex-col justify-center items-center p-4 text-center max-w-md mx-auto">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl w-full space-y-4">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 border-2 border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <h2 className="text-xl font-black text-white">
            Accident Report Saved Successfully
          </h2>

          <p className="text-xs text-slate-300">
            Report finalized and stored securely on your local device.
          </p>

          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-left space-y-2 text-xs">
            <div className="flex justify-between border-b border-slate-800/80 pb-1.5">
              <span className="text-slate-400">Local Reference ID:</span>
              <span className="font-mono text-amber-400 font-bold truncate max-w-[170px]">
                {savedSuccessReport.client_report_id}
              </span>
            </div>
            <div className="flex justify-between border-b border-slate-800/80 pb-1.5">
              <span className="text-slate-400">Reporting Officer:</span>
              <span className="text-white font-medium">
                {officer.name} ({officer.official_id})
              </span>
            </div>
            <div className="flex justify-between border-b border-slate-800/80 pb-1.5">
              <span className="text-slate-400">Saved Timestamp:</span>
              <span className="text-white font-medium">
                {new Date(savedSuccessReport.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
            <div className="flex justify-between items-center pt-1">
              <span className="text-slate-400">Sync Status:</span>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-bold">
                Pending Cloud Sync
              </span>
            </div>
          </div>

          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-[11px] text-amber-300 text-left">
            🔒 <span className="font-semibold">Zero Auto-Upload Guarantee:</span> This report remains stored in device memory. Upload occurs strictly when you manually tap "Sync" in Settings.
          </div>

          <div className="pt-2 space-y-2">
            <button
              onClick={() => onSaveCompleted(savedSuccessReport)}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition shadow-md"
            >
              Return to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-24 pt-3 px-3 max-w-2xl mx-auto space-y-4">
      {/* Draft Review Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm flex items-center justify-between">
        <div>
          <h1 className="text-lg font-black text-white tracking-tight">Draft Report Review</h1>
          <p className="text-xs text-slate-400">
            Verify all eDAR particulars before finalizing local device persistence
          </p>
        </div>
        <button
          onClick={onEditReport}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
        >
          <Edit3 className="w-3.5 h-3.5 text-amber-400" />
          <span>Edit</span>
        </button>
      </div>

      {/* SECTION 1 Review Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2.5">
        <div className="flex items-center space-x-2 border-b border-slate-800 pb-2">
          <FileText className="w-4 h-4 text-blue-400" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            1. Accident Information
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-slate-400">Date & Time:</span>
            <div className="text-white font-medium">{reportData.accident_date} at {reportData.accident_time}</div>
          </div>
          <div>
            <span className="text-slate-400">Severity:</span>
            <div className="text-rose-400 font-bold">{reportData.severity}</div>
          </div>
          <div>
            <span className="text-slate-400">Category:</span>
            <div className="text-white font-medium">{reportData.accident_category}</div>
          </div>
          <div>
            <span className="text-slate-400">Nature:</span>
            <div className="text-white font-medium">{reportData.accident_nature}</div>
          </div>
        </div>
      </div>

      {/* SECTION 2 Review Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2.5">
        <div className="flex items-center space-x-2 border-b border-slate-800 pb-2">
          <MapPin className="w-4 h-4 text-emerald-400" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            2. Accident Location
          </h2>
        </div>
        <div className="space-y-1.5 text-xs">
          <div>
            <span className="text-slate-400">District & Police Station:</span>
            <div className="text-white font-medium">{reportData.district} • {reportData.police_station}</div>
          </div>
          <div>
            <span className="text-slate-400">Exact Location:</span>
            <div className="text-white font-medium">{reportData.exact_location}</div>
          </div>
          {reportData.road_name && (
            <div>
              <span className="text-slate-400">Highway / Road:</span>
              <div className="text-white font-medium">{reportData.road_name}</div>
            </div>
          )}
          {reportData.landmark && (
            <div>
              <span className="text-slate-400">Landmark:</span>
              <div className="text-white font-medium">{reportData.landmark}</div>
            </div>
          )}
          <div className="pt-1">
            <span className="text-slate-400">GPS Coordinates:</span>
            <div className="font-mono text-emerald-400 font-medium">
              {reportData.latitude ?? '26.1285'}, {reportData.longitude ?? '91.8123'} (±{reportData.gps_accuracy || 15}m)
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 3 Review Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2.5">
        <div className="flex items-center space-x-2 border-b border-slate-800 pb-2">
          <CloudSun className="w-4 h-4 text-purple-400" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            3. Road & Environmental Conditions
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-slate-400">Surface:</span>
            <div className="text-white font-medium">{reportData.surface_condition || 'Dry Asphalt'}</div>
          </div>
          <div>
            <span className="text-slate-400">Weather:</span>
            <div className="text-white font-medium">{reportData.weather_condition || 'Clear'}</div>
          </div>
          <div>
            <span className="text-slate-400">Lighting:</span>
            <div className="text-white font-medium">{reportData.lighting_condition || 'Daylight'}</div>
          </div>
          <div>
            <span className="text-slate-400">Geometry:</span>
            <div className="text-white font-medium">{reportData.road_geometry || 'Straight and Flat'}</div>
          </div>
        </div>
      </div>

      {/* SECTION 4 Review Card: Vehicles */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2.5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center space-x-2">
            <Truck className="w-4 h-4 text-amber-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              4. Vehicles Involved ({reportData.vehicles.length})
            </h2>
          </div>
        </div>
        <div className="space-y-2">
          {reportData.vehicles.map((v, i) => (
            <div key={v.client_vehicle_id} className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-xs">
              <div className="font-bold text-amber-400">
                #{i + 1}: {v.vehicle_category}
              </div>
              <div className="text-white mt-0.5">
                Reg: <span className="font-mono">{v.registration_number || 'Unregistered / Unknown'}</span>
                {v.vehicle_make_model && ` • Make: ${v.vehicle_make_model}`}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 5 Review Card: Persons */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2.5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center space-x-2">
            <Users className="w-4 h-4 text-rose-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              5. Casualties & Persons ({reportData.persons.length})
            </h2>
          </div>
        </div>
        <div className="space-y-2">
          {reportData.persons.map((p, i) => (
            <div key={p.client_person_id} className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-xs flex justify-between items-center">
              <div>
                <div className="font-bold text-white">
                  #{i + 1}: {p.name || 'Anonymous Person'} ({p.person_role})
                </div>
                <div className="text-slate-400 text-[11px]">
                  Age: {p.age || 'Unknown'} • Gender: {p.gender || 'Unknown'}
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                p.injury_status === 'Fatal' ? 'bg-rose-950 text-rose-400 border border-rose-500/40' : 'bg-amber-950 text-amber-400 border border-amber-500/40'
              }`}>
                {p.injury_status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 6 Review Card: Description */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
        <div className="flex items-center space-x-2 border-b border-slate-800 pb-2">
          <AlignLeft className="w-4 h-4 text-amber-400" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            6. Accident Description
          </h2>
        </div>
        <p className="text-xs text-slate-200 leading-relaxed bg-slate-950 p-3 rounded-xl border border-slate-800">
          {reportData.accident_description}
        </p>
      </div>

      {/* SECTION 7 Review Card: Evidence */}
      {reportData.evidence.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
          <div className="flex items-center space-x-2 border-b border-slate-800 pb-2">
            <Camera className="w-4 h-4 text-teal-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              7. Photographic Evidence ({reportData.evidence.length})
            </h2>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {reportData.evidence.map((ev) => (
              <img
                key={ev.client_evidence_id}
                src={ev.data_url}
                alt={ev.file_name}
                className="w-full h-20 object-cover rounded-lg border border-slate-800"
              />
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="pt-2 flex gap-3">
        <button
          type="button"
          onClick={onEditReport}
          className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-2xl text-xs transition border border-slate-700 flex items-center justify-center gap-1.5"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Edit Report</span>
        </button>

        <button
          type="button"
          onClick={() => setShowConfirmModal(true)}
          className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-2xl text-xs transition shadow-xl shadow-amber-500/20 flex items-center justify-center gap-1.5"
        >
          <Save className="w-4 h-4" />
          <span>Confirm and Save on Device</span>
        </button>
      </div>

      {/* Confirmation Dialog Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 max-w-sm w-full shadow-2xl text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto">
              <Save className="w-6 h-6" />
            </div>

            <h3 className="font-bold text-white text-base">Save Report on Device?</h3>
            <p className="text-xs text-slate-400">
              This will assign a unique local UUID and persist the report in offline SQLite storage. <strong className="text-amber-400">Zero cloud upload</strong> will take place until you manually tap Sync in Settings.
            </p>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAndSaveOnDevice}
                className="flex-1 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition"
              >
                Yes, Save Locally
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
