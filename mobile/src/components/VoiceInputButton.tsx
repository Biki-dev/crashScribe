import React, { useState } from 'react';
import { Mic, Loader2, Sparkles, Volume2, X } from 'lucide-react';
import { MockVoiceService } from '../services/mockVoice.service';

interface VoiceInputButtonProps {
  fieldKey: string;
  fieldLabel: string;
  onTranscription: (text: string) => void;
}

export const VoiceInputButton: React.FC<VoiceInputButtonProps> = ({
  fieldKey,
  fieldLabel,
  onTranscription,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const handleStartSimulatedVoice = () => {
    setShowModal(true);
    setIsListening(true);

    // Simulate 1.6s audio processing pipeline
    setTimeout(() => {
      const mockResult = MockVoiceService.getMockTranscription(fieldKey);
      onTranscription(mockResult);
      setIsListening(false);

      // Auto dismiss modal shortly after transcription
      setTimeout(() => {
        setShowModal(false);
      }, 900);
    }, 1600);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleStartSimulatedVoice}
        className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-700/50 rounded-md transition focus:outline-none"
        title="Voice-to-Text Assist (Hardcoded Prototype Simulation)"
      >
        <Mic className="w-4 h-4 text-amber-500/80 hover:text-amber-400" />
      </button>

      {/* Simulated Audio Waveform Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-5 max-w-sm w-full shadow-2xl relative text-center animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-3 right-3 text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-amber-500/10 border border-amber-500/40 flex items-center justify-center text-amber-400">
              {isListening ? (
                <Volume2 className="w-7 h-7 animate-pulse text-amber-400" />
              ) : (
                <Sparkles className="w-7 h-7 text-emerald-400" />
              )}
            </div>

            <h3 className="font-bold text-white text-base mb-1">
              {isListening ? 'Listening in Assamese / English...' : 'Voice Transcribed!'}
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Target Field: <span className="text-amber-300 font-medium">{fieldLabel}</span>
            </p>

            {/* Mock Audio Waveform animation */}
            {isListening && (
              <div className="flex items-center justify-center space-x-1.5 h-10 mb-4">
                <span className="w-1 bg-amber-400 rounded-full animate-bounce [animation-delay:-0.3s] h-4" />
                <span className="w-1 bg-amber-400 rounded-full animate-bounce [animation-delay:-0.15s] h-8" />
                <span className="w-1.5 bg-amber-400 rounded-full animate-bounce h-10" />
                <span className="w-1 bg-amber-400 rounded-full animate-bounce [animation-delay:-0.15s] h-7" />
                <span className="w-1 bg-amber-400 rounded-full animate-bounce [animation-delay:-0.3s] h-4" />
              </div>
            )}

            {!isListening && (
              <div className="bg-slate-950 border border-emerald-500/30 rounded-lg p-2.5 text-xs text-emerald-300 font-mono mb-3 text-left">
                "{MockVoiceService.getMockTranscription(fieldKey)}"
              </div>
            )}

            <div className="text-[10px] text-slate-500 bg-slate-950/60 p-2 rounded border border-slate-800">
              💡 Prototype notice: Model inference is decoupled. Offline ASR models (IndicConformer & Whisper) will plug into this UI hook in Phase 2.
            </div>
          </div>
        </div>
      )}
    </>
  );
};
