export enum PostCampaignHandoffState {
  /**
   * No campaign has been generated in the current conversation turn.
   */
  IDLE = 'idle',
  /**
   * A campaign draft has been generated but not yet confirmed by the admin.
   */
  AWAITING_CONFIRMATION = 'awaiting_confirmation',
  /**
   * Admin confirmed the campaign should be finalized; waiting for finalize tool.
   */
  CONFIRMED = 'confirmed',
}

export interface PostCampaignMetadata {
  state: PostCampaignHandoffState;
  /**
   * Timestamp (ISO string) when the state was set.
   */
  updatedAt: string;
  /**
   * Optional reference payload to persist across turns (e.g., campaign hash).
   */
  payload?: Record<string, unknown>;
}

export interface PostCampaignApprovalSignal {
  /**
   * The full admin utterance.
   */
  message: string;
  /**
   * Whether it was explicitly confirmed.
   */
  confirmed: boolean;
}

export const FINALIZE_CONFIRMATION_PATTERNS: RegExp[] = [
  /(?:ok\s*(?:rồi|roi|ruồi)?|được|chuẩn|ổn|chốt)(?:\s*(?:phương án|kịch bản|mẫu|bài|post))?/i,
  /(?:dùng|xài|giữ)\s*(?:mẫu|bản|phương án|post)\s*(?:này|đó|kia)?/i,
  /(?:approve|approved|ship|go\s+live|lock\s*(?:it)?\s*in)/i,
  /(?:looks?|sound)s?\s+good/i,
  /(?:use|keep)\s+(?:this|that|it)/i,
  /(?:final|finalize|publish)\s+(?:this|it|the\s+post)/i,
];

export function detectFinalizeConfirmation(message: string): PostCampaignApprovalSignal {
  const normalized = message.trim();
  if (!normalized) {
    return { message: '', confirmed: false };
  }

  const matched = FINALIZE_CONFIRMATION_PATTERNS.some((pattern) => pattern.test(normalized));
  return {
    message: normalized,
    confirmed: matched,
  };
}

export function buildPostCampaignMetadata(
  state: PostCampaignHandoffState,
  payload?: Record<string, unknown>,
): PostCampaignMetadata {
  return {
    state,
    updatedAt: new Date().toISOString(),
    ...(payload ? { payload } : {}),
  };
}
