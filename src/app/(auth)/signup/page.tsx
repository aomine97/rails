import Link from "next/link";
import { AuthShell, GoogleButton } from "@/components/ui";
import { signInWithGoogle } from "../actions";
import { SignupForm } from "./form";

export default function SignupPage() {
  return (
    <AuthShell title="Join free" sub="Every matched job with a fit score, unlimited autofill, and 3 tailored resumes to start. No card."
      footer={<>Already have an account? <Link href="/login" className="font-semibold text-blue">Sign in</Link></>}>
      <form action={signInWithGoogle}><GoogleButton /></form>
      <div className="my-4 flex items-center gap-3 text-xs text-dim"><span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" /></div>
      <SignupForm />
    </AuthShell>
  );
}
