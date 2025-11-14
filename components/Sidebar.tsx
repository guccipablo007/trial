"use client";
import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";

type ItemProps = {
  href: Route;
  icon: string;
  label: string;
};

function Item({ href, icon, label }: ItemProps) {
  const pathname = usePathname();
  const active = pathname === href;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <Link className={`sidelink ${active ? "active" : ""}`} href={href}>
        {icon}
      </Link>
      <span>{label}</span>
    </div>
  );
}

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="logo-circle">CC</div>
      <Item href="/" icon="H" label="Home" />
      <Item href="/members" icon="M" label="Members" />
      <Item href="/projects" icon="P" label="Projects" />
      <Item href="/finance" icon="F" label="Finance" />
      <Item href="/attendance" icon="A" label="Attendance" />
      <Item href="/announcements" icon="N" label="News" />
      <Item href="/meetings" icon="Mt" label="Meetings" />
      <Item href="/notifications" icon="Al" label="Alerts" />
    </aside>
  );
}
