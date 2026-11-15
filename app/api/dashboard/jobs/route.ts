import { NextRequest, NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/session";
import { findUserById } from "@/lib/auth/users";
import { getSql } from "@/lib/db";
import { isDomainKey, isRoleType } from "@/lib/dashboard/domains";

// The shared job feed, seen through one user's eyes: their own decisions
// (tm_decisions) and a match score from their own skills. Query params:
// decision (all | saved | applied | not_interested), minMatch, search,
// sort (match | newest), domain (see lib/dashboard/domains.ts),
// level (student, the default, hides senior titles | all), limit (default 50, max 200),
// offset (for paging). The response carries `total`, the count across all pages.
export async function GET(request: NextRequest) {
  const userId = await requireSession(request);
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const user = await findUserById(userId);
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const decisionParam = params.get("decision");
  const decision = ["saved", "applied", "not_interested"].includes(decisionParam ?? "") ? decisionParam : null;
  const minMatchParam = Number(params.get("minMatch"));
  const minMatch = Number.isFinite(minMatchParam) && minMatchParam > 0 ? Math.min(minMatchParam, 100) : null;
  const searchParam = params.get("search")?.trim();
  const searchPattern = searchParam ? `%${searchParam}%` : null;
  const byMatch = params.get("sort") !== "newest";
  const limit = Math.min(Number(params.get("limit")) || 50, 200);
  const offset = Math.max(0, Math.min(Math.floor(Number(params.get("offset")) || 0), 100000));
  const skills = user.skills ?? [];
  const domainParam = params.get("domain");
  const domain = isDomainKey(domainParam) ? domainParam : null;
  const studentOnly = params.get("level") !== "all";
  const roleTypeParam = params.get("roleType");
  const roleType = isRoleType(roleTypeParam) ? roleTypeParam : null;
  const company = params.get("company")?.trim().slice(0, 200) || null;

  const rows = (await getSql()`
    select *, count(*) over()::int as total from (
      select
        j.id, j.company, j.role, j.location, j.apply_url, j.posted_date, j.created_at, j.source, j.tm_domain as domain, j.tm_level as level, j.tm_type as role_type,
        d.decision,
        case when cardinality(${skills}::text[]) = 0 then null else round(100.0 * (
          select count(*) from unnest(${skills}::text[]) s
          where position(s in lower(j.role || ' ' || coalesce(j.jd_text, ''))) > 0
        ) / cardinality(${skills}::text[]))::int end as match
      from jobs j
      left join tm_decisions d on d.job_id = j.id and d.user_id = ${userId}
      where
        (${decision}::text is null and d.decision is distinct from 'not_interested' or d.decision = ${decision})
        and (${domain}::text is null or j.tm_domain = ${domain})
        and (${roleType}::text is null or j.tm_type = ${roleType})
        and (${company}::text is null or j.company = ${company})
        and (not ${studentOnly}::boolean or j.tm_level is distinct from 'experienced')
        and (${searchPattern}::text is null or j.company ilike ${searchPattern} or j.role ilike ${searchPattern})
    ) feed
    where ${minMatch}::int is null or feed.match >= ${minMatch}
    order by
      case when ${byMatch}::boolean then feed.match end desc nulls last,
      feed.created_at desc
    limit ${limit} offset ${offset}
  `) as Record<string, unknown>[];

  const total = rows.length > 0 ? Number(rows[0].total) : 0;
  for (const row of rows) delete row.total;
  return NextResponse.json({ jobs: rows, total });
}
