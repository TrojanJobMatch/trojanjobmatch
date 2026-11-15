import { NextRequest, NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/session";
import { getSql } from "@/lib/db";
import { normalizeInterests } from "@/lib/events/topics";

// Save the signed-in student's event interests (topic keys from
// lib/events/topics.ts). Unknown keys are dropped, never stored.
export async function PUT(request: NextRequest) {
  const userId = await requireSession(request);
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const interests = normalizeInterests(body?.interests);
  try {
    await getSql()`update tm_users set interests = ${interests} where id = ${userId}`;
  } catch {
    return NextResponse.json({ error: "Couldn't save interests. Run scripts/events_interests.sql on the database first." }, { status: 500 });
  }
  return NextResponse.json({ interests });
}
