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
    expect(linksByHref.get('/bookings')).toBe('Bookings: All Bookings');
    expect(linksByHref.get('/cash-settlements')).toBe('Finance: Cash Debt');
  });

  it('keeps booking filter views inside the bookings workspace instead of repeating sidebar links', () => {
    const bookingSection = adminNavSections.find((section) => section.label === 'Bookings');

    expect(bookingSection?.links.map((link) => link.href)).toEqual(['/bookings']);
    expect(bookingSection?.links[0]?.description).toContain('urgent work');
    expect(bookingSection?.links[0]?.description).toContain('marketplace');
    expect(bookingSection?.links[0]?.description).toContain('no-show evidence');
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

  it('keeps customer and partner operations in one user-management category', () => {
    const userSection = adminNavSections.find((section) => section.label === 'Users');

    expect(adminNavSections.map((section) => section.label)).not.toContain('Customers');
    expect(adminNavSections.map((section) => section.label)).not.toContain('Partners');
    expect(userSection?.links.map((link) => link.href)).toEqual([
      '/customers',
      '/app-sessions?role=CUSTOMER&state=live',
      '/partners',
      '/partners?review=kyc',
      '/partners?review=acceptance-blocked',
      '/partners?review=marketplace-ready',
      '/partner-controls',
    ]);
  });

  it('keeps policy and retained evidence in one system category', () => {
    const systemSection = adminNavSections.find((section) => section.label === 'System');

    expect(adminNavSections.map((section) => section.label)).not.toContain('Policy');
    expect(adminNavSections.map((section) => section.label)).not.toContain('Evidence and System');
    expect(systemSection?.links.map((link) => link.href)).toEqual([
      '/operations-policy',
      '/services',
      '/tax-policy',
      '/coupons',
      '/chat-archive',
      '/notifications',
      '/files',
      '/reviews',
      '/audit-log',
      '/setup',
    ]);
  });
});
