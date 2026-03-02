import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Portfolio } from "../types";
import { listPortfolios, createPortfolio, deletePortfolio } from "../api";

export default function PortfolioList() {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [name, setName] = useState("");

  const load = () => listPortfolios().then(setPortfolios);

  useEffect(() => { load(); }, []);

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
    </div>
  );
}
