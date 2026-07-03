import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserHistory } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const history = await getUserHistory(session.user.email);
    return NextResponse.json({ history });
  } catch (err: any) {
    console.error("History error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to load history" },
      { status: 500 }
    );
  }
}
