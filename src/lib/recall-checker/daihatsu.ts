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
    formData.append('mode', '1');
    formData.append('model_no', prefix);
    formData.append('car_no', suffix);

    const response = await fetch(DAIHATSU_RECALL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en;q=0.9',
        'Referer': DAIHATSU_RECALL_URL,
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
        description: `自動検索に失敗しました。ダイハツ公式サイトで直接ご確認ください: https://www.daihatsu.co.jp/info/recall/`,
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

  // リコールなしチェック
  if (bodyText.includes('対象項目なし') ||
      bodyText.includes('対象ではありません') ||
      bodyText.includes('該当なし')) {
    return [];
  }

  let recallIndex = 0;

  // テーブルから情報を取得
  // 形式: 届出日 | 区分 | 内容 | 修理状況
  $('table tr').each((_, element) => {
    const $row = $(element);
    const cells = $row.find('td');
    const rowText = $row.text();

    if (cells.length >= 3) {
      const dateText = $(cells[0]).text().trim();
      const category = $(cells[1]).text().trim();
      const $contentCell = $(cells[2]);
      const content = $contentCell.text().trim();
      const statusText = cells.length > 3 ? $(cells[3]).text().trim() : '';

      // リコール・改善対策・サービスキャンペーンを含む行
      if ((category.includes('リコール') || category.includes('改善対策') || category.includes('サービス')) &&
          content && content.length > 5) {

        // リンクがあれば取得
        const $link = $contentCell.find('a');
        const href = $link.attr('href') || '';
        const detailUrl = href ? (href.startsWith('http') ? href : `https://www.daihatsu.co.jp${href}`) : '';

        // 日付をパース
        const dateMatch = dateText.match(/(\d{4})\/(\d{2})\/(\d{2})/);
        const publishedAt = dateMatch
          ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`
          : new Date().toISOString().split('T')[0];

        const isRecall = category.includes('リコール');
        const isCompleted = statusText.includes('修理済');

        recalls.push({
          id: `daihatsu-${recallIndex}`,
          recallId: href.match(/(\d+)\.htm/)?.[1] || `D${Date.now()}-${recallIndex}`,
          title: `${category}: ${content}`,
          description: detailUrl || `ダイハツ公式サイトで詳細を確認: ${DAIHATSU_RECALL_URL}`,
          severity: isRecall ? 'high' : 'medium',
          status: isCompleted ? 'completed' : 'pending',
          publishedAt
        });
        recallIndex++;
      }
    }
  });

  // リンクベースのフォールバック
  if (recalls.length === 0) {
    $('a').each((_, element) => {
      const $link = $(element);
      const href = $link.attr('href') || '';
      const text = $link.text().trim();

      if (href.includes('/info/recall/') && href.match(/\d+\.htm/) && text && text.length > 5) {
        const fullUrl = href.startsWith('http') ? href : `https://www.daihatsu.co.jp${href}`;
        const $row = $link.closest('tr');
        const rowText = $row.text();

        recalls.push({
          id: `daihatsu-${recallIndex}`,
          recallId: href.match(/(\d+)\.htm/)?.[1] || `D${Date.now()}-${recallIndex}`,
          title: text,
          description: fullUrl,
          severity: text.includes('リコール') || rowText.includes('リコール') ? 'high' : 'medium',
          status: rowText.includes('修理済') ? 'completed' : 'pending',
          publishedAt: new Date().toISOString().split('T')[0]
        });
        recallIndex++;
      }
    });
  }

  // 検索結果があるがパースできない場合
  if (recalls.length === 0 && bodyText.includes('検索結果') && !bodyText.includes('対象項目なし')) {
    recalls.push({
      id: 'daihatsu-possible',
      recallId: `D${Date.now()}`,
      title: 'リコール等情報があります',
      description: `ダイハツ公式サイトで詳細を確認: ${DAIHATSU_RECALL_URL}`,
      severity: 'medium',
      status: 'pending',
      publishedAt: new Date().toISOString().split('T')[0]
    });
  }

  return recalls;
}
