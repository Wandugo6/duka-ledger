import { useState, useEffect, useCallback } from "react";
import { Store, Warehouse, TrendingUp, ArrowLeftRight, ClipboardList, Plus, X, ChevronDown, Lock, LogOut, Calendar, Trash2, Download, Truck, WifiOff } from "lucide-react";
import {
  fetchSales,
  insertSale,
  deleteSale as deleteSaleRow,
  fetchTransfers,
  insertTransfer,
  deleteTransfer as deleteTransferRow,
  getSetting,
  setSetting,
  subscribeToChanges,
} from "./dataStore";

const SHOPS = ["Rosyambu/Lumumba", "Pop In", "B4", "Floress C4", "Floress Platinum"];
const WAREHOUSE = "Warehouse (Eastleigh)";
const EXTERNAL_SOURCE = "Eastleigh supplier";
// All locations an employee can be stationed at, and that stock can move between.
const ALL_LOCATIONS = [WAREHOUSE, ...SHOPS];

function todayStr() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function fmtMoney(n) {
  return "KSh " + Number(n || 0).toLocaleString("en-KE");
}

function fmtTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" });
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function toDateStr(d) {
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

// Monday-start week containing dateStr
function startOfWeek(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay(); // 0 = Sun
  const diff = day === 0 ? 6 : day - 1; // days since Monday
  d.setDate(d.getDate() - diff);
  return toDateStr(d);
}

function startOfMonth(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return toDateStr(new Date(d.getFullYear(), d.getMonth(), 1));
}

function endOfMonth(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return toDateStr(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

function startOfYear(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return toDateStr(new Date(d.getFullYear(), 0, 1));
}

function endOfYear(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return toDateStr(new Date(d.getFullYear(), 11, 31));
}

function fmtDateShort(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
}

export default function ShopTracker() {
  const [role, setRole] = useState(null); // null | 'owner' | 'employee'
  const [shop, setShop] = useState(null);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);

  const [sales, setSales] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [ownerPin, setOwnerPin] = useState(null); // null while loading; "" means "not set yet"
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [isOffline, setIsOffline] = useState(typeof navigator !== "undefined" ? !navigator.onLine : false);

  const [tab, setTab] = useState("entry"); // entry | log
  const [showSaleForm, setShowSaleForm] = useState(false);
  const [showTransferForm, setShowTransferForm] = useState(false);

  const [ownerRangeStart, setOwnerRangeStart] = useState(todayStr());
  const [ownerRangeEnd, setOwnerRangeEnd] = useState(todayStr());
  const [ownerShopFilter, setOwnerShopFilter] = useState("All");

  // ---- Load data from Supabase, then keep it live with realtime updates ----
  const reloadAll = useCallback(async () => {
    const [s, t] = await Promise.all([fetchSales(), fetchTransfers()]);
    setSales(s);
    setTransfers(t);
  }, []);

  useEffect(() => {
    async function load() {
      try {
        await reloadAll();
        setLoadError(null);
      } catch (e) {
        console.error("load failed", e);
        setLoadError(
          "Couldn't reach the database. Check your internet connection, then reload the page."
        );
      }
      try {
        const p = await getSetting("owner-pin");
        setOwnerPin(p || "");
      } catch (e) {
        setOwnerPin("");
      }
      setLoaded(true);
    }
    load();

    // Live sync: when any device adds/removes a sale or transfer, every other
    // open device picks it up automatically without a manual refresh.
    const unsubscribe = subscribeToChanges(() => {
      reloadAll().catch((e) => console.error("realtime reload failed", e));
    });

    return () => unsubscribe();
  }, [reloadAll]);

  // ---- Online/offline indicator ----
  useEffect(() => {
    function goOnline() {
      setIsOffline(false);
      reloadAll().catch((e) => console.error("reload after reconnect failed", e));
    }
    function goOffline() {
      setIsOffline(true);
    }
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [reloadAll]);

  const addSaleEntry = useCallback(async (entry) => {
    const saved = await insertSale(entry);
    setSales((prev) => [saved, ...prev]);
  }, []);

  const addTransferEntry = useCallback(async (entry) => {
    const saved = await insertTransfer(entry);
    setTransfers((prev) => [saved, ...prev]);
  }, []);

  const removeSaleEntry = useCallback(async (id) => {
    setSales((prev) => prev.filter((s) => s.id !== id));
    try {
      await deleteSaleRow(id);
    } catch (e) {
      console.error("delete failed", e);
      reloadAll().catch(() => {});
    }
  }, [reloadAll]);

  const removeTransferEntry = useCallback(async (id) => {
    setTransfers((prev) => prev.filter((t) => t.id !== id));
    try {
      await deleteTransferRow(id);
    } catch (e) {
      console.error("delete failed", e);
      reloadAll().catch(() => {});
    }
  }, [reloadAll]);

  const persistOwnerPin = useCallback(async (newPin) => {
    setOwnerPin(newPin);
    try {
      await setSetting("owner-pin", newPin);
    } catch (e) {
      console.error("save failed", e);
    }
  }, []);

  // ---- Auth screens ----
  if (!role) {
    return (
      <RoleSelect
        onEmployee={() => setRole("pick-shop")}
        onOwner={() => setRole("owner-pin")}
      />
    );
  }

  if (role === "pick-shop") {
    return (
      <ShopSelect
        onPick={(s) => {
          setShop(s);
          setRole("employee");
        }}
        onBack={() => setRole(null)}
      />
    );
  }

  if (role === "owner-pin") {
    if (!loaded) {
      return (
        <div style={wrap}>
          <div style={{ ...card, textAlign: "center", color: "#8a8378" }}>Loading…</div>
        </div>
      );
    }

    // No PIN has ever been set yet — let the owner create one before going further.
    if (!ownerPin) {
      return (
        <SetPinScreen
          mode="create"
          onBack={() => {
            setRole(null);
            setPinInput("");
            setPinError(false);
          }}
          onSave={async (newPin) => {
            await persistOwnerPin(newPin);
            setRole("owner");
            setPinInput("");
            setPinError(false);
          }}
        />
      );
    }

    return (
      <PinScreen
        pinInput={pinInput}
        setPinInput={setPinInput}
        error={pinError}
        onBack={() => {
          setRole(null);
          setPinInput("");
          setPinError(false);
        }}
        onSubmit={() => {
          if (pinInput === ownerPin) {
            setRole("owner");
            setPinInput("");
            setPinError(false);
          } else {
            setPinError(true);
            setPinInput("");
          }
        }}
      />
    );
  }

  if (role === "owner-change-pin") {
    return (
      <SetPinScreen
        mode="change"
        onBack={() => setRole("owner")}
        onSave={async (newPin) => {
          await persistOwnerPin(newPin);
          setRole("owner");
        }}
      />
    );
  }

  if (!loaded) {
    return (
      <div style={wrap}>
        <div style={{ ...card, textAlign: "center", color: "#8a8378" }}>Loading…</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={wrap}>
        <div style={{ maxWidth: 420, margin: "60px auto 0" }}>
          <div style={{ ...card, textAlign: "center" }}>
            <WifiOff size={28} color={COLORS.clayDark} style={{ marginBottom: 10 }} />
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>No connection</div>
            <div style={{ fontSize: 14, color: COLORS.inkSoft }}>{loadError}</div>
            <button style={{ ...btnPrimary, marginTop: 16 }} onClick={() => window.location.reload()}>
              Reload
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (role === "employee") {
    return (
      <EmployeeView
        shop={shop}
        sales={sales}
        transfers={transfers}
        addSaleEntry={addSaleEntry}
        addTransferEntry={addTransferEntry}
        removeSaleEntry={removeSaleEntry}
        removeTransferEntry={removeTransferEntry}
        isOffline={isOffline}
        onLogout={() => {
          setRole(null);
          setShop(null);
        }}
      />
    );
  }

  if (role === "owner") {
    return (
      <OwnerView
        sales={sales}
        transfers={transfers}
        removeSaleEntry={removeSaleEntry}
        removeTransferEntry={removeTransferEntry}
        rangeStart={ownerRangeStart}
        rangeEnd={ownerRangeEnd}
        setRangeStart={setOwnerRangeStart}
        setRangeEnd={setOwnerRangeEnd}
        shopFilter={ownerShopFilter}
        setShopFilter={setOwnerShopFilter}
        isOffline={isOffline}
        onLogout={() => setRole(null)}
        onChangePin={() => setRole("owner-change-pin")}
      />
    );
  }

  return null;
}

// ================= Shared style tokens =================
const COLORS = {
  bg: "#F6F2EA",
  card: "#FFFFFF",
  ink: "#2B2520",
  inkSoft: "#6B6258",
  rule: "#E5DDCE",
  clay: "#B6562F",
  clayDark: "#94431F",
  green: "#3F6E4E",
  greenSoft: "#E8F0E9",
  redSoft: "#FBEAE4",
};

const wrap = {
  minHeight: "100%",
  background: COLORS.bg,
  fontFamily:
    "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  color: COLORS.ink,
  padding: "20px 16px 40px",
  boxSizing: "border-box",
};

const card = {
  background: COLORS.card,
  border: `1px solid ${COLORS.rule}`,
  borderRadius: 14,
  padding: 18,
};

const btnPrimary = {
  background: COLORS.clay,
  color: "#fff",
  border: "none",
  borderRadius: 10,
  padding: "13px 16px",
  fontSize: 15,
  fontWeight: 600,
  cursor: "pointer",
  width: "100%",
};

const btnGhost = {
  background: "transparent",
  color: COLORS.ink,
  border: `1px solid ${COLORS.rule}`,
  borderRadius: 10,
  padding: "13px 16px",
  fontSize: 15,
  fontWeight: 600,
  cursor: "pointer",
  width: "100%",
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "12px 14px",
  borderRadius: 10,
  border: `1px solid ${COLORS.rule}`,
  fontSize: 15,
  background: "#FCFAF6",
  color: COLORS.ink,
  outline: "none",
};

const label = {
  fontSize: 12,
  fontWeight: 700,
  color: COLORS.inkSoft,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  marginBottom: 6,
  display: "block",
};

// ================= Role select =================
function RoleSelect({ onEmployee, onOwner }) {
  return (
    <div style={wrap}>
      <div style={{ maxWidth: 420, margin: "40px auto 0" }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: COLORS.clay,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 14px",
            }}
          >
            <Store size={28} color="#fff" />
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.01em" }}>
            Duka Ledger
          </div>
          <div style={{ fontSize: 14, color: COLORS.inkSoft, marginTop: 4 }}>
            Daily sales &amp; stock movement, across 5 shops
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <button style={btnPrimary} onClick={onEmployee}>
            I work at a shop
          </button>
          <button style={btnGhost} onClick={onOwner}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, justifyContent: "center", width: "100%" }}>
              <Lock size={15} /> Owner login
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

function ShopSelect({ onPick, onBack }) {
  return (
    <div style={wrap}>
      <div style={{ maxWidth: 420, margin: "20px auto 0" }}>
        <button
          onClick={onBack}
          style={{
            background: "none",
            border: "none",
            color: COLORS.inkSoft,
            fontSize: 14,
            marginBottom: 18,
            cursor: "pointer",
            padding: 0,
          }}
        >
          ← Back
        </button>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>
          Where are you working?
        </div>
        <div style={{ fontSize: 13, color: COLORS.inkSoft, marginBottom: 20 }}>
          You'll only see and add entries for this location.
        </div>

        <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.inkSoft, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
          Warehouse
        </div>
        <button
          onClick={() => onPick(WAREHOUSE)}
          style={{
            ...card,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            cursor: "pointer",
            fontSize: 15,
            fontWeight: 700,
            textAlign: "left",
            marginBottom: 18,
            borderColor: COLORS.clay,
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Warehouse size={18} color={COLORS.clay} /> {WAREHOUSE}
          </span>
          <ChevronDown size={16} style={{ transform: "rotate(-90deg)" }} color={COLORS.inkSoft} />
        </button>

        <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.inkSoft, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
          Shops
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {SHOPS.map((s) => (
            <button
              key={s}
              onClick={() => onPick(s)}
              style={{
                ...card,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                cursor: "pointer",
                fontSize: 15,
                fontWeight: 700,
                textAlign: "left",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Store size={18} color={COLORS.clay} /> {s}
              </span>
              <ChevronDown size={16} style={{ transform: "rotate(-90deg)" }} color={COLORS.inkSoft} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function PinScreen({ pinInput, setPinInput, error, onBack, onSubmit }) {
  return (
    <div style={wrap}>
      <div style={{ maxWidth: 360, margin: "60px auto 0" }}>
        <button
          onClick={onBack}
          style={{
            background: "none",
            border: "none",
            color: COLORS.inkSoft,
            fontSize: 14,
            marginBottom: 18,
            cursor: "pointer",
            padding: 0,
          }}
        >
          ← Back
        </button>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <Lock size={28} color={COLORS.clay} />
          <div style={{ fontSize: 18, fontWeight: 800, marginTop: 10 }}>Owner PIN</div>
          <div style={{ fontSize: 13, color: COLORS.inkSoft, marginTop: 4 }}>
            Enter the 4-digit PIN to view all shops
          </div>
        </div>
        <input
          type="password"
          inputMode="numeric"
          maxLength={4}
          value={pinInput}
          onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ""))}
          style={{
            ...inputStyle,
            textAlign: "center",
            fontSize: 24,
            letterSpacing: "0.4em",
            marginBottom: 10,
          }}
          placeholder="••••"
          autoFocus
        />
        {error && (
          <div style={{ color: COLORS.clayDark, fontSize: 13, marginBottom: 10, textAlign: "center" }}>
            Incorrect PIN. Try again.
          </div>
        )}
        <button style={btnPrimary} onClick={onSubmit} disabled={pinInput.length !== 4}>
          Enter
        </button>
      </div>
    </div>
  );
}

function SetPinScreen({ mode, onBack, onSave }) {
  // mode: "create" (first-time setup) | "change" (owner already logged in)
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [step, setStep] = useState("enter"); // enter | confirm
  const [mismatch, setMismatch] = useState(false);

  function handleContinue() {
    if (step === "enter") {
      if (pin.length !== 4) return;
      setStep("confirm");
      setMismatch(false);
      return;
    }
    // confirm step
    if (confirmPin.length !== 4) return;
    if (confirmPin !== pin) {
      setMismatch(true);
      setConfirmPin("");
      return;
    }
    onSave(pin);
  }

  function handleBackInternal() {
    if (step === "confirm") {
      setStep("enter");
      setConfirmPin("");
      setMismatch(false);
    } else {
      onBack();
    }
  }

  return (
    <div style={wrap}>
      <div style={{ maxWidth: 360, margin: "60px auto 0" }}>
        <button
          onClick={handleBackInternal}
          style={{
            background: "none",
            border: "none",
            color: COLORS.inkSoft,
            fontSize: 14,
            marginBottom: 18,
            cursor: "pointer",
            padding: 0,
          }}
        >
          ← Back
        </button>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <Lock size={28} color={COLORS.clay} />
          <div style={{ fontSize: 18, fontWeight: 800, marginTop: 10 }}>
            {mode === "create" ? "Set your owner PIN" : "Change your owner PIN"}
          </div>
          <div style={{ fontSize: 13, color: COLORS.inkSoft, marginTop: 4 }}>
            {step === "enter"
              ? "Choose a 4-digit PIN only you know"
              : "Enter it again to confirm"}
          </div>
        </div>
        <input
          type="password"
          inputMode="numeric"
          maxLength={4}
          value={step === "enter" ? pin : confirmPin}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "");
            if (step === "enter") {
              setPin(v);
            } else {
              setConfirmPin(v);
              setMismatch(false);
            }
          }}
          style={{
            ...inputStyle,
            textAlign: "center",
            fontSize: 24,
            letterSpacing: "0.4em",
            marginBottom: 10,
            border: `1px solid ${mismatch ? COLORS.clayDark : COLORS.rule}`,
          }}
          placeholder="••••"
          autoFocus
        />
        {mismatch && (
          <div style={{ color: COLORS.clayDark, fontSize: 13, marginBottom: 10, textAlign: "center" }}>
            PINs didn't match. Try again.
          </div>
        )}
        <button
          style={btnPrimary}
          onClick={handleContinue}
          disabled={step === "enter" ? pin.length !== 4 : confirmPin.length !== 4}
        >
          {step === "enter" ? "Continue" : "Save PIN"}
        </button>
      </div>
    </div>
  );
}

// ================= Employee View =================
function EmployeeView({ shop, sales, transfers, addSaleEntry, addTransferEntry, removeSaleEntry, removeTransferEntry, isOffline, onLogout }) {
  const isWarehouse = shop === WAREHOUSE;
  const [showSaleForm, setShowSaleForm] = useState(false);
  const [showTransferForm, setShowTransferForm] = useState(false);
  const [showEastleighForm, setShowEastleighForm] = useState(false);
  const [saveError, setSaveError] = useState("");

  const today = todayStr();
  const mySalesToday = sales.filter((s) => s.shop === shop && s.date === today);
  const myTransfersToday = transfers.filter(
    (t) => (t.fromShop === shop || t.toShop === shop) && t.date === today
  );
  const todayTotal = mySalesToday.reduce((sum, s) => sum + Number(s.amount || 0), 0);

  async function addSale(entry) {
    setSaveError("");
    try {
      await addSaleEntry({ shop, date: today, ...entry });
      setShowSaleForm(false);
    } catch (e) {
      console.error(e);
      setSaveError("Couldn't save — check your connection and try again.");
    }
  }

  async function addTransfer(entry) {
    setSaveError("");
    try {
      await addTransferEntry({ date: today, ...entry });
      setShowTransferForm(false);
      setShowEastleighForm(false);
    } catch (e) {
      console.error(e);
      setSaveError("Couldn't save — check your connection and try again.");
    }
  }

  async function deleteSale(id) {
    try {
      await removeSaleEntry(id);
    } catch (e) {
      console.error(e);
    }
  }

  async function deleteTransfer(id) {
    try {
      await removeTransferEntry(id);
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div style={wrap}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 12, color: COLORS.inkSoft, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              {today}
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, display: "flex", alignItems: "center", gap: 7 }}>
              {isWarehouse ? <Warehouse size={18} color={COLORS.clay} /> : <Store size={18} color={COLORS.clay} />} {shop}
            </div>
          </div>
          <button
            onClick={onLogout}
            style={{
              background: "none",
              border: `1px solid ${COLORS.rule}`,
              borderRadius: 8,
              padding: "8px 10px",
              color: COLORS.inkSoft,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontSize: 13,
            }}
          >
            <LogOut size={14} /> Switch
          </button>
        </div>

        {isOffline && (
          <div
            style={{
              ...card,
              marginBottom: 14,
              padding: "10px 14px",
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "#FBEAE4",
              border: "none",
              fontSize: 13,
              fontWeight: 600,
              color: COLORS.clayDark,
            }}
          >
            <WifiOff size={15} /> No internet — entries won't save until you're back online.
          </div>
        )}

        {saveError && (
          <div
            style={{
              ...card,
              marginBottom: 14,
              padding: "10px 14px",
              background: "#FBEAE4",
              border: "none",
              fontSize: 13,
              fontWeight: 600,
              color: COLORS.clayDark,
            }}
          >
            {saveError}
          </div>
        )}

        {/* Today summary — sales only apply to shops, not the warehouse */}
        {!isWarehouse && (
          <div style={{ ...card, marginBottom: 16, background: COLORS.clay, border: "none", color: "#fff" }}>
            <div style={{ fontSize: 12, opacity: 0.85, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Today's sales total
            </div>
            <div style={{ fontSize: 30, fontWeight: 800, marginTop: 2 }}>{fmtMoney(todayTotal)}</div>
            <div style={{ fontSize: 13, opacity: 0.85, marginTop: 2 }}>
              {mySalesToday.length} sale{mySalesToday.length !== 1 ? "s" : ""} logged
            </div>
          </div>
        )}

        {isWarehouse && (
          <div style={{ ...card, marginBottom: 16, background: COLORS.clay, border: "none", color: "#fff" }}>
            <div style={{ fontSize: 12, opacity: 0.85, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Stock movements today
            </div>
            <div style={{ fontSize: 30, fontWeight: 800, marginTop: 2 }}>{myTransfersToday.length}</div>
            <div style={{ fontSize: 13, opacity: 0.85, marginTop: 2 }}>
              In from Eastleigh and out to shops
            </div>
          </div>
        )}

        {/* Quick actions */}
        {isWarehouse ? (
          <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
            <button
              onClick={() => setShowEastleighForm(true)}
              style={{ ...btnPrimary, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            >
              <Truck size={17} /> Received from Eastleigh
            </button>
            <button
              onClick={() => setShowTransferForm(true)}
              style={{ ...btnGhost, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            >
              <ArrowLeftRight size={16} /> Send to shop
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
            <button
              onClick={() => setShowSaleForm(true)}
              style={{ ...btnPrimary, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            >
              <Plus size={17} /> Log a sale
            </button>
            <button
              onClick={() => setShowTransferForm(true)}
              style={{ ...btnGhost, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            >
              <ArrowLeftRight size={16} /> Stock move
            </button>
          </div>
        )}

        {/* Today's entries */}
        <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.inkSoft, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>
          Today's entries
        </div>

        {mySalesToday.length === 0 && myTransfersToday.length === 0 && (
          <div style={{ ...card, textAlign: "center", color: COLORS.inkSoft, fontSize: 14 }}>
            {isWarehouse
              ? "Nothing logged yet today. Record stock received from Eastleigh or stock sent to a shop."
              : "Nothing logged yet today. Use the buttons above to add a sale or record stock movement."}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[...mySalesToday.map((s) => ({ ...s, _type: "sale" })), ...myTransfersToday.map((t) => ({ ...t, _type: "transfer" }))]
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .map((item) =>
              item._type === "sale" ? (
                <SaleRow key={item.id} item={item} onDelete={() => deleteSale(item.id)} />
              ) : (
                <TransferRow key={item.id} item={item} shop={shop} onDelete={() => deleteTransfer(item.id)} />
              )
            )}
        </div>
      </div>

      {showSaleForm && (
        <SaleFormModal onClose={() => setShowSaleForm(false)} onSubmit={addSale} />
      )}
      {showTransferForm && (
        <TransferFormModal shop={shop} onClose={() => setShowTransferForm(false)} onSubmit={addTransfer} />
      )}
      {showEastleighForm && (
        <EastleighFormModal onClose={() => setShowEastleighForm(false)} onSubmit={addTransfer} />
      )}
    </div>
  );
}

function SaleRow({ item, onDelete }) {
  return (
    <div style={{ ...card, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: COLORS.greenSoft, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <TrendingUp size={16} color={COLORS.green} />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{item.item || "Sale"}</div>
          <div style={{ fontSize: 12, color: COLORS.inkSoft }}>
            Qty {item.qty} · {fmtTime(item.createdAt)} {item.employee ? `· ${item.employee}` : ""}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 800 }}>{fmtMoney(item.amount)}</div>
        <button onClick={onDelete} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.inkSoft, padding: 4 }}>
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}

function TransferRow({ item, shop, onDelete }) {
  const fromEastleigh = item.fromShop === EXTERNAL_SOURCE;
  const outgoing = item.fromShop === shop;
  const icon = fromEastleigh ? Truck : ArrowLeftRight;
  const Icon = icon;
  return (
    <div style={{ ...card, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 9,
            background: outgoing ? COLORS.redSoft : COLORS.greenSoft,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon size={16} color={outgoing ? COLORS.clayDark : COLORS.green} />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{item.item}</div>
          <div style={{ fontSize: 12, color: COLORS.inkSoft }}>
            {outgoing ? `Sent to ${item.toShop}` : `Received from ${item.fromShop}`} · {fmtTime(item.createdAt)}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: outgoing ? COLORS.clayDark : COLORS.green }}>
          {outgoing ? "-" : "+"}
          {item.qty}
        </div>
        <button onClick={onDelete} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.inkSoft, padding: 4 }}>
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}

// ================= Modals =================
function ModalShell({ title, onClose, children }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(43,37,32,0.45)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        zIndex: 50,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: COLORS.bg,
          borderRadius: "18px 18px 0 0",
          padding: 20,
          width: "100%",
          maxWidth: 480,
          maxHeight: "88vh",
          overflowY: "auto",
          boxSizing: "border-box",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ fontSize: 17, fontWeight: 800 }}>{title}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.inkSoft }}>
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function SaleFormModal({ onClose, onSubmit }) {
  const [item, setItem] = useState("");
  const [qty, setQty] = useState("1");
  const [amount, setAmount] = useState("");
  const [employee, setEmployee] = useState("");
  const [note, setNote] = useState("");
  const [triedSave, setTriedSave] = useState(false);

  const nameValid = employee.trim().length > 0;
  const valid = item.trim() && amount && Number(amount) > 0 && nameValid;

  function handleSave() {
    setTriedSave(true);
    if (!valid) return;
    onSubmit({
      item: item.trim(),
      qty: Number(qty) || 1,
      amount: Number(amount),
      employee: employee.trim(),
      note: note.trim(),
    });
  }

  return (
    <ModalShell title="Log a sale" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label style={label}>Item sold</label>
          <input style={inputStyle} value={item} onChange={(e) => setItem(e.target.value)} placeholder="e.g. Men's denim jacket" autoFocus />
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={label}>Quantity</label>
            <input style={inputStyle} type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
          <div style={{ flex: 1.4 }}>
            <label style={label}>Amount (KSh)</label>
            <input style={inputStyle} type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
          </div>
        </div>
        <div>
          <label style={{ ...label, color: triedSave && !nameValid ? COLORS.clayDark : label.color }}>
            Your name {triedSave && !nameValid ? "— required" : ""}
          </label>
          <input
            style={{
              ...inputStyle,
              border: `1px solid ${triedSave && !nameValid ? COLORS.clayDark : COLORS.rule}`,
            }}
            value={employee}
            onChange={(e) => setEmployee(e.target.value)}
            placeholder="e.g. Faith"
          />
        </div>
        <div>
          <label style={label}>Note (optional)</label>
          <input style={inputStyle} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Any detail worth keeping" />
        </div>
        <button style={{ ...btnPrimary, opacity: valid ? 1 : 0.6, marginTop: 4 }} onClick={handleSave}>
          Save sale
        </button>
      </div>
    </ModalShell>
  );
}

function TransferFormModal({ shop, onClose, onSubmit }) {
  const [direction, setDirection] = useState("out"); // out | in
  const [otherShop, setOtherShop] = useState(ALL_LOCATIONS.find((s) => s !== shop));
  const [item, setItem] = useState("");
  const [qty, setQty] = useState("1");
  const [employee, setEmployee] = useState("");
  const [triedSave, setTriedSave] = useState(false);

  const nameValid = employee.trim().length > 0;
  const valid = item.trim() && qty && Number(qty) > 0 && otherShop && nameValid;

  function submit() {
    setTriedSave(true);
    if (!valid) return;
    const fromShop = direction === "out" ? shop : otherShop;
    const toShop = direction === "out" ? otherShop : shop;
    onSubmit({
      fromShop,
      toShop,
      item: item.trim(),
      qty: Number(qty),
      employee: employee.trim(),
    });
  }

  return (
    <ModalShell title="Record stock movement" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label style={label}>Direction</label>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setDirection("out")}
              style={{
                flex: 1,
                padding: "11px 10px",
                borderRadius: 10,
                border: `1px solid ${direction === "out" ? COLORS.clay : COLORS.rule}`,
                background: direction === "out" ? COLORS.redSoft : "#FCFAF6",
                color: COLORS.ink,
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Stock out (sending)
            </button>
            <button
              onClick={() => setDirection("in")}
              style={{
                flex: 1,
                padding: "11px 10px",
                borderRadius: 10,
                border: `1px solid ${direction === "in" ? COLORS.green : COLORS.rule}`,
                background: direction === "in" ? COLORS.greenSoft : "#FCFAF6",
                color: COLORS.ink,
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Stock in (receiving)
            </button>
          </div>
        </div>

        <div>
          <label style={label}>{direction === "out" ? "Sending to" : "Receiving from"}</label>
          <select style={{ ...inputStyle, appearance: "none" }} value={otherShop} onChange={(e) => setOtherShop(e.target.value)}>
            {ALL_LOCATIONS.filter((s) => s !== shop).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={label}>Item</label>
          <input style={inputStyle} value={item} onChange={(e) => setItem(e.target.value)} placeholder="e.g. Ladies' blouse, size M" />
        </div>

        <div>
          <label style={label}>Quantity</label>
          <input style={inputStyle} type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} />
        </div>

        <div>
          <label style={{ ...label, color: triedSave && !nameValid ? COLORS.clayDark : label.color }}>
            Your name {triedSave && !nameValid ? "— required" : ""}
          </label>
          <input
            style={{
              ...inputStyle,
              border: `1px solid ${triedSave && !nameValid ? COLORS.clayDark : COLORS.rule}`,
            }}
            value={employee}
            onChange={(e) => setEmployee(e.target.value)}
            placeholder="e.g. Faith"
          />
        </div>

        <button style={{ ...btnPrimary, opacity: valid ? 1 : 0.6, marginTop: 4 }} onClick={submit}>
          Save stock movement
        </button>
      </div>
    </ModalShell>
  );
}

function EastleighFormModal({ onClose, onSubmit }) {
  const [item, setItem] = useState("");
  const [qty, setQty] = useState("1");
  const [employee, setEmployee] = useState("");
  const [note, setNote] = useState("");
  const [triedSave, setTriedSave] = useState(false);

  const nameValid = employee.trim().length > 0;
  const valid = item.trim() && qty && Number(qty) > 0 && nameValid;

  function submit() {
    setTriedSave(true);
    if (!valid) return;
    onSubmit({
      fromShop: EXTERNAL_SOURCE,
      toShop: WAREHOUSE,
      item: item.trim(),
      qty: Number(qty),
      employee: employee.trim(),
      note: note.trim(),
    });
  }

  return (
    <ModalShell title="Stock received from Eastleigh" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label style={label}>Item</label>
          <input style={inputStyle} value={item} onChange={(e) => setItem(e.target.value)} placeholder="e.g. Ladies' blouse, size M" autoFocus />
        </div>

        <div>
          <label style={label}>Quantity</label>
          <input style={inputStyle} type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} />
        </div>

        <div>
          <label style={{ ...label, color: triedSave && !nameValid ? COLORS.clayDark : label.color }}>
            Your name {triedSave && !nameValid ? "— required" : ""}
          </label>
          <input
            style={{
              ...inputStyle,
              border: `1px solid ${triedSave && !nameValid ? COLORS.clayDark : COLORS.rule}`,
            }}
            value={employee}
            onChange={(e) => setEmployee(e.target.value)}
            placeholder="e.g. Faith"
          />
        </div>

        <div>
          <label style={label}>Note (optional)</label>
          <input style={inputStyle} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. supplier name, batch detail" />
        </div>

        <button style={{ ...btnPrimary, opacity: valid ? 1 : 0.6, marginTop: 4 }} onClick={submit}>
          Save received stock
        </button>
      </div>
    </ModalShell>
  );
}

// ================= Owner View =================
function OwnerView({ sales, transfers, removeSaleEntry, removeTransferEntry, rangeStart, rangeEnd, setRangeStart, setRangeEnd, shopFilter, setShopFilter, isOffline, onLogout, onChangePin }) {
  const [tab, setTab] = useState("overview"); // overview | sales | transfers
  const [activePreset, setActivePreset] = useState("today");

  function inRange(dateStr) {
    return dateStr >= rangeStart && dateStr <= rangeEnd;
  }

  function applyPreset(preset) {
    const today = todayStr();
    setActivePreset(preset);
    if (preset === "yesterday") {
      const y = addDays(today, -1);
      setRangeStart(y);
      setRangeEnd(y);
    } else if (preset === "today") {
      setRangeStart(today);
      setRangeEnd(today);
    } else if (preset === "tomorrow") {
      const t = addDays(today, 1);
      setRangeStart(t);
      setRangeEnd(t);
    } else if (preset === "week") {
      setRangeStart(startOfWeek(today));
      setRangeEnd(today);
    } else if (preset === "month") {
      setRangeStart(startOfMonth(today));
      setRangeEnd(today);
    } else if (preset === "year") {
      setRangeStart(startOfYear(today));
      setRangeEnd(today);
    }
    // "custom" leaves rangeStart/rangeEnd as whatever the date inputs are set to
  }

  const filteredSales = sales.filter(
    (s) => inRange(s.date) && (shopFilter === "All" || s.shop === shopFilter)
  );
  const filteredTransfers = transfers.filter(
    (t) =>
      inRange(t.date) &&
      (shopFilter === "All" || t.fromShop === shopFilter || t.toShop === shopFilter)
  );

  const totalInRange = filteredSales.reduce((sum, s) => sum + Number(s.amount || 0), 0);

  const byShop = SHOPS.map((s) => {
    const shopSales = sales.filter((x) => inRange(x.date) && x.shop === s);
    return {
      shop: s,
      total: shopSales.reduce((sum, x) => sum + Number(x.amount || 0), 0),
      count: shopSales.length,
    };
  });

  const warehouseMovementsInRange = transfers.filter(
    (t) => inRange(t.date) && (t.fromShop === WAREHOUSE || t.toShop === WAREHOUSE)
  );
  const warehouseIn = warehouseMovementsInRange.filter((t) => t.toShop === WAREHOUSE).length;
  const warehouseOut = warehouseMovementsInRange.filter((t) => t.fromShop === WAREHOUSE).length;

  const rangeLabel =
    rangeStart === rangeEnd ? fmtDateShort(rangeStart) : `${fmtDateShort(rangeStart)} – ${fmtDateShort(rangeEnd)}`;

  function exportCSV() {
    const rows = [["Type", "Date", "Time", "Shop", "From", "To", "Item", "Qty", "Amount", "Employee", "Note"]];
    filteredSales
      .slice()
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      .forEach((s) =>
        rows.push(["Sale", s.date, fmtTime(s.createdAt), s.shop, "", "", s.item, s.qty, s.amount, s.employee, s.note || ""])
      );
    filteredTransfers
      .slice()
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      .forEach((t) =>
        rows.push(["Transfer", t.date, fmtTime(t.createdAt), "", t.fromShop, t.toShop, t.item, t.qty, "", t.employee, ""])
      );
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const filenameRange = rangeStart === rangeEnd ? rangeStart : `${rangeStart}_to_${rangeEnd}`;
    a.download = `duka-ledger-${filenameRange}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function deleteSale(id) {
    try {
      await removeSaleEntry(id);
    } catch (e) {
      console.error(e);
    }
  }
  async function deleteTransfer(id) {
    try {
      await removeTransferEntry(id);
    } catch (e) {
      console.error(e);
    }
  }

  const presetBtn = (id, text) => (
    <button
      onClick={() => applyPreset(id)}
      style={{
        padding: "8px 12px",
        borderRadius: 8,
        border: `1px solid ${activePreset === id ? COLORS.clay : COLORS.rule}`,
        background: activePreset === id ? COLORS.clay : "#FCFAF6",
        color: activePreset === id ? "#fff" : COLORS.ink,
        fontWeight: 700,
        fontSize: 13,
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </button>
  );

  return (
    <div style={wrap}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <div style={{ fontSize: 20, fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
            <ClipboardList size={20} color={COLORS.clay} /> Owner view
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={onChangePin}
              style={{
                background: "none",
                border: `1px solid ${COLORS.rule}`,
                borderRadius: 8,
                padding: "8px 10px",
                color: COLORS.inkSoft,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 5,
                fontSize: 13,
              }}
            >
              <Lock size={14} /> Change PIN
            </button>
            <button
              onClick={onLogout}
              style={{
                background: "none",
                border: `1px solid ${COLORS.rule}`,
                borderRadius: 8,
                padding: "8px 10px",
                color: COLORS.inkSoft,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 5,
                fontSize: 13,
              }}
            >
              <LogOut size={14} /> Log out
            </button>
          </div>
        </div>

        {isOffline && (
          <div
            style={{
              ...card,
              marginBottom: 14,
              padding: "10px 14px",
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "#FBEAE4",
              border: "none",
              fontSize: 13,
              fontWeight: 600,
              color: COLORS.clayDark,
            }}
          >
            <WifiOff size={15} /> No internet — showing the last data that synced.
          </div>
        )}

        {/* Single-day quick picks */}
        <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.inkSoft, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>
          One day
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          {presetBtn("yesterday", "Yesterday")}
          {presetBtn("today", "Today")}
          {presetBtn("tomorrow", "Tomorrow")}
        </div>

        {/* Range presets */}
        <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.inkSoft, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>
          Range
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
          {presetBtn("week", "This week")}
          {presetBtn("month", "This month")}
          {presetBtn("year", "This year")}
          {presetBtn("custom", "Custom range")}
        </div>

        {/* Custom range date pickers (always visible so you can see + adjust the active range) */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 150px", display: "flex", alignItems: "center", gap: 8, ...card, padding: "8px 12px" }}>
            <Calendar size={15} color={COLORS.inkSoft} />
            <input
              type="date"
              value={rangeStart}
              max={rangeEnd}
              onChange={(e) => {
                setRangeStart(e.target.value);
                setActivePreset("custom");
              }}
              style={{ border: "none", outline: "none", fontSize: 14, fontWeight: 600, color: COLORS.ink, background: "transparent", width: "100%" }}
            />
          </div>
          <div style={{ flex: "1 1 150px", display: "flex", alignItems: "center", gap: 8, ...card, padding: "8px 12px" }}>
            <Calendar size={15} color={COLORS.inkSoft} />
            <input
              type="date"
              value={rangeEnd}
              min={rangeStart}
              onChange={(e) => {
                setRangeEnd(e.target.value);
                setActivePreset("custom");
              }}
              style={{ border: "none", outline: "none", fontSize: 14, fontWeight: 600, color: COLORS.ink, background: "transparent", width: "100%" }}
            />
          </div>
        </div>

        {/* Shop + export */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          <select
            value={shopFilter}
            onChange={(e) => setShopFilter(e.target.value)}
            style={{ ...card, padding: "8px 12px", fontSize: 14, fontWeight: 600, flex: "1 1 140px" }}
          >
            <option value="All">All locations</option>
            <option value={WAREHOUSE}>{WAREHOUSE}</option>
            {SHOPS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button
            onClick={exportCSV}
            style={{ ...btnGhost, width: "auto", display: "flex", alignItems: "center", gap: 7, padding: "10px 14px" }}
          >
            <Download size={15} /> Export CSV
          </button>
        </div>

        {/* Totals strip */}
        <div style={{ ...card, marginBottom: 16, background: COLORS.clay, color: "#fff", border: "none" }}>
          <div style={{ fontSize: 12, opacity: 0.85, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Total sales — {shopFilter === "All" ? "all shops" : shopFilter} — {rangeLabel}
          </div>
          <div style={{ fontSize: 30, fontWeight: 800, marginTop: 2 }}>{fmtMoney(totalInRange)}</div>
          <div style={{ fontSize: 13, opacity: 0.85, marginTop: 2 }}>
            {filteredSales.length} sale{filteredSales.length !== 1 ? "s" : ""} · {filteredTransfers.length} stock movement
            {filteredTransfers.length !== 1 ? "s" : ""}
          </div>
        </div>

        {/* Per-shop breakdown (only when All selected) */}
        {shopFilter === "All" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 8, marginBottom: 20 }}>
            <div style={{ ...card, padding: "12px 14px", borderColor: COLORS.clay }}>
              <div style={{ fontSize: 12, color: COLORS.inkSoft, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                <Warehouse size={12} /> Warehouse
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, marginTop: 2 }}>
                +{warehouseIn} / -{warehouseOut}
              </div>
              <div style={{ fontSize: 11, color: COLORS.inkSoft }}>in / out, this range</div>
            </div>
            {byShop.map((b) => (
              <div key={b.shop} style={{ ...card, padding: "12px 14px" }}>
                <div style={{ fontSize: 12, color: COLORS.inkSoft, fontWeight: 700 }}>{b.shop}</div>
                <div style={{ fontSize: 16, fontWeight: 800, marginTop: 2 }}>{fmtMoney(b.total)}</div>
                <div style={{ fontSize: 11, color: COLORS.inkSoft }}>{b.count} sales</div>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 14, borderBottom: `1px solid ${COLORS.rule}` }}>
          {[
            { id: "sales", label: `Sales (${filteredSales.length})` },
            { id: "transfers", label: `Stock movements (${filteredTransfers.length})` },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                background: "none",
                border: "none",
                borderBottom: tab === t.id ? `2px solid ${COLORS.clay}` : "2px solid transparent",
                color: tab === t.id ? COLORS.clay : COLORS.inkSoft,
                fontWeight: 700,
                fontSize: 13,
                padding: "8px 4px",
                cursor: "pointer",
                marginBottom: -1,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "sales" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filteredSales.length === 0 && (
              <div style={{ ...card, textAlign: "center", color: COLORS.inkSoft, fontSize: 14 }}>
                No sales logged for this filter.
              </div>
            )}
            {filteredSales
              .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
              .map((s) => (
                <div key={s.id} style={{ ...card, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{s.item}</div>
                    <div style={{ fontSize: 12, color: COLORS.inkSoft }}>
                      {s.shop} · {fmtDateShort(s.date)} · Qty {s.qty} · {fmtTime(s.createdAt)} {s.employee ? `· ${s.employee}` : ""}
                      {s.note ? ` · ${s.note}` : ""}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ fontSize: 14, fontWeight: 800 }}>{fmtMoney(s.amount)}</div>
                    <button onClick={() => deleteSale(s.id)} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.inkSoft, padding: 4 }}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}

        {tab === "transfers" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filteredTransfers.length === 0 && (
              <div style={{ ...card, textAlign: "center", color: COLORS.inkSoft, fontSize: 14 }}>
                No stock movements for this filter.
              </div>
            )}
            {filteredTransfers
              .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
              .map((t) => (
                <div key={t.id} style={{ ...card, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{t.item}</div>
                    <div style={{ fontSize: 12, color: COLORS.inkSoft }}>
                      {t.fromShop} → {t.toShop} · {fmtDateShort(t.date)} · {fmtTime(t.createdAt)} {t.employee ? `· ${t.employee}` : ""}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ fontSize: 14, fontWeight: 800 }}>Qty {t.qty}</div>
                    <button onClick={() => deleteTransfer(t.id)} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.inkSoft, padding: 4 }}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
