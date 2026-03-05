import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Portfolio, QuestradeStatus } from "../types";
import { listPortfolios, createPortfolio, deletePortfolio, questradeAuth, questradeStatus, questradeDisconnect } from "../api";

export default function PortfolioList() {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [name, setName] = useState("");
  const [qtStatus, setQtStatus] = useState<QuestradeStatus | null>(null);
  const [qtToken, setQtToken] = useState("");
  const [qtError, setQtError] = useState("");
  const [qtLoading, setQtLoading] = useState(false);

  const load = () => listPortfolios().then(setPortfolios);

  const loadQtStatus = () => {
    questradeStatus().then(setQtStatus).catch(() => {});
  };

  useEffect(() => { load(); loadQtStatus(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await createPortfolio({ name: name.trim() });
    setName("");
    load();
  };

  const handleDelete = async (id: number) => {
    await deletePortfolio(id);
    load();
  };

  const handleQtConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qtToken.trim()) return;
    setQtLoading(true);
    setQtError("");
    try {
      await questradeAuth(qtToken.trim());
      setQtToken("");
      loadQtStatus();
    } catch (err: any) {
      setQtError(err.message || "Connection failed");
    } finally {
      setQtLoading(false);
    }
  };

  const handleQtDisconnect = async () => {
    await questradeDisconnect();
    loadQtStatus();
  };

  return (
    <div>
      <h1>Portfolios</h1>

      <form onSubmit={handleCreate} className="flex" style={{ marginBottom: "1.5rem" }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New portfolio name..."
          style={{ flex: 1 }}
        />
        <button type="submit" className="btn-primary">Create</button>
      </form>

      {portfolios.length === 0 ? (
        <div className="empty-state">No portfolios yet. Create one above.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Currency</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {portfolios.map((p) => (
              <tr key={p.id}>
                <td>
                  <Link to={`/portfolio/${p.id}`}>{p.name}</Link>
                </td>
                <td>{p.base_currency}</td>
                <td style={{ color: "var(--text-muted)" }}>
                  {new Date(p.created_at).toLocaleDateString()}
                </td>
                <td>
                  <button className="btn-danger" onClick={() => handleDelete(p.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {/* Questrade Connection */}
      <div className="card" style={{ marginTop: "2rem" }}>
        <div className="flex-between">
          <h2 style={{ marginBottom: 0 }}>Questrade Connection</h2>
          {qtStatus && (
            <span style={{
              fontSize: "0.8rem",
              fontWeight: 600,
              color: qtStatus.status === "connected" ? "var(--green)"
                : qtStatus.status === "expired" ? "var(--yellow)"
                : "var(--text-muted)",
            }}>
              {qtStatus.status === "connected" ? "Connected" :
               qtStatus.status === "expired" ? "Token expired (will refresh)" :
               "Not configured"}
            </span>
          )}
        </div>
        {qtStatus?.status === "connected" || qtStatus?.status === "expired" ? (
          <div style={{ marginTop: "0.75rem" }}>
            <button className="btn-danger" onClick={handleQtDisconnect}>Disconnect</button>
          </div>
        ) : (
          <form onSubmit={handleQtConnect} style={{ marginTop: "0.75rem" }}>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "0.5rem" }}>
              Paste your refresh token from{" "}
              <a href="https://www.questrade.com/api/documentation/getting-started" target="_blank" rel="noopener noreferrer">
                Questrade API Centre
              </a>
            </div>
            <div className="flex">
              <input
                value={qtToken}
                onChange={(e) => setQtToken(e.target.value)}
                placeholder="Refresh token..."
                type="password"
                style={{ flex: 1 }}
              />
              <button type="submit" className="btn-primary" disabled={qtLoading}>
                {qtLoading ? "Connecting..." : "Connect"}
              </button>
            </div>
            {qtError && (
              <div style={{ color: "var(--red)", fontSize: "0.85rem", marginTop: "0.5rem" }}>
                {qtError}
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
