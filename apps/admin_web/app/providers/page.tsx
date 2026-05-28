import { redirect } from 'next/navigation';

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LegacyProvidersPage({ searchParams }: PageProps) {
  redirect(`/partners${buildQueryString(searchParams ? await searchParams : {})}`);
}

function buildQueryString(params: Record<string, string | string[] | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item) search.append(key, item);
      });
      continue;
    }
    if (value) {
      search.set(key, value);
    }
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}
