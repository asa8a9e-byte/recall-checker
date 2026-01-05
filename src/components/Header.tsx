'use client';

import { Bell } from 'lucide-react';

interface HeaderProps {
  unreadCount: number;
  onAlertClick: () => void;
}

export default function Header({ unreadCount, onAlertClick }: HeaderProps) {
  return (
    <header className="bg-white border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-4 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center shadow-sm">
              <span className="text-white text-sm font-bold">RN</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 tracking-tight">リコナビ</h1>
              <p className="text-xs text-gray-400">リコール情報検索</p>
            </div>
          </div>
          <button
            onClick={onAlertClick}
            className="relative p-2.5 hover:bg-gray-50 rounded-xl transition-colors"
          >
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            )}
            <Bell className="w-5 h-5 text-gray-500" />
          </button>
        </div>
      </div>
    </header>
  );
}
