// src/types/index.ts

// リコール情報
export interface RecallInfo {
  id: string;
  recallId: string;
  title: string;
  description?: string;
  severity: 'high' | 'medium' | 'low';
  status: 'pending' | 'completed';
  publishedAt: string;
}

// リコール検索結果
export interface RecallCheckResult {
  chassisNumber: string;
  maker: string;
  model?: string;
  hasRecall: boolean;
  recalls: RecallInfo[];
  checkedAt: string;
  cached: boolean;
}

// 在庫車両
export interface Vehicle {
  id: string;
  chassisNumber: string;
  maker: string;
  model?: string;
  year?: string;
  createdAt: string;
  updatedAt: string;
  recallCount: number;
  hasUnresolvedRecall: boolean;
}

// 在庫サマリー
export interface InventorySummary {
  total: number;
  withRecall: number;
  withoutRecall: number;
}

// アラート
export interface Alert {
  id: string;
  title: string;
  message?: string;
  status: 'unread' | 'read';
  createdAt: string;
  vehicle: {
    id: string;
    chassisNumber: string;
    model?: string;
  };
}

// API レスポンス
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// 在庫追加リクエスト
export interface AddVehicleRequest {
  chassisNumber: string;
  maker: string;
  model?: string;
  year?: string;
}

// メーカー一覧
export const MAKERS = [
  'トヨタ',
  '日産',
  'ホンダ',
  'マツダ',
  'スバル',
  'ダイハツ',
  '三菱',
  'スズキ',
] as const;

export type Maker = typeof MAKERS[number];

// メーカー判定用プレフィックス
export const MAKER_PREFIXES: Record<Maker, string[]> = {
  'トヨタ': ['JT', 'SB', 'JTE'],
  '日産': ['JN', 'SJ'],
  'ホンダ': ['JH', 'SH'],
  'マツダ': ['JM'],
  'スバル': ['JF'],
  'ダイハツ': ['LA', 'M3'],
  '三菱': ['JA', 'JMB'],
  'スズキ': ['JS', 'MA'],
};

// メーカー公式リコール検索ページURL（スクレイピング対象と同じ）
export const MAKER_RECALL_URLS: Record<Maker, string> = {
  'トヨタ': 'https://www.toyota.co.jp/recall-search/dc/search',
  '日産': 'https://www.nissan.co.jp/RECALL/search.html',
  'ホンダ': 'https://recallsearch4.honda.co.jp/sqs/r001/R00101.do?fn=link.disp',
  'マツダ': 'https://www.mazda.co.jp/carlife/recall/',
  'スバル': 'https://www.subaru.jp/recall/',
  'ダイハツ': 'https://www.daihatsu.co.jp/service/recall/',
  '三菱': 'https://www.mitsubishi-motors.co.jp/support/recall/',
  'スズキ': 'https://www.suzuki.co.jp/recall/',
};
