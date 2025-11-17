import { AppDataSource } from './data-source';
import { seedBrands } from './modules/brands.seed';
import { seedCategories } from './modules/categories.seed';
import { seedAttributes } from './modules/attributes.seed';
import { seedBranches } from './modules/branches.seed';
import { seedBanners } from './modules/banners.seed';
import { seedUsers } from './modules/users.seed';
import { seedProducts } from './modules/products.seed';
import type { DataSource } from 'typeorm';

const seedRegistry = {
  brands: seedBrands,
  categories: seedCategories,
  attributes: seedAttributes,
  branches: seedBranches,
  banners: seedBanners,
  users: seedUsers,
  products: seedProducts,
} satisfies Record<string, (dataSource: DataSource) => Promise<void>>;

type SeedKey = keyof typeof seedRegistry;

function parseSeedTargets(): SeedKey[] {
  const args = process.argv.slice(2);

  if (!args.length) {
    return Object.keys(seedRegistry) as SeedKey[];
  }

  const requested = new Set<SeedKey>();
  let runAll = false;
  const invalid: string[] = [];

  for (const arg of args) {
    const tokens = arg.startsWith('--module=')
      ? arg.slice('--module='.length).split(',')
      : arg.split(',');

    for (const rawToken of tokens) {
      const token = rawToken.trim();

      if (!token) {
        continue;
      }

      if (token.toLowerCase() === 'all') {
        runAll = true;
        continue;
      }

      if (token in seedRegistry) {
        requested.add(token as SeedKey);
      } else {
        invalid.push(token);
      }
    }
  }

  if (invalid.length) {
    console.warn(`⚠️  Unknown seed modules skipped: ${invalid.join(', ')}`);
  }

  if (runAll || requested.size === 0) {
    return Object.keys(seedRegistry) as SeedKey[];
  }

  return [...requested];
}

async function bootstrap() {
  const targets = parseSeedTargets();

  try {
    await AppDataSource.initialize();

    for (const key of targets) {
      console.log(`➡️  Seeding module: ${key}`);
      await seedRegistry[key](AppDataSource);
    }

    console.log('✅ Seeding completed.');
  } catch (error) {
    console.error('❌ Failed to seed data:', error);
    process.exitCode = 1;
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

void bootstrap();
