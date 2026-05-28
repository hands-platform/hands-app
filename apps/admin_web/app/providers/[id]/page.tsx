import { redirect } from 'next/navigation';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function LegacyProviderDetailPage({ params }: PageProps) {
  const { id } = await params;
  redirect(`/partners/${id}`);
}
