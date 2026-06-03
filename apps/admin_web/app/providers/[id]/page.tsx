import { redirect } from 'next/navigation';

import { buildLegacyPartnerQueryString } from '../legacy-provider-redirect';

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LegacyProviderDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  redirect(`/partners/${id}${buildLegacyPartnerQueryString(searchParams ? await searchParams : {})}`);
}
