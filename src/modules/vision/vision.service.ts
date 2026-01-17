import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import sharp from 'sharp';

export interface DetectionResult {
  label: string;
  score: number;
  box: {
    xmin: number;
    ymin: number;
    xmax: number;
    ymax: number;
  };
}

interface GeminiDetectionItem {
  label: string;
  score?: number;
  box_2d?: number[];
  box?: {
    xmin: number;
    ymin: number;
    xmax: number;
    ymax: number;
  };
}

@Injectable()
export class VisionService {
  private readonly logger = new Logger(VisionService.name);
  private genAI: GoogleGenerativeAI;
  private detectionModel: GenerativeModel;
  private descriptionModel: GenerativeModel;
  private embeddingModel: GenerativeModel;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      this.logger.error('GEMINI_API_KEY is not defined');
      throw new Error('GEMINI_API_KEY is required');
    }

    this.genAI = new GoogleGenerativeAI(apiKey);

    // Model for Object Detection (using Flash for speed/cost)
    this.detectionModel = this.genAI.getGenerativeModel({
      model: this.configService.get<string>('GEMINI_AI_MODEL') ?? 'gemini-1.5-flash',
      generationConfig: { responseMimeType: 'application/json' },
    });

    // Model for Description (to convert image to text for embedding)
    this.descriptionModel = this.genAI.getGenerativeModel({
      model: this.configService.get<string>('GEMINI_AI_MODEL') ?? 'gemini-1.5-flash',
    });

    // Model for Embeddings (Text)
    this.embeddingModel = this.genAI.getGenerativeModel({
      model: 'text-embedding-004',
    });
  }

  async detectObjects(imageBuffer: Buffer): Promise<DetectionResult[]> {
    this.logger.debug('Detecting objects via Gemini...');

    // Resize if too large to save tokens/bandwidth, though Gemini handles large images well.
    // 800x800 is a reasonable balance.
    const resizedBuffer = await sharp(imageBuffer)
      .resize({ width: 800, height: 800, fit: 'inside' })
      .toBuffer();

    const prompt = `
      Detect clothing items in this image. 
      Return a JSON list of objects. Each object must have:
      - "label": string (e.g. shirt, dress, pants, shoes, bag). use simple english terms.
      - "score": number (confidence between 0.0 and 1.0, assumed 0.9 if sure)
      - "box_2d": [ymin, xmin, ymax, xmax] (normalized coordinates 0-1000). 
      IMPORTANT: Return standardized JSON format like: 
      [{"label": "shirt", "score": 0.95, "box_2d": [100, 200, 500, 600]}]
    `;

    try {
      const result = await this.detectionModel.generateContent([
        prompt,
        {
          inlineData: {
            data: resizedBuffer.toString('base64'),
            mimeType: 'image/jpeg',
          },
        },
      ]);

      const responseText = result.response.text();
      this.logger.debug(`Gemini Detection Response: ${responseText}`);

      // Basic parsing of the JSON response
      let parsed: GeminiDetectionItem[] = [];
      try {
        const raw = JSON.parse(responseText) as unknown;
        if (Array.isArray(raw)) {
          parsed = raw as GeminiDetectionItem[];
        } else if (raw && typeof raw === 'object') {
          // Sometimes Gemini wraps in { "result": [...] } or similar
          const r = raw as { result?: GeminiDetectionItem[]; objects?: GeminiDetectionItem[] };
          parsed = r.result || r.objects || [];
          if (!Array.isArray(parsed)) parsed = [];
        }
      } catch (e) {
        this.logger.warn('Failed to parse Gemini JSON output', e);
        return [];
      }

      return parsed.map((item) => {
        let box = { xmin: 0, ymin: 0, xmax: 0, ymax: 0 };

        // Handle Gemini 0-1000 normalized coordinates
        if (Array.isArray(item.box_2d) && item.box_2d.length === 4) {
          const [ymin, xmin, ymax, xmax] = item.box_2d;
          box = {
            xmin: xmin / 1000,
            ymin: ymin / 1000,
            xmax: xmax / 1000,
            ymax: ymax / 1000,
          };
        } else if (item.box) {
          // Fallback if it returned 'box' object
          box = item.box;
        }

        return {
          label: item.label,
          score: item.score ?? 0.8,
          box,
        };
      });
    } catch (error) {
      this.logger.error('Gemini Object Detection Failed', error);
      return [];
    }
  }

  async generateEmbedding(imageBuffer: Buffer): Promise<number[]> {
    // this.logger.debug('Generating embedding via Gemini (Describe -> Embed)...');
    try {
      // 1. Resize for description
      const resizedBuffer = await sharp(imageBuffer)
        .resize({ width: 512, height: 512, fit: 'inside' })
        .toFormat('jpeg')
        .toBuffer();

      // 2. Describe image
      const descriptionResult = await this.descriptionModel.generateContent([
        'Describe the main clothing item in this image in detail: details, color, material, style, pattern. Be concise (max 50 words).',
        {
          inlineData: {
            data: resizedBuffer.toString('base64'),
            mimeType: 'image/jpeg',
          },
        },
      ]);
      const description = descriptionResult.response.text();
      // this.logger.debug(`Image Description: ${description}`);

      if (!description) {
        this.logger.warn('Empty description from Gemini');
        return [];
      }

      // 3. Embed description
      const embeddingResult = await this.embeddingModel.embedContent(description);

      const embedding = embeddingResult.embedding.values;
      // this.logger.debug(`Generated embedding with dimension: ${embedding.length}`);
      return embedding;
    } catch (error) {
      this.logger.error('Gemini Embedding Failed: ', error);
      return [];
    }
  }

  async cropImage(
    imageBuffer: Buffer,
    box: { xmin: number; ymin: number; xmax: number; ymax: number },
  ): Promise<Buffer> {
    const metadata = await sharp(imageBuffer).metadata();
    const width = metadata.width || 0;
    const height = metadata.height || 0;

    // this.logger.debug(`Cropping image with dimensions ${width}x${height}`);

    const left = Math.max(0, Math.min(width - 1, Math.round(box.xmin * width)));
    const top = Math.max(0, Math.min(height - 1, Math.round(box.ymin * height)));
    const right = Math.max(0, Math.min(width, Math.round(box.xmax * width)));
    const bottom = Math.max(0, Math.min(height, Math.round(box.ymax * height)));

    const widthCrop = Math.max(1, right - left);
    const heightCrop = Math.max(1, bottom - top);

    return sharp(imageBuffer)
      .extract({ left, top, width: widthCrop, height: heightCrop })
      .toBuffer();
  }
}
