import {
  buildPostCampaignMetadata,
  detectFinalizeConfirmation,
  PostCampaignHandoffState,
} from './post-campaign-state';

describe('post-campaign state helpers', () => {
  describe('detectFinalizeConfirmation', () => {
    it('detects Vietnamese confirmation phrases', () => {
      const result = detectFinalizeConfirmation('Dùng mẫu này nhé, nhìn ổn đó');
      expect(result.confirmed).toBe(true);
      expect(result.message).toContain('Dùng mẫu này');
    });

    it('detects English confirmation phrases', () => {
      const result = detectFinalizeConfirmation('Looks good, lock it in');
      expect(result.confirmed).toBe(true);
    });

    it('does not confirm neutral follow-ups', () => {
      const result = detectFinalizeConfirmation('Cho tôi phương án khác');
      expect(result.confirmed).toBe(false);
    });
  });

  describe('buildPostCampaignMetadata', () => {
    it('creates timestamped metadata payload', () => {
      const payload = { campaignId: 123 } as const;
      const metadata = buildPostCampaignMetadata(PostCampaignHandoffState.CONFIRMED, payload);

      expect(metadata.state).toBe(PostCampaignHandoffState.CONFIRMED);
      expect(metadata.payload).toEqual(payload);
      expect(new Date(metadata.updatedAt).getTime()).not.toBeNaN();
    });
  });
});
