export interface Portfolio {
  id: number;
  name: string;
  base_currency: string;
  eur_to_base: number;
  usd_to_base: number;
  created_at: string;
  updated_at: string;
}

export interface Account {
  id: number;
  portfolio_id: number;
  name: string;
  institution: string | null;
  account_type: string | null;
  account_number: string | null;
  currency: string;
  cash_balance: number;
  created_at: string;
  updated_at: string;
}

export interface AccountWithStats extends Account {
  holding_count: number;
  total_value: number;
  total_value_base: number;
}

export interface AccountInput {
  name: string;
  institution?: string;
  account_type?: string;
  account_number?: string;
  currency?: string;
  cash_balance?: number;
}

export interface Holding {
  id: number;
  account_id: number;
  account_name: string;
  name: string;
  ticker: string | null;
  asset_type: string;
  quantity: number;
  price_per_unit: number;
  currency: string;
  sector: string | null;
  geography: string | null;
  allocation_breakdown: Record<string, number> | null;
  created_at: string;
  updated_at: string;
}

export interface Target {
  id: number;
  portfolio_id: number;
  category: string;
  target_pct: number;
  dimension: string;
}

export interface TargetInput {
  category: string;
  target_pct: number;
  dimension: string;
}

export interface PortfolioDetail extends Portfolio {
  holdings: Holding[];
  targets: Target[];
  accounts: Account[];
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
  account_id: number;
  sector?: string;
  geography?: string;
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
