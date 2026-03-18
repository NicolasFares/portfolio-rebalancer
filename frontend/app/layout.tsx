import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Portfolio Rebalancer",
  description: "Track and rebalance your investment portfolio",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} antialiased`}>
        <div className="mx-auto max-w-[960px] px-6 py-8">
          <nav className="mb-8 flex gap-4 border-b border-border pb-4">
            <Link href="/" className="text-primary hover:text-primary/80 font-medium">
              Portfolios
            </Link>
          </nav>
          {children}
        </div>
      </body>
    </html>
  );
}
