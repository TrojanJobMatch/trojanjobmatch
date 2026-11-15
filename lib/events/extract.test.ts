import { describe, expect, it } from "vitest";

import { extractSkills } from "./extract";

describe("extractSkills", () => {
  it("finds known skills in resume text, in order of appearance", () => {
    const text = "Built a RAG chatbot with Python and PyTorch. Skills: SQL, Node.js, Figma, C++.";
    expect(extractSkills(text)).toEqual(["rag", "python", "pytorch", "sql", "node js", "figma", "c++"]);
  });

  it("does not read ordinary words as one-letter languages", () => {
    const skills = extractSkills("Go to market strategy for the C suite, R&D lead");
    expect(skills).not.toContain("go");
    expect(skills).not.toContain("c");
    expect(skills).not.toContain("r");
    expect(skills).toContain("strategy");
  });

  it("returns nothing for text with no known skills", () => {
    expect(extractSkills("Worked at a bakery and walked dogs.")).toEqual([]);
  });
});
