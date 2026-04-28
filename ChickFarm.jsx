import { useState, useEffect, useCallback, useMemo } from "react";
import {
  LineChart, Line, BarChart, Bar, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, ComposedChart, Area
} from "recharts";

/* ─── FONTS ─── */
const fontLink = document.createElement("link");
fontLink.rel = "stylesheet";
fontLink.href = "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:wght@300;400;500;600&display=swap";
document.head.appendChild(fontLink);

/* ─── THEME ─── */
const T = {
  cream: "#FDF8F0",
  parchment: "#F5EDD8",
  straw: "#E8D5A3",
  amber: "#C8922A",
  darkAmber: "#9E6B15",
  brown: "#3D2B1F",
  bark: "#6B4226",
  moss: "#4A7C59",
  darkMoss: "#2D5140",
  rust: "#B54A2A",
  sky: "#5B8DB8",
  gold: "#D4A82A",
  shadow: "rgba(61,43,31,0.12)",
};

/* ─── CATEGORY CONFIG ─── */
const CATEGORIES = [
  { key: "avgWeight",    label: "Avg Bird Weight (kg)", color: T.amber,   icon: "⚖️" },
  { key: "foodSupplied", label: "Food Supplied (kg)",   color: T.moss,    icon: "🌾" },
  { key: "deaths",       label: "Deaths",               color: T.rust,    icon: "💀" },
  { key: "injured",      label: "Injured Birds",        color: "#E07B39", icon: "🩹" },
  { key: "soldBirds",    label: "Birds Sold",           color: T.sky,     icon: "🐔" },
  { key: "unsoldBirds",  label: "Birds Unsold",         color: "#8B6BAE", icon: "🏠" },
  { key: "expenses",     label: "Expenses (UGX)",       color: T.rust,    icon: "💸" },
  { key: "income",       label: "Income (UGX)",         color: T.darkMoss,icon: "💰" },
];

const catMap = Object.fromEntries(CATEGORIES.map(c => [c.key, c]));

/* ─── HELPERS ─── */
const fmtDate = d => {
  const dt = new Date(d);
  return dt.toLocaleDateString("en-UG", { day:"2-digit", month:"short", year:"numeric" });
};
const fmtNum = (n, key) => {
  if (n === null || n === undefined || n === "") return "—";
  const v = Number(n);
  if (["expenses","income"].includes(key)) return `UGX ${v.toLocaleString()}`;
  if (["avgWeight","foodSupplied"].includes(key)) return `${v} kg`;
  return v.toLocaleString();
};
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2);

/* ─── STYLES ─── */
const S = {
  app: {
    fontFamily: "'DM Sans', sans-serif",
    background: T.cream,
    minHeight: "100vh",
    color: T.brown,
  },
  sidebar: {
    width: 220,
    background: T.brown,
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    padding: "0 0 24px",
    position: "fixed",
    top: 0, left: 0, bottom: 0,
    zIndex: 100,
    boxShadow: `4px 0 20px ${T.shadow}`,
  },
  logo: {
    padding: "28px 20px 20px",
    borderBottom: `1px solid rgba(255,255,255,0.1)`,
  },
  logoTitle: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 19,
    fontWeight: 700,
    color: T.straw,
    lineHeight: 1.2,
    margin: 0,
  },
  logoSub: { fontSize: 11, color: "rgba(232,213,163,0.6)", marginTop: 3, letterSpacing: "0.06em" },
  nav: { flex: 1, padding: "16px 0" },
  navItem: (active) => ({
    display: "flex", alignItems: "center", gap: 10,
    padding: "10px 20px",
    cursor: "pointer",
    color: active ? T.straw : "rgba(232,213,163,0.55)",
    background: active ? "rgba(200,146,42,0.18)" : "transparent",
    borderLeft: active ? `3px solid ${T.amber}` : "3px solid transparent",
    fontSize: 14, fontWeight: active ? 600 : 400,
    transition: "all 0.18s",
    userSelect: "none",
  }),
  userBadge: {
    margin: "0 16px",
    padding: "10px 14px",
    background: "rgba(255,255,255,0.07)",
    borderRadius: 10,
    fontSize: 12,
    color: T.straw,
  },
  main: { marginLeft: 220, padding: "32px 36px", maxWidth: 1100 },
  pageTitle: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 28, fontWeight: 700, color: T.brown, margin: "0 0 6px",
  },
  pageSubtitle: { fontSize: 14, color: T.bark, margin: "0 0 28px" },
  card: {
    background: "#fff",
    borderRadius: 14,
    boxShadow: `0 2px 16px ${T.shadow}`,
    padding: "24px",
    marginBottom: 24,
  },
  statGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
    gap: 16, marginBottom: 24,
  },
  statCard: (color) => ({
    background: "#fff",
    borderRadius: 12,
    boxShadow: `0 2px 12px ${T.shadow}`,
    padding: "18px 20px",
    borderTop: `4px solid ${color}`,
  }),
  statLabel: { fontSize: 11, color: T.bark, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 },
  statValue: (color) => ({ fontSize: 26, fontWeight: 600, color }),
  statSub: { fontSize: 12, color: T.bark, marginTop: 3 },
  btn: (variant="primary") => ({
    padding: "10px 22px",
    borderRadius: 8,
    border: "none",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 600,
    fontFamily: "'DM Sans', sans-serif",
    background: variant === "primary" ? T.amber : variant === "danger" ? T.rust : T.parchment,
    color: variant === "secondary" ? T.brown : "#fff",
    boxShadow: `0 2px 8px ${T.shadow}`,
    transition: "all 0.15s",
  }),
  input: {
    width: "100%",
    padding: "10px 14px",
    borderRadius: 8,
    border: `1.5px solid ${T.straw}`,
    fontSize: 14,
    fontFamily: "'DM Sans', sans-serif",
    background: T.cream,
    color: T.brown,
    boxSizing: "border-box",
    outline: "none",
    transition: "border 0.15s",
  },
  label: { fontSize: 12, fontWeight: 600, color: T.bark, marginBottom: 5, display: "block", letterSpacing:"0.04em" },
  formGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px 24px" },
  tag: (color) => ({
    display: "inline-block",
    padding: "2px 9px",
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 600,
    background: color + "22",
    color: color,
    letterSpacing: "0.04em",
  }),
  select: {
    padding: "10px 14px",
    borderRadius: 8,
    border: `1.5px solid ${T.straw}`,
    fontSize: 14,
    fontFamily: "'DM Sans', sans-serif",
    background: T.cream,
    color: T.brown,
    outline: "none",
    cursor: "pointer",
  },
  activityRow: {
    display: "flex", alignItems: "flex-start", gap: 12,
    padding: "12px 0",
    borderBottom: `1px solid ${T.parchment}`,
  },
  sectionTitle: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 18, fontWeight: 600, color: T.brown, margin: "0 0 16px",
  },
  compareRow: { display: "flex", gap: 16, alignItems: "center", marginBottom: 20, flexWrap: "wrap" },
};

/* ─── MAIN APP ─── */
export default function ChickFarm() {
  const [view, setView] = useState("dashboard");
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState(() => localStorage.getItem("cf_user") || "");
  const [showUserModal, setShowUserModal] = useState(!localStorage.getItem("cf_user"));
  const [toast, setToast] = useState(null);

  // Load shared records
  const loadRecords = useCallback(async () => {
    try {
      const res = await window.storage.get("cf_records", true);
      if (res) setRecords(JSON.parse(res.value));
    } catch { setRecords([]); }
    setLoading(false);
  }, []);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  const saveRecords = async (newRecs) => {
    setRecords(newRecs);
    await window.storage.set("cf_records", JSON.stringify(newRecs), true);
  };

  const showToast = (msg, type="success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const addRecord = async (rec) => {
    const newRecs = [{ ...rec, id: uid(), addedBy: userName, createdAt: Date.now() }, ...records]
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    await saveRecords(newRecs);
    showToast("Record saved successfully!");
    setView("dashboard");
  };

  const deleteRecord = async (id) => {
    await saveRecords(records.filter(r => r.id !== id));
    showToast("Record deleted.", "danger");
  };

  // Latest aggregates for dashboard
  const latest = records[0];
  const last7 = records.slice(0, 7);

  const totals = useMemo(() => {
    if (!records.length) return {};
    const sum = (key) => records.reduce((a, r) => a + (Number(r[key]) || 0), 0);
    return {
      income: sum("income"), expenses: sum("expenses"),
      deaths: sum("deaths"), injured: sum("injured"),
      sold: sum("soldBirds"),
      profit: sum("income") - sum("expenses"),
    };
  }, [records]);

  const navItems = [
    { id: "dashboard", label: "Dashboard",   icon: "📊" },
    { id: "add",       label: "Add Record",   icon: "➕" },
    { id: "records",   label: "All Records",  icon: "📋" },
    { id: "stats",     label: "Statistics",   icon: "📈" },
    { id: "compare",   label: "Compare",      icon: "🔀" },
  ];

  return (
    <div style={S.app}>
      {/* SIDEBAR */}
      <div style={S.sidebar}>
        <div style={S.logo}>
          <p style={S.logoTitle}>🐔 ChickFarm<br/>Manager</p>
          <p style={S.logoSub}>FARM RECORD SYSTEM</p>
        </div>
        <nav style={S.nav}>
          {navItems.map(n => (
            <div key={n.id} style={S.navItem(view === n.id)} onClick={() => setView(n.id)}>
              <span>{n.icon}</span> {n.label}
            </div>
          ))}
        </nav>
        <div style={S.userBadge}>
          <div style={{ fontSize: 10, color: "rgba(232,213,163,0.5)", marginBottom: 3 }}>LOGGED IN AS</div>
          <div style={{ fontWeight: 600, color: T.straw }}>{userName || "—"}</div>
          <div
            onClick={() => setShowUserModal(true)}
            style={{ marginTop: 5, fontSize: 11, color: T.amber, cursor: "pointer" }}>
            Change user →
          </div>
        </div>
      </div>

      {/* MAIN */}
      <div style={S.main}>
        {loading ? (
          <div style={{ textAlign:"center", padding:"80px 0", color: T.bark }}>Loading farm data…</div>
        ) : (
          <>
            {view === "dashboard" && <Dashboard records={records} totals={totals} latest={latest} last7={last7} setView={setView} />}
            {view === "add"       && <AddRecord onSave={addRecord} userName={userName} />}
            {view === "records"   && <AllRecords records={records} onDelete={deleteRecord} />}
            {view === "stats"     && <Statistics records={records} />}
            {view === "compare"   && <Compare records={records} />}
          </>
        )}
      </div>

      {/* TOAST */}
      {toast && (
        <div style={{
          position:"fixed", bottom:28, right:28,
          background: toast.type === "danger" ? T.rust : T.darkMoss,
          color:"#fff", padding:"12px 22px", borderRadius:10,
          boxShadow:"0 4px 20px rgba(0,0,0,0.2)", fontSize:14, fontWeight:500,
          zIndex:999, animation:"fadeIn 0.25s ease",
        }}>{toast.msg}</div>
      )}

      {/* USER MODAL */}
      {showUserModal && (
        <UserModal
          current={userName}
          onSave={(name) => {
            setUserName(name);
            localStorage.setItem("cf_user", name);
            setShowUserModal(false);
          }}
        />
      )}
    </div>
  );
}

/* ─── USER MODAL ─── */
function UserModal({ current, onSave }) {
  const [name, setName] = useState(current || "");
  return (
    <div style={{
      position:"fixed", inset:0, background:"rgba(61,43,31,0.55)",
      display:"flex", alignItems:"center", justifyContent:"center", zIndex:200,
    }}>
      <div style={{ ...S.card, width:360, margin:0, textAlign:"center" }}>
        <div style={{ fontSize:40, marginBottom:12 }}>🐔</div>
        <h2 style={{ ...S.pageTitle, fontSize:22, marginBottom:4 }}>Welcome to ChickFarm</h2>
        <p style={{ color:T.bark, fontSize:14, marginBottom:20 }}>
          Who are you? This helps identify who logged each record.
        </p>
        <input
          style={S.input}
          placeholder="e.g. Brother, John, Assistant…"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && name.trim() && onSave(name.trim())}
        />
        <button
          style={{ ...S.btn(), marginTop:16, width:"100%" }}
          onClick={() => name.trim() && onSave(name.trim())}
        >Continue →</button>
      </div>
    </div>
  );
}

/* ─── DASHBOARD ─── */
function Dashboard({ records, totals, latest, last7, setView }) {
  const chartData = [...last7].reverse().map(r => ({
    date: r.date?.slice(5),
    income: r.income || 0,
    expenses: r.expenses || 0,
    deaths: r.deaths || 0,
    foodSupplied: r.foodSupplied || 0,
  }));

  return (
    <>
      <h1 style={S.pageTitle}>Farm Dashboard</h1>
      <p style={S.pageSubtitle}>Real-time overview of your flock and finances</p>

      {/* Stat Cards */}
      <div style={S.statGrid}>
        {[
          { label:"Total Income",   value: `UGX ${(totals.income||0).toLocaleString()}`,    color: T.darkMoss, icon:"💰" },
          { label:"Total Expenses", value: `UGX ${(totals.expenses||0).toLocaleString()}`,  color: T.rust,     icon:"💸" },
          { label:"Net Profit",     value: `UGX ${(totals.profit||0).toLocaleString()}`,    color: totals.profit>=0 ? T.darkMoss : T.rust, icon:"📊" },
          { label:"Total Deaths",   value: (totals.deaths||0).toLocaleString(),              color: T.rust,     icon:"💀" },
          { label:"Birds Sold",     value: (totals.sold||0).toLocaleString(),                color: T.sky,      icon:"🐔" },
          { label:"Total Records",  value: records.length.toString(),                         color: T.amber,    icon:"📋" },
        ].map(s => (
          <div key={s.label} style={S.statCard(s.color)}>
            <div style={S.statLabel}>{s.icon} {s.label}</div>
            <div style={S.statValue(s.color)}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div style={S.card}>
          <h3 style={S.sectionTitle}>Income vs Expenses (Last {chartData.length} Records)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.straw} />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="income" fill={T.darkMoss+"33"} stroke={T.darkMoss} strokeWidth={2} name="Income" />
              <Line type="monotone" dataKey="expenses" stroke={T.rust} strokeWidth={2} dot={false} name="Expenses" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Recent Activity */}
      <div style={S.card}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <h3 style={{ ...S.sectionTitle, margin:0 }}>Recent Activity</h3>
          <button style={S.btn("secondary")} onClick={() => setView("records")}>View All</button>
        </div>
        {records.length === 0 ? (
          <div style={{ textAlign:"center", padding:"32px 0", color:T.bark }}>
            <div style={{ fontSize:40, marginBottom:12 }}>🐣</div>
            <p>No records yet. Start by adding your first record!</p>
            <button style={{ ...S.btn(), marginTop:8 }} onClick={() => setView("add")}>+ Add First Record</button>
          </div>
        ) : records.slice(0, 5).map(r => (
          <div key={r.id} style={S.activityRow}>
            <div style={{ fontSize:22 }}>📅</div>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:600, fontSize:14 }}>{fmtDate(r.date)}</div>
              <div style={{ fontSize:12, color:T.bark, marginTop:2 }}>
                Deaths: {r.deaths||0} · Food: {r.foodSupplied||0}kg · Income: UGX {(r.income||0).toLocaleString()} · Expenses: UGX {(r.expenses||0).toLocaleString()}
              </div>
              {r.notes && <div style={{ fontSize:12, color:T.bark, fontStyle:"italic", marginTop:2 }}>"{r.notes}"</div>}
            </div>
            <div style={S.tag(T.amber)}>{r.addedBy}</div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ─── ADD RECORD ─── */
function AddRecord({ onSave, userName }) {
  const empty = {
    date: new Date().toISOString().slice(0, 10),
    avgWeight: "", foodSupplied: "", deaths: "", injured: "",
    soldBirds: "", unsoldBirds: "", expenses: "", income: "", notes: "",
  };
  const [form, setForm] = useState(empty);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const fields = [
    { key:"avgWeight",    label:"Avg Bird Weight (kg)",  type:"number", placeholder:"e.g. 1.8" },
    { key:"foodSupplied", label:"Food Supplied (kg)",    type:"number", placeholder:"e.g. 50" },
    { key:"deaths",       label:"Number of Deaths",      type:"number", placeholder:"e.g. 2" },
    { key:"injured",      label:"Injured Birds",         type:"number", placeholder:"e.g. 1" },
    { key:"soldBirds",    label:"Birds Sold",            type:"number", placeholder:"e.g. 100" },
    { key:"unsoldBirds",  label:"Unsold Birds",          type:"number", placeholder:"e.g. 50" },
    { key:"expenses",     label:"Expenses (UGX)",        type:"number", placeholder:"e.g. 150000" },
    { key:"income",       label:"Income (UGX)",          type:"number", placeholder:"e.g. 500000" },
  ];

  const handleSubmit = () => {
    if (!form.date) return alert("Please select a date");
    onSave(form);
  };

  return (
    <>
      <h1 style={S.pageTitle}>Add Farm Record</h1>
      <p style={S.pageSubtitle}>Logging as <strong>{userName}</strong> — fill in any or all fields for this record</p>
      <div style={S.card}>
        <div style={{ marginBottom:20 }}>
          <label style={S.label}>📅 Date of Record</label>
          <input type="date" style={{ ...S.input, width:"220px" }} value={form.date}
            onChange={e => set("date", e.target.value)} />
        </div>
        <div style={S.formGrid}>
          {fields.map(f => (
            <div key={f.key}>
              <label style={S.label}>{catMap[f.key]?.icon} {f.label}</label>
              <input
                type={f.type} placeholder={f.placeholder}
                style={S.input} value={form[f.key]}
                onChange={e => set(f.key, e.target.value)}
              />
            </div>
          ))}
        </div>
        <div style={{ marginTop:16 }}>
          <label style={S.label}>📝 Notes / Observations</label>
          <textarea
            style={{ ...S.input, minHeight:80, resize:"vertical" }}
            placeholder="e.g. Started new feed batch, noticed birds eating more..."
            value={form.notes}
            onChange={e => set("notes", e.target.value)}
          />
        </div>
        <div style={{ marginTop:20, display:"flex", gap:12 }}>
          <button style={S.btn()} onClick={handleSubmit}>💾 Save Record</button>
          <button style={S.btn("secondary")} onClick={() => setForm(empty)}>Clear</button>
        </div>
      </div>
    </>
  );
}

/* ─── ALL RECORDS ─── */
function AllRecords({ records, onDelete }) {
  const [search, setSearch] = useState("");
  const filtered = records.filter(r =>
    !search || r.date?.includes(search) || r.addedBy?.toLowerCase().includes(search.toLowerCase()) || r.notes?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <h1 style={S.pageTitle}>All Records</h1>
      <p style={S.pageSubtitle}>{records.length} total records — shared between all farm users</p>
      <div style={{ ...S.card, padding:"16px 20px" }}>
        <input style={{ ...S.input, width:320 }} placeholder="🔍 Search by date, user, notes…"
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      {filtered.length === 0 ? (
        <div style={{ ...S.card, textAlign:"center", color:T.bark, padding:"40px" }}>No records found.</div>
      ) : filtered.map(r => (
        <RecordCard key={r.id} r={r} onDelete={onDelete} />
      ))}
    </>
  );
}

function RecordCard({ r, onDelete }) {
  const [open, setOpen] = useState(false);
  const metrics = CATEGORIES.filter(c => r[c.key] !== undefined && r[c.key] !== "");

  return (
    <div style={S.card}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:6 }}>
            <span style={{ fontFamily:"'Playfair Display',serif", fontSize:17, fontWeight:600 }}>
              {fmtDate(r.date)}
            </span>
            <span style={S.tag(T.amber)}>{r.addedBy}</span>
          </div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
            {metrics.slice(0, 4).map(c => (
              <span key={c.key} style={S.tag(c.color)}>
                {c.icon} {c.label.split(" ")[0]}: {fmtNum(r[c.key], c.key)}
              </span>
            ))}
            {metrics.length > 4 && !open && (
              <span style={{ fontSize:12, color:T.bark, cursor:"pointer" }} onClick={() => setOpen(true)}>
                +{metrics.length - 4} more…
              </span>
            )}
          </div>
          {open && (
            <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginTop:8 }}>
              {metrics.slice(4).map(c => (
                <span key={c.key} style={S.tag(c.color)}>
                  {c.icon} {c.label.split(" ")[0]}: {fmtNum(r[c.key], c.key)}
                </span>
              ))}
            </div>
          )}
          {r.notes && <div style={{ marginTop:8, fontSize:13, color:T.bark, fontStyle:"italic" }}>📝 {r.notes}</div>}
        </div>
        <button
          onClick={() => window.confirm("Delete this record?") && onDelete(r.id)}
          style={{ ...S.btn("danger"), padding:"6px 14px", fontSize:13 }}>🗑️</button>
      </div>
    </div>
  );
}

/* ─── STATISTICS ─── */
function Statistics({ records }) {
  const [catKey, setCatKey] = useState("income");
  const [period, setPeriod] = useState("all");

  const filtered = useMemo(() => {
    const now = new Date();
    return records.filter(r => {
      if (period === "all") return true;
      const d = new Date(r.date);
      const days = (now - d) / 86400000;
      if (period === "7d") return days <= 7;
      if (period === "30d") return days <= 30;
      if (period === "90d") return days <= 90;
      return true;
    });
  }, [records, period]);

  const chartData = useMemo(() =>
    [...filtered].reverse().map(r => ({
      date: r.date?.slice(5),
      value: Number(r[catKey]) || 0,
    })), [filtered, catKey]);

  const cat = catMap[catKey];
  const values = chartData.map(d => d.value).filter(v => v > 0);
  const avg = values.length ? (values.reduce((a,b) => a+b, 0) / values.length).toFixed(1) : 0;
  const max = values.length ? Math.max(...values) : 0;
  const min = values.length ? Math.min(...values) : 0;

  return (
    <>
      <h1 style={S.pageTitle}>Statistics</h1>
      <p style={S.pageSubtitle}>Track trends over time for each farm metric</p>

      <div style={{ ...S.card, padding:"16px 20px" }}>
        <div style={{ display:"flex", gap:16, flexWrap:"wrap", alignItems:"center" }}>
          <div>
            <label style={S.label}>Category</label>
            <select style={S.select} value={catKey} onChange={e => setCatKey(e.target.value)}>
              {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.icon} {c.label}</option>)}
            </select>
          </div>
          <div>
            <label style={S.label}>Time Period</label>
            <select style={S.select} value={period} onChange={e => setPeriod(e.target.value)}>
              <option value="all">All Time</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
            </select>
          </div>
        </div>
      </div>

      {/* Summary stats */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:16, marginBottom:24 }}>
        {[["Average", avg], ["Maximum", max], ["Minimum", min]].map(([l, v]) => (
          <div key={l} style={S.statCard(cat.color)}>
            <div style={S.statLabel}>{l}</div>
            <div style={S.statValue(cat.color)}>{fmtNum(v, catKey)}</div>
          </div>
        ))}
      </div>

      <div style={S.card}>
        <h3 style={S.sectionTitle}>{cat.icon} {cat.label} Over Time</h3>
        {chartData.length < 2 ? (
          <div style={{ textAlign:"center", color:T.bark, padding:"40px 0" }}>
            Not enough data for this period. Add more records!
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.parchment} />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v) => fmtNum(v, catKey)} />
              <ReferenceLine y={Number(avg)} stroke={T.bark} strokeDasharray="4 4" label={{ value: `Avg: ${avg}`, fill: T.bark, fontSize: 11 }} />
              <Area type="monotone" dataKey="value" fill={cat.color + "22"} stroke={cat.color} strokeWidth={2.5} name={cat.label} dot={{ fill: cat.color, r: 4 }} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Bar chart */}
      {chartData.length >= 2 && (
        <div style={S.card}>
          <h3 style={S.sectionTitle}>Bar View</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.parchment} />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v) => fmtNum(v, catKey)} />
              <Bar dataKey="value" fill={cat.color} name={cat.label} radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </>
  );
}

/* ─── COMPARE ─── */
function Compare({ records }) {
  const [catA, setCatA] = useState("foodSupplied");
  const [catB, setCatB] = useState("deaths");

  const scatterData = useMemo(() =>
    records
      .filter(r => r[catA] !== "" && r[catB] !== "" && r[catA] !== undefined && r[catB] !== undefined)
      .map(r => ({ x: Number(r[catA]) || 0, y: Number(r[catB]) || 0, date: r.date })),
    [records, catA, catB]);

  const dualData = useMemo(() =>
    [...records].reverse().map(r => ({
      date: r.date?.slice(5),
      [catA]: Number(r[catA]) || 0,
      [catB]: Number(r[catB]) || 0,
    })), [records, catA, catB]);

  // Simple Pearson correlation
  const correlation = useMemo(() => {
    if (scatterData.length < 3) return null;
    const n = scatterData.length;
    const xs = scatterData.map(d => d.x);
    const ys = scatterData.map(d => d.y);
    const mx = xs.reduce((a,b) => a+b, 0) / n;
    const my = ys.reduce((a,b) => a+b, 0) / n;
    const num = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0);
    const den = Math.sqrt(
      xs.reduce((s, x) => s + (x - mx) ** 2, 0) *
      ys.reduce((s, y) => s + (y - my) ** 2, 0)
    );
    return den === 0 ? 0 : (num / den).toFixed(3);
  }, [scatterData]);

  const corrLabel = (r) => {
    if (r === null) return "Need more data";
    const v = Math.abs(r);
    const dir = r > 0 ? "positive" : "negative";
    if (v > 0.7) return `Strong ${dir} correlation`;
    if (v > 0.4) return `Moderate ${dir} correlation`;
    if (v > 0.2) return `Weak ${dir} correlation`;
    return "No significant correlation";
  };

  const cA = catMap[catA], cB = catMap[catB];

  return (
    <>
      <h1 style={S.pageTitle}>Compare & Correlate</h1>
      <p style={S.pageSubtitle}>Discover relationships between different farm metrics</p>

      <div style={{ ...S.card, padding:"16px 20px" }}>
        <div style={S.compareRow}>
          <div>
            <label style={S.label}>Category A (X-axis)</label>
            <select style={{ ...S.select, borderColor: cA.color }} value={catA} onChange={e => setCatA(e.target.value)}>
              {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.icon} {c.label}</option>)}
            </select>
          </div>
          <div style={{ fontSize:22, marginTop:18, color:T.bark }}>vs</div>
          <div>
            <label style={S.label}>Category B (Y-axis)</label>
            <select style={{ ...S.select, borderColor: cB.color }} value={catB} onChange={e => setCatB(e.target.value)}>
              {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.icon} {c.label}</option>)}
            </select>
          </div>
        </div>

        {/* Correlation badge */}
        {correlation !== null && (
          <div style={{
            display:"inline-flex", alignItems:"center", gap:10,
            padding:"10px 18px", borderRadius:10,
            background: Math.abs(correlation) > 0.5 ? T.amber+"22" : T.parchment,
            border: `1.5px solid ${Math.abs(correlation) > 0.5 ? T.amber : T.straw}`,
          }}>
            <span style={{ fontSize:22 }}>📐</span>
            <div>
              <div style={{ fontWeight:700, fontSize:16, color:T.brown }}>r = {correlation}</div>
              <div style={{ fontSize:12, color:T.bark }}>{corrLabel(Number(correlation))}</div>
            </div>
          </div>
        )}
      </div>

      {/* Scatter plot */}
      <div style={S.card}>
        <h3 style={S.sectionTitle}>Scatter Plot — {cA.icon} {cA.label} vs {cB.icon} {cB.label}</h3>
        {scatterData.length < 2 ? (
          <div style={{ textAlign:"center", color:T.bark, padding:"40px 0" }}>
            Not enough overlapping data points yet.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" stroke={T.parchment} />
              <XAxis dataKey="x" name={cA.label} tick={{ fontSize:12 }} label={{ value: cA.label, position:"insideBottom", offset:-5, fontSize:12 }} />
              <YAxis dataKey="y" name={cB.label} tick={{ fontSize:12 }} label={{ value: cB.label, angle:-90, position:"insideLeft", fontSize:12 }} />
              <Tooltip cursor={{ strokeDasharray: "3 3" }} content={({ payload }) => {
                if (!payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div style={{ background:"#fff", border:`1px solid ${T.straw}`, padding:"8px 12px", borderRadius:8, fontSize:12 }}>
                    <div style={{ fontWeight:600, marginBottom:4 }}>{fmtDate(d.date)}</div>
                    <div>{cA.label}: {fmtNum(d.x, catA)}</div>
                    <div>{cB.label}: {fmtNum(d.y, catB)}</div>
                  </div>
                );
              }} />
              <Scatter data={scatterData} fill={T.amber} opacity={0.8} />
            </ScatterChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Dual line chart */}
      {dualData.length >= 2 && (
        <div style={S.card}>
          <h3 style={S.sectionTitle}>Side-by-Side Over Time</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={dualData}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.parchment} />
              <XAxis dataKey="date" tick={{ fontSize:12 }} />
              <YAxis yAxisId="left" tick={{ fontSize:12 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize:12 }} />
              <Tooltip />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey={catA} stroke={cA.color} strokeWidth={2.5} dot={false} name={`${cA.icon} ${cA.label}`} />
              <Line yAxisId="right" type="monotone" dataKey={catB} stroke={cB.color} strokeWidth={2.5} dot={false} name={`${cB.icon} ${cB.label}`} strokeDasharray="5 4" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Correlation guide */}
      <div style={S.card}>
        <h3 style={S.sectionTitle}>📚 How to Read Correlations</h3>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          {[
            ["r close to +1", "Strong positive — when A goes up, B goes up", T.darkMoss],
            ["r close to -1", "Strong negative — when A goes up, B goes down", T.rust],
            ["r near 0",      "No relationship between the two metrics", T.bark],
            ["r = 0.4–0.7",   "Moderate relationship worth monitoring", T.amber],
          ].map(([label, desc, color]) => (
            <div key={label} style={{ padding:"10px 14px", borderRadius:8, background:T.parchment }}>
              <div style={{ fontWeight:700, color, marginBottom:3 }}>{label}</div>
              <div style={{ fontSize:13, color:T.bark }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
