// src/app/api/recall/news/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { fetchAllRecallNews } from '@/lib/recall-news';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    // キャッシュを確認（1時間有効）
    const cached = await prisma.recallNewsCache.findFirst({
      where: {
        expiresAt: { gt: new Date() }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (cached) {
      return NextResponse.json({
        success: true,
        data: JSON.parse(cached.newsData),
        cached: true
      });
    }

    // 最新のリコール情報を取得（各メーカー10件）
    const news = await fetchAllRecallNews(10);

    // キャッシュに保存（1時間有効）
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    await prisma.recallNewsCache.create({
      data: {
        newsData: JSON.stringify(news),
        expiresAt
      }
    });

    // 古いキャッシュを削除
    await prisma.recallNewsCache.deleteMany({
      where: {
        expiresAt: { lt: new Date() }
      }
    });

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
