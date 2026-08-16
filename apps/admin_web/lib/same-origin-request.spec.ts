import { isSameOriginMutationRequest } from './same-origin-request';

describe('isSameOriginMutationRequest', () => {
  it('accepts a matching browser origin', () => {
    const request = new Request('https://admin.hands.vn/api/admin/example', {
      headers: { origin: 'https://admin.hands.vn', 'sec-fetch-site': 'same-origin' },
      method: 'POST',
    });

    expect(isSameOriginMutationRequest(request)).toBe(true);
  });

  it('rejects a missing or mismatched origin', () => {
    expect(
      isSameOriginMutationRequest(
        new Request('https://admin.hands.vn/api/admin/example', { method: 'POST' }),
      ),
    ).toBe(false);
    expect(
      isSameOriginMutationRequest(
        new Request('https://admin.hands.vn/api/admin/example', {
          headers: { origin: 'https://attacker.example' },
          method: 'POST',
        }),
      ),
    ).toBe(false);
  });

  it('rejects an explicitly cross-site fetch even when the origin header is forged', () => {
    const request = new Request('https://admin.hands.vn/api/admin/example', {
      headers: { origin: 'https://admin.hands.vn', 'sec-fetch-site': 'cross-site' },
      method: 'POST',
    });

    expect(isSameOriginMutationRequest(request)).toBe(false);
  });
});
