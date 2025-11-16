"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const onSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone,
          address,
        },
        emailRedirectTo: typeof window !== 'undefined' ? `${window.location.origin}/pending` : undefined,
      }
    });
    setMessage(error ? error.message : "Signup successful. Check your email to verify. Admin will activate your account.");
  };

  return (
    <div style={{paddingTop:24}}>
      <div style={{display:'flex',alignItems:'center',gap:8,justifyContent:'center',marginBottom:16}}>
        <span style={{fontSize:18}}>📈</span>
        <div style={{fontWeight:700,fontSize:22}}>camsu-connect</div>
      </div>

      <div className="card" style={{maxWidth:620,margin:'0 auto',padding:'28px 24px'}}>
        <h2 style={{margin:'0 0 6px'}}>Create Your Account</h2>
        <div className="muted" style={{marginBottom:16}}>Your account will require activation by an administrator after registration.</div>

        <form onSubmit={onSignup}>
          <label>Full Name</label>
          <input value={fullName} onChange={e=>setFullName(e.target.value)} placeholder="Enter your full name" required />
          <label>Email Address</label>
          <input value={email} onChange={e=>setEmail(e.target.value)} type="email" placeholder="Enter your email address" required />
          <label>Phone Number</label>
          <input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="Enter your phone number" />
          <label>Address</label>
          <input value={address} onChange={e=>setAddress(e.target.value)} placeholder="Enter your street address" />
          <label>Password</label>
          <input value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder="Create a password" required />

          <div className="muted" style={{fontSize:12,marginTop:6}}>By creating an account, you agree to our <a style={{color:'var(--brand-teal)'}} href="#">Terms of Service</a> and <a style={{color:'var(--brand-teal)'}} href="#">Privacy Policy</a>.</div>

          <button className="btn" type="submit" style={{width:'100%',marginTop:12,background:'#1f2340'}}>Submit for Review</button>
        </form>

        <div style={{textAlign:'center',marginTop:10}}>Already have an account? <a href="/login" style={{color:'var(--brand-teal)'}}>Log In</a></div>
        {message && <p style={{marginTop:8}}>{message}</p>}
      </div>
    </div>
  );
}
