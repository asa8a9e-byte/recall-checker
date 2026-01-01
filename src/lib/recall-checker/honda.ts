// src/lib/recall-checker/honda.ts
// Vercel対応: fetch版

import * as cheerio from 'cheerio';
import { RecallCheckResult, RecallInfo } from '@/types';
import { splitChassisNumber } from './index';

const HONDA_RECALL_URL = 'https://recallsearch4.honda.co.jp/sqs/r001/R00101.do';

export async function checkHondaRecall(chassisNumber: string): Promise<RecallCheckResult> {
  const [prefix, suffix] = splitChassisNumber(chassisNumber);

  try {
    // フォームデータを作成
    const formData = new URLSearchParams();
    formData.append('fn', 'search.exec');
    formData.append('syadai_no1', prefix);
    formData.append('syadai_no2', suffix);

    const response = await fetch(HONDA_RECALL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en;q=0.9',
      },
      body: formData.toString(),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
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

    return {
      chassisNumber,
      maker: 'ホンダ',
      hasRecall: false,
      recalls: [{
        id: 'honda-manual-check',
        recallId: 'MANUAL',
        title: '公式サイトで確認が必要です',
        description: `自動検索に失敗しました。ホンダ公式サイトで直接ご確認ください: https://recallsearch4.honda.co.jp/sqs/r001/R00101.do?fn=link.disp`,
        severity: 'medium',
        status: 'pending',
        publishedAt: new Date().toISOString().split('T')[0]
      }],
      checkedAt: new Date().toISOString(),
      cached: false
    };
  }
}

function parseHondaResults(html: string): RecallInfo[] {
  const $ = cheerio.load(html);
  const recalls: RecallInfo[] = [];
  const bodyText = $('body').text();

  // リコールなしのチェック
  if (bodyText.includes('リコールや改善対策の実施履歴はございません') &&
      !bodyText.includes('未実施')) {
    return [];
  }

  if (bodyText.includes('該当なし') || bodyText.includes('対象外')) {
    return [];
  }

  // リコールリンクを探す
  $('a').each((index, element) => {
    const $link = $(element);
    const href = $link.attr('href') || '';
    const text = $link.text().trim();

    if (href.includes('honda.co.jp/recall/') && href.includes('.html') && text) {
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

  // 未実施リコールがある場合
  if (recalls.length === 0 && bodyText.includes('未実施')) {
    recalls.push({
      id: 'honda-unknown',
      recallId: `H${Date.now()}`,
      title: 'リコール対象です',
      description: '詳細は公式サイトでご確認ください',
      severity: 'high',
      status: 'pending',
      publishedAt: new Date().toISOString().split('T')[0]
    });
  }

  return recalls;
}

function extractDate(text: string): string | null {
  const match = text.match(/(\d{4})[\/年](\d{1,2})[\/月](\d{1,2})/);
  if (match) {
    const [, year, month, day] = match;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return null;
}
