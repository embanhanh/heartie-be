import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { enablePostgresVectorType } from './src/database/postgres-vector.util';

config();

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  entities: ['src/**/*.entity{.ts,.js}'],
  migrations: ['src/migrations/*{.ts,.js}'],
});

enablePostgresVectorType(dataSource);

export default dataSource;
