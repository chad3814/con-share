import { NextResponse } from "next/server";
import { AuthError, requireUser } from "@/lib/auth-helpers";
import { searchTags } from "@/lib/tags";

export async function GET(request: Request): Promise<Response> {
  try {
    await requireUser();
    const q = new URL(request.url).searchParams.get("q") ?? "";
    const tags = q.trim().length === 0 ? [] : await searchTags(q);
    return NextResponse.json({ tags });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw error;
  }
}
