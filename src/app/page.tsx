"use client";

import { useEffect, useMemo, useState } from "react";

type Position = {
  ticker: string;
  buyPrice: number;
  initialCash: number;
};

type QuoteMap = Record<string, number>;

const REFRESH_MS = 30_000;
const DEFAULT_CASH_PER_POSITION = 20_000;
const STORAGE_KEY = "live-portfolio-tracker:v1";

const STARTING_POSITIONS: Position[] = [
  { ticker: "CORZ", buyPrice: 29.16, initialCash: DEFAULT_CASH_PER_POSITION },
  { ticker: "INOD", buyPrice: 95.5, initialCash: DEFAULT_CASH_PER_POSITION },
  { ticker: "TSSI", buyPrice: 13.56, initialCash: DEFAULT_CASH_PER_POSITION },
  { ticker: "AISP", buyPrice: 2.9, initialCash: DEFAULT_CASH_PER_POSITION },
  { ticker: "HYLN", buyPrice: 8.1, initialCash: DEFAULT_CASH_PER_POSITION },
  { ticker: "ASTS", buyPrice: 80.66, initialCash: DEFAULT_CASH_PER_POSITION },
  { ticker: "LUNR", buyPrice: 22.85, initialCash: DEFAULT_CASH_PER_POSITION },
  { ticker: "RKLB", buyPrice: 107.24, initialCash: DEFAULT_CASH_PER_POSITION },
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
  const [positions, setPositions] = useState<Position[]>(() => {
    if (typeof window === "undefined") {
      return STARTING_POSITIONS;
    }

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return STARTING_POSITIONS;
      }

      const parsed: { positions?: Position[] } = JSON.parse(raw);
      if (!Array.isArray(parsed.positions) || !parsed.positions.length) {
        return STARTING_POSITIONS;
      }

      const cleaned = parsed.positions
        .map((item) => ({
          ticker: String(item.ticker ?? "").toUpperCase().trim(),
          buyPrice: Number(item.buyPrice),
          initialCash: Number(item.initialCash) || DEFAULT_CASH_PER_POSITION,
        }))
        .filter(
          (item) =>
            item.ticker &&
            Number.isFinite(item.buyPrice) &&
            item.buyPrice > 0 &&
            Number.isFinite(item.initialCash) &&
            item.initialCash > 0,
        );

      return cleaned.length ? cleaned : STARTING_POSITIONS;
    } catch {
      return STARTING_POSITIONS;
    }
  });

  const [cashPerPosition, setCashPerPosition] = useState(() => {
    if (typeof window === "undefined") {
      return DEFAULT_CASH_PER_POSITION;
    }

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return DEFAULT_CASH_PER_POSITION;
      }

      const parsed: { cashPerPosition?: number } = JSON.parse(raw);
      return typeof parsed.cashPerPosition === "number" && parsed.cashPerPosition > 0
        ? parsed.cashPerPosition
        : DEFAULT_CASH_PER_POSITION;
    } catch {
      return DEFAULT_CASH_PER_POSITION;
    }
  });
  const [newTicker, setNewTicker] = useState("");
  const [newBuyPrice, setNewBuyPrice] = useState("");
  const [isBuyPriceManual, setIsBuyPriceManual] = useState(false);
  const [isLookupLoading, setIsLookupLoading] = useState(false);
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);
  const [quotes, setQuotes] = useState<QuoteMap>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        positions,
        cashPerPosition,
      }),
    );
  }, [positions, cashPerPosition]);

  useEffect(() => {
    const ticker = newTicker.trim().toUpperCase();

    if (!ticker) {
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setIsLookupLoading(true);
      setLookupMessage("Looking up live price...");

      void fetch(`/api/quotes?symbols=${encodeURIComponent(ticker)}`, {
        cache: "no-store",
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error("Quote lookup failed.");
          }

          const data: { quotes?: QuoteMap } = await response.json();
          const suggestedPrice = data.quotes?.[ticker];

          if (typeof suggestedPrice === "number") {
            setLookupMessage(`Current price: ${currency.format(suggestedPrice)}`);
            if (!isBuyPriceManual) {
              setNewBuyPrice(String(suggestedPrice));
            }
          } else {
            setLookupMessage("No live price found yet. You can still enter a price manually.");
          }
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setLookupMessage("Live quote unavailable right now. Enter a price manually or try again.");
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setIsLookupLoading(false);
          }
        });
    }, 400);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [newTicker, isBuyPriceManual]);

  useEffect(() => {
    let isMounted = true;

    const loadQuotes = async () => {
      if (!positions.length) {
        setQuotes({});
        setIsLoading(false);
        return;
      }

      try {
        const symbols = positions.map((p) => p.ticker).join(",");
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
  }, [positions]);

  const addPosition = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const ticker = newTicker.trim().toUpperCase();
    const buyPrice = Number(
      newBuyPrice || (suggestedNewBuyPrice !== null && !isBuyPriceManual ? String(suggestedNewBuyPrice) : ""),
    );

    if (!ticker || !Number.isFinite(buyPrice) || buyPrice <= 0) {
      return;
    }

    setPositions((prev) => {
      if (prev.some((item) => item.ticker === ticker)) {
        return prev;
      }

      return [...prev, { ticker, buyPrice, initialCash: cashPerPosition }];
    });

    setNewTicker("");
    setNewBuyPrice("");
    setIsBuyPriceManual(false);
    setLookupMessage(null);
  };

  const removePosition = (ticker: string) => {
    setPositions((prev) => prev.filter((item) => item.ticker !== ticker));
  };

  const updateInitialCash = (ticker: string, nextCash: number) => {
    setPositions((prev) =>
      prev.map((item) => {
        if (item.ticker !== ticker) {
          return item;
        }

        return {
          ...item,
          initialCash: nextCash > 0 ? nextCash : item.initialCash,
        };
      }),
    );
  };

  const suggestedNewBuyPrice = (() => {
    const ticker = newTicker.trim().toUpperCase();

    if (!ticker) {
      return null;
    }

    return quotes[ticker] ?? positions.find((item) => item.ticker === ticker)?.buyPrice ?? null;
  })();

  const rows = useMemo(() => {
    return positions.map((position) => {
      const sharesOwned = position.initialCash / position.buyPrice;
      const livePrice = quotes[position.ticker] ?? position.buyPrice;
      const currentValue = livePrice * sharesOwned;
      const profitLoss = currentValue - position.initialCash;
      const profitLossPercent = position.initialCash === 0 ? 0 : profitLoss / position.initialCash;

      return {
        ...position,
        sharesOwned,
        livePrice,
        currentValue,
        profitLoss,
        profitLossPercent,
      };
    });
  }, [positions, quotes]);

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

        <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-[1fr_2fr]">
          <article>
            <label htmlFor="cashPerPosition" className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Default Initial Cash (New Tickers)
            </label>
            <input
              id="cashPerPosition"
              type="number"
              min="1"
              step="100"
              value={cashPerPosition}
              onChange={(event) => setCashPerPosition(Number(event.target.value) || 0)}
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-cyan-200 focus:ring"
            />
            <p className="mt-2 text-xs text-slate-500">
              New rows use this value. Edit Initial Cash in the table to recalculate each ticker instantly.
            </p>
          </article>

          <form onSubmit={addPosition} className="grid gap-3 sm:grid-cols-[1.2fr_1fr_auto] sm:items-end">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Ticker
              <input
                value={newTicker}
                onChange={(event) => {
                  const nextTicker = event.target.value;
                  setNewTicker(nextTicker);
                  setIsBuyPriceManual(false);
                  if (!nextTicker.trim()) {
                    setNewBuyPrice("");
                    setLookupMessage(null);
                    setIsLookupLoading(false);
                  }
                }}
                placeholder="NVDA"
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm uppercase outline-none ring-cyan-200 focus:ring"
              />
            </label>

            <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Buy Price
              <input
                value={newBuyPrice || (isBuyPriceManual ? newBuyPrice : suggestedNewBuyPrice !== null ? String(suggestedNewBuyPrice) : "")}
                onChange={(event) => {
                  setNewBuyPrice(event.target.value);
                  setIsBuyPriceManual(true);
                }}
                type="number"
                min="0.01"
                step="0.01"
                placeholder="120.50"
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-cyan-200 focus:ring"
              />
              <span className="mt-2 block text-xs text-slate-500">
                {isLookupLoading
                  ? "Loading live quote..."
                  : lookupMessage ??
                    (suggestedNewBuyPrice !== null
                      ? `Current price: ${currency.format(suggestedNewBuyPrice)}`
                      : "Type a ticker and the current price will fill in.")}
              </span>
            </label>

            <button
              type="submit"
              className="h-10 rounded-lg bg-cyan-700 px-4 text-sm font-medium text-white transition hover:bg-cyan-800"
            >
              Add Ticker
            </button>
          </form>
        </section>

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
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.ticker} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-semibold tracking-wide">{row.ticker}</td>
                    <td className="px-4 py-3 text-right">
                      <input
                        type="number"
                        min="1"
                        step="100"
                        value={Number.isFinite(row.initialCash) ? row.initialCash : ""}
                        onChange={(event) => updateInitialCash(row.ticker, Number(event.target.value))}
                        className="w-28 rounded-md border border-slate-300 px-2 py-1 text-right text-sm outline-none ring-cyan-200 focus:ring"
                      />
                    </td>
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
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => removePosition(row.ticker)}
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                      >
                        Remove
                      </button>
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
                  <td className="px-4 py-3 text-right">-</td>
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
