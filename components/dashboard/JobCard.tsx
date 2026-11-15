"use client";

import { useState } from "react";

import { AnalysisPanel } from "@/components/dashboard/AnalysisPanel";
import type { Analysis } from "@/lib/ai/analyze";
import { DOMAIN_LABELS } from "@/lib/dashboard/domains";
import type { DashboardJob, Decision } from "@/lib/dashboard/types";

const ACTIONS: { value: Decision; label: string }[] = [
  { value: "saved", label: "Save" },
  { value: "not_interested", label: "Not interested" },
];

export function JobCard({
  job,
  onDecision,
}: {
  job: DashboardJob;
  onDecision: (jobId: number, decision: Decision | null) => Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function analyze() {
    if (analysis) return setOpen((o) => !o);
    setOpen(true);
    setAnalyzing(true);
    setAiError(null);
    try {
      const res = await fetch(`/api/dashboard/jobs/${job.id}/analyze`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setAiError(data.error ?? "Analysis failed. Try again.");
      else setAnalysis(data.analysis);
    } catch {
      setAiError("Network error, try again.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function choose(value: Decision) {
    setPending(true);
    try {
      // Tapping the active choice again clears it.
      await onDecision(job.id, job.decision === value ? null : value);
    } finally {
      setPending(false);
    }
  }

  const small = "min-h-[36px] rounded-full px-3.5 text-[13px] font-semibold transition disabled:opacity-60";
  return (
    <article className="card flex flex-col gap-2 px-4 py-3.5 sm:px-5 md:py-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-[16px] font-semibold leading-snug md:text-[17px]" title={job.role}>
              {job.role}
            </h3>
            {job.match !== null && (
              <span className="pill-gold shrink-0 text-[12px]" title="How many of your skills this job mentions">
                {job.match}
              </span>
            )}
          </div>
          <p className="mt-0.5 flex min-w-0 items-center gap-2 text-[14px] text-[var(--muted)]">
            <span className="truncate">
              <span className="font-medium text-[var(--foreground)]">{job.company}</span>
              {job.location ? ` · ${job.location}` : ""}
            </span>
            {job.domain && (
              <span className="shrink-0 rounded-full bg-[var(--background)] px-2 py-0.5 text-[11px] font-semibold text-[var(--cardinal)]">
                {DOMAIN_LABELS[job.domain] ?? "Other"}
              </span>
            )}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {ACTIONS.map(({ value, label }) => {
            const active = job.decision === value;
            return (
              <button
                key={value}
                type="button"
                disabled={pending}
                aria-pressed={active}
                onClick={() => choose(value)}
                className={`${small} ${
                  active
                    ? "bg-[var(--cardinal-deep)] text-white"
                    : "border border-[var(--border)] bg-[var(--card)] hover:border-[var(--cardinal)] hover:text-[var(--cardinal)]"
                }`}
              >
                {active && value !== "not_interested" ? "✓ " : ""}
                {active && value === "saved" ? "Saved" : label}
              </button>
            );
          })}
          <button type="button" onClick={analyze} disabled={analyzing} className={`${small} bg-[var(--gold)] text-black hover:brightness-95`}>
            {analyzing ? "Analyzing…" : analysis ? (open ? "Hide analysis" : "Show analysis") : "Analyze with AI"}
          </button>
          {job.apply_url && (
            <a
              href={job.apply_url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-1 text-[13px] font-semibold text-[var(--cardinal)] underline underline-offset-2"
            >
              View ↗
            </a>
          )}
        </div>
      </div>
      {open && analyzing && <p className="text-[14px] text-[var(--muted)]">Analyst agent is comparing this job with your resume…</p>}
      {open && aiError && <p className="text-[14px] text-[var(--danger)]">{aiError}</p>}
      {open && analysis && <AnalysisPanel analysis={analysis} />}
    </article>
  );
}
