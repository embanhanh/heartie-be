import { SchemaType, Tool } from '@google/generative-ai';

import { ADMIN_COPILOT_RANGE_OPTIONS } from './admin-copilot.constants';

export const ADMIN_COPILOT_TOOLS: Tool[] = [
  {
    functionDeclarations: [
      {
        name: 'get_revenue_overview',
        description:
          'Lấy tổng quan doanh thu, số đơn, sản phẩm bán ra và dự báo cho khoảng thời gian gần nhất.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            range: {
              type: SchemaType.STRING,
              format: 'enum',
              description: 'Khoảng thời gian phân tích',
              enum: [...ADMIN_COPILOT_RANGE_OPTIONS],
            },
            granularity: {
              type: SchemaType.STRING,
              format: 'enum',
              enum: ['day', 'week', 'month'],
            },
            forecastPeriods: {
              type: SchemaType.NUMBER,
              description: 'Số kỳ dự báo tiếp theo',
            },
          },
        },
      },
      {
        name: 'get_top_products',
        description: 'Lấy danh sách sản phẩm bán chạy theo doanh thu.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            range: {
              type: SchemaType.STRING,
              format: 'enum',
              enum: [...ADMIN_COPILOT_RANGE_OPTIONS],
            },
            limit: { type: SchemaType.NUMBER, description: 'Số lượng sản phẩm, mặc định 5' },
          },
        },
      },
      {
        name: 'get_stock_alerts',
        description: 'Liệt kê các SKU tồn kho thấp để kịp thời bổ sung.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            threshold: {
              type: SchemaType.NUMBER,
              description: 'Ngưỡng tồn kho tối thiểu để cảnh báo',
            },
            branchId: {
              type: SchemaType.NUMBER,
              description: 'Lọc theo chi nhánh cụ thể (tùy chọn)',
            },
            limit: {
              type: SchemaType.NUMBER,
              description: 'Số lượng cảnh báo tối đa trả về',
            },
          },
        },
      },
      {
        name: 'generate_post_campaign',
        description:
          // Vietnamese:
          // - Dùng tool này cho BƯỚC LÊN KẾ HOẠCH/NHÁP ban đầu:
          //   + Khi admin yêu cầu gợi ý nội dung, nhiều phiên bản caption, hashtag, lịch đăng.
          //   + Khi brief còn đang được làm rõ.
          // - KHÔNG dùng tool này để lưu bản nháp cuối cùng vào Ads AI.
          // - Khi admin nói các câu như "tạo mẫu chính thức", "lưu mẫu này", "tạo mẫu từ nội dung trên", "thêm hình ảnh tôi vừa gửi vào mẫu trên và tạo mẫu"
          //   thì HÃY DÙNG tool "finalize_post_campaign" thay vì tool này.
          'Tạo kế hoạch nội dung bài đăng Facebook (caption, hashtag, gợi ý lịch đăng) dựa trên brief được cung cấp. ' +
          'Dùng cho bước lên kế hoạch/nháp ban đầu, KHÔNG dùng để lưu mẫu chính thức.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            brief: {
              type: SchemaType.OBJECT,
              description: 'Brief nội dung do admin cung cấp hoặc đã được làm rõ cùng trợ lý.',
              properties: {
                campaignName: { type: SchemaType.STRING, description: 'Tên chiến dịch/bài viết.' },
                objective: {
                  type: SchemaType.STRING,
                  description: 'Mục tiêu chính (ví dụ: tăng nhận diện, thúc đẩy doanh số).',
                },
                targetAudience: {
                  type: SchemaType.STRING,
                  description: 'Tệp khách hàng hướng đến (độ tuổi, sở thích, hành vi).',
                },
                tone: {
                  type: SchemaType.STRING,
                  description: 'Tông giọng mong muốn (ví dụ: sang trọng, trẻ trung, thân thiện).',
                },
                productFocus: {
                  type: SchemaType.STRING,
                  description: 'Sản phẩm/ưu đãi trọng tâm cần nhấn mạnh.',
                },
                keyMessages: {
                  type: SchemaType.ARRAY,
                  description: 'Các thông điệp chính phải truyền tải.',
                  items: { type: SchemaType.STRING },
                },
                offers: {
                  type: SchemaType.ARRAY,
                  description: 'Chương trình ưu đãi hoặc lợi ích dành cho khách hàng.',
                  items: { type: SchemaType.STRING },
                },
                callToAction: {
                  type: SchemaType.STRING,
                  description: 'CTA mong muốn (ví dụ: Đặt lịch ngay, Mua ngay, Đăng ký).',
                },
                schedule: {
                  type: SchemaType.OBJECT,
                  description: 'Thông tin lịch đăng (nếu đã có gợi ý cụ thể).',
                  properties: {
                    date: {
                      type: SchemaType.STRING,
                      description: 'Ngày dự kiến đăng (ISO hoặc yyyy-mm-dd).',
                    },
                    time: {
                      type: SchemaType.STRING,
                      description: 'Khung giờ mong muốn đăng (hh:mm).',
                    },
                    timezone: {
                      type: SchemaType.STRING,
                      description: 'Múi giờ áp dụng, ví dụ: Asia/Ho_Chi_Minh.',
                    },
                  },
                },
                notes: {
                  type: SchemaType.STRING,
                  description: 'Lưu ý thêm (ví dụ: nhắc đến influencer, yêu cầu brand guideline).',
                },
              },
            },
            variants: {
              type: SchemaType.NUMBER,
              description: 'Số lượng phương án bài viết cần tạo (1-3), mặc định 1.',
            },
            language: {
              type: SchemaType.STRING,
              description: 'Ngôn ngữ ưu tiên cho nội dung (ví dụ: vi, en).',
            },
            format: {
              type: SchemaType.STRING,
              description: 'Độ dài mong muốn cho caption (short/medium/long).',
            },
            hashtags: {
              type: SchemaType.ARRAY,
              description: 'Hashtag cần ưu tiên đưa vào.',
              items: { type: SchemaType.STRING },
            },
          },
          required: ['brief'],
        },
      },
      {
        name: 'finalize_post_campaign',
        description:
          // Vietnamese:
          // - Dùng tool này khi admin đã CHỐT nội dung hoặc yêu cầu "tạo mẫu/lưu mẫu" dựa trên nội dung đã trao đổi.
          // - Các trigger điển hình:
          //   + "tạo mẫu cho bài trên", "tạo mẫu chính thức", "lưu mẫu này", "tạo ads từ gợi ý trên"
          //   + "thêm hình ảnh tôi đã đính kèm vào mẫu trên và tạo mẫu", "dùng sản phẩm này để tạo mẫu"
          // - Metadata của tin nhắn (nếu có) có thể chứa:
          //   + productId hoặc product: { id, name }
          //   + productName
          //   + imageUrl hoặc image: { url, ... }
          // - Khi gọi tool:
          //   + Nếu metadata có productId/product/productName thì hãy map sang các field productId, productName tương ứng.
          //   + Nếu metadata có imageUrl hoặc image.url thì HÃY ĐIỀN vào field "image" để Ads AI biết asset sẽ dùng.
          'Lưu bài viết đã chốt vào Ads AI để quản lý và theo dõi, sử dụng toàn bộ nội dung đã đồng ý. ' +
          'Dùng khi admin yêu cầu “tạo mẫu/lưu mẫu” dựa trên nội dung đã trao đổi (ví dụ: chốt caption, thêm hình ảnh vừa gửi). ' +
          'Nếu metadata của tin nhắn có productId/productName hoặc imageUrl/image.url thì hãy map sang các field productId, productName và image tương ứng.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            campaign: {
              type: SchemaType.OBJECT,
              description: 'Thông tin chiến dịch/bài viết cần lưu vào Ads AI.',
              properties: {
                name: {
                  type: SchemaType.STRING,
                  description: 'Tên chiến dịch hiển thị trong Ads AI.',
                },
                productName: {
                  type: SchemaType.STRING,
                  description: 'Tên sản phẩm hoặc ưu đãi chính.',
                },
                productId: {
                  type: SchemaType.NUMBER,
                  description: 'Mã sản phẩm trong hệ thống (nếu có).',
                },
                targetAudience: {
                  type: SchemaType.STRING,
                  description: 'Đối tượng khách hàng mục tiêu.',
                },
                tone: {
                  type: SchemaType.STRING,
                  description: 'Tông giọng của nội dung.',
                },
                objective: {
                  type: SchemaType.STRING,
                  description: 'Mục tiêu chiến dịch.',
                },
                callToAction: {
                  type: SchemaType.STRING,
                  description: 'CTA sẽ sử dụng trong bài viết.',
                },
                ctaUrl: {
                  type: SchemaType.STRING,
                  description: 'Đường dẫn gắn với CTA.',
                },
                primaryText: {
                  type: SchemaType.STRING,
                  description: 'Caption/bản nội dung chính của bài viết.',
                },
                headline: {
                  type: SchemaType.STRING,
                  description: 'Tiêu đề chính nếu có.',
                },
                description: {
                  type: SchemaType.STRING,
                  description: 'Mô tả bổ sung hoặc phần mở rộng của caption.',
                },
                hashtags: {
                  type: SchemaType.ARRAY,
                  description: 'Danh sách hashtag sẽ đăng kèm.',
                  items: { type: SchemaType.STRING },
                },
                scheduledAt: {
                  type: SchemaType.STRING,
                  description: 'Thời điểm dự kiến đăng (ISO 8601).',
                },
                prompt: {
                  type: SchemaType.STRING,
                  description: 'Prompt hoặc ghi chú nguồn tạo nội dung.',
                },
                postType: {
                  type: SchemaType.STRING,
                  format: 'enum',
                  enum: ['link', 'photo'],
                  description: 'Định dạng bài đăng, ví dụ link hoặc photo.',
                },
                image: {
                  type: SchemaType.STRING,
                  description: 'Đường dẫn asset đã có sẵn, nếu cần.',
                },
              },
              required: ['name', 'primaryText'],
            },
          },
          required: ['campaign'],
        },
      },
      {
        name: 'schedule_post_campaign',
        description: 'Lên lịch đăng chiến dịch đã lưu trong Ads AI theo thời điểm đã chốt.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            advertisementId: {
              type: SchemaType.NUMBER,
              description: 'ID chiến dịch Ads AI cần lên lịch.',
            },
            scheduledAt: {
              type: SchemaType.STRING,
              description: 'Thời điểm đăng theo chuẩn ISO 8601.',
            },
            note: {
              type: SchemaType.STRING,
              description: 'Ghi chú thêm (nếu có).',
            },
          },
          required: ['advertisementId', 'scheduledAt'],
        },
      },
    ],
  },
];
