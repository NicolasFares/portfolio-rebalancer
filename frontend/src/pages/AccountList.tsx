import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import type { AccountWithStats, AccountInput } from "../types";
import { listAccounts, createAccount, updateAccount, deleteAccount, getPortfolio } from "../api";

const CURRENCIES = ["CAD", "EUR", "USD"] as const;

const emptyAccount: AccountInput = {
  name: "",
  institution: "",
  account_type: "",
  account_number: "",
  currency: "CAD",
  cash_balance: 0,
};

export default function AccountList() {
  const { id } = useParams<{ id: string }>();
  const [accounts, setAccounts] = useState<AccountWithStats[]>([]);
  const [portfolioName, setPortfolioName] = useState("");
  const [baseCurrency, setBaseCurrency] = useState("CAD");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<AccountInput>({ ...emptyAccount });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<AccountInput>({ ...emptyAccount });

  const load = async () => {
    if (!id) return;
    const [accts, portfolio] = await Promise.all([
      listAccounts(Number(id)),
      getPortfolio(Number(id)),
    ]);
    setAccounts(accts);
    setPortfolioName(portfolio.name);
    setBaseCurrency(portfolio.base_currency);
  };

  useEffect(() => { load(); }, [id]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    await createAccount(Number(id), form);
    setForm({ ...emptyAccount });
    setShowForm(false);
    load();
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId === null) return;
    await updateAccount(editingId, editForm);
    setEditingId(null);
    load();
  };

  const handleDelete = async (accountId: number) => {
    if (!confirm("Delete this account and all its holdings?")) return;
    await deleteAccount(accountId);
    load();
  };

  const startEditing = (a: AccountWithStats) => {
    setEditingId(a.id);
    setEditForm({
      name: a.name,
      institution: a.institution || "",
      account_type: a.account_type || "",
      account_number: a.account_number || "",
      currency: a.currency,
      cash_balance: a.cash_balance,
    });
  };

  const fmtCur = (n: number, currency: string) =>
    n.toLocaleString("en-CA", { style: "currency", currency });

  const renderForm = (
    currentForm: AccountInput,
    setCurrentForm: (f: AccountInput) => void,
    onSubmit: (e: React.FormEvent) => void,
    isEdit: boolean,
  ) => (
    <form
      onSubmit={onSubmit}
      style={{
        marginBottom: "1rem",
        padding: "1rem",
        background: "var(--surface-hover)",
        borderRadius: "var(--radius)",
        border: "1px solid var(--border)",
      }}
    >
      <div style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.75rem", color: isEdit ? "var(--accent)" : "var(--text)" }}>
        {isEdit ? "Edit Account" : "New Account"}
      </div>
      <div className="grid-form">
        <label>
          Name
          <input required value={currentForm.name} onChange={(e) => setCurrentForm({ ...currentForm, name: e.target.value })} />
        </label>
        <label>
          Institution
          <input value={currentForm.institution || ""} onChange={(e) => setCurrentForm({ ...currentForm, institution: e.target.value })} placeholder="e.g. Questrade" />
        </label>
        <label>
          Account Type
          <input value={currentForm.account_type || ""} onChange={(e) => setCurrentForm({ ...currentForm, account_type: e.target.value })} placeholder="e.g. TFSA" />
        </label>
        <label>
          Account Number
          <input value={currentForm.account_number || ""} onChange={(e) => setCurrentForm({ ...currentForm, account_number: e.target.value })} />
        </label>
        <label>
          Currency
          <select value={currentForm.currency} onChange={(e) => setCurrentForm({ ...currentForm, currency: e.target.value })}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label>
          Cash Balance
          <input type="number" step="any" value={currentForm.cash_balance || ""} onChange={(e) => setCurrentForm({ ...currentForm, cash_balance: Number(e.target.value) })} />
        </label>
      </div>
      <div className="flex" style={{ marginTop: "0.5rem" }}>
        <button type="submit" className="btn-primary">{isEdit ? "Save" : "Add"}</button>
        <button type="button" className="btn-ghost" onClick={() => { isEdit ? setEditingId(null) : setShowForm(false); }}>Cancel</button>
      </div>
    </form>
  );

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: "1.5rem" }}>
        <div className="flex">
          <Link to={`/portfolio/${id}`}>← Back to Portfolio</Link>
          <h1 style={{ marginBottom: 0 }}>Accounts ({accounts.length})</h1>
        </div>
        {editingId === null && (
          <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? "Cancel" : "+ Add Account"}
          </button>
        )}
      </div>

      {showForm && renderForm(form, setForm, handleAdd, false)}
      {editingId !== null && renderForm(editForm, setEditForm, handleUpdate, true)}

      {accounts.length === 0 ? (
        <div className="empty-state">No accounts yet.</div>
      ) : (
        accounts.map((a) => (
          <div key={a.id} className="account-card">
            <div className="flex-between" style={{ marginBottom: "0.5rem" }}>
              <div>
                <strong style={{ fontSize: "1.1rem" }}>{a.name}</strong>
                <span style={{ color: "var(--text-muted)", marginLeft: "0.75rem", fontSize: "0.85rem" }}>
                  {a.institution ? `${a.institution} · ` : ""}{a.currency}
                </span>
              </div>
              <div className="flex">
                <button className="btn-ghost" onClick={() => { setShowForm(false); startEditing(a); }}>Edit</button>
                <button className="btn-ghost" style={{ color: "var(--red)" }} onClick={() => handleDelete(a.id)}>Delete</button>
              </div>
            </div>
            <div className="account-stats">
              <div>
                <span className="account-stats-label">Cash</span>
                <span>{fmtCur(a.cash_balance, a.currency)}</span>
              </div>
              <div>
                <span className="account-stats-label">Holdings</span>
                <span>{a.holding_count} holding{a.holding_count !== 1 ? "s" : ""}</span>
              </div>
              <div>
                <span className="account-stats-label">Total</span>
                <span>{fmtCur(a.total_value, a.currency)}</span>
              </div>
              {a.currency !== baseCurrency && (
                <div>
                  <span className="account-stats-label">Total ({baseCurrency})</span>
                  <span>{fmtCur(a.total_value_base, baseCurrency)}</span>
                </div>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
