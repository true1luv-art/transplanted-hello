import axios from 'axios'
import { HIVE_ENGINE_CONFIG } from '@/lib/config/api'

const HE_HISTORY = HIVE_ENGINE_CONFIG.historyUrl

export type SparklineMap = Record<string, number[]>

interface HistoryCandle {
  openPrice?: string | number
  closePrice?: string | number
  highestPrice?: string | number
  lowestPrice?: string | number
  timestamp?: number
}

const MAX_POINTS = 30

function downsample(prices: number[], target = MAX_POINTS): number[] {
  if (prices.length <= target) return prices
  const step = prices.length / target
  const out: number[] = []
  for (let i = 0; i < target; i++) {
    out.push(prices[Math.floor(i * step)])
  }
  // always include last point
  out[out.length - 1] = prices[prices.length - 1]
  return out
}

export async function fetchTokenSparklines(symbols: string[]): Promise<SparklineMap> {
  if (!symbols?.length) return {}
  const end = Math.floor(Date.now() / 1000)
  const start = end - 86400 // 24h window

  const results = await Promise.all(
    symbols.map(async (sym) => {
      try {
        const { data } = await axios.get<HistoryCandle[]>(
          `${HE_HISTORY}/marketHistory?symbol=${encodeURIComponent(sym)}&timestampStart=${start}&timestampEnd=${end}`,
          { timeout: 10_000 },
        )
        if (!Array.isArray(data) || data.length === 0) return [sym, []] as const
        // Hive Engine returns newest first; reverse for chronological.
        const sorted = [...data].reverse()
        const closes = sorted
          .map((c) => Number(c.closePrice ?? c.openPrice ?? 0))
          .filter((n) => Number.isFinite(n) && n > 0)
        return [sym, downsample(closes)] as const
      } catch {
        return [sym, []] as const
      }
    }),
  )

  return Object.fromEntries(results)
}
