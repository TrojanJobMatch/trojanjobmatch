"use client";

import { useEffect, useRef, useState } from "react";

import type { AgentJob } from "@/lib/ai/agentTools";

interface Turn {
  role: "user" | "model";
  text: string;
  steps?: { agent: string; text: string }[];
  jobs?: AgentJob[];
  questions?: Question[];
}

interface Question {
  id: string;
  question: string;
  options: string[];
}

// Multiple-choice questions from the agent (job type, timeline). Once every
// question has an answer, the answers are sent as the student's next message.
function QuestionPicker({ questions, onDone }: { questions: Question[]; onDone: (answer: string) => void }) {
  const [picked, setPicked] = useState<Record<string, string>>({});
  function choose(id: string, option: string) {
    const next = { ...picked, [id]: option };
    setPicked(next);
    if (questions.every((q) => next[q.id])) onDone(questions.map((q) => `${q.question} ${next[q.id]}.`).join(" "));
  }
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 sm:p-4">
      {questions.map((q) => (
        <fieldset key={q.id} className="flex flex-col gap-2">
          <legend className="mb-2 text-[14px] font-semibold">{q.question}</legend>
          <div className="flex flex-wrap gap-2">
            {q.options.map((option) => {
              const active = picked[q.id] === option;
              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={active}
                  onClick={() => choose(q.id, option)}
                  className={`min-h-[36px] rounded-full px-4 text-[14px] font-semibold transition ${
                    active
                      ? "bg-[var(--cardinal-deep)] text-white"
                      : "border border-[var(--border)] bg-[var(--background)] hover:border-[var(--cardinal)] hover:text-[var(--cardinal)]"
                  }`}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

const STARTERS = [
  "Find internships that fit my resume",
  "Which saved job should I apply to first?",
  "What skills am I missing for AI/ML roles?",
  "Show new grad SWE roles in California",
];

// Tiny renderer for the agent's replies: **bold** and "* " / "- " bullets.
function Rich({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-1 text-[15px] leading-relaxed">
      {text.split("\n").filter((line) => line.trim()).map((line, i) => {
        const bullet = /^\s*[*-]\s+/.test(line);
        // **bold** stays bold; single *italic* markers are dropped.
        const parts = line.replace(/^\s*[*-]\s+/, "").split(/\*\*(.+?)\*\*/g);
        const body = parts.map((part, k) => (k % 2 ? <strong key={k}>{part}</strong> : part.replace(/\*/g, "")));
        return bullet ? (
          <p key={i} className="flex gap-2 pl-1">
            <span aria-hidden className="text-[var(--cardinal)]">•</span>
            <span>{body}</span>
          </p>
        ) : (
          <p key={i}>{body}</p>
        );
      })}
    </div>
  );
}

const AGENT_ICON: Record<string, string> = { Scout: "🔎", "Resume Reader": "📄", Analyst: "📊", Tracker: "📌", Agent: "🤖" };

export function AgentPanel({ onJobsChanged }: { onJobsChanged: () => void }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  // The chat lives in a fixed-height box: new messages scroll inside it
  // and the page below (resume card, jobs) never moves.
  const chatRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = chatRef.current;
    if (box) box.scrollTo({ top: box.scrollHeight, behavior: "smooth" });
  }, [turns, busy]);

  async function ask(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    if (message.toLowerCase() === "/clear") {
      setInput("");
      setTurns([]);
      return;
    }
    setInput("");
    setBusy(true);
    const history = turns.map(({ role, text: t }) => ({ role, text: t }));
    setTurns((t) => [...t, { role: "user", text: message }]);
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history }),
      });
      const data = await res.json().catch(() => ({}));
      setTurns((t) => [...t, { role: "model", text: data.reply ?? data.error ?? "Something went wrong.", steps: data.steps ?? [], jobs: data.jobs ?? [], questions: data.questions }]);
      if ((data.steps ?? []).some((s: { agent: string }) => s.agent === "Tracker")) onJobsChanged();
    } catch {
      setTurns((t) => [...t, { role: "model", text: "Network error, try again." }]);
    } finally {
      setBusy(false);
    }
  }

  async function save(job: AgentJob) {
    const res = await fetch(`/api/dashboard/jobs/${job.id}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision: "saved" }),
    });
    if (res.ok) {
      setTurns((t) => t.map((turn) => ({ ...turn, jobs: turn.jobs?.map((j) => (j.id === job.id ? { ...j, decision: "saved" } : j)) })));
      onJobsChanged();
    }
  }

  return (
    <section className="card overflow-hidden">
      <div className="flex items-center gap-3 bg-[#1d1d1f] px-4 py-3 text-white sm:px-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--gold)] text-[18px]">🤖</span>
        <div>
          <h2 className="font-heading text-[17px] leading-tight">JobMatch Agent</h2>
          <p className="text-[13px] text-white/70">Scout · Resume Reader · Analyst · Tracker, working together for you</p>
        </div>
        {turns.length > 0 && (
          <button type="button" onClick={() => setTurns([])} className="ml-auto rounded-full border border-white/30 px-3 py-1.5 text-[13px] font-semibold hover:bg-white/10">
            New chat
          </button>
        )}
      </div>

      <div
        ref={chatRef}
        role="log"
        aria-live="polite"
        aria-label="Chat with the JobMatch Agent"
        className="flex h-[340px] flex-col gap-4 overflow-y-auto overscroll-contain bg-[var(--background)]/40 p-4 sm:h-[400px] sm:p-5"
      >
        {turns.length === 0 && (
          <p className="m-auto max-w-[560px] text-center text-[15px] text-[var(--muted)]">
            <span className="mb-2 block text-[28px]" aria-hidden>
              💬
            </span>
            Ask in plain words. The agents search the jobs, read your resume, analyze the best fits and keep your lists. They never apply for you.
            Your chat is private to you and is erased when you type /clear, start a new chat, close the tab or sign out.
          </p>
        )}
        {turns.map((turn, i) =>
          turn.role === "user" ? (
            <p key={i} className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-[var(--cardinal-deep)] px-4 py-2 text-[15px] text-white">
              {turn.text}
            </p>
          ) : (
            <div key={i} className="flex flex-col gap-2">
              {turn.steps && turn.steps.length > 0 && (
                <ol className="flex flex-col gap-1 border-l-2 border-[var(--gold)] pl-3">
                  {turn.steps.map((s, k) => (
                    <li key={k} className="text-[13px] text-[var(--muted)]">
                      <span className="font-semibold text-black">
                        {AGENT_ICON[s.agent] ?? "🤖"} {s.agent}
                      </span>{" "}
                      {s.text}
                    </li>
                  ))}
                </ol>
              )}
              {turn.questions && turn.questions.length > 0 ? (
                i === turns.length - 1 && !busy ? (
                  <>
                    <p className="text-[15px]">Quick questions so I pull the right jobs:</p>
                    <QuestionPicker questions={turn.questions} onDone={ask} />
                  </>
                ) : (
                  <p className="text-[15px]">Quick questions so I pull the right jobs.</p>
                )
              ) : (
                <Rich text={turn.text} />
              )}
              {turn.jobs && turn.jobs.length > 0 && (
                <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {turn.jobs.slice(0, 6).map((job) => (
                    <li key={job.id} className="flex min-w-0 items-start justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-semibold">{job.role}</p>
                        <p className="truncate text-[13px] text-[var(--muted)]">
                          #{job.id} · {job.company}
                          {job.location ? ` · ${job.location}` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <button
                          type="button"
                          disabled={job.decision === "saved"}
                          onClick={() => save(job)}
                          className="rounded-full border border-[var(--border)] px-3 py-1 text-[12px] font-semibold"
                        >
                          {job.decision === "saved" ? "✓ Saved" : "Save"}
                        </button>
                        {job.apply_url && (
                          <a href={job.apply_url} target="_blank" rel="noopener noreferrer" className="text-[12px] font-semibold text-[var(--cardinal)] underline">
                            View ↗
                          </a>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ),
        )}
        {busy && <p className="text-[14px] text-[var(--muted)]">🤖 Agents are working: planning, searching and analyzing…</p>}
      </div>

      <div className="border-t border-[var(--border)] p-3 sm:p-4">
        {turns.length === 0 && (
          <div className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1">
            {STARTERS.map((s) => (
              <button key={s} type="button" onClick={() => ask(s)} className="shrink-0 rounded-full border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[13px] font-semibold">
                {s}
              </button>
            ))}
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
          className="flex gap-2"
        >
          <input className="input" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask the agents, or type /clear to start over" disabled={busy} />
          <button type="submit" disabled={busy || !input.trim()} className="btn btn-primary shrink-0 bg-[var(--cardinal-deep)] px-5">
            Ask
          </button>
        </form>
      </div>
    </section>
  );
}
