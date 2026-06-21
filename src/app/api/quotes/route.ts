import { NextResponse } from "next/server";

const PRICE_REGEX = /data-last-price="([0-9.]+)"/;
const TWELVE_DATA_API_BASE = "https://api.twelvedata.com/quote";

async function loadPrice(symbol: string): Promise<number | null> {
  const exchanges = ["NASDAQ", "NYSE"];

  for (const exchange of exchanges) {
    const quoteUrl = `https://www.google.com/finance/quote/${encodeURIComponent(symbol)}:${exchange}`;

    const response = await fetch(quoteUrl, {
      next: { revalidate: 15 },
    });

    if (!response.ok) {
      continue;
    }

    const html = await response.text();
    const match = PRICE_REGEX.exec(html);

    if (match?.[1]) {
      const parsed = Number(match[1]);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

async function loadPriceFromTwelveData(symbol: string, apiKey: string): Promise<number | null> {
  const url = `${TWELVE_DATA_API_BASE}?symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url, { next: { revalidate: 15 } });

  if (!response.ok) {
    return null;
  }

  const data: { close?: string; code?: number; status?: string } = await response.json();
  if (data.status === "error" || typeof data.close !== "string") {
    return null;
  }

  const parsed = Number(data.close);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbolsParam = searchParams.get("symbols") ?? "";

  const symbols = symbolsParam
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);

  if (!symbols.length) {
    return NextResponse.json({ error: "Missing symbols query parameter." }, { status: 400 });
  }

  try {
    const uniqueSymbols = [...new Set(symbols)];
    const apiKey = process.env.TWELVE_DATA_API_KEY;

    const quotePairs = await Promise.all(
      uniqueSymbols.map(async (symbol) => {
        let price: number | null = null;

        if (apiKey) {
          price = await loadPriceFromTwelveData(symbol, apiKey);
        }

        if (price === null) {
          price = await loadPrice(symbol);
        }

        return [symbol, price] as const;
      }),
    );

    const quotes = quotePairs.reduce<Record<string, number>>((acc, [symbol, price]) => {
      if (typeof price === "number") {
        acc[symbol] = price;
      }
      return acc;
    }, {});

    if (!Object.keys(quotes).length) {
      return NextResponse.json({ error: "Failed to load quotes." }, { status: 502 });
    }

    return NextResponse.json({
      quotes,
      updatedAt: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ error: "Unexpected quote service error." }, { status: 500 });
  }
}
