import { DataSource } from 'typeorm';
import { PostgresDriver } from 'typeorm/driver/postgres/PostgresDriver';

type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

export function enablePostgresVectorType(dataSource: DataSource) {
  if (dataSource.options.type !== 'postgres') {
    return;
  }

  const driver = dataSource.driver as PostgresDriver;
  const mutableDriver = driver as Mutable<PostgresDriver> & {
    supportedDataTypes: string[];
    dataTypeDefaults: Record<string, unknown>;
  };

  if (!mutableDriver.supportedDataTypes.includes('vector')) {
    mutableDriver.supportedDataTypes.push('vector');
  }

  if (!mutableDriver.dataTypeDefaults.vector) {
    mutableDriver.dataTypeDefaults.vector = {};
  }
}
