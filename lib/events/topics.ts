// Interest categories a student can pick, and the resume skills that hint at
// each one. The same keys tag every event, so "interest" and "skill" matching
// both land on one shared vocabulary.
export const TOPICS = [
  { key: "ai", label: "AI & Machine Learning", terms: ["machine learning", "deep learning", "pytorch", "tensorflow", "llm", "llms", "nlp", "computer vision", "rag", "langchain", "scikit learn", "ai", "generative ai", "genai", "openai", "neural networks", "reinforcement learning"] },
  { key: "software", label: "Software & Engineering", terms: ["python", "java", "javascript", "typescript", "react", "node", "node js", "next js", "c++", "c", "go", "rust", "swift", "kotlin", "html", "css", "git", "docker", "aws", "backend", "frontend", "full stack", "api", "apis", "kubernetes", "linux"] },
  { key: "data", label: "Data & Analytics", terms: ["sql", "pandas", "numpy", "tableau", "power bi", "statistics", "r", "spark", "data analysis", "data science", "etl", "excel", "analytics", "data visualization"] },
  { key: "security", label: "Cybersecurity", terms: ["cybersecurity", "security", "penetration testing", "cryptography", "networking", "infosec"] },
  { key: "math", label: "Math & Theory", terms: ["mathematics", "calculus", "linear algebra", "combinatorics", "optimization", "probability", "matlab", "latex"] },
  { key: "research", label: "Research & Talks", terms: ["research", "lab", "publications", "thesis", "matlab", "latex", "academic writing"] },
  { key: "careers", label: "Careers & Networking", terms: ["internship", "leadership", "teamwork", "communication", "networking"] },
  { key: "business", label: "Business & Entrepreneurship", terms: ["marketing", "sales", "finance", "accounting", "consulting", "product management", "entrepreneurship", "strategy", "business development", "startups", "operations"] },
  { key: "design", label: "Design & Creative Tech", terms: ["figma", "ux", "ui", "ux design", "photoshop", "illustrator", "sketch", "adobe", "graphic design", "prototyping"] },
  { key: "media", label: "Media & Journalism", terms: ["journalism", "writing", "video editing", "premiere", "photography", "content creation", "social media", "podcasting", "film", "storytelling"] },
  { key: "arts", label: "Arts & Performance", terms: ["music", "piano", "violin", "guitar", "theatre", "theater", "acting", "dance", "painting", "singing", "drawing"] },
  { key: "health", label: "Health & Science", terms: ["biology", "public health", "healthcare", "clinical", "neuroscience", "nursing", "chemistry", "biotech", "medicine"] },
  { key: "sustainability", label: "Sustainability", terms: ["sustainability", "environmental", "climate", "renewable energy", "recycling"] },
  { key: "campus", label: "Campus Life & Sports", terms: ["volunteering", "club", "sports", "soccer", "basketball", "running", "fitness"] },
] as const;

export type TopicKey = (typeof TOPICS)[number]["key"];

export const TOPIC_LABELS: Record<string, string> = Object.fromEntries(TOPICS.map((t) => [t.key, t.label]));

export function isTopicKey(value: unknown): value is TopicKey {
  return typeof value === "string" && TOPICS.some((t) => t.key === value);
}

/** Keep only valid topic keys, de-duplicated, in the order given. */
export function normalizeInterests(value: unknown): TopicKey[] {
  const raw = Array.isArray(value) ? value : [];
  return [...new Set(raw.filter(isTopicKey))];
}
