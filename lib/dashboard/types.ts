import type { Analysis } from "@/lib/ai/analyze";

export type Decision = "saved" | "applied" | "not_interested";

export interface DashboardJob {
  id: number;
  company: string;
  role: string;
  location: string | null;
  apply_url: string | null;
  posted_date: string | null;
  created_at: string;
  source: string;
  domain: string | null;
  level: "student" | "general" | "experienced" | null;
  // This user's own decision (tm_decisions), never another user's.
  decision: Decision | null;
  // 0-100: share of the user's skills found in the job's title and
  // description; null when the user hasn't added any skills.
  match: number | null;
  // This user's cached AI analysis of the job (tm_analyses), if one exists.
  analysis: Analysis | null;
}

export interface DashboardStats {
  totalJobs: number;
  strongMatches: number;
  saved: number;
  applied: number;
  notInterested: number;
}

export interface JobFilters {
  // "all" hides jobs the user marked not interested.
  decision: "all" | Decision;
  minMatch: number | null;
  search: string;
  sort: "match" | "newest";
  domain: string | null;
  level: "student" | "all";
  company: string | null;
  roleType: string | null;
}

export const DEFAULT_FILTERS: JobFilters = {
  decision: "all",
  minMatch: null,
  search: "",
  sort: "match",
  domain: null,
  level: "student",
  company: null,
  roleType: null,
};

export const STRONG_MATCH = 60;
