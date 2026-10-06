import { requirePageRole } from "@/server/auth/page-session";

export default async function VerificationPage() {
  await requirePageRole("cutting_verifier");

  return (
    <>
      <h1 className="text-2xl font-bold text-slate-900">
        Verification Terminal
      </h1>
      <p className="mt-2 max-w-prose text-slate-700">
        The component count and approval workspace is not built yet. Batches
        submitted by the Cutting Supervisor are waiting in the database with
        status PENDING_VERIFICATION.
      </p>
    </>
  );
}
