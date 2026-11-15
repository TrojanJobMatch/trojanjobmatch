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
    <div className="grid grid-cols-2 gap-2 md:grid-cols-1">
      <button
        type="button"
        onClick={evaluate}
        disabled={busy !== null}
        className="min-h-[44px] rounded-full bg-[var(--cardinal-deep)] px-4 text-[14px] font-bold text-white transition hover:bg-[var(--cardinal)] disabled:opacity-60"
      >
        🔎 Evaluate my resume
      </button>
      <a
        href="/resume-builder"
        className="flex min-h-[44px] items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card)] px-4 text-[14px] font-bold text-[var(--foreground)] transition hover:border-[var(--cardinal)] hover:text-[var(--cardinal)]"
      >
        ✍️ Build my resume
      </a>
    </div>
  );

  return (
    <section className="card flex h-full flex-col gap-3 p-4 sm:p-5">
      {fileInput}
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-heading text-[18px]">Your resume</h2>
        <span className="text-[12px] text-[var(--muted)]">🔒 Private to you</span>
      </div>

      {!loaded ? (
        <p className="text-[15px] text-[var(--muted)] md:flex-1">Loading…</p>
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
          className={`flex w-full flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed px-4 py-6 text-center transition md:min-h-0 md:flex-1 ${
            dragging ? "border-[var(--cardinal)] bg-[#fff5f5]" : "border-[#c9c9cc] bg-[var(--background)] hover:border-[var(--cardinal)]"
          }`}
        >
          {busy === "upload" ? (
            <>
              <span className="text-[16px] font-semibold">Resume Reader agent is reading your resume…</span>
              <span className="text-[14px] text-[var(--muted)]">Pulling out your skills, education and projects (about 10 seconds)</span>
            </>
          ) : (
            <>
              <span aria-hidden className="text-[30px] leading-none">📄</span>
              <span className="text-[16px] font-semibold">Upload your resume (PDF)</span>
              <span className="max-w-[300px] text-[14px] text-[var(--muted)]">Drop it here or click. Then press Evaluate and five AI agents review it like a recruiter.</span>
            </>
          )}
        </button>
      ) : (
        <div className="flex flex-col gap-2 rounded-2xl bg-[var(--background)] p-3">
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold">📄 {resume.file_name}</p>
            <p className="text-[14px] text-[var(--muted)]">
              {[resume.profile.degree, resume.profile.school, resume.profile.grad_date].filter(Boolean).join(" · ") || "Resume on file"}
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" disabled={busy !== null} onClick={() => inputRef.current?.click()} className="rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-[13px] font-semibold transition hover:border-[var(--cardinal)] hover:text-[var(--cardinal)] disabled:opacity-60">
              Replace
            </button>
            <button type="button" disabled={busy !== null} onClick={remove} className="rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-[13px] font-semibold transition hover:border-[var(--cardinal)] hover:text-[var(--cardinal)] disabled:opacity-60">
              {busy === "delete" ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      )}
      {error && <p role="alert" className="text-[14px] text-[var(--danger)]">{error}</p>}

      {resume && (
        <div className="min-h-0 md:flex-1 md:overflow-y-auto md:pb-2 md:[mask-image:linear-gradient(to_bottom,black_80%,transparent)]">
          {skills.length > 0 && (
            <>
              <h3 className="text-[14px] font-semibold">Skills from your resume</h3>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {skills.map((s) => (
                  <li key={s} className="rounded-full bg-[var(--background)] px-2.5 py-1 text-[12px] font-medium">{s}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {actions}
    </section>
  );
}
