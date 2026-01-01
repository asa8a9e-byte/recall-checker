// src/lib/recall-checker/honda.ts

import { chromium, Browser } from 'playwright';
import * as cheerio from 'cheerio';
import { RecallCheckResult, RecallInfo } from '@/types';
import { splitChassisNumber } from './index';

const HONDA_RECALL_URL = 'https://recallsearch4.honda.co.jp/sqs/r001/R00101.do?fn=link.disp';

// 開発モード
const DEV_MODE = false;

export async function checkHondaRecall(chassisNumber: string): Promise<RecallCheckResult> {
  // 開発モードではモックデータを返す
  if (DEV_MODE) {
    return getMockResult(chassisNumber);
  }

  // 車台番号を分割（ZC8-1000001 -> ZC8, 1000001）
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

    await page.goto(HONDA_RECALL_URL, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(2000);

    // ホンダは2つの入力欄（syadai_no1=型式, syadai_no2=シリアル）
    await page.fill('#syadai_no1', prefix);
    await page.fill('#syadai_no2', suffix);
    await page.waitForTimeout(1000);

    // 検索ボタン（画像）をクリック
    await page.click('img[src*="kensaku_button"]');
    await page.waitForTimeout(5000);

    const html = await page.content();
    const recalls = parseHondaResults(html);

    return {
      chassisNumber,
      maker: 'ホンダ',
      hasRecall: recalls.length > 0,
      recalls,
      checkedAt: new Date().toISOString(),
      cached: false
    };

  } catch (error) {
    console.error('ホンダリコールチェックエラー:', error);
    throw new Error(`ホンダのリコール検索に失敗しました: ${error}`);
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
      id: 'honda-mock-1',
      recallId: 'H2024-001',
      title: 'パワーステアリング不具合',
      description: 'パワーステアリングに不具合があり、ハンドル操作が重くなる可能性があります。',
      severity: 'medium',
      status: 'pending',
      publishedAt: '2024-09-15'
    }
  ] : [];

  return {
    chassisNumber,
    maker: 'ホンダ',
    hasRecall,
    recalls: mockRecalls,
    checkedAt: new Date().toISOString(),
    cached: false
  };
}

function parseHondaResults(html: string): RecallInfo[] {
  const $ = cheerio.load(html);
  const recalls: RecallInfo[] = [];
  const bodyText = $('body').text();

  // リコールなし（履歴もなし）のチェック
  if (bodyText.includes('リコールや改善対策の実施履歴はございません') &&
      !bodyText.includes('未実施')) {
    return [];
  }

  // リコールリンクを探す（honda.co.jp/recall/auto/info/xxx.html形式）
  $('a').each((index, element) => {
    const $link = $(element);
    const href = $link.attr('href') || '';
    const text = $link.text().trim();

    // リコール詳細ページへのリンクを検出
    if (href.includes('honda.co.jp/recall/') && href.includes('.html') && text) {
      // 区分（リコール/改善対策/サービスキャンペーン）を取得
      const $row = $link.closest('tr');
      const category = $row.find('td:first-child').text().trim() || 'リコール';
      const dateText = $row.find('td:nth-child(2)').text().trim();

      recalls.push({
        id: `honda-${index}`,
        recallId: href.match(/info\/([^.]+)\.html/)?.[1] || `H${Date.now()}-${index}`,
        title: text,
        description: `詳細: ${href}`,
        severity: category.includes('リコール') ? 'high' : category.includes('改善') ? 'medium' : 'low',
        status: bodyText.includes('未実施') ? 'pending' : 'completed',
        publishedAt: extractDate(dateText) || new Date().toISOString().split('T')[0]
      });
    }
  });

  // リンクが見つからないが未実施リコールがある場合
  if (recalls.length === 0 && bodyText.includes('未実施')) {
    recalls.push({
      id: 'honda-unknown',
      recallId: `H${Date.now()}`,
      title: 'リコール対象です',
      description: '詳細: https://recallsearch4.honda.co.jp/sqs/r001/R00101.do?fn=link.disp',
      severity: 'high',
      status: 'pending',
      publishedAt: new Date().toISOString().split('T')[0]
    });
  }

  return recalls;
}

function determineSeverity(text: string): 'high' | 'medium' | 'low' {
  if (text.includes('エアバッグ') || text.includes('ブレーキ') || text.includes('火災')) {
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
