export type SiteRole = 'super' | 'user';

export const SUPER_ADMIN_EMAIL = (
  process.env.SUPER_ADMIN_EMAIL ?? 'action.in.th@gmail.com'
).toLowerCase();

export function isSuperAdmin(email: string | undefined | null): boolean {
  return !!email && email.toLowerCase() === SUPER_ADMIN_EMAIL;
}

export function roleFor(email: string | undefined | null): SiteRole {
  return isSuperAdmin(email) ? 'super' : 'user';
}

/** Authenticated site user, attached to the request by SiteAdminGuard. */
export interface SiteUser {
  sub: string;
  username: string;
  email: string;
  role: SiteRole;
}
