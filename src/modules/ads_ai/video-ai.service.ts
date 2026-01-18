import { Injectable, Logger } from '@nestjs/common';
import { GeminiService } from '../gemini/gemini.service';
import { UploadService } from '../upload/upload.service';
import { randomUUID } from 'crypto';

export interface GenerateVideoParams {
  productName: string;
  description: string;
  price: string | number;
  promotion: string;
}

@Injectable()
export class VideoAiService {
  private readonly logger = new Logger(VideoAiService.name);

  constructor(
    private readonly geminiService: GeminiService,
    private readonly uploadService: UploadService,
  ) {}

  async generateVideoAd(params: GenerateVideoParams): Promise<{ url: string }> {
    this.logger.log(`Starting video generation for ${params.productName}`);

    // Extract product type and key features from description
    const productType = this.extractProductType(params.description, params.productName);
    const keyFeatures = this.extractKeyFeatures(params.description);

    // Build scene-by-scene prompt with specific visual direction
    let prompt = `Create a professional 8-second fashion advertising video for Vietnamese e-commerce platform Fashia.\n\n`;

    // Scene 1: Opening hook (0-3 seconds)
    prompt += `SCENE 1 (0-3 seconds):\n`;
    prompt += `Visual: Close-up shot of ${productType} displayed elegantly on a clean, modern surface. `;
    prompt += `Soft, professional lighting highlighting the product's texture and quality. `;
    prompt += `Camera: Slow dolly-in movement, creating depth and focus.\n`;
    prompt += `Setting: Minimalist Vietnamese contemporary aesthetic, bright and clean background.\n\n`;

    // Scene 2: Product showcase (3-6 seconds)
    if (keyFeatures.length > 0) {
      prompt += `SCENE 2 (3-6 seconds):\n`;
      prompt += `Visual: Quick cuts showcasing product details:\n`;
      keyFeatures.slice(0, 3).forEach((feature, i) => {
        prompt += `  ${i + 1}. ${feature}\n`;
      });
      prompt += `Camera: Dynamic angles, smooth transitions between shots.\n`;
      prompt += `Lighting: Bright, fashion photography style with soft shadows.\n\n`;
    } else {
      prompt += `SCENE 2 (3-6 seconds):\n`;
      prompt += `Visual: ${productType} shown from multiple angles - front, side, detail shots. `;
      prompt += `Emphasize modern design, quality materials, and contemporary Vietnamese fashion aesthetic.\n`;
      prompt += `Camera: Smooth rotation and close-up details.\n\n`;
    }

    // Scene 3: Call-to-action (6-8 seconds)
    prompt += `SCENE 3 (6-8 seconds):\n`;
    if (params.promotion) {
      prompt += `Visual: Animated text overlay "${params.promotion}" with dynamic motion graphics.\n`;
    } else if (params.price) {
      prompt += `Visual: Product with price tag "${params.price}" displayed elegantly.\n`;
    } else {
      prompt += `Visual: Product with "Shop Now" text overlay, inviting and modern.\n`;
    }
    prompt += `Background: Fashia brand aesthetic - vibrant, contemporary, appealing to young Vietnamese consumers.\n`;
    prompt += `Animation: Smooth, professional motion graphics.\n\n`;

    // Technical specifications
    prompt += `TECHNICAL REQUIREMENTS:\n`;
    prompt += `- Resolution: 4K, vertical format (9:16) suitable for Instagram/TikTok\n`;
    prompt += `- Style: Fashion commercial, cinematic, professional product photography\n`;
    prompt += `- Lighting: Bright, clean, soft shadows, premium feel\n`;
    prompt += `- Color palette: Modern, vibrant, aligned with Vietnamese fashion trends\n`;
    prompt += `- Transitions: Smooth, professional cuts and fades\n`;
    prompt += `- Overall tone: Upbeat, energetic, aspirational, suitable for young urban Vietnamese audience\n`;
    prompt += `- Duration: Exactly 8 seconds\n\n`;

    prompt += `IMPORTANT: Show actual ${productType}, not generic products. Use Vietnamese contemporary fashion aesthetic.`;

    this.logger.debug(`Generated video prompt: ${prompt.slice(0, 200)}...`);

    // Gọi hàm tạo video dùng Veo
    return this.generateVideoWithVeo(prompt);
  }

  private extractProductType(description: string, productName: string): string {
    const desc = (description + ' ' + productName).toLowerCase();

    // Fashion categories
    if (desc.includes('áo thun') || desc.includes('t-shirt') || desc.includes('tshirt'))
      return 'a modern cotton t-shirt';
    if (desc.includes('áo sơ mi') || desc.includes('shirt')) return 'a stylish dress shirt';
    if (desc.includes('quần jean') || desc.includes('jeans') || desc.includes('denim'))
      return 'trendy denim jeans';
    if (desc.includes('váy') || desc.includes('dress')) return 'an elegant dress';
    if (desc.includes('giày') || desc.includes('shoes') || desc.includes('sneaker'))
      return 'fashionable sneakers';
    if (desc.includes('túi') || desc.includes('bag')) return 'a stylish handbag';
    if (desc.includes('phụ kiện') || desc.includes('accessory')) return 'fashion accessories';

    // Default
    return 'a contemporary fashion item';
  }

  private extractKeyFeatures(description: string): string[] {
    const features: string[] = [];
    const desc = description.toLowerCase();

    // Extract colors
    const colors = ['trắng', 'đen', 'xanh', 'đỏ', 'vàng', 'white', 'black', 'blue', 'red'];
    colors.forEach((color) => {
      if (desc.includes(color)) {
        features.push(`${color.charAt(0).toUpperCase() + color.slice(1)} color variant`);
      }
    });

    // Extract materials
    if (desc.includes('cotton') || desc.includes('bông')) features.push('Premium cotton fabric');
    if (desc.includes('silk') || desc.includes('lụa')) features.push('Luxurious silk material');
    if (desc.includes('leather') || desc.includes('da')) features.push('Genuine leather');

    // Extract style keywords
    if (desc.includes('minimalist') || desc.includes('tối giản'))
      features.push('Minimalist design');
    if (desc.includes('modern') || desc.includes('hiện đại')) features.push('Modern style');
    if (desc.includes('elegant') || desc.includes('thanh lịch')) features.push('Elegant cut');

    return features;
  }

  async generateVideoWithVeo(prompt: string): Promise<{ url: string }> {
    const videoBuffer = await this.geminiService.generateVideo(prompt);

    // Tạo tên file ngẫu nhiên
    const filename = `veo-ad-${randomUUID()}.mp4`;

    // Upload lên Cloudinary
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const fileToUpload = {
      fieldname: 'video',
      originalname: filename,
      encoding: '7bit',
      mimetype: 'video/mp4',
      buffer: videoBuffer,
      size: videoBuffer.length,
    } as any; // Cast to any to fit UploadedFile type which might be missing some multer props

    this.logger.log(`Uploading Veo video to Cloudinary...`);
    const uploadResult = await this.uploadService.uploadSingle(fileToUpload, 'ads-videos');

    this.logger.log(`Veo video uploaded to ${uploadResult.url}`);

    return { url: uploadResult.url };
  }
}
