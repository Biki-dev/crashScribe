import React from 'react';
import { FileText, BarChart3, Settings } from 'lucide-react';

export type ActiveTab = 'home' | 'accident' | 'settings';

interface BottomNavProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  pendingSyncCount: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onTabChange,
  pendingSyncCount,
}) => {
  const tabs = [
    {
      id: 'home' as ActiveTab,
      label: 'Home',
      sublabel: 'eDAR Form',
      icon: FileText,
    },
    {
      id: 'accident' as ActiveTab,
      label: 'Accident',
      sublabel: 'Assam Dashboard',
      icon: BarChart3,
    },
    {
      id: 'settings' as ActiveTab,
      label: 'Settings',
      sublabel: 'Sync & Models',
      icon: Settings,
      badge: pendingSyncCount,
    },
  ];

  return (
    <nav className="bg-slate-900 border-t border-slate-800 px-2 py-1.5 flex justify-around items-center sticky bottom-0 z-40 select-none shadow-lg">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex flex-col items-center justify-center flex-1 py-1 px-2 rounded-lg transition relative ${
              isActive
                ? 'text-amber-400 font-bold bg-amber-500/10'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="relative">
              <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
              {tab.badge && tab.badge > 0 ? (
                <span className="absolute -top-1.5 -right-2.5 bg-rose-600 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full border border-slate-900">
                  {tab.badge}
                </span>
              ) : null}
            </div>
            <span className="text-xs mt-0.5">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
