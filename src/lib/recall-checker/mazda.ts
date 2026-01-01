// src/lib/recall-checker/mazda.ts

import { chromium, Browser } from 'playwright';
import * as cheerio from 'cheerio';
import { RecallCheckResult, RecallInfo } from '@/types';
import { splitChassisNumber } from './index';

const MAZDA_RECALL_URL = 'https://www2.mazda.co.jp/service/recall/vsearch';

// 開発モード
const DEV_MODE = false;

export async function checkMazdaRecall(chassisNumber: string): Promise<RecallCheckResult> {
  // 開発モードではモックデータを返す
  if (DEV_MODE) {
    return getMockResult(chassisNumber);
  }

  // 車台番号を分割（DY3W-399999 -> DY3W, 399999）
  const [prefix, suffix] = splitChassisNumber(chassisNumber);

  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    const page = await context.newPage();

    await page.goto(MAZDA_RECALL_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3000);

    // マツダは2つの入力欄（vin1=型式, vin2=シリアル）
    await page.fill('input[name="vin1"]', prefix);
    await page.fill('input[name="vin2"]', suffix);
    await page.waitForTimeout(1000);

    // 検索ボタンをクリック（複数あるので最後のものを使用）
    const searchButton = page.locator('button[type="submit"]:has-text("検索")').last();
    await searchButton.click();
    await page.waitForTimeout(5000);

    const html = await page.content();
    const resultUrl = page.url();
    const recalls = parseMazdaResults(html, resultUrl);

    return {
      chassisNumber,
      maker: 'マツダ',
      hasRecall: recalls.length > 0,
      recalls,
      checkedAt: new Date().toISOString(),
      cached: false
    };

  } catch (error) {
    console.error('マツダリコールチェックエラー:', error);
    throw new Error(`マツダのリコール検索に失敗しました: ${error}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// 開発用モックデータ
function getMockResult(chassisNumber: string): RecallCheckResult {
  const hasRecall = !chassisNumber.includes('0');

  const mockRecalls: RecallInfo[] = hasRecall ? [
    {
      id: 'mazda-mock-1',
      recallId: 'M2024-001',
      title: 'ブレーキホース不具合',
      description: 'ブレーキホースに不具合があり、ブレーキ液が漏れる可能性があります。',
      severity: 'high',
      status: 'pending',
      publishedAt: '2024-09-15'
    }
  ] : [];

  return {
    chassisNumber,
    maker: 'マツダ',
    hasRecall,
    recalls: mockRecalls,
    checkedAt: new Date().toISOString(),
    cached: false
  };
}

function parseMazdaResults(html: string, resultUrl: string = ''): RecallInfo[] {
  const $ = cheerio.load(html);
  const recalls: RecallInfo[] = [];
  const bodyText = $('body').text();

  // リコールなしのチェック
  if (bodyText.includes('該当するリコール等の情報はありませんでした')) {
    return [];
  }

  // リコールリンクを探す（mazda.co.jp/recall/形式）
  $('a').each((index, element) => {
    const $link = $(element);
    const href = $link.attr('href') || '';
    const text = $link.text().trim();

    // リコール詳細ページへのリンクを検出
    if ((href.includes('/recall/') || href.includes('/RECALL/')) &&
        (href.includes('.html') || href.includes('.pdf')) &&
        text &&
        !href.includes('vsearch') &&
        !href.includes('list.html') &&
        !href.includes('other.html')) {

      const fullUrl = href.startsWith('http') ? href : `https://www2.mazda.co.jp${href}`;

      recalls.push({
        id: `mazda-${index}`,
        recallId: href.match(/([^/]+)\.(html|pdf)$/)?.[1] || `M${Date.now()}-${index}`,
        title: text,
        description: `詳細: ${fullUrl}`,
        severity: determineSeverity(text),
        status: 'pending',
        publishedAt: new Date().toISOString().split('T')[0]
      });
    }
  });

  // テーブル形式のリコール情報を探す
  if (recalls.length === 0) {
    $('table tr').each((index, element) => {
      if (index === 0) return; // ヘッダー行をスキップ

      const $row = $(element);
      const cells = $row.find('td');

      if (cells.length >= 2) {
        const title = $(cells[1]).text().trim();
        const dateText = $(cells[0]).text().trim();

        if (title && !title.includes('リコール等情報検索')) {
          recalls.push({
            id: `mazda-${index}`,
            recallId: `M${Date.now()}-${index}`,
            title,
            description: resultUrl ? `詳細: ${resultUrl}` : '',
            severity: determineSeverity(title),
            status: 'pending',
            publishedAt: extractDate(dateText) || new Date().toISOString().split('T')[0]
          });
        }
      }
    });
  }

  // リコールの可能性があるがパースできなかった場合
  if (recalls.length === 0 && bodyText.includes('リコール') && !bodyText.includes('ありませんでした')) {
    recalls.push({
      id: 'mazda-unknown',
      recallId: `M${Date.now()}`,
      title: 'リコール対象の可能性があります',
      description: resultUrl ? `詳細: ${resultUrl}` : `詳細: ${MAZDA_RECALL_URL}`,
      severity: 'medium',
      status: 'pending',
      publishedAt: new Date().toISOString().split('T')[0]
    });
  }

  return recalls;
}

function determineSeverity(text: string): 'high' | 'medium' | 'low' {
  if (text.includes('エアバッグ') || text.includes('ブレーキ') || text.includes('火災') || text.includes('リコール')) {
    return 'high';
  }
  if (text.includes('改善対策')) {
    return 'medium';
  }
  return 'low';
}

function extractDate(text: string): string | null {
  // YYYY/MM/DD または YYYY年MM月DD日 形式を抽出
  const match = text.match(/(\d{4})[\/年](\d{1,2})[\/月](\d{1,2})/);
  if (match) {
    const [, year, month, day] = match;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return null;
}
