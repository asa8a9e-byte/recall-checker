// src/app/api/recall/check/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { checkRecall } from '@/lib/recall-checker';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { chassisNumber, maker } = body;
    
    if (!chassisNumber) {
      return NextResponse.json(
        { success: false, error: '車台番号を入力してください' },
        { status: 400 }
      );
    }
    
    const cleanedChassis = chassisNumber.trim().toUpperCase();
    
    // キャッシュを確認
    const cached = await prisma.recallCache.findUnique({
      where: { chassisNumber: cleanedChassis }
    });
    
    if (cached && cached.expiresAt > new Date()) {
      // キャッシュが有効
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
    
    // 実際にリコールチェックを実行
    const result = await checkRecall(cleanedChassis, maker);
    
    // キャッシュに保存（24時間有効）
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);
    
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
