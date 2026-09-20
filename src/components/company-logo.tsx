"use client";

import { useState } from "react";

/** Logo from the company's domain (Google favicon service, no key), initials when there is none or it fails to load. */
export function logoUrl(domain: string | null | undefined, size = 64): string | null {
  if (!domain) return null;
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${size}`;
}

export function CompanyLogo({ name, domain, logo, size = 40 }: { name: string; domain?: string | null; logo?: string | null; size?: number }) {
  const [failed, setFailed] = useState(false);
  const src = logo ?? logoUrl(domain);
  const initials = name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "•";
  if (!src || failed) {
    return <div style={{ width: size, height: size }} className="flex shrink-0 items-center justify-center rounded-lg bg-ink font-display text-sm font-extrabold text-white">{initials}</div>;
  }
  return (
    <div style={{ width: size, height: size }} className="flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" width={size - 8} height={size - 8} loading="lazy" onError={() => setFailed(true)} className="object-contain" />
    </div>
  );
}
