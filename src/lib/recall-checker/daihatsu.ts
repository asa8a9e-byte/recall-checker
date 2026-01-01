// src/lib/recall-checker/daihatsu.ts
// Vercel対応: fetch版

import * as cheerio from 'cheerio';
import { RecallCheckResult, RecallInfo } from '@/types';
import { splitChassisNumber } from './index';

const DAIHATSU_RECALL_URL = 'https://www.daihatsu.co.jp/info/recall/search/recall_search.php';

export async function checkDaihatsuRecall(chassisNumber: string): Promise<RecallCheckResult> {
  const [prefix, suffix] = splitChassisNumber(chassisNumber);

  try {
    const formData = new URLSearchParams();
    formData.append('model_no', prefix);
    formData.append('car_no', suffix);

    const response = await fetch(DAIHATSU_RECALL_URL, {
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
    const recalls = parseDaihatsuResults(html);

    return {
      chassisNumber,
      maker: 'ダイハツ',
      hasRecall: recalls.length > 0,
      recalls,
      checkedAt: new Date().toISOString(),
      cached: false
    };

  } catch (error) {
    console.error('ダイハツリコールチェックエラー:', error);

    return {
      chassisNumber,
      maker: 'ダイハツ',
      hasRecall: false,
      recalls: [{
        id: 'daihatsu-manual-check',
        recallId: 'MANUAL',
        title: '公式サイトで確認が必要です',
        description: `自動検索に失敗しました。ダイハツ公式サイトで直接ご確認ください: https://www.daihatsu.co.jp/service/recall/`,
        severity: 'medium',
        status: 'pending',
        publishedAt: new Date().toISOString().split('T')[0]
      }],
      checkedAt: new Date().toISOString(),
      cached: false
    };
  }
}

function parseDaihatsuResults(html: string): RecallInfo[] {
  const $ = cheerio.load(html);
  const recalls: RecallInfo[] = [];
  const bodyText = $('body').text();

  if (bodyText.includes('対象ではありません') ||
      bodyText.includes('該当なし')) {
    return [];
  }

  let recallIndex = 0;
  $('a').each((index, element) => {
    const $link = $(element);
    const href = $link.attr('href') || '';
    const text = $link.text().trim();

    if (href.includes('/info/recall/') && href.match(/\d+\.htm$/) && text) {
      const fullUrl = href.startsWith('http') ? href : `https://www.daihatsu.co.jp${href}`;
      const $row = $link.closest('tr');
      const cells = $row.find('td');

      let category = '';
      let statusText = '';

      if (cells.length >= 4) {
        category = $(cells[1]).text().trim();
        statusText = $(cells[3]).text().trim();
      }

      recalls.push({
        id: `daihatsu-${recallIndex}`,
        recallId: href.match(/(\d+)\.htm$/)?.[1] || `D${Date.now()}-${recallIndex}`,
        title: category ? `${category}: ${text}` : text,
        description: `詳細: ${fullUrl}`,
        severity: category.includes('リコール') ? 'high' : 'medium',
        status: statusText.includes('修理済') ? 'completed' : 'pending',
        publishedAt: new Date().toISOString().split('T')[0]
      });
      recallIndex++;
    }
  });

  return recalls;
}
