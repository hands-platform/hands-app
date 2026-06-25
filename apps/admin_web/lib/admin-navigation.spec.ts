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
    expect(linksByHref.get('/vietnam-overview')).toBe('Command: Vietnam Overview');
    expect(linksByHref.get('/usage-overview')).toBe('Command: Usage Overview');
    expect(linksByHref.get('/marketing-analytics')).toBe('Command: Marketing Analytics');
    expect(linksByHref.get('/bookings')).toBe('Bookings: All Bookings');
    expect(linksByHref.get('/cash-settlements')).toBe('Finance: Cash Debt');
  });

  it('keeps booking filter views inside the bookings workspace instead of repeating sidebar links', () => {
    const bookingSection = adminNavSections.find((section) => section.label === 'Bookings');

    expect(bookingSection?.links.map((link) => link.href)).toEqual([
      '/bookings',
      '/bookings/completed',
      '/bookings/post-match-cancellations',
    ]);
    expect(bookingSection?.links[0]?.description).toContain('request intake');
    expect(bookingSection?.links[2]?.description).toContain('Post-match cancellation');
    expect(bookingSection?.links[1]?.description).toContain('closeout');
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

  it('separates customer and partner operations into their own user categories', () => {
    const customerSection = adminNavSections.find((section) => section.label === 'Customers');
    const partnerSection = adminNavSections.find((section) => section.label === 'Partners');

    expect(adminNavSections.map((section) => section.label)).not.toContain('Users');
    expect(customerSection?.links.map((link) => link.href)).toEqual([
      '/customers',
      '/referrals/customers',
    ]);
    expect(partnerSection?.links.map((link) => link.href)).toEqual([
      '/partners',
      '/partners?review=unapproved',
      '/partners?review=unsettled',
      '/referrals/partners',
    ]);
    expect(partnerSection?.links.map((link) => link.label)).toEqual([
      'Partners',
      'Unapproved Partners',
      'Unsettled Partners',
      'Partner Referrals',
    ]);
    expect(customerSection?.links.map((link) => link.label)).toEqual([
      'Customers',
      'Customer Referrals',
    ]);
    expect(partnerSection?.links[1]?.description).toContain('registration, KYC, required documents');
    expect(partnerSection?.links[1]?.description).not.toContain('bank, tax');
    expect(
      adminNavSections.flatMap((section) => section.links.map((link) => link.href)),
    ).not.toContain('/app-sessions?role=CUSTOMER&state=live');
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
      '/reviews/partner-customer-evaluations',
      '/audit-log',
      '/setup',
    ]);
  });
});
