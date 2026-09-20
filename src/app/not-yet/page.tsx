import { AuthShell } from "@/components/ui";
import { GATE_COPY } from "@/lib/geo";
import { WaitlistForm } from "./form";

export default async function NotYetPage({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  const { state } = await searchParams;
  const name = state === "CA" ? "California" : state === "NY" ? "New York" : "your state";
  return (
    <AuthShell title={`Not in ${name} yet.`} sub={GATE_COPY} footer={<>Elsewhere in the US? <a href="/signup" className="font-semibold text-blue">Join free</a></>}>
      <WaitlistForm state={state} />
    </AuthShell>
  );
}
