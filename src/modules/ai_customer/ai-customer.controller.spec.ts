import { Test, TestingModule } from '@nestjs/testing';
import { AiCustomerController } from './ai-customer.controller';
import { AiCustomerService } from './ai-customer.service';
import { ProactiveStylistRequestDto, ProactiveStylistResponse } from './dto/proactive-stylist.dto';
import { CartAnalysisRequestDto, CartAnalysisResponse } from './dto/cart-analysis.dto';
import {
  ProductComparisonRequestDto,
  ProductComparisonResponse,
} from './dto/product-comparison.dto';

describe('AiCustomerController', () => {
  let controller: AiCustomerController;
  const serviceMock = {
    getManifest: jest.fn(),
    generateProactiveStylistSuggestions: jest.fn(),
    analyzeCart: jest.fn(),
    compareProducts: jest.fn(),
  } satisfies Record<string, jest.Mock>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AiCustomerController],
      providers: [{ provide: AiCustomerService, useValue: serviceMock }],
    }).compile();

    controller = module.get<AiCustomerController>(AiCustomerController);

    jest.clearAllMocks();
  });

  it('should return manifest', () => {
    const manifest = { features: [], updatedAt: new Date().toISOString() };
    serviceMock.getManifest.mockReturnValue(manifest);

    expect(controller.getManifest()).toBe(manifest);
    expect(serviceMock.getManifest).toHaveBeenCalledTimes(1);
  });

  it('should forward proactive stylist requests to service', async () => {
    const payload: ProactiveStylistRequestDto = { productId: 1 };
    const response: ProactiveStylistResponse = {
      headline: 'test',
      suggestions: [],
      fallbackApplied: false,
      productSnapshot: { id: 1, name: 'Test' },
    };

    serviceMock.generateProactiveStylistSuggestions.mockResolvedValue(response);

    await expect(controller.generateProactiveStylistSuggestions(payload)).resolves.toBe(response);
    expect(serviceMock.generateProactiveStylistSuggestions).toHaveBeenCalledWith(payload);
  });

  it('should forward cart analysis requests to service', async () => {
    const payload: CartAnalysisRequestDto = {
      items: [{ productId: 1 }],
    };
    const response: CartAnalysisResponse = {
      greeting: { headline: 'Xin chào', subtitle: 'subtitle' },
      promotionOpportunities: [],
      comparisonOpportunities: [],
      fallbackApplied: false,
      inspectedItems: 1,
      generatedAt: new Date().toISOString(),
    };

    serviceMock.analyzeCart.mockResolvedValue(response);

    await expect(controller.analyzeCart(payload)).resolves.toBe(response);
    expect(serviceMock.analyzeCart).toHaveBeenCalledWith(payload);
  });

  it('should forward compare products requests to service', async () => {
    const payload: ProductComparisonRequestDto = { productIds: [1, 2] };
    const response: ProductComparisonResponse = {
      headline: 'So sánh',
      summary: 'summary',
      comparedProducts: [],
      featureMatrix: [],
      generatedAt: new Date().toISOString(),
    };

    serviceMock.compareProducts.mockResolvedValue(response);

    await expect(controller.compareProducts(payload)).resolves.toBe(response);
    expect(serviceMock.compareProducts).toHaveBeenCalledWith(payload);
  });
});
