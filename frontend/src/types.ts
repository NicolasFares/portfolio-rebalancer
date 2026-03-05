export interface Portfolio {
  id: number;
  name: string;
  base_currency: string;
  eur_to_base: number;
  usd_to_base: number;
  created_at: string;
  updated_at: string;
}

export interface Holding {
  id: number;
  portfolio_id: number;
  name: string;
  ticker: string | null;
  asset_type: string;
  quantity: number;
  price_per_unit: number;
  currency: string;
  account: string | null;
  allocation_breakdown: Record<string, number> | null;
  created_at: string;
  updated_at: string;
}

export interface Target {
  id: number;
  portfolio_id: number;
  category: string;
  target_pct: number;
}

export interface TargetInput {
  category: string;
  target_pct: number;
}

export interface PortfolioDetail extends Portfolio {
  holdings: Holding[];
  targets: Target[];
}

export interface RebalanceSuggestion {
  category: string;
  current_value: number;
  current_pct: number;
  target_pct: number;
  diff_pct: number;
  diff_value: number;
}

export interface RebalanceResult {
  total_value: number;
  base_currency: string;
  suggestions: RebalanceSuggestion[];
}

export interface HoldingInput {
  name: string;
  ticker?: string;
  asset_type: string;
  quantity: number;
  price_per_unit: number;
  currency: string;
  account?: string;
  allocation_breakdown?: Record<string, number> | null;
}

export interface PortfolioInput {
  name: string;
  base_currency?: string;
  eur_to_base?: number;
  usd_to_base?: number;
}

// Questrade
export interface QuestradeStatus {
  status: "connected" | "expired" | "not_configured";
  message?: string;
}

export interface QuestradeAccount {
  type: string;
  number: string;
  status: string;
  isPrimary: boolean;
  isBilling: boolean;
  clientAccountType: string;
}

export interface SyncChange {
  ticker: string;
  action: "added" | "updated";
  details: string;
}

export interface SyncResult {
  added: number;
  updated: number;
  changes: SyncChange[];
}
