import { adminNavSections, adminShiftFlow } from './admin-navigation';

describe('admin navigation', () => {
  it('keeps shift-flow shortcuts out of the main nav sections', () => {
    const shiftFlowHrefs = new Set(adminShiftFlow.map((item) => item.href));
    const repeatedLinks = adminNavSections.flatMap((section) =>
      section.links
        .filter((link) => shiftFlowHrefs.has(link.href))
        .map((link) => `${section.label}: ${link.label} -> ${link.href}`),
    );

    expect(repeatedLinks).toEqual([]);
  });

  it('does not repeat the same route across main nav categories', () => {
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
