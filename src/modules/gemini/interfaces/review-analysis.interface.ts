export interface AnalyzeProductReviewParams {
  comment: string;
  ratingValue: number;
  productId: number;
  userId: number;
}

export interface AnalyzeProductReviewResult {
  sentiment: 'positive' | 'negative' | 'neutral';
  keyTopics: string[];
  summary: string;
  raw: Record<string, unknown> | null;
}
