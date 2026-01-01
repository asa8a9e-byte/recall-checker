// scripts/check-new-recalls.ts
// 定期実行して在庫車両の新リコールをチェック

import { PrismaClient } from '@prisma/client';
import { checkRecall } from '../src/lib/recall-checker';

const prisma = new PrismaClient();

async function main() {
  console.log('='.repeat(50));
  console.log('新リコールチェック開始:', new Date().toISOString());
  console.log('='.repeat(50));
  
  try {
    // 全在庫車両を取得
    const vehicles = await prisma.vehicle.findMany();
    
    console.log(`在庫台数: ${vehicles.length}台`);
    
    let checkedCount = 0;
    let newRecallCount = 0;
    
    for (const vehicle of vehicles) {
      console.log(`\nチェック中: ${vehicle.chassisNumber} (${vehicle.maker})`);
      
      try {
        // リコールチェック
        const result = await checkRecall(vehicle.chassisNumber, vehicle.maker);
        
        if (result.hasRecall && result.recalls.length > 0) {
          // 既存のリコールを取得
          const existingRecalls = await prisma.vehicleRecall.findMany({
            where: { vehicleId: vehicle.id },
            include: { recall: true }
          });
          
          const existingRecallIds = existingRecalls.map(r => r.recall.recallId);
          
          // 新しいリコールを検出
          for (const recall of result.recalls) {
            if (!existingRecallIds.includes(recall.recallId)) {
              console.log(`  ⚠️ 新リコール検出: ${recall.title}`);
              
              // リコール情報を保存
              const savedRecall = await prisma.recall.upsert({
                where: { recallId: recall.recallId },
                update: {},
                create: {
                  recallId: recall.recallId,
                  maker: result.maker,
                  title: recall.title,
                  description: recall.description,
                  severity: recall.severity,
                  publishedAt: new Date(recall.publishedAt)
                }
              });
              
              // 車両とリコールを関連付け
              await prisma.vehicleRecall.create({
                data: {
                  vehicleId: vehicle.id,
                  recallId: savedRecall.id,
                  status: 'pending'
                }
              });
              
              // アラートを作成
              await prisma.alert.create({
                data: {
                  vehicleId: vehicle.id,
                  title: `新リコール: ${recall.title}`,
                  message: `${vehicle.maker} ${vehicle.model || ''} (${vehicle.chassisNumber}) が新しいリコール対象になりました。`,
                  status: 'unread'
                }
              });
              
              newRecallCount++;
            }
          }
        }
        
        checkedCount++;
        
        // レート制限: 1秒待機
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`  エラー: ${error}`);
      }
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('チェック完了');
    console.log(`チェック台数: ${checkedCount}/${vehicles.length}`);
    console.log(`新規リコール: ${newRecallCount}件`);
    console.log('='.repeat(50));
    
  } catch (error) {
    console.error('実行エラー:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
