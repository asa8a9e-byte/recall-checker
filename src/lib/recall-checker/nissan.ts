// src/lib/recall-checker/nissan.ts

import { chromium, Browser } from 'playwright';
import * as cheerio from 'cheerio';
import { RecallCheckResult, RecallInfo } from '@/types';
import { splitChassisNumber } from './index';

const NISSAN_RECALL_URL = 'https://www.nissan.co.jp/RECALL/search.html';

// 開発モード
const DEV_MODE = false;

export async function checkNissanRecall(chassisNumber: string): Promise<RecallCheckResult> {
  // 開発モードではモックデータを返す
  if (DEV_MODE) {
    return getMockResult(chassisNumber);
  }

  const [prefix, suffix] = splitChassisNumber(chassisNumber);

  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    });

    const page = await context.newPage();

    await page.goto(NISSAN_RECALL_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3000);

    // 日産のフォームに入力（frameno=型式, chassino=シリアル）
    await page.fill('input[name="frameno"]', prefix);
    await page.fill('input[name="chassino"]', suffix);

    // 検索ボタンをクリック
    await page.click('button:has-text("検索")');
    await page.waitForTimeout(5000);

    const html = await page.content();
    const recalls = parseNissanResults(html);

    return {
      chassisNumber,
      maker: '日産',
      hasRecall: recalls.length > 0,
      recalls,
      checkedAt: new Date().toISOString(),
      cached: false
    };

  } catch (error) {
    console.error('日産リコールチェックエラー:', error);
    throw new Error(`日産のリコール検索に失敗しました: ${error}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// 開発用モックデータ
function getMockResult(chassisNumber: string): RecallCheckResult {
  const hasRecall = chassisNumber.includes('1');

  const mockRecalls: RecallInfo[] = hasRecall ? [
    {
      id: 'nissan-mock-1',
      recallId: 'N2024-001',
      title: '燃料ポンプ不具合',
      description: '燃料ポンプに不具合があり、エンジンが停止する可能性があります。',
      severity: 'high',
      status: 'pending',
      publishedAt: '2024-11-01'
    }
  ] : [];

  return {
    chassisNumber,
    maker: '日産',
    hasRecall,
    recalls: mockRecalls,
    checkedAt: new Date().toISOString(),
    cached: false
  };
}

function parseNissanResults(html: string): RecallInfo[] {
  const $ = cheerio.load(html);
  const recalls: RecallInfo[] = [];
  const bodyText = $('body').text();

  // リコールなしの場合
  if (bodyText.includes('該当するリコールはありません') ||
      bodyText.includes('対象車両はありません')) {
    return [];
  }

  // リコールリンクを探す（javascript:pop('/RECALL/DATA/xxx.html')形式）
  $('a').each((index, element) => {
    const $link = $(element);
    const href = $link.attr('href') || '';
    const text = $link.text().trim();

    // リコール詳細ページへのリンクを検出
    if (href.includes('/RECALL/DATA/') && text) {
      // URLを抽出
      const urlMatch = href.match(/\/RECALL\/DATA\/[^'"]+\.html/);
      const detailUrl = urlMatch ? `https://www.nissan.co.jp${urlMatch[0]}` : '';

      // リコールか改善対策かサービスキャンペーンかを判定
      const isRecall = text.includes('リコール');
      const isCampaign = text.includes('サービスキャンペーン');

      recalls.push({
        id: `nissan-${index}`,
        recallId: urlMatch ? urlMatch[0].replace(/.*\//, '').replace('.html', '') : `N${Date.now()}-${index}`,
        title: text,
        description: detailUrl ? `詳細: ${detailUrl}` : '',
        severity: isRecall ? 'high' : isCampaign ? 'low' : 'medium',
        status: 'pending',
        publishedAt: new Date().toISOString().split('T')[0]
      });
    }
  });

  return recalls;
}
