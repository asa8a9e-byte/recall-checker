// src/app/api/health/route.ts
// ヘルスチェック用エンドポイント（UptimeRobot等で使用）

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
}
