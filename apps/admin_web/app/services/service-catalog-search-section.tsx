type ServiceCatalogSearchSectionProps = {
  readonly activeServiceCount: number;
  readonly groupCount: number;
  readonly searchQuery: string;
};

export function ServiceCatalogSearchSection({
  activeServiceCount,
  groupCount,
  searchQuery,
}: ServiceCatalogSearchSectionProps) {
  const catalogScopeLabel = searchQuery ? `Filtered by "${searchQuery}"` : 'All service types';

  return (
    <section className="card admin-mb-16">
      <form className="form-grid compact-form" action="/services">
        <label className="full-span">
          Find service type, duration, group key, or price
          <input name="q" placeholder="foot massage, 90, 450000, deep_tissue" defaultValue={searchQuery} />
        </label>
        <button type="submit">Search catalog</button>
        {searchQuery ? (
          <a className="pill pill-neutral" href="/services">
            Clear search
          </a>
        ) : null}
      </form>
      <p className="muted admin-mt-10">
        {catalogScopeLabel}: showing {groupCount} service type(s) and {activeServiceCount} active duration
        option(s). Dashboard readiness cards still check the full catalog.
      </p>
    </section>
  );
}
