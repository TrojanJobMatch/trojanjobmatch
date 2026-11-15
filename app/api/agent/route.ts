import { NextRequest, NextResponse } from "next/server";

import { FUNCTION_DECLARATIONS, PREFERENCE_QUESTIONS, runTool, TOOL_AGENT, type AgentJob } from "@/lib/ai/agentTools";
import { NoResumeError } from "@/lib/ai/analyze";
import { loadResume } from "@/lib/ai/resume";
import { GeminiError, geminiGenerate, type GeminiContent, type GeminiPart } from "@/lib/ai/gemini";
import { requireSession } from "@/lib/auth/session";
import { findUserById } from "@/lib/auth/users";

export const maxDuration = 60;
const MAX_ROUNDS = 5;

const SYSTEM = `You are JobMatch Agent, the coordinator of a small team of AI agents inside Trojan JobMatch, a job helper for USC students:
- Scout (search_jobs) finds roles in the shared job feed.
- Resume Reader (get_my_profile) knows the student's own resume.
- Analyst (analyze_job) judges fit and eligibility for one job against the resume.
- Tracker (list_my_jobs, save_job, hide_job) manages the student's lists.
Plan, call tools, then answer.
Before searching for jobs, you need two things: the job type (internship, full-time, or all) and the timeline/season (spring, summer, fall, winter, or all). If the student asks for jobs and has not said BOTH in this chat, call ask_job_preferences and nothing else. Once they answer, search right away with those filters ("All of the above" means leave that filter out) and do not ask again in this chat. Use get_my_profile first when the request depends on the student's background, and pick search filters from it (domain, role type).
Analyze at most 3 jobs per request, the most promising ones. Only save or hide jobs when the student asks.
You never apply to jobs or contact employers: the student applies themselves.
Never claim the student has a skill that is not in their resume.
Talk like a warm, upbeat USC career buddy: reply naturally to greetings and small talk (say hi back, ask what they're looking for), and keep the conversation going with one helpful follow-up question when it fits.
Answer in a short, friendly way (under 120 words), with bullet points when listing jobs, and mention job ids as #id.`;

interface Step {
  agent: string;
  text: string;
}

export async function POST(request: NextRequest) {
  const userId = await requireSession(request);
  const user = userId ? await findUserById(userId) : null;
  if (!userId || !user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const message = typeof body?.message === "string" ? body.message.trim().slice(0, 1000) : "";
  if (!message) return NextResponse.json({ error: "Ask me something" }, { status: 400 });
  const history: GeminiContent[] = Array.isArray(body?.history)
    ? body.history
        .filter((h: { role?: string; text?: string }) => (h.role === "user" || h.role === "model") && typeof h.text === "string")
        .slice(-6)
        .map((h: { role: "user" | "model"; text: string }) => ({ role: h.role, parts: [{ text: h.text.slice(0, 2000) }] }))
    : [];

  // Without a resume the agent still talks with the student (greetings,
  // career questions, browsing jobs); only resume-based steps are off.
  const hasResume = Boolean(await loadResume(userId));
  const resumeNote = hasResume
    ? "The student has uploaded a resume."
    : "The student has NOT uploaded a resume yet. Still chat normally: greet them, answer career, resume and job-search questions, and search or list jobs. Do not call get_my_profile or analyze_job. When an answer needs their background (fit, matching, missing skills), say in one short line that uploading a resume in the Your resume card (or using Build my resume) unlocks it.";

  const tools = hasResume
    ? FUNCTION_DECLARATIONS
    : FUNCTION_DECLARATIONS.filter((t) => t.name !== "get_my_profile" && t.name !== "analyze_job");

  const contents: GeminiContent[] = [...history, { role: "user", parts: [{ text: message }] }];
  const steps: Step[] = [];
  const jobsById = new Map<number, AgentJob>();

  try {
    for (let round = 0; round <= MAX_ROUNDS; round++) {
      const reply = await geminiGenerate({
        systemInstruction: { parts: [{ text: `${SYSTEM}\nThe student's name is ${user.name}. ${resumeNote}` }] },
        contents,
        tools: round < MAX_ROUNDS ? [{ functionDeclarations: tools }] : undefined,
        generationConfig: { temperature: 0.3 },
      });
      contents.push(reply);
      const calls = reply.parts.filter((p): p is Extract<GeminiPart, { functionCall: unknown }> => "functionCall" in p);
      // Clarifying questions end the turn: the student answers with buttons.
      if (calls.some((c) => c.functionCall.name === "ask_job_preferences")) {
        steps.push({ agent: "JobMatch Agent", text: "Asking what you're looking for" });
        return NextResponse.json({
          reply: `Quick questions so I pull the right jobs: ${PREFERENCE_QUESTIONS.map((q) => q.question).join(" ")}`,
          questions: PREFERENCE_QUESTIONS,
          steps,
          jobs: [],
        });
      }
      if (calls.length === 0) {
        const text = reply.parts.map((p) => ("text" in p ? p.text : "")).join("").trim();
        return NextResponse.json({ reply: text || "Done.", steps, jobs: [...jobsById.values()].slice(0, 10) });
      }
      const responses: GeminiPart[] = [];
      for (const call of calls) {
        const { name, args } = call.functionCall;
        let data: Record<string, unknown>;
        try {
          const result = await runTool(userId, name, args ?? {});
          steps.push({ agent: TOOL_AGENT[name] ?? "Agent", text: result.summary });
          result.jobs?.forEach((j) => jobsById.set(j.id, j));
          data = result.data;
        } catch (error) {
          const text = error instanceof NoResumeError || error instanceof GeminiError ? error.message : "That step failed.";
          steps.push({ agent: TOOL_AGENT[name] ?? "Agent", text });
          data = { error: text };
        }
        responses.push({ functionResponse: { name, response: data } });
      }
      contents.push({ role: "user", parts: responses });
    }
  } catch (error) {
    const text = error instanceof GeminiError ? error.message : "The agent hit a problem. Try again.";
    return NextResponse.json({ error: text, steps }, { status: 502 });
  }
  return NextResponse.json({ reply: "I ran out of steps. Try a narrower request.", steps, jobs: [...jobsById.values()] });
}
