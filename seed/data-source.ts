import 'dotenv/config';
import { DataSource } from 'typeorm';
import { join } from 'path';
import { Brand } from '../src/modules/brands/entities/brand.entity';
import { Category } from '../src/modules/categories/entities/category.entity';
import { enablePostgresVectorType } from '../src/database/postgres-vector.util';

const parseNumber = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  if (Number.isNaN(parsed)) {
    return fallback;
  }

  return parsed;
};

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseNumber(process.env.DB_PORT, 5432),
  username: process.env.DB_USERNAME ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  database: process.env.DB_DATABASE ?? 'postgres',
  entities: [Brand, Category, join(__dirname, '..', 'src', '**', '*.entity.{ts,js}')],
  synchronize: true,
  logging: false,
  ssl: process.env.DB_SSL === 'true',
  extra:
    process.env.DB_SSL === 'true'
      ? {
          ssl: {
            rejectUnauthorized: false,
          },
        }
      : undefined,
});

enablePostgresVectorType(AppDataSource);
