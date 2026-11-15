"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Wordmark } from "@/components/auth/AuthShell";
import { EventCard } from "@/components/events/EventCard";
import { rankEvents, resolveEvents, suggestInterests } from "@/lib/events/match";
import { SAMPLE_EVENTS } from "@/lib/events/sample";
import { TOPICS, normalizeInterests, type TopicKey } from "@/lib/events/topics";
import type { CalendarEvent } from "@/lib/events/types";

const STORAGE_KEY = "trojanmatch_events_demo";
const FIRST_PAGE = 6;

// One-tap demo students, so the feature can be shown without a resume.
const PERSONAS: { label: string; skills: string[]; interests: TopicKey[] }[] = [
  { label: "🤖 ML engineer", skills: ["python", "pytorch", "machine learning", "sql", "docker"], interests: ["ai", "careers"] },
  { label: "🎨 UX designer", skills: ["figma", "ux", "prototyping", "photoshop", "html", "css"], interests: ["design", "arts"] },
  { label: "📈 Business major", skills: ["excel", "marketing", "finance", "consulting", "strategy"], interests: ["business", "careers"] },
];

function cleanSkills(list: string[]): string[] {
  const clean = list.map((s) => s.trim().toLowerCase()).filter((s) => s.length > 0 && s.length <= 40);
  return [...new Set(clean)].slice(0, 30);
}

// Browser-only demo: skills (from a resume PDF, a persona or typed by hand)
// and interests live in localStorage. Ranking runs right here in the browser
// over the sample events, so it needs no database, login or AI key.
export function EventsExplorer() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [interests, setInterests] = useState<TopicKey[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [ready, setReady] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Dates depend on "today", so resolve them in the browser after mount.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time load on mount
    setEvents(resolveEvents(SAMPLE_EVENTS));
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
      if (saved) {
        setSkills(cleanSkills(Array.isArray(saved.skills) ? saved.skills.filter((s: unknown) => typeof s === "string") : []));
        setInterests(normalizeInterests(saved.interests));
        setFileName(typeof saved.fileName === "string" ? saved.fileName : null);
      }
    } catch {
      /* private mode or bad data: start empty */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ skills, interests, fileName }));
    } catch {
      /* storage unavailable: the demo still works for this visit */
    }
  }, [ready, skills, interests, fileName]);

  const ranked = useMemo(() => rankEvents(events, skills, interests), [events, skills, interests]);
  const suggested = useMemo(() => suggestInterests(skills, interests), [skills, interests]);
  const known = skills.length > 0 || interests.length > 0;
  const matched = known ? ranked.filter((e) => (e.match ?? 0) > 0) : ranked;
  const pool = matched.length > 0 ? matched : ranked;
  const visible = showAll ? pool : pool.slice(0, FIRST_PAGE);

  async function upload(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (file.type !== "application/pdf") return setError("Please upload your resume as a PDF.");
    setBusy(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/events/skills", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setError(data.error ?? "Upload failed. Try again.");
      setSkills(cleanSkills(data.skills));
      setFileName(data.fileName ?? file.name);
    } catch {
      setError("Network error, try again.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function addSkills() {
    setSkills((current) => cleanSkills([...current, ...draft.split(",")]));
    setDraft("");
  }

  function applyPersona(p: (typeof PERSONAS)[number]) {
    setSkills(p.skills);
    setInterests(p.interests);
    setFileName(null);
    setError(null);
  }

  function reset() {
    setSkills([]);
    setInterests([]);
    setFileName(null);
    setError(null);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-[var(--cardinal-deep)] pb-20 pt-6 text-white sm:pb-24">
        <div className="container-tm">
          <Wordmark className="text-[20px] sm:text-[24px]" />
          <h1 className="font-display mt-8 text-[30px] uppercase leading-none sm:text-[44px]">
            Events <span className="text-[var(--gold)]">for you</span>
          </h1>
          <p className="mt-2 text-[16px] text-white/85">Your resume and interests, matched to what&apos;s happening at USC.</p>
        </div>
      </header>

      <main className="container-tm -mt-12 flex flex-1 flex-col gap-6 pb-12">
        <section className="card p-4 sm:p-5">
          <input ref={inputRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-heading text-[18px]">1. Your skills</h2>
            <span className="text-[13px] text-[var(--muted)]">Stays in your browser. Nothing is stored.</span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className="btn btn-primary min-h-[40px] px-4 text-[14px]">
              {busy ? "Reading your resume…" : fileName ? "Replace resume (PDF)" : "Upload resume (PDF)"}
            </button>
            <span className="text-[14px] text-[var(--muted)]">{fileName ? `📄 ${fileName}` : "or try a sample student:"}</span>
            {PERSONAS.map((p) => (
              <button key={p.label} type="button" onClick={() => applyPersona(p)} className="btn btn-secondary min-h-[40px] px-3 text-[14px]">
                {p.label}
              </button>
            ))}
          </div>
          {error && <p role="alert" className="mt-2 text-[14px] text-[var(--danger)]">{error}</p>}

          <ul className="mt-3 flex flex-wrap gap-2">
            {skills.map((s) => (
              <li key={s} className="flex items-center gap-1 rounded-full bg-[var(--background)] py-1 pl-3 pr-1 text-[13px] font-medium">
                {s}
                <button type="button" aria-label={`Remove ${s}`} onClick={() => setSkills(skills.filter((x) => x !== s))} className="h-6 w-6 rounded-full text-[var(--muted)] hover:bg-white">
                  ×
                </button>
              </li>
            ))}
          </ul>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              addSkills();
            }}
          >
            <input className="input" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add skills, separated by commas" aria-label="Add skills" />
            <button type="submit" className="btn btn-secondary px-4 text-[14px]">Add</button>
          </form>
        </section>

        <section className="card p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-heading text-[18px]">2. What are you into?</h2>
            {known && (
              <button type="button" onClick={reset} className="text-[14px] font-semibold text-[var(--cardinal)] underline underline-offset-2">
                Start over
              </button>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Your interests">
            {TOPICS.map(({ key, label }) => {
              const on = interests.includes(key);
              const hint = suggested.includes(key);
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setInterests(on ? interests.filter((k) => k !== key) : [...interests, key])}
                  title={hint ? "Suggested from your resume" : undefined}
                  className={`min-h-[36px] rounded-full px-3.5 text-[14px] font-semibold ${
                    on ? "bg-[var(--cardinal-deep)] text-white" : hint ? "border-2 border-dashed border-[var(--gold)] bg-white" : "border border-[var(--border)] bg-white"
                  }`}
                >
                  {hint && !on ? "✨ " : ""}
                  {label}
                </button>
              );
            })}
          </div>
          {suggested.length > 0 && <p className="mt-2 text-[13px] text-[var(--muted)]">✨ Dashed gold topics are suggested from your resume skills. Tap to add.</p>}
        </section>

        <section className="card p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-heading text-[18px]">3. Your events{known ? ` (${pool.length})` : ""}</h2>
            <span className="text-[13px] text-[var(--muted)]">Sample events modeled on calendar.usc.edu</span>
          </div>
          {!known && (
            <p className="mt-3 rounded-xl bg-[var(--background)] p-3 text-[14px]">
              Upload a resume, tap a sample student or pick a few interests and this list re-ranks for you. Showing everything coming up for now.
            </p>
          )}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {visible.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
          {pool.length > FIRST_PAGE && (
            <button type="button" onClick={() => setShowAll((s) => !s)} className="btn btn-secondary mt-4 min-h-[40px] px-4 text-[14px]">
              {showAll ? "Show fewer" : `Show ${pool.length - FIRST_PAGE} more events`}
            </button>
          )}
        </section>

        <p className="text-center text-[13px] text-[var(--muted)]">A student project built at the AI@USC Hackathon. Not an official USC website.</p>
      </main>
    </div>
  );
}
