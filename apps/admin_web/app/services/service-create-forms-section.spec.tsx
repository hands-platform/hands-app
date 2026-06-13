import { ServiceCreateFormsSection } from './service-create-forms-section';

describe('ServiceCreateFormsSection', () => {
  it('renders service creation forms with Partner-facing copy', () => {
    const section = ServiceCreateFormsSection();
    const rendered = JSON.stringify(section);

    expect(rendered).toContain('Create service with duration options');
    expect(rendered).toContain('60 min Partner payout');
    expect(rendered).toContain('120 min Partner payout');
    expect(rendered).toContain('Shown in customer and Partner apps');
    expect(rendered).toContain('Create duration set');
    expect(rendered).toContain('Create service');
  });
});
