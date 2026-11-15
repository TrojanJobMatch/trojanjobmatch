import { NextRequest, NextResponse } from "next/server";

import { analyzeJob } from "@/lib/ai/analyze";
import { loadResume } from "@/lib/ai/resume";
import { requireSession } from "@/lib/auth/session";
import { findUserById } from "@/lib/auth/users";
import { getSql } from "@/lib/db";

export const maxDuration = 60;

// How many of the user's best skill matches get an AI fit score ahead of time.
const TOP_JOBS = 30;
const CONCURRENCY = 3;
// Stop starting new analyses after this long, so the reply beats maxDuration.
const BUDGET_MS = 35_000;
const MAX_FAILURES = 3;

// Scores the signed-in user's top jobs in the background, so the fit rings are
// already filled in and "Best fit first" has scores to sort by. Body:
// {skip: number[]}, job ids the page is already scoring itself. Replies with
// {scored, remaining}; the page calls again while `remaining` is above zero.
export async function POST(request: NextRequest) {
  const userId = await requireSession(request);
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const user = await findUserById(userId);
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!(await loadResume(userId))) return NextResponse.json({ scored: 0, remaining: 0 });

  const body = await request.json().catch(() => ({}));
  const skip: number[] = Array.isArray(body?.skip)
    ? body.skip.filter((n: unknown) => Number.isInteger(n) && (n as number) > 0).slice(0, 200)
    : [];
  const skills = user.skills ?? [];

  // Same ranking as the default feed: skill match first, newest next.
  const rows = (await getSql()`
    select id from (
      select
        j.id, j.created_at, a.user_id is not null as scored,
        case when cardinality(${skills}::text[]) = 0 then null else (
          select count(*) from unnest(${skills}::text[]) s
          where position(s in lower(j.role || ' ' || coalesce(j.jd_text, ''))) > 0
        ) end as match
      from jobs j
      left join tm_decisions d on d.job_id = j.id and d.user_id = ${userId}
      left join tm_analyses a on a.job_id = j.id and a.user_id = ${userId}
      where d.decision is distinct from 'not_interested' and j.tm_level is distinct from 'experienced'
      order by match desc nulls last, j.created_at desc, j.id desc
      limit ${TOP_JOBS}
    ) top
    where not scored and id <> all(${skip}::int[])
  `) as { id: number }[];

  const queue = rows.map((r) => r.id);
  const deadline = Date.now() + BUDGET_MS;
  let scored = 0;
  let failures = 0;
  async function worker() {
    while (queue.length > 0 && Date.now() < deadline && failures < MAX_FAILURES) {
      const jobId = queue.shift()!;
      try {
        await analyzeJob(userId!, jobId);
        scored++;
      } catch {
        failures++;
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  // After repeated AI failures, report nothing left so the page stops asking.
  return NextResponse.json({ scored, remaining: failures >= MAX_FAILURES ? 0 : queue.length });
}
