import { NextRequest, NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/session";
import { findUserById } from "@/lib/auth/users";
import { getSql } from "@/lib/db";
import { rankEvents, resolveEvents, suggestInterests } from "@/lib/events/match";
import { SAMPLE_EVENTS } from "@/lib/events/sample";
import { normalizeInterests } from "@/lib/events/topics";
import type { EventsResponse } from "@/lib/events/types";

// USC events ranked for the signed-in student: their resume skills
// (tm_users.skills, filled in when the resume is read) plus the interests
// they picked (tm_users.interests). Always the caller's own profile; no
// route here takes a user id from the client.
export async function GET(request: NextRequest) {
  const userId = await requireSession(request);
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const user = await findUserById(userId);
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const skills = user.skills ?? [];
  // If the `interests` column hasn't been added yet (scripts/events_interests.sql),
  // still show events matched on resume skills alone.
  let interests = normalizeInterests([]);
  try {
    const rows = (await getSql()`select interests from tm_users where id = ${userId}`) as { interests: string[] | null }[];
    interests = normalizeInterests(rows[0]?.interests ?? []);
  } catch {
    interests = [];
  }

  const body: EventsResponse = {
    events: rankEvents(resolveEvents(SAMPLE_EVENTS), skills, interests),
    interests,
    suggested: suggestInterests(skills, interests),
    skillCount: skills.length,
    sample: true,
  };
  return NextResponse.json(body);
}
