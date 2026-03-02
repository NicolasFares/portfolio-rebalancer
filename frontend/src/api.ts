import type {
  Portfolio,
  PortfolioDetail,
  PortfolioInput,
  Holding,
  HoldingInput,
  Target,
  TargetInput,
  RebalanceResult,
} from "./types";

const BASE = "http://localhost:8000/api";

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

// Holdings
export const addHolding = (portfolioId: number, data: HoldingInput) =>
  request<Holding>(`/portfolios/${portfolioId}/holdings`, {
    method: "POST",
    body: JSON.stringify(data),
  });

export const updateHolding = (id: number, data: Partial<HoldingInput>) =>
  request<Holding>(`/holdings/${id}`, { method: "PUT", body: JSON.stringify(data) });  // note: /api prefix added by BASE, but holdings route is /api/holdings/{id}

export const deleteHolding = (id: number) =>
  request<void>(`/holdings/${id}`, { method: "DELETE" });

// Targets
export const getTargets = (portfolioId: number) =>
  request<Target[]>(`/portfolios/${portfolioId}/targets`);

export const setTargets = (portfolioId: number, data: TargetInput[]) =>
  request<Target[]>(`/portfolios/${portfolioId}/targets`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

// Rebalance
export const getRebalance = (portfolioId: number) =>
  request<RebalanceResult>(`/portfolios/${portfolioId}/rebalance`);
