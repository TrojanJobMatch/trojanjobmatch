"use client";

import { useEffect, useState } from "react";

import { DOMAINS, ROLE_TYPES } from "@/lib/dashboard/domains";
import type { DashboardStats, JobFilters } from "@/lib/dashboard/types";

const TABS: { value: JobFilters["decision"]; label: string }[] = [
  { value: "all", label: "All jobs" },
  { value: "saved", label: "Saved" },
  { value: "not_interested", label: "Not interested" },
];

export function Filters({
  filters,
  onChange,
  stats,
}: {
  filters: JobFilters;
  onChange: (next: JobFilters) => void;
  stats: DashboardStats | null;
}) {
  // The count of the user's own saved / not-interested jobs, shown beside the tab.
  const counts: Partial<Record<JobFilters["decision"], number>> = {
    saved: stats?.saved,
    not_interested: stats?.notInterested,
  };
  const [companies, setCompanies] = useState<{ company: string; n: number }[]>([]);
  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    if (filters.domain) params.set("domain", filters.domain);
    if (filters.level === "all") params.set("level", "all");
    fetch(`/api/dashboard/companies?${params}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setCompanies(data.companies ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [filters.domain, filters.level]);

  return (
    <div className="flex flex-col gap-3">
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist">
        {TABS.map((tab) => {
          const active = filters.decision === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange({ ...filters, decision: tab.value })}
              className={`inline-flex min-h-[40px] shrink-0 items-center gap-2 rounded-full px-4 text-[14px] font-semibold ${
                active ? "bg-[var(--cardinal-deep)] text-white" : "border border-[var(--border)] bg-white"
              }`}
            >
              {tab.label}
              {(counts[tab.value] ?? 0) > 0 && (
                <span
                  aria-label={`${counts[tab.value]} jobs`}
                  className={`min-w-[22px] rounded-full px-1.5 text-center text-[12px] font-bold leading-[22px] ${
                    active ? "bg-white text-[var(--cardinal-deep)]" : "bg-[var(--cardinal-deep)] text-white"
                  }`}
                >
                  {counts[tab.value]}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))]">
        <input
          type="search"
          aria-label="Search company or role"
          placeholder="Search company or role"
          value={filters.search}
          onChange={(event) => onChange({ ...filters, search: event.target.value })}
          className="input sm:col-span-3 lg:col-span-1"
        />
        <select
          aria-label="Domain"
          value={filters.domain ?? ""}
          onChange={(event) => onChange({ ...filters, domain: event.target.value || null, company: null })}
          className="input"
        >
          <option value="">All domains</option>
          {DOMAINS.map((d) => (
            <option key={d.key} value={d.key}>
              {d.label}
            </option>
          ))}
          <option value="other">Other</option>
        </select>
        <select
          aria-label="Company"
          value={filters.company ?? ""}
          onChange={(event) => onChange({ ...filters, company: event.target.value || null })}
          className="input"
        >
          <option value="">All companies</option>
          {filters.company && !companies.some((c) => c.company === filters.company) && (
            <option value={filters.company}>{filters.company}</option>
          )}
          {companies.map((c) => (
            <option key={c.company} value={c.company}>
              {c.company} ({c.n})
            </option>
          ))}
        </select>
        <select
          aria-label="Job type"
          value={filters.roleType ?? ""}
          onChange={(event) => onChange({ ...filters, roleType: event.target.value || null })}
          className="input"
        >
          <option value="">All job types</option>
          {ROLE_TYPES.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
