// src/app/api/models/[modelId]/types/route.ts

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ modelId: string }> }
) {
  try {
    const { modelId } = await params;

    const prisma = await getPrisma();

    if (!prisma) {
      return NextResponse.json(
        { success: false, error: 'Database not available' },
        { status: 500 }
      );
    }

    const types = await prisma.modelType.findMany({
      where: { vehicleModelId: modelId },
      orderBy: { typeCode: 'asc' }
    });

    return NextResponse.json({
      success: true,
      data: types
    });

  } catch (error) {
    console.error('型式一覧取得エラー:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '型式一覧の取得に失敗しました'
      },
      { status: 500 }
    );
  }
}
