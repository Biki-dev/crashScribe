import React, { useState, useEffect } from 'react';
import { TopBar } from './components/TopBar';
import { BottomNav, ActiveTab } from './components/BottomNav';
import { AuthScreen } from './screens/AuthScreen';
import { HomeScreen } from './screens/HomeScreen';
import { DraftReviewScreen } from './screens/DraftReviewScreen';
import { AccidentTabScreen } from './screens/AccidentTabScreen';
import { SettingsTabScreen } from './screens/SettingsTabScreen';
import { StorageService } from './services/storage.service';
import { ApiService } from './services/api.service';
import { AuthSession, Officer } from './types/auth.types';
import { AccidentReportData, LocalReport } from './types/edar.types';

export const App: React.FC = () => {
  // Session State
  const [session, setSession] = useState<AuthSession | null>(() => StorageService.getSession());

  // Navigation State
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [isReviewingDraft, setIsReviewingDraft] = useState(false);
  const [currentDraftData, setCurrentDraftData] = useState<AccidentReportData | null>(null);

  // Connectivity & Viewport
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isMobileFrame, setIsMobileFrame] = useState<boolean>(false);
  const [pendingCount, setPendingCount] = useState<number>(0);

  // Refresh pending reports count
  const refreshPendingCount = () => {
    const pending = StorageService.getPendingReports();
    setPendingCount(pending.length);
  };

  useEffect(() => {
    refreshPendingCount();

    // Check backend health periodically
    const checkConn = async () => {
      const up = await ApiService.checkHealth();
      // Only set to false if user didn't manually toggle off
    };
    checkConn();
  }, []);

  // Auth Callbacks
  const handleAuthenticated = (newSession: AuthSession) => {
    setSession(newSession);
    setActiveTab('home');
    refreshPendingCount();
  };

  const handleLogout = () => {
    StorageService.clearSession();
    setSession(null);
    setIsReviewingDraft(false);
    setCurrentDraftData(null);
  };

  const handleProfileUpdated = (updatedOfficer: Officer) => {
    if (session) {
      setSession({ ...session, officer: updatedOfficer });
    }
  };

  // Draft Flow Callbacks
  const handleProceedToReview = (reportData: AccidentReportData) => {
    setCurrentDraftData(reportData);
    setIsReviewingDraft(true);
  };

  const handleEditReport = () => {
    setIsReviewingDraft(false);
  };

  const handleSaveCompleted = (_savedReport: LocalReport) => {
    setIsReviewingDraft(false);
    setCurrentDraftData(null);
    refreshPendingCount();
    // Navigate to Home ready for next report
    setActiveTab('home');
  };

  // If not logged in, render Authentication Screen (Stage 1)
  if (!session) {
    return <AuthScreen onAuthenticated={handleAuthenticated} isOnline={isOnline} />;
  }

  // Stage 2: Main Application Shell
  const appContent = (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">
      {/* Pinned Top Bar */}
      <TopBar
        officer={session.officer}
        isOnline={isOnline}
        onToggleOnline={() => setIsOnline(!isOnline)}
        pendingCount={pendingCount}
        isMobileFrame={isMobileFrame}
        onToggleFrame={() => setIsMobileFrame(!isMobileFrame)}
        onNavigateToSync={() => {
          setActiveTab('settings');
          setIsReviewingDraft(false);
        }}
      />

      {/* Main Tab Content */}
      <main className="flex-1 overflow-y-auto">
        {activeTab === 'home' && (
          isReviewingDraft && currentDraftData ? (
            <DraftReviewScreen
              reportData={currentDraftData}
              officer={session.officer}
              onEditReport={handleEditReport}
              onSaveCompleted={handleSaveCompleted}
            />
          ) : (
            <HomeScreen
              officer={session.officer}
              isOnline={isOnline}
              onProceedToReview={handleProceedToReview}
              initialData={currentDraftData}
            />
          )
        )}

        {activeTab === 'accident' && (
          <AccidentTabScreen isOnline={isOnline} />
        )}

        {activeTab === 'settings' && (
          <SettingsTabScreen
            officer={session.officer}
            isOnline={isOnline}
            onLogout={handleLogout}
            onProfileUpdated={handleProfileUpdated}
          />
        )}
      </main>

      {/* Pinned Bottom Navigation Bar */}
      <BottomNav
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          if (tab !== 'home') {
            setIsReviewingDraft(false);
          }
          refreshPendingCount();
        }}
        pendingSyncCount={pendingCount}
      />
    </div>
  );

  // If user selected mobile device frame preview (ideal for tablet/desktop evaluation)
  if (isMobileFrame) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-2 sm:p-6">
        <div className="w-full max-w-[430px] h-[890px] max-h-[96vh] rounded-[48px] bg-slate-950 border-[10px] border-slate-800 shadow-2xl overflow-hidden flex flex-col relative ring-1 ring-slate-700">
          {/* Mobile Speaker / Camera Notch */}
          <div className="h-5 bg-slate-950 w-full flex items-center justify-center pt-1 z-50">
            <div className="w-24 h-3.5 bg-slate-900 rounded-full" />
          </div>
          <div className="flex-1 overflow-y-auto flex flex-col justify-between">
            {appContent}
          </div>
        </div>
      </div>
    );
  }

  return appContent;
};
export default App;
