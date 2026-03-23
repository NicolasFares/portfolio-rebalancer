import type {
  Portfolio,
  PortfolioDetail,
  PortfolioInput,
  Holding,
  HoldingInput,
  Target,
  TargetInput,
  RebalanceResult,
  QuestradeStatus,
  QuestradeAccount,
  SyncResult,
  AccountWithStats,
  AccountInput,
  Account,
  PriceSyncResult,
  ExchangeRateSyncResult,
} from "./types";

const BASE = "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// Portfolios
export const listPortfolios = () => request<Portfolio[]>("/portfolios");

export const createPortfolio = (data: PortfolioInput) =>
  request<Portfolio>("/portfolios", { method: "POST", body: JSON.stringify(data) });

export const getPortfolio = (id: number) =>
  request<PortfolioDetail>(`/portfolios/${id}`);

export const updatePortfolio = (id: number, data: Partial<PortfolioInput>) =>
  request<Portfolio>(`/portfolios/${id}`, { method: "PUT", body: JSON.stringify(data) });

export const deletePortfolio = (id: number) =>
  request<void>(`/portfolios/${id}`, { method: "DELETE" });

// Accounts
export const listAccounts = (portfolioId: number) =>
  request<AccountWithStats[]>(`/portfolios/${portfolioId}/accounts`);

export const createAccount = (portfolioId: number, data: AccountInput) =>
  request<Account>(`/portfolios/${portfolioId}/accounts`, {
    method: "POST",
    body: JSON.stringify(data),
  });

export const updateAccount = (id: number, data: Partial<AccountInput>) =>
  request<Account>(`/accounts/${id}`, { method: "PUT", body: JSON.stringify(data) });

export const deleteAccount = (id: number) =>
  request<void>(`/accounts/${id}`, { method: "DELETE" });

// Holdings
export const addHolding = (portfolioId: number, data: HoldingInput) =>
  request<Holding>(`/portfolios/${portfolioId}/holdings`, {
    method: "POST",
    body: JSON.stringify(data),
  });

export const updateHolding = (id: number, data: Partial<HoldingInput>) =>
  request<Holding>(`/holdings/${id}`, { method: "PUT", body: JSON.stringify(data) });

export const deleteHolding = (id: number) =>
  request<void>(`/holdings/${id}`, { method: "DELETE" });

// Targets
export const getTargets = (portfolioId: number, dimension?: string) =>
  request<Target[]>(`/portfolios/${portfolioId}/targets${dimension ? `?dimension=${dimension}` : ""}`);

export const setTargets = (portfolioId: number, data: TargetInput[]) =>
  request<Target[]>(`/portfolios/${portfolioId}/targets`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

// Rebalance
export const getRebalance = (portfolioId: number, dimension?: string, accountId?: number) => {
  const params = new URLSearchParams();
  if (dimension) params.set("dimension", dimension);
  if (accountId !== undefined) params.set("account_id", String(accountId));
  const qs = params.toString();
  return request<RebalanceResult>(`/portfolios/${portfolioId}/rebalance${qs ? `?${qs}` : ""}`);
};

// Price & Exchange Rate Sync
export const syncPrices = (portfolioId: number, holdingIds?: number[]) =>
  request<PriceSyncResult>(`/sync/${portfolioId}/prices`, {
    method: "POST",
    body: JSON.stringify(holdingIds ? { holding_ids: holdingIds } : {}),
  });

export const syncExchangeRates = (portfolioId: number) =>
  request<ExchangeRateSyncResult>(`/sync/${portfolioId}/exchange-rates`, {
    method: "POST",
  });

// Questrade
export const questradeAuth = (refreshToken: string) =>
  request<{ status: string }>("/questrade/auth", {
    method: "POST",
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

export const questradeStatus = () =>
  request<QuestradeStatus>("/questrade/status");

export const questradeDisconnect = () =>
  request<{ status: string }>("/questrade/auth", { method: "DELETE" });

export const questradeAccounts = () =>
  request<{ accounts: QuestradeAccount[] }>("/questrade/accounts");

export const questradeSyncHoldings = (
  portfolioId: number,
  accountNumbers?: string[],
) =>
  request<SyncResult>(`/questrade/sync/${portfolioId}`, {
    method: "POST",
    body: JSON.stringify({ account_numbers: accountNumbers || null }),
  });
