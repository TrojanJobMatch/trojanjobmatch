"use client";

import { useEffect, useRef, useState } from "react";

import { AnalysisPanel } from "@/components/dashboard/AnalysisPanel";
import type { Analysis } from "@/lib/ai/analyze";
import { requestAnalysis } from "@/lib/dashboard/analysisQueue";
import { DOMAIN_LABELS } from "@/lib/dashboard/domains";
import type { DashboardJob, Decision } from "@/lib/dashboard/types";

const ACTIONS: { value: Decision; label: string }[] = [
  { value: "saved", label: "Save" },
  { value: "not_interested", label: "Not interested" },
];

type AiState =
  | { kind: "waiting" } // not on screen yet, or queued
  | { kind: "ok"; analysis: Analysis }
  | { kind: "error"; message: string }
  | { kind: "no_resume"; message: string };

export function JobCard({
  job,
  onDecision,
}: {
  job: DashboardJob;
  onDecision: (jobId: number, decision: Decision | null) => Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  // The feed already carries analyses made earlier; the rest are fetched
  // automatically when the card scrolls into view.
  const [ai, setAi] = useState<AiState>(job.analysis ? { kind: "ok", analysis: job.analysis } : { kind: "waiting" });
  const [attempt, setAttempt] = useState(0);
  const cardRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (ai.kind !== "waiting") return;
    const card = cardRef.current;
    if (!card) return;
    const abort = new AbortController();
    const start = () =>
      requestAnalysis(job.id, abort.signal).then((outcome) => {
        if (outcome.kind !== "cancelled") setAi(outcome);
      });
    if (typeof IntersectionObserver === "undefined") {
      start();
      return () => abort.abort();
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        observer.disconnect();
        start();
      },
      { rootMargin: "200px" },
    );
    observer.observe(card);
    return () => {
      observer.disconnect();
      abort.abort();
    };
    // `attempt` restarts this after "Try again".
  }, [ai.kind, job.id, attempt]);

  function retry() {
    setAi({ kind: "waiting" });
    setAttempt((n) => n + 1);
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
    <article ref={cardRef} className="card flex flex-col gap-2 px-4 py-3.5 sm:px-5 md:py-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-[16px] font-semibold leading-snug md:text-[17px]" title={job.role}>
              {job.role}
            </h3>
            {ai.kind === "ok" ? (
              <span className="pill-gold shrink-0 text-[12px]" title="AI fit: how well your resume matches this job (0-100)">
                AI fit {ai.analysis.fit}
              </span>
            ) : ai.kind === "waiting" ? (
              <span className="shrink-0 animate-pulse rounded-full bg-[var(--background)] px-2 py-0.5 text-[12px] font-semibold text-[var(--muted)]" aria-live="polite">
                Scoring…
              </span>
            ) : null}
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
            {job.match !== null && (
              <span className="shrink-0 text-[12px]" title="How many of your skills this job mentions">
                Skills {job.match}%
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

      {ai.kind === "ok" && (
        <details className="group rounded-xl border border-[var(--border)]">
          <summary className="flex min-h-[40px] cursor-pointer list-none items-center gap-2 px-3 text-[13px] [&::-webkit-details-marker]:hidden">
            <span className="shrink-0 font-semibold">AI analysis</span>
            <span className="min-w-0 flex-1 truncate text-[var(--muted)]">{ai.analysis.verdict}</span>
            <span aria-hidden className="shrink-0 text-[var(--muted)] transition-transform group-open:rotate-180">▾</span>
          </summary>
          <div className="p-2 pt-0">
            <AnalysisPanel analysis={ai.analysis} />
          </div>
        </details>
      )}
      {ai.kind === "no_resume" && <p className="text-[13px] text-[var(--muted)]">{ai.message}</p>}
      {ai.kind === "error" && (
        <p className="text-[13px] text-[var(--muted)]">
          {ai.message}{" "}
          <button type="button" onClick={retry} className="font-semibold text-[var(--cardinal)] underline underline-offset-2">
            Try again
          </button>
        </p>
      )}
    </article>
  );
}
