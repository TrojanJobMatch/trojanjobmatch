"use client";

import { useEffect, useRef, useState } from "react";

import { JobCard } from "@/components/dashboard/JobCard";
import { resetAnalysisQueue } from "@/lib/dashboard/analysisQueue";
import type { DashboardJob, Decision, JobFilters } from "@/lib/dashboard/types";

const PAGE_SIZE = 10;

function buildQuery(filters: JobFilters): string {
  const params = new URLSearchParams();
  if (filters.decision !== "all") params.set("decision", filters.decision);
  if (filters.minMatch !== null) params.set("minMatch", String(filters.minMatch));
  if (filters.search.trim()) params.set("search", filters.search.trim());
  params.set("sort", filters.sort);
  if (filters.domain) params.set("domain", filters.domain);
  if (filters.level === "all") params.set("level", "all");
  if (filters.company) params.set("company", filters.company);
  if (filters.roleType) params.set("roleType", filters.roleType);
  return params.toString();
}

export function JobFeed({
  filters,
  refreshKey,
  resumeKey,
  onDecisionMade,
}: {
  filters: JobFilters;
  refreshKey: number;
  // Changes when the resume is uploaded, replaced or deleted.
  resumeKey: number;
  onDecisionMade?: () => void;
}) {
  const [jobs, setJobs] = useState<DashboardJob[]>([]);
  const [total, setTotal] = useState(0);
  // The resume the loaded jobs were scored against. Cards are rebuilt when
  // it changes, so each one drops its old AI fit and asks again.
  const [loadedResumeKey, setLoadedResumeKey] = useState(resumeKey);
  const [error, setError] = useState<string | null>(null);
  const topRef = useRef<HTMLDivElement>(null);
  // The page resets to the first one whenever the filters change: the page
  // number is remembered together with the filter query it belongs to.
  const filterKey = buildQuery(filters);
  const [paging, setPaging] = useState({ key: filterKey, page: 0 });
  const page = paging.key === filterKey ? paging.page : 0;
  // Loading is derived: the feed is loading until a response for the
  // current query has arrived (no setState inside the effect body).
  const query = `${filterKey}&limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`;
  const requestKey = `${query}#${refreshKey}`;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const loading = loadedKey !== requestKey;

  useEffect(() => {
    let cancelled = false;
    resetAnalysisQueue();
    fetch(`/api/dashboard/jobs?${query}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setError(data.error ?? null);
        setJobs(data.error ? [] : (data.jobs ?? []));
        setTotal(data.error ? 0 : (data.total ?? 0));
        setLoadedResumeKey(resumeKey);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load jobs.");
      })
      .finally(() => {
        if (!cancelled) setLoadedKey(requestKey);
      });
    return () => {
      cancelled = true;
    };
  }, [query, refreshKey, requestKey, resumeKey]);

  const lastPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);
  function goTo(next: number, scroll: boolean) {
    setPaging({ key: filterKey, page: Math.min(Math.max(next, 0), lastPage) });
    if (scroll) topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleDecision(jobId: number, decision: Decision | null) {
    const previous = jobs;
    setJobs((current) => current.map((job) => (job.id === jobId ? { ...job, decision } : job)));
    const res = await fetch(`/api/dashboard/jobs/${jobId}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    if (!res.ok) setJobs(previous);
    else onDecisionMade?.();
  }

  const pager = (where: "top" | "bottom") => (
    <Pager
      page={page}
      total={total}
      loading={loading}
      onPrev={() => goTo(page - 1, where === "bottom")}
      onNext={() => goTo(page + 1, where === "bottom")}
    />
  );

  let body;
  if (error) body = <p className="text-[15px] text-[var(--danger)]">{error}</p>;
  else if (loading && jobs.length === 0) body = <p className="text-[15px] text-[var(--muted)]">Loading jobs…</p>;
  else if (jobs.length === 0) body = <p className="text-[15px] text-[var(--muted)]">No jobs match these filters yet.</p>;
  else
    body = (
      <div className={`flex flex-col gap-3 transition-opacity ${loading ? "opacity-50" : ""}`} aria-busy={loading}>
        {jobs.map((job) => (
          <JobCard key={`${job.id}-${loadedResumeKey}`} job={job} onDecision={handleDecision} />
        ))}
      </div>
    );

  return (
    <div ref={topRef} className="flex scroll-mt-4 flex-col gap-3">
      {total > 0 && pager("top")}
      {body}
      {total > PAGE_SIZE && pager("bottom")}
    </div>
  );
}

function Pager({
  page,
  total,
  loading,
  onPrev,
  onNext,
}: {
  page: number;
  total: number;
  loading: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  const first = page * PAGE_SIZE + 1;
  const last = Math.min(total, (page + 1) * PAGE_SIZE);
  const hasPrev = page > 0;
  const hasNext = last < total;
  const arrow =
    "flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card)] text-[20px] leading-none transition hover:border-[var(--cardinal)] hover:text-[var(--cardinal)] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-[var(--border)] disabled:hover:text-inherit";
  return (
    <nav aria-label="Job pages" className="flex items-center justify-end gap-3">
      <span className="text-[14px] text-[var(--muted)]" aria-live="polite">
        <span className="font-semibold text-[var(--foreground)]">
          {first.toLocaleString()}–{last.toLocaleString()}
        </span>{" "}
        of {total.toLocaleString()}
      </span>
      <button type="button" className={arrow} onClick={onPrev} disabled={!hasPrev || loading} aria-label="Previous 10 jobs">
        ‹
      </button>
      <button type="button" className={arrow} onClick={onNext} disabled={!hasNext || loading} aria-label="Next 10 jobs">
        ›
      </button>
    </nav>
  );
}
