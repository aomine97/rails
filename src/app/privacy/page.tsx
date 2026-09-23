import type { Metadata } from "next";
import Link from "next/link";
import { MarketingFooter, MarketingHeader, Prose, contactEmail } from "@/components/marketing";

export const metadata: Metadata = { title: "Privacy · Rails", description: "What Rails collects, why, who processes it, and how to delete it." };

export default function Privacy() {
  const email = contactEmail();
  const reach = email ? <a href={`mailto:${email}`}>{email}</a> : <>the contact address on this page</>;
  return (
    <main className="flex flex-1 flex-col bg-marketing">
      <MarketingHeader />
      <Prose title="Privacy policy" updated="September 23, 2026">
        <p>Rails helps you find STEM and nursing jobs, tailor your resume and fill applications. This page says what we collect, why, who helps us process it, and how you get it back or delete it. The short version: we use your data to run your job search, we don&apos;t sell it, and the most sensitive answers never reach our servers.</p>

        <h2>What we collect</h2>
        <ul>
          <li><b>Account:</b> your name, email, state, and school email if you verify one for the student price.</li>
          <li><b>Your resume and profile:</b> the file you upload and what we read from it (experience, education, skills, links, work authorization, clearance, locations), plus anything you add or correct.</li>
          <li><b>Your job search:</b> jobs you like, hide or apply to, tracker stages, notes, reminders, tailored resumes and cover letters, Coach conversations.</li>
          <li><b>Emails you forward to your Rails address:</b> the sender, subject and a one-line snippet. The rest of the email is read once to update your tracker and then discarded.</li>
          <li><b>Extension activity:</b> which site and field the extension filled and whether it worked, so we can fix what breaks. We don&apos;t record what you typed into those fields.</li>
          <li><b>Payments:</b> handled by Stripe. We see your plan and payment status, never your full card number.</li>
        </ul>

        <h2>What stays on your device</h2>
        <p>Answers to voluntary demographic and EEO questions (gender, race and ethnicity, veteran and disability status), answers you save for reuse, and the passwords the extension creates for job-site accounts are stored in your browser by the extension. Our servers never receive them. Uninstalling the extension or clearing its data removes them.</p>

        <h2>Why we use it</h2>
        <ul>
          <li>To score jobs against your profile and explain the score.</li>
          <li>To write tailored resumes, cover letters and answers to application questions, using only your own resume and what you typed in.</li>
          <li>To fill application forms when you ask the extension to.</li>
          <li>To send the emails you turned on (new-job alerts, follow-up reminders) and account and billing emails.</li>
          <li>To keep Rails working and improve it, including counting what breaks.</li>
        </ul>
        <p>Rails never submits an application or sends a message to an employer or a person on your behalf.</p>

        <h2>Who processes it for us</h2>
        <ul>
          <li><b>Supabase</b> (database, sign-in, file storage) and <b>Vercel</b> (hosting).</li>
          <li><b>Anthropic</b> (the AI models that read postings, parse resumes, tailor, and answer Coach questions). Content is sent through Anthropic&apos;s commercial API.</li>
          <li><b>Stripe</b> (payments) and <b>Resend</b> (email delivery).</li>
        </ul>
        <p>We don&apos;t sell your personal information and we don&apos;t share it with employers. When you apply, you send your application to the employer yourself.</p>

        <h2>Career centers</h2>
        <p>If your school gives you Rails through a Career Center plan, your counselors see program-level numbers (for example, how many students applied and the share who got interviews). They see your name only if you are flagged as needing help, and they see only what that flag needs: your program, application and interview counts, and the reason. They never see your resume text, Coach conversations, emails or anything the extension keeps on your device.</p>

        <h2>How long we keep it</h2>
        <p>We keep your data while your account is open. Delete your account and we delete your profile, resumes, tracker, conversations and forwarded-email records. Payment records Stripe must keep for tax and fraud reasons stay with Stripe.</p>

        <h2>Your choices</h2>
        <ul>
          <li>Edit your profile any time under <Link href="/onboarding/confirm">Profile</Link>.</li>
          <li>Turn emails on or off in <Link href="/app/settings">Settings</Link>, or with the link at the bottom of any email.</li>
          <li>Delete your account under <Link href="/app/settings#delete">Settings</Link>. It takes effect right away.</li>
          <li>Ask for a copy of your data, or ask anything else, through {reach}.</li>
        </ul>

        <h2>Age</h2>
        <p>Rails is for people 16 and older. We don&apos;t knowingly collect data from anyone younger.</p>

        <h2>Changes</h2>
        <p>If we change this policy in a way that matters, we&apos;ll email you before it takes effect.</p>
      </Prose>
      <MarketingFooter />
    </main>
  );
}
