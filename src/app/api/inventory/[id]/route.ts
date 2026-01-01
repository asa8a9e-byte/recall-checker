// src/app/api/inventory/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// 在庫詳細取得
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
      include: {
        recalls: {
          include: {
            recall: true
          }
        },
        alerts: {
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });
    
    if (!vehicle) {
      return NextResponse.json(
        { success: false, error: '車両が見つかりません' },
        { status: 404 }
      );
    }
    
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
        recalls: vehicle.recalls.map(vr => ({
          id: vr.recall.id,
          recallId: vr.recall.recallId,
          title: vr.recall.title,
          description: vr.recall.description,
          severity: vr.recall.severity,
          status: vr.status,
          publishedAt: vr.recall.publishedAt.toISOString()
        })),
        alerts: vehicle.alerts.map(a => ({
          id: a.id,
          title: a.title,
          message: a.message,
          status: a.status,
          createdAt: a.createdAt.toISOString()
        }))
      }
    });
    
  } catch (error) {
    console.error('在庫詳細取得エラー:', error);
    return NextResponse.json(
      { success: false, error: '在庫の取得に失敗しました' },
      { status: 500 }
    );
  }
}

// 在庫更新
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { maker, model, year } = body;

    const vehicle = await prisma.vehicle.update({
      where: { id },
      data: {
        ...(maker && { maker }),
        ...(model && { model }),
        ...(year && { year })
      }
    });
    
    return NextResponse.json({
      success: true,
      data: vehicle
    });
    
  } catch (error) {
    console.error('在庫更新エラー:', error);
    return NextResponse.json(
      { success: false, error: '在庫の更新に失敗しました' },
      { status: 500 }
    );
  }
}

// 在庫削除
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.vehicle.delete({
      where: { id }
    });
    
    return NextResponse.json({
      success: true,
      message: '削除しました'
    });
    
  } catch (error) {
    console.error('在庫削除エラー:', error);
    return NextResponse.json(
      { success: false, error: '在庫の削除に失敗しました' },
      { status: 500 }
    );
  }
}
