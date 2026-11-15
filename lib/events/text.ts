// Tiny text helpers shared by event matching and resume-skill extraction.
export function norm(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9+#]+/g, " ").trim();
}

export function hasWord(haystack: string, needle: string): boolean {
  return ` ${haystack} `.includes(` ${needle} `);
}
