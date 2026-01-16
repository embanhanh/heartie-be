import { MigrationInterface, QueryRunner, Table, TableIndex, TableUnique } from 'typeorm';

export class CreateDailyStatistics1732000000002 implements MigrationInterface {
  private tableName = 'daily_statistics';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: this.tableName,
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'date',
            type: 'date',
            isNullable: false,
          },
          {
            name: 'branchId',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'totalRevenue',
            type: 'numeric',
            precision: 14,
            scale: 2,
            default: 0,
          },
          {
            name: 'totalOrders',
            type: 'int',
            default: 0,
          },
          {
            name: 'totalCustomers',
            type: 'int',
            default: 0,
          },
          {
            name: 'totalProductsSold',
            type: 'int',
            default: 0,
          },
          {
            name: 'meta',
            type: 'jsonb',
            default: "'{}'::jsonb",
          },
          {
            name: 'createdAt',
            type: 'timestamptz',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamptz',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.createUniqueConstraint(
      this.tableName,
      new TableUnique({
        name: 'UQ_daily_statistics_date_branch',
        columnNames: ['date', 'branchId'],
      }),
    );

    await queryRunner.createIndex(
      this.tableName,
      new TableIndex({
        name: 'IDX_daily_statistics_date',
        columnNames: ['date'],
      }),
    );

    await queryRunner.createIndex(
      this.tableName,
      new TableIndex({
        name: 'IDX_daily_statistics_branch_date',
        columnNames: ['branchId', 'date'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex(this.tableName, 'IDX_daily_statistics_branch_date');
    await queryRunner.dropIndex(this.tableName, 'IDX_daily_statistics_date');
    await queryRunner.dropUniqueConstraint(this.tableName, 'UQ_daily_statistics_date_branch');
    await queryRunner.dropTable(this.tableName, true);
  }
}
