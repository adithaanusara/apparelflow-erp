import { requirePageRole } from "@/server/auth/page-session";

export default async function SewingPage() {
  await requirePageRole("sewing_supervisor");

  return (
    <>
      <h1 className="text-2xl font-bold text-slate-900">Sewing Queue</h1>
      <p className="mt-2 max-w-prose text-slate-700">
        The Sewing Queue is not built yet. Only verified batches will appear
        here.
      </p>
    </>
  );
}
