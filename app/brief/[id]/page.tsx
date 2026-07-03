import { getServerSession } from "next-auth";
import { authOptions, isAdminSession } from "@/lib/auth";
import { getBriefById, getAdminBriefById } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import { Masthead } from "@/components/Masthead";
import { BriefRenderer } from "@/components/BriefRenderer";

export default async function BriefPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    redirect("/signin");
  }

  const id = parseInt(params.id, 10);
  if (isNaN(id)) notFound();

  // Try own brief first; if admin and not found, try admin lookup
  let brief = await getBriefById(id, session.user.email);
  if (!brief && isAdminSession(session)) {
    brief = await getAdminBriefById(id);
  }

  if (!brief) notFound();

  return (
    <div className="frame">
      <Masthead adminEmails={isAdminSession(session) ? [session.user.email.toLowerCase()] : []} />

      <section style={{ marginBottom: 40 }}>
        <div className="hero-kicker">Archived Brief</div>
        <h1>
          {brief.school_name}
        </h1>
        <p style={{ fontSize: 15, color: "#4A5568", marginTop: 10 }}>
          {brief.school_location} · {new Date(brief.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
          {brief.franchisee_name ? ` · Prepared for ${brief.franchisee_name}` : ""}
        </p>
      </section>

      <BriefRenderer
        data={brief.brief_data}
        schoolName={brief.school_name}
        location={brief.school_location}
        franchiseeName={brief.franchisee_name || ""}
      />
    </div>
  );
}
