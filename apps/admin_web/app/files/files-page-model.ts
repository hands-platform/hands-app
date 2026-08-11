export function buildPartnerFileReviewRedirect(
  params: Record<string, string | string[] | undefined>,
) {
  const providerId = readFirstParam(params.providerId);
  if (providerId) {
    return `/partners/${encodeURIComponent(providerId)}#partner-profile-kyc`;
  }

  const query = new URLSearchParams({
    review: readFirstParam(params.review) === 'upload-incomplete' ? 'unapproved' : 'approval-pending',
    sort: 'oldest',
  });
  const search = readFirstParam(params.q);
  if (search) {
    query.set('q', search);
  }

  return `/partners?${query.toString()}`;
}

function readFirstParam(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? '';
}
