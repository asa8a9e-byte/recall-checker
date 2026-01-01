// src/app/api/alerts/route.ts

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

// アラート一覧取得
export async function GET() {
  try {
    const prisma = await getPrisma();

    // データベース未設定の場合は空のデータを返す
    if (!prisma) {
      return NextResponse.json({
        success: true,
        data: [],
        unreadCount: 0,
        message: 'データベース未設定'
      });
    }

    const alerts = await prisma.alert.findMany({
      include: {
        vehicle: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const formattedAlerts = alerts.map(a => ({
      id: a.id,
      title: a.title,
      message: a.message,
      status: a.status,
      createdAt: a.createdAt.toISOString(),
      vehicle: {
        id: a.vehicle.id,
        chassisNumber: a.vehicle.chassisNumber,
        model: a.vehicle.model
      }
    }));

    const unreadCount = alerts.filter(a => a.status === 'unread').length;

    return NextResponse.json({
      success: true,
      data: formattedAlerts,
      unreadCount
    });

  } catch (error) {
    console.error('アラート取得エラー:', error);
    // データベースエラーの場合も空のデータを返す
    return NextResponse.json({
      success: true,
      data: [],
      unreadCount: 0
    });
  }
}

// 全て既読にする
export async function PATCH(request: NextRequest) {
  try {
    const prisma = await getPrisma();

    if (!prisma) {
      return NextResponse.json({
        success: true,
        message: 'データベース未設定'
      });
    }

    const body = await request.json();

    if (body.action === 'markAllRead') {
      await prisma.alert.updateMany({
        where: { status: 'unread' },
        data: { status: 'read' }
      });

      return NextResponse.json({
        success: true,
        message: '全て既読にしました'
      });
    }

    return NextResponse.json(
      { success: false, error: '不正なリクエストです' },
      { status: 400 }
    );

  } catch (error) {
    console.error('アラート更新エラー:', error);
    return NextResponse.json({
      success: true,
      message: '処理をスキップしました'
    });
  }
}
