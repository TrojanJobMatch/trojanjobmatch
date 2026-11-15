import { hasWord, norm } from "./text";
import { TOPICS } from "./topics";

// Pulls skills out of resume text with a built-in word list, so the demo
// needs no AI key and no database. The list is every skill term the event
// matcher already understands, plus a few common extras.
const EXTRA = ["postgresql", "mongodb", "mysql", "golang", "scala", "flask", "django", "fastapi", "vue", "angular", "tailwind", "graphql", "firebase", "azure", "gcp", "tensorflow", "keras", "opencv", "unity", "arduino", "verilog", "robotics", "agile", "scrum", "jira", "notion", "c#"];
// One- and two-letter terms ("c", "r", "go") would match ordinary words.
const DICTIONARY = [...new Set([...TOPICS.flatMap((t) => t.terms), ...EXTRA])].filter((t) => t.length > 2 || ["ai", "ui", "ux"].includes(t));

export function extractSkills(text: string, limit = 30): string[] {
  const padded = ` ${norm(text)} `;
  const found = DICTIONARY.map((term) => ({ term, at: padded.indexOf(` ${norm(term)} `) })).filter(({ at }) => at >= 0);
  return found
    // "node" is redundant when "node js" was found too.
    .filter(({ term }) => !found.some((o) => o.term !== term && hasWord(norm(o.term), norm(term))))
    .sort((a, b) => a.at - b.at) // order of appearance in the resume
    .slice(0, limit)
    .map(({ term }) => term);
}
