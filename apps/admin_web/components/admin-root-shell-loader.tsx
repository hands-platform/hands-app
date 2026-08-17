'use client';

import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';

import type { AdminNavSection } from '../lib/admin-navigation';

const AdminRootShell = dynamic(() => import('./admin-root-shell').then((module) => module.AdminRootShell));

export function AdminRootShellLoader({ children, sections }: { readonly children: ReactNode; readonly sections: readonly AdminNavSection[] }) {
  return <AdminRootShell sections={sections}>{children}</AdminRootShell>;
}
