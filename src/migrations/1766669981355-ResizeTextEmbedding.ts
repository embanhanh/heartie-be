import { MigrationInterface, QueryRunner } from 'typeorm';

export class ResizeTextEmbedding1766669981355 implements MigrationInterface {
  name = 'ResizeTextEmbedding1766669981355';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Change embedding column from vector(512) to vector(768)
    // Note: vector(512) to vector(768) requires dropping the existing column or using an ALTER TYPE if pgvector supports it easily.
    // Usually, for pgvector, it's safer to alter the column type.

    await queryRunner.query(`ALTER TABLE "products" ALTER COLUMN "embedding" TYPE vector(768)`);
    await queryRunner.query(
      `ALTER TABLE "product_variants" ALTER COLUMN "embedding" TYPE vector(768)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "product_variants" ALTER COLUMN "embedding" TYPE vector(512)`,
    );
    await queryRunner.query(`ALTER TABLE "products" ALTER COLUMN "embedding" TYPE vector(512)`);
  }
}
