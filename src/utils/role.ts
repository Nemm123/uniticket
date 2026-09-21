import { UserRole } from '../types';

const USER_ROLE_KEY = 'uniticket_user_role';
let sessionRole: UserRole | null = null;

export function getUserRole(): UserRole | null {
  try {
    const storedRole = localStorage.getItem(USER_ROLE_KEY);
    return storedRole === 'attendee' || storedRole === 'organizer' ? storedRole : null;
  } catch {
    return sessionRole;
  }
}

export function setUserRole(role: UserRole): boolean {
  sessionRole = role;
  try {
    localStorage.setItem(USER_ROLE_KEY, role);
    return true;
  } catch {
    // Some mobile in-app/private browsers block localStorage. Keep the demo role
    // active for this session so role selection is still usable.
    return true;
  }
}

export function clearUserRole(): boolean {
  sessionRole = null;
  try {
    localStorage.removeItem(USER_ROLE_KEY);
    return true;
  } catch {
    return true;
  }
}
