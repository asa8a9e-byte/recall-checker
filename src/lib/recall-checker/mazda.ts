// src/lib/recall-checker/mazda.ts
// Vercel対応: fetch版

import * as cheerio from 'cheerio';
import { RecallCheckResult, RecallInfo } from '@/types';
import { splitChassisNumber } from './index';

const MAZDA_RECALL_URL = 'https://www2.mazda.co.jp/service/recall/vsearch';

export async function checkMazdaRecall(chassisNumber: string): Promise<RecallCheckResult> {
  const [prefix, suffix] = splitChassisNumber(chassisNumber);

  try {
    const formData = new URLSearchParams();
    formData.append('vin1', prefix);
    formData.append('vin2', suffix);

    const response = await fetch(MAZDA_RECALL_URL, {
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
    const recalls = parseMazdaResults(html);

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

    return {
      chassisNumber,
      maker: 'マツダ',
      hasRecall: false,
      recalls: [{
        id: 'mazda-manual-check',
        recallId: 'MANUAL',
        title: '公式サイトで確認が必要です',
        description: `自動検索に失敗しました。マツダ公式サイトで直接ご確認ください: ${MAZDA_RECALL_URL}`,
        severity: 'medium',
        status: 'pending',
        publishedAt: new Date().toISOString().split('T')[0]
      }],
      checkedAt: new Date().toISOString(),
      cached: false
    };
  }
}

function parseMazdaResults(html: string): RecallInfo[] {
  const $ = cheerio.load(html);
  const recalls: RecallInfo[] = [];
  const bodyText = $('body').text();

  if (bodyText.includes('該当するリコール等の情報はありませんでした') ||
      bodyText.includes('該当なし')) {
    return [];
  }

  $('a').each((index, element) => {
    const $link = $(element);
    const href = $link.attr('href') || '';
    const text = $link.text().trim();

    if ((href.includes('/recall/') || href.includes('/RECALL/')) &&
        (href.includes('.html') || href.includes('.pdf')) &&
        text && text.length > 5 &&
        !href.includes('vsearch') && !href.includes('list.html')) {

      const fullUrl = href.startsWith('http') ? href : `https://www2.mazda.co.jp${href}`;

      recalls.push({
        id: `mazda-${index}`,
        recallId: href.match(/([^/]+)\.(html|pdf)$/)?.[1] || `M${Date.now()}-${index}`,
        title: text,
        description: `詳細: ${fullUrl}`,
        severity: text.includes('リコール') ? 'high' : 'medium',
        status: 'pending',
        publishedAt: new Date().toISOString().split('T')[0]
      });
    }
  });

  return recalls;
}
