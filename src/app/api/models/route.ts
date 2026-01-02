// src/app/api/models/route.ts

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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const makerId = searchParams.get('maker');
    const query = searchParams.get('q') || '';

    const prisma = await getPrisma();

    if (!prisma) {
      return NextResponse.json(
        { success: false, error: 'Database not available' },
        { status: 500 }
      );
    }

    // メーカー指定がある場合とない場合で条件を変更
    const whereCondition = makerId
      ? {
          manufacturerId: makerId,
          OR: [
            { name: { contains: query } },
            { nameKana: { contains: query } }
          ]
        }
      : {
          OR: [
            { name: { contains: query } },
            { nameKana: { contains: query } }
          ]
        };

    const models = await prisma.vehicleModel.findMany({
      where: whereCondition,
      take: 10,
      orderBy: { name: 'asc' },
      include: {
        manufacturer: true
      }
    });

    return NextResponse.json({
      success: true,
      data: models
    });

  } catch (error) {
    console.error('車種検索エラー:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '車種検索に失敗しました'
      },
      { status: 500 }
    );
  }
}
