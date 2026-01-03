import * as cheerio from 'cheerio';

async function debug() {
  const modelType = '5AA-T33';
  const searchUrl = `https://renrakuda.mlit.go.jp/renrakuda/ris-search-result.html?selCarTp=1&lstCarNo=&txtMdlNm=${encodeURIComponent(modelType)}&txtFrDat=&txtToDat=`;

  console.log(`検索URL: ${searchUrl}\n`);

  const response = await fetch(searchUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ja,en;q=0.9',
    },
  });

  const html = await response.text();
  const $ = cheerio.load(html);

  console.log('=== ページタイトル ===');
  console.log($('title').text());

  console.log('\n=== body内のテキスト（最初の500文字） ===');
  console.log($('body').text().substring(0, 500));

  console.log('\n=== リンク一覧 ===');
  $('a').each((i, el) => {
    const href = $(el).attr('href');
    const onclick = $(el).attr('onclick');
    const text = $(el).text().trim();

    if (onclick && onclick.includes('goToDetailPage')) {
      console.log(`リンク: ${text}`);
      console.log(`  onclick: ${onclick}`);
    }
  });

  console.log('\n=== テーブル一覧 ===');
  $('table').each((i, table) => {
    console.log(`テーブル ${i + 1}:`);
    console.log($(table).text().substring(0, 200));
  });

  console.log('\n=== HTML全文（最初の2000文字） ===');
  console.log(html.substring(0, 2000));
}

debug().catch(console.error);
