import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { AiCustomerService } from './ai-customer.service';
import { ProductsService } from '../products/products.service';
import { CartInsightsService } from './services/cart-insights.service';
import { CartAnalysisRequestDto } from './dto/cart-analysis.dto';
import {
  ProductComparisonRequestDto,
  ProductComparisonResponse,
} from './dto/product-comparison.dto';

describe('AiCustomerService', () => {
  let service: AiCustomerService;
  let productsService: { findOne: jest.Mock; buildStylistCatalogue: jest.Mock };
  let configService: { get: jest.Mock };
  let cartInsightsService: { analyzeCart: jest.Mock; compareProducts: jest.Mock };

  beforeEach(async () => {
    productsService = {
      findOne: jest.fn(),
      buildStylistCatalogue: jest.fn().mockResolvedValue([]),
    };

    configService = {
      get: jest.fn((key: string) => {
        if (key === 'GEMINI_API_KEY') {
          return 'test-key';
        }
        if (key === 'GEMINI_CHAT_MODEL') {
          return 'test-model';
        }
        return undefined;
      }),
    };
    cartInsightsService = {
      analyzeCart: jest.fn(),
      compareProducts: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiCustomerService,
        { provide: ProductsService, useValue: productsService },
        { provide: ConfigService, useValue: configService },
        { provide: CartInsightsService, useValue: cartInsightsService },
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

    const geminiSpy = jest
      .spyOn<any, any>(service as any, 'generateGeminiContent')
      .mockResolvedValueOnce(geminiPayload);

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

    expect(geminiSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        modelName: 'test-model',
        responseMimeType: 'application/json',
        temperature: 0.35,
      }),
    );

    geminiSpy.mockRestore();
  });

  it('should throw BadRequestException when Gemini payload is invalid', async () => {
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
    const geminiSpy = jest
      .spyOn<any, any>(service as any, 'generateGeminiContent')
      .mockResolvedValueOnce('không phải json');

    await expect(
      service.generateProactiveStylistSuggestions({
        productId: 2,
        locale: 'vi-VN',
        signals: [],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    geminiSpy.mockRestore();
  });

  it('should delegate cart analysis to CartInsightsService', async () => {
    const payload: CartAnalysisRequestDto = { items: [{ productId: 1 }] };
    const response = {
      greeting: { headline: 'Hi', subtitle: 'subtitle' },
      promotionOpportunities: [],
      comparisonOpportunities: [],
      fallbackApplied: false,
      inspectedItems: 1,
      generatedAt: new Date().toISOString(),
    };

    cartInsightsService.analyzeCart.mockResolvedValue(response);

    await expect(service.analyzeCart(payload)).resolves.toBe(response);
    expect(cartInsightsService.analyzeCart).toHaveBeenCalledWith(payload);
  });

  it('should delegate product comparison to CartInsightsService', async () => {
    const payload: ProductComparisonRequestDto = { productIds: [1, 2] };
    const response: ProductComparisonResponse = {
      headline: 'So sánh',
      summary: 'summary',
      comparedProducts: [],
      featureMatrix: [],
      generatedAt: new Date().toISOString(),
    };

    cartInsightsService.compareProducts.mockResolvedValue(response);

    await expect(service.compareProducts(payload)).resolves.toBe(response);
    expect(cartInsightsService.compareProducts).toHaveBeenCalledWith(payload);
  });
});
