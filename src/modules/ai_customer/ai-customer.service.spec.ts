import { Test, TestingModule } from '@nestjs/testing';
import { AiCustomerService } from './ai-customer.service';
import { GeminiService } from '../gemini/gemini.service';
import { ProductsService } from '../products/products.service';

describe('AiCustomerService', () => {
  let service: AiCustomerService;
  let geminiService: jest.Mocked<
    Pick<GeminiService, 'generateContent' | 'generateStructuredContent'>
  >;
  let productsService: { findOne: jest.Mock; buildStylistCatalogue: jest.Mock };

  beforeEach(async () => {
    geminiService = {
      generateContent: jest.fn().mockResolvedValue({ text: null, functionCall: null }),
      generateStructuredContent: jest.fn().mockResolvedValue('{}'),
    } as jest.Mocked<Pick<GeminiService, 'generateContent' | 'generateStructuredContent'>>;

    productsService = {
      findOne: jest.fn(),
      buildStylistCatalogue: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiCustomerService,
        { provide: GeminiService, useValue: geminiService },
        { provide: ProductsService, useValue: productsService },
      ],
    }).compile();

    service = module.get<AiCustomerService>(AiCustomerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should expose manifest with known features', () => {
    const manifest = service.getManifest();

    expect(manifest.features).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'proactive-stylist', enabled: true }),
        expect.objectContaining({ key: 'contextual-cart-assistant', enabled: true }),
      ]),
    );
    expect(new Date(manifest.updatedAt).toString()).not.toBe('Invalid Date');
  });

  it('should parse proactive stylist suggestions from structured Gemini payload', async () => {
    const productDetail = {
      id: 1,
      name: 'Áo sơ mi trắng',
      images: ['https://cdn.example.com/product.jpg'],
      category: { name: 'Shirts' },
      brand: { name: 'Fashia' },
      variants: [{ id: 11, price: 799000 }],
    };

    productsService.findOne.mockResolvedValue(productDetail);

    productsService.buildStylistCatalogue.mockResolvedValue([
      {
        id: 1,
        name: 'Áo sơ mi trắng',
        brand: 'Fashia',
        category: 'Shirts',
        minPrice: 799000,
        maxPrice: 799000,
        image: 'https://cdn.example.com/product.jpg',
        attributes: ['cotton'],
        score: 1,
      },
      {
        id: 2,
        name: 'Quần tây đen',
        brand: 'Fashia',
        category: 'Pants',
        minPrice: 699000,
        maxPrice: 699000,
        image: null,
        attributes: ['office-fit'],
        score: 0.92,
      },
      {
        id: 3,
        name: 'Giày loafer nâu',
        brand: 'Fashia',
        category: 'Footwear',
        minPrice: 899000,
        maxPrice: 899000,
        image: null,
        attributes: ['leather'],
        score: 0.88,
      },
    ]);

    const geminiPayload = JSON.stringify({
      headline: 'Fia gợi ý trọn bộ lịch sự',
      outfits: [
        {
          title: 'Phong cách công sở',
          summary: 'Giữ vẻ chỉn chu cho buổi làm việc đầu tuần.',
          occasion: 'Đi làm',
          items: [
            {
              productId: 1,
              role: 'focus',
              reason: 'Áo sơ mi trắng làm điểm nhấn lịch sự.',
            },
            {
              productId: 2,
              role: 'bottom',
              reason: 'Quần tây đen giúp tổng thể gọn gàng, chuyên nghiệp.',
            },
            {
              productId: 3,
              role: 'footwear',
              reason: 'Loafer nâu hoàn thiện outfit và thêm điểm nhấn sang trọng.',
            },
          ],
        },
      ],
    });

    geminiService.generateStructuredContent.mockResolvedValueOnce(geminiPayload);

    const result = await service.generateProactiveStylistSuggestions({
      productId: 1,
      locale: 'vi-VN',
      signals: [],
    });

    expect(result.headline).toBe('Fia gợi ý trọn bộ lịch sự');
    expect(result.suggestions).toHaveLength(1);
    expect(result.fallbackApplied).toBe(false);
    expect(result.productSnapshot.name).toBe('Áo sơ mi trắng');

    const [suggestion] = result.suggestions;
    expect(suggestion.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ productId: 1 }),
        expect.objectContaining({ productId: 2 }),
        expect.objectContaining({ productId: 3 }),
      ]),
    );

    expect(productsService.buildStylistCatalogue).toHaveBeenCalledWith(1, {
      includeFocus: true,
      limit: 40,
    });

    expect(geminiService.generateStructuredContent).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        responseMimeType: 'application/json',
        temperature: 0.35,
      }),
    );
  });

  it('should fall back to canned stylist suggestions when Gemini payload is invalid', async () => {
    const productDetail = {
      id: 2,
      name: 'Đầm maxi đỏ',
      variants: [{ id: 21, price: 1299000 }],
    };

    productsService.findOne.mockResolvedValue(productDetail);
    productsService.buildStylistCatalogue.mockResolvedValue([
      {
        id: 2,
        name: 'Đầm maxi đỏ',
        brand: 'Fashia',
        category: 'Dresses',
        minPrice: 1299000,
        maxPrice: 1299000,
        image: null,
        attributes: ['evening'],
        score: 1,
      },
    ]);
    geminiService.generateStructuredContent.mockResolvedValueOnce('không phải json');

    const result = await service.generateProactiveStylistSuggestions({
      productId: 2,
      locale: 'vi-VN',
      signals: [],
    });

    expect(result.fallbackApplied).toBe(true);
    expect(result.suggestions.length).toBeGreaterThan(0);
    expect(result.headline).toContain('Đầm maxi đỏ');
  });

  it('should parse cart analysis insight from structured Gemini payload', async () => {
    const productDetail = {
      id: 3,
      name: 'Áo khoác len',
      variants: [{ id: 31, price: 990000 }],
    };

    productsService.findOne.mockResolvedValue(productDetail);

    const geminiPayload = JSON.stringify({
      suggestion: {
        category: 'cross-sell',
        title: 'Bổ sung khăn choàng len',
        message: 'Khăn len cùng tông giúp outfit hoàn chỉnh hơn.',
        recommendation: 'Thử thêm khăn len màu be vào giỏ.',
      },
    });

    geminiService.generateStructuredContent.mockResolvedValueOnce(geminiPayload);

    const result = await service.analyzeCart({
      items: [
        { productId: 3, quantity: 1 },
        { productId: 3, quantity: 2 },
      ],
    });

    expect(result.suggestion).toEqual(
      expect.objectContaining({
        category: 'cross-sell',
        title: 'Bổ sung khăn choàng len',
      }),
    );
    expect(result.fallbackApplied).toBe(false);
    expect(geminiService.generateStructuredContent).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        responseMimeType: 'application/json',
        temperature: 0.2,
      }),
    );
  });
});
