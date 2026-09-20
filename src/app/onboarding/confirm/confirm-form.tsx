"use client";

import { useActionState, useState } from "react";
import { FormError, PrimaryButton } from "@/components/ui";
import type { CanonicalProfile } from "@/lib/schemas/profile";
import { confirmProfile, type ConfirmState } from "../actions";

type P = CanonicalProfile;
const input = "h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-[14px] text-ink outline-none focus:border-blue";
const card = "rounded-2xl border border-line bg-surface p-5";
const label = "text-xs font-semibold uppercase tracking-wide text-muted";

export function ConfirmForm({ initial }: { initial: P }) {
  const [p, setP] = useState<P>(initial);
  const [state, action, pending] = useActionState<ConfirmState, FormData>(confirmProfile, {});
  const set = <K extends keyof P>(k: K, v: P[K]) => setP({ ...p, [k]: v });
  const [newSkill, setNewSkill] = useState("");

  const addSkill = () => {
    const name = newSkill.trim(); if (!name) return;
    set("skills", [...p.skills, { name, key: name.toLowerCase(), level: "working", evidence: "Added by you", source: "user" }]); setNewSkill("");
  };

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="profile" value={JSON.stringify(p)} />
      <FormError message={state.error} />

      <section className={card}>
        <div className={label}>You</div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input className={input} value={p.name} onChange={(e) => set("name", e.target.value)} placeholder="Full name" />
          <input className={input} value={p.phone ?? ""} onChange={(e) => set("phone", e.target.value || null)} placeholder="Phone" />
          <input className={input} value={p.links.linkedin ?? ""} onChange={(e) => set("links", { ...p.links, linkedin: e.target.value || null })} placeholder="LinkedIn URL" />
          <input className={input} value={p.links.github ?? ""} onChange={(e) => set("links", { ...p.links, github: e.target.value || null })} placeholder="GitHub URL" />
        </div>
        <input className={`${input} mt-3`} value={p.targetRoles.join(", ")} onChange={(e) => set("targetRoles", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} placeholder="Roles you want, comma separated: Software Engineer Intern, Cloud Support" />
      </section>

      <section className={card}>
        <div className="flex items-center justify-between"><div className={label}>Experience · {p.experience.length} entries</div>
          <button type="button" className="text-sm font-semibold text-blue" onClick={() => set("experience", [...p.experience, { id: `u${Date.now()}`, title: "", org: "", kind: "job", start: null, end: null, bullets: [], skills: [], source: "user" }])}>+ Add a role</button></div>
        <div className="mt-3 flex flex-col gap-4">
          {p.experience.map((e, i) => (
            <div key={e.id} className="rounded-xl border border-line bg-light p-4">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_110px_110px]">
                <input className={input} value={e.title} placeholder="Title" onChange={(ev) => set("experience", p.experience.map((x, j) => j === i ? { ...x, title: ev.target.value } : x))} />
                <input className={input} value={e.org} placeholder="Company / school" onChange={(ev) => set("experience", p.experience.map((x, j) => j === i ? { ...x, org: ev.target.value } : x))} />
                <input className={input} value={e.start ?? ""} placeholder="2025-08" onChange={(ev) => set("experience", p.experience.map((x, j) => j === i ? { ...x, start: ev.target.value || null } : x))} />
                <input className={input} value={e.end ?? ""} placeholder="present" onChange={(ev) => set("experience", p.experience.map((x, j) => j === i ? { ...x, end: ev.target.value || null } : x))} />
              </div>
              <textarea className={`${input} mt-2 h-28 py-2 leading-relaxed`} value={e.bullets.join("\n")} placeholder="One bullet per line. Numbers get you read: tickets closed, users, uptime, dollars."
                onChange={(ev) => set("experience", p.experience.map((x, j) => j === i ? { ...x, bullets: ev.target.value.split("\n") } : x))} />
              <div className="mt-2 flex items-center justify-between text-xs text-muted">
                <span>{e.source === "user" ? "Added by you" : "From your resume"} · {e.bullets.filter(Boolean).length} bullets</span>
                <button type="button" className="font-semibold text-red" onClick={() => set("experience", p.experience.filter((_, j) => j !== i))}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className={card}>
        <div className={label}>Education</div>
        {p.education.map((ed, i) => (
          <div key={i} className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_90px_1fr_90px]">
            <input className={input} value={ed.school} placeholder="School" onChange={(ev) => set("education", p.education.map((x, j) => j === i ? { ...x, school: ev.target.value } : x))} />
            <input className={input} value={ed.degree} placeholder="AAS" onChange={(ev) => set("education", p.education.map((x, j) => j === i ? { ...x, degree: ev.target.value } : x))} />
            <input className={input} value={ed.field} placeholder="Field" onChange={(ev) => set("education", p.education.map((x, j) => j === i ? { ...x, field: ev.target.value } : x))} />
            <input className={input} value={ed.gradYear ?? ""} placeholder="2027" onChange={(ev) => set("education", p.education.map((x, j) => j === i ? { ...x, gradYear: Number(ev.target.value) || null } : x))} />
          </div>
        ))}
        {p.education.length === 0 && <button type="button" className="mt-3 text-sm font-semibold text-blue" onClick={() => set("education", [{ school: "", degree: "", field: "", gradYear: null, gpa: null, coursework: [], source: "user" }])}>+ Add school</button>}
      </section>

      <section className={card}>
        <div className={label}>Skills you listed · {p.skills.length}</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {p.skills.map((s, i) => (
            <span key={s.key + i} className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold ${s.source === "user" ? "bg-green-chip text-green-chip-text" : "bg-blue-chip text-blue-chip-text"}`}>
              {s.name}<button type="button" aria-label={`Remove ${s.name}`} className="ml-1 opacity-60" onClick={() => set("skills", p.skills.filter((_, j) => j !== i))}>×</button>
            </span>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input className={input} value={newSkill} onChange={(e) => setNewSkill(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSkill(); } }} placeholder="Add a skill you actually have (Enter)" />
          <button type="button" onClick={addSkill} className="h-10 rounded-lg bg-ink px-4 text-sm font-bold text-white">Add</button>
        </div>
        <p className="mt-2 text-xs text-muted">Green = you added it. Tailored resumes can use anything on this list, and nothing that isn&apos;t.</p>
      </section>

      <section className={card}>
        <div className={label}>Facts that filter jobs</div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm"><span className="font-semibold">Work authorization</span>
            <select className={input} value={p.constraints.workAuthorization} onChange={(e) => set("constraints", { ...p.constraints, workAuthorization: e.target.value as P["constraints"]["workAuthorization"] })}>
              <option value="us_citizen">US citizen</option><option value="permanent_resident">Permanent resident</option><option value="visa_needs_sponsorship">Visa, will need sponsorship</option><option value="visa_no_sponsorship">Visa, no sponsorship needed</option><option value="unknown">Prefer not to say</option>
            </select></label>
          <label className="flex flex-col gap-1 text-sm"><span className="font-semibold">Security clearance</span>
            <select className={input} value={p.constraints.clearance} onChange={(e) => set("constraints", { ...p.constraints, clearance: e.target.value as P["constraints"]["clearance"] })}>
              <option value="none">None</option><option value="eligible">Eligible, none yet</option><option value="public_trust">Public Trust</option><option value="secret">Secret</option><option value="top_secret">Top Secret</option>
            </select></label>
          <label className="flex flex-col gap-1 text-sm"><span className="font-semibold">Where you can work</span>
            <input className={input} value={p.constraints.locations.join(", ")} onChange={(e) => set("constraints", { ...p.constraints, locations: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} placeholder="McLean, VA; Remote" /></label>
          <label className="flex flex-col gap-1 text-sm"><span className="font-semibold">Looking for</span>
            <div className="flex flex-wrap gap-2 pt-1">
              {(["internship", "new_grad", "entry", "mid", "senior", "part_time", "contract"] as const).map((t) => (
                <label key={t} className="flex items-center gap-1 text-sm"><input type="checkbox" checked={p.constraints.employmentTypes.includes(t)} onChange={(e) => set("constraints", { ...p.constraints, employmentTypes: e.target.checked ? [...p.constraints.employmentTypes, t] : p.constraints.employmentTypes.filter((x) => x !== t) })} />{t.replace("_", " ")}</label>
              ))}
            </div></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={p.constraints.remoteOk} onChange={(e) => set("constraints", { ...p.constraints, remoteOk: e.target.checked })} /> Remote is fine</label>
        </div>
      </section>

      <label className="flex items-start gap-2 text-sm text-text"><input type="checkbox" name="attest" className="mt-1" /> I confirm everything here is true and mine.</label>
      <PrimaryButton pending={pending}>Confirm → my feed</PrimaryButton>
    </form>
  );
}
