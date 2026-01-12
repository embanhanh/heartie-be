import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVisualEmbedding1766669981354 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add visualEmbedding column to products and product_variants
    await queryRunner.query(
      `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "visualEmbedding" vector(512)`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "visualEmbedding" vector(512)`,
    );

    // Create HNSW indexes for visualEmbedding
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_products_visual_embedding_hnsw" ON "products" USING hnsw ("visualEmbedding" vector_cosine_ops) WITH (m = 16, ef_construction = 64)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_product_variants_visual_embedding_hnsw" ON "product_variants" USING hnsw ("visualEmbedding" vector_cosine_ops) WITH (m = 16, ef_construction = 64)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_product_variants_visual_embedding_hnsw"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_products_visual_embedding_hnsw"`);
    await queryRunner.query(
      `ALTER TABLE "product_variants" DROP COLUMN IF EXISTS "visualEmbedding"`,
    );
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "visualEmbedding"`);
  }
}
