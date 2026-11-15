"use client";

import { useEffect, useState } from "react";

import { JobCard } from "@/components/dashboard/JobCard";
import { resetAnalysisQueue } from "@/lib/dashboard/analysisQueue";
import type { DashboardJob, Decision, JobFilters } from "@/lib/dashboard/types";

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
  onDecisionMade,
}: {
  filters: JobFilters;
  refreshKey: number;
  onDecisionMade?: () => void;
}) {
  const [jobs, setJobs] = useState<DashboardJob[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Loading is derived: the feed is loading until a response for the
  // current query has arrived (no setState inside the effect body).
  const requestKey = `${buildQuery(filters)}#${refreshKey}`;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const loading = loadedKey !== requestKey;

  useEffect(() => {
    let cancelled = false;
    resetAnalysisQueue();
    fetch(`/api/dashboard/jobs?${buildQuery(filters)}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setError(data.error ?? null);
        setJobs(data.error ? [] : (data.jobs ?? []));
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
  }, [filters, refreshKey, requestKey]);

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

  if (loading) return <p className="text-[15px] text-[var(--muted)]">Loading jobs…</p>;
  if (error) return <p className="text-[15px] text-[var(--danger)]">{error}</p>;
  if (jobs.length === 0) return <p className="text-[15px] text-[var(--muted)]">No jobs match these filters yet.</p>;

  return (
    <div className="flex flex-col gap-3">
      {jobs.map((job) => (
        <JobCard key={job.id} job={job} onDecision={handleDecision} />
      ))}
    </div>
  );
}
