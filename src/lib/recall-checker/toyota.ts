// src/lib/recall-checker/toyota.ts
// Vercel対応: fetch版

import * as cheerio from 'cheerio';
import { RecallCheckResult, RecallInfo } from '@/types';
import { splitChassisNumber } from './index';

const TOYOTA_SEARCH_URL = 'https://www.toyota.co.jp/recall-search/dc/search';
const TOYOTA_RESULT_URL = 'https://www.toyota.co.jp/recall-search/dc/result';

// トヨタのリコール検索（fetch版）
export async function checkToyotaRecall(chassisNumber: string): Promise<RecallCheckResult> {
  const [prefix, suffix] = splitChassisNumber(chassisNumber);

  try {
    // フォームデータを作成（フォームのaction='result'に送信）
    const formData = new URLSearchParams();
    formData.append('FRAME_DIV', prefix);
    formData.append('FRAME_NO', suffix);

    // 結果ページにPOSTリクエストを送信
    const response = await fetch(TOYOTA_RESULT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en;q=0.9',
        'Origin': 'https://www.toyota.co.jp',
        'Referer': TOYOTA_SEARCH_URL,
      },
      body: formData.toString(),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const recalls = parseRecallResults(html, chassisNumber);

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
        description: `トヨタ公式サイトで直接ご確認ください`,
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
function parseRecallResults(html: string, chassisNumber: string): RecallInfo[] {
  const $ = cheerio.load(html);
  const recalls: RecallInfo[] = [];
  const bodyText = $('body').text();

  // リコールなしメッセージのチェック
  if (bodyText.includes('リコール等の対象はなく') ||
      bodyText.includes('修理のためにご入庫いただく必要はありません') ||
      bodyText.includes('該当するリコール等はありません')) {
    return [];
  }

  // リコール詳細リンクを探す（toyota.jp/recall/YYYY/MMDD.html形式）
  $('a[href*="/recall/"]').each((index, element) => {
    const $link = $(element);
    const href = $link.attr('href') || '';
    const text = $link.text().trim();

    // リコール詳細ページへのリンクを検出
    if (href.match(/\/recall\/\d{4}\/\d+\.html/) && text.length > 5) {
      const fullUrl = href.startsWith('http') ? href : `https://toyota.jp${href}`;

      // 親要素から日付を取得
      const $row = $link.closest('tr');
      const dateText = $row.find('td:first-child').text().trim();

      recalls.push({
        id: `toyota-${index}`,
        recallId: href.match(/(\d+)\.html$/)?.[1] || `T${Date.now()}-${index}`,
        title: text,
        description: fullUrl,
        severity: determineSeverity(text),
        status: bodyText.includes('実施済') ? 'completed' : 'pending',
        publishedAt: dateText || new Date().toISOString().split('T')[0]
      });
    }
  });

  // リンクが見つからない場合、テーブルから情報を抽出
  if (recalls.length === 0) {
    $('table tr').each((index, element) => {
      if (index === 0) return;

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
            description: '',
            severity: determineSeverity(title),
            status: bodyText.includes('実施済') ? 'completed' : 'pending',
            publishedAt: dateText || new Date().toISOString().split('T')[0]
          });
        }
      }
    });
  }

  // それでも見つからないが、リコール対象の可能性がある場合
  if (recalls.length === 0 && bodyText.includes('リコール') &&
      !bodyText.includes('対象はなく') && !bodyText.includes('該当するリコール等はありません')) {
    recalls.push({
      id: 'toyota-possible',
      recallId: `T${Date.now()}`,
      title: 'リコール対象の可能性があります',
      description: '',
      severity: 'medium',
      status: 'pending',
      publishedAt: new Date().toISOString().split('T')[0]
    });
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
