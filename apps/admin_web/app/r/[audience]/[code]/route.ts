import { NextResponse } from 'next/server';

import {
  normalizeReferralAudience,
  referralFallbackHtml,
  referralPlatformFromUserAgent,
  referralShareUrl,
  referralStoreUrl,
} from '../../../../lib/referral-links';

type RouteContext = {
  params: Promise<{
    audience: string;
    code: string;
  }>;
};

export const runtime = 'nodejs';

export async function GET(request: Request, context: RouteContext) {
  const { audience: rawAudience, code: rawCode } = await context.params;
  const audience = normalizeReferralAudience(rawAudience);
  const code = rawCode.trim();

  if (!audience || !code) {
    return NextResponse.json({ error: 'INVALID_REFERRAL_LINK' }, { status: 404 });
  }

  const platform = referralPlatformFromUserAgent(request.headers.get('user-agent'));
  const targetUrl = referralStoreUrl(audience, platform, code);
  if (targetUrl) {
    return NextResponse.redirect(targetUrl);
  }

  return new Response(
    referralFallbackHtml({
      audience,
      code,
      shareUrl: referralShareUrl(audience, code),
    }),
    {
      headers: {
        'cache-control': 'no-store',
        'content-type': 'text/html; charset=utf-8',
      },
      status: 200,
    },
  );
}
