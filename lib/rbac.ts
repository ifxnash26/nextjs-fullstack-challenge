import { Role } from "@prisma/client";

const hierarchy = [Role.VIEWER, Role.IT_STAFF, Role.ADMIN];

export function hasRequiredRole(current: Role, required: Role) {
  return hierarchy.indexOf(current) >= hierarchy.indexOf(required);
}

export function effectiveRole(userRole: Role, membershipRole?: Role | null) {
  const roles = [userRole, membershipRole ?? Role.VIEWER];
  return roles.sort((a, b) => hierarchy.indexOf(b) - hierarchy.indexOf(a))[0];
}

export function canEditAssets(role: Role) {
  return hasRequiredRole(role, Role.IT_STAFF);
}

export function canManageUsers(role: Role) {
  return role === Role.ADMIN;
}
