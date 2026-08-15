import { describe, expect, it } from "vitest"

import { formatThroughput, formatThroughputDetail, throughputDisplay } from "./throughput"

describe("吞吐量格式化", () => {
  it("低于每秒一个 token 时使用每 token 秒数", () => {
    expect(throughputDisplay(0.1012)).toEqual({ value: "9.88", unit: "s/token" })
    expect(formatThroughput(0.1012)).toBe("9.88 s/token")
    expect(formatThroughputDetail(0.1012)).toBe("0.101 tok/s · 9.88 s/token")
    expect(formatThroughputDetail(0.049)).toBe("0.0490 tok/s · 20.41 s/token")
  })

  it("生成较快时保留每秒 token 数", () => {
    expect(throughputDisplay(2.345)).toEqual({ value: "2.35", unit: "tok/s" })
    expect(formatThroughputDetail(2.345)).toBe("2.35 tok/s")
    expect(formatThroughput(660.34)).toBe("660.3 tok/s")
  })

  it("缺失的测量值不会显示为无穷大", () => {
    expect(formatThroughput(0)).toBe("—")
    expect(formatThroughput(Number.NaN)).toBe("—")
  })
})
