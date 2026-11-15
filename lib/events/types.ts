import type { TopicKey } from "./topics";

// One event as stored in the sample catalogue. `dayOffset` is days from
// today, so the demo never goes stale; resolveEvents() turns it into a date.
export interface SampleEvent {
  id: string;
  title: string;
  description: string;
  dayOffset: number;
  time: string; // free text, e.g. "1pm–3pm"
  location: string;
  topics: TopicKey[];
  // Extra specific terms (tools, subjects) matched against the student's skills.
  keywords: string[];
  free?: boolean;
}

export interface CalendarEvent extends SampleEvent {
  date: string; // YYYY-MM-DD, America/Los_Angeles
}

export interface ScoredEvent extends CalendarEvent {
  // 0-100, or null when we know nothing about the student yet.
  match: number | null;
  // Plain-language reasons, shown as "Why you'll like it".
  reasons: string[];
}

export interface EventsResponse {
  events: ScoredEvent[];
  interests: TopicKey[];
  // Interests inferred from resume skills that the student hasn't picked yet.
  suggested: TopicKey[];
  skillCount: number;
  sample: true;
}
