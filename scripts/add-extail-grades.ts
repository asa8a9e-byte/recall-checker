import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addExtailGrades() {
  try {
    // エクストレイルのモデルを取得
    const extailModel = await prisma.vehicleModel.findFirst({
      where: {
        name: {
          contains: 'エクストレイル'
        }
      }
    });

    if (!extailModel) {
      console.log('エクストレイルが見つかりませんでした');
      return;
    }

    console.log(`エクストレイル: ${extailModel.name}`);

    // 日産エクストレイル T33型（2022年～）の主要グレード
    const grades = [
      {
        gradeName: 'S e-4ORCE',
        typeCode: '5AA-T33',
        displacement: '1498cc',
        transmission: 'CVT',
        driveSystem: '4WD',
        seatingCapacity: '5名',
        fuelEfficiency: '18.3km/l',
      },
      {
        gradeName: 'S',
        typeCode: '5AA-NT33',
        displacement: '1498cc',
        transmission: 'CVT',
        driveSystem: 'FF',
        seatingCapacity: '5名',
        fuelEfficiency: '19.7km/l',
      },
      {
        gradeName: 'X e-4ORCE',
        typeCode: '5AA-T33',
        displacement: '1498cc',
        transmission: 'CVT',
        driveSystem: '4WD',
        seatingCapacity: '5名',
        fuelEfficiency: '18.3km/l',
      },
      {
        gradeName: 'X',
        typeCode: '5AA-NT33',
        displacement: '1498cc',
        transmission: 'CVT',
        driveSystem: 'FF',
        seatingCapacity: '5名',
        fuelEfficiency: '19.7km/l',
      },
      {
        gradeName: 'G e-4ORCE',
        typeCode: '5AA-T33',
        displacement: '1498cc',
        transmission: 'CVT',
        driveSystem: '4WD',
        seatingCapacity: '5名',
        fuelEfficiency: '18.3km/l',
      },
    ];

    for (const grade of grades) {
      // 既存チェック（vehicleModelId + typeCode の組み合わせ）
      const existing = await prisma.modelType.findFirst({
        where: {
          vehicleModelId: extailModel.id,
          typeCode: grade.typeCode
        }
      });

      if (existing) {
        // 既に同じ型式コードがある場合はスキップ
        console.log(`  スキップ: ${grade.gradeName} / ${grade.typeCode} (型式コード重複: ${existing.gradeName})`);
        continue;
      }

      await prisma.modelType.create({
        data: {
          vehicleModelId: extailModel.id,
          ...grade
        }
      });

      console.log(`  追加: ${grade.gradeName} / ${grade.typeCode}`);
    }

    console.log(`\n✓ ${grades.length}グレードを処理しました`);

    // 確認
    const count = await prisma.modelType.count({
      where: { vehicleModelId: extailModel.id }
    });

    console.log(`合計グレード数: ${count}`);

  } catch (error) {
    console.error('エラー:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addExtailGrades();
