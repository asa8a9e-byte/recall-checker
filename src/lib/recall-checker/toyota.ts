// src/lib/recall-checker/toyota.ts

import { chromium, Browser } from 'playwright';
import * as cheerio from 'cheerio';
import { RecallCheckResult, RecallInfo } from '@/types';
import { splitChassisNumber } from './index';

const TOYOTA_RECALL_URL = 'https://www.toyota.co.jp/recall-search/dc/search';

// 開発モード: 実際のスクレイピングをスキップしてモックデータを返す
// 本番スクレイピングを有効にするには false に設定
const DEV_MODE = false;

// トヨタのリコール検索
export async function checkToyotaRecall(chassisNumber: string): Promise<RecallCheckResult> {
  // 開発モードではモックデータを返す
  if (DEV_MODE) {
    return getMockResult(chassisNumber, 'トヨタ');
  }

  const [prefix, suffix] = splitChassisNumber(chassisNumber);

  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    const page = await context.newPage();

    // トヨタのリコール検索ページへアクセス
    await page.goto(TOYOTA_RECALL_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3000);

    // フォームに入力（FRAME_DIV=型式部分, FRAME_NO=シリアル番号）
    await page.fill('input[name="FRAME_DIV"]', prefix);
    await page.fill('input[name="FRAME_NO"]', suffix);

    // 検索ボタンをクリック
    await page.click('input[name="imageField"]');

    // 結果が表示されるまで待機
    await page.waitForTimeout(5000);

    // 結果HTMLを取得
    const html = await page.content();
    const resultUrl = page.url(); // 結果ページのURLを保存

    // 結果をパース
    const recalls = parseRecallResults(html, resultUrl);

    return {
      chassisNumber,
      maker: 'トヨタ',
      hasRecall: recalls.length > 0,
      recalls,
      checkedAt: new Date().toISOString(),
      cached: false
    };

  } catch (error) {
    console.error('トヨタリコールチェックエラー:', error);
    throw new Error(`トヨタのリコール検索に失敗しました: ${error}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// 開発用モックデータ
function getMockResult(chassisNumber: string, maker: string): RecallCheckResult {
  // ランダムでリコールあり/なしを返す（デモ用）
  const hasRecall = chassisNumber.length % 2 === 0;

  const mockRecalls: RecallInfo[] = hasRecall ? [
    {
      id: 'mock-1',
      recallId: 'R2024-001',
      title: 'エアバッグインフレータ不具合',
      description: 'エアバッグのインフレータに不具合があり、衝突時に正常に展開しない可能性があります。',
      severity: 'high',
      status: 'pending',
      publishedAt: '2024-10-15'
    },
    {
      id: 'mock-2',
      recallId: 'R2024-002',
      title: 'ブレーキブースター不具合',
      description: 'ブレーキブースターに不具合があり、ブレーキの効きが悪くなる可能性があります。',
      severity: 'medium',
      status: 'completed',
      publishedAt: '2024-08-20'
    }
  ] : [];

  return {
    chassisNumber,
    maker,
    hasRecall,
    recalls: mockRecalls,
    checkedAt: new Date().toISOString(),
    cached: false
  };
}

// 結果HTMLをパース
function parseRecallResults(html: string, resultUrl: string = ''): RecallInfo[] {
  const $ = cheerio.load(html);
  const recalls: RecallInfo[] = [];
  const bodyText = $('body').text();

  // リコールなしメッセージのチェック
  if (bodyText.includes('リコール等の対象はなく') ||
      bodyText.includes('修理のためにご入庫いただく必要はありません')) {
    return [];
  }

  // リコール情報がある場合（テーブル形式で表示される）
  // トヨタの結果ページではテーブルでリコール情報が表示される
  $('table tr').each((index, element) => {
    if (index === 0) return; // ヘッダー行をスキップ

    const $row = $(element);
    const cells = $row.find('td');

    if (cells.length >= 2) {
      const title = $(cells[1]).text().trim();
      const dateText = $(cells[0]).text().trim();

      if (title) {
        recalls.push({
          id: `toyota-${index}`,
          recallId: `T${Date.now()}-${index}`,
          title,
          description: resultUrl ? `詳細: ${resultUrl}` : $(cells[2])?.text().trim() || '',
          severity: determineSeverity(title),
          status: bodyText.includes('実施済') ? 'completed' : 'pending',
          publishedAt: dateText || new Date().toISOString().split('T')[0]
        });
      }
    }
  });

  // テーブルがない場合、テキストからリコール情報を抽出
  if (recalls.length === 0 && bodyText.includes('リコール')) {
    // リコール対象の可能性がある場合
    const hasRecallContent = !bodyText.includes('対象はなく');
    if (hasRecallContent) {
      recalls.push({
        id: 'toyota-unknown',
        recallId: `T${Date.now()}`,
        title: 'リコール対象の可能性があります',
        description: resultUrl ? `詳細: ${resultUrl}` : '詳細は公式サイトでご確認ください',
        severity: 'medium',
        status: 'pending',
        publishedAt: new Date().toISOString().split('T')[0]
      });
    }
  }

  return recalls;
}

// 重要度を判定
function determineSeverity(text: string): 'high' | 'medium' | 'low' {
  const lowerText = text.toLowerCase();
  
  if (lowerText.includes('重要') || lowerText.includes('緊急') || lowerText.includes('エアバッグ')) {
    return 'high';
  }
  if (lowerText.includes('注意')) {
    return 'medium';
  }
  return 'low';
}
