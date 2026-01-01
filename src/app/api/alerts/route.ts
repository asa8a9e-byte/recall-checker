// src/app/api/alerts/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// アラート一覧取得
export async function GET() {
  try {
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
    return NextResponse.json(
      { success: false, error: 'アラートの取得に失敗しました' },
      { status: 500 }
    );
  }
}

// 全て既読にする
export async function PATCH(request: NextRequest) {
  try {
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
    return NextResponse.json(
      { success: false, error: 'アラートの更新に失敗しました' },
      { status: 500 }
    );
  }
}
