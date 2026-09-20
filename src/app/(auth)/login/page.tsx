import Link from "next/link";
import { AuthShell, GoogleButton } from "@/components/ui";
import { signInWithGoogle } from "../actions";
import { LoginForm } from "./form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <AuthShell title="Sign in" sub="Your feed, your tracker, your tailored resumes."
      footer={<>New to Rails? <Link href="/signup" className="font-semibold text-blue">Join free</Link></>}>
      <form action={signInWithGoogle}><GoogleButton next={next} /></form>
      <div className="my-4 flex items-center gap-3 text-xs text-dim"><span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" /></div>
      <LoginForm next={next} oauthError={error} />
    </AuthShell>
  );
}
