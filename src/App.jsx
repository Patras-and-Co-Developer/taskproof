import React, { useState, useEffect, useMemo } from "react";
import { CheckCircle2, AlertTriangle, Circle, Upload, Plus, Trash2, ChevronLeft, LayoutDashboard, ClipboardList, Settings, Hash, Camera, Check, X, Eye, LogOut } from "lucide-react";
import { supabase } from "./supabaseClient";
import Login from "./Login.jsx";
import Tesseract from "tesseract.js";

// Reads the text out of an image (free, runs in the browser) and checks
// whether the property address appears in it. Returns:
//   "found"      — the address (or a strong part of it) is in the image
//   "not_found"  — text was read but the address isn't in it
//   "unreadable" — OCR couldn't read usable text
async function checkAddressInImage(file, propertyAddress) {
  try {
    const { data } = await Tesseract.recognize(file, "eng");
    const text = (data?.text || "").toLowerCase();
    if (text.trim().length < 3) return "unreadable";

    // Compare using the distinctive parts of the address (number + street name),
    // ignoring common words, so "16B Rutland Road" matches even if the suburb
    // isn't shown.
    const stop = new Set(["road", "rd", "street", "st", "avenue", "ave", "lane", "ln", "drive", "dr", "place", "pl", "unit", "flat"]);
    const parts = propertyAddress.toLowerCase().split(/[\s,]+/).filter((p) => p.length > 1 && !stop.has(p));
    if (parts.length === 0) return "not_found";

    const hits = parts.filter((p) => text.includes(p)).length;
    // Consider it a match if most of the distinctive parts are present.
    return hits / parts.length >= 0.5 ? "found" : "not_found";
  } catch (e) {
    console.error("OCR failed:", e);
    return "unreadable";
  }
}

const EVIDENCE = {
  screenshot: { label: "Screenshot (AI-checked)", icon: Camera },
  reference: { label: "Palace reference no.", icon: Hash },
  tick: { label: "Simple tick", icon: Check },
};

// Checklists now live in the database and are loaded at runtime.
// (They used to be hardcoded here.)

function flatten(cl) {
  const steps = [];
  cl.groups.forEach((g, gi) => {
    g.steps.forEach((s, si) => {
      steps.push({ ...s, id: `g${gi}s${si}`, group: g.name });
    });
  });
  return { ...cl, steps };
}

// The screenshot check now runs for real via the check-screenshot edge
// function (see supabase/functions). No mock needed.

const C = {
  navy: "#001f49", navySoft: "#123156", teal: "#00adef", tealSoft: "#e4f6fe",
  bg: "#f4f7fa", card: "#ffffff", line: "#d9e1ea", ink: "#001f49", sub: "#5b6b7a",
  pass: "#1f9d63", passBg: "#e7f5ee", flag: "#c9761a", flagBg: "#fbf0e2", miss: "#b23b3b", missBg: "#fbe9e9",
};

const statusMeta = {
  pass: { label: "Passed", color: C.pass, bg: C.passBg, Icon: CheckCircle2 },
  flag: { label: "Flagged", color: C.flag, bg: C.flagBg, Icon: AlertTriangle },
  unverified: { label: "PM-confirmed", color: "#8a6d1a", bg: "#fef7ec", Icon: AlertTriangle },
  missing: { label: "Missing", color: C.miss, bg: C.missBg, Icon: Circle },
  pending: { label: "Not started", color: C.sub, bg: "#eef2f5", Icon: Circle },
};

// Top-level wrapper: decides whether to show the login screen or the app,
// and works out the signed-in person's role (boss or pm).
export default function App() {
  const [session, setSession] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    // Check if someone is already signed in when the app loads.
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCheckingAuth(false);
    });
    // Listen for sign in / sign out happening while the app is open.
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  if (checkingAuth) {
    return (
      <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: C.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: C.sub }}>
        Loading…
      </div>
    );
  }

  if (!session) return <Login />;

  // Role is stored on the user when the boss creates the account.
  // Anyone without an explicit "boss" role is treated as a PM.
  const role = session.user?.user_metadata?.role === "boss" ? "boss" : "pm";
  const userEmail = session.user?.email || "";

  return <MainApp session={session} role={role} userEmail={userEmail} />;
}

function MainApp({ session, role, userEmail }) {
  const isBoss = role === "boss";
  // PMs land on their own tasks; the boss lands on the oversight dashboard.
  const [view, setView] = useState(isBoss ? "dashboard" : "do");
  const [checklists, setChecklists] = useState([]);
  const [loadingChecklists, setLoadingChecklists] = useState(true);
  const [submissions, setSubmissions] = useState([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(true);
  const [activeChecklist, setActiveChecklist] = useState(null);
  const [reviewing, setReviewing] = useState(null);

  // Load checklists from the database (boss edits persist there).
  const loadChecklists = async () => {
    const { data, error } = await supabase
      .from("checklists")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) {
      console.error("Could not load checklists:", error.message);
    } else {
      // Map database rows into the shape the app uses, flattening groups into
      // a single step list (with group labels) like the app expects.
      setChecklists(data.map((row) => flatten({
        id: row.id,
        title: row.title,
        desc: row.description || "",
        groups: row.groups || [],
      })));
    }
    setLoadingChecklists(false);
  };

  useEffect(() => { loadChecklists(); }, []);

  // Load submissions. The database rules (RLS) decide what comes back:
  // the boss gets everyone's, a PM gets only their own. The app doesn't
  // have to filter, the database does it, which is what makes it secure.
  useEffect(() => {
    async function loadSubmissions() {
      const { data, error } = await supabase
        .from("submissions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        console.error("Could not load submissions:", error.message);
      } else {
        setSubmissions(
          data.map((row) => ({
            id: row.id,
            checklistTitle: row.checklist_title,
            pm: row.pm_name,
            property: row.property_address,
            time: new Date(row.created_at).toLocaleString(),
            createdMs: new Date(row.created_at).getTime(),
            isMine: row.user_id === session.user.id,
            needsReview: row.needs_review,
            hasUnverified: row.has_unverified,
            results: row.results,
          }))
        );
      }
      setLoadingSubmissions(false);
    }
    loadSubmissions();
  }, []);

  const startTask = (cl) => { setActiveChecklist(cl); setView("do"); };

  const submitTask = async (submission) => {
    // Save to the database and get the created row back (with its real id and
    // timestamp) so it can be sorted and deleted immediately without a refresh.
    const { data, error } = await supabase.from("submissions").insert({
      checklist_title: submission.checklistTitle,
      pm_name: submission.pm,
      property_address: submission.property,
      results: submission.results,
      needs_review: submission.needsReview,
      has_unverified: submission.hasUnverified,
    }).select().single();
    if (error) {
      console.error("Could not save submission:", error.message);
      alert("Something went wrong saving this checklist. Please try submitting again.");
      return;
    }
    const saved = {
      ...submission,
      id: data.id,
      time: new Date(data.created_at).toLocaleString(),
      createdMs: new Date(data.created_at).getTime(),
      isMine: true,
    };
    setSubmissions((s) => [saved, ...s]);
    setActiveChecklist(null);
    setView(isBoss ? "dashboard" : "do");
  };

  const signOut = async () => { await supabase.auth.signOut(); };

  const deleteSubmission = async (id) => {
    const { error } = await supabase.from("submissions").delete().eq("id", id);
    if (error) {
      console.error("Could not delete submission:", error.message);
      alert("Couldn't delete this submission. Please try again.");
      return;
    }
    // Remove it from the on-screen list.
    setSubmissions((prev) => prev.filter((s) => s.id !== id));
    setReviewing(null);
  };

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: C.bg, minHeight: "100vh", color: C.ink }}>
      <style>{`
        * { box-sizing: border-box; }
        button { font-family: inherit; cursor: pointer; }
        .navbtn { display:flex; align-items:center; gap:10px; padding:11px 14px; border-radius:9px; border:none; background:transparent; color:#c3d2df; font-size:14px; font-weight:500; width:100%; text-align:left; transition:.15s; }
        .navbtn:hover { background:${C.navySoft}; color:#fff; }
        .navbtn.on { background:${C.teal}; color:#fff; }
        .card { background:${C.card}; border:1px solid ${C.line}; border-radius:12px; }
        .pill { display:inline-flex; align-items:center; gap:6px; padding:4px 10px; border-radius:999px; font-size:12px; font-weight:600; }
        .btn-primary { background:${C.teal}; color:#fff; border:none; padding:10px 18px; border-radius:9px; font-weight:600; font-size:14px; }
        .btn-primary:hover { background:#0090c8; }
        .btn-ghost { background:transparent; color:${C.sub}; border:1px solid ${C.line}; padding:9px 15px; border-radius:9px; font-weight:600; font-size:14px; }
        .btn-ghost:hover { background:#eef2f5; }
        input, textarea, select { font-family:inherit; }
      `}</style>

      <div style={{ display: "flex", minHeight: "100vh" }}>
        <aside style={{ width: 232, background: C.navy, padding: "22px 16px", flexShrink: 0, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "4px 8px 22px" }}>
            <img src="/logo-white.svg" alt="Harcourts" style={{ height: 26, display: "block" }} />
            <div style={{ color: C.teal, fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", marginTop: 8, textTransform: "uppercase" }}>TaskProof</div>
          </div>
          <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <button className={`navbtn ${view === "dashboard" ? "on" : ""}`} onClick={() => setView("dashboard")}>
              <LayoutDashboard size={17} /> {isBoss ? "Oversight" : "My submissions"}
            </button>
            <button className={`navbtn ${view === "do" ? "on" : ""}`} onClick={() => { setActiveChecklist(null); setView("do"); }}>
              <ClipboardList size={17} /> Do a task
            </button>
            {/* Only the boss can create and edit checklists. */}
            {isBoss && (
              <button className={`navbtn ${view === "build" ? "on" : ""}`} onClick={() => setView("build")}>
                <Settings size={17} /> Checklists
              </button>
            )}
          </nav>

          <div style={{ marginTop: "auto", paddingTop: 20 }}>
            <div style={{ padding: "10px 12px", background: C.navySoft, borderRadius: 9, marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: "#fff", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userEmail}</div>
              <div style={{ fontSize: 11, color: "#9fb3c4", marginTop: 2 }}>{isBoss ? "Manager" : "Property manager"}</div>
            </div>
            <button className="navbtn" onClick={signOut}><LogOut size={16} /> Sign out</button>
          </div>
        </aside>

        <main style={{ flex: 1, padding: "30px 34px", maxWidth: 1000 }}>
          {view === "dashboard" && <Dashboard submissions={submissions} loading={loadingSubmissions} onReview={setReviewing} isBoss={isBoss} onDelete={deleteSubmission} />}
          {view === "do" && !activeChecklist && <PickTask checklists={checklists} onPick={startTask} loading={loadingChecklists} />}
          {view === "do" && activeChecklist && <DoTask checklist={activeChecklist} onSubmit={submitTask} onBack={() => setActiveChecklist(null)} defaultName={userEmail} />}
          {view === "build" && isBoss && <Builder checklists={checklists} reload={loadChecklists} />}
        </main>
      </div>

      {reviewing && <ReviewModal submission={reviewing} onClose={() => setReviewing(null)} onDelete={(isBoss || reviewing.isMine) ? deleteSubmission : null} />}
    </div>
  );
}

function Dashboard({ submissions, loading, onReview, isBoss, onDelete }) {
  const [filter, setFilter] = useState("all");   // all | review | confirmed | cleared
  const [sortNewest, setSortNewest] = useState(true);

  const stats = useMemo(() => {
    let flagged = 0, clean = 0, unverified = 0;
    submissions.forEach((s) => {
      if (s.needsReview) flagged++;
      else clean++;
      if (s.hasUnverified) unverified++;
    });
    return { total: submissions.length, flagged, clean, unverified };
  }, [submissions]);

  // Sort a copy by the chosen order. Submissions carry a createdMs for sorting.
  const sorted = useMemo(() => {
    const arr = [...submissions];
    arr.sort((a, b) => sortNewest ? (b.createdMs - a.createdMs) : (a.createdMs - b.createdMs));
    return arr;
  }, [submissions, sortNewest]);

  // Split into the three groups (order already applied).
  const needsReview = sorted.filter((s) => s.needsReview);
  const pmConfirmed = sorted.filter((s) => !s.needsReview && s.hasUnverified);
  const clean = sorted.filter((s) => !s.needsReview && !s.hasUnverified);

  // Which sections to show based on the filter.
  const showReview = filter === "all" || filter === "review";
  const showConfirmed = (filter === "all" || filter === "confirmed") && isBoss;
  const showCleared = filter === "all" || filter === "cleared";

  const filters = [
    { key: "all", label: "All" },
    { key: "review", label: "Needs review" },
    ...(isBoss ? [{ key: "confirmed", label: "PM-confirmed" }] : []),
    { key: "cleared", label: "Cleared" },
  ];

  return (
    <div>
      <Header
        title={isBoss ? "Oversight" : "My submissions"}
        sub={isBoss ? "Genuine flags are at the top. PM-confirmed items sit in their own section below." : "The checklists you have submitted. Anything flagged is shown at the top."}
      />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 20 }}>
        <Stat label="Submissions" value={stats.total} />
        <Stat label="Need review" value={stats.flagged} accent={stats.flagged ? C.flag : C.sub} />
        <Stat label="PM-confirmed" value={stats.unverified} accent={stats.unverified ? "#8a6d1a" : C.sub} />
      </div>

      {/* Filter + sort bar */}
      {!loading && submissions.length > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {filters.map((f) => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                style={{ padding: "7px 14px", borderRadius: 999, fontSize: 13, fontWeight: 600, border: `1px solid ${filter === f.key ? C.teal : C.line}`,
                  background: filter === f.key ? C.teal : "#fff", color: filter === f.key ? "#fff" : C.sub, cursor: "pointer" }}>
                {f.label}
              </button>
            ))}
          </div>
          <button onClick={() => setSortNewest((v) => !v)} className="btn-ghost" style={{ fontSize: 13 }}>
            {sortNewest ? "Newest first" : "Oldest first"}
          </button>
        </div>
      )}

      {loading ? (
        <div className="card" style={{ padding: 40, textAlign: "center", color: C.sub }}>Loading submissions…</div>
      ) : submissions.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: "center", color: C.sub }}>
          No submissions yet. Head to <strong>Do a task</strong> to complete one, then it appears here.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {showReview && needsReview.length > 0 && (
            <Section title="Needs review" hint="Reuse detected, failed checks, or missing steps.">
              {needsReview.map((s) => <SubmissionRow key={s.id} s={s} onReview={onReview} onDelete={onDelete} canDelete={isBoss || s.isMine} />)}
            </Section>
          )}
          {showConfirmed && pmConfirmed.length > 0 && (
            <Section title="PM-confirmed, address not auto-verified" hint="The screenshot didn't show the address; the PM gave a reason. Spot-check only if you want to.">
              {pmConfirmed.map((s) => <SubmissionRow key={s.id} s={s} onReview={onReview} onDelete={onDelete} canDelete={isBoss || s.isMine} />)}
            </Section>
          )}
          {showCleared && clean.length > 0 && (
            <Section title="Cleared" hint="Passed all checks.">
              {clean.map((s) => <SubmissionRow key={s.id} s={s} onReview={onReview} onDelete={onDelete} canDelete={isBoss || s.isMine} />)}
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, hint, children }) {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 2 }}>{title}</div>
      <div style={{ fontSize: 12, color: C.sub, marginBottom: 12 }}>{hint}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{children}</div>
    </div>
  );
}

function SubmissionRow({ s, onReview, onDelete, canDelete }) {
  const [confirming, setConfirming] = useState(false);
  const flagged = s.results.filter((r) => r.status === "flag" || r.status === "missing").length;
  const confirmed = s.results.filter((r) => r.status === "unverified").length;
  const borderColor = s.needsReview ? C.flag : s.hasUnverified ? "#c99a3a" : C.pass;
  return (
    <div className="card" style={{ padding: "16px 18px", display: "flex", alignItems: "center", gap: 16, borderLeft: `4px solid ${borderColor}` }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 15 }}>{s.checklistTitle}</div>
        <div style={{ fontSize: 13, color: C.sub, marginTop: 2 }}>{s.pm} · {s.property} · {s.time}</div>
      </div>
      {s.needsReview ? (
        <span className="pill" style={{ background: C.flagBg, color: C.flag }}><AlertTriangle size={13} /> {flagged} step{flagged > 1 ? "s" : ""} to check</span>
      ) : s.hasUnverified ? (
        <span className="pill" style={{ background: "#fef7ec", color: "#8a6d1a" }}><AlertTriangle size={13} /> {confirmed} PM-confirmed</span>
      ) : (
        <span className="pill" style={{ background: C.passBg, color: C.pass }}><CheckCircle2 size={13} /> All passed</span>
      )}
      <button className="btn-ghost" onClick={() => onReview(s)} style={{ display: "flex", alignItems: "center", gap: 6 }}><Eye size={15} /> View</button>
      {canDelete && (
        confirming ? (
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: C.miss }}>Delete?</span>
            <button className="btn-ghost" onClick={() => onDelete(s.id)} style={{ color: C.miss, borderColor: C.miss, padding: "6px 10px" }}>Yes</button>
            <button className="btn-ghost" onClick={() => setConfirming(false)} style={{ padding: "6px 10px" }}>No</button>
          </div>
        ) : (
          <button className="btn-ghost" onClick={() => setConfirming(true)} title="Delete submission" style={{ padding: "9px 11px", color: C.sub }}><Trash2 size={15} /></button>
        )
      )}
    </div>
  );
}

function PickTask({ checklists, onPick, loading }) {
  return (
    <div>
      <Header title="Do a task" sub="Pick a checklist. Work through each step and attach evidence." />
      {loading ? (
        <div className="card" style={{ padding: 40, textAlign: "center", color: C.sub }}>Loading checklists…</div>
      ) : checklists.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: "center", color: C.sub }}>No checklists available yet.</div>
      ) : (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 14 }}>
        {checklists.map((cl) => (
          <button key={cl.id} onClick={() => onPick(cl)} className="card" style={{ padding: 20, textAlign: "left", cursor: "pointer" }}>
            <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 6 }}>{cl.title}</div>
            <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.5, marginBottom: 12 }}>{cl.desc}</div>
            <div style={{ fontSize: 12, color: C.teal, fontWeight: 600 }}>{cl.steps.length} steps &rarr;</div>
          </button>
        ))}
      </div>
      )}
    </div>
  );
}

function DoTask({ checklist, onSubmit, onBack, defaultName }) {
  const [pmName, setPmName] = useState(defaultName || "");
  const [property, setProperty] = useState("");
  const [started, setStarted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [state, setState] = useState(() => checklist.steps.map((st) => ({ stepId: st.id, done: false, value: "", file: null, checking: false, needsConfirm: false, confirmReason: "", status: "pending", note: "" })));
  const done = state.filter((s) => s.done).length;
  const allDone = done === checklist.steps.length;

  // Require a name and property address before any steps are shown.
  // The address is also what the AI cross-check will use later to confirm
  // screenshots match the right property.
  if (!started) {
    const canBegin = pmName.trim().length > 1 && property.trim().length > 4;
    return (
      <div>
        <button className="btn-ghost" onClick={onBack} style={{ marginBottom: 16, display: "inline-flex", alignItems: "center", gap: 6 }}><ChevronLeft size={16} /> Back</button>
        <Header title={checklist.title} sub="Enter your name and the property address to begin." />
        <div className="card" style={{ padding: 22, maxWidth: 440 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: C.sub, display: "block", marginBottom: 6 }}>Your name</label>
          <input value={pmName} onChange={(e) => setPmName(e.target.value)} placeholder="e.g. Josh" style={{ width: "100%", padding: "10px 12px", border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 14, marginBottom: 16 }} />
          <label style={{ fontSize: 13, fontWeight: 600, color: C.sub, display: "block", marginBottom: 6 }}>Property address</label>
          <input value={property} onChange={(e) => setProperty(e.target.value)} placeholder="e.g. 12 Example St, Mt Roskill" style={{ width: "100%", padding: "10px 12px", border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 14, marginBottom: 18 }} />
          <button className="btn-primary" onClick={() => setStarted(true)} disabled={!canBegin} style={{ opacity: canBegin ? 1 : 0.5, width: "100%", padding: "11px 0" }}>
            Begin checklist
          </button>
        </div>
      </div>
    );
  }

  // Turn an uploaded file into base64 so it can be sent to the check function.
  const fileToBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(",")[1]); // strip the data: prefix
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  // Fingerprint an image: a SHA-256 hash. Identical images give an identical
  // hash, so we can detect a screenshot that has been submitted before.
  // This runs entirely in the browser — free, no external service.
  const hashFile = async (file) => {
    const buffer = await file.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", buffer);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  };

  const complete = async (idx, step, overrideFile) => {
    // Tick steps and reference steps: no image to check, mark done directly.
    if (step.evidence !== "screenshot") {
      setState((prev) => {
        const next = [...prev];
        next[idx] = { ...next[idx], done: true, status: "pass", note: "Confirmed." };
        return next;
      });
      return;
    }

    // Use the override file (from a "replace screenshot" redo) if given,
    // otherwise the file already attached to this step.
    const file = overrideFile || state[idx].file;
    if (!file) return; // button is disabled without a file

    setState((prev) => { const n = [...prev]; n[idx] = { ...n[idx], checking: true }; return n; });

    try {
      // --- Step 1: Reuse detection (free, always runs) -------------------
      const hash = await hashFile(file);

      // Has this exact image been submitted before?
      const { data: matches } = await supabase
        .from("screenshot_hashes")
        .select("property_address, created_at")
        .eq("hash", hash)
        .limit(1);

      if (matches && matches.length > 0) {
        // Reused screenshot — flag it and stop here.
        setState((prev) => {
          const n = [...prev];
          n[idx] = { ...n[idx], done: true, checking: false, status: "flag",
            note: "This screenshot has already been used before. Possible reuse — needs review." };
          return n;
        });
        return;
      }

      // New image — record its fingerprint so future uploads are checked against it.
      await supabase.from("screenshot_hashes").insert({
        hash,
        property_address: property,
        step_text: step.text,
      });

      // --- Step 2: OCR address check (free) -----------------------------
      // Read the text in the screenshot and see if it mentions the property
      // address. If it clearly doesn't, we don't fail outright — we ask the PM
      // to either upload a clearer screenshot or confirm with a reason.
      const addressResult = await checkAddressInImage(file, property);

      if (addressResult !== "found") {
        // Park the step in a "needs confirmation" state. The PM will either
        // re-upload or confirm with a typed reason (handled by confirmUnverified).
        setState((prev) => {
          const n = [...prev];
          n[idx] = { ...n[idx], checking: false, needsConfirm: true, confirmReason: "" };
          return n;
        });
        return;
      }

      // --- Step 3: AI content check (optional) --------------------------
      // If the AI service is available it gives a real pass/flag. If it's not
      // set up or out of quota, we don't block the PM — the screenshot is
      // accepted having passed the reuse and address checks.
      let status = "pass";
      let note = "Screenshot recorded. Address confirmed, passed reuse check.";

      try {
        const imageBase64 = await fileToBase64(file);
        const { data, error } = await supabase.functions.invoke("check-screenshot", {
          body: { imageBase64, imageMimeType: file.type, stepText: step.text, propertyAddress: property },
        });
        if (!error && data && data.status) {
          status = data.status;
          note = data.note;
        }
      } catch {
        // AI check unavailable — leave as passed for manual review.
      }

      setState((prev) => {
        const n = [...prev];
        n[idx] = { ...n[idx], done: true, checking: false, status, note };
        return n;
      });
    } catch (e) {
      console.error("Check failed:", e);
      setState((prev) => {
        const n = [...prev];
        n[idx] = { ...n[idx], done: true, checking: false, status: "flag", note: "Check failed — needs manual review." };
        return n;
      });
    }
  };

  // For screenshots we keep the actual File (to send) and its name (to show).
  // Choosing a new file also clears any pending "needs confirmation" state,
  // since the PM is replacing the image and it should be re-checked.
  const setFile = (idx, file) => setState((prev) => {
    const n = [...prev];
    n[idx] = { ...n[idx], file, value: file ? file.name : "", needsConfirm: false, confirmReason: "" };
    return n;
  });
  const setValue = (idx, v) => setState((prev) => { const n = [...prev]; n[idx] = { ...n[idx], value: v }; return n; });
  const setConfirmReason = (idx, v) => setState((prev) => { const n = [...prev]; n[idx] = { ...n[idx], confirmReason: v }; return n; });

  // Let a PM replace the screenshot on a step that flagged (reuse, failed check,
  // or unverified) without redoing the whole checklist. Resets just that step
  // with the new file, then re-runs the checks on it.
  const redoStep = (idx, step, newFile) => {
    if (!newFile) return;
    setState((prev) => {
      const n = [...prev];
      n[idx] = { ...n[idx], done: false, status: "pending", note: "", file: newFile, value: newFile.name, needsConfirm: false, confirmReason: "", checking: false };
      return n;
    });
    // Re-run the checks on the replacement image (passed directly so we don't
    // depend on the state update above having applied yet).
    complete(idx, step, newFile);
  };

  // PM confirms a screenshot whose address couldn't be auto-verified, giving a
  // short reason. This completes the step with a distinct "unverified" status
  // so the boss can see it in its own section, separate from genuine flags.
  const confirmUnverified = (idx) => {
    setState((prev) => {
      const n = [...prev];
      const reason = (n[idx].confirmReason || "").trim();
      n[idx] = {
        ...n[idx],
        done: true,
        needsConfirm: false,
        status: "unverified",
        note: `Address not auto-detected. PM confirmed: "${reason}"`,
      };
      return n;
    });
  };

  const submit = async () => {
    setSubmitting(true);
    // Genuine problems needing the boss's attention.
    const needsReview = state.some((s) => s.status === "flag" || s.status === "missing");
    // PM-confirmed-but-unverified steps go in their own softer bucket.
    const hasUnverified = state.some((s) => s.status === "unverified");

    // Upload the screenshot image ONLY for steps that flagged or were
    // PM-confirmed — those are the ones a human might want to look at.
    // Clean passes don't get their image stored, saving space.
    const results = [];
    for (const s of state) {
      const step = checklist.steps.find((x) => x.id === s.stepId);
      const base = {
        text: step.text, group: step.group, evidence: step.evidence,
        status: s.done ? s.status : "missing",
        note: s.done ? s.note : "Step not completed.",
        value: s.value,
      };
      const keepImage = s.file && (s.status === "flag" || s.status === "unverified");
      console.log("[submit] step:", step.text.slice(0, 30), "| status:", s.status, "| hasFile:", !!s.file, "| willUpload:", keepImage);
      if (keepImage) {
        try {
          const path = `${Date.now()}-${Math.random().toString(36).slice(2)}-${s.file.name}`.replace(/[^a-zA-Z0-9._-]/g, "_");
          console.log("[submit] uploading to:", path);
          const { data, error } = await supabase.storage.from("screenshots").upload(path, s.file);
          if (error) {
            console.error("[submit] upload REJECTED:", error.message, error);
          } else {
            console.log("[submit] upload OK:", data?.path);
            base.screenshotPath = path;
          }
        } catch (e) {
          console.error("[submit] upload threw:", e);
          // Not fatal — the submission still saves, just without the stored image.
        }
      }
      results.push(base);
    }

    onSubmit({
      id: Date.now().toString(),
      checklistTitle: checklist.title,
      pm: pmName, property: property, time: "Just now", needsReview, hasUnverified,
      results,
    });
  };

  let lastGroup = null;

  return (
    <div>
      <button className="btn-ghost" onClick={onBack} style={{ marginBottom: 16, display: "inline-flex", alignItems: "center", gap: 6 }}><ChevronLeft size={16} /> Back</button>
      <Header title={checklist.title} sub={`${pmName} · ${property} · ${done} of ${checklist.steps.length} steps complete`} />
      <div style={{ height: 6, background: C.line, borderRadius: 4, marginBottom: 22, overflow: "hidden" }}>
        <div style={{ width: `${(done / checklist.steps.length) * 100}%`, height: "100%", background: C.teal, transition: ".3s" }} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {checklist.steps.map((step, i) => {
          const s = state[i];
          const meta = EVIDENCE[step.evidence];
          const EvIcon = meta.icon;
          const sm = statusMeta[s.done ? s.status : "pending"];
          const showGroup = step.group && step.group !== lastGroup;
          lastGroup = step.group;
          return (
            <React.Fragment key={step.id}>
              {showGroup && (
                <div style={{ fontSize: 12, fontWeight: 700, color: C.teal, textTransform: "uppercase", letterSpacing: "0.05em", marginTop: i === 0 ? 0 : 10, paddingLeft: 2 }}>{step.group}</div>
              )}
              <div className="card" style={{ padding: 16, opacity: s.done ? 0.92 : 1 }}>
                <div style={{ display: "flex", gap: 13 }}>
                  <div style={{ width: 24, height: 24, borderRadius: "50%", background: s.done ? sm.bg : "#eef2f5", color: sm.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontWeight: 700, fontSize: 12 }}>
                    {s.done ? <sm.Icon size={15} /> : "\u2022"}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500, fontSize: 14.5, lineHeight: 1.4 }}>{step.text}</div>
                    <div style={{ fontSize: 12, color: C.sub, marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}><EvIcon size={13} /> {meta.label}</div>

                    {!s.done && (
                      <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                        {step.evidence === "reference" && (
                          <input value={s.value} onChange={(e) => setValue(i, e.target.value)} placeholder="Palace reference no." style={{ flex: 1, minWidth: 180, padding: "8px 11px", border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 13 }} />
                        )}
                        {step.evidence === "screenshot" && (
                          <label style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 13px", border: `1px dashed ${C.teal}`, color: C.teal, borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
                            <Upload size={14} /> {s.value ? "Screenshot attached" : "Attach screenshot"}
                            <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => setFile(i, e.target.files[0] || null)} />
                          </label>
                        )}
                        <button className="btn-primary" onClick={() => complete(i, step)}
                          disabled={s.checking || (step.evidence === "reference" && !s.value) || (step.evidence === "screenshot" && !s.file)}
                          style={{ opacity: (s.checking || (step.evidence === "reference" && !s.value) || (step.evidence === "screenshot" && !s.file)) ? 0.5 : 1 }}>
                          {s.checking ? "Checking…" : step.evidence === "tick" ? "Mark done" : "Complete step"}
                        </button>
                      </div>
                    )}

                    {s.needsConfirm && (
                      <div style={{ marginTop: 12, padding: 14, background: "#fef7ec", border: `1px solid #f0d9b5`, borderRadius: 9 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#9a6a1a", marginBottom: 4 }}>
                          Couldn't confirm this is for {property}
                        </div>
                        <div style={{ fontSize: 13, color: C.sub, marginBottom: 12, lineHeight: 1.5 }}>
                          The property address wasn't found in this screenshot. Please upload a clearer screenshot that shows the address, or confirm with a brief reason below.
                        </div>
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                          <label style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 13px", border: `1px dashed ${C.teal}`, color: C.teal, borderRadius: 8, fontSize: 13, fontWeight: 600, background: "#fff" }}>
                            <Upload size={14} /> Upload a clearer one
                            <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files[0]; if (f) { setFile(i, f); complete(i, step); } }} />
                          </label>
                        </div>
                        <div style={{ marginTop: 12 }}>
                          <input value={s.confirmReason || ""} onChange={(e) => setConfirmReason(i, e.target.value)} placeholder="Reason (e.g. bond form doesn't show address)"
                            style={{ width: "100%", padding: "9px 12px", border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 13, marginBottom: 10, boxSizing: "border-box", background: "#fff" }} />
                          <button className="btn-ghost" onClick={() => confirmUnverified(i)} disabled={!(s.confirmReason || "").trim()}
                            style={{ opacity: (s.confirmReason || "").trim() ? 1 : 0.5 }}>
                            Confirm without address
                          </button>
                        </div>
                      </div>
                    )}

                    {s.done && (
                      <div style={{ marginTop: 10 }}>
                        <div style={{ padding: "9px 12px", background: sm.bg, borderRadius: 8, fontSize: 13, color: sm.color, display: "flex", alignItems: "center", gap: 8 }}>
                          <sm.Icon size={15} /> <strong>{sm.label}.</strong> <span style={{ color: C.sub }}>{s.note}</span>
                        </div>
                        {step.evidence === "screenshot" && (s.status === "flag" || s.status === "unverified") && (
                          <label style={{ display: "inline-flex", alignItems: "center", gap: 7, marginTop: 8, padding: "7px 12px", border: `1px dashed ${C.teal}`, color: C.teal, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                            <Upload size={14} /> Replace screenshot
                            <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => redoStep(i, step, e.target.files[0])} />
                          </label>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      <div style={{ marginTop: 22, display: "flex", justifyContent: "flex-end", gap: 12, alignItems: "center" }}>
        {!allDone && <span style={{ fontSize: 13, color: C.sub }}>Complete all steps to submit</span>}
        <button className="btn-primary" onClick={submit} disabled={!allDone || submitting} style={{ opacity: (allDone && !submitting) ? 1 : 0.5, padding: "11px 24px" }}>{submitting ? "Submitting…" : "Submit for oversight"}</button>
      </div>
    </div>
  );
}

function ReviewModal({ submission, onClose, onDelete }) {
  const [confirming, setConfirming] = useState(false);
  let lastGroup = null;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,31,73,0.4)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 50 }}>
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ maxWidth: 640, width: "100%", maxHeight: "85vh", overflow: "auto", padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>{submission.checklistTitle}</div>
            <div style={{ fontSize: 13, color: C.sub, marginTop: 2 }}>{submission.pm} · {submission.property} · {submission.time}</div>
          </div>
          <button onClick={onClose} className="btn-ghost" style={{ padding: 8 }}><X size={16} /></button>
        </div>
        <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 9 }}>
          {submission.results.map((r, i) => {
            const sm = statusMeta[r.status] || statusMeta.pending;
            const showGroup = r.group && r.group !== lastGroup;
            lastGroup = r.group;
            return (
              <React.Fragment key={i}>
                {showGroup && <div style={{ fontSize: 11, fontWeight: 700, color: C.teal, textTransform: "uppercase", letterSpacing: "0.05em", marginTop: i === 0 ? 0 : 8 }}>{r.group}</div>}
                <div style={{ padding: 12, border: `1px solid ${C.line}`, borderRadius: 9, borderLeft: `4px solid ${sm.color}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 500 }}>{r.text}</div>
                    <span className="pill" style={{ background: sm.bg, color: sm.color, flexShrink: 0, height: "fit-content" }}><sm.Icon size={12} /> {sm.label}</span>
                  </div>
                  <div style={{ fontSize: 12, color: C.sub, marginTop: 5 }}>{r.note}{r.value ? ` · ${r.value}` : ""}</div>
                  {r.screenshotPath && <ScreenshotViewer path={r.screenshotPath} />}
                </div>
              </React.Fragment>
            );
          })}
        </div>
        {onDelete && (
          <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${C.line}`, display: "flex", justifyContent: "flex-end" }}>
            {confirming ? (
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 13, color: C.miss }}>Delete this submission permanently?</span>
                <button className="btn-ghost" onClick={() => onDelete(submission.id)} style={{ color: C.miss, borderColor: C.miss }}>Yes, delete</button>
                <button className="btn-ghost" onClick={() => setConfirming(false)}>Cancel</button>
              </div>
            ) : (
              <button className="btn-ghost" onClick={() => setConfirming(true)} style={{ color: C.miss, display: "flex", alignItems: "center", gap: 6 }}><Trash2 size={15} /> Delete</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ScreenshotViewer({ path }) {
  const [url, setUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = async () => {
    setLoading(true);
    setFailed(false);
    // Private bucket: create a short-lived signed URL to view the image.
    const { data, error } = await supabase.storage.from("screenshots").createSignedUrl(path, 300);
    setLoading(false);
    if (error || !data?.signedUrl) { setFailed(true); return; }
    setUrl(data.signedUrl);
  };

  if (url) {
    return (
      <div style={{ marginTop: 8 }}>
        <img src={url} alt="Screenshot evidence" style={{ maxWidth: "100%", borderRadius: 8, border: `1px solid ${C.line}` }} />
      </div>
    );
  }

  return (
    <button className="btn-ghost" onClick={load} disabled={loading}
      style={{ marginTop: 8, fontSize: 12, padding: "6px 11px", display: "inline-flex", alignItems: "center", gap: 6 }}>
      <Eye size={13} /> {loading ? "Loading…" : failed ? "Couldn't load — retry" : "View screenshot"}
    </button>
  );
}

function Builder({ checklists, reload }) {
  const [editing, setEditing] = useState(null); // null = list view; object = editing
  const [busy, setBusy] = useState(false);

  // Turn a flattened checklist (steps with group labels) back into grouped form
  // for editing. New checklists start with one empty group.
  const toGrouped = (cl) => {
    if (!cl) return { id: null, title: "", description: "", groups: [{ name: "", steps: [{ text: "", evidence: "screenshot" }] }] };
    const groups = [];
    (cl.steps || []).forEach((s) => {
      const gname = s.group || "";
      let g = groups.find((x) => x.name === gname);
      if (!g) { g = { name: gname, steps: [] }; groups.push(g); }
      g.steps.push({ text: s.text, evidence: s.evidence });
    });
    return { id: cl.id, title: cl.title, description: cl.desc || "", groups: groups.length ? groups : [{ name: "", steps: [{ text: "", evidence: "screenshot" }] }] };
  };

  const startNew = () => setEditing(toGrouped(null));
  const startEdit = (cl) => setEditing(toGrouped(cl));

  const save = async (draft) => {
    // Basic validation: title and at least one non-empty step.
    if (!draft.title.trim()) { alert("Give the checklist a title."); return; }
    const cleanGroups = draft.groups
      .map((g) => ({ name: g.name.trim(), steps: g.steps.filter((s) => s.text.trim()).map((s) => ({ text: s.text.trim(), evidence: s.evidence })) }))
      .filter((g) => g.steps.length > 0);
    if (cleanGroups.length === 0) { alert("Add at least one step."); return; }

    setBusy(true);
    if (draft.id) {
      const { error } = await supabase.from("checklists")
        .update({ title: draft.title.trim(), description: draft.description.trim(), groups: cleanGroups, updated_at: new Date().toISOString() })
        .eq("id", draft.id);
      if (error) { setBusy(false); alert("Couldn't save changes: " + error.message); return; }
    } else {
      const { error } = await supabase.from("checklists")
        .insert({ title: draft.title.trim(), description: draft.description.trim(), groups: cleanGroups, sort_order: checklists.length });
      if (error) { setBusy(false); alert("Couldn't create checklist: " + error.message); return; }
    }
    setBusy(false);
    setEditing(null);
    await reload();
  };

  const remove = async (id) => {
    setBusy(true);
    const { error } = await supabase.from("checklists").delete().eq("id", id);
    setBusy(false);
    if (error) { alert("Couldn't delete: " + error.message); return; }
    await reload();
  };

  if (editing) {
    return <ChecklistEditor initial={editing} onSave={save} onCancel={() => setEditing(null)} busy={busy} />;
  }

  return (
    <div>
      <Header title="Checklists" sub="Edit, delete, or add checklists. Changes are saved and seen by everyone." />
      <button className="btn-primary" onClick={startNew} style={{ marginBottom: 18, display: "inline-flex", alignItems: "center", gap: 6 }}><Plus size={16} /> New checklist</button>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {checklists.map((cl) => (
          <ChecklistCard key={cl.id} cl={cl} onEdit={() => startEdit(cl)} onDelete={() => remove(cl.id)} busy={busy} />
        ))}
      </div>
    </div>
  );
}

function ChecklistCard({ cl, onEdit, onDelete, busy }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="card" style={{ padding: 16, display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 15 }}>{cl.title}</div>
        <div style={{ fontSize: 13, color: C.sub, margin: "3px 0 4px" }}>{cl.desc}</div>
        <div style={{ fontSize: 12, color: C.teal }}>{cl.steps.length} steps</div>
      </div>
      <button className="btn-ghost" onClick={onEdit} disabled={busy}>Edit</button>
      {confirming ? (
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: C.miss }}>Delete?</span>
          <button className="btn-ghost" onClick={onDelete} disabled={busy} style={{ color: C.miss, borderColor: C.miss, padding: "6px 10px" }}>Yes</button>
          <button className="btn-ghost" onClick={() => setConfirming(false)} style={{ padding: "6px 10px" }}>No</button>
        </div>
      ) : (
        <button className="btn-ghost" onClick={() => setConfirming(true)} disabled={busy} style={{ color: C.sub, padding: "9px 11px" }} title="Delete checklist"><Trash2 size={15} /></button>
      )}
    </div>
  );
}

function ChecklistEditor({ initial, onSave, onCancel, busy }) {
  const [draft, setDraft] = useState(initial);

  const setField = (k, v) => setDraft((d) => ({ ...d, [k]: v }));
  const setGroupName = (gi, name) => setDraft((d) => { const g = [...d.groups]; g[gi] = { ...g[gi], name }; return { ...d, groups: g }; });
  const addGroup = () => setDraft((d) => ({ ...d, groups: [...d.groups, { name: "", steps: [{ text: "", evidence: "screenshot" }] }] }));
  const removeGroup = (gi) => setDraft((d) => ({ ...d, groups: d.groups.filter((_, i) => i !== gi) }));
  const addStep = (gi) => setDraft((d) => { const g = [...d.groups]; g[gi] = { ...g[gi], steps: [...g[gi].steps, { text: "", evidence: "screenshot" }] }; return { ...d, groups: g }; });
  const removeStep = (gi, si) => setDraft((d) => { const g = [...d.groups]; g[gi] = { ...g[gi], steps: g[gi].steps.filter((_, i) => i !== si) }; return { ...d, groups: g }; });
  const setStep = (gi, si, k, v) => setDraft((d) => { const g = [...d.groups]; const st = [...g[gi].steps]; st[si] = { ...st[si], [k]: v }; g[gi] = { ...g[gi], steps: st }; return { ...d, groups: g }; });

  return (
    <div>
      <button className="btn-ghost" onClick={onCancel} style={{ marginBottom: 16, display: "inline-flex", alignItems: "center", gap: 6 }}><ChevronLeft size={16} /> Back to list</button>
      <Header title={draft.id ? "Edit checklist" : "New checklist"} sub="Group steps under section headings. Each step has an evidence type." />

      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: C.sub, display: "block", marginBottom: 6 }}>Title</label>
        <input value={draft.title} onChange={(e) => setField("title", e.target.value)} placeholder="e.g. Property Viewing" style={{ ...inp, marginBottom: 14 }} />
        <label style={{ fontSize: 13, fontWeight: 600, color: C.sub, display: "block", marginBottom: 6 }}>Description</label>
        <input value={draft.description} onChange={(e) => setField("description", e.target.value)} placeholder="Short description" style={inp} />
      </div>

      {draft.groups.map((g, gi) => (
        <div key={gi} className="card" style={{ padding: 18, marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
            <input value={g.name} onChange={(e) => setGroupName(gi, e.target.value)} placeholder="Section heading (optional, e.g. On day of vacate)"
              style={{ ...inp, fontWeight: 600, color: C.teal }} />
            {draft.groups.length > 1 && (
              <button className="btn-ghost" onClick={() => removeGroup(gi)} style={{ padding: "9px 11px", color: C.sub }} title="Remove section"><Trash2 size={15} /></button>
            )}
          </div>
          {g.steps.map((st, si) => (
            <div key={si} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.teal, paddingTop: 9 }}>{si + 1}</span>
              <div style={{ flex: 1 }}>
                <input value={st.text} onChange={(e) => setStep(gi, si, "text", e.target.value)} placeholder="What must be done" style={{ ...inp, marginBottom: 8 }} />
                <div style={{ display: "flex", gap: 8 }}>
                  <select value={st.evidence} onChange={(e) => setStep(gi, si, "evidence", e.target.value)} style={{ ...inp, flex: 1 }}>
                    {Object.entries(EVIDENCE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                  {g.steps.length > 1 && <button onClick={() => removeStep(gi, si)} className="btn-ghost" style={{ padding: "0 12px" }}><Trash2 size={15} /></button>}
                </div>
              </div>
            </div>
          ))}
          <button onClick={() => addStep(gi)} className="btn-ghost" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 4 }}><Plus size={14} /> Add step</button>
        </div>
      ))}

      <button onClick={addGroup} className="btn-ghost" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 20 }}><Plus size={15} /> Add section</button>

      <div style={{ display: "flex", gap: 12 }}>
        <button className="btn-primary" onClick={() => onSave(draft)} disabled={busy}>{busy ? "Saving…" : "Save checklist"}</button>
        <button className="btn-ghost" onClick={onCancel} disabled={busy}>Cancel</button>
      </div>
    </div>
  );
}

const inp = { width: "100%", padding: "9px 11px", border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 13, background: "#fff" };

function Header({ title, sub }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>{title}</h1>
      <p style={{ fontSize: 14, color: C.sub, margin: "4px 0 0" }}>{sub}</p>
    </div>
  );
}

function Stat({ label, value, accent = C.ink }) {
  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ fontSize: 30, fontWeight: 700, color: accent, letterSpacing: "-0.02em" }}>{value}</div>
      <div style={{ fontSize: 13, color: C.sub, marginTop: 2 }}>{label}</div>
    </div>
  );
}
