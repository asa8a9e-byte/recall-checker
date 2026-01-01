// src/lib/recall-checker/nissan.ts
// Vercel対応: fetch版

import * as cheerio from 'cheerio';
import { RecallCheckResult, RecallInfo } from '@/types';
import { splitChassisNumber } from './index';

const NISSAN_RECALL_URL = 'https://www.nissan.co.jp/RECALL/search.html';

export async function checkNissanRecall(chassisNumber: string): Promise<RecallCheckResult> {
  const [prefix, suffix] = splitChassisNumber(chassisNumber);

  try {
    // フォームデータを作成
    const formData = new URLSearchParams();
    formData.append('frameno', prefix);
    formData.append('chassino', suffix);

    const response = await fetch(NISSAN_RECALL_URL, {
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

    // Shift-JIS対応
    const buffer = await response.arrayBuffer();
    const decoder = new TextDecoder('shift-jis');
    const html = decoder.decode(buffer);

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

    return {
      chassisNumber,
      maker: '日産',
      hasRecall: false,
      recalls: [{
        id: 'nissan-manual-check',
        recallId: 'MANUAL',
        title: '公式サイトで確認が必要です',
        description: `自動検索に失敗しました。日産公式サイトで直接ご確認ください: ${NISSAN_RECALL_URL}`,
        severity: 'medium',
        status: 'pending',
        publishedAt: new Date().toISOString().split('T')[0]
      }],
      checkedAt: new Date().toISOString(),
      cached: false
    };
  }
}

function parseNissanResults(html: string): RecallInfo[] {
  const $ = cheerio.load(html);
  const recalls: RecallInfo[] = [];
  const bodyText = $('body').text();

  // リコールなしの場合
  if (bodyText.includes('該当するリコールはありません') ||
      bodyText.includes('対象車両はありません') ||
      bodyText.includes('該当なし')) {
    return [];
  }

  // リコールリンクを探す
  $('a').each((index, element) => {
    const $link = $(element);
    const href = $link.attr('href') || '';
    const text = $link.text().trim();

    if (href.includes('/RECALL/DATA/') && text) {
      const urlMatch = href.match(/\/RECALL\/DATA\/[^'"]+\.html/);
      const detailUrl = urlMatch ? `https://www.nissan.co.jp${urlMatch[0]}` : '';

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
