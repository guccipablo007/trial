"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useProfile } from "@/components/useProfile";

export default function AdminPage(){
  const { profile } = useProfile();
  const isAdmin = profile?.role === 'system_admin';
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [message, setMessage] = useState<string|null>(null);

  const setUserRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    const { error } = await supabase.rpc('admin_set_user_role_by_email', { target_email: email, new_role: role });
    setMessage(error ? error.message : "Role updated");
  };

  return (
    <div>
      <h1>Admin</h1>
      {!isAdmin && <div className="card">You must be a system admin to use this page.</div>}
      {isAdmin && (
      <form onSubmit={setUserRole} className="card" style={{maxWidth:560}}>
        <h3>Set user role</h3>
        <label>User Email</label>
        <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="user@example.com" />
        <label>Role</label>
        <select value={role} onChange={e=>setRole(e.target.value)}>
          <option value="member">member</option>
          <option value="secretary">secretary</option>
          <option value="system_admin">system_admin</option>
        </select>
        <button className="btn" type="submit">Update role</button>
        {message && <p>{message}</p>}
      </form>
      )}
    </div>
  );
}
