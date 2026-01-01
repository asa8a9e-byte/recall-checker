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
    formData.append('PROC', 'vsearch');
    formData.append('VIEW', 'vsearch_result');
    formData.append('vin1', prefix);
    formData.append('vin2', suffix);

    const response = await fetch(MAZDA_RECALL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en;q=0.9',
        'Referer': 'https://www2.mazda.co.jp/service/recall/vsearch/',
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

  // リコールなしチェック
  if (bodyText.includes('該当するリコール等の情報はありませんでした') ||
      bodyText.includes('該当する情報3件') === false && bodyText.includes('該当する情報') === false &&
      !bodyText.includes('リコール・改善対策情報') ||
      bodyText.includes('該当なし')) {

    // ただし「該当する情報」がある場合は除外しない
    if (!bodyText.includes('該当する情報')) {
      return [];
    }
  }

  let recallIndex = 0;

  // テキストベースでパース（マツダの結果ページ形式）
  // 形式: 令和XX年X月X日届出 タイトル 未実施/実施済み(日付)
  const lines = bodyText.split(/\s+/);
  let i = 0;
  while (i < lines.length) {
    // 届出日を探す
    if (lines[i].includes('届出')) {
      const dateMatch = lines.slice(Math.max(0, i - 3), i + 1).join(' ').match(/(令和|平成)(\d+)年(\d+)月(\d+)日/);

      // タイトルを探す（届出の後の「のリコールについて」等を含むテキスト）
      let title = '';
      let status: 'pending' | 'completed' = 'pending';
      let j = i + 1;

      while (j < lines.length && j < i + 10) {
        if (lines[j].includes('実施済み')) {
          status = 'completed';
          break;
        }
        if (lines[j].includes('未実施')) {
          status = 'pending';
          break;
        }
        if (lines[j].includes('について') || lines[j].includes('リコール')) {
          title = lines[j];
        }
        j++;
      }

      if (title && title.length > 5) {
        // 日付変換
        let publishedAt = new Date().toISOString().split('T')[0];
        if (dateMatch) {
          const era = dateMatch[1];
          const year = parseInt(dateMatch[2]) + (era === '令和' ? 2018 : 1988);
          const month = dateMatch[3].padStart(2, '0');
          const day = dateMatch[4].padStart(2, '0');
          publishedAt = `${year}-${month}-${day}`;
        }

        recalls.push({
          id: `mazda-${recallIndex}`,
          recallId: `M${Date.now()}-${recallIndex}`,
          title: title,
          description: `マツダ公式サイトで詳細を確認: ${MAZDA_RECALL_URL}`,
          severity: title.includes('リコール') ? 'high' : 'medium',
          status,
          publishedAt
        });
        recallIndex++;
      }
      i = j;
    }
    i++;
  }

  // フォールバック: リンクから探す
  if (recalls.length === 0) {
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
          id: `mazda-${recallIndex}`,
          recallId: href.match(/([^/]+)\.(html|pdf)$/)?.[1] || `M${Date.now()}-${recallIndex}`,
          title: text,
          description: fullUrl,
          severity: text.includes('リコール') ? 'high' : 'medium',
          status: 'pending',
          publishedAt: new Date().toISOString().split('T')[0]
        });
        recallIndex++;
      }
    });
  }

  // 該当する情報があるがパースできない場合
  if (recalls.length === 0 && bodyText.includes('該当する情報')) {
    const countMatch = bodyText.match(/該当する情報(\d+)件/);
    const count = countMatch ? parseInt(countMatch[1]) : 1;

    recalls.push({
      id: 'mazda-possible',
      recallId: `M${Date.now()}`,
      title: `${count}件のリコール等情報があります`,
      description: `マツダ公式サイトで詳細を確認: ${MAZDA_RECALL_URL}`,
      severity: 'medium',
      status: 'pending',
      publishedAt: new Date().toISOString().split('T')[0]
    });
  }

  return recalls;
}
