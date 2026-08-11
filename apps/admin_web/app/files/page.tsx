import { redirect } from 'next/navigation';

import { buildPartnerFileReviewRedirect } from './files-page-model';

type FilesPageProps = {
  readonly searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LegacyFilesPage({ searchParams }: FilesPageProps) {
  redirect(buildPartnerFileReviewRedirect(searchParams ? await searchParams : {}));
}
