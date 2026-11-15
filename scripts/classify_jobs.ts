// One-off: adds tm_domain / tm_level to jobs and the AI tables, then
// classifies every job title. Run: npx tsx --env-file=.env.local scripts/classify_jobs.ts
import { neon } from "@neondatabase/serverless";

import { DOMAINS, EXPERIENCED_PATTERN, STUDENT_PATTERN } from "../lib/dashboard/domains";

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  await sql`alter table jobs add column if not exists tm_domain text`;
  await sql`alter table jobs add column if not exists tm_level text`;
  await sql`create table if not exists tm_resumes (
    user_id bigint primary key references tm_users(id) on delete cascade,
    file_name text not null, mime text not null, file bytea not null,
    text text not null default '', profile jsonb not null default '{}'::jsonb,
    uploaded_at timestamptz not null default now())`;
  await sql`create table if not exists tm_analyses (
    user_id bigint not null references tm_users(id) on delete cascade,
    job_id bigint not null references jobs(id) on delete cascade,
    result jsonb not null, created_at timestamptz not null default now(),
    primary key (user_id, job_id))`;
  await sql`update jobs set tm_domain = 'other'`;
  for (const d of [...DOMAINS].reverse()) {
    // Reverse order + overwrite = first match in DOMAINS wins.
    await sql`update jobs set tm_domain = ${d.key} where role ~* ${d.pattern}`;
  }
  await sql`update jobs set tm_level = case
    when role ~* ${STUDENT_PATTERN} then 'student'
    when role ~* ${EXPERIENCED_PATTERN} then 'experienced'
    else 'general' end`;
  await sql`alter table jobs add column if not exists tm_type text`;
  // Patterns go in as parameters: inside a JS template literal "\y" would
  // silently turn into a plain "y" and the word boundaries would be lost.
  const intern = "\\yinterns?\\y|internship|co-?op|apprentice";
  const newGrad = "new grad|graduate|university|early career|entry|campus|junior";
  const partTime = "part.?time";
  await sql`update jobs set tm_type = case
    when role ~* ${intern} or type ilike '%intern%' then 'internship'
    when role ~* ${newGrad} or type ilike '%new grad%' then 'new_grad'
    when role ~* 'contract' or type ilike '%contract%' then 'contract'
    when role ~* ${partTime} or type ilike '%part%' then 'part_time'
    else 'full_time' end`;
  console.log(await sql`select tm_type, count(*)::int n from jobs group by 1`);
  console.log(await sql`select tm_domain, count(*)::int n, count(*) filter (where tm_level <> 'experienced')::int student from jobs group by 1 order by 2 desc`);
}
main();
