'use server';

import { revalidatePath } from 'next/cache';
import { adminPost } from '../../lib/admin-api';

export async function addOperationsHandoffNote(formData: FormData) {
  const owner = String(formData.get('owner') ?? '').trim();
  const preset = String(formData.get('preset') ?? '').trim();
  const note = String(formData.get('note') ?? '').replace(/\s+/g, ' ').trim();

  if (!note && !preset) {
    return;
  }

  await adminPost('/admin/operations-handoff/note', { owner, preset, note }, null);
  revalidatePath('/operations-handoff');
  revalidatePath('/audit-log');
}
