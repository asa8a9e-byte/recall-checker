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

// メーカー判定用プレフィックス（型式コード含む）
export const MAKER_PREFIXES: Record<Maker, string[]> = {
  'トヨタ': [
    'JT', 'SB', 'JTE',
    // 型式コード
    'ZWR', 'ZRR', 'ZVW', 'NHP', 'NZE', 'ZRE', 'GRS', 'GRX', 'AGH', 'GGH', 'AYH',
    'MXPH', 'MXPJ', 'MXPA', 'MXAA', 'AXAH', 'AXAP', 'KDH', 'TRH', 'GDH', 'LXA',
  ],
  '日産': [
    'JN', 'SJ',
    // 型式コード
    'E13', 'E12', 'C27', 'C26', 'T32', 'T31', 'J10', 'F15', 'ZE1', 'ZE0',
    'SNE', 'DAA', 'DBA', 'HE12', 'HR12', 'HNT32', 'NT32', 'TE52', 'TNE52',
  ],
  'ホンダ': [
    'JH', 'SH',
    // 型式コード
    'GB', 'GK', 'GP', 'RU', 'RP', 'RC', 'FK', 'FL', 'RW', 'ZE', 'JF', 'JG',
    'JJ', 'JW', 'NC', 'SC', 'FC', 'AP',
  ],
  'マツダ': [
    'JM',
    // 型式コード
    'KF', 'KE', 'DJ', 'DK', 'BM', 'BY', 'GJ', 'GL', 'KG', 'DM', 'ND', 'NF',
  ],
  'スバル': [
    'JF',
    // 型式コード（サンバー、レガシィ、インプレッサ等）
    'S700', 'S710', 'S500', 'S510', 'GK', 'GT', 'GU', 'GP', 'GJ', 'GE', 'GH',
    'BN', 'BM', 'BR', 'BS', 'BT', 'VN', 'VM', 'VA', 'VB', 'SK', 'SJ', 'SH',
  ],
  'ダイハツ': [
    'LA', 'M3',
    // 型式コード
    'S700', 'S710', 'S500', 'S510', 'L350', 'L360', 'L375', 'L385', 'L455',
    'L465', 'L575', 'L585', 'L650', 'L660', 'L675', 'L685', 'L880', 'LA100',
    'LA110', 'LA150', 'LA160', 'LA250', 'LA260', 'LA550', 'LA560', 'LA650',
    'LA660', 'LA700', 'LA710', 'LA800', 'LA810', 'LA850', 'LA860', 'LA900',
    'LA910', 'S200', 'S210', 'S321', 'S331',
  ],
  '三菱': [
    'JA', 'JMB',
    // 型式コード
    'GK', 'A03A', 'A05A', 'B11', 'B33', 'B35', 'B37', 'B44', 'GG', 'HA',
  ],
  'スズキ': [
    'JS', 'MA',
    // 型式コード
    'ZC', 'ZD', 'FF', 'MK', 'MN', 'ML', 'MR', 'DA', 'DB', 'DD', 'HE', 'HA',
    'HB', 'HC', 'MH', 'MJ', 'MF', 'JB', 'JM', 'TD', 'TA', 'TL', 'YA', 'YB',
    'YC', 'YD', 'YE', 'ZRT', 'ZWT',
  ],
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
