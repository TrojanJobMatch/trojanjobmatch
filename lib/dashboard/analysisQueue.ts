import type { Analysis } from "@/lib/ai/analyze";

// Browser-side queue for the automatic "AI fit" on every job card. Cards ask
// for their analysis when they scroll into view; only a few requests run at
// once so a long feed doesn't flood the AI. Once the server says there is no
// resume, the rest are skipped until the feed reloads.
const MAX_ACTIVE = 2;

export type AnalysisOutcome =
  | { kind: "ok"; analysis: Analysis }
  | { kind: "error"; message: string }
  | { kind: "no_resume"; message: string }
  | { kind: "cancelled" };

const NO_RESUME = "Upload your resume to see your AI fit for each job.";

let active = 0;
let noResume = false;
const waiting: (() => void)[] = [];

/** Called when the feed reloads (new resume, new filters): try again. */
export function resetAnalysisQueue() {
  noResume = false;
}

export async function requestAnalysis(jobId: number, signal: AbortSignal): Promise<AnalysisOutcome> {
  if (active >= MAX_ACTIVE) await new Promise<void>((resolve) => waiting.push(resolve));
  active++;
  try {
    // The card may have left the page, or an earlier card found there is no resume.
    if (signal.aborted) return { kind: "cancelled" };
    if (noResume) return { kind: "no_resume", message: NO_RESUME };
    const res = await fetch(`/api/dashboard/jobs/${jobId}/analyze`, { method: "POST", signal });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.analysis) return { kind: "ok", analysis: data.analysis };
    if (data.needResume) {
      noResume = true;
      return { kind: "no_resume", message: NO_RESUME };
    }
    return { kind: "error", message: data.error ?? "AI fit isn't available right now." };
  } catch {
    return signal.aborted ? { kind: "cancelled" } : { kind: "error", message: "Network error." };
  } finally {
    active--;
    waiting.shift()?.();
  }
}
