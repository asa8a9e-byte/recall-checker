// src/lib/recall-checker/subaru.ts
// Vercel対応: fetch版

import * as cheerio from 'cheerio';
import { RecallCheckResult, RecallInfo } from '@/types';
import { splitChassisNumber } from './index';

const SUBARU_RECALL_URL = 'https://recall.subaru.co.jp/lqsb/';

export async function checkSubaruRecall(chassisNumber: string): Promise<RecallCheckResult> {
  const [prefix, suffix] = splitChassisNumber(chassisNumber);

  try {
    // 1. フォームページを取得してJSESSIONIDとaction URLを取得
    const formResponse = await fetch(SUBARU_RECALL_URL, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en;q=0.9',
      },
      signal: AbortSignal.timeout(30000),
    });

    // JSESSIONIDを取得
    const cookies = formResponse.headers.get('set-cookie') || '';
    const jsessionId = cookies.match(/JSESSIONID=([^;]+)/)?.[1] || '';

    // action URLを取得（Shift-JISでデコード）
    const formBuffer = await formResponse.arrayBuffer();
    const formHtml = new TextDecoder('shift-jis').decode(formBuffer);
    const actionMatch = formHtml.match(/action="([^"]+)"/);
    const actionUrl = actionMatch ? actionMatch[1] : '/lqsb/recall.do';

    // 2. 検索実行（btnSearchを使用）
    const formData = new URLSearchParams();
    formData.append('txtCarNoKami', prefix);
    formData.append('txtCarNoShimo', suffix);
    formData.append('btnSearch', '検索');

    const searchUrl = `https://recall.subaru.co.jp${actionUrl}`;

    const response = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en;q=0.9',
        'Referer': SUBARU_RECALL_URL,
        'Cookie': `JSESSIONID=${jsessionId}`,
      },
      body: formData.toString(),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    // Shift-JISでデコード
    const buffer = await response.arrayBuffer();
    const html = new TextDecoder('shift-jis').decode(buffer);
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
        description: `自動検索に失敗しました。スバル公式サイトで直接ご確認ください: https://recall.subaru.co.jp/lqsb/`,
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

  let recallIndex = 0;

  // テーブルから情報を取得
  // 形式: 番号 | 実施状況 | 区分 | 内容 | 開始日 | 特記事項
  $('table tr').each((index, element) => {
    const $row = $(element);
    const cells = $row.find('td');
    const rowText = $row.text();

    // ヘッダー行や関係ない行をスキップ
    if (cells.length < 4) return;

    // リコール、改善対策、サービスキャンペーンを含む行を探す
    if (rowText.includes('リコール') || rowText.includes('改善対策') || rowText.includes('サービスキャンペーン')) {
      const statusText = $(cells[1]).text().trim(); // 実施状況
      const category = $(cells[2]).text().trim();   // 区分
      const content = $(cells[3]).text().trim();    // 内容
      const dateText = cells.length > 4 ? $(cells[4]).text().trim() : ''; // 開始日

      if (content && content.length > 3) {
        // 日付を抽出
        const dateMatch = dateText.match(/(\d{4})\/(\d{2})\/(\d{2})/);
        const publishedAt = dateMatch
          ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`
          : new Date().toISOString().split('T')[0];

        const isRecall = category.includes('リコール');
        const isCampaign = category.includes('サービスキャンペーン');

        recalls.push({
          id: `subaru-${recallIndex}`,
          recallId: `S${Date.now()}-${recallIndex}`,
          title: `${category}: ${content}`,
          description: `スバル公式サイトで詳細を確認: ${SUBARU_RECALL_URL}`,
          severity: isRecall ? 'high' : isCampaign ? 'low' : 'medium',
          status: statusText.includes('実施済') ? 'completed' : 'pending',
          publishedAt
        });
        recallIndex++;
      }
    }
  });

  // テーブルから見つからない場合、リンクから探す
  if (recalls.length === 0) {
    $('a').each((_, element) => {
      const $link = $(element);
      const text = $link.text().trim();
      const $row = $link.closest('tr');
      const rowText = $row.text();

      // リコール関連のリンクテキストを探す
      if (text.length > 10 && (rowText.includes('未実施') || rowText.includes('実施済'))) {
        const isCompleted = rowText.includes('実施済');
        const isRecall = rowText.includes('リコール');

        recalls.push({
          id: `subaru-${recallIndex}`,
          recallId: `S${Date.now()}-${recallIndex}`,
          title: text,
          description: `スバル公式サイトで詳細を確認: ${SUBARU_RECALL_URL}`,
          severity: isRecall ? 'high' : 'medium',
          status: isCompleted ? 'completed' : 'pending',
          publishedAt: new Date().toISOString().split('T')[0]
        });
        recallIndex++;
      }
    });
  }

  // それでも見つからないが、リコール対象の可能性がある場合
  if (recalls.length === 0) {
    const bodyText = $('body').text();
    // 明確にリコール情報がある場合のみフォールバック
    if ((bodyText.includes('ご案内がございます') || bodyText.includes('未実施')) &&
        !bodyText.includes('対象のリコール等はございません') &&
        !bodyText.includes('該当するリコール等はございません')) {
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
  }

  return recalls;
}
