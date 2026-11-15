"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Wordmark } from "@/components/auth/AuthShell";
import { CheckReport, type CheckState } from "@/components/check/CheckReport";

interface PastCheck {
  id: number;
  title: string;
  company: string;
  verdict: string | null;
  score: number | null;
  created_at: string;
}

const STEPS: { key: keyof CheckState; agent: string; doing: string }[] = [
  { key: "deterministic", agent: "📄 Reader + 🧹 ATS check", doing: "Reading your resume line by line, checking the file" },
  { key: "reviewer", agent: "🎓 Career Fair Reviewer", doing: "Judging first impression and whether it reads human-made" },
  { key: "analyst", agent: "📊 Analyst", doing: "Checking the proof behind every skill a recruiter looks for" },
  { key: "debate", agent: "⚔️ Recruiter vs Advocate", doing: "Arguing for and against an interview" },
  { key: "judge", agent: "⚖️ Judge", doing: "Ruling on the debate and writing the conclusion" },
];

export default function CheckPage() {
  const [jobText, setJobText] = useState("");
  const [url, setUrl] = useState("");
  const [role, setRole] = useState("");
  const [state, setState] = useState<CheckState>({});
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needResume, setNeedResume] = useState(false);
  const [past, setPast] = useState<PastCheck[]>([]);

  const loadPast = () =>
    fetch("/api/check")
      .then((r) => r.json())
      .then((d) => setPast(d.checks ?? []))
      .catch(() => undefined);
  useEffect(() => {
    loadPast();
    // Opened from "Evaluate my resume": start the evaluation right away.
    if (new URLSearchParams(window.location.search).get("auto") === "1") {
      window.history.replaceState(null, "", "/check");
      run();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run() {
    setError(null);
    setNeedResume(false);
    setState({});
    setRunning(true);
    try {
      const res = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: jobText, url, role }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Couldn't start the check.");
        setNeedResume(Boolean(data.needResume));
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const { stage, data } = JSON.parse(line);
          if (stage === "error") setError(data.message);
          else if (stage === "done") loadPast();
          else setState((s) => ({ ...s, [stage]: data }));
        }
      }
    } catch {
      setError("Network error, try again.");
    } finally {
      setRunning(false);
    }
  }

  async function open(id: number) {
    setError(null);
    const d = await fetch(`/api/check/${id}`).then((r) => r.json()).catch(() => null);
    if (d?.check) {
      setState(d.check.analysis ?? {});
      setJobText(d.check.job_text ?? "");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  const started = running || Object.keys(state).length > 0;

  return (
    <div className="min-h-screen">
      <header className="bg-[var(--cardinal-deep)] py-4 text-white">
        <div className="container-tm flex items-center justify-between gap-3">
          <Link href="/dashboard" aria-label="Trojan JobMatch dashboard">
            <Wordmark className="text-[18px] sm:text-[22px]" />
          </Link>
          <Link href="/dashboard" className="rounded-full border border-white/40 px-4 py-2 text-[14px] font-semibold hover:bg-white/10">
            ← Dashboard
          </Link>
        </div>
      </header>

      <main className="container-tm flex flex-col gap-5 py-8 sm:py-10">
        <div>
          <h1 className="font-display text-[28px] uppercase leading-none sm:text-[40px]">
            Evaluate my resume <span className="text-[var(--cardinal)]">like a recruiter</span>
          </h1>
          <p className="mt-2 max-w-[680px] text-[16px] text-[var(--muted)]">
            Five AI agents evaluate your resume the way a recruiter and a career fair advisor would: first impression, whether it reads human-made or AI-made, proof behind every skill, keyword stuffing, and exactly what to change. Add a job post (optional) to see how you stack up for that role.
          </p>
        </div>

        <details className="card p-4 sm:p-5" open={Boolean(jobText)}>
          <summary className="cursor-pointer text-[15px] font-semibold">➕ Compare against a specific job or role (optional)</summary>
          <div className="mt-3 flex flex-col gap-3">
          <label htmlFor="role" className="text-[14px] font-semibold">
            Target role <span className="font-normal text-[var(--muted)]">(optional, e.g. &ldquo;Software engineering intern&rdquo;)</span>
          </label>
          <input id="role" className="input" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Leave empty and the agents pick roles that fit your resume" />
          <label htmlFor="job" className="text-[14px] font-semibold">
            Job description <span className="font-normal text-[var(--muted)]">(optional)</span>
          </label>
          <textarea
            id="job"
            className="input min-h-[180px] py-3 text-[15px] leading-snug"
            value={jobText}
            onChange={(e) => setJobText(e.target.value)}
            placeholder="Optional: paste a job post from Handshake, LinkedIn or a company site to also check the fit for that job…"
          />
          <label htmlFor="url" className="text-[14px] font-semibold">
            …or a public job link <span className="font-normal text-[var(--muted)]">(company career pages; LinkedIn and Handshake need pasting)</span>
          </label>
          <input id="url" className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://boards.greenhouse.io/…" />
          </div>
        </details>

        <section className="card flex flex-col gap-3 p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={run} disabled={running || (jobText.trim().length > 0 && jobText.trim().length < 200 && !url.trim())} className="btn btn-primary bg-[var(--cardinal-deep)] px-6 disabled:opacity-50">
              {running ? "Agents are working…" : jobText.trim() || url.trim() ? "Evaluate my resume for this job" : "Evaluate my resume"}
            </button>
            <span className="text-[13px] text-[var(--muted)]">Uses your uploaded resume. Private to you. <Link href="/dashboard" className="underline">Change resume</Link></span>
          </div>
          {error && (
            <p role="alert" className="text-[14px] text-[var(--danger)]">
              {error} {needResume && <Link href="/dashboard" className="font-semibold underline">Upload your resume</Link>}
            </p>
          )}
        </section>

        {started && (
          <section className="card p-4 sm:p-5" aria-live="polite">
            <ol className="flex flex-col gap-2">
              {STEPS.map((s) => {
                const done = state[s.key] !== undefined;
                return (
                  <li key={s.key} className="flex items-center gap-3 text-[14px]">
                    <span aria-hidden className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-bold ${done ? "bg-[#1a7f37] text-white" : running ? "animate-pulse bg-[var(--gold)]" : "bg-[var(--border)]"}`}>
                      {done ? "✓" : "…"}
                    </span>
                    <span className="font-semibold">{s.agent}</span>
                    <span className="text-[var(--muted)]">{done ? "done" : running ? s.doing : "skipped"}</span>
                  </li>
                );
              })}
            </ol>
          </section>
        )}

        <CheckReport state={state} />

        {past.length > 0 && (
          <section className="card p-4 sm:p-5">
            <h2 className="font-heading text-[18px]">Your past checks</h2>
            <ul className="mt-3 flex flex-col divide-y divide-[var(--border)]">
              {past.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => open(p.id)} className="flex w-full items-center justify-between gap-3 py-2 text-left text-[14px] hover:text-[var(--cardinal)]">
                    <span className="min-w-0 truncate font-semibold">
                      {p.title || "Resume evaluation"}
                      {p.company ? ` · ${p.company}` : ""}
                    </span>
                    <span className="shrink-0 text-[var(--muted)]">
                      {p.verdict ?? "…"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="text-center text-[13px] text-[var(--muted)]">A student project built at the AI@USC Hackathon. Not an official USC website.</p>
      </main>
    </div>
  );
}
