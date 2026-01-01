// src/lib/recall-news/index.ts
// 各メーカーの最新リコール情報を取得

import { chromium, Browser } from 'playwright';
import * as cheerio from 'cheerio';

export interface RecallNews {
  maker: string;
  title: string;
  date: string;
  url: string;
  category?: string; // リコール/改善対策/サービスキャンペーン
}

// 各メーカーのリコール一覧ページURL
const RECALL_LIST_URLS: Record<string, string> = {
  'トヨタ': 'https://toyota.jp/recall/',
  '日産': 'https://www.nissan.co.jp/RECALL/',
  'ホンダ': 'https://www.honda.co.jp/recall/auto/',
  'マツダ': 'https://www.mazda.co.jp/carlife/recall/',
  'スバル': 'https://www.subaru.co.jp/recall/',
  'ダイハツ': 'https://www.daihatsu.co.jp/info/recall/',
};

export async function fetchAllRecallNews(limit: number = 5): Promise<RecallNews[]> {
  const allNews: RecallNews[] = [];
  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    // 各メーカーから並列で取得
    const promises = Object.entries(RECALL_LIST_URLS).map(async ([maker, url]) => {
      try {
        const page = await context.newPage();
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(2000);
        const html = await page.content();
        await page.close();
        return parseRecallNews(maker, html, url, limit);
      } catch (error) {
        console.error(`${maker}のリコール情報取得エラー:`, error);
        return [];
      }
    });

    const results = await Promise.all(promises);
    results.forEach(news => allNews.push(...news));

    // 日付でソート（新しい順）
    allNews.sort((a, b) => {
      const dateA = new Date(a.date.replace(/\//g, '-'));
      const dateB = new Date(b.date.replace(/\//g, '-'));
      return dateB.getTime() - dateA.getTime();
    });

    return allNews;

  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

function parseRecallNews(maker: string, html: string, baseUrl: string, limit: number): RecallNews[] {
  const $ = cheerio.load(html);
  const news: RecallNews[] = [];

  switch (maker) {
    case 'トヨタ':
      // トヨタのリコール一覧ページをパース
      $('a').each((i, el) => {
        if (news.length >= limit) return false;
        const href = $(el).attr('href') || '';
        const text = $(el).text().trim();
        // リコール詳細ページへのリンクを検出
        if (href.includes('/recall/') && href.includes('.html') && text.length > 10) {
          const dateMatch = text.match(/(\d{4})[\/年](\d{1,2})[\/月](\d{1,2})/);
          news.push({
            maker,
            title: text.replace(/\d{4}[\/年]\d{1,2}[\/月]\d{1,2}[日]?\s*/, '').trim().slice(0, 80),
            date: dateMatch ? `${dateMatch[1]}/${dateMatch[2]}/${dateMatch[3]}` : '',
            url: href.startsWith('http') ? href : `https://toyota.jp${href}`,
          });
        }
      });
      break;

    case '日産':
      // 日産のリコール一覧をパース
      $('a').each((i, el) => {
        if (news.length >= limit) return false;
        const href = $(el).attr('href') || '';
        const text = $(el).text().trim();
        if (href.includes('/RECALL/') && href.includes('.html') && !href.includes('index') && text.length > 5) {
          news.push({
            maker,
            title: text.slice(0, 80),
            date: '',
            url: href.startsWith('http') ? href : `https://www.nissan.co.jp${href}`,
          });
        }
      });
      break;

    case 'ホンダ':
      // ホンダのリコール一覧をパース
      $('a').each((i, el) => {
        if (news.length >= limit) return false;
        const href = $(el).attr('href') || '';
        const text = $(el).text().trim();
        if (href.includes('/recall/') && href.includes('.html') && !href.includes('index') && text.length > 5) {
          const dateMatch = text.match(/(\d{4})[\/年](\d{1,2})[\/月](\d{1,2})/);
          news.push({
            maker,
            title: text.replace(/\d{4}[\/年]\d{1,2}[\/月]\d{1,2}[日]?\s*/, '').trim().slice(0, 80),
            date: dateMatch ? `${dateMatch[1]}/${dateMatch[2]}/${dateMatch[3]}` : '',
            url: href.startsWith('http') ? href : `https://www.honda.co.jp${href}`,
          });
        }
      });
      break;

    case 'マツダ':
      // マツダのリコール一覧をパース
      $('a').each((i, el) => {
        if (news.length >= limit) return false;
        const href = $(el).attr('href') || '';
        const text = $(el).text().trim();
        if (href.includes('/recall/') && (href.includes('.html') || href.includes('.pdf')) && !href.includes('index') && text.length > 5) {
          news.push({
            maker,
            title: text.slice(0, 80),
            date: '',
            url: href.startsWith('http') ? href : `https://www.mazda.co.jp${href}`,
          });
        }
      });
      break;

    case 'スバル':
      // スバルのリコール一覧をパース
      $('a').each((i, el) => {
        if (news.length >= limit) return false;
        const href = $(el).attr('href') || '';
        const text = $(el).text().trim();
        if (href.includes('/recall/') && href.includes('.html') && !href.includes('index') && text.length > 5) {
          const dateMatch = text.match(/(\d{4})[\/年](\d{1,2})[\/月](\d{1,2})/);
          news.push({
            maker,
            title: text.replace(/\d{4}[\/年]\d{1,2}[\/月]\d{1,2}[日]?\s*/, '').trim().slice(0, 80),
            date: dateMatch ? `${dateMatch[1]}/${dateMatch[2]}/${dateMatch[3]}` : '',
            url: href.startsWith('http') ? href : `https://www.subaru.co.jp${href}`,
          });
        }
      });
      break;

    case 'ダイハツ':
      // ダイハツのリコール一覧をパース
      $('a').each((i, el) => {
        if (news.length >= limit) return false;
        const href = $(el).attr('href') || '';
        const text = $(el).text().trim();
        if (href.includes('/recall/') && href.match(/\d+\.htm/) && text.length > 5) {
          news.push({
            maker,
            title: text.slice(0, 80),
            date: '',
            url: href.startsWith('http') ? href : `https://www.daihatsu.co.jp${href}`,
          });
        }
      });
      break;
  }

  return news;
}
