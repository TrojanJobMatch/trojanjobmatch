import { TOPIC_LABELS } from "@/lib/events/topics";
import type { ScoredEvent } from "@/lib/events/types";

function formatDate(date: string): string {
  // Noon avoids a timezone shift moving the day.
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export function EventCard({ event }: { event: ScoredEvent }) {
  return (
    <article className="flex flex-col gap-2 rounded-2xl border border-[var(--border)] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[16px] font-semibold leading-snug">{event.title}</h3>
        {event.match !== null && event.match > 0 && (
          <span className="pill-gold shrink-0 text-[14px]" title="How well this event fits your resume and interests">
            {event.match}
          </span>
        )}
      </div>
      <p className="text-[14px] text-[var(--muted)]">
        {formatDate(event.date)} · {event.time} · {event.location}
      </p>
      <p className="text-[14px]">{event.description}</p>
      <div className="flex flex-wrap items-center gap-2">
        {event.topics.map((key) => (
          <span key={key} className="rounded-full bg-[var(--background)] px-2.5 py-1 text-[12px] font-semibold text-[var(--cardinal)]">
            {TOPIC_LABELS[key]}
          </span>
        ))}
        {event.free && <span className="rounded-full border border-[var(--border)] px-2.5 py-1 text-[12px] font-semibold">Free</span>}
      </div>
      {event.reasons.length > 0 && (
        <ul className="mt-1 space-y-0.5 border-t border-[var(--border)] pt-2 text-[13px] text-[var(--muted)]">
          {event.reasons.map((reason) => (
            <li key={reason}>✨ {reason}</li>
          ))}
        </ul>
      )}
    </article>
  );
}
