import adminOperatorPermissionManifest from '../../api/src/admin/admin-operator-permission-manifest.json';
import type { AdminOperatorPermissionCategory } from './admin-operator-access-model';

export const ADMIN_OPERATOR_BASE_ROLE = 'ADMIN';
export const FINANCE_APPROVER_ROLE = 'FINANCE_APPROVER';
export const MASTER_ADMIN_ROLE = 'MASTER_ADMIN';

export const adminOperatorRoleValues = [
  ADMIN_OPERATOR_BASE_ROLE,
  FINANCE_APPROVER_ROLE,
  MASTER_ADMIN_ROLE,
] as const;

export type AdminOperatorRoleValue = (typeof adminOperatorRoleValues)[number];

export const adminOperatorAssignableRoleFields = [
  { label: 'Master Admin', value: MASTER_ADMIN_ROLE },
] as const;

export type AdminOperatorPermissionCategoryDefinition = {
  readonly group: string;
  readonly key: AdminOperatorPermissionCategory;
  readonly label: string;
  readonly scope: string;
  readonly defaultOwner: string;
  readonly risk: 'standard' | 'elevated' | 'high';
};

export const adminOperatorPermissionCategoryDefinitions =
  adminOperatorPermissionManifest.categories as readonly AdminOperatorPermissionCategoryDefinition[];

export const legacyAdminOperatorPermissionGroups =
  adminOperatorPermissionManifest.legacyGroups as Record<
    string,
    readonly AdminOperatorPermissionCategory[]
  >;

const adminOperatorPermissionCategorySet = new Set<string>([
  ...Object.keys(legacyAdminOperatorPermissionGroups),
  ...adminOperatorPermissionCategoryDefinitions.map((category) => category.key),
]);
const adminOperatorLeafPermissionCategorySet = new Set<string>(
  adminOperatorPermissionCategoryDefinitions.map((category) => category.key),
);

const adminOperatorRoleSet = new Set<string>(adminOperatorRoleValues);

export function isAdminOperatorPermissionCategory(value: unknown): value is AdminOperatorPermissionCategory {
  return typeof value === 'string' && adminOperatorPermissionCategorySet.has(value);
}

export function isAdminOperatorRole(value: unknown): value is AdminOperatorRoleValue {
  return typeof value === 'string' && adminOperatorRoleSet.has(value);
}

export function expandLegacyAdminOperatorCategories(categories: readonly string[]): string[] {
  return [
    ...new Set(
      categories.flatMap((category): readonly string[] => adminOperatorLeafPermissionCategorySet.has(category)
        ? [category]
        : legacyAdminOperatorPermissionGroups[category] ?? [category]),
    ),
  ];
}

export function isHighRiskAdminOperatorPermission(category: AdminOperatorPermissionCategory) {
  return adminOperatorPermissionCategoryDefinitions.some(
    (definition) => definition.key === category && definition.risk === 'high',
  );
}
