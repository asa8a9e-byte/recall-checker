// src/lib/recall-checker/honda.ts
// Vercel対応: fetch版

import * as cheerio from 'cheerio';
import { RecallCheckResult, RecallInfo } from '@/types';
import { splitChassisNumber } from './index';

const HONDA_FORM_URL = 'https://recallsearch4.honda.co.jp/sqs/r001/R00101.do';

export async function checkHondaRecall(chassisNumber: string): Promise<RecallCheckResult> {
  const [prefix, suffix] = splitChassisNumber(chassisNumber);

  try {
    // GETリクエストで検索（フォームがGETメソッドを使用）
    const searchUrl = `${HONDA_FORM_URL}?fn=search.exec&syadai_no1=${encodeURIComponent(prefix)}&syadai_no2=${encodeURIComponent(suffix)}`;

    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3',
        'Referer': `${HONDA_FORM_URL}?fn=link.disp`,
      },
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();

    // サーバー混雑エラーチェック
    if (html.includes('Error Informations') || html.includes('サーバーが大変混み合っている')) {
      throw new Error('サーバーが混雑しています');
    }

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
        description: `自動検索に失敗しました。ホンダ公式サイトで直接ご確認ください: ${HONDA_FORM_URL}?fn=link.disp`,
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
  if (bodyText.includes('リコールや改善対策の実施履歴はございません') ||
      bodyText.includes('該当なし') ||
      bodyText.includes('対象外') ||
      bodyText.includes('対象車両ではありません')) {
    return [];
  }

  let recallIndex = 0;

  // リコールリンクを探す（honda.co.jp/recall/を含むリンク）
  $('a').each((_, element) => {
    const $link = $(element);
    const href = $link.attr('href') || '';
    const text = $link.text().trim();

    if (href.includes('honda.co.jp/recall/') && href.includes('.html') && text && text.length > 5) {
      const $row = $link.closest('tr');
      const rowText = $row.text();
      const category = $row.find('td:first-child').text().trim() || 'リコール';

      // 日付を抽出
      const dateMatch = rowText.match(/(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
      const publishedAt = dateMatch
        ? `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`
        : new Date().toISOString().split('T')[0];

      const isRecall = category.includes('リコール') || text.includes('リコール');
      const isCompleted = rowText.includes('実施済') || rowText.includes('完了');

      recalls.push({
        id: `honda-${recallIndex}`,
        recallId: href.match(/info\/([^.]+)\.html/)?.[1] || `H${Date.now()}-${recallIndex}`,
        title: text,
        description: href,
        severity: isRecall ? 'high' : category.includes('改善') ? 'medium' : 'low',
        status: isCompleted ? 'completed' : 'pending',
        publishedAt
      });
      recallIndex++;
    }
  });

  // テーブルからの抽出（リンクが見つからない場合）
  if (recalls.length === 0) {
    $('table tr').each((_, element) => {
      const $row = $(element);
      const cells = $row.find('td');
      const rowText = $row.text();

      if (cells.length >= 2 && (rowText.includes('リコール') || rowText.includes('改善対策') || rowText.includes('サービスキャンペーン'))) {
        const category = $(cells[0]).text().trim();
        const content = $(cells[1]).text().trim();

        if (content && content.length > 5) {
          recalls.push({
            id: `honda-${recallIndex}`,
            recallId: `H${Date.now()}-${recallIndex}`,
            title: `${category}: ${content}`,
            description: `ホンダ公式サイトで詳細を確認: ${HONDA_FORM_URL}?fn=link.disp`,
            severity: category.includes('リコール') ? 'high' : 'medium',
            status: rowText.includes('実施済') ? 'completed' : 'pending',
            publishedAt: new Date().toISOString().split('T')[0]
          });
          recallIndex++;
        }
      }
    });
  }

  // 未実施リコールがある場合のフォールバック
  if (recalls.length === 0 && (bodyText.includes('未実施') || bodyText.includes('リコール対象'))) {
    recalls.push({
      id: 'honda-unknown',
      recallId: `H${Date.now()}`,
      title: 'リコール対象です',
      description: `ホンダ公式サイトで詳細を確認: ${HONDA_FORM_URL}?fn=link.disp`,
      severity: 'high',
      status: 'pending',
      publishedAt: new Date().toISOString().split('T')[0]
    });
  }

  return recalls;
}
