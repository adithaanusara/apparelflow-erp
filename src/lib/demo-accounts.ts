import type { Role } from "./roles";

// Demo accounts for evaluators. These credentials are public by design: they
// are seeded into the database and shown on the sign-in page.
export const DEMO_ACCOUNTS: readonly {
  email: string;
  password: string;
  role: Role;
  fullName: string;
}[] = [
  {
    email: "supervisor@apparelflow.demo",
    password: "Supervisor@123",
    role: "cutting_supervisor",
    fullName: "Demo Cutting Supervisor",
  },
  {
    email: "verifier@apparelflow.demo",
    password: "Verifier@123",
    role: "cutting_verifier",
    fullName: "Demo Cutting Verifier",
  },
  {
    email: "sewing@apparelflow.demo",
    password: "Sewing@123",
    role: "sewing_supervisor",
    fullName: "Demo Sewing Supervisor",
  },
];
