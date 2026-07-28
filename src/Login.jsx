import React, { useState } from "react";
import { ClipboardList } from "lucide-react";
import { supabase } from "./supabaseClient";

const C = {
  navy: "#001f49", teal: "#00adef", bg: "#f4f7fa", card: "#ffffff",
  line: "#d9e1ea", ink: "#001f49", sub: "#5b6b7a", miss: "#b23b3b",
};

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const signIn = async () => {
    setError("");
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      // Keep the message vague on purpose, so it doesn't reveal whether an
      // email exists. "Invalid login credentials" covers wrong email or password.
      setError("Email or password is incorrect. Please try again.");
    }
    // On success, the App component's auth listener takes over automatically.
  };

  const onKey = (e) => { if (e.key === "Enter" && email && password) signIn(); };

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: C.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 28 }}>
          <img src="/logo-navy.svg" alt="Harcourts" style={{ height: 56 }} />
          <div style={{
            fontFamily: "'Source Sans 3', 'Source Sans Pro', system-ui, sans-serif",
            fontWeight: 300,
            fontSize: 53,
            lineHeight: 1,
            color: C.teal,
            marginTop: 5,
            letterSpacing: "0.005em",
          }}>Patras &amp; Co</div>
          <span style={{
            fontFamily: "'Source Sans 3', 'Source Sans Pro', system-ui, sans-serif",
            fontWeight: 700,
            fontSize: 17,
            color: C.navy,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            marginTop: 16,
          }}>TaskProof</span>
        </div>

        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: 26 }}>
          <div style={{ fontSize: 17, fontWeight: 600, color: C.ink, marginBottom: 4 }}>Sign in</div>
          <div style={{ fontSize: 13, color: C.sub, marginBottom: 20 }}>Harcourts Patras &amp; Co</div>

          <label style={{ fontSize: 13, fontWeight: 600, color: C.sub, display: "block", marginBottom: 6 }}>Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={onKey} type="email" placeholder="you@patrasandco.nz"
            style={{ width: "100%", padding: "10px 12px", border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 14, marginBottom: 16, boxSizing: "border-box" }} />

          <label style={{ fontSize: 13, fontWeight: 600, color: C.sub, display: "block", marginBottom: 6 }}>Password</label>
          <input value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={onKey} type="password" placeholder="Your password"
            style={{ width: "100%", padding: "10px 12px", border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 14, marginBottom: 18, boxSizing: "border-box" }} />

          {error && (
            <div style={{ background: "#fbe9e9", color: C.miss, fontSize: 13, padding: "9px 12px", borderRadius: 8, marginBottom: 16 }}>{error}</div>
          )}

          <button onClick={signIn} disabled={busy || !email || !password}
            style={{ width: "100%", background: C.teal, color: "#fff", border: "none", padding: "11px 0", borderRadius: 9, fontWeight: 600, fontSize: 14, cursor: busy ? "default" : "pointer", opacity: busy || !email || !password ? 0.6 : 1 }}>
            {busy ? "Signing in…" : "Sign in"}
          </button>

          <div style={{ fontSize: 12, color: C.sub, marginTop: 16, textAlign: "center", lineHeight: 1.5 }}>
            No account? Ask the office to set one up for you.
          </div>
        </div>
      </div>
    </div>
  );
}
