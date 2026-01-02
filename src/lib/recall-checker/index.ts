// src/lib/recall-checker/index.ts

import { RecallCheckResult } from '@/types';
import { checkToyotaRecall } from './toyota';
import { checkNissanRecall } from './nissan';
import { checkHondaRecall } from './honda';
import { checkMazdaRecall } from './mazda';
import { checkSubaruRecall } from './subaru';
import { checkDaihatsuRecall } from './daihatsu';
import { checkMLITRecall } from './mlit';

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

// 統合リコールチェック（メーカー必須）
export async function checkRecall(
  chassisNumber: string,
  maker: string
): Promise<RecallCheckResult> {
  const cleanedChassis = chassisNumber.trim().toUpperCase();

  if (!maker) {
    throw new Error('メーカーを選択してください。');
  }

  // 対応チェッカーを取得
  const checker = checkers[maker];

  if (!checker) {
    throw new Error(`${maker}は現在未対応です。`);
  }

  // リコールチェック実行
  return await checker(cleanedChassis);
}

// 車名・型式でのリコールチェック（国交省サイト）
export async function checkRecallByModel(
  modelName: string,
  modelType: string
): Promise<RecallCheckResult> {
  return await checkMLITRecall(modelName, modelType);
}

