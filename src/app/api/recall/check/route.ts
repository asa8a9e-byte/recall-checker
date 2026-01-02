// src/app/api/recall/check/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { checkRecall } from '@/lib/recall-checker';

// データベース接続を試みる（オプショナル）
async function getPrisma() {
  try {
    const { prisma } = await import('@/lib/db');
    return prisma;
  } catch {
    return null;
  }
}

// インメモリキャッシュ（データベース未設定時のフォールバック）
const memoryCache = new Map<string, { data: unknown; expiresAt: number }>();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { chassisNumber, maker, skipCache } = body;

    if (!chassisNumber) {
      return NextResponse.json(
        { success: false, error: '車台番号を入力してください' },
        { status: 400 }
      );
    }

    if (!maker) {
      return NextResponse.json(
        { success: false, error: 'メーカーを選択してください' },
        { status: 400 }
      );
    }

    const cleanedChassis = chassisNumber.trim().toUpperCase();
    const prisma = await getPrisma();

    // データベースキャッシュを確認（skipCacheがtrueの場合はスキップ）
    if (prisma && !skipCache) {
      try {
        const cached = await prisma.recallCache.findUnique({
          where: { chassisNumber: cleanedChassis }
        });

        if (cached && cached.expiresAt > new Date()) {
          return NextResponse.json({
            success: true,
            data: {
              chassisNumber: cleanedChassis,
              maker: cached.maker,
              hasRecall: cached.hasRecall,
              recalls: cached.recallData ? JSON.parse(cached.recallData) : [],
              checkedAt: cached.checkedAt.toISOString(),
              cached: true
            }
          });
        }
      } catch (e) {
        console.log('DB cache check skipped:', e);
      }
    } else if (!skipCache) {
      // インメモリキャッシュを確認
      const memCached = memoryCache.get(cleanedChassis);
      if (memCached && memCached.expiresAt > Date.now()) {
        return NextResponse.json({
          success: true,
          data: memCached.data,
          cached: true
        });
      }
    }

    // 実際にリコールチェックを実行
    const result = await checkRecall(cleanedChassis, maker);

    // キャッシュに保存
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    if (prisma) {
      try {
        await prisma.recallCache.upsert({
          where: { chassisNumber: cleanedChassis },
          update: {
            maker: result.maker,
            hasRecall: result.hasRecall,
            recallData: JSON.stringify(result.recalls),
            checkedAt: new Date(),
            expiresAt
          },
          create: {
            chassisNumber: cleanedChassis,
            maker: result.maker,
            hasRecall: result.hasRecall,
            recallData: JSON.stringify(result.recalls),
            expiresAt
          }
        });
      } catch (e) {
        console.log('DB cache save skipped:', e);
      }
    } else {
      // インメモリキャッシュに保存
      memoryCache.set(cleanedChassis, {
        data: result,
        expiresAt: expiresAt.getTime()
      });
    }

    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('リコールチェックエラー:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'リコール検索に失敗しました'
      },
      { status: 500 }
    );
  }
}
