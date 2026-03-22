"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Wallet, Scale, LineChart, ChevronRight } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface PortfolioNavProps {
  portfolioId: string;
  portfolioName?: string;
}

const tabs = [
  { label: "Holdings", href: "", icon: BarChart3 },
  { label: "Accounts", href: "/accounts", icon: Wallet },
  { label: "Rebalance", href: "/rebalance", icon: Scale },
  { label: "History", href: "/history", icon: LineChart },
] as const;

export function PortfolioNav({ portfolioId, portfolioName }: PortfolioNavProps) {
  const pathname = usePathname();
  const base = `/portfolio/${portfolioId}`;

  return (
    <div className="mb-6">
      {portfolioName && (
        <div className="mb-3 flex items-center gap-1.5 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground transition-colors">
            Portfolios
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground">{portfolioName}</span>
        </div>
      )}
      {portfolioName && <Separator className="mb-3" />}
      <div className="flex gap-1 border-b border-border">
        {tabs.map((tab) => {
          const href = `${base}${tab.href}`;
          const isActive = pathname === href;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.label}
              href={href}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm transition-colors ${
                isActive
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
