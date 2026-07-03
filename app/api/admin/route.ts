import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isAdminSession } from "@/lib/auth";
import { getAllRequests, getUsageStats } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdminSession(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const [stats, requests] = await Promise.all([
      getUsageStats(),
      getAllRequests(200),
    ]);
    return NextResponse.json({ stats, requests });
  } catch (err: any) {
    console.error("Admin error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to load admin data" },
      { status: 500 }
    );
  }
}
