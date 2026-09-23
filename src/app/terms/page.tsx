import type { Metadata } from "next";
import Link from "next/link";
import { MarketingFooter, MarketingHeader, Prose, contactEmail } from "@/components/marketing";
import { PRICES } from "@/lib/billing/plans";

export const metadata: Metadata = { title: "Terms · Rails", description: "The terms for using Rails." };

export default function Terms() {
  const email = contactEmail();
  return (
    <main className="flex flex-1 flex-col bg-marketing">
      <MarketingHeader />
      <Prose title="Terms of service" updated="September 23, 2026">
        <p>These terms are the agreement between you and Rails when you use the website, the app and the Chrome extension. By creating an account you agree to them.</p>

        <h2>What Rails is</h2>
        <p>Rails is a job-search tool. It lists jobs we read from employers&apos; public career sites, scores them against your profile, helps you tailor your resume and cover letter, and fills application forms when you ask. Rails is not an employer, a recruiter or an employment agency, and it doesn&apos;t place anyone in a job. We don&apos;t charge job seekers placement fees, ever.</p>

        <h2>You stay in control</h2>
        <ul>
          <li>You submit every application yourself. Rails prepares and fills; it never submits.</li>
          <li>Check what you send. Scores, tailored resumes, cover letters and filled answers can be wrong. You are responsible for what goes to an employer.</li>
          <li>Tell the truth. Don&apos;t add skills or experience you don&apos;t have. Rails only builds from your resume and what you type in, and it shows the source of every line so you can check.</li>
        </ul>

        <h2>Your account</h2>
        <p>You need to be at least 16 and live somewhere Rails is available. Rails isn&apos;t available in California or New York yet. Keep your password to yourself; you&apos;re responsible for activity on your account.</p>

        <h2>Plans, payment and refunds</h2>
        <ul>
          <li><b>Free</b> includes the feed, scores, autofill and tracker, with limited AI credits.</li>
          <li><b>Pro</b> is ${PRICES.proMonthly} a month (${PRICES.proMonthlyStudent} with a verified school email) and renews monthly until you cancel. Cancelling stops the next charge; you keep Pro until the end of the paid month.</li>
          <li><b>Semester Pass</b> is one payment of ${PRICES.semester} (${PRICES.semesterStudent} for students) for {PRICES.semesterMonths} months. It doesn&apos;t renew.</li>
          <li>Refunds: ask within 7 days of your first payment and you get it back in full.</li>
          <li>Student prices need a school email. If you stop being a student, the regular price applies from your next renewal.</li>
          <li>Prices are in US dollars. We&apos;ll tell you at least 30 days before a price change affects you.</li>
        </ul>

        <h2>Acceptable use</h2>
        <p>Don&apos;t use Rails to break an employer&apos;s site terms, get around a CAPTCHA, apply as someone else, scrape Rails, resell access, or send spam. We can suspend accounts that do.</p>

        <h2>Your content</h2>
        <p>Your resume, profile and writing stay yours. You give us permission to store and process them only to run Rails for you, as described in the <Link href="/privacy">privacy policy</Link>.</p>

        <h2>Job listings</h2>
        <p>Listings come from employers&apos; own sites. We check them often and remove closed ones, but we can&apos;t promise a listing is still open, accurate, or that an employer will respond. Pay ranges and requirements are the employer&apos;s.</p>

        <h2>No guarantees</h2>
        <p>Rails is provided as is. We work hard to keep it accurate and running, but we don&apos;t guarantee interviews, offers, or that the service will be uninterrupted. To the extent the law allows, our total liability to you is limited to what you paid us in the 12 months before the claim.</p>

        <h2>Ending</h2>
        <p>You can delete your account any time in <Link href="/app/settings#delete">Settings</Link>. We can end or suspend accounts that break these terms. Paid time is refunded only as described above.</p>

        <h2>Changes and law</h2>
        <p>If we change these terms in a way that matters, we&apos;ll email you before it takes effect. These terms are governed by the laws of the Commonwealth of Virginia.</p>

        <h2>Contact</h2>
        <p>{email ? <>Questions: <a href={`mailto:${email}`}>{email}</a>.</> : <>Questions: use the contact address listed on this site.</>}</p>
      </Prose>
      <MarketingFooter />
    </main>
  );
}
