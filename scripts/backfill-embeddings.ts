import { NestFactory } from '@nestjs/core';
import { AppModule } from 'src/app.module';
import { ProductsService } from 'src/modules/products/products.service';
import { ProductVariantsService } from 'src/modules/product_variants/product_variants.service';
import { DataSource } from 'typeorm';
import { Logger } from '@nestjs/common';

interface IdRow {
  id: number;
}

async function bootstrap() {
  const logger = new Logger('BackfillEmbeddings');
  const app = await NestFactory.createApplicationContext(AppModule);

  const productsService = app.get(ProductsService);
  const variantsService = app.get(ProductVariantsService);
  const dataSource = app.get(DataSource);

  try {
    // 1. Get all products with images
    const products: IdRow[] = await dataSource.query(
      `SELECT id FROM products WHERE image IS NOT NULL AND ("visualEmbedding" IS NULL OR "embedding" IS NULL)`,
    );
    logger.log(`Found ${products.length} products to backfill`);

    for (const p of products) {
      logger.log(`Processing product ${p.id}...`);
      try {
        // @ts-expect-error - accessing private method for script
        await productsService.refreshProductEmbeddingSafely(p.id);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        logger.error(`Failed for product ${p.id}: ${message}`);
      }
    }

    // 2. Get all variants with images
    const variants: IdRow[] = await dataSource.query(
      `SELECT id FROM product_variants WHERE image IS NOT NULL AND ("visualEmbedding" IS NULL OR "embedding" IS NULL)`,
    );
    logger.log(`Found ${variants.length} variants to backfill`);

    for (const v of variants) {
      logger.log(`Processing variant ${v.id}...`);
      try {
        // @ts-expect-error - accessing private method for script
        await variantsService.refreshVariantEmbeddingSafely(v.id);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        logger.error(`Failed for variant ${v.id}: ${message}`);
      }
    }

    logger.log('Backfill completed successfully');
  } catch (error) {
    logger.error('Backfill failed', error);
  } finally {
    await app.close();
  }
}

void bootstrap();
