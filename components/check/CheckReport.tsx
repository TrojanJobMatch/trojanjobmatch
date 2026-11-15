import type { AnalystResult, Claim, JudgeResult, ReviewerResult, Side } from "@/lib/check/agents";
import type { DeterministicReport } from "@/lib/check";

export interface CheckState {
  deterministic?: DeterministicReport & { injection?: string[] };
  analyst?: AnalystResult;
  reviewer?: ReviewerResult | null;
  debate?: { recruiter: Side; advocate: Side };
  judge?: JudgeResult;
}

const VERDICT = {
  likely: { label: "Likely to pass a recruiter screen", cls: "bg-[#e7f6ec] text-[#1a7f37]" },
  borderline: { label: "Borderline", cls: "bg-[#fff6d6] text-[#7a5b00]" },
  unlikely: { label: "Unlikely to pass yet", cls: "bg-[#fdecea] text-[var(--danger)]" },
} as const;
const VOICE = {
  reads_human: { label: "Reads human-made", cls: "bg-[#e7f6ec] text-[#1a7f37]" },
  some_generic: { label: "Mixed: some lines read AI-made", cls: "bg-[#fff6d6] text-[#7a5b00]" },
  reads_templated: { label: "Reads AI-made / templated", cls: "bg-[#fdecea] text-[var(--danger)]" },
} as const;
const STUFF = {
  honest: { label: "No keyword stuffing", cls: "bg-[#e7f6ec] text-[#1a7f37]" },
  some_stuffing: { label: "Some keyword stuffing", cls: "bg-[#fff6d6] text-[#7a5b00]" },
  heavy_stuffing: { label: "Heavy keyword stuffing", cls: "bg-[#fdecea] text-[var(--danger)]" },
} as const;
const STATUS = {
  proven: { label: "Proven", cls: "bg-[#e7f6ec] text-[#1a7f37]" },
  listed: { label: "Listed only", cls: "bg-[#fff6d6] text-[#7a5b00]" },
  missing: { label: "Missing", cls: "bg-[#fdecea] text-[var(--danger)]" },
} as const;

function Badge({ label, cls }: { label: string; cls: string }) {
  return <span className={`inline-block rounded-full px-3 py-1 text-[13px] font-semibold ${cls}`}>{label}</span>;
}

function Section({ title, agent, children }: { title: string; agent?: string; children: React.ReactNode }) {
  return (
    <section className="card p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-heading text-[18px]">{title}</h2>
        {agent && <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">{agent}</span>}
      </div>
      {children}
    </section>
  );
}

export function CheckReport({ state }: { state: CheckState }) {
  const { deterministic: det, analyst, reviewer, debate, judge } = state;
  const lineText = new Map((det?.lines ?? []).map((l) => [l.id, l.text]));
  const allClaims = [...(debate?.recruiter.claims ?? []), ...(debate?.advocate.claims ?? [])];
  const overruled = new Map((judge?.overruled ?? []).map((o) => [o.id, o.reason]));

  return (
    <div className="flex flex-col gap-4">
      {det?.injection && det.injection.length > 0 && (
        <p role="alert" className="rounded-xl bg-[#fff6d6] p-3 text-[14px] text-[#7a5b00]">
          This job post contains lines that try to instruct the AI ({det.injection.length}). We treated them as plain text and ignored them.
        </p>
      )}

      {judge && (
        <section className="card overflow-hidden" aria-live="polite">
          <div className="bg-[var(--cardinal-deep)] p-4 text-white sm:p-5">
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-white/75">⚖️ Judge · final conclusion</p>
            <p className="mt-2 text-[17px] leading-relaxed">{judge.summary}</p>
          </div>
          <div className="flex flex-wrap gap-2 p-4 sm:p-5">
            <Badge {...VERDICT[judge.verdict]} />
            {reviewer && <Badge {...VOICE[reviewer.voice.rating]} />}
            <Badge {...STUFF[judge.stuffing]} />
          </div>
        </section>
      )}

      {judge && allClaims.length > 0 && (
        <section className="grid gap-4 sm:grid-cols-2">
          {([
            ["✅ What's right", allClaims.filter((c) => c.kind === "strength" && judge.upheld.includes(c.id)), "border-[#1a7f37]"],
            ["❌ What's wrong", allClaims.filter((c) => c.kind !== "strength" && judge.upheld.includes(c.id)), "border-[var(--danger)]"],
          ] as const).map(([title, items, border]) => (
            <div key={title} className={`card border-t-4 p-4 sm:p-5 ${border}`}>
              <h2 className="font-heading text-[18px]">{title}</h2>
              {items.length === 0 ? (
                <p className="mt-2 text-[14px] text-[var(--muted)]">Nothing the Judge upheld here.</p>
              ) : (
                <ul className="mt-2 flex flex-col gap-2">
                  {items.map((c) => (
                    <li key={c.id} className="text-[14px] leading-snug">
                      {c.point}
                      {c.lineIds[0] && lineText.get(c.lineIds[0]) && <span className="mt-1 block text-[12px] text-[var(--muted)]">“{lineText.get(c.lineIds[0])}”</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>
      )}

      {judge && judge.topFixes.length > 0 && (
        <Section title="Top 3 changes to make" agent="Judge">
          <ol className="flex flex-col gap-3">
            {judge.topFixes.map((f, i) => (
              <li key={i} className="rounded-xl border border-[var(--border)] p-3">
                <p className="text-[15px] font-semibold">
                  {i + 1}. {f.problem}
                </p>
                {f.lineId && lineText.get(f.lineId) && <p className="mt-1 rounded-lg bg-[var(--background)] px-3 py-2 text-[13px] text-[var(--muted)]">“{lineText.get(f.lineId)}”</p>}
                <p className="mt-2 text-[14px]">
                  <span className="font-semibold text-[var(--cardinal)]">Fix: </span>
                  {f.fix}
                </p>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {reviewer && (
        <Section title="AI-made or human-made?" agent="🎓 Career Fair Reviewer">
          <div className="flex flex-wrap items-center gap-2">
            <Badge {...VOICE[reviewer.voice.rating]} />
            <span className="text-[13px] text-[var(--muted)]">A style read of how specific and personal it sounds, not proof of who wrote it.</span>
          </div>
          <p className="mt-2 text-[15px]">{reviewer.voice.reason}</p>
          {reviewer.voice.lines.length > 0 && (
            <ul className="mt-3 flex flex-col gap-2">
              {reviewer.voice.lines.map((l) => (
                <li key={l.lineId} className="rounded-xl border border-[var(--border)] p-3 text-[14px]">
                  <p className="text-[13px] text-[var(--muted)]">“{lineText.get(l.lineId)}”</p>
                  <p className="mt-1"><span className="font-semibold">Why it reads generic:</span> {l.why}</p>
                  <p className="mt-1"><span className="font-semibold text-[var(--cardinal)]">Say it your way:</span> {l.hint}</p>
                </li>
              ))}
            </ul>
          )}
          {det && det.style.length > 0 && (
            <p className="mt-3 text-[13px] text-[var(--muted)]">Measured signals: {det.style.map((s) => s.label).join(" · ")}</p>
          )}
        </Section>
      )}

      {det && (
        <Section title="Keyword stuffing check" agent="Code + Judge">
          <div className="flex flex-wrap gap-2">
            <Badge {...STUFF[judge?.stuffing ?? det.stuffing.level]} />
            <span className="self-center text-[14px] text-[var(--muted)]">
              {det.stuffing.jobSkills > 0 ? <>Of the job&rsquo;s skills you mention: {det.stuffing.proven} proven by your work, {det.stuffing.listedOnly} listed with no proof.</> : <>Paste a job post to check stuffing against a specific job.</>}
            </span>
          </div>
          {det.stuffing.reasons.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-[14px]">
              {det.stuffing.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}
          {det.copied.length > 0 && (
            <div className="mt-3">
              <p className="text-[13px] font-semibold uppercase tracking-[0.05em] text-[var(--muted)]">Copied word for word from the job</p>
              {det.copied.map((c) => (
                <p key={c.lineId} className="mt-1 rounded-lg bg-[#fff6d6] px-3 py-2 text-[13px]">“{c.phrase}”</p>
              ))}
            </div>
          )}
        </Section>
      )}

      {analyst && (
        <Section title="Does your resume prove what a recruiter looks for?" agent="📊 Analyst">
          <div className="flex flex-col gap-2">
            {analyst.requirements.map((r) => (
              <div key={r.requirement} className="flex flex-col gap-1 border-b border-[var(--border)] pb-2 last:border-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold">
                    {r.requirement} {!r.must && <span className="text-[12px] font-normal text-[var(--muted)]">(nice to have)</span>}
                  </p>
                  {r.quote && <p className="text-[13px] text-[var(--muted)]">“{r.quote}”</p>}
                </div>
                <Badge {...STATUS[r.status]} />
              </div>
            ))}
          </div>
          <p className="mt-3 text-[13px] text-[var(--muted)]">
            Basics: {analyst.gate.checks.map((c) => `${c.name} ${c.status === "pass" ? "✓" : c.status === "fail" ? "✗" : "?"}`).join(" · ")}
          </p>
        </Section>
      )}

      {debate && allClaims.length > 0 && (
        <Section title="The agents debated your resume" agent="⚔️ Recruiter vs Advocate">
          <div className="grid gap-3 sm:grid-cols-2">
            {([["🧑‍💼 Recruiter (skeptic)", debate.recruiter], ["🤝 Advocate (your side)", debate.advocate]] as const).map(([name, side]) => (
              <div key={name} className="rounded-xl bg-[var(--background)] p-3">
                <p className="text-[14px] font-semibold">
                  {name}
                </p>
                <ul className="mt-2 flex flex-col gap-2">
                  {side.claims.map((c: Claim) => (
                    <li key={c.id} className="rounded-lg bg-white p-2 text-[13px]">
                      <span className={overruled.has(c.id) ? "line-through opacity-60" : ""}>{c.point}</span>
                      {overruled.has(c.id) ? (
                        <span className="mt-1 block text-[12px] font-semibold text-[var(--danger)]">Judge overruled: {overruled.get(c.id)}</span>
                      ) : judge?.upheld.includes(c.id) ? (
                        <span className="mt-1 block text-[12px] font-semibold text-[#1a7f37]">Judge upheld</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>
      )}

      {reviewer && (
        <Section title="Career fair advisor's notes" agent="🎓 Career Fair Reviewer">
          <p className="text-[15px]"><span className="font-semibold">First 6 seconds:</span> {reviewer.firstImpression}</p>
          <ul className="mt-3 flex flex-col gap-2">
            {reviewer.improvements.map((i) => (
              <li key={i.area + i.advice} className="text-[14px]">
                <span className="font-semibold">{i.area}:</span> {i.advice}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {det && (
        <Section title="ATS and file check" agent="Code">
          <ul className="grid gap-2 sm:grid-cols-2">
            {det.ats.map((a) => (
              <li key={a.label} className="text-[14px]">
                <span aria-hidden>{a.ok ? "✅" : "⚠️"}</span> <span className="font-semibold">{a.label}:</span> {a.detail}
              </li>
            ))}
            {det.hygiene.map((h) => (
              <li key={h.label} className="text-[14px]">
                <span aria-hidden>{h.severity === "high" ? "⛔" : "ℹ️"}</span> <span className="font-semibold">{h.label}:</span> {h.detail}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {analyst && analyst.recruiter_will_ask.length > 0 && (
        <Section title="What a recruiter will ask you" agent="📊 Analyst">
          <ul className="list-disc pl-5 text-[14px]">
            {analyst.recruiter_will_ask.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
