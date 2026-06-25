import { NextResponse } from "next/server";

import { changePassword } from "@/features/auth";

export async function POST(request: Request) {
  await changePassword(await request.json());
  return NextResponse.json({ ok: true });
}
