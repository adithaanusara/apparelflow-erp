export const ROLES = [
  "cutting_supervisor",
  "cutting_verifier",
  "sewing_supervisor",
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  cutting_supervisor: "Cutting Supervisor",
  cutting_verifier: "Cutting Verifier",
  sewing_supervisor: "Sewing Supervisor",
};

// Where each role lands after signing in.
export const ROLE_HOME: Record<Role, string> = {
  cutting_supervisor: "/cutting",
  cutting_verifier: "/verification",
  sewing_supervisor: "/sewing",
};

export function isRole(value: unknown): value is Role {
  return ROLES.includes(value as Role);
}
