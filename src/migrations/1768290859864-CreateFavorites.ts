import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFavorites1768290859864 implements MigrationInterface {
  name = 'CreateFavorites1768290859864';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "daily_statistics" ALTER COLUMN "meta" SET DEFAULT '{}'::jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "review_insights" ALTER COLUMN "keyTopics" SET DEFAULT '[]'::jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "review_insights" ALTER COLUMN "keyTopics" SET DEFAULT '[]'`,
    );
    await queryRunner.query(`ALTER TABLE "daily_statistics" ALTER COLUMN "meta" SET DEFAULT '{}'`);
  }
}
