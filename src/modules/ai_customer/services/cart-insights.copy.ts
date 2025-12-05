export type SupportedLocale = 'vi' | 'en';

export interface CartAssistantCopy {
  greetingHeadline(): string;
  greetingSubtitle(count: number): string;
  promotionSummary(payload: { promotionName?: string | null; missingQuantity: number }): string;
  promotionFallback(): string;
  comparisonReason(category?: string | null): string;
  comparisonHeadline(): string;
  comparisonSummary(count: number): string;
  featurePrice(): string;
  featureBrand(): string;
  featureCategory(): string;
  featureVariants(): string;
  featureAttributes(): string;
  priceInsight(payload: { maxDiffPercent: number }): string;
}

const viCopy: CartAssistantCopy = {
  greetingHeadline: () => 'Fia luôn để mắt đến giỏ hàng của bạn',
  greetingSubtitle: (count) => {
    if (count <= 0) {
      return 'Fia sẽ cho bạn biết ngay khi có ưu đãi phù hợp.';
    }
    return count === 1
      ? 'Mình có 1 gợi ý để tối ưu đơn hàng này.'
      : `Mình có ${count} gợi ý giúp bạn mua sắm thông minh hơn.`;
  },
  promotionSummary: ({ promotionName, missingQuantity }) =>
    `Chỉ cần thêm ${missingQuantity} sản phẩm nữa để kích hoạt ưu đãi "${promotionName ?? ''}".`,
  promotionFallback: () => 'Hoàn tất combo để mở khóa thêm ưu đãi.',
  comparisonReason: (category) =>
    category && category.trim().length
      ? `Các lựa chọn ${category.toLowerCase()} đang cùng xuất hiện trong giỏ hàng.`
      : 'Các sản phẩm tương đồng đang chờ bạn so sánh để tự tin quyết định.',
  comparisonHeadline: () => 'So sánh nhanh để chọn đúng',
  comparisonSummary: (count) =>
    count <= 0
      ? 'Fia chưa tìm thấy sản phẩm nào cần so sánh.'
      : `Fia đã đặt ${count} sản phẩm cùng bàn để bạn cân nhắc.`,
  featurePrice: () => 'Giá tham khảo',
  featureBrand: () => 'Thương hiệu',
  featureCategory: () => 'Danh mục',
  featureVariants: () => 'Phiên bản/biến thể',
  featureAttributes: () => 'Điểm nổi bật',
  priceInsight: ({ maxDiffPercent }) =>
    maxDiffPercent < 5
      ? 'Mức giá giữa các sản phẩm khá tương đồng.'
      : `Chênh lệch giá khoảng ${maxDiffPercent}% giữa các lựa chọn.`,
};

const enCopy: CartAssistantCopy = {
  greetingHeadline: () => 'Fia is watching your cart for you',
  greetingSubtitle: (count) => {
    if (count <= 0) {
      return 'Keep shopping and I will alert you when a deal appears.';
    }
    return count === 1
      ? 'I spotted 1 smart tip for this cart.'
      : `I spotted ${count} tips to optimize your checkout.`;
  },
  promotionSummary: ({ promotionName, missingQuantity }) =>
    `Add ${missingQuantity} more item(s) to unlock "${promotionName ?? ''}".`,
  promotionFallback: () => 'Complete the combo to unlock deeper savings.',
  comparisonReason: (category) =>
    category && category.trim().length
      ? `Several ${category.toLowerCase()} options are in your cart right now.`
      : 'Similar picks are in the cart. Compare them before you decide.',
  comparisonHeadline: () => 'Compare quickly. Decide confidently.',
  comparisonSummary: (count) =>
    count <= 0
      ? 'No comparison insight at the moment.'
      : `Fia lined up ${count} products for a side-by-side look.`,
  featurePrice: () => 'Price range',
  featureBrand: () => 'Brand',
  featureCategory: () => 'Category',
  featureVariants: () => 'Variants',
  featureAttributes: () => 'Highlights',
  priceInsight: ({ maxDiffPercent }) =>
    maxDiffPercent < 5
      ? 'Prices are mostly aligned.'
      : `About ${maxDiffPercent}% price gap detected across these picks.`,
};

const copyRegistry: Record<SupportedLocale, CartAssistantCopy> = {
  vi: viCopy,
  en: enCopy,
};

export const resolveLocale = (locale?: string | null): SupportedLocale => {
  return locale && locale.toLowerCase().startsWith('en') ? 'en' : 'vi';
};

export const getCartCopy = (locale: SupportedLocale): CartAssistantCopy => copyRegistry[locale];
