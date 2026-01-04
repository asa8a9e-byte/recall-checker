// src/app/api/recall/date-range/route.ts
// 国交省サイトの届出日範囲を取得

import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

// キャッシュ（1時間有効）
let cache: { data: { startDate: string; endDate: string } | null; expiresAt: number } | null = null;

export async function GET() {
  try {
    // キャッシュ確認
    const now = Date.now();
    if (cache && cache.expiresAt > now && cache.data) {
      return NextResponse.json({
        success: true,
        data: cache.data,
        cached: true
      });
    }

    // 国交省サイトにアクセス
    const response = await fetch('https://renrakuda.mlit.go.jp/renrakuda/recall-search.html', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ja,en;q=0.9',
      },
    });

    const html = await response.text();
    const $ = cheerio.load(html);

    // 届出日範囲を抽出
    // パターン: (※1)1993年04月15日 ～ 2025年11月30日の届出日の中から検索します。
    let startDate = '';
    let endDate = '';

    const bodyText = $('body').text();
    const datePattern = /(\d{4})年(\d{2})月(\d{2})日\s*[～〜-]\s*(\d{4})年(\d{2})月(\d{2})日/;
    const match = bodyText.match(datePattern);

    if (match) {
      startDate = `${match[1]}年${match[2]}月${match[3]}日`;
      endDate = `${match[4]}年${match[5]}月${match[6]}日`;
    }

    // キャッシュに保存（1時間）
    cache = {
      data: { startDate, endDate },
      expiresAt: now + 60 * 60 * 1000
    };

    return NextResponse.json({
      success: true,
      data: { startDate, endDate },
      cached: false
    });

  } catch (error) {
    console.error('届出日範囲取得エラー:', error);
    return NextResponse.json({
      success: false,
      error: '届出日範囲の取得に失敗しました'
    }, { status: 500 });
  }
}
