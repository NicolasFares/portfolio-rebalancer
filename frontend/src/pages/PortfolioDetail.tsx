import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import type { PortfolioDetail as PDetail, HoldingInput } from "../types";
import { getPortfolio, addHolding, deleteHolding, updateHolding, updatePortfolio } from "../api";

const ASSET_TYPES = ["equity", "bond", "crypto", "cash", "other", "managed"] as const;
const BREAKDOWN_CATEGORIES = ["equity", "bond", "crypto", "cash"] as const;
const CURRENCIES = ["CAD", "EUR", "USD"] as const;

const BAR_COLORS: Record<string, string> = {
  equity: "var(--accent)",
  bond: "var(--blue)",
  crypto: "var(--yellow)",
  cash: "var(--green)",
  other: "var(--text-muted)",
};

const emptyHolding: HoldingInput = {
  name: "",
  ticker: "",
  asset_type: "equity",
  quantity: 0,
  price_per_unit: 0,
  currency: "CAD",
  account: "",
};

export default function PortfolioDetail() {
  const { id } = useParams<{ id: string }>();
  const [portfolio, setPortfolio] = useState<PDetail | null>(null);
  const [form, setForm] = useState<HoldingInput>({ ...emptyHolding });
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<HoldingInput>({ ...emptyHolding });
  const [editingRates, setEditingRates] = useState(false);
  const [eurRate, setEurRate] = useState(0);
  const [usdRate, setUsdRate] = useState(0);

  const load = () => {
    if (!id) return;
    getPortfolio(Number(id)).then((p) => {
      setPortfolio(p);
      setEurRate(p.eur_to_base);
      setUsdRate(p.usd_to_base);
    });
  };

  useEffect(() => { load(); }, [id]);

  if (!portfolio) return <div>Loading...</div>;

  const totalValue = portfolio.holdings.reduce((sum, h) => {
    const val = h.quantity * h.price_per_unit;
    if (h.currency === portfolio.base_currency) return sum + val;
    if (h.currency === "EUR") return sum + val * portfolio.eur_to_base;
    if (h.currency === "USD") return sum + val * portfolio.usd_to_base;
    return sum + val;
  }, 0);

  const byType: Record<string, number> = {};
  portfolio.holdings.forEach((h) => {
    const val = h.quantity * h.price_per_unit;
    let converted = val;
    if (h.currency !== portfolio.base_currency) {
      if (h.currency === "EUR") converted = val * portfolio.eur_to_base;
      else if (h.currency === "USD") converted = val * portfolio.usd_to_base;
    }
    if (h.allocation_breakdown) {
      for (const [cat, pct] of Object.entries(h.allocation_breakdown)) {
        byType[cat] = (byType[cat] || 0) + converted * (pct / 100);
      }
    } else {
      byType[h.asset_type] = (byType[h.asset_type] || 0) + converted;
    }
  });

  const handleAddHolding = async (e: React.FormEvent) => {
    e.preventDefault();
    await addHolding(Number(id), form);
    setForm({ ...emptyHolding });
    setShowForm(false);
    load();
  };

  const handleDeleteHolding = async (holdingId: number) => {
    await deleteHolding(holdingId);
    load();
  };

  const startEditing = (h: HoldingInput & { id: number; allocation_breakdown?: Record<string, number> | null }) => {
    setEditingId(h.id);
    setEditForm({
      name: h.name,
      ticker: h.ticker || "",
      asset_type: h.asset_type,
      quantity: h.quantity,
      price_per_unit: h.price_per_unit,
      currency: h.currency,
      account: h.account || "",
      allocation_breakdown: h.allocation_breakdown || null,
    });
  };

  const handleUpdateHolding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId === null) return;
    await updateHolding(editingId, editForm);
    setEditingId(null);
    load();
  };

  const handleSaveRates = async () => {
    await updatePortfolio(Number(id), { eur_to_base: eurRate, usd_to_base: usdRate });
    setEditingRates(false);
    load();
  };

  const fmt = (n: number) =>
    n.toLocaleString("en-CA", { style: "currency", currency: portfolio.base_currency });

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ marginBottom: "0.25rem" }}>{portfolio.name}</h1>
          <span style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
            Total: {fmt(totalValue)} {portfolio.base_currency}
          </span>
        </div>
        <div className="flex">
          <Link to={`/portfolio/${id}/rebalance`}>
            <button className="btn-primary">Rebalance</button>
          </Link>
        </div>
      </div>

      {/* Exchange Rates */}
      <div className="card">
        <div className="flex-between">
          <h2 style={{ marginBottom: 0 }}>Exchange Rates</h2>
          {!editingRates ? (
            <button className="btn-ghost" onClick={() => setEditingRates(true)}>Edit</button>
          ) : (
            <div className="flex">
              <button className="btn-primary" onClick={handleSaveRates}>Save</button>
              <button className="btn-ghost" onClick={() => setEditingRates(false)}>Cancel</button>
            </div>
          )}
        </div>
        <div className="flex" style={{ marginTop: "0.75rem" }}>
          <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
            1 EUR =
          </span>
          {editingRates ? (
            <input type="number" step="0.01" value={eurRate} onChange={(e) => setEurRate(Number(e.target.value))} style={{ width: 100 }} />
          ) : (
            <span>{portfolio.eur_to_base}</span>
          )}
          <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
            {portfolio.base_currency}
          </span>
          <span style={{ margin: "0 0.5rem", color: "var(--border)" }}>|</span>
          <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
            1 USD =
          </span>
          {editingRates ? (
            <input type="number" step="0.01" value={usdRate} onChange={(e) => setUsdRate(Number(e.target.value))} style={{ width: 100 }} />
          ) : (
            <span>{portfolio.usd_to_base}</span>
          )}
          <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
            {portfolio.base_currency}
          </span>
        </div>
      </div>

      {/* Allocation Chart */}
      {Object.keys(byType).length > 0 && (
        <div className="card">
          <h2>Current Allocation</h2>
          <div className="bar-chart">
            {Object.entries(byType)
              .sort((a, b) => b[1] - a[1])
              .map(([type, value]) => {
                const pct = totalValue > 0 ? (value / totalValue) * 100 : 0;
                return (
                  <div className="bar-row" key={type}>
                    <span className="bar-label">{type}</span>
                    <div className="bar-track">
                      <div
                        className="bar-fill"
                        style={{
                          width: `${pct}%`,
                          background: BAR_COLORS[type] || "var(--text-muted)",
                        }}
                      />
                    </div>
                    <span className="bar-value">{pct.toFixed(1)}%</span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Holdings Table */}
      <div className="card">
        <div className="flex-between" style={{ marginBottom: "1rem" }}>
          <h2 style={{ marginBottom: 0 }}>Holdings ({portfolio.holdings.length})</h2>
          {editingId === null && (
            <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
              {showForm ? "Cancel" : "Add Holding"}
            </button>
          )}
        </div>

        {(showForm || editingId !== null) && (
          <form
            onSubmit={editingId !== null ? handleUpdateHolding : handleAddHolding}
            style={{
              marginBottom: "1rem",
              padding: "1rem",
              background: "var(--surface-hover)",
              borderRadius: "var(--radius)",
              border: "1px solid var(--border)",
            }}
          >
            <div style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.75rem", color: editingId !== null ? "var(--accent)" : "var(--text)" }}>
              {editingId !== null ? "Editing holding" : "New holding"}
            </div>
            <div className="grid-form">
              <label>
                Name
                <input
                  required
                  value={editingId !== null ? editForm.name : form.name}
                  onChange={(e) =>
                    editingId !== null
                      ? setEditForm({ ...editForm, name: e.target.value })
                      : setForm({ ...form, name: e.target.value })
                  }
                />
              </label>
              <label>
                Ticker
                <input
                  value={(editingId !== null ? editForm.ticker : form.ticker) || ""}
                  onChange={(e) =>
                    editingId !== null
                      ? setEditForm({ ...editForm, ticker: e.target.value })
                      : setForm({ ...form, ticker: e.target.value })
                  }
                  placeholder="e.g. VOO"
                />
              </label>
              <label>
                Type
                <select
                  value={editingId !== null ? editForm.asset_type : form.asset_type}
                  onChange={(e) => {
                    const newType = e.target.value;
                    const clearBreakdown = newType !== "managed" ? { allocation_breakdown: null } : {};
                    editingId !== null
                      ? setEditForm({ ...editForm, asset_type: newType, ...clearBreakdown })
                      : setForm({ ...form, asset_type: newType, ...clearBreakdown });
                  }}
                >
                  {ASSET_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </label>
              <label>
                Quantity
                <input
                  type="number"
                  step="any"
                  required
                  value={(editingId !== null ? editForm.quantity : form.quantity) || ""}
                  onChange={(e) =>
                    editingId !== null
                      ? setEditForm({ ...editForm, quantity: Number(e.target.value) })
                      : setForm({ ...form, quantity: Number(e.target.value) })
                  }
                />
              </label>
              <label>
                Price/Unit
                <input
                  type="number"
                  step="any"
                  required
                  value={(editingId !== null ? editForm.price_per_unit : form.price_per_unit) || ""}
                  onChange={(e) =>
                    editingId !== null
                      ? setEditForm({ ...editForm, price_per_unit: Number(e.target.value) })
                      : setForm({ ...form, price_per_unit: Number(e.target.value) })
                  }
                />
              </label>
              <label>
                Currency
                <select
                  value={editingId !== null ? editForm.currency : form.currency}
                  onChange={(e) =>
                    editingId !== null
                      ? setEditForm({ ...editForm, currency: e.target.value })
                      : setForm({ ...form, currency: e.target.value })
                  }
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label>
                Account
                <input
                  value={(editingId !== null ? editForm.account : form.account) || ""}
                  onChange={(e) =>
                    editingId !== null
                      ? setEditForm({ ...editForm, account: e.target.value })
                      : setForm({ ...form, account: e.target.value })
                  }
                  placeholder="e.g. TFSA"
                />
              </label>
            </div>
            {((editingId !== null ? editForm.asset_type : form.asset_type) === "managed") && (
              <div style={{ marginTop: "0.75rem", padding: "0.75rem", background: "var(--surface)", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
                <div style={{ fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                  Allocation Breakdown (must sum to 100%)
                </div>
                <div className="grid-form">
                  {BREAKDOWN_CATEGORIES.map((cat) => {
                    const currentForm = editingId !== null ? editForm : form;
                    const setCurrentForm = editingId !== null ? setEditForm : setForm;
                    const bd = currentForm.allocation_breakdown || {};
                    return (
                      <label key={cat}>
                        {cat} %
                        <input
                          type="number"
                          step="any"
                          min="0"
                          max="100"
                          value={bd[cat] ?? ""}
                          onChange={(e) => {
                            const val = e.target.value === "" ? 0 : Number(e.target.value);
                            const updated = { ...bd, [cat]: val };
                            // Remove zero entries to keep it clean
                            const cleaned: Record<string, number> = {};
                            for (const [k, v] of Object.entries(updated)) {
                              if (v > 0) cleaned[k] = v;
                            }
                            setCurrentForm({ ...currentForm, allocation_breakdown: Object.keys(cleaned).length > 0 ? cleaned : null });
                          }}
                          placeholder="0"
                        />
                      </label>
                    );
                  })}
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                  Total: {Object.values((editingId !== null ? editForm : form).allocation_breakdown || {}).reduce((s, v) => s + v, 0)}%
                </div>
              </div>
            )}
            <div className="flex" style={{ marginTop: "0.5rem" }}>
              <button type="submit" className="btn-primary">
                {editingId !== null ? "Save Changes" : "Add"}
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  if (editingId !== null) {
                    setEditingId(null);
                  } else {
                    setShowForm(false);
                    setForm({ ...emptyHolding });
                  }
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {portfolio.holdings.length === 0 ? (
          <div className="empty-state">No holdings yet.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Qty</th>
                <th>Price</th>
                <th>Value</th>
                <th>Account</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {portfolio.holdings.map((h) => (
                <tr key={h.id} style={editingId === h.id ? { background: "var(--accent)", opacity: 0.15 } : undefined}>
                  <td>
                    {h.name}
                    {h.ticker && (
                      <span style={{ color: "var(--text-muted)", marginLeft: "0.5rem", fontSize: "0.8rem" }}>
                        {h.ticker}
                      </span>
                    )}
                  </td>
                  <td>
                    <span className={`tag tag-${h.asset_type}`}>{h.asset_type}</span>
                    {h.allocation_breakdown && (
                      <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginLeft: "0.4rem" }}>
                        {Object.entries(h.allocation_breakdown).map(([k, v]) => `${v}% ${k}`).join(" / ")}
                      </span>
                    )}
                  </td>
                  <td>{h.quantity}</td>
                  <td>{h.price_per_unit.toLocaleString()} {h.currency}</td>
                  <td>{(h.quantity * h.price_per_unit).toLocaleString()} {h.currency}</td>
                  <td style={{ color: "var(--text-muted)" }}>{h.account || "—"}</td>
                  <td>
                    <div className="flex">
                      <button className="btn-ghost" onClick={() => { setShowForm(false); startEditing(h); }}>Edit</button>
                      <button className="btn-ghost" onClick={() => handleDeleteHolding(h.id)}>✕</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
