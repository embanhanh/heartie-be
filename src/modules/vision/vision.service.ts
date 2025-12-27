import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as sharp from 'sharp';

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

@Injectable()
export class VisionService implements OnModuleInit {
  private readonly logger = new Logger(VisionService.name);
  private detector: any;
  private embedder: any;
  private RawImage: any;

  async onModuleInit() {
    this.logger.log('Initializing Vision Models...');
    try {
      const { pipeline, RawImage, env } = await import('@xenova/transformers');

      // Configure transformers environment
      env.allowLocalModels = false;
      env.useBrowserCache = false;
      // Disable multi-threading to avoid worker blob issues in some Node environments
      env.backends.onnx.wasm.numThreads = 1;

      this.RawImage = RawImage;

      this.logger.log('Loading OwlViT (Zero-Shot Object Detection)...');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      this.detector = await pipeline('zero-shot-object-detection', 'Xenova/owlvit-base-patch32', {
        device: 'cpu',
      } as any);

      this.logger.log('Loading CLIP (Embedding)...');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      this.embedder = await pipeline('image-feature-extraction', 'Xenova/clip-vit-base-patch32', {
        device: 'cpu',
      } as any);

      this.logger.log('Vision Models loaded successfully');
    } catch (error) {
      this.logger.error('Failed to load Vision Models', error);
      throw error;
    }
  }

  async detectObjects(imageBuffer: Buffer): Promise<DetectionResult[]> {
    this.logger.debug('Detecting objects in image (OwlViT)...');
    const { data: rawData, info } = await sharp(imageBuffer)
      .removeAlpha()
      .resize({ width: 800, height: 800, fit: 'inside' })
      .raw()
      .toBuffer({ resolveWithObject: true });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
    const img = new this.RawImage(new Uint8Array(rawData), info.width, info.height, 3);

    const candidateLabels = [
      'shirt',
      'blouse',
      'top',
      't-shirt',
      'sweatshirt',
      'sweater',
      'cardigan',
      'jacket',
      'vest',
      'pants',
      'shorts',
      'skirt',
      'coat',
      'dress',
      'jumpsuit',
      'glasses',
      'hat',
      'tie',
      'glove',
      'watch',
      'belt',
      'stockings',
      'sock',
      'shoe',
      'bag',
      'wallet',
      'scarf',
    ];

    interface InternalDetection {
      score: number;
      label: string;
      box: { xmin: number; ymin: number; xmax: number; ymax: number };
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const output = (await this.detector(img, candidateLabels)) as InternalDetection[];

    return output.map((d) => ({
      label: d.label,
      score: d.score,
      box: {
        // OwlViT pipeline typically returns absolute coordinates, so we normalize them
        xmin: d.box.xmin / info.width,
        ymin: d.box.ymin / info.height,
        xmax: d.box.xmax / info.width,
        ymax: d.box.ymax / info.height,
      },
    }));
  }

  async generateEmbedding(imageBuffer: Buffer): Promise<number[]> {
    this.logger.debug('Generating embedding for image...');
    const { data: rawData, info } = await sharp(imageBuffer)
      .removeAlpha()
      .resize({ width: 224, height: 224, fit: 'cover' }) // Optimization for CLIP
      .raw()
      .toBuffer({ resolveWithObject: true });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
    const img = new this.RawImage(new Uint8Array(rawData), info.width, info.height, 3);

    // CLIP processing
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
    const output = await this.embedder(img);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const embeddingData = output.data as number[];
    return Array.from(embeddingData || []);
  }

  async cropImage(
    imageBuffer: Buffer,
    box: { xmin: number; ymin: number; xmax: number; ymax: number },
  ): Promise<Buffer> {
    const metadata = await sharp(imageBuffer).metadata();
    const width = metadata.width || 0;
    const height = metadata.height || 0;

    this.logger.debug(`Cropping image with dimensions ${width}x${height}`);

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
