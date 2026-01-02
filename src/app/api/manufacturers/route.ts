// src/app/api/manufacturers/route.ts

import { NextResponse } from 'next/server';

// データベース接続を試みる
async function getPrisma() {
  try {
    const { prisma } = await import('@/lib/db');
    return prisma;
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const prisma = await getPrisma();

    if (!prisma) {
      return NextResponse.json(
        { success: false, error: 'Database not available' },
        { status: 500 }
      );
    }

    const manufacturers = await prisma.manufacturer.findMany({
      orderBy: { name: 'asc' }
    });

    return NextResponse.json({
      success: true,
      data: manufacturers
    });

  } catch (error) {
    console.error('メーカー一覧取得エラー:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'メーカー一覧の取得に失敗しました'
      },
      { status: 500 }
    );
  }
}
