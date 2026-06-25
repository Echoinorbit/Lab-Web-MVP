import { NextResponse } from "next/server";

import { saveDraft } from "@/features/posts/actions/save-draft";

export async function POST(request: Request) {
  const draft = await saveDraft(await request.json().catch(() => ({})));
  return NextResponse.json(draft);
}
