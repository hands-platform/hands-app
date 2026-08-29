import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ReactElement, SubmitEvent } from 'react';

import {
  AdminDirectoryFilterForm,
  canonicalGetFormHref,
  restoreCanonicalGetForm,
} from './admin-directory-filter-form';

const directoryFilterFormSource = readFileSync(
  join(process.cwd(), 'components/admin-directory-filter-form.tsx'),
  'utf8',
);

describe('canonicalGetFormHref', () => {
  it('omits empty values and default newest sort while preserving active review filters', () => {
    expect(
      canonicalGetFormHref(
        '/partners',
        [
          ['review', 'unapproved'],
          ['sort', 'newest'],
          ['q', 'linh'],
          ['activity', ''],
        ],
        { sort: 'newest' },
      ),
    ).toBe('/partners?review=unapproved&q=linh');
  });

  it('keeps non-default booking flow and approval queue ordering', () => {
    expect(
      canonicalGetFormHref(
        '/partners',
        [
          ['sort', 'newest'],
          ['bookingFlow', 'completed-work'],
        ],
        { sort: 'newest' },
      ),
    ).toBe('/partners?bookingFlow=completed-work');
    expect(
      canonicalGetFormHref(
        '/partners',
        [
          ['review', 'approval-pending'],
          ['sort', 'oldest'],
        ],
        {},
      ),
    ).toBe('/partners?review=approval-pending&sort=oldest');
  });

  it('drops whitespace-only search values while preserving active booking filters', () => {
    expect(
      canonicalGetFormHref(
        '/bookings',
        [
          ['q', '   '],
          ['view', 'matching'],
          ['age', 'under-1h'],
          ['sort', 'newest'],
        ],
        {},
      ),
    ).toBe('/bookings?view=matching&age=under-1h&sort=newest');
  });
});

it('prepares a canonical native GET submission without intercepting navigation', () => {
  const q = formControl('q', '  audit-no-match  ');
  const sort = formControl('sort', 'newest');
  const empty = formControl('age', '');
  const { event, form } = submitEvent([q, sort, empty]);
  const element = AdminDirectoryFilterForm({
    action: '/bookings',
    canonicalDefaults: { sort: 'newest' },
    children: null,
  }) as ReactElement<{ onSubmit: (event: SubmitEvent<HTMLFormElement>) => void }>;

  element.props.onSubmit(event);

  expect(event.preventDefault).not.toHaveBeenCalled();
  expect(q).toMatchObject({ disabled: false, value: 'audit-no-match' });
  expect(sort.disabled).toBe(true);
  expect(empty.disabled).toBe(true);
  expect(form.dataset.adminDirectorySubmitting).toBe('true');
  expect(form.setAttribute).toHaveBeenCalledWith('aria-busy', 'true');
});

it('blocks a duplicate native submission while the first navigation is pending', () => {
  const { event, form } = submitEvent([formControl('status', 'pending')]);
  const element = AdminDirectoryFilterForm({
    action: '/payments',
    children: null,
  }) as ReactElement<{ onSubmit: (event: SubmitEvent<HTMLFormElement>) => void }>;

  element.props.onSubmit(event);
  element.props.onSubmit(event);

  expect(event.preventDefault).toHaveBeenCalledOnce();
  expect(form.dataset.adminDirectorySubmitting).toBe('true');
});

it('restores canonical controls when a native GET page returns from the back-forward cache', () => {
  const disabledControl = {
    dataset: { adminDirectoryCanonicalDisabled: 'true' },
    disabled: true,
  };
  const form = {
    dataset: { adminDirectorySubmitting: 'true' },
    querySelectorAll: () => [disabledControl],
    removeAttribute: vi.fn(),
    reset: vi.fn(),
  };

  restoreCanonicalGetForm(form as unknown as HTMLFormElement);

  expect(disabledControl.disabled).toBe(false);
  expect(disabledControl.dataset.adminDirectoryCanonicalDisabled).toBeUndefined();
  expect(form.dataset.adminDirectorySubmitting).toBeUndefined();
  expect(form.removeAttribute).toHaveBeenCalledWith('aria-busy');
  expect(form.reset).toHaveBeenCalledOnce();
});

it('lets the native reset restore React default values without replacing them from HTML attributes', () => {
  const q = { defaultValue: 'Partner 2932', value: '' };
  const form = {
    dataset: {} as Record<string, string>,
    querySelectorAll: () => [],
    removeAttribute: vi.fn(),
    reset: vi.fn(() => {
      q.value = q.defaultValue;
    }),
  };

  restoreCanonicalGetForm(form as unknown as HTMLFormElement);

  expect(q.value).toBe('Partner 2932');
  expect(form.reset).toHaveBeenCalledOnce();
});

it('does not run BFCache restoration for a fresh pageshow', () => {
  expect(directoryFilterFormSource).toContain('if (event.persisted) restoreVisibleDirectoryForms();');
  expect(directoryFilterFormSource).not.toContain('\n  restoreVisibleDirectoryForms();\n}');
});

function formControl(name: string, value: string) {
  return { disabled: false, name, type: 'text', value };
}

function submitEvent(elements: ReturnType<typeof formControl>[]) {
  const form = {
    dataset: {} as Record<string, string>,
    elements,
    setAttribute: vi.fn(),
  };
  const event = {
    currentTarget: {
      ...form,
    },
    defaultPrevented: false,
    preventDefault: vi.fn(),
  } as unknown as SubmitEvent<HTMLFormElement> & { preventDefault: ReturnType<typeof vi.fn> };
  return { event, form };
}
