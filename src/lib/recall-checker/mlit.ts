// src/lib/recall-checker/mlit.ts
// 国土交通省サイトでのリコール検索

import { chromium } from 'playwright';
import * as cheerio from 'cheerio';
import { RecallCheckResult, RecallInfo } from '@/types';

const MLIT_RECALL_URL = 'https://renrakuda.mlit.go.jp/renrakuda/recall-search.html';

export async function checkMLITRecall(
  vehicleName: string,
  modelType: string
): Promise<RecallCheckResult> {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  try {
    console.log(`国交省サイトでリコール検索: ${vehicleName} / ${modelType}`);

    // URLパラメータで直接検索結果ページにアクセス
    const searchUrl = `https://renrakuda.mlit.go.jp/renrakuda/ris-search-result.html?selCarTp=1&lstCarNo=&txtMdlNm=${encodeURIComponent(modelType)}&txtFrDat=&txtToDat=`;
    console.log(`検索URL: ${searchUrl}`);

    await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    // 結果ページのHTMLを確認
    const html = await page.content();
    console.log('検索結果ページURL:', page.url());

    // リコール情報のリンクを取得
    const recallLinks = await page.$$eval('a[onclick*="goToDetailPage"]', links =>
      links.map(link => ({
        text: link.textContent?.trim() || '',
        onclick: link.getAttribute('onclick') || ''
      }))
    );

    console.log(`リコールリンク数: ${recallLinks.length}`);

    const recalls: RecallInfo[] = [];

    // 各リコールの詳細を取得
    for (let i = 0; i < recallLinks.length; i++) {
      const link = recallLinks[i];

      try {
        // goToDetailPage(3009298) から ID を抽出
        const match = link.onclick.match(/goToDetailPage\((\d+)\)/);
        if (!match) continue;

        const detailId = match[1];
        console.log(`詳細取得中: ${link.text} (ID: ${detailId})`);

        // 検索結果ページで実際にリンクをクリック
        console.log(`リンクをクリック: a[onclick*="goToDetailPage(${detailId})"]`);

        // リンクをクリックしてページ遷移を待つ
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 }),
          page.click(`a[onclick*="goToDetailPage(${detailId})"]`)
        ]);

        console.log('詳細ページに移動しました:', page.url());

        // データ読み込みに時間がかかるため長めに待機
        console.log('データ読み込み待機中（最大60秒）...');

        // JavaScriptでデータが読み込まれるまで待機（最大60秒）
        try {
          await page.waitForFunction(
            () => {
              const notificationNo = document.getElementById('notificationNo');
              const situationText = document.getElementById('situationExplanatoryText');
              return (notificationNo && notificationNo.textContent && notificationNo.textContent.trim().length > 0) ||
                     (situationText && situationText.textContent && situationText.textContent.trim().length > 0);
            },
            { timeout: 60000 }  // 60秒
          );
          console.log('✓ データ読み込み完了');
        } catch (waitError) {
          console.log('⚠ 60秒経過してもデータが読み込まれませんでした、そのまま続行');
        }

        // デバッグ用のネットワークリクエスト監視は削除（不要になったため）

        // 詳細ページから情報を取得
        const detailHtml = await page.content();
        const detailUrl = page.url(); // 詳細ページのURLを取得

        const detail = parseDetailPage(detailHtml, link.text, detailUrl);

        if (detail) {
          recalls.push(detail);
        }

        // 次のリコールのために検索結果ページに戻る
        if (i < recallLinks.length - 1) {
          console.log('検索結果ページに戻ります...');
          await page.goBack({ waitUntil: 'networkidle', timeout: 15000 });
          await page.waitForTimeout(1000);
        }

      } catch (error) {
        console.error(`詳細取得エラー (${link.text}):`, error);
        // エラーが発生しても検索結果ページに戻る
        try {
          await page.goBack({ waitUntil: 'networkidle', timeout: 10000 });
        } catch (backError) {
          console.error('検索結果ページへの復帰に失敗:', backError);
        }
      }
    }

    return {
      chassisNumber: '',
      maker: vehicleName,
      model: modelType,
      hasRecall: recalls.length > 0,
      recalls,
      checkedAt: new Date().toISOString(),
      cached: false
    };

  } catch (error) {
    console.error('国交省サイト検索エラー:', error);

    return {
      chassisNumber: '',
      maker: vehicleName,
      model: modelType,
      hasRecall: false,
      recalls: [{
        id: 'mlit-manual-check',
        recallId: 'MANUAL',
        title: '公式サイトで確認が必要です',
        description: `自動検索に失敗しました。国土交通省サイトで直接ご確認ください: ${MLIT_RECALL_URL}`,
        severity: 'medium',
        status: 'pending',
        publishedAt: new Date().toISOString().split('T')[0]
      }],
      checkedAt: new Date().toISOString(),
      cached: false
    };
  } finally {
    await browser.close();
  }
}

function parseMLITResults(html: string): RecallInfo[] {
  const $ = cheerio.load(html);
  const recalls: RecallInfo[] = [];

  console.log('国交省サイトの結果をパース中...');

  // リコールなしメッセージのチェック
  const bodyText = $('body').text();
  if (bodyText.includes('該当するリコールはありません') ||
      bodyText.includes('該当する届出はありません') ||
      bodyText.includes('対象ではありません')) {
    console.log('リコールなしと判定');
    return [];
  }

  // テーブル形式の結果を解析（複数パターンに対応）
  const tableSelectors = [
    'table.result',
    'table#resultTable',
    'table.searchResult',
    'div.result table',
    'table'
  ];

  for (const tableSelector of tableSelectors) {
    const $table = $(tableSelector);

    if ($table.length === 0) continue;

    $table.find('tr').each((index, element) => {
      // ヘッダー行をスキップ
      if (index === 0) return;

      const $row = $(element);
      const cells = $row.find('td');

      // セルが十分にあるか確認
      if (cells.length >= 2) {
        const recallId = $(cells[0]).text().trim();
        const title = $(cells[1]).text().trim();
        const publishedAt = cells.length > 2 ? $(cells[2]).text().trim() : '';
        const description = cells.length > 3 ? $(cells[3]).text().trim() : '';

        // リコール情報として有効かチェック
        if (title && title.length > 5 && !title.includes('該当') && !title.includes('ヘッダー')) {
          recalls.push({
            id: `mlit-${index}`,
            recallId: recallId || `MLIT-${Date.now()}-${index}`,
            title: title,
            publishedAt: publishedAt || new Date().toISOString().split('T')[0],
            severity: determineSeverity(title),
            status: 'pending',
            description: description || `国土交通省サイトで詳細を確認: ${MLIT_RECALL_URL}`
          });
        }
      }
    });

    // テーブルからリコールが見つかったらループを終了
    if (recalls.length > 0) break;
  }

  // テーブル以外の形式（リスト形式など）の場合の代替パース
  if (recalls.length === 0) {
    $('div.recallItem, li.recallItem, div[class*="recall"]').each((index, element) => {
      const $item = $(element);
      const text = $item.text().trim();

      if (text && text.length > 10 && text.includes('リコール')) {
        recalls.push({
          id: `mlit-${index}`,
          recallId: `MLIT-${Date.now()}-${index}`,
          title: text.substring(0, 100), // 最初の100文字
          publishedAt: new Date().toISOString().split('T')[0],
          severity: 'medium',
          status: 'pending',
          description: `国土交通省サイトで詳細を確認: ${MLIT_RECALL_URL}`
        });
      }
    });
  }

  console.log(`${recalls.length}件のリコールを検出`);

  return recalls;
}

function determineSeverity(text: string): 'high' | 'medium' | 'low' {
  const lowerText = text.toLowerCase();

  if (lowerText.includes('火災') || lowerText.includes('事故') || lowerText.includes('重大') || lowerText.includes('緊急')) {
    return 'high';
  }

  if (lowerText.includes('リコール')) {
    return 'high';
  }

  if (lowerText.includes('改善対策')) {
    return 'medium';
  }

  return 'low';
}

function parseDetailPage(html: string, recallId: string, detailUrl?: string): RecallInfo | null {
  const $ = cheerio.load(html);

  console.log(`詳細ページをパース中: ${recallId}`);

  try {
    // ID-basedセレクタでデータ取得（JavaScriptで読み込み済み）
    const notificationNo = $('#notificationNo').text().trim();
    const recallStartDate = $('#modelImportProductionStartDate').text().trim();
    const defectiveDevice = $('#defectiveDevice').text().trim();
    const situation = $('#situationExplanatoryText').text().trim();
    const measures = $('#measuresExplanatoryText').text().trim();
    const productionPeriod = $('#importProductionDate').text().trim();
    const affectedCount = $('#recallCarCount').text().trim();

    // PDF リンク
    let pdfLink = '';
    const pdfHref = $('#fileName').attr('href');
    if (pdfHref && pdfHref !== '') {
      pdfLink = `https://renrakuda.mlit.go.jp${pdfHref}`;
    }

    console.log(`=== 抽出結果 ===`);
    console.log(`届出番号: ${notificationNo || '(未取得)'}`);
    console.log(`リコール開始日: ${recallStartDate || '(未取得)'}`);
    console.log(`不具合装置: ${defectiveDevice || '(未取得)'}`);
    console.log(`状況: ${situation ? situation.substring(0, 100) + '...' : '(未取得)'}`);
    console.log(`対策: ${measures ? measures.substring(0, 100) + '...' : '(未取得)'}`);
    console.log(`製作期間: ${productionPeriod || '(未取得)'}`);
    console.log(`対象台数: ${affectedCount || '(未取得)'}`);
    console.log(`PDF: ${pdfLink || '(なし)'}`);
    if (detailUrl) {
      console.log(`詳細URL: ${detailUrl}`);
    }

    // タイトル（不具合装置をタイトルに使用）
    const title = defectiveDevice || notificationNo || recallId;

    // 届出日（リコール開始日を使用）
    let publishedAt = recallStartDate;
    if (!publishedAt || publishedAt === '') {
      publishedAt = new Date().toISOString().split('T')[0];
    } else {
      // "2025年9月26日" -> "2025-09-26" に変換
      const dateMatch = publishedAt.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
      if (dateMatch) {
        const year = dateMatch[1];
        const month = dateMatch[2].padStart(2, '0');
        const day = dateMatch[3].padStart(2, '0');
        publishedAt = `${year}-${month}-${day}`;
      }
    }

    // 詳細説明を構築
    const descriptionParts = [
      notificationNo && `【届出番号】\n${notificationNo}`,
      recallStartDate && `【リコール開始日】\n${recallStartDate}`,
      defectiveDevice && `【不具合装置】\n${defectiveDevice}`,
      `【不具合の状況】\n${situation}`,
      measures && `【対策】\n${measures}`,
      productionPeriod && `【輸入/製作期間】\n${productionPeriod}`,
      affectedCount && `【対象台数】\n${affectedCount}`,
      pdfLink && `【改善箇所説明図】\n${pdfLink}`
    ].filter(Boolean);

    const description = descriptionParts.join('\n\n');

    // 重要度を判定（状況の内容から）
    let severity: 'high' | 'medium' | 'low' = 'medium';
    if (situation.includes('火災') || situation.includes('発煙') || situation.includes('死傷')) {
      severity = 'high';
    } else if (situation.includes('走行不能') || situation.includes('エンジン停止')) {
      severity = 'high';
    } else if (situation.includes('保安基準')) {
      severity = 'medium';
    }

    console.log(`詳細取得成功: ${title}`);

    return {
      id: `mlit-${recallId.replace(/\s+/g, '-')}`,
      recallId: notificationNo || recallId,
      title,
      publishedAt,
      severity,
      status: 'pending',
      description,
      detailUrl
    };

  } catch (error) {
    console.error('詳細ページパースエラー:', error);
    return null;
  }
}
