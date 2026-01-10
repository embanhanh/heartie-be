import { GenerativeModel, GoogleGenerativeAI } from '@google/generative-ai';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import axios, { AxiosError, AxiosInstance } from 'axios';
import FormData from 'form-data';
import { createReadStream, existsSync, promises as fsPromises } from 'fs';
import { join } from 'path';
import { BaseService } from 'src/common/services/base.service';
import { UploadedFile } from 'src/common/types/uploaded-file.type';
import { resolveModuleUploadPath } from 'src/common/utils/upload.util';
import { LessThanOrEqual, Repository } from 'typeorm';
import { ProductVariantStatus } from '../product_variants/entities/product_variant.entity';
import { Product } from '../products/entities/product.entity';
import { AdsAiQueryDto } from './dto/ads-ai-query.dto';
import { CreateAdsAiDto } from './dto/create-ads-ai.dto';
import { GenerateAdsAiDto } from './dto/generate-ads-ai.dto';
import { PublishAdsAiDto } from './dto/publish-ads-ai.dto';
import { ScheduleAdsAiDto } from './dto/schedule-ads-ai.dto';
import { UpdateAdsAiDto } from './dto/update-ads-ai.dto';
import { AdsAiCampaign, AdsAiPostType, AdsAiStatus } from './entities/ads-ai-campaign.entity';
import { GeneratedAdContent } from './interfaces/generated-ad-content.interface';
import { StatsTrackingService } from '../stats/services/stats-tracking.service';

const MODULE_NAME = 'ads-ai';

type GeneratedContentFields = Omit<GeneratedAdContent, 'prompt'>;

@Injectable()
export class AdsAiService extends BaseService<AdsAiCampaign> {
  private readonly logger = new Logger(AdsAiService.name);
  private geminiClient?: GoogleGenerativeAI;
  private readonly geminiModels = new Map<string, GenerativeModel>();
  private readonly httpClient: AxiosInstance;

  constructor(
    @InjectRepository(AdsAiCampaign)
    private readonly repo: Repository<AdsAiCampaign>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    private readonly configService: ConfigService,
    private readonly statsTrackingService: StatsTrackingService,
  ) {
    super(repo, 'ad');
    this.httpClient = axios.create({ timeout: 10000 });
  }

  async generateCreative(dto: GenerateAdsAiDto): Promise<GeneratedAdContent> {
    const { prompt, product, productName, hasExplicitProductName } = await this.buildPrompt(dto);
    const modelName = this.configService.get<string>('GEMINI_AD_MODEL') ?? 'gemini-2.5-flash';
    const model = this.getGeminiModel(modelName);

    try {
      const instruction =
        'Bạn là chuyên gia marketing Facebook Ads. Hãy viết nội dung ngắn gọn, hấp dẫn và thuần tiếng Việt.';
      const generation = await model.generateContent({
        contents: [
          {
            role: 'user',
            parts: [{ text: `${instruction}\n\n${prompt}` }],
          },
        ],
        generationConfig: {
          temperature: 0.6,
        },
      });

      const rawOutput = generation.response?.text() ?? '';
      const parsed = this.parseAiResponse(rawOutput);
      const content = this.enforceCreativeRules(parsed, {
        dto,
        product,
        productName,
        hasExplicitProductName,
      });

      return {
        prompt,
        primaryText: content.primaryText,
        headline: content.headline,
        description: content.description,
        callToAction: content.callToAction,
        hashtags: content.hashtags,
      };
    } catch (error) {
      const normalized = this.normalizeGeminiError(error);
      this.logger.error(normalized.logMessage, normalized.stack);
      throw new BadRequestException(normalized.clientMessage);
    }
  }

  async createFromForm(dto: CreateAdsAiDto, file?: UploadedFile) {
    const imagePath = resolveModuleUploadPath(
      MODULE_NAME,
      file,
      this.normalizeImageInput(dto.image),
    );
    const scheduledAt = this.normalizeScheduledDate(dto.scheduledAt);
    const status = scheduledAt ? AdsAiStatus.SCHEDULED : AdsAiStatus.DRAFT;

    // Nếu có hình ảnh (từ upload hoặc đường dẫn sẵn có) thì ưu tiên postType là PHOTO
    const basePostType = this.normalizePostTypeInput(dto.postType);
    const resolvedPostType = imagePath ? AdsAiPostType.PHOTO : basePostType;

    const product = await this.resolveProduct(dto.productId, { strict: !!dto.productId });

    const entity = this.repo.create({
      name: dto.name,
      productId: product?.id ?? null,
      productName: dto.productName ?? product?.name ?? null,
      targetAudience: dto.targetAudience ?? null,
      tone: dto.tone ?? null,
      objective: dto.objective ?? null,
      callToAction: dto.callToAction ?? null,
      ctaUrl: dto.ctaUrl ?? null,
      prompt: dto.prompt ?? null,
      primaryText: dto.primaryText ?? null,
      headline: dto.headline ?? null,
      description: dto.description ?? null,
      hashtags: this.normalizeStoredHashtags(dto.hashtags),
      image: imagePath ?? null,
      postType: resolvedPostType,
      status,
      scheduledAt,
    });

    return this.repo.save(entity);
  }

  async updateFromForm(id: number, dto: UpdateAdsAiDto, file?: UploadedFile) {
    const ad = await this.getCampaignOrFail(id);

    let product: Product | null = null;
    if (dto.productId !== undefined) {
      product = await this.resolveProduct(dto.productId, { strict: true });
      ad.productId = product?.id ?? null;
    } else if (ad.productId) {
      product = await this.resolveProduct(ad.productId, { strict: false });
    }

    if (dto.name !== undefined) {
      ad.name = dto.name;
    }

    if (dto.productName !== undefined) {
      ad.productName = dto.productName ?? null;
    } else if (product && dto.productId !== undefined) {
      ad.productName = product.name;
    }

    if (dto.targetAudience !== undefined) {
      ad.targetAudience = dto.targetAudience ?? null;
    }
    if (dto.tone !== undefined) {
      ad.tone = dto.tone ?? null;
    }
    if (dto.objective !== undefined) {
      ad.objective = dto.objective ?? null;
    }
    if (dto.callToAction !== undefined) {
      ad.callToAction = dto.callToAction ?? null;
    }
    if (dto.postType !== undefined) {
      ad.postType = this.normalizePostTypeInput(dto.postType);
    }

    if (dto.ctaUrl !== undefined) {
      ad.ctaUrl = dto.ctaUrl ?? null;
    }
    if (dto.prompt !== undefined) {
      ad.prompt = dto.prompt ?? null;
    }
    if (dto.primaryText !== undefined) {
      ad.primaryText = dto.primaryText ?? null;
    }
    if (dto.headline !== undefined) {
      ad.headline = dto.headline ?? null;
    }
    if (dto.description !== undefined) {
      ad.description = dto.description ?? null;
    }
    if (dto.hashtags !== undefined) {
      ad.hashtags = this.normalizeStoredHashtags(dto.hashtags) ?? null;
    }

    const normalizedImage = this.normalizeImageInput(dto.image);

    if (file) {
      await this.deleteImageIfExists(ad.image);
      ad.image = resolveModuleUploadPath(MODULE_NAME, file) ?? null;
    } else if (normalizedImage !== undefined) {
      if (normalizedImage === null) {
        await this.deleteImageIfExists(ad.image);
        ad.image = null;
      } else {
        ad.image = normalizedImage;
      }
    }

    // Tự động đồng bộ postType với trạng thái ảnh:
    // - Nếu có ảnh -> PHOTO
    // - Nếu không có ảnh và đang là PHOTO -> quay về LINK để tránh lỗi publish
    if (ad.image) {
      ad.postType = AdsAiPostType.PHOTO;
    } else if (ad.postType === AdsAiPostType.PHOTO) {
      ad.postType = AdsAiPostType.LINK;
    }

    if (dto.scheduledAt !== undefined) {
      const scheduledAt = this.normalizeScheduledDate(dto.scheduledAt);
      ad.scheduledAt = scheduledAt;
      ad.status = scheduledAt ? AdsAiStatus.SCHEDULED : ad.status;
    }

    return this.repo.save(ad);
  }

  async findAll(query: AdsAiQueryDto) {
    const { status, search, scheduledFrom, scheduledTo, createdFrom, createdTo } = query;

    return this.paginate(query, (qb) => {
      if (status) {
        qb.andWhere('ad.status = :status', { status });
      }

      if (search) {
        const keyword = `%${search.toLowerCase()}%`;
        qb.andWhere('(LOWER(ad.name) LIKE :keyword OR LOWER(ad.productName) LIKE :keyword)', {
          keyword,
        });
      }

      if (scheduledFrom) {
        const fromDate = this.normalizeScheduledDate(scheduledFrom);
        if (fromDate) {
          qb.andWhere('ad.scheduledAt >= :scheduledFrom', { scheduledFrom: fromDate });
        }
      }

      if (scheduledTo) {
        const toDate = this.normalizeScheduledDate(scheduledTo);
        if (toDate) {
          qb.andWhere('ad.scheduledAt <= :scheduledTo', { scheduledTo: toDate });
        }
      }

      if (createdFrom instanceof Date && !Number.isNaN(createdFrom.getTime())) {
        qb.andWhere('ad.createdAt >= :createdFrom', { createdFrom });
      }

      if (createdTo instanceof Date && !Number.isNaN(createdTo.getTime())) {
        qb.andWhere('ad.createdAt <= :createdTo', { createdTo });
      }

      qb.orderBy('ad.updatedAt', 'DESC');
    });
  }

  async findOne(id: number) {
    const campaign = await this.repo.findOne({ where: { id } });

    if (campaign) {
      this.statsTrackingService.recordArticleView(campaign.id).catch((error) => {
        const reason = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Failed to record article view for campaign ${campaign.id}: ${reason}`);
      });
    }

    return campaign;
  }

  async schedule(id: number, dto: ScheduleAdsAiDto) {
    const ad = await this.getCampaignOrFail(id);
    const scheduledAt = this.normalizeScheduledDate(dto.scheduledAt);

    if (!scheduledAt) {
      throw new BadRequestException('Thời gian lên lịch không hợp lệ');
    }

    const now = new Date();
    if (scheduledAt.getTime() < now.getTime()) {
      throw new BadRequestException('Thời gian lên lịch phải lớn hơn hiện tại');
    }

    ad.scheduledAt = scheduledAt;
    ad.status = AdsAiStatus.SCHEDULED;
    ad.failureReason = null;

    return this.repo.save(ad);
  }

  async publishNow(id: number, dto: PublishAdsAiDto) {
    const ad = await this.getCampaignOrFail(id);
    this.ensurePublishable(ad);
    return this.publishCampaign(ad, dto.note);
  }

  async remove(id: number) {
    const ad = await this.getCampaignOrFail(id);
    await this.repo.delete(id);
    await this.deleteImageIfExists(ad.image);
    return { id };
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async handleScheduledPublishing() {
    const now = new Date();
    const dueAds = await this.repo.find({
      where: {
        status: AdsAiStatus.SCHEDULED,
        scheduledAt: LessThanOrEqual(now),
      },
      order: { scheduledAt: 'ASC' },
      take: 5,
    });

    for (const ad of dueAds) {
      try {
        this.ensurePublishable(ad);
        await this.publishCampaign(ad);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Không xác định';
        this.logger.error(`Không thể đăng chiến dịch #${ad.id}: ${message}`);
        await this.markAsFailed(ad, message);
      }
    }
  }

  private async publishCampaign(ad: AdsAiCampaign, note?: string) {
    const accessToken = this.configService.get<string>('FACEBOOK_PAGE_ACCESS_TOKEN');
    const pageId = this.configService.get<string>('FACEBOOK_PAGE_ID');

    if (!accessToken || !pageId) {
      throw new BadRequestException('Chưa cấu hình Facebook PAGE_ID hoặc PAGE_ACCESS_TOKEN');
    }

    const message = this.composeFacebookMessage(ad, note);
    if (!message && ad.postType === AdsAiPostType.LINK) {
      throw new BadRequestException('Nội dung đăng tải đang trống');
    }

    const baseUrl =
      this.configService.get<string>('FB_GRAPH_API_URL') ?? 'https://graph.facebook.com/v24.0';

    try {
      let postId: string | null = null;

      if (ad.postType === AdsAiPostType.PHOTO) {
        postId = await this.publishPhotoPost(ad, message, pageId, accessToken, baseUrl);
      } else {
        postId = await this.publishLinkPost(ad, message, pageId, accessToken, baseUrl);
      }

      ad.facebookPostId = postId;
      ad.status = AdsAiStatus.PUBLISHED;
      ad.publishedAt = new Date();
      ad.failureReason = null;
      ad.scheduledAt = null;

      return this.repo.save(ad);
    } catch (error) {
      const normalized = this.normalizeFacebookError(error);
      this.logger.error(normalized.logMessage, normalized.stack);
      await this.markAsFailed(ad, normalized.failureReason);
      throw new BadRequestException(normalized.clientMessage);
    }
  }

  private async publishLinkPost(
    ad: AdsAiCampaign,
    message: string,
    pageId: string,
    accessToken: string,
    baseUrl: string,
  ): Promise<string | null> {
    const params = new URLSearchParams();
    params.append('access_token', accessToken);
    params.append('message', message);

    if (ad.ctaUrl) {
      params.append('link', ad.ctaUrl);
    }

    // if (ad.headline) {
    //   params.append('name', ad.headline);
    // }

    const response = await this.httpClient.post<{ id: string }>(
      `${baseUrl}/${pageId}/feed`,
      params,
    );

    return response.data?.id ?? null;
  }

  private async publishPhotoPost(
    ad: AdsAiCampaign,
    message: string,
    pageId: string,
    accessToken: string,
    baseUrl: string,
  ): Promise<string | null> {
    if (!ad.image) {
      throw new BadRequestException('Chiến dịch dạng ảnh cần có ảnh đính kèm.');
    }

    const normalizedPath = ad.image.replace(/^upload\//, 'uploads/');
    const absolutePath = join(process.cwd(), normalizedPath);

    if (!existsSync(absolutePath)) {
      throw new BadRequestException('Không tìm thấy file ảnh để đăng lên Facebook.');
    }

    const form = new FormData();
    form.append('source', createReadStream(absolutePath));
    form.append('access_token', accessToken);
    form.append('published', 'true');

    if (message) {
      form.append('caption', message);
    }

    const response = await this.httpClient.post<{ post_id?: string; id?: string }>(
      `${baseUrl}/${pageId}/photos`,
      form,
      { headers: form.getHeaders() },
    );

    return response.data?.post_id ?? response.data?.id ?? null;
  }

  private composeFacebookMessage(ad: AdsAiCampaign, note?: string): string {
    const segments: string[] = [];

    if (ad.primaryText) {
      segments.push(ad.primaryText);
    }

    if (ad.headline) {
      segments.push(ad.headline);
    }

    if (ad.description) {
      segments.push(ad.description);
    }

    if (ad.callToAction && ad.ctaUrl) {
      segments.push(`${ad.callToAction}: ${ad.ctaUrl}`);
    } else if (ad.callToAction) {
      segments.push(ad.callToAction);
    } else if (ad.ctaUrl) {
      segments.push(ad.ctaUrl);
    }

    if (note) {
      segments.push(note);
    }

    if (ad.hashtags?.length) {
      segments.push(ad.hashtags.join(' '));
    }

    return segments
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 0)
      .join('\n\n');
  }

  private async markAsFailed(ad: AdsAiCampaign, reason: string) {
    ad.status = AdsAiStatus.FAILED;
    ad.failureReason = reason.slice(0, 1000);
    await this.repo.save(ad);
  }

  private ensurePublishable(ad: AdsAiCampaign): void {
    if (!ad.primaryText && !ad.headline && !ad.description) {
      throw new BadRequestException('Chiến dịch chưa có nội dung quảng cáo');
    }

    if (ad.postType === AdsAiPostType.PHOTO && !ad.image) {
      throw new BadRequestException('Bài đăng dạng ảnh yêu cầu có ít nhất một ảnh đính kèm.');
    }
  }

  private async getCampaignOrFail(id: number) {
    const ad = await this.repo.findOne({ where: { id } });
    if (!ad) {
      throw new NotFoundException(`Không tìm thấy chiến dịch quảng cáo: ${id}`);
    }
    return ad;
  }

  private normalizeScheduledDate(input?: string | null): Date | null {
    if (!input) {
      return null;
    }

    const date = new Date(input);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Giá trị thời gian không hợp lệ');
    }

    return date;
  }

  private normalizeImageInput(value?: string | null): string | null | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (value === null) {
      return null;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    return trimmed.replace(/^upload\//, 'uploads/');
  }

  private normalizePostTypeInput(value?: string | null): AdsAiPostType {
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'photo') {
        return AdsAiPostType.PHOTO;
      }
    }

    return AdsAiPostType.LINK;
  }

  private async deleteImageIfExists(image?: string | null) {
    if (!image) {
      return;
    }

    const normalized = image.replace(/^upload\//, 'uploads/');
    const absolutePath = join(process.cwd(), normalized);

    try {
      await fsPromises.unlink(absolutePath);
    } catch {
      // ignore
    }
  }

  private async resolveProduct(
    productId?: number | null,
    options: { strict?: boolean } = {},
  ): Promise<Product | null> {
    if (!productId) {
      return null;
    }

    const { strict = false } = options;

    const product = await this.productRepo.findOne({
      where: { id: productId },
      relations: ['brand', 'category', 'variants'],
    });

    if (!product) {
      if (strict) {
        throw new BadRequestException(`Không tìm thấy sản phẩm với ID ${productId}`);
      }
      return null;
    }

    return product;
  }

  private async buildPrompt(dto: GenerateAdsAiDto): Promise<{
    prompt: string;
    product: Product | null;
    productName: string;
    hasExplicitProductName: boolean;
  }> {
    const product = await this.resolveProduct(dto.productId, { strict: !!dto.productId });
    const trimmedProductName = dto.productName?.trim();
    let resolvedProductName =
      trimmedProductName && trimmedProductName.length > 0 ? trimmedProductName : null;

    if (!resolvedProductName && product?.name) {
      resolvedProductName = product.name;
    }

    const sections: string[] = [];

    if (resolvedProductName) {
      sections.push(`Sản phẩm/dịch vụ: ${resolvedProductName}`);
    } else {
      sections.push(
        'Không có tên sản phẩm cụ thể. Hãy tập trung xây dựng câu chuyện, lợi ích và lời kêu gọi dựa trên ngữ cảnh chiến dịch bên dưới.',
      );
    }

    const productDescription = dto.description ?? product?.description;
    if (productDescription) {
      sections.push(`Mô tả sản phẩm/chiến dịch: ${productDescription}`);
    }

    if (product?.brand?.name) {
      sections.push(`Thương hiệu: ${product.brand.name}`);
    }

    if (product?.category?.name) {
      sections.push(`Danh mục: ${product.category.name}`);
    }

    if (typeof product?.stock === 'number') {
      sections.push(`Tồn kho hiện tại: ${product.stock}`);
    }

    if (product?.variants?.length) {
      const activeVariants = product.variants.filter(
        (variant) => variant.status === ProductVariantStatus.ACTIVE,
      );

      if (activeVariants.length) {
        const prices = activeVariants
          .map((variant) => Number(variant.price))
          .filter((price) => Number.isFinite(price));

        if (prices.length) {
          const minPrice = Math.min(...prices);
          const maxPrice = Math.max(...prices);
          const priceText =
            Math.abs(maxPrice - minPrice) < 1
              ? `Giá bán tham khảo: ${this.formatCurrency(minPrice)}`
              : `Khoảng giá: ${this.formatCurrency(minPrice)} - ${this.formatCurrency(maxPrice)}`;
          sections.push(priceText);
        }

        sections.push(`Số lượng biến thể đang bán: ${activeVariants.length}`);
      }
    }

    if (dto.targetAudience) {
      sections.push(`Đối tượng mục tiêu: ${dto.targetAudience}`);
    }

    if (dto.features?.length) {
      sections.push(`Tính năng nổi bật: ${dto.features.join(', ')}`);
    }

    if (dto.benefits?.length) {
      sections.push(`Lợi ích chính: ${dto.benefits.join(', ')}`);
    }

    if (dto.tone) {
      sections.push(`Tông giọng mong muốn: ${dto.tone}`);
    }

    if (dto.objective) {
      sections.push(`Mục tiêu chiến dịch: ${dto.objective}`);
    }

    if (dto.campaignContext) {
      sections.push(`Ngữ cảnh chiến dịch: ${dto.campaignContext}`);
    }

    if (dto.additionalNotes) {
      sections.push(`Ghi chú thêm: ${dto.additionalNotes}`);
    }

    sections.push('Hãy tạo nội dung quảng cáo Facebook bằng tiếng Việt theo yêu cầu sau:');
    sections.push('- Mở đầu bằng một câu hook gây tò mò hoặc mạnh mẽ, KHÔNG được nhàm chán.');
    sections.push(
      '- Ưu tiên diễn giải lợi ích cảm xúc khách hàng nhận được, không chỉ liệt kê tính năng.',
    );
    sections.push('- Tuân thủ đúng tông giọng đã yêu cầu, từ ngữ phải phản ánh phong cách đó.');
    sections.push(
      '- Lồng ghép tự nhiên thông tin sản phẩm (nếu có) hoặc ngữ cảnh/ưu đãi, đối tượng và mô tả đã cung cấp.',
    );
    sections.push('- Bắt buộc có yếu tố thúc đẩy hành động ngay (khẩn cấp hoặc khan hiếm).');
    sections.push('- Kết thúc bằng lời kêu gọi hành động cụ thể để khách hàng biết phải làm gì.');
    sections.push(
      '- Tự động đề xuất 3-5 hashtag chiến lược liên quan tới sản phẩm, thương hiệu, xu hướng.',
    );
    sections.push(
      '- Nếu không có tên sản phẩm cụ thể, hãy định vị nội dung xoay quanh lợi ích và bối cảnh chiến dịch.',
    );
    sections.push(
      'Trả về JSON có cấu trúc: {"primaryText": string, "headline": string, "description": string, "callToAction": string, "hashtags": string[]}\nKhông thêm ký tự ngoài JSON.',
    );

    const fallbackName =
      resolvedProductName ?? dto.campaignContext ?? dto.objective ?? 'chiến dịch của bạn';

    return {
      prompt: sections.join('\n'),
      product,
      productName: fallbackName,
      hasExplicitProductName: Boolean(resolvedProductName),
    };
  }

  private formatCurrency(value: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(Math.round(value));
  }

  private parseAiResponse(raw: string): GeneratedContentFields {
    const cleaned = raw
      .trim()
      .replace(/^```json/i, '')
      .replace(/^```/, '')
      .replace(/```$/, '')
      .replace(/```$/i, '');

    try {
      const parsed = JSON.parse(cleaned) as Partial<{
        primaryText: unknown;
        headline: unknown;
        description: unknown;
        callToAction: unknown;
        hashtags: unknown;
      }>;

      return {
        primaryText:
          this.normalizeAiString(parsed.primaryText) ?? 'Khám phá ngay sản phẩm tuyệt vời này!',
        headline: this.normalizeAiString(parsed.headline) ?? 'Ưu đãi giới hạn dành cho bạn',
        description:
          this.normalizeAiString(parsed.description) ?? 'Đăng ký ngay để nhận ưu đãi hấp dẫn.',
        callToAction: this.normalizeAiString(parsed.callToAction) ?? 'Tìm hiểu thêm',
        hashtags: this.normalizeHashtags(parsed.hashtags) ?? [
          '#Heartie',
          '#UuDaiNgay',
          '#MuaSamThongMinh',
        ],
      };
    } catch {
      this.logger.warn('Không thể parse JSON từ Gemini, dùng nội dung mặc định');
      return {
        primaryText: raw.trim() || 'Khám phá ngay sản phẩm tuyệt vời này!',
        headline: 'Ưu đãi giới hạn dành cho bạn',
        description: 'Đăng ký ngay để nhận ưu đãi hấp dẫn.',
        callToAction: 'Tìm hiểu thêm',
        hashtags: ['#Heartie', '#UuDaiNgay', '#MuaSamThongMinh'],
      };
    }
  }

  private normalizeAiString(value: unknown): string | null {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.length ? trimmed : null;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    return null;
  }

  private normalizeHashtags(value: unknown): string[] | null {
    if (value === null || value === undefined) {
      return null;
    }

    const candidates: string[] = [];

    if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== undefined && item !== null) {
          candidates.push(`${item}`);
        }
      }
    } else if (typeof value === 'string') {
      const tokens = value.split(/[#,\s]+/).filter((token) => token.length > 0);
      candidates.push(...tokens);
    } else {
      return null;
    }

    const sanitized = candidates
      .map((candidate) => this.sanitizeHashtag(candidate))
      .filter((hashtag): hashtag is string => Boolean(hashtag));

    const unique = Array.from(new Set(sanitized));
    return unique.length ? unique.slice(0, 8) : null;
  }

  private normalizeStoredHashtags(value?: string[] | null): string[] | null {
    if (!value || value.length === 0) {
      return null;
    }

    const sanitized = value
      .map((item) => this.sanitizeHashtag(item))
      .filter((item): item is string => Boolean(item));

    const unique = Array.from(new Set(sanitized));
    return unique.length ? unique.slice(0, 10) : null;
  }

  private enforceCreativeRules(
    content: GeneratedContentFields,
    context: {
      dto: GenerateAdsAiDto;
      product: Product | null;
      productName: string;
      hasExplicitProductName: boolean;
    },
  ): GeneratedContentFields {
    const primaryWithHook = this.ensureHook(
      content.primaryText,
      context.dto.tone,
      context.productName,
      context.dto.targetAudience,
      context.hasExplicitProductName,
      context.dto.objective,
    );
    const primaryWithBenefits = this.ensureBenefitNarrative(primaryWithHook, context);
    const primaryText = this.normalizeParagraphs(primaryWithBenefits);

    const headline = content.headline.trim().length
      ? content.headline.trim()
      : this.defaultHeadline(context.productName, context.dto.tone, context.hasExplicitProductName);

    let description = content.description.trim().length
      ? this.normalizeParagraphs(content.description)
      : this.buildBaseDescription(context);
    description = this.ensureUrgency(description, context.dto.tone, context.dto.objective);

    const callToActionRaw = content.callToAction.trim().length
      ? content.callToAction
      : this.defaultCallToAction(context.dto.tone);
    const callToAction = this.normalizeCallToAction(callToActionRaw);

    const hashtags = this.ensureHashtags(content.hashtags, {
      productName: context.productName,
      hasExplicitProductName: context.hasExplicitProductName,
      brandName: context.product?.brand?.name ?? null,
      categoryName: context.product?.category?.name ?? null,
      tone: context.dto.tone ?? null,
      objective: context.dto.objective ?? null,
      campaignContext: context.dto.campaignContext ?? null,
      targetAudience: context.dto.targetAudience ?? null,
    });

    return {
      primaryText,
      headline,
      description,
      callToAction,
      hashtags,
    };
  }

  private ensureHook(
    primaryText: string,
    tone: string | null | undefined,
    productName: string,
    targetAudience: string | null | undefined,
    hasExplicitProductName: boolean,
    objective?: string | null,
  ): string {
    const normalized = this.normalizeParagraphs(primaryText);
    const firstLine = normalized.split('\n')[0]?.trim() ?? '';
    const hasHook =
      firstLine.length > 0 &&
      (/[!?…]$/.test(firstLine) ||
        /^(bạn|đã|sẵn sàng|điều gì|bí quyết|tại sao|muốn)/i.test(firstLine));

    if (hasHook) {
      return normalized;
    }

    const hook = this.composeHook(
      tone,
      productName,
      targetAudience,
      hasExplicitProductName,
      objective,
    );
    return this.normalizeParagraphs(`${hook}\n\n${normalized}`);
  }

  private composeHook(
    tone: string | null | undefined,
    productName: string,
    targetAudience: string | null | undefined,
    hasExplicitProductName: boolean,
    objective?: string | null,
  ): string {
    const normalizedTone = tone?.toLowerCase() ?? '';
    const audiencePrefix = targetAudience ? `${targetAudience} ơi, ` : '';

    if (!hasExplicitProductName) {
      return this.composeContextualHook(normalizedTone, audiencePrefix, objective);
    }

    if (normalizedTone.includes('sang')) {
      return `${audiencePrefix}Bạn đã sẵn sàng chạm tới chuẩn mực sang trọng mới với ${productName}?`;
    }

    if (
      normalizedTone.includes('năng') ||
      normalizedTone.includes('động') ||
      normalizedTone.includes('trẻ')
    ) {
      return `${audiencePrefix}Sẵn sàng bùng nổ chất riêng cùng ${productName}, bạn dám thử ngay?`;
    }

    if (
      normalizedTone.includes('ấm') ||
      normalizedTone.includes('ngọt') ||
      normalizedTone.includes('tinh tế')
    ) {
      return `${audiencePrefix}Bạn có muốn đắm chìm trong trải nghiệm tinh tế của ${productName}?`;
    }

    return `${audiencePrefix}Bạn đã sẵn sàng khám phá ${productName} khác biệt thế nào?`;
  }

  private composeContextualHook(
    normalizedTone: string,
    audiencePrefix: string,
    objective?: string | null,
  ): string {
    if (normalizedTone.includes('sang')) {
      return `${audiencePrefix}Bạn đã sẵn sàng đón nhận trải nghiệm sang trọng dành riêng cho bạn?`;
    }

    if (
      normalizedTone.includes('năng') ||
      normalizedTone.includes('động') ||
      normalizedTone.includes('trẻ')
    ) {
      return `${audiencePrefix}Sẵn sàng bùng nổ năng lượng mới cùng chiến dịch đặc biệt này chưa?`;
    }

    if (
      normalizedTone.includes('ấm') ||
      normalizedTone.includes('ngọt') ||
      normalizedTone.includes('tinh tế')
    ) {
      return `${audiencePrefix}Bạn có muốn lan tỏa yêu thương qua thông điệp này ngay hôm nay?`;
    }

    if (objective) {
      return `${audiencePrefix}Bạn đã sẵn sàng để ${objective.toLowerCase()} ngay hôm nay chưa?`;
    }

    return `${audiencePrefix}Bạn đã sẵn sàng đón ưu đãi đặc biệt này?`;
  }

  private ensureBenefitNarrative(
    primaryText: string,
    context: {
      dto: GenerateAdsAiDto;
      product: Product | null;
      productName: string;
      hasExplicitProductName: boolean;
    },
  ): string {
    const benefitRegex =
      /(mang lại|giúp|cảm giác|trải nghiệm|tận hưởng|tôn lên|nâng tầm|lan toả|khơi dậy)/i;
    if (benefitRegex.test(primaryText)) {
      return primaryText;
    }

    const benefitSource =
      context.dto.benefits?.find((benefit) => benefit && benefit.trim().length > 0) ??
      context.dto.campaignContext ??
      context.dto.description ??
      context.product?.description ??
      'cảm giác tận hưởng trọn vẹn từng khoảnh khắc của bạn';

    const subject = context.hasExplicitProductName ? context.productName : 'Chiến dịch này';
    const sentence = `${subject} mang lại ${benefitSource.replace(/[.?!]+$/, '')}`;
    return this.normalizeParagraphs(`${primaryText}\n\n${this.capitalizeSentence(sentence)}`);
  }

  private ensureUrgency(
    description: string,
    tone: string | null | undefined,
    objective: string | null | undefined,
  ): string {
    const trimmed = this.normalizeParagraphs(description);
    const urgencyRegex =
      /(duy nhất|hôm nay|ngay|chỉ còn|phiên bản giới hạn|sắp hết|đừng bỏ lỡ|limited|24h|48h)/i;

    if (urgencyRegex.test(trimmed)) {
      return trimmed;
    }

    const urgencyLine = this.generateUrgencyLine(tone, objective);
    return trimmed.length ? `${trimmed}\n${urgencyLine}` : urgencyLine;
  }

  private generateUrgencyLine(tone?: string | null, objective?: string | null): string {
    const normalizedTone = tone?.toLowerCase() ?? '';

    if (normalizedTone.includes('sang')) {
      return 'Phiên bản giới hạn chỉ dành cho số ít khách hàng tinh tế – đặt ngay hôm nay!';
    }

    if (
      normalizedTone.includes('năng') ||
      normalizedTone.includes('động') ||
      normalizedTone.includes('trẻ')
    ) {
      return 'Chỉ còn 48 giờ để săn ưu đãi, nhanh tay chốt đơn kẻo lỡ!';
    }

    if (objective && /ra mắt|launch|mở bán/i.test(objective)) {
      return 'Ưu đãi mở bán chỉ trong thời gian ngắn – đừng bỏ lỡ!';
    }

    return 'Số lượng ưu đãi có hạn, hành động ngay trước khi hết!';
  }

  private defaultCallToAction(tone?: string | null): string {
    const normalizedTone = tone?.toLowerCase() ?? '';

    if (normalizedTone.includes('sang')) {
      return 'Đặt lịch tư vấn riêng ngay hôm nay';
    }

    if (
      normalizedTone.includes('năng') ||
      normalizedTone.includes('động') ||
      normalizedTone.includes('trẻ')
    ) {
      return 'Inbox ngay để chốt deal trong tích tắc';
    }

    return 'Liên hệ ngay để giữ ưu đãi hôm nay';
  }

  private normalizeCallToAction(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) {
      return this.defaultCallToAction(null);
    }

    const withoutPunctuation = trimmed.replace(/[.!?]+$/g, '');
    return this.capitalizeSentence(withoutPunctuation).replace(/[.!?]+$/g, '');
  }

  private defaultHeadline(
    productName: string,
    tone: string | null | undefined,
    hasExplicitProductName: boolean,
  ): string {
    const normalizedTone = tone?.toLowerCase() ?? '';

    if (!hasExplicitProductName) {
      return this.defaultCampaignHeadline(normalizedTone);
    }

    if (normalizedTone.includes('sang')) {
      return `Tinh hoa của ${productName}`;
    }

    if (
      normalizedTone.includes('năng') ||
      normalizedTone.includes('động') ||
      normalizedTone.includes('trẻ')
    ) {
      return `${productName} - Bùng nổ phong cách riêng`;
    }
    return `${productName} – Lựa chọn thông minh hôm nay`;
  }

  private defaultCampaignHeadline(normalizedTone: string): string {
    if (normalizedTone.includes('sang')) {
      return 'Tinh hoa ưu đãi dành riêng cho bạn';
    }

    if (
      normalizedTone.includes('năng') ||
      normalizedTone.includes('động') ||
      normalizedTone.includes('trẻ')
    ) {
      return 'Bùng nổ phong cách với ưu đãi giới hạn';
    }

    return 'Ưu đãi đặc biệt đang chờ bạn';
  }

  private buildBaseDescription(context: {
    dto: GenerateAdsAiDto;
    product: Product | null;
    productName: string;
    hasExplicitProductName: boolean;
  }): string {
    const sources = [
      context.dto.description,
      context.dto.campaignContext,
      context.product?.description,
    ].filter((value): value is string => Boolean(value && value.trim().length > 0));

    const defaultDescription = context.hasExplicitProductName
      ? `${context.productName} giúp bạn tỏa sáng mỗi ngày.`
      : 'Chiến dịch này giúp bạn tỏa sáng mỗi ngày.';
    const base = sources[0] ?? defaultDescription;
    return this.capitalizeSentence(base);
  }

  private ensureHashtags(
    existing: string[] | null | undefined,
    info: {
      productName: string;
      hasExplicitProductName: boolean;
      brandName?: string | null;
      categoryName?: string | null;
      tone?: string | null;
      objective?: string | null;
      campaignContext?: string | null;
      targetAudience?: string | null;
    },
  ): string[] {
    const sanitizedExisting = (existing ?? [])
      .map((hashtag) => this.sanitizeHashtag(hashtag))
      .filter((tag): tag is string => Boolean(tag));

    const generated = this.generateHashtagCandidates(info);
    const combined = [...sanitizedExisting, ...generated];
    const unique = Array.from(new Set(combined));

    const fallbackCandidates = info.hasExplicitProductName
      ? ['#Heartie', '#DealHot', '#MuaSamThongMinh']
      : ['#Heartie', '#HeartieCampaign', '#DealHot', '#MuaSamThongMinh'];
    for (const fallback of fallbackCandidates) {
      if (unique.length >= 5) {
        break;
      }
      if (!unique.includes(fallback)) {
        unique.push(fallback);
      }
    }

    return unique.slice(0, 5);
  }

  private generateHashtagCandidates(info: {
    productName: string;
    hasExplicitProductName: boolean;
    brandName?: string | null;
    categoryName?: string | null;
    tone?: string | null;
    objective?: string | null;
    campaignContext?: string | null;
    targetAudience?: string | null;
  }): string[] {
    const candidates: Array<string | null> = [];

    const addCandidate = (value?: string | null): boolean => {
      if (!value) {
        return false;
      }
      const sanitized = this.sanitizeHashtag(value);
      if (!sanitized) {
        return false;
      }
      candidates.push(sanitized);
      return true;
    };

    if (info.hasExplicitProductName) {
      addCandidate(info.productName);
    } else {
      const contextualSeeds: Array<string | null> = [
        info.campaignContext ?? null,
        info.objective ?? null,
        info.targetAudience ? `${info.targetAudience} Community` : null,
      ];

      let hasContextSeed = false;
      for (const seed of contextualSeeds) {
        if (addCandidate(seed)) {
          hasContextSeed = true;
        }
      }

      if (!hasContextSeed) {
        addCandidate(info.productName);
      }
    }

    addCandidate(info.brandName ?? null);
    addCandidate(info.categoryName ? `${info.categoryName} Style` : null);

    if (info.tone) {
      addCandidate(`${info.tone} Vibes`);
      addCandidate(`${info.tone} Mood`);
    }

    candidates.push('#HeartieDeals');
    candidates.push('#UuDaiNgay');

    if (!info.hasExplicitProductName) {
      candidates.push('#HeartieCampaign');
    }

    return candidates.filter((candidate): candidate is string => Boolean(candidate));
  }

  private sanitizeHashtag(value: string): string | null {
    const cleaned = value.replace(/#/g, ' ').trim();
    if (!cleaned) {
      return null;
    }

    const normalized = cleaned
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9\s]/g, ' ')
      .trim();

    if (!normalized) {
      return null;
    }

    const words = normalized.split(/\s+/).filter((word) => word.length > 0);
    if (!words.length) {
      return null;
    }

    const combined = words.map((word) => this.capitalizeWord(word)).join('');
    const truncated = combined.slice(0, 30);

    return truncated ? `#${truncated}` : null;
  }

  private capitalizeWord(value: string): string {
    if (!value) {
      return '';
    }
    const lower = value.toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }

  private normalizeParagraphs(text: string): string {
    return text
      .split(/\n+/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .join('\n\n');
  }

  private capitalizeSentence(sentence: string): string {
    const trimmed = sentence.trim();
    if (!trimmed) {
      return '';
    }

    const capitalized = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
    return /[.?!]$/.test(capitalized) ? capitalized : `${capitalized}.`;
  }

  private getGeminiModel(modelName: string): GenerativeModel {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');

    if (!apiKey) {
      throw new BadRequestException('Chưa cấu hình GEMINI_API_KEY');
    }

    if (!this.geminiClient) {
      this.geminiClient = new GoogleGenerativeAI(apiKey);
    }

    if (!this.geminiModels.has(modelName)) {
      this.geminiModels.set(modelName, this.geminiClient.getGenerativeModel({ model: modelName }));
    }

    return this.geminiModels.get(modelName)!;
  }

  private normalizeGeminiError(error: unknown): {
    clientMessage: string;
    logMessage: string;
    stack?: string;
  } {
    const defaultResponse = {
      clientMessage: 'Không thể tạo nội dung quảng cáo tự động, vui lòng thử lại sau.',
      logMessage: 'Không thể tạo nội dung quảng cáo bằng Google Gemini',
      stack: error instanceof Error ? error.stack : undefined,
    };

    if (!error || typeof error !== 'object') {
      return defaultResponse;
    }

    const status = (error as { status?: number }).status;
    const code =
      (error as { statusText?: string }).statusText ??
      (error as { code?: string }).code ??
      (error as { error?: { code?: string } }).error?.code;
    const message =
      (error as { message?: string }).message ??
      (error as { error?: { message?: string } }).error?.message ??
      'Không xác định';

    if (status === 429 || code === 'RESOURCE_EXHAUSTED') {
      return {
        clientMessage:
          'Hệ thống đã hết hạn mức sử dụng Gemini. Vui lòng kiểm tra gói dịch vụ hoặc thử lại sau khi hạn mức được gia hạn.',
        logMessage: `Gemini rate limit exceeded: ${message}`,
        stack: error instanceof Error ? error.stack : undefined,
      };
    }

    if (status === 401 || status === 403 || code === 'PERMISSION_DENIED') {
      return {
        clientMessage: 'Không thể xác thực với Gemini. Vui lòng kiểm tra API key cấu hình.',
        logMessage: `Gemini authentication failed: ${message}`,
        stack: error instanceof Error ? error.stack : undefined,
      };
    }

    if (status && status >= 500) {
      return {
        clientMessage: 'Dịch vụ Gemini đang gặp sự cố tạm thời. Vui lòng thử lại sau ít phút.',
        logMessage: `Gemini server error (${status}): ${message}`,
        stack: error instanceof Error ? error.stack : undefined,
      };
    }

    return {
      clientMessage: defaultResponse.clientMessage,
      logMessage: `${defaultResponse.logMessage}: ${message}`,
      stack: error instanceof Error ? error.stack : undefined,
    };
  }

  private normalizeFacebookError(error: unknown): {
    clientMessage: string;
    logMessage: string;
    failureReason: string;
    stack?: string;
  } {
    const defaultResponse = {
      clientMessage: 'Không thể đăng bài lên Facebook. Vui lòng kiểm tra cấu hình trang.',
      logMessage: 'Gọi API Facebook thất bại',
      failureReason: 'Đăng bài thất bại do lỗi không xác định',
      stack: error instanceof Error ? error.stack : undefined,
    };

    if (!error || typeof error !== 'object') {
      return defaultResponse;
    }

    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{
        error?: { message?: string; code?: number; type?: string; error_subcode?: number };
      }>;
      const fbError = axiosError.response?.data?.error;
      const status = axiosError.response?.status;
      const fbMessage = fbError?.message ?? axiosError.message ?? 'Không xác định';
      const fbCode = fbError?.code;
      const fbType = fbError?.type;

      const logContext = [status ?? 'no-status'];
      if (fbCode) {
        logContext.push(`code ${fbCode}`);
      }
      if (fbType) {
        logContext.push(`type ${fbType}`);
      }

      const logMessage = `Facebook Graph API error (${logContext.join(' / ')}): ${fbMessage}`;

      let clientHint = defaultResponse.clientMessage;

      const messageLower = fbMessage.toLowerCase();

      if (fbCode === 190) {
        clientHint =
          'Access token không hợp lệ hoặc đã hết hạn. Vui lòng cấp lại PAGE_ACCESS_TOKEN.';
      } else if (fbCode === 200 || fbCode === 10) {
        clientHint =
          'Tài khoản hiện không có quyền đăng bài lên trang. Vui lòng kiểm tra quyền pages_manage_posts và vai trò quản trị viên.';
      } else if (fbCode === 100) {
        clientHint =
          'Facebook từ chối ID trang ở đầu vào. Hãy đảm bảo PAGE_ID đúng và token thuộc cùng trang/app (global id không được phép).';
      } else if (
        messageLower.includes('global id') ||
        messageLower.includes('not allowed for this call')
      ) {
        clientHint =
          'Token hiện không thuộc về trang này. Hãy chắc chắn bạn đang dùng PAGE_ACCESS_TOKEN (không phải user token) lấy từ /me/accounts và PAGE_ID chuẩn của cùng trang.';
      } else if (status === 429) {
        clientHint = 'Facebook đang giới hạn tần suất. Vui lòng thử lại sau ít phút.';
      }

      return {
        clientMessage: clientHint,
        logMessage,
        failureReason: fbMessage,
        stack: error instanceof Error ? error.stack : undefined,
      };
    }

    const message = (error as { message?: string }).message ?? 'Không rõ nguyên nhân';

    return {
      clientMessage: defaultResponse.clientMessage,
      logMessage: `${defaultResponse.logMessage}: ${message}`,
      failureReason: message,
      stack: error instanceof Error ? error.stack : undefined,
    };
  }
}
