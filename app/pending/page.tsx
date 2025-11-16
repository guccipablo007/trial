"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Link from "next/link";

export default function PendingApprovalPage() {
  const [status, setStatus] = useState<"pending" | "active" | "unknown">("unknown");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) setStatus("pending");
        return;
      }
      const { data } = await supabase.from("profiles").select("status").eq("id", user.id).maybeSingle();
      if (!cancelled) {
        if (data?.status === "active") {
          setStatus("active");
        } else {
          setStatus("pending");
          await supabase.auth.signOut();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === "active") {
    return (
      <div style={{ padding: 24 }}>
        <div className="card" style={{ maxWidth: 520, margin: "40px auto", padding: 32, textAlign: "center" }}>
          <h2>You're all set!</h2>
          <p>Your account is active. Continue to the dashboard.</p>
          <Link href="/" className="btn primary">Go to dashboard</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <div className="card" style={{ maxWidth: 520, margin: "40px auto", padding: 32, textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>⏳</div>
        <h2>Pending Admin Approval</h2>
        <p style={{ margin: "12px 0" }}>
          Thanks for confirming your email. An administrator still needs to review and activate your account before you can sign in.
        </p>
        <p className="muted" style={{ marginBottom: 24 }}>
          We’ll notify the admins automatically. You’ll be able to log in as soon as your status is changed to active.
        </p>
        <Link href="/login" className="btn">Back to Login</Link>
      </div>
    </div>
  );
}

