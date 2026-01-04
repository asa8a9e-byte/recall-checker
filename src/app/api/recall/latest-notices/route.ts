// src/app/api/recall/latest-notices/route.ts
// 国交省の最新リコール届出情報を取得

import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

interface RecallNotice {
  date: string;
  makers: Array<{
    name: string;
    url: string;
  }>;
  type: 'recall' | 'improvement';
}

interface MonthlyNotices {
  month: string;
  year: string;
  notices: RecallNotice[];
}

// キャッシュ（1時間有効）
let cache: { data: MonthlyNotices | null; expiresAt: number } | null = null;

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
    const response = await fetch('https://www.mlit.go.jp/jidosha/recall.html', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ja,en;q=0.9',
      },
    });

    const html = await response.text();
    const $ = cheerio.load(html);

    // 最初のh1.titleType01（最新月）を取得
    const monthTitle = $('h1.titleType01 strong').first().text().trim();

    // 令和7年分のタイトルを取得
    const yearTitle = $('h2.title').text().trim();
    const yearMatch = yearTitle.match(/令和(\d+)年/);
    const year = yearMatch ? `令和${yearMatch[1]}年` : '令和7年';

    // 最初のテーブル（最新月）を取得
    const notices: RecallNotice[] = [];
    const firstTable = $('h1.titleType01').first().next('table');

    firstTable.find('tbody tr').each((_, row) => {
      const $row = $(row);
      const cells = $row.find('td');

      if (cells.length >= 2) {
        // リコール届出（左側）
        const recallDate = $(cells[0]).text().trim().replace(/\s+/g, '');
        const recallCell = $(cells[1]);
        const recallMakers: Array<{ name: string; url: string }> = [];

        recallCell.find('a').each((_, link) => {
          const $link = $(link);
          const name = $link.text().trim();
          let url = $link.attr('href') || '';

          // 相対URLを絶対URLに変換
          if (url && !url.startsWith('http')) {
            url = `https://www.mlit.go.jp${url}`;
          }

          if (name && url) {
            recallMakers.push({ name, url });
          }
        });

        if (recallDate && recallMakers.length > 0) {
          notices.push({
            date: recallDate,
            makers: recallMakers,
            type: 'recall'
          });
        }

        // 改善対策届出（右側）- 必要に応じて追加
        if (cells.length >= 4) {
          const improvementDate = $(cells[2]).text().trim().replace(/\s+/g, '');
          const improvementCell = $(cells[3]);
          const improvementMakers: Array<{ name: string; url: string }> = [];

          improvementCell.find('a').each((_, link) => {
            const $link = $(link);
            const name = $link.text().trim();
            let url = $link.attr('href') || '';

            if (url && !url.startsWith('http')) {
              url = `https://www.mlit.go.jp${url}`;
            }

            if (name && url) {
              improvementMakers.push({ name, url });
            }
          });

          if (improvementDate && improvementMakers.length > 0) {
            notices.push({
              date: improvementDate,
              makers: improvementMakers,
              type: 'improvement'
            });
          }
        }
      }
    });

    const result: MonthlyNotices = {
      month: monthTitle,
      year: year,
      notices: notices
    };

    // キャッシュに保存（1時間）
    cache = {
      data: result,
      expiresAt: now + 60 * 60 * 1000
    };

    return NextResponse.json({
      success: true,
      data: result,
      cached: false
    });

  } catch (error) {
    console.error('リコール届出取得エラー:', error);
    return NextResponse.json({
      success: false,
      error: 'リコール届出の取得に失敗しました'
    }, { status: 500 });
  }
}
