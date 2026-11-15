import type { Analysis } from "@/lib/ai/analyze";

const ELIGIBLE: Record<Analysis["eligible"], { label: string; cls: string }> = {
  yes: { label: "Eligible", cls: "bg-[#e7f6ec] text-[#1a7f37]" },
  no: { label: "Likely not eligible", cls: "bg-[#fdecea] text-[var(--danger)]" },
  unclear: { label: "Eligibility unclear", cls: "bg-[#fff6d6] text-[#7a5b00]" },
};

function List({ title, items, icon }: { title: string; items: string[]; icon: string }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-[13px] font-semibold uppercase tracking-[0.05em] text-[var(--muted)]">{title}</p>
      <ul className="mt-1 flex flex-col gap-1">
        {items.map((item) => (
          <li key={item} className="flex gap-2 text-[14px] leading-snug">
            <span aria-hidden>{icon}</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AnalysisPanel({ analysis }: { analysis: Analysis }) {
  const badge = ELIGIBLE[analysis.eligible];
  // A fit estimate in words, never a number or a promise.
  const fit =
    analysis.fit >= 70
      ? { label: "Strong fit", cls: "bg-[#e6f4ea] text-[#1a7f37]" }
      : analysis.fit >= 40
        ? { label: "Possible fit", cls: "bg-[#fff4d6] text-[#7a5a00]" }
        : { label: "Long shot", cls: "bg-[#fdecea] text-[var(--danger)]" };
  return (
    <div className="rounded-2xl bg-[var(--background)] p-4">
      <div className="flex items-center gap-4">
        <span className={`shrink-0 rounded-full px-3 py-1.5 text-[14px] font-bold ${fit.cls}`}>{fit.label}</span>
        <div className="min-w-0">
          <p className="text-[12px] font-semibold uppercase tracking-[0.05em] text-[var(--muted)]">Analyst agent · fit estimate</p>
          <p className="text-[15px] font-semibold leading-snug">{analysis.verdict}</p>
          <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${badge.cls}`} title={analysis.eligibility_reason}>
            {badge.label}
          </span>
        </div>
      </div>
      {analysis.eligibility_reason && <p className="mt-2 text-[13px] text-[var(--muted)]">{analysis.eligibility_reason}</p>}
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <List title="Strengths" items={analysis.strengths} icon="✅" />
        <List title="Gaps" items={analysis.gaps} icon="⚠️" />
        <List title="Coach: next steps" items={analysis.next_steps} icon="🎯" />
      </div>
      {!analysis.jd_used && (
        <p className="mt-3 text-[12px] text-[var(--muted)]">Based on the title and listed skills; the full job description wasn&rsquo;t available.</p>
      )}
    </div>
  );
}
