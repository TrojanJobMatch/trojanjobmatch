"use client";

import { useEffect, useRef, useState } from "react";

import { AnalysisPanel } from "@/components/dashboard/AnalysisPanel";
import type { Analysis } from "@/lib/ai/analyze";
import { requestAnalysis } from "@/lib/dashboard/analysisQueue";
import { DOMAIN_LABELS } from "@/lib/dashboard/domains";
import type { DashboardJob, Decision } from "@/lib/dashboard/types";

const ACTIONS: { value: Decision; label: string }[] = [
  { value: "saved", label: "Save" },
  { value: "applied", label: "Applied" },
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

  return (
    <article ref={cardRef} className="card flex flex-col gap-3 p-4 sm:p-5">
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
        <div className="flex shrink-0 flex-col items-end gap-1">
          {ai.kind === "ok" ? (
            <span className="pill-gold text-[14px]" title="AI fit: how well your resume matches this job (0-100)">
              AI fit {ai.analysis.fit}
            </span>
          ) : ai.kind === "waiting" ? (
            <span className="animate-pulse rounded-full bg-[var(--background)] px-2.5 py-0.5 text-[13px] font-semibold text-[var(--muted)]" aria-live="polite">
              Scoring…
            </span>
          ) : null}
          {job.match !== null && (
            <span className="text-[12px] text-[var(--muted)]" title="How many of your skills this job mentions">
              Skills match {job.match}%
            </span>
          )}
        </div>
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

      {ai.kind === "ok" && (
        <details className="group rounded-xl border border-[var(--border)]">
          <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-2 px-3 text-[14px] [&::-webkit-details-marker]:hidden">
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
