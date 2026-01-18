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
          'Lưu bài viết đã chốt vào Ads AI để quản lý và theo dõi. ' +
          'NẾU người dùng yêu cầu "lưu và lên lịch" hoặc cung cấp thời gian đăng (ví dụ: "lưu bài này và đăng lúc 9h tối"), ' +
          'HÃY ĐIỀN thời gian vào field "scheduledAt" trong campaign để hệ thống vừa lưu vừa lên lịch luôn. ' +
          'Nếu metadata của tin nhắn có productId/productName, imageUrl/image.url, video/video.url hoặc images (danh sách ảnh) thì hãy map sang các field tương ứng (productId, productName, image, video, images).',
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
                  description:
                    'Nhãn nút CTA (ngắn gọn, VD: Mua ngay). TUYỆT ĐỐI KHÔNG điền "Lưu ý" hay câu văn dài.',
                },
                ctaUrl: {
                  type: SchemaType.STRING,
                  description: 'Đường dẫn liên kết cho nút CTA. Nếu không có link thì để trống.',
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
                  enum: ['link', 'photo', 'carousel', 'video'],
                  description:
                    'Loại bài đăng: "link" (kèm ảnh nền), "photo" (ảnh đơn), "carousel" (nhiều ảnh) hoặc "video".',
                },
                image: {
                  type: SchemaType.STRING,
                  description: 'Đường dẫn asset đã có sẵn, nếu cần.',
                },
                video: {
                  type: SchemaType.STRING,
                  description: 'Đường dẫn video đã có sẵn, nếu cần.',
                },
                images: {
                  type: SchemaType.ARRAY,
                  items: { type: SchemaType.STRING },
                  description: 'Danh sách ảnh cho bài Carousel.',
                },
              },
              required: ['name', 'primaryText'],
            },
          },
          required: ['campaign'],
        },
      },
      {
        name: 'get_ads_performance',
        description:
          'Lấy báo cáo hiệu suất của các chiến dịch quảng cáo gần đây (Reach, Clicks, Conversions, Spend, ROI...).',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            limit: {
              type: SchemaType.NUMBER,
              description: 'Số lượng chiến dịch cần lấy báo cáo, mặc định 5.',
            },
            status: {
              type: SchemaType.STRING,
              description: 'Lọc bài viết theo trạng thái (ví dụ: PUBLISHED, DRAFT).',
            },
            search: {
              type: SchemaType.STRING,
              description: 'Từ khóa tìm kiếm theo tên bài viết hoặc sản phẩm.',
            },
          },
        },
      },
      {
        name: 'get_ad_details',
        description: 'Lấy thông tin chi tiết đầy đủ của một bài viết/chiến dịch quảng cáo theo ID.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            id: {
              type: SchemaType.NUMBER,
              description: 'ID của bài viết cần xem chi tiết.',
            },
          },
          required: ['id'],
        },
      },
      {
        name: 'schedule_post_campaign',
        description:
          // Vietnamese:
          // - Tool này chỉ dùng để lên lịch cho các bài ĐÃ CÓ trong hệ thống (đã được lưu trước đó).
          // - KHÔNG dùng tool này ngay sau khi gọi finalize_post_campaign nếu có thể gộp scheduledAt vào finalize_post_campaign.
          // - CHÚ Ý: Nếu bài viết đã được lên lịch hoặc đã đăng, tool sẽ yêu cầu xác nhận.
          //   Chatbot cần hỏi người dùng "Bài viết này đã được lên lịch/đăng rồi, bạn có chắc chắn muốn đặt lại lịch không?" trước khi gọi tool với confirmReschedule=true.
          'Lên lịch đăng cho một chiến dịch đã tồn tại trong Ads AI. Chỉ dùng khi bài viết đã được lưu trước đó.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            confirmReschedule: {
              type: SchemaType.BOOLEAN,
              description:
                'Set = true nếu người dùng đã xác nhận muốn đè lịch cũ (khi bài đang ở trạng thái SCHEDULED/PUBLISHED).',
            },
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
      {
        name: 'generate_video_ad',
        description:
          'Tạo video quảng cáo chuyên nghiệp. ' +
          'NẾU đã có nội dung bài viết hoặc thông tin sản phẩm trong ngữ cảnh hội thoại, HÃY TỰ ĐỘNG TRÍCH XUẤT để điền vào các tham số. ' +
          'Không cần hỏi lại người dùng nếu có thể tự suy luận. ' +
          'Chỉ cần productId (nếu có) hoặc productName (nếu có).',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            productId: { type: SchemaType.NUMBER, description: 'ID sản phẩm (nếu có)' },
            productName: {
              type: SchemaType.STRING,
              description: 'Tên sản phẩm hoặc chủ đề video (tự trích xuất từ ngữ cảnh)',
            },
            description: {
              type: SchemaType.STRING,
              description: 'Mô tả ngắn gọn nội dung/kịch bản video (tự trích xuất từ ngữ cảnh)',
            },
            price: { type: SchemaType.STRING, description: 'Giá bán (nếu có)' },
            promotion: { type: SchemaType.STRING, description: 'Thông tin khuyến mãi (nếu có)' },
          },
        },
      },
    ],
  },
];
