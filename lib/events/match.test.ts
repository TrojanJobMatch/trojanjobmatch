import { describe, expect, it } from "vitest";

import { rankEvents, resolveEvents, scoreEvent, suggestInterests, topicsFromSkills } from "./match";
import { SAMPLE_EVENTS } from "./sample";
import { isTopicKey, normalizeInterests } from "./topics";

const events = resolveEvents(SAMPLE_EVENTS, new Date("2026-11-15T18:00:00Z"));
const byId = (id: string) => events.find((e) => e.id === id)!;

describe("resolveEvents", () => {
  it("turns day offsets into dates in the Los Angeles time zone", () => {
    expect(byId("blood-wedding").date).toBe("2026-11-15");
    expect(byId("mend-it-monday").date).toBe("2026-11-16");
  });
});

describe("topics", () => {
  it("keeps only valid, unique interest keys", () => {
    expect(normalizeInterests(["ai", "ai", "nope", 5, "arts"])).toEqual(["ai", "arts"]);
    expect(normalizeInterests("ai")).toEqual([]);
    expect(isTopicKey("data")).toBe(true);
  });

  it("maps skills to topics without false hits on short words", () => {
    const topics = topicsFromSkills(["python", "sql", "go-to-market"]);
    expect(topics.has("software")).toBe(true);
    expect(topics.has("data")).toBe(true);
    // "go to market" is a business skill, not the Go language.
    expect(topics.get("software")).toBe(1);
  });
});

describe("scoreEvent", () => {
  it("has no score when we know nothing about the student", () => {
    expect(scoreEvent(byId("hackathon-llm"), [], []).match).toBeNull();
  });

  it("scores resume skills and explains why", () => {
    const scored = scoreEvent(byId("hackathon-llm"), ["python", "react", "llm"], []);
    expect(scored.match).toBeGreaterThanOrEqual(60);
    expect(scored.reasons.join(" ")).toMatch(/Uses your skills/);
  });

  it("rewards a picked interest even with no resume", () => {
    const scored = scoreEvent(byId("strings-showcase"), [], ["arts"]);
    expect(scored.match).toBe(35);
    expect(scored.reasons[0]).toMatch(/Arts & Performance/);
  });

  it("gives 0 to an event that matches nothing", () => {
    expect(scoreEvent(byId("strings-showcase"), ["python"], ["ai"]).match).toBe(0);
  });

  it("never exceeds 100", () => {
    const scored = scoreEvent(byId("viterbi-career-fair"), ["python", "java", "sql", "react", "machine learning"], ["careers", "software"]);
    expect(scored.match).toBe(100);
  });

  it("ignores one-letter skills in free text", () => {
    // "c" and "r" must not match any random word in a description.
    expect(scoreEvent(byId("strings-showcase"), ["c", "r"], []).match).toBe(0);
  });
});

describe("rankEvents", () => {
  it("puts an ML student's AI events ahead of unrelated ones", () => {
    const ranked = rankEvents(events, ["pytorch", "python", "machine learning"], []);
    expect(ranked[0].topics).toContain("ai");
    expect(ranked.findIndex((e) => e.id === "ml-reading-group")).toBeLessThan(ranked.findIndex((e) => e.id === "strings-showcase"));
  });

  it("sorts by soonest date when there is no profile yet", () => {
    const ranked = rankEvents(events, [], []);
    expect(ranked[0].date <= ranked[ranked.length - 1].date).toBe(true);
  });
});

describe("suggestInterests", () => {
  it("suggests topics from skills and skips ones already picked", () => {
    const suggested = suggestInterests(["python", "sql", "pytorch"], ["software"]);
    expect(suggested).toContain("data");
    expect(suggested).toContain("ai");
    expect(suggested).not.toContain("software");
  });

  it("suggests nothing for a student with no skills", () => {
    expect(suggestInterests([], [])).toEqual([]);
  });
});
