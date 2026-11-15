"use client";

import { useCallback, useEffect, useState } from "react";

import { EventCard } from "@/components/events/EventCard";
import { TOPICS, type TopicKey } from "@/lib/events/topics";
import type { EventsResponse } from "@/lib/events/types";

const FIRST_PAGE = 4;

// "Events for you": USC events ranked by the skills read from the student's
// resume plus the interests they tap here. Sample data for now.
export function EventsForYou({ refreshKey }: { refreshKey: number }) {
  const [data, setData] = useState<EventsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/events");
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return setError(body.error ?? "Couldn't load events.");
      setError(null);
      setData(body);
    } catch {
      setError("Network error, try again.");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time load on mount
    load();
  }, [load, refreshKey]);

  async function toggle(key: TopicKey) {
    if (!data) return;
    const next = data.interests.includes(key) ? data.interests.filter((k) => k !== key) : [...data.interests, key];
    setData({ ...data, interests: next, suggested: data.suggested.filter((k) => k !== key) });
    try {
      const res = await fetch("/api/dashboard/interests", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interests: next }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Couldn't save your interests.");
      }
    } catch {
      setError("Network error, try again.");
    }
    await load(); // re-rank with the saved interests (or roll back on failure)
  }

  const profileKnown = data ? data.skillCount > 0 || data.interests.length > 0 : false;
  const matched = data ? (profileKnown ? data.events.filter((e) => (e.match ?? 0) > 0) : data.events) : [];
  const pool = matched.length > 0 ? matched : (data?.events ?? []);
  const visible = showAll ? pool : pool.slice(0, FIRST_PAGE);

  return (
    <section id="events" aria-label="Events for you" className="card scroll-mt-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-heading text-[18px]">Events for you</h2>
        <span className="text-[13px] text-[var(--muted)]">Sample events modeled on calendar.usc.edu</span>
      </div>
      <p className="mt-1 text-[14px] text-[var(--muted)]">
        Ranked using the skills from your resume and the interests you pick below.
      </p>

      {data && (
        <div className="mt-3">
          <h3 className="text-[15px] font-semibold">What are you into?</h3>
          <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Your interests">
            {TOPICS.map(({ key, label }) => {
              const on = data.interests.includes(key);
              const suggested = data.suggested.includes(key);
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(key)}
                  title={suggested ? "Suggested from your resume" : undefined}
                  className={`min-h-[36px] rounded-full px-3.5 text-[14px] font-semibold ${
                    on
                      ? "bg-[var(--cardinal-deep)] text-white"
                      : suggested
                        ? "border-2 border-dashed border-[var(--gold)] bg-white"
                        : "border border-[var(--border)] bg-white"
                  }`}
                >
                  {suggested && !on ? "✨ " : ""}
                  {label}
                </button>
              );
            })}
          </div>
          {data.suggested.length > 0 && (
            <p className="mt-2 text-[13px] text-[var(--muted)]">✨ Dashed gold topics are suggested from the skills on your resume. Tap to add.</p>
          )}
        </div>
      )}

      {error && <p role="alert" className="mt-3 text-[14px] text-[var(--danger)]">{error}</p>}
      {!data && !error && <p className="mt-4 text-[15px] text-[var(--muted)]">Finding events for you…</p>}

      {data && !profileKnown && (
        <p className="mt-4 rounded-xl bg-[var(--background)] p-3 text-[14px]">
          Upload your resume or pick a few interests above and these events will re-rank just for you. Showing everything coming up in the meantime.
        </p>
      )}

      {data && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {visible.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}

      {data && pool.length > FIRST_PAGE && (
        <button type="button" onClick={() => setShowAll((s) => !s)} className="btn btn-secondary mt-4 min-h-[40px] px-4 text-[14px]">
          {showAll ? "Show fewer" : `Show ${pool.length - FIRST_PAGE} more events`}
        </button>
      )}
    </section>
  );
}
