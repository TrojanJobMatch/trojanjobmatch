// The resume builder's data. Everything here comes from what the student
// typed or from their own uploaded resume; the AI never adds facts.
export interface Education {
  school: string;
  degree: string;
  location: string;
  start: string;
  end: string;
  gpa: string;
  coursework: string;
}
export interface Experience {
  title: string;
  company: string;
  location: string;
  start: string;
  end: string;
  bullets: string; // one bullet per line
}
export interface Project {
  name: string;
  tech: string;
  link: string;
  dates: string;
  bullets: string;
}
export interface SkillGroup {
  category: string;
  items: string;
}
export interface ResumeData {
  name: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  github: string;
  website: string;
  summary: string;
  education: Education[];
  experience: Experience[];
  projects: Project[];
  skills: SkillGroup[];
}

export const emptyEducation = (): Education => ({ school: "", degree: "", location: "", start: "", end: "", gpa: "", coursework: "" });
export const emptyExperience = (): Experience => ({ title: "", company: "", location: "", start: "", end: "", bullets: "" });
export const emptyProject = (): Project => ({ name: "", tech: "", link: "", dates: "", bullets: "" });
export const emptySkill = (): SkillGroup => ({ category: "", items: "" });

export function emptyResume(): ResumeData {
  return {
    name: "", email: "", phone: "", location: "", linkedin: "", github: "", website: "", summary: "",
    education: [emptyEducation()], experience: [emptyExperience()], projects: [emptyProject()], skills: [emptySkill()],
  };
}

// Coerces anything (AI output, saved JSON) into a complete ResumeData.
export function normalizeResume(raw: unknown): ResumeData {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : Array.isArray(v) ? v.join("\n") : v == null ? "" : String(v)).slice(0, 3000);
  const list = <T,>(v: unknown, make: () => T): T[] => {
    const arr = Array.isArray(v) ? v : [];
    const out = arr.slice(0, 12).map((item) => {
      const base = make() as Record<string, string>;
      const src = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
      for (const k of Object.keys(base)) base[k] = str(src[k]);
      return base as T;
    });
    return out.length ? out : [make()];
  };
  return {
    name: str(r.name), email: str(r.email), phone: str(r.phone), location: str(r.location),
    linkedin: str(r.linkedin), github: str(r.github), website: str(r.website), summary: str(r.summary),
    education: list(r.education, emptyEducation),
    experience: list(r.experience, emptyExperience),
    projects: list(r.projects, emptyProject),
    skills: list(r.skills, emptySkill),
  };
}

// Ten looks modeled on the most-used Overleaf resume templates (our own
// HTML versions, not copies of their LaTeX).
export const RESUME_STYLES = [
  { key: "jake", name: "Template 1" },
  { key: "faang", name: "Template 2" },
  { key: "awesome", name: "Template 3" },
  { key: "moderncv", name: "Template 4" },
  { key: "rendercv", name: "Template 5" },
  { key: "deedy", name: "Template 6" },
  { key: "altacv", name: "Template 7" },
  { key: "harvard", name: "Template 8" },
  { key: "minimal", name: "Template 9" },
  { key: "compact", name: "Template 10" },
] as const;
export type ResumeStyle = (typeof RESUME_STYLES)[number]["key"];

export function isResumeStyle(value: unknown): value is ResumeStyle {
  return RESUME_STYLES.some((s) => s.key === value);
}

// Fictional student used only for style previews when the form is empty.
export const SAMPLE_RESUME: ResumeData = {
  name: "Tommy Trojan",
  email: "tommy@usc.edu",
  phone: "+1 213 555 0100",
  location: "Los Angeles, CA",
  linkedin: "linkedin.com/in/tommytrojan",
  github: "github.com/tommytrojan",
  website: "",
  summary: "M.S. Computer Science student at USC focused on machine learning and backend systems, skilled in Python, PyTorch and SQL. Seeking a software or ML engineering internship.",
  education: [
    { school: "University of Southern California", degree: "M.S. Computer Science", location: "Los Angeles, CA", start: "Aug 2026", end: "May 2028", gpa: "3.8", coursework: "Machine Learning, Algorithms, Databases" },
    { school: "State University", degree: "B.S. Computer Engineering", location: "Austin, TX", start: "2022", end: "2026", gpa: "", coursework: "" },
  ],
  experience: [
    { title: "Software Engineering Intern", company: "Campus Startup", location: "Los Angeles, CA", start: "Jun 2027", end: "Aug 2027", bullets: "Built REST APIs in FastAPI serving 2,000 daily users\nCut PostgreSQL query time by 40% with indexing\nShipped a React dashboard used by 3 teams" },
    { title: "Research Assistant", company: "USC Viterbi Lab", location: "Los Angeles, CA", start: "Jan 2027", end: "Present", bullets: "Trained PyTorch vision models on 50K images\nAutomated experiment tracking with MLflow" },
  ],
  projects: [
    { name: "Course Planner", tech: "Next.js, PostgreSQL", link: "github.com/tommytrojan/planner", dates: "2027", bullets: "Planner used by 300 students to map degree requirements\nDeployed on Vercel with CI tests" },
    { name: "Resume Ranker", tech: "Python, scikit-learn", link: "", dates: "2026", bullets: "Ranked resumes against job posts with TF-IDF and cosine similarity\\nBuilt a Flask API and a small React front end" },
    { name: "Trojan Eats", tech: "React Native, Firebase", link: "", dates: "2026", bullets: "Campus food app with live menus for 5 dining halls\\nAdded push notifications and offline caching" },
  ],
  skills: [
    { category: "Languages", items: "Python, Java, C++, SQL, TypeScript" },
    { category: "Frameworks", items: "PyTorch, FastAPI, React, Next.js" },
    { category: "Tools", items: "Git, Docker, AWS, PostgreSQL, Linux" },
    { category: "AI / ML", items: "scikit-learn, OpenCV, Hugging Face, MLflow" },
  ],
};

export function hasContent(d: ResumeData): boolean {
  return d.experience.some((e) => e.title) || d.projects.some((p) => p.name) || d.education.some((e) => e.school);
}
