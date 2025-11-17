import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateReviewInsights1731000000001 implements MigrationInterface {
  name = 'CreateReviewInsights1731000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "review_insights" (
        "id" SERIAL PRIMARY KEY,
        "ratingId" integer NOT NULL UNIQUE,
        "sentiment" character varying(16) NOT NULL,
        "keyTopics" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "summary" text NOT NULL,
        "rawResponse" jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "FK_review_insights_rating" FOREIGN KEY ("ratingId") REFERENCES "ratings"("id") ON DELETE CASCADE
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "review_insights";');
  }
}
