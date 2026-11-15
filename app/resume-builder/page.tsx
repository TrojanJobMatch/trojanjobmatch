"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Wordmark } from "@/components/auth/AuthShell";
import { ResumeDocument } from "@/components/resume/ResumeDocument";
import { ScaledPage } from "@/components/resume/ScaledPage";
import {
  emptyEducation,
  emptyExperience,
  emptyProject,
  emptyResume,
  emptySkill,
  hasContent,
  RESUME_STYLES,
  SAMPLE_RESUME,
  type ResumeData,
  type ResumeStyle,
} from "@/lib/resume/types";

type ListKey = "education" | "experience" | "projects" | "skills";
const MAKERS = { education: emptyEducation, experience: emptyExperience, projects: emptyProject, skills: emptySkill };

function Field({ label, value, onChange, placeholder, area }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; area?: boolean }) {
  return (
    <label className="flex flex-col gap-1 text-[13px] font-semibold">
      {label}
      {area ? (
        <textarea className="input min-h-[96px] py-2 text-[15px] font-normal leading-snug" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      ) : (
        <input className="input text-[15px] font-normal" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      )}
    </label>
  );
}

function Card({ title, children, onAdd, addLabel }: { title: string; children: React.ReactNode; onAdd?: () => void; addLabel?: string }) {
  return (
    <section className="card p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-heading text-[17px]">{title}</h2>
        {onAdd && (
          <button type="button" onClick={onAdd} className="flex items-center gap-1 rounded-full bg-[var(--gold)] px-3 py-1.5 text-[13px] font-bold text-black">
            <span className="text-[16px] leading-none">+</span> {addLabel}
          </button>
        )}
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

function AiButton({ busy, onClick, id, children }: { busy: string | null; onClick: () => void; id: string; children: React.ReactNode }) {
  return (
    <button type="button" disabled={busy !== null} onClick={onClick} className="self-start rounded-full border border-[var(--cardinal)] px-3 py-1.5 text-[13px] font-semibold text-[var(--cardinal)] disabled:opacity-50">
      {busy === id ? "Resume Coach is working…" : children}
    </button>
  );
}

export default function ResumeBuilderPage() {
  const router = useRouter();
  const [step, setStep] = useState<"style" | "details">("style");
  const [style, setStyle] = useState<ResumeStyle>("jake");
  const [data, setData] = useState<ResumeData>(emptyResume());
  const [source, setSource] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/resume/draft")
      .then((res) => {
        if (res.status === 401) {
          router.push("/login");
          return null;
        }
        return res.json();
      })
      .then((d) => {
        if (!d || typeof d !== "object") return;
        setData(d.data);
        setStyle(d.style);
        setSource(d.source);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [router]);

  const set = (key: keyof ResumeData) => (value: string) => setData((d) => ({ ...d, [key]: value }));
  function setItem<K extends ListKey>(list: K, index: number, key: string, value: string) {
    setData((d) => ({ ...d, [list]: (d[list] as unknown as Record<string, string>[]).map((item, i) => (i === index ? { ...item, [key]: value } : item)) }));
  }
  const add = (list: ListKey) => setData((d) => ({ ...d, [list]: [...d[list], MAKERS[list]()] }));
  const remove = (list: ListKey, index: number) =>
    setData((d) => ({ ...d, [list]: d[list].length > 1 ? d[list].filter((_, i) => i !== index) : [MAKERS[list]()] }));

  async function save(quiet = false) {
    await fetch("/api/resume/draft", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ style, data }) });
    if (!quiet) setNote("Saved to your account.");
  }

  async function refill() {
    setBusy("fill");
    setNote(null);
    const d = await fetch("/api/resume/draft?fresh=1").then((r) => r.json()).catch(() => null);
    if (d?.data) {
      setData(d.data);
      setSource(d.source);
      setNote(d.source === "resume" ? "Filled from your uploaded resume." : "No uploaded resume found; fill the form below.");
    }
    setBusy(null);
  }

  async function improve(list: "experience" | "projects", index: number) {
    const item = data[list][index] as unknown as Record<string, string>;
    setBusy(`${list}-${index}`);
    setNote(null);
    const res = await fetch("/api/resume/improve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bullets: item.bullets, context: item.title || item.name || "" }),
    });
    const out = await res.json().catch(() => ({}));
    if (res.ok) setItem(list, index, "bullets", out.bullets);
    else setNote(out.error ?? "Couldn't improve that.");
    setBusy(null);
  }

  async function writeSummary() {
    setBusy("summary");
    setNote(null);
    const res = await fetch("/api/resume/summary", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data }) });
    const out = await res.json().catch(() => ({}));
    if (res.ok) setData((d) => ({ ...d, summary: out.summary }));
    else setNote(out.error ?? "Couldn't write the summary.");
    setBusy(null);
  }

  async function download() {
    await save(true);
    const before = document.title;
    document.title = `${(data.name || "Resume").replace(/\s+/g, "_")}_Resume`;
    window.print();
    document.title = before;
  }

  return (
    <div className="min-h-screen">
      <header className="no-print bg-[var(--cardinal-deep)] py-4 text-white">
        <div className="container-tm flex items-center justify-between gap-3">
          <Link href="/dashboard">
            <Wordmark className="text-[18px] sm:text-[22px]" />
          </Link>
          <Link href="/dashboard" className="rounded-full border border-white/40 px-4 py-2 text-[14px] font-semibold hover:bg-white/10">
            ← Dashboard
          </Link>
        </div>
      </header>

      <main className="no-print mx-auto w-full max-w-[1240px] px-4 pb-8 pt-6 sm:px-6 sm:pt-8">
        <h1 className="font-display text-[28px] uppercase leading-none sm:text-[36px]">
          Build your <span className="text-[var(--cardinal)]">resume</span>
        </h1>
        <p className="mt-2 text-[15px] text-[var(--muted)]">
          {step === "style" ? "Step 1 of 2: pick a template. You can switch any time." : "Step 2 of 2: check your details, let the Resume Coach polish them, then download."}
        </p>

        {step === "style" ? (
          // Both rows of 5 fit on one screen: the grid's width follows the
          // screen height (each page keeps its US Letter shape).
          <div className="mx-auto mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:max-w-[calc(193svh-560px)] lg:grid-cols-5">
            {RESUME_STYLES.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => {
                  setStyle(s.key);
                  setStep("details");
                }}
                className={`card group flex flex-col overflow-hidden text-left transition hover:-translate-y-1 hover:shadow-lg ${style === s.key ? "ring-2 ring-[var(--cardinal)]" : ""}`}
              >
                <div className="border-b border-[var(--border)]">
                  <ScaledPage>
                    <ResumeDocument data={!loading && hasContent(data) ? data : SAMPLE_RESUME} style={s.key} />
                  </ScaledPage>
                </div>
                <div className="flex items-center justify-between gap-2 px-3 py-2">
                  <p className="font-heading text-[14px]">{s.name}</p>
                  <span className="text-[12px] font-semibold text-[var(--cardinal)] opacity-0 transition group-hover:opacity-100">Use →</span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_430px]">
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => setStep("style")} className="btn btn-secondary min-h-[40px] px-4 text-[14px]">
                  {RESUME_STYLES.find((s) => s.key === style)?.name} ▾
                </button>
                <button type="button" disabled={busy !== null} onClick={refill} className="btn btn-secondary min-h-[40px] px-4 text-[14px]">
                  {busy === "fill" ? "Reading your resume…" : "↻ Fill from my uploaded resume"}
                </button>
                {source === "resume" && <span className="text-[13px] text-[var(--muted)]">Pre-filled from your resume. Check every field.</span>}
              </div>
              {note && <p className="text-[14px] font-semibold text-[var(--cardinal)]">{note}</p>}

              <Card title="Contact">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Full name" value={data.name} onChange={set("name")} />
                  <Field label="Email" value={data.email} onChange={set("email")} placeholder="you@usc.edu" />
                  <Field label="Phone" value={data.phone} onChange={set("phone")} placeholder="+1 213 555 1234" />
                  <Field label="City, State" value={data.location} onChange={set("location")} placeholder="Los Angeles, CA" />
                  <Field label="LinkedIn" value={data.linkedin} onChange={set("linkedin")} placeholder="linkedin.com/in/you" />
                  <Field label="GitHub" value={data.github} onChange={set("github")} placeholder="github.com/you" />
                  <Field label="Portfolio / website (optional)" value={data.website} onChange={set("website")} />
                </div>
              </Card>

              <Card title="Education" onAdd={() => add("education")} addLabel="Education">
                {data.education.map((e, i) => (
                  <div key={i} className="grid grid-cols-1 gap-3 rounded-xl border border-[var(--border)] p-3 sm:grid-cols-2">
                    <Field label="School" value={e.school} onChange={(v) => setItem("education", i, "school", v)} placeholder="University of Southern California" />
                    <Field label="Degree" value={e.degree} onChange={(v) => setItem("education", i, "degree", v)} placeholder="M.S. Computer Science" />
                    <Field label="Location" value={e.location} onChange={(v) => setItem("education", i, "location", v)} />
                    <Field label="GPA (optional)" value={e.gpa} onChange={(v) => setItem("education", i, "gpa", v)} />
                    <Field label="Start" value={e.start} onChange={(v) => setItem("education", i, "start", v)} placeholder="Aug 2026" />
                    <Field label="End / expected" value={e.end} onChange={(v) => setItem("education", i, "end", v)} placeholder="May 2028" />
                    <div className="sm:col-span-2">
                      <Field label="Relevant coursework (optional)" value={e.coursework} onChange={(v) => setItem("education", i, "coursework", v)} />
                    </div>
                    <button type="button" onClick={() => remove("education", i)} className="justify-self-start text-[13px] font-semibold text-[var(--danger)]">Remove</button>
                  </div>
                ))}
              </Card>

              <Card title="Experience" onAdd={() => add("experience")} addLabel="Experience">
                {data.experience.map((e, i) => (
                  <div key={i} className="grid grid-cols-1 gap-3 rounded-xl border border-[var(--border)] p-3 sm:grid-cols-2">
                    <Field label="Job title" value={e.title} onChange={(v) => setItem("experience", i, "title", v)} />
                    <Field label="Company" value={e.company} onChange={(v) => setItem("experience", i, "company", v)} />
                    <Field label="Location" value={e.location} onChange={(v) => setItem("experience", i, "location", v)} />
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Start" value={e.start} onChange={(v) => setItem("experience", i, "start", v)} />
                      <Field label="End" value={e.end} onChange={(v) => setItem("experience", i, "end", v)} placeholder="Present" />
                    </div>
                    <div className="flex flex-col gap-2 sm:col-span-2">
                      <Field area label="What you did (one point per line)" value={e.bullets} onChange={(v) => setItem("experience", i, "bullets", v)} />
                      <AiButton busy={busy} id={`experience-${i}`} onClick={() => improve("experience", i)}>✨ Improve with AI (keeps your facts)</AiButton>
                    </div>
                    <button type="button" onClick={() => remove("experience", i)} className="justify-self-start text-[13px] font-semibold text-[var(--danger)]">Remove</button>
                  </div>
                ))}
              </Card>

              <Card title="Projects" onAdd={() => add("projects")} addLabel="Project">
                {data.projects.map((p, i) => (
                  <div key={i} className="grid grid-cols-1 gap-3 rounded-xl border border-[var(--border)] p-3 sm:grid-cols-2">
                    <Field label="Project name" value={p.name} onChange={(v) => setItem("projects", i, "name", v)} />
                    <Field label="Tech used" value={p.tech} onChange={(v) => setItem("projects", i, "tech", v)} placeholder="Python, React, PostgreSQL" />
                    <Field label="Link (optional)" value={p.link} onChange={(v) => setItem("projects", i, "link", v)} />
                    <Field label="Dates (optional)" value={p.dates} onChange={(v) => setItem("projects", i, "dates", v)} />
                    <div className="flex flex-col gap-2 sm:col-span-2">
                      <Field area label="What it does / what you built (one point per line)" value={p.bullets} onChange={(v) => setItem("projects", i, "bullets", v)} />
                      <AiButton busy={busy} id={`projects-${i}`} onClick={() => improve("projects", i)}>✨ Improve with AI (keeps your facts)</AiButton>
                    </div>
                    <button type="button" onClick={() => remove("projects", i)} className="justify-self-start text-[13px] font-semibold text-[var(--danger)]">Remove</button>
                  </div>
                ))}
              </Card>

              <Card title="Skills" onAdd={() => add("skills")} addLabel="Skill group">
                {data.skills.map((s, i) => (
                  <div key={i} className="grid grid-cols-1 gap-3 rounded-xl border border-[var(--border)] p-3 sm:grid-cols-[180px_1fr_auto] sm:items-end">
                    <Field label="Category" value={s.category} onChange={(v) => setItem("skills", i, "category", v)} placeholder="Languages" />
                    <Field label="Skills (comma separated)" value={s.items} onChange={(v) => setItem("skills", i, "items", v)} placeholder="Python, Java, SQL" />
                    <button type="button" onClick={() => remove("skills", i)} className="pb-3 text-[13px] font-semibold text-[var(--danger)]">Remove</button>
                  </div>
                ))}
              </Card>

              <Card title="Summary (written last, shown at the top)">
                <p className="text-[14px] text-[var(--muted)]">
                  Fill everything above first. The Resume Coach then reads your whole resume and writes a summary with a strong opening line (who you are) and a strong closing line (what you bring).
                </p>
                <AiButton busy={busy} id="summary" onClick={writeSummary}>✨ Write my summary with AI</AiButton>
                <Field area label="Summary" value={data.summary} onChange={set("summary")} />
              </Card>

              <div className="flex flex-wrap gap-3 pb-4">
                <button type="button" onClick={download} className="btn btn-primary bg-[var(--cardinal-deep)] px-6">⬇ Download PDF</button>
                <button type="button" onClick={() => save()} className="btn btn-secondary px-6">Save draft</button>
              </div>
            </div>

            <aside className="lg:sticky lg:top-4 lg:self-start">
              <p className="mb-2 text-[13px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">Live preview</p>
              <div className="overflow-hidden rounded-xl border border-[var(--border)] shadow-sm">
                <ScaledPage>
                  <ResumeDocument data={data} style={style} />
                </ScaledPage>
              </div>
              <button type="button" onClick={download} className="btn btn-primary mt-3 w-full bg-[var(--cardinal-deep)]">⬇ Download PDF</button>
              <p className="mt-2 text-[12px] text-[var(--muted)]">Choose &ldquo;Save as PDF&rdquo; in the print window. The PDF is real text, so ATS systems can read it.</p>
            </aside>
          </div>
        )}
      </main>

      {/* Only this prints: the full-size resume page. */}
      <div id="resume-print" aria-hidden>
        <ResumeDocument data={data} style={style} />
      </div>
    </div>
  );
}
