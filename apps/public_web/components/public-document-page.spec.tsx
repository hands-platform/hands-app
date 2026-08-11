import { describe, expect, it } from 'vitest';

import { publicDocumentDefinition } from './public-document-page';

describe('public legal documents', () => {
  it('publishes complete legal policies in every supported language', () => {
    for (const locale of ['ko', 'vi', 'en', 'ja', 'zh'] as const) {
      expect(publicDocumentDefinition('/legal/privacy', locale)?.sections).toHaveLength(10);
      expect(publicDocumentDefinition('/legal/terms', locale)?.sections).toHaveLength(12);
      expect(publicDocumentDefinition('/legal/cookies', locale)?.sections).toHaveLength(7);
    }
  });
});
