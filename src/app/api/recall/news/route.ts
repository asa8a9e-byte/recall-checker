// src/app/api/recall/news/route.ts
// 各メーカーの最新リコールニュースを取得

import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

interface RecallNews {
  maker: string;
  title: string;
  date: string;
  url: string;
}

// キャッシュ（1時間有効）
let cache: { data: RecallNews[]; expiresAt: number } | null = null;

const MAKER_URLS: Record<string, { url: string; baseUrl: string }> = {
  'トヨタ': { url: 'https://toyota.jp/recall/', baseUrl: 'https://toyota.jp' },
  '日産': { url: 'https://www.nissan.co.jp/RECALL/', baseUrl: 'https://www.nissan.co.jp' },
  'ホンダ': { url: 'https://www.honda.co.jp/recall/', baseUrl: 'https://www.honda.co.jp' },
  'マツダ': { url: 'https://www.mazda.co.jp/carlife/recall/', baseUrl: 'https://www.mazda.co.jp' },
  'スバル': { url: 'https://www.subaru.jp/recall/', baseUrl: 'https://www.subaru.jp' },
  'ダイハツ': { url: 'https://www.daihatsu.co.jp/service/recall/', baseUrl: 'https://www.daihatsu.co.jp' },
};

async function fetchMakerNews(maker: string, config: { url: string; baseUrl: string }): Promise<RecallNews[]> {
  try {
    const response = await fetch(config.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ja,en;q=0.9',
      },
    });

    if (!response.ok) {
      return [];
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const news: RecallNews[] = [];

    // 各メーカーごとにパースロジックを変える
    if (maker === 'トヨタ') {
      // トヨタのリコール一覧
      $('a[href*="/recall/"]').each((_, el) => {
        const $el = $(el);
        const title = $el.text().trim();
        const href = $el.attr('href');
        if (title && href && title.length > 5 && !title.includes('リコール等情報')) {
          // 日付パターンを探す
          const dateMatch = title.match(/(\d{4})[年./](\d{1,2})[月./](\d{1,2})/);
          const date = dateMatch ? `${dateMatch[1]}/${dateMatch[2]}/${dateMatch[3]}` : '';
          news.push({
            maker,
            title: title.replace(/\s+/g, ' ').substring(0, 100),
            date,
            url: href.startsWith('http') ? href : `${config.baseUrl}${href}`
          });
        }
      });
    } else if (maker === '日産') {
      $('a[href*="/RECALL/"]').each((_, el) => {
        const $el = $(el);
        const title = $el.text().trim();
        const href = $el.attr('href');
        if (title && href && title.length > 5) {
          const dateMatch = title.match(/(\d{4})[年./](\d{1,2})[月./](\d{1,2})/);
          const date = dateMatch ? `${dateMatch[1]}/${dateMatch[2]}/${dateMatch[3]}` : '';
          news.push({
            maker,
            title: title.replace(/\s+/g, ' ').substring(0, 100),
            date,
            url: href.startsWith('http') ? href : `${config.baseUrl}${href}`
          });
        }
      });
    } else if (maker === 'ホンダ') {
      $('a[href*="/recall/"]').each((_, el) => {
        const $el = $(el);
        const title = $el.text().trim();
        const href = $el.attr('href');
        if (title && href && title.length > 5 && !title.includes('リコール情報')) {
          const dateMatch = title.match(/(\d{4})[年./](\d{1,2})[月./](\d{1,2})/);
          const date = dateMatch ? `${dateMatch[1]}/${dateMatch[2]}/${dateMatch[3]}` : '';
          news.push({
            maker,
            title: title.replace(/\s+/g, ' ').substring(0, 100),
            date,
            url: href.startsWith('http') ? href : `${config.baseUrl}${href}`
          });
        }
      });
    } else if (maker === 'マツダ') {
      $('a[href*="/recall/"]').each((_, el) => {
        const $el = $(el);
        const title = $el.text().trim();
        const href = $el.attr('href');
        if (title && href && title.length > 5) {
          const dateMatch = title.match(/(\d{4})[年./](\d{1,2})[月./](\d{1,2})/);
          const date = dateMatch ? `${dateMatch[1]}/${dateMatch[2]}/${dateMatch[3]}` : '';
          news.push({
            maker,
            title: title.replace(/\s+/g, ' ').substring(0, 100),
            date,
            url: href.startsWith('http') ? href : `${config.baseUrl}${href}`
          });
        }
      });
    } else if (maker === 'スバル') {
      $('a[href*="/recall/"]').each((_, el) => {
        const $el = $(el);
        const title = $el.text().trim();
        const href = $el.attr('href');
        if (title && href && title.length > 5 && !title.includes('リコール情報')) {
          const dateMatch = title.match(/(\d{4})[年./](\d{1,2})[月./](\d{1,2})/);
          const date = dateMatch ? `${dateMatch[1]}/${dateMatch[2]}/${dateMatch[3]}` : '';
          news.push({
            maker,
            title: title.replace(/\s+/g, ' ').substring(0, 100),
            date,
            url: href.startsWith('http') ? href : `${config.baseUrl}${href}`
          });
        }
      });
    } else if (maker === 'ダイハツ') {
      $('a[href*="/recall/"]').each((_, el) => {
        const $el = $(el);
        const title = $el.text().trim();
        const href = $el.attr('href');
        if (title && href && title.length > 5) {
          const dateMatch = title.match(/(\d{4})[年./](\d{1,2})[月./](\d{1,2})/);
          const date = dateMatch ? `${dateMatch[1]}/${dateMatch[2]}/${dateMatch[3]}` : '';
          news.push({
            maker,
            title: title.replace(/\s+/g, ' ').substring(0, 100),
            date,
            url: href.startsWith('http') ? href : `${config.baseUrl}${href}`
          });
        }
      });
    }

    // 重複除去
    const uniqueNews = news.filter((item, index, self) =>
      index === self.findIndex(t => t.title === item.title)
    );

    return uniqueNews.slice(0, 5);
  } catch (error) {
    console.error(`${maker}のリコールニュース取得エラー:`, error);
    return [];
  }
}

export async function GET() {
  try {
    // キャッシュ確認
    const now = Date.now();
    if (cache && cache.expiresAt > now) {
      return NextResponse.json({
        success: true,
        data: cache.data,
        cached: true
      });
    }

    // 各メーカーから並列取得
    const results = await Promise.all(
      Object.entries(MAKER_URLS).map(([maker, config]) =>
        fetchMakerNews(maker, config)
      )
    );

    const allNews = results.flat();

    // キャッシュに保存（1時間）
    cache = {
      data: allNews,
      expiresAt: now + 60 * 60 * 1000
    };

    return NextResponse.json({
      success: true,
      data: allNews,
      cached: false
    });

  } catch (error) {
    console.error('リコールニュース取得エラー:', error);
    return NextResponse.json({
      success: false,
      error: 'リコールニュースの取得に失敗しました',
      data: []
    }, { status: 500 });
  }
}
