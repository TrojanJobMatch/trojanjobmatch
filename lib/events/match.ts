import { hasWord, norm } from "./text";
import { TOPICS, TOPIC_LABELS, type TopicKey } from "./topics";
import type { CalendarEvent, SampleEvent, ScoredEvent } from "./types";

// Event matching is plain, explainable scoring (no AI call), so it is
// instant, works without a Gemini key, and every score can say *why*.
//
//   +22  per student skill that the event mentions (max 3)   "uses your skill"
//   +35  per interest the student picked that tags the event  (max 2)
//   +12  per topic implied by the student's skills (max 2)    "fits your background"
//
// The total is capped at 100. With no skills and no interests we know
// nothing, so `match` is null and the list is simply sorted by date.
const SKILL_POINTS = 22;
const INTEREST_POINTS = 35;
const BACKGROUND_POINTS = 12;

/** Topics a student's skills point to, with how many skills back each. */
export function topicsFromSkills(skills: string[]): Map<TopicKey, number> {
  const out = new Map<TopicKey, number>();
  for (const raw of skills) {
    const skill = norm(raw);
    if (!skill) continue;
    for (const topic of TOPICS) {
      // Very short terms ("c", "r", "go", "ai") must match the whole skill;
      // otherwise "go to market" would read as a Go programmer.
      const hit = topic.terms.some((t) => (t.length <= 3 ? skill === t : skill === t || hasWord(skill, t)));
      if (hit) out.set(topic.key, (out.get(topic.key) ?? 0) + 1);
    }
  }
  return out;
}

/** Interests inferred from the resume that the student hasn't picked yet. */
export function suggestInterests(skills: string[], picked: TopicKey[], limit = 4): TopicKey[] {
  const derived = [...topicsFromSkills(skills).entries()].sort((a, b) => b[1] - a[1]).map(([key]) => key);
  // Anyone using a job app can use career events, once we know they have a resume.
  if (skills.length > 0 && !derived.includes("careers")) derived.push("careers");
  return derived.filter((key) => !picked.includes(key)).slice(0, limit);
}

export function scoreEvent(event: CalendarEvent, skills: string[], interests: TopicKey[]): ScoredEvent {
  if (skills.length === 0 && interests.length === 0) return { ...event, match: null, reasons: [] };

  const keywords = event.keywords.map(norm);
  const text = norm(`${event.title} ${event.description}`);
  const matchedSkills = skills.filter((raw) => {
    const skill = norm(raw);
    if (!skill) return false;
    if (keywords.includes(skill)) return true;
    // Free text only for skills of 3+ characters, so "c" or "r" can't match any word.
    return skill.length >= 3 && (hasWord(text, skill) || keywords.some((k) => hasWord(k, skill)));
  });

  const matchedInterests = interests.filter((key) => event.topics.includes(key));
  const background = [...topicsFromSkills(skills).keys()].filter((key) => event.topics.includes(key) && !interests.includes(key));

  const score =
    Math.min(matchedSkills.length, 3) * SKILL_POINTS +
    Math.min(matchedInterests.length, 2) * INTEREST_POINTS +
    Math.min(background.length, 2) * BACKGROUND_POINTS;

  const reasons: string[] = [];
  if (matchedInterests.length) reasons.push(`Matches your interest in ${matchedInterests.map((k) => TOPIC_LABELS[k]).join(" and ")}`);
  if (matchedSkills.length) reasons.push(`Uses your skills: ${matchedSkills.slice(0, 3).join(", ")}`);
  if (background.length) reasons.push(`Fits your resume background in ${background.slice(0, 2).map((k) => TOPIC_LABELS[k]).join(" and ")}`);

  return { ...event, match: Math.min(100, score), reasons };
}

/** Best matches first; ties (and unscored lists) go by soonest date. */
export function rankEvents(events: CalendarEvent[], skills: string[], interests: TopicKey[]): ScoredEvent[] {
  return events
    .map((e) => scoreEvent(e, skills, interests))
    .sort((a, b) => (b.match ?? 0) - (a.match ?? 0) || a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
}

/** Turn "days from today" into real dates in USC's time zone. */
export function resolveEvents(events: SampleEvent[], now: Date = new Date()): CalendarEvent[] {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const [y, m, d] = today.split("-").map(Number);
  return events.map((event) => {
    const date = new Date(Date.UTC(y, m - 1, d + event.dayOffset)).toISOString().slice(0, 10);
    return { ...event, date };
  });
}
