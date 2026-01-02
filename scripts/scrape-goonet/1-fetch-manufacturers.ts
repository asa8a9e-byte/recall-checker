// scripts/scrape-goonet/1-fetch-manufacturers.ts

import { chromium } from 'playwright';
import * as cheerio from 'cheerio';
import { getPrisma, sleep, retryWithBackoff } from './utils';

const GOONET_CATALOG_URL = 'https://www.goo-net.com/catalog/';

// 全メーカーのマッピング（Goo-netコード → 日本語名）
const MANUFACTURERS_MAP: Record<string, string> = {
  'TOYOTA': 'トヨタ',
  'NISSAN': '日産',
  'HONDA': 'ホンダ',
  'MAZDA': 'マツダ',
  'SUBARU': 'スバル',
  'DAIHATSU': 'ダイハツ',
  'SUZUKI': 'スズキ',
  'MITSUBISHI': '三菱',
  'LEXUS': 'レクサス',
  'MITSUOKA': '光岡',
  'ISUZU': 'いすゞ',
  // 輸入車
  'MERCEDES_BENZ': 'メルセデス・ベンツ',
  'BMW': 'BMW',
  'AUDI': 'アウディ',
  'VOLKSWAGEN': 'フォルクスワーゲン',
  'PORSCHE': 'ポルシェ',
  'VOLVO': 'ボルボ',
  'PEUGEOT': 'プジョー',
  'RENAULT': 'ルノー',
  'CITROEN': 'シトロエン',
  'FIAT': 'フィアット',
  'ALFA_ROMEO': 'アルファロメオ',
  'FERRARI': 'フェラーリ',
  'LAMBORGHINI': 'ランボルギーニ',
  'MASERATI': 'マセラティ',
  'JAGUAR': 'ジャガー',
  'LAND_ROVER': 'ランドローバー',
  'BENTLEY': 'ベントレー',
  'ROLLS_ROYCE': 'ロールスロイス',
  'ASTON_MARTIN': 'アストンマーティン',
  'MINI': 'MINI',
  'JEEP': 'ジープ',
  'CHEVROLET': 'シボレー',
  'CADILLAC': 'キャデラック',
  'FORD': 'フォード',
  'DODGE': 'ダッジ',
  'CHRYSLER': 'クライスラー',
  'TESLA': 'テスラ',
  'HYUNDAI': 'ヒュンダイ',
  'KIA': 'キア',
};

export async function fetchManufacturers(): Promise<number> {
  console.log('\n=== メーカー一覧取得開始 ===\n');

  const prisma = getPrisma();
  let savedCount = 0;

  try {
    // Playwrightでページを開く
    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    const page = await context.newPage();

    console.log(`Goo-netカタログページにアクセス: ${GOONET_CATALOG_URL}`);

    await retryWithBackoff(async () => {
      await page.goto(GOONET_CATALOG_URL, { waitUntil: 'networkidle', timeout: 60000 });
    });

    await sleep(2000);

    // HTMLを取得してパース
    const html = await page.content();
    const $ = cheerio.load(html);

    // メーカーリンクを抽出（複数のセレクタパターンを試す）
    const manufacturers = new Set<string>();

    // パターン1: /catalog/{MAKER}/ 形式のリンク
    $('a[href*="/catalog/"]').each((_, element) => {
      const href = $(element).attr('href');
      if (href) {
        const match = href.match(/\/catalog\/([A-Z_]+)\/?$/);
        if (match && match[1]) {
          manufacturers.add(match[1]);
        }
      }
    });

    console.log(`${manufacturers.size}メーカーを検出しました`);

    // データベースに保存
    for (const goonetCode of Array.from(manufacturers)) {
      const name = MANUFACTURERS_MAP[goonetCode];

      if (!name) {
        console.log(`⚠ 未知のメーカーコード: ${goonetCode} (スキップ)`);
        continue;
      }

      try {
        await prisma.manufacturer.upsert({
          where: { goonetCode },
          update: { name },
          create: {
            name,
            goonetCode
          }
        });

        console.log(`✓ ${name} (${goonetCode})`);
        savedCount++;
      } catch (error) {
        console.error(`✗ ${name}の保存に失敗:`, error);
      }

      await sleep(100);
    }

    await browser.close();

    console.log(`\n=== メーカー一覧取得完了: ${savedCount}件 ===\n`);

    return savedCount;

  } catch (error) {
    console.error('メーカー一覧取得エラー:', error);
    throw error;
  }
}

// スタンドアローン実行
if (require.main === module) {
  fetchManufacturers()
    .then(count => {
      console.log(`完了: ${count}メーカーを保存しました`);
      process.exit(0);
    })
    .catch(error => {
      console.error('エラー:', error);
      process.exit(1);
    });
}
