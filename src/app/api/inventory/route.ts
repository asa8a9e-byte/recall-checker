// src/app/api/inventory/route.ts

import { NextRequest, NextResponse } from 'next/server';

// データベース接続を試みる（オプショナル）
async function getPrisma() {
  try {
    const { prisma } = await import('@/lib/db');
    return prisma;
  } catch {
    return null;
  }
}

// 在庫一覧取得
export async function GET() {
  try {
    const prisma = await getPrisma();

    // データベース未設定の場合は空のデータを返す
    if (!prisma) {
      return NextResponse.json({
        success: true,
        data: [],
        summary: { total: 0, withRecall: 0, withoutRecall: 0 },
        message: 'データベース未設定'
      });
    }

    const vehicles = await prisma.vehicle.findMany({
      include: {
        recalls: {
          include: {
            recall: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // 整形
    const formattedVehicles = vehicles.map(v => ({
      id: v.id,
      chassisNumber: v.chassisNumber,
      maker: v.maker,
      model: v.model,
      year: v.year,
      createdAt: v.createdAt.toISOString(),
      updatedAt: v.updatedAt.toISOString(),
      recallCount: v.recalls.length,
      hasUnresolvedRecall: v.recalls.some(r => r.status === 'pending')
    }));

    // サマリー
    const summary = {
      total: formattedVehicles.length,
      withRecall: formattedVehicles.filter(v => v.recallCount > 0).length,
      withoutRecall: formattedVehicles.filter(v => v.recallCount === 0).length
    };

    return NextResponse.json({
      success: true,
      data: formattedVehicles,
      summary
    });

  } catch (error) {
    console.error('在庫取得エラー:', error);
    // データベースエラーの場合も空のデータを返す
    return NextResponse.json({
      success: true,
      data: [],
      summary: { total: 0, withRecall: 0, withoutRecall: 0 }
    });
  }
}

// 在庫追加
export async function POST(request: NextRequest) {
  try {
    const prisma = await getPrisma();

    if (!prisma) {
      return NextResponse.json(
        { success: false, error: 'データベースが設定されていません。在庫機能を使用するにはデータベースの設定が必要です。' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { chassisNumber, maker, model, year } = body;

    if (!chassisNumber || !maker) {
      return NextResponse.json(
        { success: false, error: '車台番号とメーカーは必須です' },
        { status: 400 }
      );
    }

    const cleanedChassis = chassisNumber.trim().toUpperCase();

    // 重複チェック
    const existing = await prisma.vehicle.findUnique({
      where: { chassisNumber: cleanedChassis }
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'この車台番号は既に登録されています' },
        { status: 400 }
      );
    }

    // 登録
    const vehicle = await prisma.vehicle.create({
      data: {
        chassisNumber: cleanedChassis,
        maker,
        model,
        year
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        id: vehicle.id,
        chassisNumber: vehicle.chassisNumber,
        maker: vehicle.maker,
        model: vehicle.model,
        year: vehicle.year,
        createdAt: vehicle.createdAt.toISOString(),
        updatedAt: vehicle.updatedAt.toISOString(),
        recallCount: 0,
        hasUnresolvedRecall: false
      }
    });

  } catch (error) {
    console.error('在庫追加エラー:', error);
    return NextResponse.json(
      { success: false, error: '在庫の追加に失敗しました' },
      { status: 500 }
    );
  }
}
