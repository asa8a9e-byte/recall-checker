// src/lib/recall-checker/nissan.ts
// Vercel対応: fetch版

import * as cheerio from 'cheerio';
import { RecallCheckResult, RecallInfo } from '@/types';
import { splitChassisNumber } from './index';

const NISSAN_RECALL_URL = 'https://www.nissan.co.jp/RECALL/SEARCH/RecallServlet';

export async function checkNissanRecall(chassisNumber: string): Promise<RecallCheckResult> {
  const [prefix, suffix] = splitChassisNumber(chassisNumber);

  try {
    const formData = new URLSearchParams();
    formData.append('frameno', prefix);
    formData.append('chassino', suffix);

    const response = await fetch(NISSAN_RECALL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en;q=0.9',
        'Referer': 'https://www.nissan.co.jp/RECALL/search.html',
        'Origin': 'https://www.nissan.co.jp',
      },
      body: formData.toString(),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
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
      bodyText.includes('該当なし') ||
      bodyText.includes('対象車両と検索されませんでした')) {
    return [];
  }

  let recallIndex = 0;

  // リコールリンクを探す（javascript:pop形式）
  $('a').each((_, element) => {
    const $link = $(element);
    const href = $link.attr('href') || '';
    const text = $link.text().trim();

    // javascript:pop('/RECALL/DATA/report5733.html') 形式
    const popMatch = href.match(/pop\(['"]([^'"]+)['"]\)/);
    if (popMatch && text && text.length > 5) {
      const detailPath = popMatch[1].trim();
      const detailUrl = detailPath.startsWith('http')
        ? detailPath
        : `https://www.nissan.co.jp${detailPath}`;

      // 親の行から実施状況を取得
      const $row = $link.closest('tr');
      const rowText = $row.text();
      const isCompleted = rowText.includes('実施済');

      // 日付を抽出
      const dateMatch = rowText.match(/(\d{4})\/(\d{2})\/(\d{2})/);
      const publishedAt = dateMatch
        ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`
        : new Date().toISOString().split('T')[0];

      const isRecall = text.includes('リコール') || rowText.includes('リコール');
      const isCampaign = text.includes('サービスキャンペーン');

      recalls.push({
        id: `nissan-${recallIndex}`,
        recallId: detailPath.match(/report(\d+)\.html/)?.[1] || `N${Date.now()}-${recallIndex}`,
        title: text,
        description: detailUrl,
        severity: isRecall ? 'high' : isCampaign ? 'low' : 'medium',
        status: isCompleted ? 'completed' : 'pending',
        publishedAt
      });
      recallIndex++;
    }
  });

  // 直接リンク形式も対応
  if (recalls.length === 0) {
    $('a[href*="/RECALL/DATA/"]').each((_, element) => {
      const $link = $(element);
      const href = $link.attr('href') || '';
      const text = $link.text().trim();

      if (href.includes('.html') && text && text.length > 5) {
        const detailUrl = href.startsWith('http')
          ? href
          : `https://www.nissan.co.jp${href}`;

        recalls.push({
          id: `nissan-${recallIndex}`,
          recallId: href.match(/report(\d+)\.html/)?.[1] || `N${Date.now()}-${recallIndex}`,
          title: text,
          description: detailUrl,
          severity: text.includes('リコール') ? 'high' : 'medium',
          status: 'pending',
          publishedAt: new Date().toISOString().split('T')[0]
        });
        recallIndex++;
      }
    });
  }

  return recalls;
}
