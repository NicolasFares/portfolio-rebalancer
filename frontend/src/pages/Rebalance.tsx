import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import type { Portfolio, RebalanceResult, TargetInput } from "../types";
import { getPortfolio, getRebalance, setTargets, getTargets } from "../api";

const CATEGORIES = ["equity", "bond", "crypto", "cash"] as const;

const BAR_COLORS: Record<string, string> = {
  equity: "var(--accent)",
  bond: "var(--blue)",
  crypto: "var(--yellow)",
  cash: "var(--green)",
};

export default function Rebalance() {
  const { id } = useParams<{ id: string }>();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [result, setResult] = useState<RebalanceResult | null>(null);
  const [targetForm, setTargetForm] = useState<Record<string, number>>({
    equity: 0,
    bond: 0,
    crypto: 0,
    cash: 0,
  });
  const [error, setError] = useState("");

  const load = async () => {
    if (!id) return;
    const p = await getPortfolio(Number(id));
    setPortfolio(p);

    const existing = await getTargets(Number(id));
    if (existing.length > 0) {
      const map: Record<string, number> = { equity: 0, bond: 0, crypto: 0, cash: 0 };
      existing.forEach((t) => { map[t.category] = t.target_pct; });
      setTargetForm(map);
    }

    const r = await getRebalance(Number(id));
    setResult(r);
  };

  useEffect(() => { load(); }, [id]);

  const handleSaveTargets = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const items: TargetInput[] = CATEGORIES.map((c) => ({
      category: c,
      target_pct: targetForm[c] || 0,
    }));

    const total = items.reduce((s, t) => s + t.target_pct, 0);
    if (Math.abs(total - 100) > 0.01) {
      setError(`Targets must sum to 100% (currently ${total.toFixed(1)}%)`);
      return;
    }

    await setTargets(Number(id), items);
    const r = await getRebalance(Number(id));
    setResult(r);
  };

  const totalPct = Object.values(targetForm).reduce((s, v) => s + v, 0);

  if (!portfolio) return <div>Loading...</div>;

  const fmt = (n: number) =>
    n.toLocaleString("en-CA", { style: "currency", currency: portfolio.base_currency });

  return (
    <div>
      <div className="flex" style={{ marginBottom: "1.5rem" }}>
        <Link to={`/portfolio/${id}`}>← Back</Link>
        <h1 style={{ marginBottom: 0 }}>Rebalance: {portfolio.name}</h1>
      </div>

      {/* Target Allocation Form */}
      <div className="card">
        <h2>Target Allocation</h2>
        <form onSubmit={handleSaveTargets}>
          <div className="grid-form">
            {CATEGORIES.map((cat) => (
              <label key={cat}>
                <span style={{ textTransform: "capitalize" }}>{cat}</span>
                <div className="flex">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={targetForm[cat] || ""}
                    onChange={(e) =>
                      setTargetForm({ ...targetForm, [cat]: Number(e.target.value) })
                    }
                    style={{ width: "100%" }}
                  />
                  <span style={{ color: "var(--text-muted)" }}>%</span>
                </div>
              </label>
            ))}
          </div>
          <div className="flex" style={{ marginTop: "0.75rem" }}>
            <button type="submit" className="btn-primary">Save & Rebalance</button>
            <span style={{
              fontSize: "0.85rem",
              color: Math.abs(totalPct - 100) < 0.01 ? "var(--green)" : "var(--red)",
            }}>
              Total: {totalPct.toFixed(1)}%
            </span>
          </div>
          {error && (
            <p style={{ color: "var(--red)", marginTop: "0.5rem", fontSize: "0.85rem" }}>
              {error}
            </p>
          )}
        </form>
      </div>

      {/* Rebalancing Results */}
      {result && result.suggestions.length > 0 && (
        <div className="card">
          <div className="flex-between">
            <h2>Rebalancing Suggestions</h2>
            <span style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
              Total: {fmt(result.total_value)}
            </span>
          </div>

          {/* Visual comparison */}
          <div style={{ marginBottom: "1.5rem" }}>
            {result.suggestions.map((s) => (
              <div key={s.category} style={{ marginBottom: "1rem" }}>
                <div className="flex-between" style={{ marginBottom: "0.25rem" }}>
                  <span style={{ textTransform: "uppercase", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    {s.category}
                  </span>
                  <span style={{ fontSize: "0.8rem" }}>
                    <span style={{ color: "var(--text-muted)" }}>{s.current_pct}%</span>
                    {" → "}
                    <span>{s.target_pct}%</span>
                  </span>
                </div>
                <div className="bar-track">
                  {/* Current allocation bar */}
                  <div
                    className="bar-fill"
                    style={{
                      width: `${s.current_pct}%`,
                      background: BAR_COLORS[s.category] || "var(--text-muted)",
                      opacity: 0.4,
                      position: "absolute",
                    }}
                  />
                  {/* Target marker */}
                  <div
                    style={{
                      position: "absolute",
                      left: `${s.target_pct}%`,
                      top: 0,
                      bottom: 0,
                      width: "2px",
                      background: BAR_COLORS[s.category] || "var(--text-muted)",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Table */}
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th>Current Value</th>
                <th>Current %</th>
                <th>Target %</th>
                <th>Diff %</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {result.suggestions.map((s) => (
                <tr key={s.category}>
                  <td>
                    <span className={`tag tag-${s.category}`}>{s.category}</span>
                  </td>
                  <td>{fmt(s.current_value)}</td>
                  <td>{s.current_pct}%</td>
                  <td>{s.target_pct}%</td>
                  <td className={s.diff_pct >= 0 ? "positive" : "negative"}>
                    {s.diff_pct > 0 ? "+" : ""}{s.diff_pct}%
                  </td>
                  <td className={s.diff_value >= 0 ? "positive" : "negative"}>
                    {s.diff_value > 0 ? "Buy " : s.diff_value < 0 ? "Sell " : ""}
                    {fmt(Math.abs(s.diff_value))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
