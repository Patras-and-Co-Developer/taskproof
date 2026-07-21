import React, { useState, useEffect, useMemo } from "react";
import { CheckCircle2, AlertTriangle, Circle, Upload, Plus, Trash2, ChevronLeft, LayoutDashboard, ClipboardList, Settings, Hash, Camera, Check, X, Eye, LogOut } from "lucide-react";
import { supabase } from "./supabaseClient";
import Login from "./Login.jsx";

const EVIDENCE = {
  screenshot: { label: "Screenshot (AI-checked)", icon: Camera },
  reference: { label: "Palace reference no.", icon: Hash },
  tick: { label: "Simple tick", icon: Check },
};

const seedChecklists = [
  {
    id: "new-tenant",
    title: "New Tenant",
    desc: "From approved application through to move-in day.",
    groups: [
      { name: "Application approved", steps: [
        { text: "Confirm in writing that application has been approved and accepted by both parties", evidence: "screenshot" },
        { text: "Enter tenant(s) contact details into Palace and attach to relevant property", evidence: "screenshot" },
        { text: "Enter tenancy dates and term of agreement into Palace", evidence: "screenshot" },
        { text: "Enter rent review date into Palace", evidence: "screenshot" },
        { text: "Check rental amount and confirm weekly or fortnightly payments", evidence: "tick" },
        { text: "Enter bond amount due into Palace", evidence: "screenshot" },
        { text: "Confirm letting fee is the correct amount to be charged to the landlord", evidence: "tick" },
        { text: "Confirm rental amount in tenant matches the property and adjust if required", evidence: "tick" },
        { text: "Note any special conditions in tenant file", evidence: "screenshot" },
        { text: "Confirm details of Body Corporate (if applicable)", evidence: "tick" },
        { text: "Confirm if pets are approved (if applicable)", evidence: "tick" },
        { text: "Confirm amount tenant is to be charged for water (if applicable)", evidence: "tick" },
        { text: "Enter ingoing water meter reading on tenant profile in Palace", evidence: "screenshot" },
        { text: "Confirm arrangements for gardens and lawn maintenance (if applicable)", evidence: "tick" },
        { text: "Confirm arrangements for pool maintenance (if applicable)", evidence: "tick" },
        { text: "Confirm all details for this tenancy have been entered into Palace", evidence: "tick" },
        { text: "Prepare tenancy agreement and pack (agreement x3, arrears policy, maintenance policy, key release form, bond lodgement form, welcome pack)", evidence: "screenshot" },
        { text: "Schedule ingoing Property Condition Report", evidence: "screenshot" },
        { text: "Schedule inventory (if applicable)", evidence: "tick" },
        { text: "Prepare Fastconnect or Movinghub form (if applicable)", evidence: "tick" },
        { text: "File all relevant information and documents in tenant file", evidence: "screenshot" },
      ]},
      { name: "On the day the tenancy agreement is signed", steps: [
        { text: "Verify with tenant that details on the agreement are correct (move-in date, bond, rent & frequency, pets, smoking, occupants)", evidence: "tick" },
        { text: "Explain tenancy agreement in full to the tenant(s)", evidence: "tick" },
        { text: "Explain agency policies", evidence: "tick" },
        { text: "All parties to sign bond lodgement form", evidence: "screenshot" },
        { text: "Tenant to pay full ingoing costs at point of signing", evidence: "tick" },
        { text: "Tenant(s) to sign utility connection form (if applicable)", evidence: "tick" },
        { text: "Advise tenant(s) to organise contents insurance", evidence: "tick" },
        { text: "Advise tenant(s) regarding maintenance and care of smoke detectors", evidence: "tick" },
        { text: "Advise tenant(s) on pool / garden care where applicable", evidence: "tick" },
        { text: "Photocopy tenancy agreement and give a copy to tenant(s)", evidence: "tick" },
        { text: "File original tenancy agreement", evidence: "screenshot" },
        { text: "Arrange for the For Rent sign to be removed", evidence: "tick" },
        { text: "Remove property from websites", evidence: "screenshot" },
        { text: "Cancel any pre-booked advertising / marketing", evidence: "tick" },
        { text: "Send utility connection form (if applicable)", evidence: "tick" },
      ]},
      { name: "Prior to move-in date", steps: [
        { text: "Check ingoing Property Condition Report has been completed", evidence: "screenshot" },
        { text: "Print three copies of ingoing Property Condition Report", evidence: "tick" },
        { text: "Check welcome and information pack is ready for move-in", evidence: "tick" },
        { text: "Arrange a time for tenant(s) to collect keys", evidence: "tick" },
      ]},
      { name: "Move-in date", steps: [
        { text: "Check initial rent and bond has been paid in full and receipted", evidence: "screenshot" },
        { text: "Check all documentation is ready for key release", evidence: "tick" },
        { text: "Ensure tenant(s) sign office copy of key release", evidence: "screenshot" },
        { text: "Ensure tenant(s) sign office copy of ingoing Property Condition Report", evidence: "screenshot" },
        { text: "Ensure tenant(s) sign office copy of inventory (if applicable)", evidence: "tick" },
        { text: "Explain welcome and information pack", evidence: "tick" },
      ]},
    ],
  },
  {
    id: "vacating-tenant",
    title: "Vacating Tenant",
    desc: "Notice through to bond refund and filing.",
    groups: [
      { name: "On receipt of notice", steps: [
        { text: "Confirm when written notice has been received / issued from/to the tenants", evidence: "screenshot" },
        { text: "Confirm the correct notice period has been received/issued", evidence: "tick" },
        { text: "Confirm tenant has periodic or expiring fixed term and is not breaking tenancy", evidence: "tick" },
        { text: "Enter vacate date in Palace", evidence: "screenshot" },
        { text: "Enter tenant forwarding address and new contact numbers in Palace", evidence: "screenshot" },
        { text: "Contact owner to advise of vacate notice and discuss rent review", evidence: "tick" },
        { text: "If rent is to increase, update in Palace and increase bond and letting fee", evidence: "screenshot" },
        { text: "Forward email to owner confirming vacate date, rental amount and advertising details", evidence: "screenshot" },
        { text: "Forward letter of confirmation to tenant(s) with vacate procedures, cleaning guide and ingoing PCR", evidence: "screenshot" },
        { text: "Schedule date for final bond inspection in Palace", evidence: "screenshot" },
        { text: "Arrange for For Rent sign to be erected", evidence: "tick" },
        { text: "Upload property onto appropriate websites", evidence: "screenshot" },
        { text: "Arrange and book other advertising / marketing as per agreed schedule", evidence: "tick" },
        { text: "Place tenant file in vacate rack", evidence: "screenshot" },
      ]},
      { name: "On day of vacate", steps: [
        { text: "Confirm rent is paid to vacate date", evidence: "screenshot" },
        { text: "Read water meter (if applicable) and invoice tenant(s)", evidence: "screenshot" },
        { text: "Take photographs to verify condition of property", evidence: "screenshot" },
        { text: "Confirm property condition is acceptable compared to ingoing PCR", evidence: "tick" },
        { text: "If not, arrange extra cleaning or necessary maintenance and repairs", evidence: "tick" },
        { text: "Schedule re-inspection", evidence: "screenshot" },
      ]},
      { name: "Finalising", steps: [
        { text: "Schedule date for return of invoices for extra work to be charged to tenant(s)", evidence: "tick" },
        { text: "Check returned keys against keys given at start of tenancy", evidence: "tick" },
        { text: "Photocopy and file receipts (carpet cleaning, pest control, professional cleaning, pool certificate as applicable)", evidence: "screenshot" },
        { text: "Photocopy and give tenant(s) copy of Exit Condition Report (retain original)", evidence: "screenshot" },
        { text: "File final bond inspection report and any extra work scheduled plus invoices", evidence: "screenshot" },
        { text: "File vacating tenant checklist", evidence: "screenshot" },
        { text: "Check with owner prior to finalising the bond", evidence: "tick" },
        { text: "Follow bond refund process", evidence: "screenshot" },
      ]},
    ],
  },
  {
    id: "rent-review",
    title: "Rent Review",
    desc: "Rent review report through to bond top-up.",
    groups: [
      { name: "Preparing the review", steps: [
        { text: "Prepare and print rent review report two months in advance of review date", evidence: "screenshot" },
        { text: "Check tenant(s) for any special rent review clauses", evidence: "tick" },
        { text: "Prepare CMA (Comparative Market Analysis) to substantiate rental rate advice", evidence: "screenshot" },
        { text: "Forward email to owner with CMA to advise if rent could increase or remain, and request authorisation", evidence: "screenshot" },
      ]},
      { name: "Rental increase and renewal accepted", steps: [
        { text: "Enter details of rent increase in Palace", evidence: "screenshot" },
        { text: "Issue tenant(s) with minimum 60 days notice of rent increase (plus service days)", evidence: "screenshot" },
        { text: "Advise tenant(s) of additional funds required to increase bond accordingly", evidence: "tick" },
        { text: "Send bond increase amount to MBIE", evidence: "screenshot" },
      ]},
    ],
  },
  {
    id: "new-mgmt-existing-tenant",
    title: "New Management - Existing Tenant",
    desc: "Taking on a property that already has a tenant.",
    groups: [
      { name: "Setup", steps: [
        { text: "Ensure Management Authority is completed and signed by all required parties", evidence: "screenshot" },
        { text: "Give a copy of the Management Authority to the owner with welcome letter/pack", evidence: "tick" },
        { text: "Create property file and file original Management Authority", evidence: "screenshot" },
        { text: "Enter owner, property and tenant details into Palace", evidence: "screenshot" },
        { text: "File copy of notification from owner advising current agent of transfer", evidence: "screenshot" },
        { text: "Mark date in calendar for official transfer of management", evidence: "screenshot" },
        { text: "Send letter to current managing agent requesting handover documents (agreement, PCR, ledger, keys, bond form, active notices, correspondence)", evidence: "screenshot" },
        { text: "Notify tenant in writing of management transfer", evidence: "screenshot" },
        { text: "Set schedule in Palace for recurring routine inspections (13 weekly)", evidence: "screenshot" },
        { text: "Send notifications to Council / Body Corporate / Insurer for accounts (if applicable)", evidence: "tick" },
        { text: "Enter insurance policy and renewal dates into Palace", evidence: "screenshot" },
        { text: "Enter owner maintenance instructions and spend limit into Palace", evidence: "screenshot" },
      ]},
      { name: "On day of handover", steps: [
        { text: "Ensure all documentation has been received and follow up if necessary", evidence: "tick" },
        { text: "Record keys in register and Palace, tag, code, photocopy and place in cabinet", evidence: "screenshot" },
        { text: "Enter tenant paid-to-date into Palace", evidence: "screenshot" },
        { text: "Lodge Change of Landlord/Agent form with MBIE", evidence: "screenshot" },
        { text: "Send letter to owner advising of successful transfer (owners pack, photocopy of keys received)", evidence: "screenshot" },
        { text: "Send welcome pack to tenants (ledger, keys held, ingoing PCR)", evidence: "screenshot" },
      ]},
    ],
  },
  {
    id: "new-mgmt-owner-occupied",
    title: "New Management - Owner Occupied",
    desc: "Taking on a vacant owner-occupied property to market.",
    groups: [
      { name: "Setup and marketing", steps: [
        { text: "Ensure Management Authority is completed and signed by ALL required parties", evidence: "screenshot" },
        { text: "Key release form to be signed by owner", evidence: "screenshot" },
        { text: "Give a copy of the Management Authority to the owner with welcome letter/pack", evidence: "tick" },
        { text: "Create property file and file original Management Authority", evidence: "screenshot" },
        { text: "Confirm Landlord Protection Insurance has been offered and followed up", evidence: "tick" },
        { text: "Arrange Landlord Protection Insurance (if applicable)", evidence: "tick" },
        { text: "Ensure all owner and property details are accurate and enter into Palace", evidence: "screenshot" },
        { text: "Record keys in register and Palace, tag, code, photocopy and place in cabinet", evidence: "screenshot" },
        { text: "Enter insurance policy and renewal dates into Palace", evidence: "screenshot" },
        { text: "Enter owner maintenance instructions and spend limit into Palace", evidence: "screenshot" },
        { text: "Set schedule in Palace for recurring routine inspections (13 weekly)", evidence: "screenshot" },
        { text: "Photograph property for advertising purposes", evidence: "screenshot" },
        { text: "Arrange for For Rent sign to be erected at property", evidence: "tick" },
        { text: "Arrange and book advertising and marketing as per agreed schedule", evidence: "tick" },
        { text: "Load property onto applicable websites", evidence: "screenshot" },
        { text: "Arrange times for property to be viewed and set up schedule", evidence: "screenshot" },
        { text: "Ensure all team are aware of the new listing and viewing instructions", evidence: "tick" },
        { text: "Advise prospective tenants database of new listing", evidence: "tick" },
        { text: "Send notifications to Council / Body Corporate / Insurer for accounts (if applicable)", evidence: "tick" },
        { text: "Schedule time for ingoing Property Condition Report to be completed", evidence: "screenshot" },
      ]},
    ],
  },
  {
    id: "new-mgmt-vacant",
    title: "New Management - Vacant Property",
    desc: "Taking on a vacant property to market for lease.",
    groups: [
      { name: "Setup and marketing", steps: [
        { text: "Ensure Management Authority is completed and signed by ALL required parties", evidence: "screenshot" },
        { text: "Key release form to be signed by owner", evidence: "screenshot" },
        { text: "Give a copy of the Management Authority to the owner with welcome letter/pack", evidence: "tick" },
        { text: "Create property file and file original Management Authority", evidence: "screenshot" },
        { text: "Confirm Landlord Protection Insurance has been offered and followed up", evidence: "tick" },
        { text: "Arrange Landlord Protection Insurance (if applicable)", evidence: "tick" },
        { text: "Ensure all owner and property details are accurate and enter into Palace", evidence: "screenshot" },
        { text: "Record keys in register and Palace, tag, code, photocopy and place in cabinet", evidence: "screenshot" },
        { text: "Enter insurance policy and renewal dates into Palace", evidence: "screenshot" },
        { text: "Enter owner maintenance instructions and spend limit into Palace", evidence: "screenshot" },
        { text: "Set schedule in Palace for recurring routine inspections (13 weekly)", evidence: "screenshot" },
        { text: "Arrange repairs, maintenance, gardening and/or cleaning if necessary", evidence: "tick" },
        { text: "Photograph property for advertising purposes", evidence: "screenshot" },
        { text: "Arrange for For Rent sign to be erected at property", evidence: "tick" },
        { text: "Arrange and book advertising and marketing as per agreed schedule", evidence: "tick" },
        { text: "Load property onto applicable websites", evidence: "screenshot" },
        { text: "Arrange times for property to be viewed and set up schedule", evidence: "screenshot" },
        { text: "Ensure all team are aware of the new listing and viewing instructions", evidence: "tick" },
        { text: "Advise prospective tenants database of new listing", evidence: "tick" },
        { text: "Send notifications to Council / Body Corporate / Insurer for accounts (if applicable)", evidence: "tick" },
        { text: "Send notification to Water Care / Veolia", evidence: "tick" },
      ]},
    ],
  },
  {
    id: "mgmt-listed-for-sale",
    title: "Management Listed for Sale",
    desc: "When a managed property is put on the market.",
    groups: [
      { name: "On listing", steps: [
        { text: "Ensure notice from listing agent / owner advising property listed for sale is received in writing", evidence: "screenshot" },
        { text: "Tenant(s) issued with letter notifying them of the landlord intention to sell", evidence: "screenshot" },
        { text: "Give listing agent required info (info sheet, notification, viewing schedule, tenant contacts, rent, fixed term dates, tenant letter)", evidence: "tick" },
        { text: "Collect and retain a copy of the viewing schedule signed by all parties", evidence: "screenshot" },
      ]},
      { name: "Periodic tenancy - vacant possession required", steps: [
        { text: "Check with sales consultant if a 42 day notice needs to be issued", evidence: "tick" },
        { text: "Record date in Palace when the 42 day notice was issued (at least one day prior to settlement)", evidence: "screenshot" },
        { text: "Set reminder date to follow up with tenant(s) to ensure vacating on correct date", evidence: "screenshot" },
        { text: "Schedule final bond inspection", evidence: "screenshot" },
      ]},
      { name: "Tenancy to remain in place", steps: [
        { text: "If purchased by investor and tenant continuing, contact purchaser to co-ordinate management", evidence: "tick" },
        { text: "If management continuing with agency, forward a letter to the tenant(s) confirming no changes", evidence: "screenshot" },
      ]},
      { name: "Prior to / on settlement (investment purchase)", steps: [
        { text: "Schedule date in Palace as reminder of settlement day", evidence: "screenshot" },
        { text: "Run Change of Ownership wizard in Palace (if applicable)", evidence: "screenshot" },
        { text: "Ensure rental payments are credited to appropriate owner", evidence: "screenshot" },
        { text: "Ensure property card and tenant have been linked to the new owner in Palace", evidence: "screenshot" },
        { text: "Check if final water meter reading is required", evidence: "tick" },
        { text: "Check all invoices are paid or flag any outstanding", evidence: "tick" },
      ]},
    ],
  },
  {
    id: "finalisation-mgmt",
    title: "Finalisation of Management",
    desc: "Handover of a management to a new agency or owner.",
    groups: [
      { name: "On cancellation", steps: [
        { text: "Written advice of cancellation received from owner / or sent by agency", evidence: "screenshot" },
        { text: "Put owner funds on hold and check for any outstanding invoices", evidence: "screenshot" },
        { text: "Confirm required notice received / given", evidence: "tick" },
        { text: "Handover date entered into Palace", evidence: "screenshot" },
        { text: "Confirm notification received and send letter to owner (if applicable)", evidence: "tick" },
        { text: "Prepare copies (if remaining tenanted): agreement, PCR, ledger, paid-to date, keys given to tenant", evidence: "screenshot" },
        { text: "Prepare copies of any outstanding tenant invoices", evidence: "tick" },
        { text: "Prepare bond transfer (Change of Landlord/Agent form)", evidence: "screenshot" },
        { text: "If tenant vacating, owner to check property prior to bond release and sign off condition", evidence: "tick" },
        { text: "Photocopy all management keys / remotes retained in office", evidence: "screenshot" },
        { text: "Ensure enough funds held in trust to pay accounts and management fees", evidence: "screenshot" },
        { text: "Send notification to tenant(s) advising management end and last payment due", evidence: "screenshot" },
      ]},
      { name: "On day of finalisation", steps: [
        { text: "Check maintenance pending and process all accounts", evidence: "screenshot" },
        { text: "Confirm all management, sundry, letting fees have been deducted", evidence: "tick" },
        { text: "Send notification to Council / Body Corporate / Insurance of change of management", evidence: "tick" },
        { text: "Handover prepared documents and keys to owner and/or new agent", evidence: "tick" },
        { text: "Ensure new agent / owner signs confirmation of receipt of keys and documents", evidence: "screenshot" },
        { text: "Send email to owner confirming transfer / handover", evidence: "screenshot" },
      ]},
      { name: "End of month", steps: [
        { text: "On completion of end of month, mark owner, tenant and property as inactive in Palace", evidence: "screenshot" },
        { text: "Archive owner / tenant and property with reason for lost management stated", evidence: "screenshot" },
      ]},
    ],
  },
];

function flatten(cl) {
  const steps = [];
  cl.groups.forEach((g, gi) => {
    g.steps.forEach((s, si) => {
      steps.push({ ...s, id: `g${gi}s${si}`, group: g.name });
    });
  });
  return { ...cl, steps };
}

function mockAICheck() {
  const r = Math.random();
  if (r > 0.85) return { status: "flag", note: "Image unclear or does not appear to match the expected step. Needs manual review." };
  return { status: "pass", note: "Evidence appears consistent with this step." };
}

const C = {
  navy: "#0f2a43", navySoft: "#1c3d5a", teal: "#1f8a8a", tealSoft: "#e6f4f4",
  bg: "#f4f6f8", card: "#ffffff", line: "#dce3ea", ink: "#0f2a43", sub: "#5b6b7a",
  pass: "#1f9d63", passBg: "#e7f5ee", flag: "#c9761a", flagBg: "#fbf0e2", miss: "#b23b3b", missBg: "#fbe9e9",
};

const statusMeta = {
  pass: { label: "Passed", color: C.pass, bg: C.passBg, Icon: CheckCircle2 },
  flag: { label: "Flagged", color: C.flag, bg: C.flagBg, Icon: AlertTriangle },
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
  const [checklists, setChecklists] = useState(seedChecklists.map(flatten));
  const [submissions, setSubmissions] = useState([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(true);
  const [activeChecklist, setActiveChecklist] = useState(null);
  const [reviewing, setReviewing] = useState(null);

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
            needsReview: row.needs_review,
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
    // Save to the database. user_id is set automatically by a database
    // default, so the row is tied to whoever is signed in.
    const { error } = await supabase.from("submissions").insert({
      checklist_title: submission.checklistTitle,
      pm_name: submission.pm,
      property_address: submission.property,
      results: submission.results,
      needs_review: submission.needsReview,
    });
    if (error) {
      console.error("Could not save submission:", error.message);
      alert("Something went wrong saving this checklist. Please try submitting again.");
      return;
    }
    setSubmissions((s) => [submission, ...s]);
    setActiveChecklist(null);
    setView(isBoss ? "dashboard" : "do");
  };

  const signOut = async () => { await supabase.auth.signOut(); };

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
        .btn-primary:hover { background:#186f6f; }
        .btn-ghost { background:transparent; color:${C.sub}; border:1px solid ${C.line}; padding:9px 15px; border-radius:9px; font-weight:600; font-size:14px; }
        .btn-ghost:hover { background:#eef2f5; }
        input, textarea, select { font-family:inherit; }
      `}</style>

      <div style={{ display: "flex", minHeight: "100vh" }}>
        <aside style={{ width: 232, background: C.navy, padding: "22px 16px", flexShrink: 0, display: "flex", flexDirection: "column" }}>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 17, letterSpacing: "-0.02em", padding: "4px 8px 22px", display: "flex", alignItems: "center", gap: 9 }}>
            <div style={{ width: 26, height: 26, borderRadius: 7, background: C.teal, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ClipboardList size={15} color="#fff" />
            </div>
            TaskProof
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
          {view === "dashboard" && <Dashboard submissions={submissions} loading={loadingSubmissions} onReview={setReviewing} isBoss={isBoss} />}
          {view === "do" && !activeChecklist && <PickTask checklists={checklists} onPick={startTask} />}
          {view === "do" && activeChecklist && <DoTask checklist={activeChecklist} onSubmit={submitTask} onBack={() => setActiveChecklist(null)} defaultName={userEmail} />}
          {view === "build" && isBoss && <Builder checklists={checklists} setChecklists={setChecklists} />}
        </main>
      </div>

      {reviewing && <ReviewModal submission={reviewing} onClose={() => setReviewing(null)} />}
    </div>
  );
}

function Dashboard({ submissions, loading, onReview, isBoss }) {
  const stats = useMemo(() => {
    let flagged = 0, clean = 0;
    submissions.forEach((s) => { s.needsReview ? flagged++ : clean++; });
    return { total: submissions.length, flagged, clean };
  }, [submissions]);

  return (
    <div>
      <Header
        title={isBoss ? "Oversight" : "My submissions"}
        sub={isBoss ? "You only see what needs attention. Clean submissions sit quietly below." : "The checklists you have submitted. Anything flagged is shown at the top."}
      />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 24 }}>
        <Stat label="Submissions" value={stats.total} />
        <Stat label="Need review" value={stats.flagged} accent={stats.flagged ? C.flag : C.sub} />
        <Stat label="Cleared" value={stats.clean} accent={C.pass} />
      </div>
      {loading ? (
        <div className="card" style={{ padding: 40, textAlign: "center", color: C.sub }}>Loading submissions…</div>
      ) : submissions.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: "center", color: C.sub }}>
          No submissions yet. Head to <strong>Do a task</strong> to complete one, then it appears here.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[...submissions].sort((a, b) => b.needsReview - a.needsReview).map((s) => (
            <SubmissionRow key={s.id} s={s} onReview={onReview} />
          ))}
        </div>
      )}
    </div>
  );
}

function SubmissionRow({ s, onReview }) {
  const flagged = s.results.filter((r) => r.status === "flag" || r.status === "missing").length;
  return (
    <div className="card" style={{ padding: "16px 18px", display: "flex", alignItems: "center", gap: 16, borderLeft: `4px solid ${s.needsReview ? C.flag : C.pass}` }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 15 }}>{s.checklistTitle}</div>
        <div style={{ fontSize: 13, color: C.sub, marginTop: 2 }}>{s.pm} · {s.property} · {s.time}</div>
      </div>
      {s.needsReview ? (
        <span className="pill" style={{ background: C.flagBg, color: C.flag }}><AlertTriangle size={13} /> {flagged} step{flagged > 1 ? "s" : ""} to check</span>
      ) : (
        <span className="pill" style={{ background: C.passBg, color: C.pass }}><CheckCircle2 size={13} /> All passed</span>
      )}
      <button className="btn-ghost" onClick={() => onReview(s)} style={{ display: "flex", alignItems: "center", gap: 6 }}><Eye size={15} /> View</button>
    </div>
  );
}

function PickTask({ checklists, onPick }) {
  return (
    <div>
      <Header title="Do a task" sub="Pick a checklist. Work through each step and attach evidence." />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 14 }}>
        {checklists.map((cl) => (
          <button key={cl.id} onClick={() => onPick(cl)} className="card" style={{ padding: 20, textAlign: "left", cursor: "pointer" }}>
            <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 6 }}>{cl.title}</div>
            <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.5, marginBottom: 12 }}>{cl.desc}</div>
            <div style={{ fontSize: 12, color: C.teal, fontWeight: 600 }}>{cl.steps.length} steps &rarr;</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function DoTask({ checklist, onSubmit, onBack, defaultName }) {
  const [pmName, setPmName] = useState(defaultName || "");
  const [property, setProperty] = useState("");
  const [started, setStarted] = useState(false);
  const [state, setState] = useState(() => checklist.steps.map((st) => ({ stepId: st.id, done: false, value: "", status: "pending", note: "" })));
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

  const complete = (idx, step) => {
    setState((prev) => {
      const next = [...prev];
      let res = { status: "pass", note: "Confirmed." };
      if (step.evidence === "screenshot") res = mockAICheck();
      next[idx] = { ...next[idx], done: true, status: res.status, note: res.note };
      return next;
    });
  };
  const setValue = (idx, v) => setState((prev) => { const n = [...prev]; n[idx] = { ...n[idx], value: v }; return n; });

  const submit = () => {
    const needsReview = state.some((s) => s.status === "flag" || s.status === "missing");
    onSubmit({
      id: Date.now().toString(),
      checklistTitle: checklist.title,
      pm: pmName, property: property, time: "Just now", needsReview,
      results: state.map((s) => { const step = checklist.steps.find((x) => x.id === s.stepId); return { text: step.text, group: step.group, evidence: step.evidence, status: s.done ? s.status : "missing", note: s.done ? s.note : "Step not completed.", value: s.value }; }),
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
                            <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => setValue(i, e.target.files[0]?.name || "screenshot.png")} />
                          </label>
                        )}
                        <button className="btn-primary" onClick={() => complete(i, step)} disabled={step.evidence === "reference" && !s.value} style={{ opacity: step.evidence === "reference" && !s.value ? 0.5 : 1 }}>
                          {step.evidence === "tick" ? "Mark done" : "Complete step"}
                        </button>
                      </div>
                    )}

                    {s.done && (
                      <div style={{ marginTop: 10, padding: "9px 12px", background: sm.bg, borderRadius: 8, fontSize: 13, color: sm.color, display: "flex", alignItems: "center", gap: 8 }}>
                        <sm.Icon size={15} /> <strong>{sm.label}.</strong> <span style={{ color: C.sub }}>{s.note}</span>
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
        <button className="btn-primary" onClick={submit} disabled={!allDone} style={{ opacity: allDone ? 1 : 0.5, padding: "11px 24px" }}>Submit for oversight</button>
      </div>
    </div>
  );
}

function ReviewModal({ submission, onClose }) {
  let lastGroup = null;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,42,67,0.4)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 50 }}>
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
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Builder({ checklists, setChecklists }) {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [steps, setSteps] = useState([{ text: "", evidence: "screenshot" }]);

  const addStep = () => setSteps((s) => [...s, { text: "", evidence: "screenshot" }]);
  const rmStep = (i) => setSteps((s) => s.filter((_, x) => x !== i));
  const upStep = (i, k, v) => setSteps((s) => { const n = [...s]; n[i] = { ...n[i], [k]: v }; return n; });

  const save = () => {
    if (!title.trim() || steps.some((s) => !s.text.trim())) return;
    const cl = { id: Date.now().toString(), title, desc, steps: steps.map((s, i) => ({ ...s, id: `n${i}`, group: null })) };
    setChecklists((c) => [...c, cl]);
    setTitle(""); setDesc(""); setSteps([{ text: "", evidence: "screenshot" }]);
  };

  return (
    <div>
      <Header title="Checklists" sub="Build a new checklist. Any task can be added here without a rebuild." />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontWeight: 600, marginBottom: 14 }}>New checklist</div>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title (e.g. Property Viewing)" style={inp} />
          <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Short description" style={{ ...inp, marginTop: 10 }} />
          <div style={{ fontSize: 13, fontWeight: 600, margin: "16px 0 8px", color: C.sub }}>Steps</div>
          {steps.map((st, i) => (
            <div key={i} style={{ padding: 12, border: `1px solid ${C.line}`, borderRadius: 9, marginBottom: 10 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.teal, paddingTop: 8 }}>{i + 1}</span>
                <div style={{ flex: 1 }}>
                  <input value={st.text} onChange={(e) => upStep(i, "text", e.target.value)} placeholder="What must be done" style={{ ...inp, marginBottom: 8 }} />
                  <div style={{ display: "flex", gap: 8 }}>
                    <select value={st.evidence} onChange={(e) => upStep(i, "evidence", e.target.value)} style={{ ...inp, flex: 1 }}>
                      {Object.entries(EVIDENCE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                    {steps.length > 1 && <button onClick={() => rmStep(i)} className="btn-ghost" style={{ padding: "0 12px" }}><Trash2 size={15} /></button>}
                  </div>
                </div>
              </div>
            </div>
          ))}
          <button onClick={addStep} className="btn-ghost" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 16 }}><Plus size={15} /> Add step</button>
          <div><button onClick={save} className="btn-primary">Save checklist</button></div>
        </div>

        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.sub, marginBottom: 10 }}>Existing checklists ({checklists.length})</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {checklists.map((cl) => (
              <div key={cl.id} className="card" style={{ padding: 15 }}>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{cl.title}</div>
                <div style={{ fontSize: 13, color: C.sub, margin: "3px 0 8px" }}>{cl.desc}</div>
                <div style={{ fontSize: 12, color: C.teal }}>{cl.steps.length} steps</div>
              </div>
            ))}
          </div>
        </div>
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
