import { Test, TestingModule } from '@nestjs/testing';
import { AiCustomerController } from './ai-customer.controller';
import { AiCustomerService } from './ai-customer.service';
import { ProactiveStylistRequestDto, ProactiveStylistResponse } from './dto/proactive-stylist.dto';
import { CartAnalysisRequestDto, CartAnalysisResponse } from './dto/cart-analysis.dto';

describe('AiCustomerController', () => {
  let controller: AiCustomerController;
  const serviceMock = {
    getManifest: jest.fn(),
    generateProactiveStylistSuggestions: jest.fn(),
    analyzeCart: jest.fn(),
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
      suggestion: null,
      fallbackApplied: false,
      inspectedItems: 1,
    };

    serviceMock.analyzeCart.mockResolvedValue(response);

    await expect(controller.analyzeCart(payload)).resolves.toBe(response);
    expect(serviceMock.analyzeCart).toHaveBeenCalledWith(payload);
  });
});
