// src/app/api/recall/news/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { fetchAllRecallNews } from '@/lib/recall-news';

// インメモリキャッシュ（サーバーレス環境でも動作）
let newsCache: { data: unknown; expiresAt: number } | null = null;

export async function GET(request: NextRequest) {
  try {
    // インメモリキャッシュを確認（1時間有効）
    const now = Date.now();
    if (newsCache && newsCache.expiresAt > now) {
      return NextResponse.json({
        success: true,
        data: newsCache.data,
        cached: true
      });
    }

    // 最新のリコール情報を取得（各メーカー10件）
    const news = await fetchAllRecallNews(10);

    // インメモリキャッシュに保存（1時間有効）
    newsCache = {
      data: news,
      expiresAt: now + 60 * 60 * 1000 // 1時間
    };

    return NextResponse.json({
      success: true,
      data: news,
      cached: false
    });

  } catch (error) {
    console.error('リコールニュース取得エラー:', error);
    return NextResponse.json(
      { success: false, error: 'リコール情報の取得に失敗しました' },
      { status: 500 }
    );
  }
}
