import {
  ComboType,
  CouponType,
  DiscountType,
  PromotionType,
} from '../../promotions/entities/promotion.entity';

export interface PricingContext {
  promotionCode?: string;
  promotionId?: number;
  branchId?: number;
  addressId?: number;
  userId?: number;
}

export interface PricingItemInput {
  variantId: number;
  quantity: number;
}

export type PromotionLevel = 'AUTO' | 'COUPON';

export interface PromotionAdjustmentLineItem {
  productId: number;
  variantId?: number;
  quantity: number;
  discountAmount: number;
  isGift?: boolean;
  description?: string;
}

export interface PromotionSuggestionItem {
  productId: number;
  requiredQuantity: number;
  currentQuantity: number;
  missingQuantity: number;
  potentialDiscount?: number | null;
  message: string;
  productName?: string | null;
  productImage?: string | null;
  productPrice?: number | null;
  autoAdd?: boolean;
}

export interface PromotionAdjustmentMetadata {
  timesApplied?: number;
  baseAmount?: number;
  giftBaseAmount?: number;
  discountType?: DiscountType;
  discountValue?: number;
  maxDiscount?: number | null;
}

export interface PromotionAdjustment {
  promotionId: number;
  promotionName: string;
  promotionType: PromotionType;
  level: PromotionLevel;
  amount: number;
  description?: string | null;
  comboType?: ComboType | null;
  couponType?: CouponType | null;
  metadata?: PromotionAdjustmentMetadata;
  items: PromotionAdjustmentLineItem[];
  suggestions?: PromotionSuggestionItem[];
}

export interface AppliedPromotionReference {
  promotionId: number;
  level: PromotionLevel;
  amount: number;
}

export interface PricingLineItemVariantInfo {
  id: number;
  name: string;
  image?: string | null;
  productId: number;
  productName: string;
}

export interface PricingLineItem {
  variantId: number;
  quantity: number;
  unitPrice: number;
  subTotal: number;
  discountTotal: number;
  totalAmount: number;
  isInCombo: boolean;
  appliedPromotions: AppliedPromotionReference[];
  variant: PricingLineItemVariantInfo;
}

export interface PricingTotals {
  subTotal: number;
  autoDiscountTotal: number;
  couponDiscountTotal: number;
  discountTotal: number;
  shippingFee: number;
  taxTotal: number;
  totalAmount: number;
}

export interface PricingSummaryMeta {
  totalAutoDiscount: number;
  totalCouponDiscount: number;
}

export interface PricingSummary {
  items: PricingLineItem[];
  totals: PricingTotals;
  context: PricingContext;
  appliedPromotions: PromotionAdjustment[];
  meta: PricingSummaryMeta;
}
