// src/lib/recall-checker/toyota.ts
// Vercel対応: fetch版

import * as cheerio from 'cheerio';
import { RecallCheckResult, RecallInfo } from '@/types';
import { splitChassisNumber } from './index';

const TOYOTA_RECALL_URL = 'https://www.toyota.co.jp/recall-search/dc/search';

// トヨタのリコール検索（fetch版）
export async function checkToyotaRecall(chassisNumber: string): Promise<RecallCheckResult> {
  const [prefix, suffix] = splitChassisNumber(chassisNumber);

  try {
    // フォームデータを作成
    const formData = new URLSearchParams();
    formData.append('FRAME_DIV', prefix);
    formData.append('FRAME_NO', suffix);

    // POSTリクエストを送信
    const response = await fetch(TOYOTA_RECALL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en;q=0.9',
        'Origin': 'https://www.toyota.co.jp',
        'Referer': TOYOTA_RECALL_URL,
      },
      body: formData.toString(),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const recalls = parseRecallResults(html, response.url);

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

    // フォールバック: 公式サイトへ案内
    return {
      chassisNumber,
      maker: 'トヨタ',
      hasRecall: false,
      recalls: [{
        id: 'toyota-manual-check',
        recallId: 'MANUAL',
        title: '公式サイトで確認が必要です',
        description: `自動検索に失敗しました。トヨタ公式サイトで直接ご確認ください: ${TOYOTA_RECALL_URL}`,
        severity: 'medium',
        status: 'pending',
        publishedAt: new Date().toISOString().split('T')[0]
      }],
      checkedAt: new Date().toISOString(),
      cached: false
    };
  }
}

// 結果HTMLをパース
function parseRecallResults(html: string, resultUrl: string = ''): RecallInfo[] {
  const $ = cheerio.load(html);
  const recalls: RecallInfo[] = [];
  const bodyText = $('body').text();

  // リコールなしメッセージのチェック
  if (bodyText.includes('リコール等の対象はなく') ||
      bodyText.includes('修理のためにご入庫いただく必要はありません') ||
      bodyText.includes('該当するリコール等はありません')) {
    return [];
  }

  // リコール情報がある場合（テーブル形式で表示される）
  $('table tr').each((index, element) => {
    if (index === 0) return; // ヘッダー行をスキップ

    const $row = $(element);
    const cells = $row.find('td');

    if (cells.length >= 2) {
      const title = $(cells[1]).text().trim();
      const dateText = $(cells[0]).text().trim();

      if (title && title.length > 3) {
        recalls.push({
          id: `toyota-${index}`,
          recallId: `T${Date.now()}-${index}`,
          title,
          description: $(cells[2])?.text().trim() || '',
          severity: determineSeverity(title),
          status: bodyText.includes('実施済') ? 'completed' : 'pending',
          publishedAt: dateText || new Date().toISOString().split('T')[0]
        });
      }
    }
  });

  // テーブルがない場合、リコール対象かどうかテキストで判定
  if (recalls.length === 0) {
    // リコール対象の可能性がある場合
    if (bodyText.includes('リコール対象') ||
        (bodyText.includes('リコール') && !bodyText.includes('対象はなく') && !bodyText.includes('該当するリコール等はありません'))) {
      recalls.push({
        id: 'toyota-possible',
        recallId: `T${Date.now()}`,
        title: 'リコール対象の可能性があります',
        description: `詳細は公式サイトでご確認ください: ${TOYOTA_RECALL_URL}`,
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

  if (lowerText.includes('重要') || lowerText.includes('緊急') ||
      lowerText.includes('エアバッグ') || lowerText.includes('ブレーキ')) {
    return 'high';
  }
  if (lowerText.includes('注意')) {
    return 'medium';
  }
  return 'low';
}
