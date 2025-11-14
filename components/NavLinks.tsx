"use client";
import Link from "next/link";
import { useProfile } from "@/components/useProfile";

export default function NavLinks(){
  const { profile } = useProfile();
  const role = profile?.role;
  return (
    <>
      <Link href="/">Dashboard</Link>
      <Link href="/members">Members</Link>
      <Link href="/finance">Finance</Link>
      <Link href="/projects">Projects</Link>
      <Link href="/announcements">Announcements</Link>
      <Link href="/attendance">Attendance</Link>
      <Link href="/meetings">Meetings</Link>
      <Link href="/notifications">Notifications</Link>
      {role === 'system_admin' && <Link href="/admin">Admin</Link>}
    </>
  );
}
