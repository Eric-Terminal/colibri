export interface ThroughputDisplay {
  value: string
  unit: "tok/s" | "s/token" | ""
}

const rateDecimals = (rate: number) =>
  rate >= 100 ? 1 : rate >= 1 ? 2 : rate >= 0.1 ? 3 : rate >= 0.01 ? 4 : 6

const latencyDecimals = (secondsPerToken: number) => secondsPerToken >= 100 ? 1 : 2

export function throughputDisplay(tokensPerSecond: number): ThroughputDisplay {
  if (!Number.isFinite(tokensPerSecond) || tokensPerSecond <= 0)
    return { value: "—", unit: "" }
  if (tokensPerSecond < 1) {
    const secondsPerToken = 1 / tokensPerSecond
    return {
      value: secondsPerToken.toFixed(latencyDecimals(secondsPerToken)),
      unit: "s/token",
    }
  }
  return {
    value: tokensPerSecond.toFixed(rateDecimals(tokensPerSecond)),
    unit: "tok/s",
  }
}

export function formatThroughput(tokensPerSecond: number): string {
  const display = throughputDisplay(tokensPerSecond)
  return display.unit ? `${display.value} ${display.unit}` : display.value
}

export function formatThroughputDetail(tokensPerSecond: number): string {
  const display = throughputDisplay(tokensPerSecond)
  if (!display.unit || tokensPerSecond >= 1) return formatThroughput(tokensPerSecond)
  return `${tokensPerSecond.toFixed(rateDecimals(tokensPerSecond))} tok/s · ${display.value} ${display.unit}`
}
