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
};

export const FUNCTION_DECLARATIONS = [
  {
    name: "search_jobs",
    description: "Scout: search the shared job feed. Returns up to `limit` jobs (default 8). Student-friendly roles only unless include_senior is true.",
    parameters: {
      type: "OBJECT",
      properties: {
        domain: { type: "STRING", description: `One of: ${DOMAINS.map((d) => d.key).join(", ")}, other` },
        role_type: { type: "STRING", description: "internship, new_grad, full_time, contract or part_time" },
        query: { type: "STRING", description: "Words to find in the title or company, e.g. 'machine learning' or 'Stripe'" },
        location: { type: "STRING", description: "Words to find in the location, e.g. 'CA', 'Los Angeles', 'Remote'" },
        include_senior: { type: "BOOLEAN" },
        limit: { type: "INTEGER" },
      },
    },
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
          and (${roleType}::text is null or j.tm_type = ${roleType})
          and (${query}::text is null or j.role ilike ${query} or j.company ilike ${query})
          and (${location}::text is null or j.location ilike ${location})
          and (not ${studentOnly}::boolean or j.tm_level is distinct from 'experienced')
        order by match desc nulls last, j.created_at desc
        limit ${limit}
      `) as (AgentJob & { match: number | null })[];
      const filters = [domain, roleType, args.query, args.location].filter(Boolean).join(", ") || "all jobs";
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
