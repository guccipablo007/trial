"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

function Item({ href, icon, label }: { href: string; icon: string; label: string }){
  const pathname = usePathname();
  const active = pathname === href;
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center'}}>
      <Link className={`sidelink ${active ? 'active':''}`} href={href}>{icon}</Link>
      <span>{label}</span>
    </div>
  );
}

export default function Sidebar(){
  return (
    <aside className="sidebar">
      <div className="logo-circle">CC</div>
      <Item href="/" icon="🏠" label="Home" />
      <Item href="/members" icon="👥" label="Members" />
      <Item href="/projects" icon="📁" label="Projects" />
      <Item href="/finance" icon="💹" label="Finance" />
      <Item href="/attendance" icon="📝" label="Attendance" />
      <Item href="/announcements" icon="📣" label="News" />
      <Item href="/meetings" icon="🗓️" label="Meetings" />
      <Item href="/notifications" icon="🔔" label="Alerts" />
    </aside>
  );
}

