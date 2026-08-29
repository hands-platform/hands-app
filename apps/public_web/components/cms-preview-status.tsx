export function CmsPreviewStatus({ invalid, returnTo }: { invalid: boolean; returnTo: string }) {
  return <aside aria-live="polite" className={`cms-preview-status${invalid ? ' is-invalid' : ''}`}>
    <div>
      <strong>{invalid ? 'Draft preview ended' : 'Draft preview'}</strong>
      <span>{invalid ? 'The preview link is invalid or expired. The current Live page is shown.' : 'This is not the current Live page.'}</span>
    </div>
    <form action="/api/cms-preview-session/exit" method="post">
      <input name="returnTo" type="hidden" value={returnTo} />
      <button type="submit">{invalid ? 'Clear preview session' : 'Exit preview'}</button>
    </form>
  </aside>;
}
