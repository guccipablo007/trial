import "../styles/globals.css";
import Link from "next/link";
import AuthStatus from "@/components/AuthStatus";
import NavAuth from "@/components/NavAuth";
import AuthGate from "@/components/AuthGate";
import dynamic from "next/dynamic";
const Sidebar = dynamic(() => import("@/components/Sidebar"), { ssr: false });
import type { ReactNode } from "react";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthStatus />
        <AuthGate />
        <div className="shell">
          <Sidebar />
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  );
}
