import { redirect } from 'next/navigation';

import { buildLegacyPartnerQueryString } from './legacy-provider-redirect';

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LegacyProvidersPage({ searchParams }: PageProps) {
  redirect(`/partners${buildLegacyPartnerQueryString(searchParams ? await searchParams : {})}`);
}
