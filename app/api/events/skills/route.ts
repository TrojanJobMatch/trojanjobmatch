import { NextRequest, NextResponse } from "next/server";
import { extractText, getDocumentProxy } from "unpdf";

import { extractSkills } from "@/lib/events/extract";

export const maxDuration = 30;
const MAX_BYTES = 4 * 1024 * 1024;

// Demo-mode resume reader: PDF in, skills out. Nothing is stored, no
// database and no AI key needed. The file is read in memory and dropped.
export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a PDF to upload" }, { status: 400 });
  if (file.type !== "application/pdf") return NextResponse.json({ error: "Please upload your resume as a PDF" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "That PDF is over 4 MB" }, { status: 400 });
  let text = "";
  try {
    const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
    text = (await extractText(pdf, { mergePages: true })).text;
  } catch {
    return NextResponse.json({ error: "Couldn't open that PDF. Try exporting it again." }, { status: 400 });
  }
  const skills = extractSkills(text);
  if (skills.length === 0) {
    return NextResponse.json({ error: "No known skills found in that resume. Add some by hand below." }, { status: 422 });
  }
  return NextResponse.json({ skills, fileName: file.name.slice(0, 120) });
}
