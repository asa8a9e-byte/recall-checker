// src/app/api/recall/clear-cache/route.ts

import { NextRequest, NextResponse } from 'next/server';

// データベース接続を試みる
async function getPrisma() {
  try {
    const { prisma } = await import('@/lib/db');
    return prisma;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { chassisNumber } = body;

    const prisma = await getPrisma();

    if (chassisNumber) {
      // 特定の車台番号のキャッシュを削除
      const cleanedChassis = chassisNumber.trim().toUpperCase();

      if (prisma) {
        try {
          await prisma.recallCache.delete({
            where: { chassisNumber: cleanedChassis }
          });
        } catch (e) {
          console.log('Cache not found or already deleted:', e);
        }
      }

      return NextResponse.json({
        success: true,
        message: `${cleanedChassis}のキャッシュを削除しました`
      });
    } else {
      // 全キャッシュを削除
      if (prisma) {
        try {
          await prisma.recallCache.deleteMany({});
        } catch (e) {
          console.log('Failed to clear all cache:', e);
        }
      }

      return NextResponse.json({
        success: true,
        message: '全てのキャッシュを削除しました'
      });
    }

  } catch (error) {
    console.error('キャッシュクリアエラー:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'キャッシュクリアに失敗しました'
      },
      { status: 500 }
    );
  }
}
