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

  return (
    <article className="card flex flex-col gap-3 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[17px] font-semibold leading-snug">{job.role}</h3>
          <p className="mt-0.5 text-[15px] text-[var(--muted)]">
            {job.company}
            {job.location ? ` · ${job.location}` : ""}
          </p>
          {job.domain && (
            <span className="mt-2 inline-block rounded-full bg-[var(--background)] px-2.5 py-1 text-[12px] font-semibold text-[var(--cardinal)]">
              {DOMAIN_LABELS[job.domain] ?? "Other"}
            </span>
          )}
        </div>
        {job.match !== null && (
          <span className="pill-gold shrink-0 text-[14px]" title="How many of your skills this job mentions">
            {job.match}
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {ACTIONS.map(({ value, label }) => {
          const active = job.decision === value;
          return (
            <button
              key={value}
              type="button"
              disabled={pending}
              aria-pressed={active}
              onClick={() => choose(value)}
              className={`btn min-h-[40px] px-4 text-[14px] ${
                active ? "bg-[var(--cardinal-deep)] text-white" : "btn-secondary"
              }`}
            >
              {active && value !== "not_interested" ? "✓ " : ""}
              {label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={analyze}
          disabled={analyzing}
          className="btn min-h-[40px] bg-[var(--gold)] px-4 text-[14px] font-semibold text-black"
        >
          {analyzing ? "Analyzing…" : analysis ? (open ? "Hide AI analysis" : "Show AI analysis") : "✨ Analyze with AI"}
        </button>
        {job.apply_url && (
          <a
            href={job.apply_url}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto text-[14px] font-semibold text-[var(--cardinal)] underline underline-offset-2"
          >
            View posting ↗
          </a>
        )}
      </div>
      {open && analyzing && <p className="text-[14px] text-[var(--muted)]">Analyst agent is comparing this job with your resume…</p>}
      {open && aiError && <p className="text-[14px] text-[var(--danger)]">{aiError}</p>}
      {open && analysis && <AnalysisPanel analysis={analysis} />}
    </article>
  );
}
