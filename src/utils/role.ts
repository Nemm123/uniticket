import { UserRole } from '../types';

const USER_ROLE_KEY = 'uniticket_user_role';

export function getUserRole(): UserRole | null {
  try {
    const storedRole = localStorage.getItem(USER_ROLE_KEY);
    return storedRole === 'attendee' || storedRole === 'organizer' ? storedRole : null;
  } catch {
    return null;
  }
}

export function setUserRole(role: UserRole): boolean {
  try {
    localStorage.setItem(USER_ROLE_KEY, role);
    return true;
  } catch {
    return false;
  }
}

export function clearUserRole(): boolean {
  try {
    localStorage.removeItem(USER_ROLE_KEY);
    return true;
  } catch {
    return false;
  }
}