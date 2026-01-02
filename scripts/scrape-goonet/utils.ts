// scripts/scrape-goonet/utils.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// スリープ関数
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// リトライ付き実行
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 2000
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) {
        throw error;
      }

      const delay = baseDelay * Math.pow(2, i);
      console.log(`リトライ ${i + 1}/${maxRetries}... (${delay}ms待機)`);
      await sleep(delay);
    }
  }

  throw new Error('Unreachable');
}

// スクレイピングステータス更新
export async function updateScrapingStatus(
  source: string,
  status: 'idle' | 'running' | 'error',
  success = false,
  errorMessage?: string,
  recordCount?: number
): Promise<void> {
  const now = new Date();

  try {
    await prisma.scrapingMetadata.upsert({
      where: { source },
      update: {
        status,
        lastScrapedAt: now,
        lastSuccessAt: success ? now : undefined,
        errorMessage: errorMessage || null,
        recordCount: recordCount !== undefined ? recordCount : undefined
      },
      create: {
        source,
        status,
        lastScrapedAt: now,
        lastSuccessAt: success ? now : undefined,
        errorMessage: errorMessage || null,
        recordCount: recordCount || 0
      }
    });
  } catch (error) {
    console.error('スクレイピングステータス更新エラー:', error);
  }
}

// Prismaクライアント取得
export function getPrisma() {
  return prisma;
}

// クリーンアップ
export async function cleanup() {
  await prisma.$disconnect();
}

// プログレスバー表示
export function logProgress(current: number, total: number, label: string) {
  const percentage = Math.round((current / total) * 100);
  const bar = '='.repeat(Math.floor(percentage / 2)) + ' '.repeat(50 - Math.floor(percentage / 2));
  process.stdout.write(`\r[${bar}] ${percentage}% - ${label} (${current}/${total})`);

  if (current === total) {
    console.log(''); // 改行
  }
}
