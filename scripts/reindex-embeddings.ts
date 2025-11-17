import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { SemanticSearchService } from '../src/modules/semantic_search/semantic-search.service';

async function bootstrap() {
  const appContext = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const semanticSearchService = appContext.get(SemanticSearchService);
    const result = await semanticSearchService.reindexAllProducts();

    console.log(
      `Embedding reindex completed. Indexed=${result.indexed}, skipped=${result.skipped}, failures=${result.failures.length}`,
    );

    if (result.failures.length) {
      console.error('Failed product embeddings:', result.failures);
    }
  } catch (error) {
    console.error('Failed to reindex embeddings', error);
    process.exitCode = 1;
  } finally {
    await appContext.close();
  }
}

bootstrap().catch((error) => {
  console.error('Unexpected error during semantic search reindex', error);
  process.exit(1);
});
