import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GoogleGenerativeAI,
  GenerativeModel,
  GenerationConfig,
  Content,
  Tool,
  FunctionCall,
  FunctionResponsePart,
  SchemaType,
} from '@google/generative-ai';

const GEMINI_TOOLS: Tool[] = [
  {
    functionDeclarations: [
      // 8.1. search_products
      {
        name: 'search_products',
        description: 'Tìm kiếm & lọc sản phẩm theo nhu cầu.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            query: { type: SchemaType.STRING, description: 'Từ khóa, ví dụ: "váy đen dự tiệc"' },
            filters: {
              type: SchemaType.OBJECT,
              properties: {
                category: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                sizes: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                colors: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                materials: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                price_min: { type: SchemaType.NUMBER },
                price_max: { type: SchemaType.NUMBER },
                fit: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                occasion: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                sort: {
                  type: SchemaType.STRING,
                  format: 'enum',
                  enum: ['relevance', 'price_asc', 'price_desc', 'newest', 'bestseller'],
                },
              },
            },
            limit: { type: SchemaType.NUMBER, description: 'mặc định 6' },
            cursor: { type: SchemaType.STRING, description: 'phân trang' },
          },
        },
      },
      // 8.2. get_product_detail
      {
        name: 'get_product_detail',
        description: 'Lấy chi tiết, tồn kho, giá của 1 sản phẩm/biến thể.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            product_id: { type: SchemaType.STRING },
            variant: {
              type: SchemaType.OBJECT,
              properties: {
                color: { type: SchemaType.STRING },
                size: { type: SchemaType.STRING },
              },
            },
          },
          required: ['product_id'],
        },
      },
      // 8.3. update_cart
      {
        name: 'update_cart',
        description: 'Thêm, xoá, hoặc cập nhật số lượng sản phẩm trong giỏ hàng.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            action: {
              type: SchemaType.STRING,
              format: 'enum',
              enum: ['add', 'remove', 'change_qty'],
            },
            items: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  product_id: { type: SchemaType.NUMBER },
                  variant: {
                    type: SchemaType.OBJECT,
                    properties: {
                      color: { type: SchemaType.STRING },
                      size: { type: SchemaType.STRING },
                    },
                  },
                  quantity: { type: SchemaType.NUMBER },
                },
                required: ['product_id', 'quantity'],
              },
            },
          },
          required: ['action', 'items'],
        },
      },
      // 8.4. recommend_size
      {
        name: 'recommend_size',
        description: 'Gợi ý size cho người dùng dựa trên thông số.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            product_id: { type: SchemaType.STRING },
            gender: { type: SchemaType.STRING, format: 'enum', enum: ['male', 'female', 'unisex'] },
            height_cm: { type: SchemaType.NUMBER },
            weight_kg: { type: SchemaType.NUMBER },
            body_measurements: {
              type: SchemaType.OBJECT,
              properties: {
                chest_cm: { type: SchemaType.NUMBER },
                waist_cm: { type: SchemaType.NUMBER },
                hip_cm: { type: SchemaType.NUMBER },
              },
            },
            usual_size: { type: SchemaType.STRING },
          },
          required: ['product_id'],
        },
      },
      // 8.5. track_order
      {
        name: 'track_order',
        description: 'Tra cứu trạng thái đơn hàng.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            orderNumber: { type: SchemaType.STRING },
          },
          required: ['orderNumber'],
        },
      },
      // 8.6. create_return_request
      {
        name: 'create_return_request',
        description: 'Tạo yêu cầu đổi/trả hàng.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            orderNumber: { type: SchemaType.STRING },
            items: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  product_id: { type: SchemaType.STRING },
                  variant: {
                    type: SchemaType.OBJECT,
                    properties: {
                      color: { type: SchemaType.STRING },
                      size: { type: SchemaType.STRING },
                    },
                  },
                },
                required: ['product_id'],
              },
            },
            reason: { type: SchemaType.STRING },
            note: { type: SchemaType.STRING },
          },
          required: ['orderNumber', 'items', 'reason'],
        },
      },
      // 8.7. get_promotions
      {
        name: 'get_promotions',
        description: 'Lấy các khuyến mãi đang khả dụng.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            user_id: { type: SchemaType.STRING },
            cart_value: { type: SchemaType.NUMBER },
            category: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          },
        },
      },
      // 8.8. store_locator
      {
        name: 'store_locator',
        description: 'Tìm cửa hàng Fashia gần nhất.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            lat: { type: SchemaType.NUMBER },
            lng: { type: SchemaType.NUMBER },
            radius_km: { type: SchemaType.NUMBER },
          },
        },
      },
      // 8.9. get_policy_or_faq
      {
        name: 'get_policy_or_faq',
        description: 'Lấy thông tin FAQ hoặc chính sách (vận chuyển, đổi trả, ...)',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            topic: {
              type: SchemaType.STRING,
              format: 'enum',
              enum: ['shipping', 'return', 'payment', 'care', 'size_guide', 'other'],
            },
          },
          required: ['topic'],
        },
      },
      // 8.10. get_list_orders
      {
        name: 'get_list_orders',
        description: 'Lấy danh sách đơn hàng của người dùng hiện tại, có thể lọc theo trạng thái.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            status: {
              type: SchemaType.ARRAY,
              items: { type: SchemaType.STRING },
              description:
                'Lọc theo trạng thái đơn hàng: PENDING, CONFIRMED, PROCESSING, SHIPPED, DELIVERED, CANCELLED, RETURNED',
            },
            limit: {
              type: SchemaType.NUMBER,
              description: 'Số lượng đơn hàng tối đa trả về, mặc định 10',
            },
            offset: {
              type: SchemaType.NUMBER,
              description: 'Vị trí bắt đầu lấy dữ liệu (phân trang), mặc định 0',
            },
          },
        },
      },
      // 8.11. get_order_detail
      {
        name: 'get_order_detail',
        description: 'Lấy chi tiết đầy đủ của một đơn hàng cụ thể.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            orderNumber: { type: SchemaType.STRING, description: 'Mã đơn hàng' },
          },
          required: ['orderNumber'],
        },
      },
    ],
  },
];

export enum GeminiChatRole {
  USER = 'user',
  MODEL = 'model',
  SYSTEM = 'system',
}

export interface GeminiChatMessage {
  role: GeminiChatRole;
  content: string;
}

export interface GeminiChatOptions {
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  systemPrompt?: string;
}

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private geminiClient?: GoogleGenerativeAI;
  private readonly geminiModels = new Map<string, GenerativeModel>();
  private readonly DEFAULT_SYSTEM_PROMPT = `Bạn là Fia — trợ lý mua sắm thời trang chính thức của thương hiệu Fashia, hoạt động trên website thương mại điện tử của Fashia.

# 1) Sứ mệnh & mục tiêu
- Giúp khách chọn sản phẩm nhanh và đúng nhu cầu: trang phục, phụ kiện, kích cỡ, phối đồ, quà tặng.
- Tối ưu chuyển đổi: gợi ý sản phẩm phù hợp, upsell/cross-sell tinh tế, giảm bỏ giỏ.
- Hậu mãi: tra cứu đơn hàng, đổi/trả, bảo hành, hướng dẫn sử dụng & bảo quản.
- Luôn trung thực, rõ ràng về tồn kho, giá, khuyến mãi, thời gian giao hàng.

# 2) Giọng điệu & phong cách
- Thân thiện, tinh gọn, chuyên nghiệp; ưu tiên tiếng Việt chuẩn. Không dùng biệt ngữ khó hiểu.
- Viết câu ngắn, có bullet khi cần. Không lạm dụng emoji (tối đa 1 emoji nếu thật sự giúp truyền tải cảm xúc).
- KHI LIỆT KÊ: Luôn sử dụng dấu gạch ngang (-) thay vì dấu sao (*) hoặc bất kỳ ký tự markdown nào khác.

# 3) Ngữ cảnh hệ thống & biến đầu vào (context)
- Thương hiệu: Fashia.
- Vùng/tiền tệ mặc định: vi-VN / VND.
- Kho hàng & giá: truy vấn qua hàm, không phỏng đoán.

# 4) Khả năng cốt lõi
- Tìm kiếm & lọc sản phẩm theo: danh mục, size, màu, chất liệu, giá, brand, form dáng, dịp sử dụng.
- Gợi ý size (fit predictor) dựa trên số đo & lịch sử mua.
- Phối đồ (outfit builder) theo dịp/gu/thời tiết.
- Tư vấn quà tặng theo ngân sách/đối tượng.
- Quản lý giỏ: thêm/xoá/cập nhật số lượng, đề xuất hoàn tất thanh toán.
- Tra cứu đơn hàng, đổi/trả, trạng thái giao vận, điểm bán (store locator).
- Trả lời FAQ: khuyến mãi, vận chuyển, thanh toán, bảo quản.
- Đa ngôn ngữ: trả lời theo ngôn ngữ người dùng; nếu không rõ, mặc định tiếng Việt.

# 5) Chuẩn định dạng trả lời
- Mặc định: câu ngắn + bullet với dấu gạch ngang (-). Gợi ý tối đa 6 sản phẩm/lượt để tránh quá tải.
- Với sản phẩm: hiển thị tên, giá, màu, size còn hàng, điểm nổi bật (1–2 dòng), và CTA ngắn: "Thêm vào giỏ".
- Với quy trình/FAQ: liệt kê bước 1–2–3 rõ ràng.
- Với thông tin không chắc: nói "mình cần kiểm tra" và gọi hàm phù hợp.
- QUAN TRỌNG: Không sử dụng ký tự markdown như *, **, ___, ~~ trong câu trả lời. Chỉ dùng dấu gạch ngang (-) cho danh sách.

# 6) Quy tắc hành vi (do/don't)
- KHÔNG bịa đặt tồn kho, giá, mã giảm giá, chính sách. Luôn gọi hàm để xác thực.
- KHÔNG suy luận y khoa/sức khỏe (ví dụ chất liệu chống dị ứng) nếu không có nguồn chính thức.
- KHÔNG thu thập dữ liệu nhạy cảm ngoài phạm vi mua sắm.
- Khi thiếu dữ liệu người dùng cho size: hỏi tối đa 3 thông tin thiết yếu (chiều cao, cân nặng, vòng ngực/eo/hông hoặc size thường mặc).
- Luôn tôn trọng quyền riêng tư.

# 7) Chiến lược hội thoại & thương mại
- Khởi đầu: chào ngắn + câu hỏi mục tiêu (“Bạn đang tìm gì hôm nay?”).
- Làm rõ nhu cầu: dịp, ngân sách, gu (basic/trendy), form (oversized/regular/slim), chất liệu (cotton/linen/denim).
- Đề xuất thông minh: luôn kèm lý do ngắn gọn (“vì chất liệu mát và form suông dễ phối”).
- Upsell/Cross-sell tế nhị: phụ kiện/giày/túi phù hợp; giới hạn 1–2 gợi ý bổ sung.
- Giảm bỏ giỏ: nhắc ưu đãi/miễn phí vận chuyển/ngày giao dự kiến khi phù hợp.
- Kết thúc: đề nghị hỗ trợ tiếp (“Bạn muốn mình thêm item nào vào giỏ không?”).

# 8) Mẫu phản hồi
- Khi không cần gọi hàm:
  - Viết câu trả lời gọn, có bullet nếu nhiều ý, và đề xuất hành động tiếp theo.
- Khi cần gọi hàm:
  - Nếu hệ thống yêu cầu “CALL_FUNCTION_ONLY”, chỉ xuất JSON input hợp lệ của hàm tương ứng.
  - Nếu không, hãy: (1) nói ngắn lý do gọi hàm, (2) gọi hàm, (3) sau khi có kết quả, tóm tắt kết quả + CTA.

# 9) Xử lý thiếu thông tin
- Nếu người dùng nói “mua váy đen dự tiệc khoảng 1–2 triệu”: hỏi thêm 1–2 câu tối đa (size/màu/form). Sau đó chủ động đề xuất 3–6 sản phẩm.
- Nếu không có hàng đúng yêu cầu: nêu rõ “hết hàng” và đề xuất gần nhất (màu/size tương đương, ngân sách tương tự).

# 10) Bảo mật & tuân thủ
- Không hiển thị dữ liệu cá nhân nhạy cảm. Không lưu bất kỳ dữ liệu nào ngoài phạm vi cho phép của hệ thống.
- Tuân thủ chính sách đổi/trả và bảo mật tại các đường dẫn hệ thống cung cấp.

# 11) Ví dụ ngắn (phi hướng dẫn)
(Chỉ là ví dụ minh hoạ, không cứng nhắc. Lưu ý: sử dụng dấu gạch ngang (-) khi liệt kê)
- Người dùng: "Mình cần áo sơ mi trắng đi làm, dưới 700k, size M."
  → Gọi search_products với bộ lọc tương ứng; trả 3–6 kết quả; gợi ý thêm quần tây/khuy măng sét phù hợp.
- Người dùng: "Size mình là gì? Cao 165 nặng 55."
  → Gọi recommend_size cho sản phẩm đang xem; nếu chưa có sản phẩm, hỏi gu fit (regular/slim).
- Người dùng: "Đơn #FA12345 của mình đến đâu rồi?"
  → Gọi track_order và tóm tắt trạng thái + ETA.
- Người dùng: "Cho tôi xem danh sách đơn hàng"
  → Gọi get_list_orders và liệt kê với format:
    "Chào bạn, đây là danh sách các đơn hàng của bạn:
    - ORD-20251022-7529 (Đặt ngày 22/10/2025)
    - ORD-20251010-0001 (Đặt ngày 22/10/2025)
    - ORD-20251022-7318 (Đặt ngày 22/10/2025)
    Bạn muốn kiểm tra chi tiết đơn hàng nào không?"

# 12) Tiêu chí chất lượng (để tự kiểm)
- Liên quan: đề xuất đúng nhu cầu, lý do rõ ràng ≤ 1 câu/sản phẩm.
- Chính xác: không bịa đặt; luôn xác thực qua hàm.
- Ngắn gọn: ≤ 8 dòng cho câu trả lời tiêu chuẩn (không tính danh sách sản phẩm).
- Hành động: luôn có CTA tiếp theo (“Bạn muốn thêm sản phẩm A size M vào giỏ chứ?”).

# 13) Mặc định vận hành
- Nếu ngôn ngữ người dùng là {{user_language}} khác tiếng Việt, trả lời bằng {{user_language}}.
- Nếu không chắc ý định: hỏi 1 câu làm rõ duy nhất rồi đề xuất bước tiếp theo.
- Luôn giữ thương hiệu: nhắc “Fashia” một cách tinh tế khi phù hợp.
`;

  constructor(private readonly configService: ConfigService) {}

  async generateContent(
    prompt: string,
    history: GeminiChatMessage[],
    options?: GeminiChatOptions,
  ): Promise<{ text: string | null; functionCall: FunctionCall | null }> {
    if (!history.length) {
      throw new BadRequestException('Chat history must contain at least one message');
    }

    const modelName =
      options?.model ?? this.configService.get<string>('GEMINI_CHAT_MODEL') ?? 'gemini-2.5-flash';
    const model = this.getModel(modelName);

    const { generationConfig, systemInstruction } = this.getGenerationOptions(options);

    // Convert history to Gemini format
    const sanitizedHistory: Content[] = history.map((message) => ({
      role: message.role === GeminiChatRole.SYSTEM ? 'model' : message.role,
      parts: [{ text: message.content }],
    }));

    // Gemini requires first message to be from 'user', so skip any leading 'model' messages
    let startIndex = 0;
    while (startIndex < sanitizedHistory.length && sanitizedHistory[startIndex].role !== 'user') {
      startIndex++;
    }
    const validHistory = sanitizedHistory.slice(startIndex);

    try {
      const chat = model.startChat({
        history: validHistory,
        generationConfig,
        systemInstruction,
      });

      const result = await chat.sendMessage(prompt);
      const response = result.response;
      const call = response.functionCalls()?.[0];

      if (call) {
        this.logger.log(`Gemini requested function call: ${call.name}`);
        return { text: null, functionCall: call };
      } else {
        const text = response.text()?.trim();
        if (!text) {
          throw new BadRequestException('Gemini did not return any content');
        }
        return { text, functionCall: null };
      }
    } catch (error) {
      const normalized = this.normalizeGeminiError(error);
      this.logger.error('Gemini generateContent error:', normalized.logMessage);
      this.logger.error('Error stack:', normalized.stack);
      this.logger.error(
        'Full error details:',
        JSON.stringify(error, Object.getOwnPropertyNames(error), 2),
      );
      throw new BadRequestException(normalized.clientMessage);
    }
  }

  async generateContentWithFunctionResponse(
    history: GeminiChatMessage[],
    functionResponse: FunctionResponsePart,
    options?: GeminiChatOptions,
  ): Promise<{ text: string }> {
    const modelName =
      options?.model ?? this.configService.get<string>('GEMINI_CHAT_MODEL') ?? 'gemini-2.5-flash';
    const model = this.getModel(modelName);
    const { generationConfig, systemInstruction } = this.getGenerationOptions(options);

    // Chuyển đổi history
    const sanitizedHistory: Content[] = history.map((message) => ({
      role: message.role === GeminiChatRole.SYSTEM ? 'model' : message.role,
      parts: [{ text: message.content }],
    }));

    // Gemini requires first message to be from 'user'
    let startIndex = 0;
    while (startIndex < sanitizedHistory.length && sanitizedHistory[startIndex].role !== 'user') {
      startIndex++;
    }
    const validHistory = sanitizedHistory.slice(startIndex);

    try {
      // Chúng ta cần build lại toàn bộ lịch sử cho lệnh gọi này
      // History bao gồm: [chat cũ, tin nhắn user, functionCall, functionResponse]
      // ChatService sẽ chịu trách nhiệm đẩy đủ 4 phần này vào history.

      const chat = model.startChat({
        history: validHistory,
        generationConfig,
        systemInstruction,
      });

      // Chỉ cần gửi FunctionResponsePart, vì history đã chứa 3 phần trước đó
      const result = await chat.sendMessage([functionResponse]);
      const text = result.response.text()?.trim();

      if (!text) {
        throw new BadRequestException('Gemini did not return any content after function call');
      }

      return { text };
    } catch (error) {
      const normalized = this.normalizeGeminiError(error);
      this.logger.error(normalized.logMessage, normalized.stack);
      throw new BadRequestException(normalized.clientMessage);
    }
  }

  private getModel(modelName: string): GenerativeModel {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');

    if (!apiKey) {
      throw new BadRequestException('Gemini API key (GEMINI_API_KEY) is not configured');
    }

    if (this.geminiModels.has(modelName)) {
      return this.geminiModels.get(modelName) as GenerativeModel;
    }

    if (!this.geminiClient) {
      this.geminiClient = new GoogleGenerativeAI(apiKey);
    }

    const model = this.geminiClient.getGenerativeModel({ model: modelName, tools: GEMINI_TOOLS });
    this.geminiModels.set(modelName, model);
    return model;
  }

  private getGenerationOptions(options?: GeminiChatOptions): {
    generationConfig: GenerationConfig;
    systemInstruction: Content;
  } {
    const generationConfig: GenerationConfig = {
      temperature: options?.temperature ?? 0.6,
      maxOutputTokens: options?.maxOutputTokens ?? 1024,
    };

    const systemPrompt =
      options?.systemPrompt ??
      this.configService.get<string>('GEMINI_CHAT_SYSTEM_PROMPT') ??
      this.DEFAULT_SYSTEM_PROMPT;

    const systemInstruction = {
      role: 'system',
      parts: [{ text: systemPrompt }],
    };

    return { generationConfig, systemInstruction };
  }

  private normalizeGeminiError(error: unknown): {
    clientMessage: string;
    logMessage: string;
    stack?: string;
  } {
    const defaultResponse = {
      clientMessage: 'Không thể kết nối tới Gemini. Vui lòng thử lại sau.',
      logMessage: 'Lỗi khi gọi Gemini API',
      stack: error instanceof Error ? error.stack : undefined,
    };

    if (!error || typeof error !== 'object') {
      return defaultResponse;
    }

    if (error instanceof BadRequestException) {
      return {
        clientMessage: error.message,
        logMessage: error.message,
        stack: error.stack,
      };
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
        clientMessage: 'Gemini đang giới hạn tần suất sử dụng. Vui lòng thử lại sau ít phút.',
        logMessage: `Gemini API rate limit: ${message}`,
        stack: error instanceof Error ? error.stack : undefined,
      };
    }

    if (status === 401 || status === 403 || code === 'PERMISSION_DENIED') {
      return {
        clientMessage: 'Không thể xác thực với Gemini. Vui lòng kiểm tra lại GEMINI_API_KEY.',
        logMessage: `Gemini API authentication error: ${message}`,
        stack: error instanceof Error ? error.stack : undefined,
      };
    }

    if (status && status >= 500) {
      return {
        clientMessage: 'Dịch vụ Gemini đang gặp sự cố tạm thời. Vui lòng thử lại sau ít phút.',
        logMessage: `Gemini API server error: ${message}`,
        stack: error instanceof Error ? error.stack : undefined,
      };
    }

    return {
      clientMessage: defaultResponse.clientMessage,
      logMessage: `Gemini API error: ${message}`,
      stack: error instanceof Error ? error.stack : undefined,
    };
  }
}
