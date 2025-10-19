import { DataSource } from 'typeorm';
import { Brand, BrandStatus } from '../../src/modules/brands/entities/brand.entity';

const brandSeeds: Array<{ name: string; status: BrandStatus }> = [
  { name: 'Nike', status: BrandStatus.ACTIVE },
  { name: 'Adidas', status: BrandStatus.ACTIVE },
  { name: 'Gucci', status: BrandStatus.ACTIVE },
  { name: 'Zara', status: BrandStatus.ACTIVE },
  { name: 'H&M', status: BrandStatus.ACTIVE },
  { name: 'Uniqlo', status: BrandStatus.ACTIVE },
  { name: 'Chanel', status: BrandStatus.ACTIVE },
  { name: 'Dior', status: BrandStatus.ACTIVE },
  { name: 'Levi’s', status: BrandStatus.ACTIVE },
  { name: 'Puma', status: BrandStatus.ACTIVE },
];

export async function seedBrands(dataSource: DataSource) {
  const repo = dataSource.getRepository(Brand);

  for (const seed of brandSeeds) {
    const existing = await repo.findOne({ where: { name: seed.name } });

    if (existing) {
      continue;
    }

    const brand = repo.create(seed);
    await repo.save(brand);
  }

  console.log('✅ Brand seed data inserted successfully.');
}
