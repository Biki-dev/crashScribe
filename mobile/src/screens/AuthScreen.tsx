import React, { useState } from 'react';
import { Shield, Eye, EyeOff, Lock, User, Phone, Mail, MapPin, Building, Award, AlertCircle, CheckCircle2 } from 'lucide-react';
import { ApiService } from '../services/api.service';
import { StorageService } from '../services/storage.service';
import { AuthSession, Officer } from '../types/auth.types';

const ASSAM_DISTRICTS = [
  'Baksa', 'Barpeta', 'Biswanath', 'Bongaigaon', 'Cachar', 'Charaideo',
  'Chirang', 'Darrang', 'Dhemaji', 'Dhubri', 'Dibrugarh', 'Dima Hasao',
  'Goalpara', 'Golaghat', 'Hailakandi', 'Hojai', 'Jorhat', 'Kamrup',
  'Kamrup Metropolitan', 'Karbi Anglong', 'Karimganj', 'Kokrajhar',
  'Lakhimpur', 'Majuli', 'Morigaon', 'Nagaon', 'Nalbari', 'Sivasagar',
  'Sonitpur', 'South Salmara-Mankachar', 'Tamulpur', 'Tinsukia', 'Udalguri',
  'West Karbi Anglong'
];

const POLICE_STATIONS: Record<string, string[]> = {
  'Kamrup Metropolitan': ['Panbazar PS', 'Paltan Bazar PS', 'Dispur PS', 'Jalukbari PS', 'Chandmari PS', 'Geetanagar PS', 'Basistha PS', 'Noonmati PS'],
  'Dibrugarh': ['Dibrugarh Sadar PS', 'Chabua PS', 'Moran PS', 'Naharkatiya PS'],
  'Cachar': ['Silchar Sadar PS', 'Dholai PS', 'Lakhipur PS', 'Sonai PS'],
  'Sonitpur': ['Tezpur Sadar PS', 'Dhekiajuli PS', 'Rangapara PS', 'Jamugurihat PS'],
  'Jorhat': ['Jorhat Sadar PS', 'Titabor PS', 'Mariani PS', 'Teok PS'],
  'Nagaon': ['Nagaon Sadar PS', 'Raha PS', 'Samaguri PS', 'Kaliabor PS'],
};

interface AuthScreenProps {
  onAuthenticated: (session: AuthSession) => void;
  isOnline: boolean;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthenticated, isOnline }) => {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Login Form State
  const [loginId, setLoginId] = useState('AS-POL-1029');
  const [password, setPassword] = useState('AssamPolice@2026');

  // Signup Form State
  const [signupData, setSignupData] = useState({
    name: 'Sub-Inspector Hemanta Barua',
    official_id: 'AS-POL-1029',
    district: 'Kamrup Metropolitan',
    police_station: 'Panbazar PS',
    designation: 'Sub-Inspector',
    phone: '9864012345',
    email: 'officer.hemanta@assam.police.gov.in',
    password: 'AssamPolice@2026',
    confirmPassword: 'AssamPolice@2026',
  });

  const availableStations = POLICE_STATIONS[signupData.district] || [
    `${signupData.district} Sadar PS`,
    `${signupData.district} Traffic PS`,
  ];

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);

    try {
      if (!loginId || !password) {
        throw new Error('Please enter Officer ID and Password');
      }

      // If online, authenticate against Go API Gateway (:8080)
      if (isOnline) {
        const res = await ApiService.login(loginId, password);
        const session: AuthSession = {
          officer: res.data.officer,
          accessToken: res.data.accessToken,
          refreshToken: res.data.refreshToken,
          timestamp: new Date().toISOString(),
        };
        StorageService.saveSession(session);
        onAuthenticated(session);
      } else {
        // Offline Authentication Fallback: check cached session
        const cached = StorageService.getSession();
        if (cached && (cached.officer.official_id === loginId || cached.officer.phone === loginId)) {
          onAuthenticated(cached);
        } else {
          // If first time offline without cached credentials
          throw new Error('Offline Mode: No cached credentials found for this Officer ID. Please connect once to authenticate.');
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);

    try {
      if (!isOnline) {
        throw new Error('Account registration requires active backend connectivity.');
      }

      if (signupData.password !== signupData.confirmPassword) {
        throw new Error('Passwords do not match');
      }

      if (signupData.password.length < 6) {
        throw new Error('Password must be at least 6 characters');
      }

      const res = await ApiService.signup({
        official_id: signupData.official_id,
        name: signupData.name,
        email: signupData.email,
        password: signupData.password,
        phone: signupData.phone,
        district: signupData.district,
        police_station: signupData.police_station,
        designation: signupData.designation,
      });

      setSuccessMessage('Officer account registered successfully! Logging in...');
      const session: AuthSession = {
        officer: res.data.officer,
        accessToken: res.data.accessToken,
        refreshToken: res.data.refreshToken,
        timestamp: new Date().toISOString(),
      };
      StorageService.saveSession(session);

      setTimeout(() => {
        onAuthenticated(session);
      }, 800);
    } catch (err: any) {
      setErrorMessage(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  // Quick Demo Login (for rapid verification & offline evaluation)
  const handleQuickDemoLogin = () => {
    const demoSession: AuthSession = {
      officer: {
        id: '11111111-2222-3333-4444-555555555555',
        official_id: 'AS-POL-1029',
        name: 'SI Hemanta Barua',
        email: 'h.barua@assam.police.gov.in',
        phone: '9864012345',
        district: 'Kamrup Metropolitan',
        police_station: 'Panbazar PS',
        designation: 'Sub-Inspector',
        role: 'OFFICER',
      },
      accessToken: 'demo_offline_access_token',
      refreshToken: 'demo_offline_refresh_token',
      timestamp: new Date().toISOString(),
    };
    StorageService.saveSession(demoSession);
    onAuthenticated(demoSession);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        {/* Police Badge Emblem */}
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border-2 border-amber-500/40 flex items-center justify-center text-amber-500 mb-3 shadow-lg shadow-amber-500/10">
            <Shield className="w-9 h-9 fill-amber-500/20" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-1.5">
            CrashScribe
          </h1>
          <p className="text-xs text-amber-400 font-semibold uppercase tracking-wider mt-0.5">
            Assam Police Traffic Incident Management
          </p>
          <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
            eDAR-Compliant Offline-First Mobile Reporting System
          </p>
        </div>

        {/* Mode Toggle (Login vs Register) */}
        <div className="flex bg-slate-950 p-1 rounded-xl mb-5 border border-slate-800">
          <button
            type="button"
            onClick={() => { setIsLoginMode(true); setErrorMessage(''); }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
              isLoginMode ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Officer Login
          </button>
          <button
            type="button"
            onClick={() => { setIsLoginMode(false); setErrorMessage(''); }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
              !isLoginMode ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            New Officer Signup
          </button>
        </div>

        {/* Error / Success Notifications */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
        {successMessage && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Form Body */}
        {isLoginMode ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Official Officer ID / Phone / Email
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  placeholder="e.g. AS-POL-1029 or 9864012345"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  required
                />
                <User className="w-4 h-4 text-slate-500 absolute right-3.5 top-3" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3 text-slate-500 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-sm transition shadow-lg shadow-amber-500/20 flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              {loading ? (
                <span>Authenticating with Central HQ...</span>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Secure Officer Login</span>
                </>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSignup} className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-0.5">Officer Full Name</label>
              <input
                type="text"
                value={signupData.name}
                onChange={(e) => setSignupData({ ...signupData, name: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-0.5">Official Badge ID</label>
                <input
                  type="text"
                  value={signupData.official_id}
                  onChange={(e) => setSignupData({ ...signupData, official_id: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  placeholder="AS-POL-XXXX"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-0.5">Designation</label>
                <select
                  value={signupData.designation}
                  onChange={(e) => setSignupData({ ...signupData, designation: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="Sub-Inspector">Sub-Inspector (SI)</option>
                  <option value="Inspector">Inspector (OC)</option>
                  <option value="Assistant Sub-Inspector">Assistant SI</option>
                  <option value="Head Constable">Head Constable</option>
                  <option value="Superintendent of Police">District SP</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-0.5">District (Assam)</label>
                <select
                  value={signupData.district}
                  onChange={(e) => setSignupData({ ...signupData, district: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  {ASSAM_DISTRICTS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-0.5">Police Station</label>
                <select
                  value={signupData.police_station}
                  onChange={(e) => setSignupData({ ...signupData, police_station: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  {availableStations.map((ps) => (
                    <option key={ps} value={ps}>{ps}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-0.5">Mobile Number</label>
                <input
                  type="tel"
                  value={signupData.phone}
                  onChange={(e) => setSignupData({ ...signupData, phone: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-0.5">Govt Email</label>
                <input
                  type="email"
                  value={signupData.email}
                  onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-0.5">Password</label>
                <input
                  type="password"
                  value={signupData.password}
                  onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-0.5">Confirm Password</label>
                <input
                  type="password"
                  value={signupData.confirmPassword}
                  onChange={(e) => setSignupData({ ...signupData, confirmPassword: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 mt-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition shadow-md disabled:opacity-50"
            >
              {loading ? 'Submitting Registration...' : 'Register Official Account'}
            </button>
          </form>
        )}

        {/* Offline Demo Access Pill */}
        <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>Need rapid prototype review?</span>
          <button
            type="button"
            onClick={handleQuickDemoLogin}
            className="text-amber-400 hover:text-amber-300 font-semibold underline"
          >
            Quick Demo Login &rarr;
          </button>
        </div>
      </div>
    </div>
  );
};
