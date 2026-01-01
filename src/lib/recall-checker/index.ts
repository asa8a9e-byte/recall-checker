// src/lib/recall-checker/index.ts

import { RecallCheckResult, MAKER_PREFIXES, Maker } from '@/types';
import { checkToyotaRecall } from './toyota';
import { checkNissanRecall } from './nissan';
import { checkHondaRecall } from './honda';
import { checkMazdaRecall } from './mazda';
import { checkSubaruRecall } from './subaru';
import { checkDaihatsuRecall } from './daihatsu';

// メーカー判定（長いプレフィックスを優先）
export function detectMaker(chassisNumber: string): Maker | null {
  const upperChassis = chassisNumber.toUpperCase();

  // 全プレフィックスを長さ順にソートして、長いものから先にマッチング
  const allPrefixes: { maker: Maker; prefix: string }[] = [];
  for (const [maker, prefixes] of Object.entries(MAKER_PREFIXES)) {
    for (const prefix of prefixes) {
      allPrefixes.push({ maker: maker as Maker, prefix });
    }
  }

  // 長い順にソート
  allPrefixes.sort((a, b) => b.prefix.length - a.prefix.length);

  // S700B/S710Bはスバル・サンバー、S700V/S710Vはダイハツ・ハイゼット
  // 特殊ケースを先に処理
  if (upperChassis.startsWith('S700B') || upperChassis.startsWith('S710B') ||
      upperChassis.startsWith('S500B') || upperChassis.startsWith('S510B')) {
    return 'スバル';
  }
  if (upperChassis.startsWith('S700V') || upperChassis.startsWith('S710V') ||
      upperChassis.startsWith('S500V') || upperChassis.startsWith('S510V')) {
    return 'ダイハツ';
  }

  for (const { maker, prefix } of allPrefixes) {
    if (upperChassis.startsWith(prefix)) {
      return maker;
    }
  }
  return null;
}

// 車台番号の分割（ハイフンで分割）
export function splitChassisNumber(chassis: string): [string, string] {
  const cleaned = chassis.trim().toUpperCase();
  
  if (cleaned.includes('-')) {
    const parts = cleaned.split('-');
    return [parts[0], parts.slice(1).join('-')];
  }
  
  // ハイフンがない場合は、アルファベット部分と数字部分で分割を試みる
  const match = cleaned.match(/^([A-Z]+\d*)(\d+)$/);
  if (match) {
    return [match[1], match[2]];
  }
  
  // 分割できない場合はそのまま返す
  return [cleaned, ''];
}

// メーカー別のチェッカー
const checkers: Record<string, (chassis: string) => Promise<RecallCheckResult>> = {
  'トヨタ': checkToyotaRecall,
  '日産': checkNissanRecall,
  'ホンダ': checkHondaRecall,
  'マツダ': checkMazdaRecall,
  'スバル': checkSubaruRecall,
  'ダイハツ': checkDaihatsuRecall,
};

// 統合リコールチェック
export async function checkRecall(
  chassisNumber: string,
  maker?: string
): Promise<RecallCheckResult> {
  const cleanedChassis = chassisNumber.trim().toUpperCase();
  
  // メーカー判定
  const detectedMaker = maker || detectMaker(cleanedChassis);
  
  if (!detectedMaker) {
    throw new Error('メーカーを判定できませんでした。メーカーを選択してください。');
  }
  
  // 対応チェッカーを取得
  const checker = checkers[detectedMaker];
  
  if (!checker) {
    throw new Error(`${detectedMaker}は現在未対応です。`);
  }
  
  // リコールチェック実行
  return await checker(cleanedChassis);
}

// 一括チェック（並列数制限付き）
export async function bulkCheckRecalls(
  chassisNumbers: string[],
  concurrency: number = 3
): Promise<RecallCheckResult[]> {
  const results: RecallCheckResult[] = [];
  
  // 並列数を制限して実行
  for (let i = 0; i < chassisNumbers.length; i += concurrency) {
    const batch = chassisNumbers.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(
      batch.map(chassis => checkRecall(chassis))
    );
    
    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        console.error('リコールチェック失敗:', result.reason);
      }
    }
    
    // レート制限のため1秒待機
    if (i + concurrency < chassisNumbers.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return results;
}
