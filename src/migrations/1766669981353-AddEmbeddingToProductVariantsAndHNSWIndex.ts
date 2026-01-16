import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmbeddingToProductVariantsAndHNSWIndex1766669981353 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add embedding column to product_variants if it doesn't exist
    await queryRunner.query(
      `ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "embedding" vector(512)`,
    );

    // Create HNSW indexes for faster similarity search
    // For products (using cosine distance <=> which is 1 - cosine similarity)
    // We use m=16, ef_construction=64 as reasonable defaults
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_products_embedding_hnsw" ON "products" USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)`,
    );

    // For product_variants
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_product_variants_embedding_hnsw" ON "product_variants" USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_product_variants_embedding_hnsw"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_products_embedding_hnsw"`);
    await queryRunner.query(`ALTER TABLE "product_variants" DROP COLUMN IF EXISTS "embedding"`);
  }
}
