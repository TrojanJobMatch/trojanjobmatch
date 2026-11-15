"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

interface ResumeInfo {
  file_name: string;
  profile: { name?: string; school?: string; degree?: string; grad_date?: string; summary?: string };
}

// Upload bar + the user's own resume (private to them) + editable skills.
export function ResumeCard({
  skills,
  onSkillsChange,
}: {
  skills: string[];
  onSkillsChange: (skills: string[]) => void;
}) {
  const [resume, setResume] = useState<ResumeInfo | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<null | "upload" | "delete">(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const evaluateAfterUpload = useRef(false);
  const router = useRouter();

  function evaluate() {
    if (resume) {
      router.push("/check?auto=1");
      return;
    }
    evaluateAfterUpload.current = true;
    setError(null);
    inputRef.current?.click();
  }

  useEffect(() => {
    fetch("/api/resume")
      .then((res) => res.json())
      .then((data) => setResume(data.resume ?? null))
      .catch(() => undefined)
      .finally(() => setLoaded(true));
  }, []);

  async function upload(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (file.type !== "application/pdf") return setError("Please upload your resume as a PDF.");
    setBusy("upload");
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/resume", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setError(data.error ?? "Upload failed. Try again.");
      setResume(data.resume);
      if (Array.isArray(data.skills) && data.skills.length) onSkillsChange(data.skills);
      if (evaluateAfterUpload.current) router.push("/check?auto=1");
    } catch {
      setError("Network error, try again.");
    } finally {
      setBusy(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove() {
    if (!window.confirm("Delete your resume from Trojan JobMatch? Your skills and AI analyses will be cleared too.")) return;
    setBusy("delete");
    await fetch("/api/resume", { method: "DELETE" }).catch(() => undefined);
    setResume(null);
    onSkillsChange([]);
    setBusy(null);
  }

  const fileInput = (
    <input ref={inputRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
  );

  const actions = (
    <div className="grid shrink-0 grid-cols-2 gap-2 lg:flex">
      <button
        type="button"
        onClick={evaluate}
        disabled={busy !== null}
        className="min-h-[44px] whitespace-nowrap rounded-full bg-[var(--cardinal-deep)] px-5 text-[14px] font-bold text-white transition hover:bg-[var(--cardinal)] disabled:opacity-60"
      >
        🔎 Evaluate my resume
      </button>
      <a
        href="/resume-builder"
        className="flex min-h-[44px] items-center justify-center whitespace-nowrap rounded-full border border-[var(--border)] bg-[var(--card)] px-5 text-[14px] font-bold text-[var(--foreground)] transition hover:border-[var(--cardinal)] hover:text-[var(--cardinal)]"
      >
        ✍️ Build my resume
      </a>
    </div>
  );

  return (
    <section className="card flex shrink-0 flex-col gap-3 p-4 sm:p-5 lg:flex-row lg:items-center lg:gap-5 lg:py-4">
      {fileInput}
      <div className="flex items-baseline justify-between gap-3 lg:w-[130px] lg:shrink-0 lg:flex-col lg:gap-1">
        <h2 className="font-heading text-[18px]">Your resume</h2>
        <span className="text-[12px] text-[var(--muted)]">🔒 Private to you</span>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {!loaded ? (
          <p className="text-[15px] text-[var(--muted)]">Loading…</p>
        ) : !resume || busy === "upload" ? (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              upload(e.dataTransfer.files?.[0]);
            }}
            className={`flex w-full flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed px-4 py-5 text-center transition lg:flex-row lg:justify-start lg:gap-3 lg:py-3 lg:text-left ${
              dragging ? "border-[var(--cardinal)] bg-[#fff5f5]" : "border-[#c9c9cc] bg-[var(--background)] hover:border-[var(--cardinal)]"
            }`}
          >
            {busy === "upload" ? (
              <span className="flex flex-col">
                <span className="text-[15px] font-semibold">Resume Reader agent is reading your resume…</span>
                <span className="text-[13px] text-[var(--muted)]">Pulling out your skills, education and projects (about 10 seconds)</span>
              </span>
            ) : (
              <>
                <span aria-hidden className="text-[26px] leading-none">📄</span>
                <span className="flex flex-col">
                  <span className="text-[15px] font-semibold">Upload your resume (PDF)</span>
                  <span className="text-[13px] text-[var(--muted)]">Drop it here or click. Then press Evaluate and five AI agents review it like a recruiter.</span>
                </span>
              </>
            )}
          </button>
        ) : (
          <div className="flex min-w-0 flex-col gap-2 rounded-2xl bg-[var(--background)] px-3 py-2.5 lg:flex-row lg:items-center lg:gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold">📄 {resume.file_name}</p>
              <p className="truncate text-[13px] text-[var(--muted)]">
                {[resume.profile.degree, resume.profile.school, resume.profile.grad_date].filter(Boolean).join(" · ") || "Resume on file"}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button type="button" disabled={busy !== null} onClick={() => inputRef.current?.click()} className="rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-[13px] font-semibold transition hover:border-[var(--cardinal)] hover:text-[var(--cardinal)] disabled:opacity-60">
                Replace
              </button>
              <button type="button" disabled={busy !== null} onClick={remove} className="rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-[13px] font-semibold transition hover:border-[var(--cardinal)] hover:text-[var(--cardinal)] disabled:opacity-60">
                {busy === "delete" ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        )}
        {resume && skills.length > 0 && (
          <ul
            aria-label="Skills from your resume"
            title={skills.join(", ")}
            className="flex flex-wrap gap-1.5 lg:max-h-[26px] lg:overflow-hidden lg:[mask-image:linear-gradient(to_right,black_85%,transparent)]"
          >
            {skills.map((s) => (
              <li key={s} className="whitespace-nowrap rounded-full bg-[var(--background)] px-2.5 py-1 text-[12px] font-medium">{s}</li>
            ))}
          </ul>
        )}
        {error && <p role="alert" className="text-[14px] text-[var(--danger)]">{error}</p>}
      </div>

      {actions}
    </section>
  );
}
