// src/lib/recall-checker/subaru.ts
// Vercel対応: fetch版

import * as cheerio from 'cheerio';
import { RecallCheckResult, RecallInfo } from '@/types';
import { splitChassisNumber } from './index';

const SUBARU_RECALL_URL = 'https://recall.subaru.co.jp/lqsb/';

export async function checkSubaruRecall(chassisNumber: string): Promise<RecallCheckResult> {
  const [prefix, suffix] = splitChassisNumber(chassisNumber);

  try {
    const formData = new URLSearchParams();
    formData.append('txtCarNoKami', prefix);
    formData.append('txtCarNoShimo', suffix);
    formData.append('btnSearch', '検索');

    const response = await fetch(SUBARU_RECALL_URL, {
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
    const recalls = parseSubaruResults(html);

    return {
      chassisNumber,
      maker: 'スバル',
      hasRecall: recalls.length > 0,
      recalls,
      checkedAt: new Date().toISOString(),
      cached: false
    };

  } catch (error) {
    console.error('スバルリコールチェックエラー:', error);

    return {
      chassisNumber,
      maker: 'スバル',
      hasRecall: false,
      recalls: [{
        id: 'subaru-manual-check',
        recallId: 'MANUAL',
        title: '公式サイトで確認が必要です',
        description: `自動検索に失敗しました。スバル公式サイトで直接ご確認ください: https://www.subaru.jp/recall/`,
        severity: 'medium',
        status: 'pending',
        publishedAt: new Date().toISOString().split('T')[0]
      }],
      checkedAt: new Date().toISOString(),
      cached: false
    };
  }
}

function parseSubaruResults(html: string): RecallInfo[] {
  const $ = cheerio.load(html);
  const recalls: RecallInfo[] = [];
  const bodyText = $('body').text();

  if (bodyText.includes('対象のリコール等はございません') ||
      bodyText.includes('該当なし')) {
    return [];
  }

  let recallIndex = 0;
  $('a').each((index, element) => {
    const $link = $(element);
    const href = $link.attr('href') || '';
    const text = $link.text().trim();

    const urlMatch = href.match(/popup\d*\(['"]([^'"]+)['"]\)/);
    if (urlMatch && text) {
      const detailUrl = urlMatch[1];
      const $row = $link.closest('tr');
      const cells = $row.find('td');

      let statusText = '';
      let category = '';

      if (cells.length >= 3) {
        statusText = $(cells[1]).text().trim();
        category = $(cells[2]).text().trim();
      }

      recalls.push({
        id: `subaru-${recallIndex}`,
        recallId: detailUrl.match(/([^/]+)\.html$/)?.[1] || `S${Date.now()}-${recallIndex}`,
        title: category ? `${category}: ${text}` : text,
        description: `詳細: ${detailUrl}`,
        severity: category.includes('リコール') ? 'high' : 'medium',
        status: statusText.includes('実施済') ? 'completed' : 'pending',
        publishedAt: new Date().toISOString().split('T')[0]
      });
      recallIndex++;
    }
  });

  return recalls;
}
