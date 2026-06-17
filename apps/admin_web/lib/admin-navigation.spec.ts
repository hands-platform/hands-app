import { adminNavSections } from './admin-navigation';

describe('admin navigation', () => {
  it('keeps former shift-flow shortcuts inside the category navigation', () => {
    const linksByHref = new Map(
      adminNavSections.flatMap((section) =>
        section.links.map((link) => [link.href, `${section.label}: ${link.label}`] as const),
      ),
    );

    expect(linksByHref.get('/')).toBe('Command: Start Shift');
    expect(linksByHref.get('/operations-handoff')).toBe('Command: Handoff');
    expect(linksByHref.get('/bookings?view=attention')).toBe('Bookings: Urgent Bookings');
    expect(linksByHref.get('/bookings?view=marketplace')).toBe('Bookings: Marketplace');
    expect(linksByHref.get('/cash-settlements')).toBe('Finance: Cash Debt');
  });

  it('does not repeat the same route across nav categories', () => {
    const seen = new Map<string, string>();
    const duplicates: string[] = [];

    for (const section of adminNavSections) {
      for (const link of section.links) {
        const firstLabel = seen.get(link.href);

        if (firstLabel) {
          duplicates.push(`${firstLabel} / ${section.label}: ${link.label} -> ${link.href}`);
          continue;
        }

        seen.set(link.href, `${section.label}: ${link.label}`);
      }
    }

    expect(duplicates).toEqual([]);
  });
});
