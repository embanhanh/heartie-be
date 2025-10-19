import { DataSource } from 'typeorm';
import { Attribute, AttributeType } from '../../src/modules/attributes/entities/attribute.entity';

const attributeSeeds: Array<{ name: string; type: AttributeType }> = [
  { name: 'Màu sắc', type: AttributeType.COMMON },
  { name: 'Kích thước', type: AttributeType.COMMON },
  { name: 'Chất liệu', type: AttributeType.COMMON },
];

export async function seedAttributes(dataSource: DataSource) {
  const repo = dataSource.getRepository(Attribute);

  for (const seed of attributeSeeds) {
    const existing = await repo.findOne({ where: { name: seed.name } });

    if (existing) {
      continue;
    }

    const entity = repo.create(seed);
    await repo.save(entity);
  }

  console.log('✅ Attribute seed data inserted successfully.');
}
