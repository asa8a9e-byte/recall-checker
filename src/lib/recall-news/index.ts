// src/lib/recall-news/index.ts
// 各メーカーの最新リコール情報を取得（fetch版）

import * as cheerio from 'cheerio';

export interface RecallNews {
  maker: string;
  title: string;
  date: string;
  url: string;
}

// 各メーカーのリコール一覧ページURL
const RECALL_SOURCES: Record<string, { url: string; baseUrl: string }> = {
  'トヨタ': {
    url: 'https://toyota.jp/recall/',
    baseUrl: 'https://toyota.jp'
  },
  '日産': {
    url: 'https://www.nissan.co.jp/RECALL/RECALLLIST/recall_list.html',
    baseUrl: 'https://www.nissan.co.jp'
  },
  'ホンダ': {
    url: 'https://www.honda.co.jp/recall/',
    baseUrl: 'https://www.honda.co.jp'
  },
  'マツダ': {
    url: 'https://www2.mazda.co.jp/service/recall/',
    baseUrl: 'https://www2.mazda.co.jp'
  },
  'スバル': {
    url: 'https://www.subaru.co.jp/recall/',
    baseUrl: 'https://www.subaru.co.jp'
  },
  'ダイハツ': {
    url: 'https://www.daihatsu.co.jp/info/recall/',
    baseUrl: 'https://www.daihatsu.co.jp'
  },
};

export async function fetchAllRecallNews(limit: number = 5): Promise<RecallNews[]> {
  const allNews: RecallNews[] = [];

  // 各メーカーから並列で取得
  const promises = Object.entries(RECALL_SOURCES).map(async ([maker, source]) => {
    try {
      const response = await fetch(source.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ja,en;q=0.9',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        console.error(`${maker}: HTTP ${response.status}`);
        return [];
      }

      // Shift-JIS対応
      const buffer = await response.arrayBuffer();
      let html: string;

      if (maker === '日産') {
        const decoder = new TextDecoder('shift-jis');
        html = decoder.decode(buffer);
      } else {
        const decoder = new TextDecoder('utf-8');
        html = decoder.decode(buffer);
      }

      return parseRecallNews(maker, html, source.baseUrl, limit);
    } catch (error) {
      console.error(`${maker}のリコール情報取得エラー:`, error);
      return [];
    }
  });

  const results = await Promise.all(promises);
  results.forEach(news => allNews.push(...news));

  // 日付でソート（新しい順）
  allNews.sort((a, b) => {
    if (!a.date || !b.date) return 0;
    const dateA = new Date(a.date.replace(/\//g, '-'));
    const dateB = new Date(b.date.replace(/\//g, '-'));
    return dateB.getTime() - dateA.getTime();
  });

  return allNews;
}

function parseRecallNews(maker: string, html: string, baseUrl: string, limit: number): RecallNews[] {
  const $ = cheerio.load(html);
  const news: RecallNews[] = [];

  switch (maker) {
    case 'トヨタ':
      $('a[href*="/recall/"]').each((i, el) => {
        if (news.length >= limit) return false;
        const href = $(el).attr('href') || '';
        const text = $(el).text().trim();
        // 年/月/日パターンを含むリンクを検出
        if (href.includes('/recall/20') && href.includes('.html') && text.length > 10) {
          // URLから日付を抽出 (例: /recall/2025/1204.html → 2025/12/04)
          const urlDateMatch = href.match(/\/recall\/(\d{4})\/(\d{2})(\d{2})/);
          let date = '';
          if (urlDateMatch) {
            date = `${urlDateMatch[1]}/${urlDateMatch[2]}/${urlDateMatch[3]}`;
          }
          news.push({
            maker,
            title: text.trim().slice(0, 100),
            date,
            url: href.startsWith('http') ? href : `${baseUrl}${href}`,
          });
        }
      });
      break;

    case '日産':
      // 日産のリコール一覧はテーブル形式
      $('tr').each((i, el) => {
        if (news.length >= limit) return false;
        const tds = $(el).find('td');
        if (tds.length >= 2) {
          const date = $(tds[0]).text().trim();
          const linkEl = $(tds[1]).find('a');
          const href = linkEl.attr('href') || '';
          const title = linkEl.text().replace(/<BR>/gi, ' ').replace(/\s+/g, ' ').trim();

          if (date.match(/^\d{4}\/\d{2}\/\d{2}$/) && title.length > 3) {
            // javascript:pop('...') からURLを抽出
            const urlMatch = href.match(/pop\(['"]([^'"]+)['"]\)/);
            const actualUrl = urlMatch ? urlMatch[1].trim() : href;

            news.push({
              maker,
              title: title.slice(0, 100),
              date,
              url: actualUrl.startsWith('http') ? actualUrl : `${baseUrl}${actualUrl}`,
            });
          }
        }
      });
      break;

    case 'ホンダ':
      // ホンダのリコール一覧 - /recall/auto/info/ や /recall/motor/info/ のリンクを検索
      $('a[href*="/recall/"][href*="/info/"]').each((i, el) => {
        if (news.length >= limit) return false;
        const href = $(el).attr('href') || '';
        const text = $(el).text().trim();

        // テキストから日付を検出
        const dateMatch = text.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);

        // URLから日付を抽出 (例: /info/251211_4128.html → 2025/12/11)
        let date = '';
        if (dateMatch) {
          date = `${dateMatch[1]}/${dateMatch[2].padStart(2, '0')}/${dateMatch[3].padStart(2, '0')}`;
        } else {
          const urlDateMatch = href.match(/\/info\/(\d{2})(\d{2})(\d{2})_/);
          if (urlDateMatch) {
            const year = 2000 + parseInt(urlDateMatch[1]);
            date = `${year}/${urlDateMatch[2]}/${urlDateMatch[3]}`;
          }
        }

        if (href.includes('.html') && text.length > 5) {
          // タイトルから日付部分を除去
          const title = text.replace(/\d{4}年\d{1,2}月\d{1,2}日\s*/, '').trim();
          if (title.length > 3) {
            news.push({
              maker,
              title: title.slice(0, 100),
              date,
              url: href.startsWith('http') ? href : `${baseUrl}${href}`,
            });
          }
        }
      });
      break;

    case 'マツダ':
      // マツダのリコール一覧 - /service/recall/ra/ または /service/recall/ima/ のリンク
      $('a[href*="/service/recall/ra/"], a[href*="/service/recall/ima/"]').each((i, el) => {
        if (news.length >= limit) return false;
        const href = $(el).attr('href') || '';
        const text = $(el).text().trim();

        // URLから日付を抽出 (例: /ra/20250922001/ → 2025/09/22)
        let date = '';
        const urlDateMatch = href.match(/\/(\d{4})(\d{2})(\d{2})\d+\/?$/);
        if (urlDateMatch) {
          date = `${urlDateMatch[1]}/${urlDateMatch[2]}/${urlDateMatch[3]}`;
        }

        // 親要素から日付を取得（令和○○年○月○日届出）- URLから取れなかった場合のフォールバック
        if (!date) {
          const parentText = $(el).parent().text();
          const dateMatch = parentText.match(/令和(\d+)年(\d{1,2})月(\d{1,2})日/);
          if (dateMatch) {
            const year = 2018 + parseInt(dateMatch[1]); // 令和元年 = 2019
            date = `${year}/${dateMatch[2].padStart(2, '0')}/${dateMatch[3].padStart(2, '0')}`;
          }
        }

        // タイトルが「〇〇のリコールについて」形式
        if (text.includes('リコール') || text.includes('改善対策') || text.includes('サービスキャンペーン')) {
          news.push({
            maker,
            title: text.slice(0, 100),
            date,
            url: href.startsWith('http') ? href : `${baseUrl}${href}`,
          });
        }
      });
      break;

    case 'スバル':
      // スバルのリコール一覧 - dataフォルダ内のリンクを優先
      $('a[href*="/recall/data/"]').each((i, el) => {
        if (news.length >= limit) return false;
        const href = $(el).attr('href') || '';
        const text = $(el).text().trim();

        // URLから日付を抽出 (例: /recall/data/25-12-04.html → 2025/12/04)
        const urlDateMatch = href.match(/data\/(\d{2})-(\d{2})-(\d{2})/);
        let date = '';
        if (urlDateMatch) {
          const year = parseInt(urlDateMatch[1]) + 2000;
          date = `${year}/${urlDateMatch[2]}/${urlDateMatch[3]}`;
        }

        if (href.includes('.html') && text.length > 5 && !text.includes('こちら')) {
          news.push({
            maker,
            title: text.trim().slice(0, 100),
            date,
            url: href.startsWith('http') ? href : `${baseUrl}${href}`,
          });
        }
      });
      break;

    case 'ダイハツ':
      // ダイハツのリコール一覧
      $('a[href*="/recall/"]').each((i, el) => {
        if (news.length >= limit) return false;
        const href = $(el).attr('href') || '';
        const parentText = $(el).parent().text().trim();
        let text = $(el).text().trim();

        // 親要素から日付を抽出
        const dateMatch = parentText.match(/令和(\d+)年(\d{1,2})月(\d{1,2})日/);
        let date = '';
        if (dateMatch) {
          const year = 2018 + parseInt(dateMatch[1]); // 令和元年 = 2019
          date = `${year}/${dateMatch[2].padStart(2, '0')}/${dateMatch[3].padStart(2, '0')}`;
        }

        // タイトルから日付部分を除去
        text = text.replace(/令和\d+年\d{1,2}月\d{1,2}日\s*/g, '').trim();

        if (href.match(/\d+\.htm/) && text.length > 5 && !text.includes('お知らせ') && !text.includes('廃止')) {
          news.push({
            maker,
            title: text.slice(0, 100),
            date,
            url: href.startsWith('http') ? href : `${baseUrl}${href}`,
          });
        }
      });
      break;
  }

  return news;
}
