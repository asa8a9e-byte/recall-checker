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
            <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center">
              <span className="text-white text-xs font-bold">RC</span>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900 tracking-tight">リコールチェッカー</h1>
              <p className="text-xs text-gray-400">中古車リコール管理</p>
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
