import { Injectable, Logger } from '@nestjs/common';
import { VisionService } from '../vision/vision.service';
import { DataSource } from 'typeorm';

export interface MatchResult {
  id: number;
  variantId: number | null;
  name: string;
  image: string | null;
  price: number;
  score: number;
}

export interface ImageSearchResult {
  object: string;
  box: { xmin: number; ymin: number; xmax: number; ymax: number };
  score: number;
  products: MatchResult[];
}

interface DbMatchRow {
  product_id: string;
  variant_id: string | null;
  score: string;
  name: string;
  image: string | null;
  originalPrice: string;
}

@Injectable()
export class ImageSearchService {
  private readonly logger = new Logger(ImageSearchService.name);

  constructor(
    private readonly visionService: VisionService,
    private readonly dataSource: DataSource,
  ) {}

  async searchByImage(imageBuffer: Buffer): Promise<ImageSearchResult[]> {
    // 1. Detect Objects
    const detections = await this.visionService.detectObjects(imageBuffer);
    this.logger.debug(`Detected ${detections.length} objects`);

    const results: ImageSearchResult[] = [];

    // 2. Process each detected object
    for (const detection of detections) {
      const { score, label, box } = detection;
      this.logger.debug(`Processing object: ${label} with score ${score}`);

      if (score < 0.3) continue;

      try {
        // 3. Crop and Embed
        const croppedBuffer = await this.visionService.cropImage(imageBuffer, box);
        const embedding = await this.visionService.generateEmbedding(croppedBuffer);

        // 4. Search in DB (Hierarchical Query)
        const matches = await this.searchByEmbedding(embedding);

        results.push({
          object: label,
          box,
          score,
          products: matches,
        });
      } catch (error) {
        this.logger.error(`Error processing detection ${label}:`, error);
      }
    }

    return results;
  }

  async searchByEmbedding(embedding: number[]): Promise<MatchResult[]> {
    const vectorSql = `ARRAY[${embedding.join(',')}]::vector`;

    // Hierarchical Query: Find best matching products or variants
    // We use a CTE or Union to get scores from both tables and then aggregate
    const query = `
      WITH product_scores AS (
        SELECT id as product_id, NULL::integer as variant_id, ("visualEmbedding" <=> ${vectorSql}) as distance
        FROM products
        WHERE "visualEmbedding" IS NOT NULL
      ),
      variant_scores AS (
        SELECT "productId" as product_id, id as variant_id, ("visualEmbedding" <=> ${vectorSql}) as distance
        FROM product_variants
        WHERE "visualEmbedding" IS NOT NULL
      ),
      all_scores AS (
        SELECT * FROM product_scores
        UNION ALL
        SELECT * FROM variant_scores
      )
      SELECT 
        s.product_id, 
        s.variant_id, 
        s.distance as score,
        p.name,
        p.image,
        p."originalPrice"
      FROM all_scores s
      JOIN products p ON p.id = s.product_id
      ORDER BY s.distance ASC
      LIMIT 10
    `;

    const rawResults: DbMatchRow[] = await this.dataSource.query(query);
    this.logger.debug(`Found ${rawResults.length} matches in database`);

    if (rawResults.length === 0) {
      // Check if there are ANY embeddings to ensure data exists
      const countResult: Array<{ count: string }> = await this.dataSource.query(
        `SELECT count(*) FROM products WHERE "visualEmbedding" IS NOT NULL`,
      );
      this.logger.debug(`Total products with visual embeddings: ${countResult[0]?.count ?? 0}`);
    }

    return rawResults.map((r) => ({
      id: Number(r.product_id),
      variantId: r.variant_id ? Number(r.variant_id) : null,
      name: r.name,
      image: r.image,
      price: Number(r.originalPrice),
      score: 1 - Number(r.score), // Distance to similarity
    }));
  }
}
