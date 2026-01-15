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
  Schema,
  SchemaType,
  HarmCategory,
  HarmBlockThreshold,
} from '@google/generative-ai';
import {
  AnalyzeProductReviewParams,
  AnalyzeProductReviewResult,
} from './interfaces/review-analysis.interface';

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
            limit: { type: SchemaType.NUMBER, description: 'mặc định 5' },
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
                  variant_id: { type: SchemaType.NUMBER },
                  quantity: { type: SchemaType.NUMBER },
                },
                required: ['variant_id', 'quantity'],
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
              description: 'Số lượng đơn hàng tối đa trả về, mặc định 5',
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
      // 8.12. get_my_cart
      {
        name: 'get_my_cart',
        description:
          'Lấy giỏ hàng của người dùng hiện tại với đầy đủ thông tin sản phẩm, biến thể, giá và hình ảnh.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            request_source: {
              type: SchemaType.STRING,
              description: 'Mặc định là "user_request"',
              nullable: true,
            },
          },
        },
      },
      // 8.12b get_my_addresses
      {
        name: 'get_my_addresses',
        description: 'Lấy danh sách địa chỉ giao hàng của người dùng hiện tại.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            request_source: {
              type: SchemaType.STRING,
              description: 'Mặc định là "user_request"',
              nullable: true,
            },
          },
        },
      },
      // 8.12c get_payment_methods
      {
        name: 'get_payment_methods',
        description: 'Lấy danh sách các phương thức thanh toán khả dụng.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            request_source: {
              type: SchemaType.STRING,
              description: 'Mặc định là "user_request"',
              nullable: true,
            },
          },
        },
      },
      // 8.12d get_available_vouchers
      {
        name: 'get_available_vouchers',
        description: 'Lấy danh sách voucher/mã giảm giá có sẵn cho người dùng hiện tại.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            request_source: {
              type: SchemaType.STRING,
              description: 'Mặc định là "user_request"',
              nullable: true,
            },
          },
        },
      },
      // 8.12e validate_voucher
      {
        name: 'validate_voucher',
        description: 'Kiểm tra xem mã voucher có hợp lệ không và tính số tiền được giảm.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            code: {
              type: SchemaType.STRING,
              description: 'Mã voucher cần kiểm tra',
            },
            orderTotal: {
              type: SchemaType.NUMBER,
              description: 'Tổng giá trị đơn hàng (để kiểm tra điều kiện áp dụng)',
            },
          },
          required: ['code', 'orderTotal'],
        },
      },
      // 8.13. create_order
      {
        name: 'create_order',
        description:
          'Tạo đơn hàng từ các sản phẩm trong giỏ hàng. Yêu cầu địa chỉ giao hàng và phương thức thanh toán.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            addressId: {
              type: SchemaType.NUMBER,
              description: 'ID địa chỉ giao hàng của người dùng',
            },
            paymentMethod: {
              type: SchemaType.STRING,
              format: 'enum',
              enum: ['COD', 'BANK', 'STORE'],
              description:
                'Phương thức thanh toán: COD (tiền mặt khi nhận hàng), BANK (chuyển khoản ngân hàng), STORE (thanh toán tại cửa hàng)',
            },
            voucherId: {
              type: SchemaType.NUMBER,
              description: 'ID voucher/mã giảm giá (tùy chọn)',
            },
            items: {
              type: SchemaType.ARRAY,
              description:
                'Danh sách các sản phẩm cần đặt hàng. Nếu không truyền, sẽ đặt tất cả sản phẩm trong giỏ.',
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  variantId: { type: SchemaType.NUMBER, description: 'ID biến thể sản phẩm' },
                  quantity: { type: SchemaType.NUMBER, description: 'Số lượng' },
                },
                required: ['variantId', 'quantity'],
              },
            },
            note: {
              type: SchemaType.STRING,
              description: 'Ghi chú cho đơn hàng',
            },
          },
          required: ['addressId', 'paymentMethod'],
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
  tools?: Tool[];
  responseMimeType?: string;
  retryAttempts?: number;
  responseSchema?: Schema;
}

interface ToolCallParsed {
  name?: string;
  args?: unknown;
  functionResponse?: {
    name: string;
    response: unknown;
  };
}

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private geminiClient?: GoogleGenerativeAI;
  private readonly geminiModels = new Map<string, GenerativeModel>();
  private readonly geminiEmbeddingModels = new Map<string, GenerativeModel>();
  private readonly DEFAULT_SYSTEM_PROMPT = `Bạn là Fia — trợ lý mua sắm thời trang chính thức của thương hiệu Fashia, hoạt động trên website thương mại điện tử của Fashia.

# 1) Mục tiêu cốt lõi
- Hỗ trợ khách hàng tìm kiếm & lựa chọn sản phẩm thời trang phù hợp.
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
- QUAN TRỌNG: Với các hàm 'get_my_cart', 'get_my_addresses', 'get_payment_methods', 'get_available_vouchers', 'get_list_orders': KHÔNG liệt kê chi tiết dữ liệu trong tin nhắn text vì Frontend đã có UI Card hiển thị. Chỉ phản hồi ngắn gọn (ví dụ: "Đây là giỏ hàng của bạn:", "Vui lòng chọn địa chỉ bên dưới:").
- QUAN TRỌNG: Không sử dụng ký tự markdown như *, , ___, ~~ trong câu trả lời. Chỉ dùng dấu gạch ngang (-) cho danh sách.

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

# 12) Tiêu chí chất lượng (để tự kiểm)
- Liên quan: đề xuất đúng nhu cầu, lý do rõ ràng ≤ 1 câu/sản phẩm.
- Chính xác: không bịa đặt; luôn xác thực qua hàm.
- Ngắn gọn: ≤ 8 dòng cho câu trả lời tiêu chuẩn (không tính danh sách sản phẩm).
- Hành động: luôn có CTA tiếp theo (“Bạn muốn thêm sản phẩm A size M vào giỏ chứ?”).

# CHECKOUT FLOW (STRICT)
Luôn tuân thủ thứ tự gọi hàm và phản hồi ngắn gọn để kích hoạt UI Card:

1.  Trigger: Khách muốn đặt hàng, mua ngay, hoặc chọn biến thể cụ thể (ví dụ: "đặt hàng các biến thể: 123...").
    -> Action: Gọi get_my_addresses.
    -> Response: "Vui lòng chọn địa chỉ nhận hàng bên dưới."

2.  Trigger: Khách đã chọn Address.
    -> Action: Gọi get_payment_methods.
    -> Response: "Vui lòng chọn phương thức thanh toán."

3.  Trigger: Khách đã chọn Payment.
    -> Action: Gọi get_available_vouchers.
    -> Response (có voucher): "Bạn có muốn áp mã giảm giá không?"
    -> Response (không có voucher - mảng rỗng): "Hiện không có mã giảm giá khả dụng. Bạn có muốn tiến hành đặt hàng không?"

4.  Trigger: Khách chọn Voucher, bỏ qua voucher, hoặc không có voucher và xác nhận đặt hàng.
    -> Action: Gọi create_order(addressId, paymentMethod, voucherId). Nếu không có voucher thì KHÔNG truyền voucherId.
    -> Response: Xác nhận đơn thành công.

*Lưu ý: KHÔNG đọc lại dữ liệu từ hàm (địa chỉ, voucher...). Frontend sẽ tự hiển thị.*

# 14) Mặc định vận hành
- Nếu ngôn ngữ người dùng là {{user_language}} khác tiếng Việt, trả lời bằng {{user_language}}.
- Nếu không chắc ý định: hỏi 1 câu làm rõ duy nhất rồi đề xuất bước tiếp theo.
- Luôn giữ thương hiệu: nhắc “Fashia” một cách tinh tế khi phù hợp.

Trước khi trả lời, hãy tự suy luận:
1. Người dùng đang cần thông tin gì?
2. Có hàm nào cung cấp thông tin đó không?
3. Nếu có, hãy gọi hàm đó ngay lập tức thay vì tự trả lời.
4. Nếu người dùng hỏi về đơn hàng mà không đưa mã đơn, hãy hỏi mã đơn hàng trước, đừng gọi hàm track_order với tham số rỗng.
5. [QUAN TRỌNG] Logic Checkout:
   - Nếu người dùng vừa chọn/xác nhận địa chỉ -> BẮT BUỘC gọi hàm "get_payment_methods".
   - Nếu người dùng vừa chọn/xác nhận phương thức thanh toán -> BẮT BUỘC gọi hàm "get_available_vouchers".
   - Nếu người dùng xác nhận đặt hàng -> BẮT BUỘC gọi hàm "create_order".
`;

  constructor(private readonly configService: ConfigService) {}

  async generateContent(
    prompt: string,
    history: GeminiChatMessage[],
    options?: GeminiChatOptions,
  ): Promise<{ text: string | null; functionCall: FunctionCall | null }> {
    const modelName =
      options?.model ?? this.configService.get<string>('GEMINI_CHAT_MODEL') ?? 'gemini-1.5-pro';
    const requestedTools = options?.tools;
    const model = this.getModel(modelName, requestedTools);

    const { generationConfig, systemInstruction } = this.getGenerationOptions(options);

    // ... history logic ...
    // (omitted for brevity, keeping existing logic)

    // Convert history to Gemini format
    const sanitizedHistory: Content[] = [];
    for (const message of history) {
      if (!message.content) continue;

      const role = message.role === GeminiChatRole.SYSTEM ? 'model' : message.role;

      // Flatten tool calls/responses to text to avoid "unclosed function call" validation errors
      // and keep context.

      // Try to detect if this is a function call (JSON)
      if (role === 'model') {
        try {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const parsed: ToolCallParsed = JSON.parse(message.content);

          if (parsed && parsed.name && parsed.args) {
            sanitizedHistory.push({
              role: 'model',
              parts: [
                {
                  text: `[System: Model called tool '${parsed.name}' with args: ${JSON.stringify(parsed.args)}]`,
                },
              ],
            });
            continue;
          }
        } catch {
          // ignore
        }
      }

      // Try to detect function response (user role)
      if (role === GeminiChatRole.USER) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const parsed: ToolCallParsed = JSON.parse(message.content);

          if (parsed && parsed.functionResponse) {
            const respName = parsed.functionResponse.name;

            const respContent = JSON.stringify(parsed.functionResponse.response);
            sanitizedHistory.push({
              role: 'user',
              parts: [{ text: `[System: Tool '${respName}' returned: ${respContent}]` }],
            });
            continue;
          }
        } catch {
          // ignore
        }
      }

      // Regular text
      sanitizedHistory.push({
        role,
        parts: [{ text: message.content }],
      });
    }

    // Gemini requires first message to be from 'user', so skip any leading 'model' messages
    let startIndex = 0;
    while (startIndex < sanitizedHistory.length && sanitizedHistory[startIndex].role !== 'user') {
      startIndex++;
    }
    const validHistory = sanitizedHistory.slice(startIndex);

    const maxAttempts = Math.max(1, options?.retryAttempts ?? 3);
    let attempt = 0;

    while (attempt < maxAttempts) {
      attempt++;

      try {
        this.logger.debug(`GenerateContent Input Attempt ${attempt}: Prompt="${prompt}"`);
        this.logger.debug(
          `GenerateContent History: ${JSON.stringify(validHistory.map((m) => ({ r: m.role, p: m.parts[0].text ? m.parts[0].text.substring(0, 50) + '...' : 'func' })))}`,
        );

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
          const rawCandidate = response.candidates?.[0];
          const parts = rawCandidate?.content?.parts;

          const text = response.text()?.trim();

          if (text) {
            if (attempt > 1) {
              this.logger.log(`Gemini generateContent succeeded after ${attempt} attempt(s).`);
            }
            return { text, functionCall: null };
          }

          // Check if there's a function call in parts that wasn't detected by helper
          const functionCallPart = parts?.find(
            (p: { functionCall?: FunctionCall }) => p.functionCall,
          ) as { functionCall?: FunctionCall } | undefined;
          if (functionCallPart?.functionCall) {
            this.logger.log(
              `Gemini function call found in parts: ${functionCallPart.functionCall.name}`,
            );
            return { text: null, functionCall: functionCallPart.functionCall };
          }

          // No content returned
          this.logger.warn(
            `Gemini returned no content (attempt ${attempt}/${maxAttempts}). finishReason=${rawCandidate?.finishReason}`,
          );

          // Fallback: if this is the last attempt and still no content, return fallback text
          // to avoid "model output must contain..." error crash.
          if (attempt === maxAttempts) {
            this.logger.warn('Gemini retries exhausted with empty content. Returning fallback.');
            return {
              text: 'Xin lỗi, tôi chưa hiểu rõ ý bạn. Bạn có thể nói chi tiết hơn được không?',
              functionCall: null,
            };
          }
          this.logger.warn(`Full Candidate: ${JSON.stringify(rawCandidate)}`);

          // If we haven't exhausted retries, wait and continue
          if (attempt < maxAttempts) {
            const delayMs = this.getRetryDelay(attempt);
            this.logger.log(`Retrying generateContent in ${delayMs}ms...`);
            await this.delay(delayMs);
            continue;
          }
        }
      } catch (error) {
        const normalized = this.normalizeGeminiError(error);
        const isEmptyOutputError =
          normalized.logMessage.includes(
            'model output must contain either output text or tool calls',
          ) ||
          normalized.clientMessage.includes(
            'model output must contain either output text or tool calls',
          );

        // Check if error is retryable
        if ((this.isRetryableGeminiError(error) || isEmptyOutputError) && attempt < maxAttempts) {
          this.logger.warn(
            `Gemini generateContent attempt ${attempt} failed (${normalized.logMessage}); retrying...`,
          );
          await this.delay(this.getRetryDelay(attempt));
          continue;
        }

        // If error is "empty response" and we're out of retries, return fallback
        if (isEmptyOutputError) {
          this.logger.warn(
            'Gemini retries exhausted with empty content error. Returning fallback.',
          );
          return {
            text: 'Xin lỗi, tôi chưa hiểu rõ ý bạn. Bạn có thể nói chi tiết hơn được không?',
            functionCall: null,
          };
        }

        // If strictly not retryable or max attempts reached
        this.logger.error('Gemini generateContent error:', normalized.logMessage);
        this.logger.error('Error stack:', normalized.stack);
        this.logger.error(
          'Full error details:',
          JSON.stringify(error, Object.getOwnPropertyNames(error), 2),
        );
        throw new BadRequestException(normalized.clientMessage);
      }
    }

    // Fallback after all retries failed for empty content
    this.logger.error(
      `Gemini generateContent failed after ${maxAttempts} attempts with empty responses.`,
    );
    return {
      text: 'Xin lỗi, mình đang gặp một chút trục trặc. Bạn vui lòng thử lại nhé! 🙏',
      functionCall: null,
    };
  }

  async generateStructuredContent(prompt: string, options?: GeminiChatOptions): Promise<string> {
    const trimmedPrompt = prompt?.trim();
    if (!trimmedPrompt) {
      throw new BadRequestException('Prompt is required for Gemini generation');
    }

    const modelName =
      options?.model ?? this.configService.get<string>('GEMINI_CHAT_MODEL') ?? 'gemini-1.5-flash';
    const requestedTools = options?.tools ?? [];
    const model = this.getModel(modelName, requestedTools);

    const { generationConfig, systemInstruction } = this.getGenerationOptions(options);

    const contents: Content[] = [
      {
        role: 'user',
        parts: [{ text: trimmedPrompt }],
      },
    ];

    const maxAttempts = Math.max(1, options?.retryAttempts ?? 2);
    let attempt = 0;
    let lastFailure: { clientMessage: string; logMessage: string; stack?: string } | null = null;

    while (attempt < maxAttempts) {
      attempt += 1;

      this.logger.debug(`Context: Calling Gemini generateStructuredContent, attempt=${attempt}`);

      try {
        const result = await model.generateContent({
          contents,
          generationConfig,
          systemInstruction,
        });

        const text = this.extractStructuredText(result.response);
        if (text) {
          if (attempt > 1) {
            this.logger.warn(`Gemini structured content succeeded after ${attempt} attempt(s).`);
          }
          return text;
        }
        // No structured text extracted — log detailed candidate info for debugging
        try {
          const dbg = result.response as unknown as { candidates?: any[]; text?: () => string };
          const candidates = Array.isArray(dbg?.candidates) ? dbg.candidates : [];
          this.logger.debug(`Gemini returned no structured text. candidates=${candidates.length}`);
          for (let i = 0; i < Math.min(6, candidates.length); i++) {
            const c = candidates[i] as unknown;
            let parts = '';
            if (c && typeof c === 'object') {
              const obj = c as Record<string, unknown>;
              const contentVal = obj['content'];
              const contentParts =
                contentVal &&
                typeof contentVal === 'object' &&
                Array.isArray((contentVal as Record<string, unknown>)['parts'])
                  ? ((contentVal as Record<string, unknown>)['parts'] as unknown[])
                  : [];
              const fallbackParts = Array.isArray(obj['parts']) ? (obj['parts'] as unknown[]) : [];

              const chosen = contentParts.length ? contentParts : fallbackParts;
              const mapped = chosen
                .map((p) => {
                  if (p && typeof p === 'object') {
                    const t = (p as Record<string, unknown>)['text'];
                    return typeof t === 'string' ? t : '';
                  }
                  return '';
                })
                .filter((s) => s.length > 0)
                .slice(0, 120)
                .join(' | ');
              parts = mapped;
            }
            this.logger.debug(`candidate[${i}]=${parts}`);
          }
        } catch (err) {
          this.logger.debug(
            'Failed to dump Gemini candidates for debugging',
            err instanceof Error ? err.stack : String(err),
          );
        }

        this.logger.warn(
          `Gemini returned empty structured content (attempt ${attempt}/${maxAttempts}).`,
        );
        lastFailure = {
          clientMessage: 'Gemini không phản hồi nội dung phù hợp. Vui lòng thử lại.',
          logMessage: 'Gemini returned empty structured content response',
        };
      } catch (error) {
        const normalized = this.normalizeGeminiError(error);
        lastFailure = normalized;

        if (!this.isRetryableGeminiError(error) || attempt >= maxAttempts) {
          this.logger.error('Gemini generateStructuredContent error:', normalized.logMessage);
          if (normalized.stack) {
            this.logger.error('Error stack:', normalized.stack);
          }
          this.logger.error(
            'Full error details:',
            JSON.stringify(error, Object.getOwnPropertyNames(error), 2),
          );
          throw new BadRequestException(normalized.clientMessage);
        }

        this.logger.warn(
          `Gemini structured content attempt ${attempt} failed (${normalized.logMessage}); retrying...`,
        );
      }

      if (attempt < maxAttempts) {
        await this.delay(this.getRetryDelay(attempt));
      }
    }

    const failureMessage =
      lastFailure?.clientMessage ?? 'Gemini không phản hồi nội dung phù hợp. Vui lòng thử lại.';
    if (lastFailure) {
      this.logger.error('Gemini generateStructuredContent error:', lastFailure.logMessage);
      if (lastFailure.stack) {
        this.logger.error('Error stack:', lastFailure.stack);
      }
    }
    throw new BadRequestException(failureMessage);
  }

  async generateContentWithFunctionResponse(
    history: GeminiChatMessage[],
    functionResponse: FunctionResponsePart,
    options?: GeminiChatOptions,
  ): Promise<{ text: string }> {
    const modelName =
      options?.model ?? this.configService.get<string>('GEMINI_CHAT_MODEL') ?? 'gemini-1.5-pro';
    const requestedTools = options?.tools;
    const model = this.getModel(modelName, requestedTools);
    const { generationConfig, systemInstruction } = this.getGenerationOptions(options);

    // Build proper history for Gemini
    // The history should include:
    // 1. All previous user/model messages (text)
    // 2. The model's function call (as the last model message)
    // We do NOT include the function response in history - it's sent via sendMessage
    // Build proper history for Gemini
    // 1. Flatten OLD history (safe text descriptions)
    // 2. Ensure LAST item is the real FunctionCall (required for state)
    const properHistory: Content[] = [];

    for (let i = 0; i < history.length; i++) {
      const message = history[i];
      const isLast = i === history.length - 1;
      const role = message.role === GeminiChatRole.SYSTEM ? 'model' : message.role;

      if (!message.content) continue;

      // Last message MUST be the function call we are responding to
      if (isLast && role === 'model') {
        try {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const parsed: any = JSON.parse(message.content);
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          if (parsed && typeof parsed.name === 'string' && parsed.args !== undefined) {
            properHistory.push({
              role: 'model',
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
              parts: [{ functionCall: { name: parsed.name, args: parsed.args } }],
            });
            continue;
          }
        } catch {
          // ignore
        }
      }

      // For all other messages, flatten to text
      // Model function call
      if (role === 'model') {
        try {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const parsed: ToolCallParsed = JSON.parse(message.content);

          if (parsed && parsed.name && parsed.args) {
            properHistory.push({
              role: 'model',
              parts: [
                {
                  text: `[System: Model called tool '${parsed.name}' with args: ${JSON.stringify(parsed.args)}]`,
                },
              ],
            });
            continue;
          }
        } catch {
          // ignore
        }
      }

      // User function response
      if (role === GeminiChatRole.USER) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const parsed: any = JSON.parse(message.content);
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          if (parsed && parsed.functionResponse) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            const respName = parsed.functionResponse.name;
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            const respContent = JSON.stringify(parsed.functionResponse.response);
            properHistory.push({
              role: 'user',
              parts: [{ text: `[System: Tool '${respName}' returned: ${respContent}]` }],
            });
            continue;
          }
        } catch {
          // ignore
        }
      }

      // Regular text
      properHistory.push({
        role,
        parts: [{ text: message.content }],
      });
    }

    // Gemini requires first message to be from 'user'
    let startIndex = 0;
    while (startIndex < properHistory.length && properHistory[startIndex].role !== 'user') {
      startIndex++;
    }
    const validHistory = properHistory.slice(startIndex);

    this.logger.debug(
      `Gemini generateContentWithFunctionResponse: history length=${validHistory.length}`,
    );

    try {
      const chat = model.startChat({
        history: validHistory,
        generationConfig,
        systemInstruction,
      });

      // Send the function response to get Gemini's final text response
      const result = await chat.sendMessage([functionResponse]);
      const text = result.response.text()?.trim();

      if (!text) {
        this.logger.warn('Gemini returned empty text after function response');
        return { text: 'Đã xử lý yêu cầu của bạn.' };
      }

      return { text };
    } catch (error) {
      const normalized = this.normalizeGeminiError(error);
      const isEmptyOutputError =
        normalized.logMessage.includes(
          'model output must contain either output text or tool calls',
        ) ||
        normalized.clientMessage.includes(
          'model output must contain either output text or tool calls',
        );

      if (isEmptyOutputError) {
        this.logger.warn(
          'Gemini generateContentWithFunctionResponse returned empty content error. Returning fallback.',
        );
        return { text: 'Đã xử lý xong yêu cầu của bạn.' };
      }

      this.logger.error('Gemini generateContentWithFunctionResponse error:', normalized.logMessage);
      this.logger.error('Error stack:', normalized.stack);
      throw new BadRequestException(normalized.clientMessage);
    }
  }

  async analyzeProductReview(
    params: AnalyzeProductReviewParams,
  ): Promise<AnalyzeProductReviewResult> {
    const modelName = this.configService.get<string>('GEMINI_REVIEW_MODEL') ?? 'gemini-1.5-pro';
    const model = this.getModel(modelName);

    const systemPrompt =
      'Bạn là chuyên gia phân tích đánh giá (review) cho thương hiệu thời trang Fashia. ' +
      'Đọc kỹ nội dung review của khách hàng và trả về JSON với các trường bắt buộc: ' +
      '{ sentiment: one_of("positive","negative","neutral"), key_topics: string[], summary: string }.' +
      'Các key_topics phải là danh sách ngắn gọn (2-4 từ) mô tả chủ đề chính khách nhắc tới. ' +
      'Summary phải là tiếng Việt, tối đa 2 câu, phản ánh đúng nội dung review.';

    const requestPayload = {
      review_text: params.comment,
      rating: params.ratingValue,
      product_id: params.productId,
      user_id: params.userId,
    } satisfies Record<string, unknown>;

    try {
      const response = await model.generateContent({
        systemInstruction: {
          role: 'system',
          parts: [{ text: systemPrompt }],
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: JSON.stringify(requestPayload) }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          topP: 0.8,
          maxOutputTokens: 512,
          responseMimeType: 'application/json',
        },
      });

      const text = response.response.text();
      if (!text) {
        throw new BadRequestException('Gemini did not return review analysis content');
      }

      const parsed = this.safeParseJson(text);

      const sentiment = this.normalizeSentiment(parsed.sentiment);
      const keyTopics = this.normalizeKeyTopics(parsed.key_topics ?? parsed.keyTopics);
      const summary = this.normalizeSummary(parsed.summary);

      return {
        sentiment,
        keyTopics,
        summary,
        raw: parsed,
      };
    } catch (error) {
      const normalized = this.normalizeGeminiError(error);
      this.logger.error('Gemini analyzeProductReview error:', normalized.logMessage);
      if (normalized.stack) {
        this.logger.error(normalized.stack);
      }
      throw new BadRequestException(normalized.clientMessage);
    }
  }

  private getModel(modelName: string, tools?: Tool[]): GenerativeModel {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');

    if (!apiKey) {
      throw new BadRequestException('Gemini API key (GEMINI_API_KEY) is not configured');
    }

    const effectiveTools = tools ?? GEMINI_TOOLS;
    const cacheKey = this.buildModelCacheKey(modelName, effectiveTools);

    if (this.geminiModels.has(cacheKey)) {
      return this.geminiModels.get(cacheKey) as GenerativeModel;
    }

    if (!this.geminiClient) {
      this.geminiClient = new GoogleGenerativeAI(apiKey);
    }

    const model = this.geminiClient.getGenerativeModel({
      model: modelName,
      tools: effectiveTools,
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
      ],
    });
    this.geminiModels.set(cacheKey, model);
    return model;
  }

  private buildModelCacheKey(modelName: string, tools: Tool[]): string {
    if (!tools.length) {
      return `${modelName}::no-tools`;
    }

    const toolKey = tools
      .map((tool) => {
        if ('functionDeclarations' in tool && Array.isArray(tool.functionDeclarations)) {
          return tool.functionDeclarations.map((fn) => fn.name ?? '__anon__').join(',');
        }
        return 'custom_tool';
      })
      .join('|');
    return `${modelName}::${toolKey}`;
  }

  private safeParseJson(payload: string): Record<string, unknown> {
    try {
      const parsed: unknown = JSON.parse(payload);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      throw new Error('Parsed JSON is not an object');
    } catch (error) {
      this.logger.error(
        'Failed to parse Gemini JSON response',
        error instanceof Error ? error.stack : undefined,
      );
      throw new BadRequestException('Gemini trả về dữ liệu không hợp lệ');
    }
  }

  private normalizeSentiment(value: unknown): AnalyzeProductReviewResult['sentiment'] {
    const normalized = String(value).toLowerCase();
    if (normalized === 'positive' || normalized === 'negative' || normalized === 'neutral') {
      return normalized;
    }
    return 'neutral';
  }

  private normalizeKeyTopics(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter((item) => item.length > 0)
      .slice(0, 8);
  }

  private normalizeSummary(value: unknown): string {
    if (typeof value !== 'string') {
      return 'Không có tóm tắt khả dụng.';
    }

    const trimmed = value.trim();
    return trimmed.length ? trimmed : 'Không có tóm tắt khả dụng.';
  }

  async embedText(text: string, modelName?: string): Promise<number[]> {
    const trimmed = text?.trim();
    if (!trimmed) {
      return [];
    }

    const embeddingModelName =
      modelName ?? this.configService.get<string>('GEMINI_EMBEDDING_MODEL') ?? 'text-embedding-004';

    const model = this.getEmbeddingModel(embeddingModelName);

    const maxAttempts = 3;
    let attempt = 0;

    while (attempt < maxAttempts) {
      attempt += 1;
      try {
        const response = await model.embedContent({
          content: { role: 'user', parts: [{ text: trimmed }] },
        });

        const values = response.embedding?.values;
        if (!values || !values.length) {
          this.logger.warn(
            `Gemini did not return embedding values for model ${embeddingModelName}`,
          );
          return [];
        }

        return values;
      } catch (error) {
        const normalized = this.normalizeGeminiError(error);

        if (!this.isRetryableGeminiError(error) || attempt >= maxAttempts) {
          this.logger.error('Gemini embedText error:', normalized.logMessage);
          if (normalized.stack) {
            this.logger.error(normalized.stack);
          }
          throw new BadRequestException(normalized.clientMessage);
        }

        this.logger.warn(
          `Gemini embedText attempt ${attempt} failed (${normalized.logMessage}); retrying...`,
        );

        await this.delay(this.getRetryDelay(attempt));
      }
    }

    throw new BadRequestException('Gemini embedText failed after retries');
  }

  private getEmbeddingModel(modelName: string): GenerativeModel {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');

    if (!apiKey) {
      throw new BadRequestException('Gemini API key (GEMINI_API_KEY) is not configured');
    }

    if (this.geminiEmbeddingModels.has(modelName)) {
      return this.geminiEmbeddingModels.get(modelName) as GenerativeModel;
    }

    if (!this.geminiClient) {
      this.geminiClient = new GoogleGenerativeAI(apiKey);
    }

    const model = this.geminiClient.getGenerativeModel({ model: modelName });
    this.geminiEmbeddingModels.set(modelName, model);
    return model;
  }

  private extractStructuredText(response: unknown): string | null {
    if (!response || typeof response !== 'object') {
      return null;
    }

    const typedResponse = response as {
      text?: () => string | undefined | null;
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string | null }>;
        };
        parts?: Array<{ text?: string | null }>;
      }>;
    };

    try {
      const direct = typeof typedResponse.text === 'function' ? typedResponse.text()?.trim() : null;
      if (direct) {
        return direct;
      }
    } catch (error) {
      this.logger.debug(
        `Unable to read Gemini response text directly: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    const candidates = Array.isArray(typedResponse.candidates) ? typedResponse.candidates : [];

    for (const candidate of candidates) {
      const contentParts = Array.isArray(candidate?.content?.parts)
        ? (candidate.content?.parts as Array<{ text?: string | null }>)
        : [];
      const fallbackParts = Array.isArray(candidate?.parts)
        ? (candidate.parts as Array<{ text?: string | null }>)
        : [];

      const parts = contentParts.length ? contentParts : fallbackParts;

      const collected = parts
        .map((part) => (typeof part?.text === 'string' ? part.text.trim() : ''))
        .filter((segment) => segment.length > 0);

      if (collected.length) {
        return collected.join('\n');
      }
    }

    return null;
  }

  private isRetryableGeminiError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const status = (error as { status?: number }).status;
    if (status && [429, 500, 502, 503, 504].includes(status)) {
      return true;
    }

    const code =
      (error as { code?: string }).code ??
      (error as { statusText?: string }).statusText ??
      (error as { error?: { code?: string } }).error?.code;

    if (code && ['RESOURCE_EXHAUSTED', 'UNAVAILABLE', 'ABORTED'].includes(code)) {
      return true;
    }

    const message =
      (error as { message?: string }).message ??
      (error as { error?: { message?: string } }).error?.message ??
      '';

    if (typeof message === 'string') {
      return /temporarily unavailable|overloaded|timeout/i.test(message);
    }

    return false;
  }

  private getRetryDelay(attempt: number): number {
    // Exponential backoff with jitter
    const base = 1000; // 1 second base
    const maxDelay = 30000; // 30 seconds max
    const exponentialDelay = base * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 500; // Add up to 500ms jitter
    return Math.min(maxDelay, exponentialDelay + jitter);
  }

  private async delay(ms: number): Promise<void> {
    if (ms <= 0) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private getGenerationOptions(options?: GeminiChatOptions): {
    generationConfig: GenerationConfig;
    systemInstruction: Content;
  } {
    const generationConfig: GenerationConfig = {
      temperature: options?.temperature ?? 0.6,
      maxOutputTokens: options?.maxOutputTokens ?? 1024,
    };

    if (options?.responseMimeType?.trim()) {
      generationConfig.responseMimeType = options.responseMimeType;
    }

    if (options?.responseSchema) {
      generationConfig.responseSchema = options.responseSchema;
    }

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
