import React from 'react';
import { AlertTriangle, ArrowRight, X } from 'lucide-react';
import { ValidationErrorItem } from '../types/edar.types';

interface MissingFieldsSheetProps {
  errors: ValidationErrorItem[];
  onClose: () => void;
  onFocusField: (fieldKey: string, sectionIndex: number) => void;
}

export const MissingFieldsSheet: React.FC<MissingFieldsSheetProps> = ({
  errors,
  onClose,
  onFocusField,
}) => {
  if (errors.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-rose-500/40 rounded-t-2xl sm:rounded-2xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom-5 duration-200">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 bg-rose-950/30 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-rose-500/20 text-rose-400 rounded-lg border border-rose-500/30">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">Incomplete eDAR Report</h3>
              <p className="text-xs text-rose-300">
                Please complete <span className="font-bold text-white underline">{errors.length} required {errors.length === 1 ? 'field' : 'fields'}</span> before reviewing.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Missing Fields List */}
        <div className="p-4 overflow-y-auto space-y-2.5 flex-1">
          <p className="text-xs text-slate-400 mb-2">
            Tap any field below to jump directly to it:
          </p>
          {errors.map((err, idx) => (
            <button
              key={`${err.fieldKey}-${idx}`}
              onClick={() => onFocusField(err.fieldKey, err.sectionIndex)}
              className="w-full text-left p-3 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 hover:border-amber-500/50 flex items-center justify-between transition group"
            >
              <div>
                <div className="text-[10px] text-amber-400/90 font-semibold uppercase tracking-wider">
                  {err.sectionName}
                </div>
                <div className="text-sm font-medium text-white group-hover:text-amber-300 transition">
                  {err.label}
                </div>
                <div className="text-xs text-rose-400 mt-0.5">
                  {err.message}
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition" />
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950 flex justify-between items-center text-xs text-slate-400">
          <span>All entered values are securely preserved</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition"
          >
            Return to Form
          </button>
        </div>
      </div>
    </div>
  );
};
