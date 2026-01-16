import { NestFactory } from '@nestjs/core';
import { AppModule } from 'src/app.module';
import { ImageSearchService } from 'src/modules/image_search/image-search.service';
import * as fs from 'fs';
import * as path from 'path';

async function testSearch() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const searchService = app.get(ImageSearchService);

  // Pick a random product with an image to use as test query
  const productsDir = path.join(process.cwd(), 'uploads/products');
  if (!fs.existsSync(productsDir)) {
    console.error('No products directory found');
    await app.close();
    return;
  }

  const files = fs
    .readdirSync(productsDir)
    .filter((f) => f.endsWith('.jpg') || f.endsWith('.png') || f.endsWith('.webp'));
  if (files.length === 0) {
    console.error('No images found in uploads/products');
    await app.close();
    return;
  }

  const testFile = path.join(productsDir, files[0]);
  console.log(`Testing search with image: ${testFile}`);

  const buffer = fs.readFileSync(testFile);
  const results = await searchService.searchByImage(buffer);

  console.log('Search Results:');
  console.dir(results, { depth: null });

  await app.close();
}

void testSearch();
