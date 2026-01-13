import { DataSource } from 'typeorm';
import { Attribute, AttributeType } from '../../src/modules/attributes/entities/attribute.entity';
import { AttributeValue } from '../../src/modules/attribute_values/entities/attribute-value.entity';
import * as colorSizeData from '../assets/color_size_extracted.json';

const attributeSeeds: Array<{ name: string; type: AttributeType }> = [
  { name: 'Màu sắc', type: AttributeType.COMMON },
  { name: 'Kích thước', type: AttributeType.COMMON },
  { name: 'Chất liệu', type: AttributeType.COMMON },
  { name: 'Khác', type: AttributeType.COMMON },
];

export async function seedAttributes(dataSource: DataSource) {
  const attributeRepo = dataSource.getRepository(Attribute);
  const attributeValueRepo = dataSource.getRepository(AttributeValue);

  // Seed attributes
  const colorAttribute = await upsertAttribute(attributeRepo, attributeSeeds[0]);
  const sizeAttribute = await upsertAttribute(attributeRepo, attributeSeeds[1]);
  // const materialAttribute = await upsertAttribute(attributeRepo, attributeSeeds[2]);
  const otherAttribute = await upsertAttribute(attributeRepo, attributeSeeds[3]);

  // Seed color values
  const colors = (colorSizeData as { colors: string[]; sizes: string[]; others: string[] }).colors;
  for (const color of colors) {
    const value = color.trim();
    if (!value) continue;

    const existing = await attributeValueRepo.findOne({
      where: { attributeId: colorAttribute.id, value },
    });
    if (!existing) {
      const entity = attributeValueRepo.create({
        attributeId: colorAttribute.id,
        value,
      });
      await attributeValueRepo.save(entity);
    }
  }

  // Seed size values
  const sizes = (colorSizeData as { colors: string[]; sizes: string[]; others: string[] }).sizes;
  for (const size of sizes) {
    const value = size.trim();
    if (!value) continue;

    const existing = await attributeValueRepo.findOne({
      where: { attributeId: sizeAttribute.id, value },
    });
    if (!existing) {
      const entity = attributeValueRepo.create({
        attributeId: sizeAttribute.id,
        value,
      });
      await attributeValueRepo.save(entity);
    }
  }

  // Seed orther value
  const orthers = (colorSizeData as { colors: string[]; sizes: string[]; others: string[] }).others;
  for (const orther of orthers) {
    const value = orther.trim();
    if (!value) continue;

    const existing = await attributeValueRepo.findOne({
      where: { attributeId: otherAttribute.id, value },
    });
    if (!existing) {
      const entity = attributeValueRepo.create({
        attributeId: otherAttribute.id,
        value,
      });
      await attributeValueRepo.save(entity);
    }
  }

  console.log('✅ Attribute seed data inserted successfully.');
}

async function upsertAttribute(
  repo: ReturnType<DataSource['getRepository']>,
  seed: { name: string; type: AttributeType },
): Promise<Attribute> {
  let attribute = await repo.findOne({ where: { name: seed.name } });
  if (!attribute) {
    attribute = repo.create(seed);
    attribute = await repo.save(attribute);
  }
  return attribute as Attribute;
}
