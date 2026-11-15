import { analyzeJob } from "@/lib/ai/analyze";
import { loadResume } from "@/lib/ai/resume";
import { getSql } from "@/lib/db";
import { DOMAINS, isDomainKey, isRoleType } from "@/lib/dashboard/domains";

// Every tool runs as the signed-in user (userId comes from the session,
// never from the model or the client).
export interface AgentJob {
  id: number;
  company: string;
  role: string;
  location: string | null;
  apply_url: string | null;
  domain: string | null;
  decision: string | null;
}

export const TOOL_AGENT: Record<string, string> = {
  search_jobs: "Scout",
  get_my_profile: "Resume Reader",
  analyze_job: "Analyst",
  list_my_jobs: "Tracker",
  save_job: "Tracker",
  hide_job: "Tracker",
  ask_job_preferences: "JobMatch Agent",
};

// Asked before the first job search when the student hasn't said what kind
// of job or which season they want. "All of the above" means no filter.
export const PREFERENCE_QUESTIONS = [
  { id: "type", question: "What type of job are you looking for?", options: ["Internship", "Full-time", "All of the above"] },
  { id: "season", question: "Which timeline?", options: ["Spring", "Summer", "Fall", "Winter", "All of the above"] },
];

const SEASON_WORDS: Record<string, string> = { spring: "spring", summer: "summer", fall: "fall|autumn", winter: "winter" };

export const FUNCTION_DECLARATIONS = [
  {
    name: "search_jobs",
    description: "Scout: search the shared job feed. Returns up to `limit` jobs (default 8). Student-friendly roles only unless include_senior is true.",
    parameters: {
      type: "OBJECT",
      properties: {
        domain: { type: "STRING", description: `One of: ${DOMAINS.map((d) => d.key).join(", ")}, other` },
        role_type: { type: "STRING", description: "internship, full_time (includes new grad roles), new_grad, contract or part_time. Omit for all types." },
        season: { type: "STRING", description: "spring, summer, fall or winter (the term the job starts). Omit for any season." },
        query: { type: "STRING", description: "Words to find in the title or company, e.g. 'machine learning' or 'Stripe'" },
        location: { type: "STRING", description: "Words to find in the location, e.g. 'CA', 'Los Angeles', 'Remote'" },
        include_senior: { type: "BOOLEAN" },
        limit: { type: "INTEGER" },
      },
    },
  },
  {
    name: "ask_job_preferences",
    description: "Ask the student two quick multiple-choice questions (job type: internship / full-time / all; timeline: spring / summer / fall / winter / all) before searching. The student answers with buttons in the next message.",
    parameters: { type: "OBJECT", properties: {} },
  },
  { name: "get_my_profile", description: "Resume Reader: the student's own resume profile (skills, degree, school, grad date, projects).", parameters: { type: "OBJECT", properties: {} } },
  {
    name: "analyze_job",
    description: "Analyst: compare the student's resume with one job. Returns fit 0-100, eligibility, strengths, gaps and next steps. Use at most 3 times per request.",
    parameters: { type: "OBJECT", properties: { job_id: { type: "INTEGER" } }, required: ["job_id"] },
  },
  {
    name: "list_my_jobs",
    description: "Tracker: the student's saved or not_interested jobs.",
    parameters: { type: "OBJECT", properties: { decision: { type: "STRING", description: "saved or not_interested" } }, required: ["decision"] },
  },
  { name: "save_job", description: "Tracker: add a job to the student's Saved list. Only when the student asks to save.", parameters: { type: "OBJECT", properties: { job_id: { type: "INTEGER" } }, required: ["job_id"] } },
  { name: "hide_job", description: "Tracker: mark a job not interested. Only when the student asks.", parameters: { type: "OBJECT", properties: { job_id: { type: "INTEGER" } }, required: ["job_id"] } },
];

export interface ToolResult {
  summary: string; // shown in the step trail
  data: Record<string, unknown>; // sent back to the model
  jobs?: AgentJob[]; // shown as cards
}

async function jobsByIds(userId: number, ids: number[]): Promise<AgentJob[]> {
  if (ids.length === 0) return [];
  return (await getSql()`
    select j.id, j.company, j.role, j.location, j.apply_url, j.tm_domain as domain, d.decision
    from jobs j left join tm_decisions d on d.job_id = j.id and d.user_id = ${userId}
    where j.id = any(${ids}::int[])
  `) as AgentJob[];
}

export async function runTool(userId: number, name: string, args: Record<string, unknown>): Promise<ToolResult> {
  const sql = getSql();
  switch (name) {
    case "search_jobs": {
      const domain = isDomainKey(String(args.domain ?? "")) ? String(args.domain) : null;
      const roleType = isRoleType(String(args.role_type ?? "")) ? String(args.role_type) : null;
      // "Full-time" covers new grad roles too: both are full-time jobs.
      const roleTypes = roleType === "full_time" ? ["full_time", "new_grad"] : roleType ? [roleType] : null;
      const seasonKey = String(args.season ?? "").toLowerCase();
      const seasonWords = SEASON_WORDS[seasonKey] ?? null;
      const seasonTitle = seasonWords ? `\\y(${seasonWords})\\y` : null;
      const seasonJd = seasonWords
        ? `\\y(${seasonWords})\\y\\s*(20\\d\\d|intern|internship|term|co-?op|program|session|semester|quarter|start)`
        : null;
      const query = typeof args.query === "string" && args.query.trim() ? `%${args.query.trim().slice(0, 80)}%` : null;
      const location = typeof args.location === "string" && args.location.trim() ? `%${args.location.trim().slice(0, 60)}%` : null;
      const studentOnly = args.include_senior !== true;
      const limit = Math.min(Math.max(Number(args.limit) || 8, 1), 15);
      const skills = ((await sql`select skills from tm_users where id = ${userId}`) as { skills: string[] | null }[])[0]?.skills ?? [];
      const rows = (await sql`
        select j.id, j.company, j.role, j.location, j.apply_url, j.tm_domain as domain, d.decision,
          case when cardinality(${skills}::text[]) = 0 then null else round(100.0 * (
            select count(*) from unnest(${skills}::text[]) s where position(s in lower(j.role || ' ' || coalesce(j.jd_text, ''))) > 0
          ) / cardinality(${skills}::text[]))::int end as match
        from jobs j left join tm_decisions d on d.job_id = j.id and d.user_id = ${userId}
        where d.decision is distinct from 'not_interested'
          and (${domain}::text is null or j.tm_domain = ${domain})
          and (${roleTypes}::text[] is null or j.tm_type = any(${roleTypes}::text[]))
          and (${seasonTitle}::text is null or j.role ~* ${seasonTitle} or coalesce(j.jd_text, '') ~* ${seasonJd})
          and (${query}::text is null or j.role ilike ${query} or j.company ilike ${query})
          and (${location}::text is null or j.location ilike ${location})
          and (not ${studentOnly}::boolean or j.tm_level is distinct from 'experienced')
        order by match desc nulls last, j.created_at desc
        limit ${limit}
      `) as (AgentJob & { match: number | null })[];
      const filters = [domain, roleType, seasonWords ? seasonKey : null, args.query, args.location].filter(Boolean).join(", ") || "all jobs";
      return {
        summary: `Searched ${filters}: ${rows.length} found`,
        data: { jobs: rows.map((r) => ({ id: r.id, company: r.company, role: r.role, location: r.location, keyword_match: r.match })) },
        jobs: rows,
      };
    }
    case "get_my_profile": {
      const resume = await loadResume(userId);
      if (!resume) return { summary: "No resume uploaded yet", data: { error: "The student has not uploaded a resume." } };
      return { summary: `Read ${resume.file_name}`, data: { profile: resume.profile } };
    }
    case "analyze_job": {
      const jobId = Number(args.job_id);
      const { analysis, job } = await analyzeJob(userId, jobId);
      return {
        summary: `${job.role} at ${job.company}: fit ${analysis.fit}, ${analysis.eligible === "yes" ? "eligible" : analysis.eligible === "no" ? "likely not eligible" : "eligibility unclear"}`,
        data: { job_id: jobId, company: job.company, role: job.role, ...analysis },
      };
    }
    case "list_my_jobs": {
      const decision = ["saved", "applied", "not_interested"].includes(String(args.decision)) ? String(args.decision) : "saved";
      const ids = ((await sql`select job_id from tm_decisions where user_id = ${userId} and decision = ${decision} order by updated_at desc limit 15`) as { job_id: number }[]).map((r) => r.job_id);
      const jobs = await jobsByIds(userId, ids);
      return { summary: `${jobs.length} ${decision.replace("_", " ")} jobs`, data: { jobs: jobs.map(({ id, company, role, location }) => ({ id, company, role, location })) }, jobs };
    }
    case "save_job":
    case "hide_job": {
      const jobId = Number(args.job_id);
      const decision = name === "save_job" ? "saved" : "not_interested";
      const [job] = await jobsByIds(userId, [jobId]);
      if (!job) return { summary: "Job not found", data: { error: "No job with that id" } };
      await sql`
        insert into tm_decisions (user_id, job_id, decision) values (${userId}, ${jobId}, ${decision})
        on conflict (user_id, job_id) do update set decision = excluded.decision, updated_at = now()
      `;
      return { summary: `${name === "save_job" ? "Saved" : "Hid"} ${job.role} at ${job.company}`, data: { ok: true }, jobs: [{ ...job, decision }] };
    }
    default:
      return { summary: `Unknown tool ${name}`, data: { error: "unknown tool" } };
  }
}
