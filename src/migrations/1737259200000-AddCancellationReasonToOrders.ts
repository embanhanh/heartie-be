import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddCancellationReasonToOrders1737259200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'orders',
      new TableColumn({
        name: 'cancellationReason',
        type: 'text',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('orders', 'cancellationReason');
  }
}
