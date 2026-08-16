import { redirect } from 'next/navigation';

import { publicSiteKeyForRequest } from '../lib/site-content';

export default async function PublicSiteRootPage() {
  const site = await publicSiteKeyForRequest();
  redirect(site === 'PARTNER_RECRUITMENT' ? '/vi' : '/ko');
}
