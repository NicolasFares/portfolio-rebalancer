import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import type { PortfolioDetail as PDetail, HoldingInput, QuestradeAccount, SyncResult } from "../types";
import { getPortfolio, addHolding, deleteHolding, updateHolding, updatePortfolio, questradeStatus, questradeAccounts, questradeSyncHoldings } from "../api";

const ASSET_TYPES = ["equity", "bond", "crypto", "commodity", "other", "managed"] as const;
const BREAKDOWN_CATEGORIES = ["equity", "bond", "crypto", "cash", "commodity"] as const;
const CURRENCIES = ["CAD", "EUR", "USD"] as const;
const DIMENSIONS = ["asset_type", "sector", "geography"] as const;
const DIMENSION_LABELS: Record<string, string> = { asset_type: "Asset Type", sector: "Sector", geography: "Geography" };
const SECTOR_SUGGESTIONS = ["broad_market", "defense", "technology", "energy", "gold", "healthcare", "financials"];
const GEO_SUGGESTIONS = ["US", "EU", "Global", "CAD", "Emerging"];

const BAR_COLORS: Record<string, string> = {
  equity: "var(--accent)",
  bond: "var(--blue)",
  crypto: "var(--yellow)",
  cash: "var(--green)",
  commodity: "var(--orange)",
  other: "var(--text-muted)",
};

const emptyHolding: HoldingInput = {
  name: "",
  ticker: "",
  asset_type: "equity",
  quantity: 0,
  price_per_unit: 0,
  currency: "CAD",
  account_id: 0,
  sector: "",
  geography: "",
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
  const [qtConnected, setQtConnected] = useState(false);
  const [qtAccounts, setQtAccounts] = useState<QuestradeAccount[]>([]);
  const [qtSelectedAccounts, setQtSelectedAccounts] = useState<Set<string>>(new Set());
  const [qtSyncing, setQtSyncing] = useState(false);
  const [qtSyncResult, setQtSyncResult] = useState<SyncResult | null>(null);
  const [qtError, setQtError] = useState("");
  const [chartDimension, setChartDimension] = useState<string>("asset_type");
  const [filterAccountId, setFilterAccountId] = useState<number | undefined>(undefined);

  const load = () => {
    if (!id) return;
    getPortfolio(Number(id)).then((p) => {
      setPortfolio(p);
      setEurRate(p.eur_to_base);
      setUsdRate(p.usd_to_base);
      // Default form account_id to first account
      if (p.accounts.length > 0 && form.account_id === 0) {
        setForm((f) => ({ ...f, account_id: p.accounts[0].id }));
      }
    });
  };

  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    questradeStatus().then((s) => {
      const connected = s.status === "connected" || s.status === "expired";
      setQtConnected(connected);
      if (connected) {
        questradeAccounts()
          .then((r) => {
            setQtAccounts(r.accounts);
            setQtSelectedAccounts(new Set(r.accounts.map((a) => a.number)));
          })
          .catch(() => {});
      }
    }).catch(() => {});
  }, []);

  const handleSync = async () => {
    setQtSyncing(true);
    setQtError("");
    setQtSyncResult(null);
    try {
      const selected = qtSelectedAccounts.size === qtAccounts.length
        ? undefined
        : Array.from(qtSelectedAccounts);
      const result = await questradeSyncHoldings(Number(id), selected);
      setQtSyncResult(result);
      load();
    } catch (e: any) {
      setQtError(e.message || "Sync failed");
    } finally {
      setQtSyncing(false);
    }
  };

  const toggleAccount = (num: string) => {
    setQtSelectedAccounts((prev) => {
      const next = new Set(prev);
      if (next.has(num)) next.delete(num);
      else next.add(num);
      return next;
    });
  };

  if (!portfolio) return <div>Loading...</div>;

  // Filter holdings by account
  const filteredHoldings = filterAccountId !== undefined
    ? portfolio.holdings.filter((h) => h.account_id === filterAccountId)
    : portfolio.holdings;

  // Compute total value from holdings + account cash
  const toBase = (val: number, currency: string) => {
    if (currency === portfolio.base_currency) return val;
    if (currency === "EUR") return val * portfolio.eur_to_base;
    if (currency === "USD") return val * portfolio.usd_to_base;
    return val;
  };

  const holdingsValue = portfolio.holdings.reduce((sum, h) => {
    return sum + toBase(h.quantity * h.price_per_unit, h.currency);
  }, 0);

  const accountCashValue = portfolio.accounts.reduce((sum, a) => {
    return sum + toBase(a.cash_balance, a.currency);
  }, 0);

  const totalValue = holdingsValue + accountCashValue;

  const computeByDimension = (dim: string) => {
    const result: Record<string, number> = {};
    portfolio.holdings.forEach((h) => {
      const converted = toBase(h.quantity * h.price_per_unit, h.currency);
      if (dim === "asset_type") {
        if (h.allocation_breakdown) {
          for (const [cat, pct] of Object.entries(h.allocation_breakdown)) {
            result[cat] = (result[cat] || 0) + converted * (pct / 100);
          }
        } else {
          result[h.asset_type] = (result[h.asset_type] || 0) + converted;
        }
      } else if (dim === "sector") {
        const key = h.sector || "unclassified";
        result[key] = (result[key] || 0) + converted;
      } else if (dim === "geography") {
        const key = h.geography || "unclassified";
        result[key] = (result[key] || 0) + converted;
      }
    });
    // Add account cash to "cash" category for asset_type
    if (dim === "asset_type" && accountCashValue > 0) {
      result["cash"] = (result["cash"] || 0) + accountCashValue;
    }
    return result;
  };
  const byType = computeByDimension(chartDimension);

  const handleAddHolding = async (e: React.FormEvent) => {
    e.preventDefault();
    await addHolding(Number(id), form);
    setForm({ ...emptyHolding, account_id: form.account_id });
    setShowForm(false);
    load();
  };

  const handleDeleteHolding = async (holdingId: number) => {
    await deleteHolding(holdingId);
    load();
  };

  const startEditing = (h: any) => {
    setEditingId(h.id);
    setEditForm({
      name: h.name,
      ticker: h.ticker || "",
      asset_type: h.asset_type,
      quantity: h.quantity,
      price_per_unit: h.price_per_unit,
      currency: h.currency,
      account_id: h.account_id,
      sector: h.sector || "",
      geography: h.geography || "",
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

  const renderHoldingForm = (currentForm: HoldingInput, setCurrentForm: (f: HoldingInput) => void, isEdit: boolean) => (
    <>
      <div className="grid-form">
        <label>
          Name
          <input required value={currentForm.name} onChange={(e) => setCurrentForm({ ...currentForm, name: e.target.value })} />
        </label>
        <label>
          Ticker
          <input value={currentForm.ticker || ""} onChange={(e) => setCurrentForm({ ...currentForm, ticker: e.target.value })} placeholder="e.g. VOO" />
        </label>
        <label>
          Type
          <select
            value={currentForm.asset_type}
            onChange={(e) => {
              const newType = e.target.value;
              const clearBreakdown = newType !== "managed" ? { allocation_breakdown: null } : {};
              setCurrentForm({ ...currentForm, asset_type: newType, ...clearBreakdown });
            }}
          >
            {ASSET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label>
          Quantity
          <input type="number" step="any" required value={currentForm.quantity || ""} onChange={(e) => setCurrentForm({ ...currentForm, quantity: Number(e.target.value) })} />
        </label>
        <label>
          Price/Unit
          <input type="number" step="any" required value={currentForm.price_per_unit || ""} onChange={(e) => setCurrentForm({ ...currentForm, price_per_unit: Number(e.target.value) })} />
        </label>
        <label>
          Currency
          <select value={currentForm.currency} onChange={(e) => setCurrentForm({ ...currentForm, currency: e.target.value })}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label>
          Account
          <select value={currentForm.account_id} onChange={(e) => setCurrentForm({ ...currentForm, account_id: Number(e.target.value) })}>
            {portfolio.accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </label>
        <label>
          Sector
          <input list="sector-suggestions" value={currentForm.sector || ""} onChange={(e) => setCurrentForm({ ...currentForm, sector: e.target.value })} placeholder="e.g. defense" />
          <datalist id="sector-suggestions">
            {SECTOR_SUGGESTIONS.map((s) => <option key={s} value={s} />)}
          </datalist>
        </label>
        <label>
          Geography
          <input list="geo-suggestions" value={currentForm.geography || ""} onChange={(e) => setCurrentForm({ ...currentForm, geography: e.target.value })} placeholder="e.g. US" />
          <datalist id="geo-suggestions">
            {GEO_SUGGESTIONS.map((g) => <option key={g} value={g} />)}
          </datalist>
        </label>
      </div>
      {currentForm.asset_type === "managed" && (
        <div style={{ marginTop: "0.75rem", padding: "0.75rem", background: "var(--surface)", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
          <div style={{ fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.5rem" }}>
            Allocation Breakdown (must sum to 100%)
          </div>
          <div className="grid-form">
            {BREAKDOWN_CATEGORIES.map((cat) => {
              const bd = currentForm.allocation_breakdown || {};
              return (
                <label key={cat}>
                  {cat} %
                  <input
                    type="number" step="any" min="0" max="100"
                    value={bd[cat] ?? ""}
                    onChange={(e) => {
                      const val = e.target.value === "" ? 0 : Number(e.target.value);
                      const updated = { ...bd, [cat]: val };
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
            Total: {Object.values(currentForm.allocation_breakdown || {}).reduce((s, v) => s + v, 0)}%
          </div>
        </div>
      )}
    </>
  );

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
          <Link to={`/portfolio/${id}/accounts`}>
            <button className="btn-ghost">Accounts</button>
          </Link>
          <Link to={`/portfolio/${id}/rebalance`}>
            <button className="btn-primary">Rebalance</button>
          </Link>
        </div>
      </div>

      {/* Questrade Sync */}
      {qtConnected && (
        <div className="card">
          <div className="flex-between">
            <h2 style={{ marginBottom: 0 }}>Questrade Sync</h2>
            <button
              className="btn-primary"
              onClick={handleSync}
              disabled={qtSyncing || qtSelectedAccounts.size === 0}
            >
              {qtSyncing ? "Syncing..." : "Sync from Questrade"}
            </button>
          </div>
          {qtAccounts.length > 0 && (
            <div className="flex" style={{ marginTop: "0.75rem", flexWrap: "wrap" }}>
              {qtAccounts.map((a) => (
                <label
                  key={a.number}
                  className="flex"
                  style={{ gap: "0.35rem", fontSize: "0.85rem", cursor: "pointer" }}
                >
                  <input
                    type="checkbox"
                    checked={qtSelectedAccounts.has(a.number)}
                    onChange={() => toggleAccount(a.number)}
                  />
                  {a.type} ({a.number})
                </label>
              ))}
            </div>
          )}
          {qtError && (
            <div style={{ color: "var(--red)", fontSize: "0.85rem", marginTop: "0.5rem" }}>
              {qtError}
            </div>
          )}
          {qtSyncResult && (
            <div style={{ marginTop: "0.75rem", fontSize: "0.85rem" }}>
              <div style={{ marginBottom: "0.5rem" }}>
                <span className="positive" style={{ marginRight: "1rem" }}>
                  +{qtSyncResult.added} added
                </span>
                <span style={{ color: "var(--blue)" }}>
                  {qtSyncResult.updated} updated
                </span>
              </div>
              {qtSyncResult.changes.length > 0 && (
                <div style={{ maxHeight: 200, overflow: "auto" }}>
                  {qtSyncResult.changes.map((c, i) => (
                    <div
                      key={i}
                      style={{
                        padding: "0.25rem 0",
                        borderBottom: "1px solid var(--border)",
                        color: "var(--text-muted)",
                      }}
                    >
                      <span style={{ color: c.action === "added" ? "var(--green)" : "var(--blue)" }}>
                        {c.action}
                      </span>{" "}
                      <strong>{c.ticker}</strong> — {c.details}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

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
          <div className="flex-between">
            <h2 style={{ marginBottom: 0 }}>Current Allocation</h2>
            <div className="dimension-tabs">
              {DIMENSIONS.map((d) => (
                <button
                  key={d}
                  className={`dimension-tab${chartDimension === d ? " active" : ""}`}
                  onClick={() => setChartDimension(d)}
                >
                  {DIMENSION_LABELS[d]}
                </button>
              ))}
            </div>
          </div>
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
          <h2 style={{ marginBottom: 0 }}>Holdings ({filteredHoldings.length})</h2>
          <div className="flex">
            {/* Account filter */}
            <div className="filter-bar">
              <select
                value={filterAccountId ?? ""}
                onChange={(e) => setFilterAccountId(e.target.value ? Number(e.target.value) : undefined)}
              >
                <option value="">All Accounts</option>
                {portfolio.accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            {editingId === null && (
              <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
                {showForm ? "Cancel" : "Add Holding"}
              </button>
            )}
          </div>
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
            {editingId !== null
              ? renderHoldingForm(editForm, setEditForm, true)
              : renderHoldingForm(form, setForm, false)
            }
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
                    setForm({ ...emptyHolding, account_id: form.account_id });
                  }
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {filteredHoldings.length === 0 ? (
          <div className="empty-state">No holdings yet.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Sector</th>
                <th>Geo</th>
                <th>Qty</th>
                <th>Price</th>
                <th>Value</th>
                <th>Account</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredHoldings.map((h) => (
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
                  <td style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>{h.sector || "—"}</td>
                  <td style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>{h.geography || "—"}</td>
                  <td>{h.quantity}</td>
                  <td>{h.price_per_unit.toLocaleString()} {h.currency}</td>
                  <td>{(h.quantity * h.price_per_unit).toLocaleString()} {h.currency}</td>
                  <td style={{ color: "var(--text-muted)" }}>{h.account_name || "—"}</td>
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
