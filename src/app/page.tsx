"use client";

import { useEffect, useMemo, useState } from "react";

type Position = {
  ticker: string;
  initialCash: number;
  buyPrice: number;
  sharesOwned: number;
};

type QuoteMap = Record<string, number>;

const REFRESH_MS = 30_000;

const STARTING_POSITIONS: Position[] = [
  { ticker: "CORZ", initialCash: 20000, buyPrice: 29.16, sharesOwned: 685.87 },
  { ticker: "INOD", initialCash: 20000, buyPrice: 95.5, sharesOwned: 209.42 },
  { ticker: "TSSI", initialCash: 20000, buyPrice: 13.56, sharesOwned: 1474.93 },
  { ticker: "AISP", initialCash: 20000, buyPrice: 2.9, sharesOwned: 6896.55 },
  { ticker: "HYLN", initialCash: 20000, buyPrice: 8.1, sharesOwned: 2469.14 },
  { ticker: "ASTS", initialCash: 20000, buyPrice: 80.66, sharesOwned: 247.95 },
  { ticker: "LUNR", initialCash: 20000, buyPrice: 22.85, sharesOwned: 875.27 },
  { ticker: "RKLB", initialCash: 20000, buyPrice: 107.24, sharesOwned: 186.5 },
];

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const sharesFormat = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const percentFormat = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export default function Home() {
  const [quotes, setQuotes] = useState<QuoteMap>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadQuotes = async () => {
      try {
        const symbols = STARTING_POSITIONS.map((p) => p.ticker).join(",");
        const response = await fetch(`/api/quotes?symbols=${symbols}`, {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Quote service is unavailable.");
        }

        const data: { quotes: QuoteMap; updatedAt: string } = await response.json();

        if (!isMounted) {
          return;
        }

        setQuotes(data.quotes ?? {});
        setLastUpdated(new Date(data.updatedAt));
        setError(null);
      } catch {
        if (!isMounted) {
          return;
        }

        setError("Could not refresh live prices. Retrying automatically.");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadQuotes();
    const interval = setInterval(() => void loadQuotes(), REFRESH_MS);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const rows = useMemo(() => {
    return STARTING_POSITIONS.map((position) => {
      const livePrice = quotes[position.ticker] ?? position.buyPrice;
      const currentValue = livePrice * position.sharesOwned;
      const profitLoss = currentValue - position.initialCash;
      const profitLossPercent = position.initialCash === 0 ? 0 : profitLoss / position.initialCash;

      return {
        ...position,
        livePrice,
        currentValue,
        profitLoss,
        profitLossPercent,
      };
    });
  }, [quotes]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc.initialCash += row.initialCash;
        acc.currentValue += row.currentValue;
        acc.profitLoss += row.profitLoss;
        return acc;
      },
      { initialCash: 0, currentValue: 0, profitLoss: 0 },
    );
  }, [rows]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#ecfeff_0%,_#f8fafc_45%,_#f8fafc_100%)] text-slate-900">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-8">
        <header className="rounded-2xl border border-cyan-100 bg-white/70 p-6 shadow-sm backdrop-blur">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-700">
            Live Portfolio Tracker
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Growth Watchlist</h1>
          <p className="mt-3 text-sm text-slate-600">
            Prices auto-refresh every 30 seconds. Open this deployed app on any device to view the same live portfolio.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            {lastUpdated ? `Last updated: ${lastUpdated.toLocaleTimeString()}` : "Loading live data..."}
          </p>
          {error ? <p className="mt-2 text-xs font-medium text-rose-700">{error}</p> : null}
        </header>

        <section className="grid gap-3 sm:grid-cols-3">
          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">Initial Cash</p>
            <p className="mt-1 text-xl font-semibold">{currency.format(totals.initialCash)}</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">Current Value</p>
            <p className="mt-1 text-xl font-semibold">{currency.format(totals.currentValue)}</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">Total Profit / Loss</p>
            <p className={`mt-1 text-xl font-semibold ${totals.profitLoss >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
              {currency.format(totals.profitLoss)}
            </p>
          </article>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-4 py-3 text-left">Ticker</th>
                  <th className="px-4 py-3 text-right">Initial Cash</th>
                  <th className="px-4 py-3 text-right">Buy Price</th>
                  <th className="px-4 py-3 text-right">Shares Owned</th>
                  <th className="px-4 py-3 text-right">Live Price</th>
                  <th className="px-4 py-3 text-right">Current Value</th>
                  <th className="px-4 py-3 text-right">Profit / Loss</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.ticker} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-semibold tracking-wide">{row.ticker}</td>
                    <td className="px-4 py-3 text-right">{currency.format(row.initialCash)}</td>
                    <td className="px-4 py-3 text-right">{currency.format(row.buyPrice)}</td>
                    <td className="px-4 py-3 text-right">{sharesFormat.format(row.sharesOwned)}</td>
                    <td className="px-4 py-3 text-right">{currency.format(row.livePrice)}</td>
                    <td className="px-4 py-3 text-right">{currency.format(row.currentValue)}</td>
                    <td
                      className={`px-4 py-3 text-right font-medium ${
                        row.profitLoss >= 0 ? "text-emerald-700" : "text-rose-700"
                      }`}
                    >
                      {currency.format(row.profitLoss)} ({percentFormat.format(row.profitLossPercent)})
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
                <tr>
                  <td className="px-4 py-3">Totals</td>
                  <td className="px-4 py-3 text-right">{currency.format(totals.initialCash)}</td>
                  <td className="px-4 py-3 text-right">-</td>
                  <td className="px-4 py-3 text-right">-</td>
                  <td className="px-4 py-3 text-right">-</td>
                  <td className="px-4 py-3 text-right">{currency.format(totals.currentValue)}</td>
                  <td
                    className={`px-4 py-3 text-right ${totals.profitLoss >= 0 ? "text-emerald-700" : "text-rose-700"}`}
                  >
                    {currency.format(totals.profitLoss)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        {isLoading ? <p className="text-sm text-slate-600">Fetching first live quote snapshot...</p> : null}
      </main>
    </div>
  );
}
