// src/lib/recall-checker/subaru.ts
// Vercel対応: fetch版

import * as cheerio from 'cheerio';
import { RecallCheckResult, RecallInfo } from '@/types';
import { splitChassisNumber } from './index';

const SUBARU_RECALL_URL = 'https://recall.subaru.co.jp/lqsb/';
const SUBARU_SEARCH_URL = 'https://recall.subaru.co.jp/lqsb/LQSB1010.do';

export async function checkSubaruRecall(chassisNumber: string): Promise<RecallCheckResult> {
  const [prefix, suffix] = splitChassisNumber(chassisNumber);

  try {
    // セッション確立のため最初にGETリクエスト
    const initResponse = await fetch(SUBARU_RECALL_URL, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en;q=0.9',
      },
      signal: AbortSignal.timeout(30000),
    });

    // Cookieを取得
    const cookies = initResponse.headers.get('set-cookie') || '';

    const formData = new URLSearchParams();
    formData.append('txtCarNoKami', prefix);
    formData.append('txtCarNoShimo', suffix);
    formData.append('txtButton', 'LQSB1010.searchEn');

    const response = await fetch(SUBARU_SEARCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en;q=0.9',
        'Referer': SUBARU_RECALL_URL,
        'Cookie': cookies.split(';')[0] || '',
      },
      body: formData.toString(),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const recalls = parseSubaruResults(html, chassisNumber);

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

function parseSubaruResults(html: string, chassisNumber: string): RecallInfo[] {
  const $ = cheerio.load(html);
  const recalls: RecallInfo[] = [];
  const bodyText = $('body').text();

  // リコールなしのチェック
  if (bodyText.includes('対象のリコール等はございません') ||
      bodyText.includes('該当するリコール等はございません') ||
      bodyText.includes('該当なし') ||
      bodyText.includes('対象外')) {
    return [];
  }

  let recallIndex = 0;

  // パターン1: JavaScript popup リンク
  $('a').each((_, element) => {
    const $link = $(element);
    const href = $link.attr('href') || '';
    const onclick = $link.attr('onclick') || '';
    const text = $link.text().trim();

    // popup関数のURLをマッチ
    const urlMatch = href.match(/popup\d*\(['"]([^'"]+)['"]\)/) ||
                     onclick.match(/popup\d*\(['"]([^'"]+)['"]\)/);
    if (urlMatch && text && text.length > 3) {
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
        recallId: detailUrl.match(/([^/]+)\.(html|pdf)$/)?.[1] || `S${Date.now()}-${recallIndex}`,
        title: category ? `${category}: ${text}` : text,
        description: `詳細: ${detailUrl}`,
        severity: category.includes('リコール') ? 'high' : 'medium',
        status: statusText.includes('実施済') ? 'completed' : 'pending',
        publishedAt: new Date().toISOString().split('T')[0]
      });
      recallIndex++;
    }
  });

  // パターン2: recall.subaru.co.jp へのリンク
  if (recalls.length === 0) {
    $('a[href*="recall"]').each((_, element) => {
      const $link = $(element);
      const href = $link.attr('href') || '';
      const text = $link.text().trim();

      if ((href.includes('.html') || href.includes('.pdf')) && text && text.length > 3) {
        const $row = $link.closest('tr');
        const cells = $row.find('td');

        let statusText = '';
        let category = '';

        if (cells.length >= 2) {
          statusText = $(cells[0]).text().trim();
          category = $(cells[1]).text().trim();
        }

        recalls.push({
          id: `subaru-${recallIndex}`,
          recallId: href.match(/([^/]+)\.(html|pdf)$/)?.[1] || `S${Date.now()}-${recallIndex}`,
          title: category || text,
          description: `詳細: ${href}`,
          severity: text.includes('リコール') || category.includes('リコール') ? 'high' : 'medium',
          status: statusText.includes('実施済') ? 'completed' : 'pending',
          publishedAt: new Date().toISOString().split('T')[0]
        });
        recallIndex++;
      }
    });
  }

  // パターン3: テーブルから直接情報を取得
  if (recalls.length === 0) {
    $('table tr').each((index, element) => {
      if (index === 0) return; // ヘッダースキップ

      const $row = $(element);
      const cells = $row.find('td');
      const rowText = $row.text();

      if (cells.length >= 2 && (rowText.includes('リコール') || rowText.includes('改善対策') || rowText.includes('サービスキャンペーン'))) {
        const title = $(cells[0]).text().trim() || $(cells[1]).text().trim();

        if (title && title.length > 3) {
          recalls.push({
            id: `subaru-${recallIndex}`,
            recallId: `S${Date.now()}-${recallIndex}`,
            title,
            description: '',
            severity: title.includes('リコール') ? 'high' : 'medium',
            status: rowText.includes('実施済') ? 'completed' : 'pending',
            publishedAt: new Date().toISOString().split('T')[0]
          });
          recallIndex++;
        }
      }
    });
  }

  // パターン4: リコール対象の可能性がある場合（テキストベース検出）
  if (recalls.length === 0 &&
      (bodyText.includes('リコール') || bodyText.includes('改善対策') || bodyText.includes('未実施')) &&
      !bodyText.includes('対象のリコール等はございません') &&
      !bodyText.includes('該当なし')) {
    recalls.push({
      id: 'subaru-possible',
      recallId: `S${Date.now()}`,
      title: 'リコール対象の可能性があります',
      description: `公式サイトで詳細を確認してください: ${SUBARU_RECALL_URL}`,
      severity: 'medium',
      status: 'pending',
      publishedAt: new Date().toISOString().split('T')[0]
    });
  }

  return recalls;
}
