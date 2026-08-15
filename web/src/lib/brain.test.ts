import { describe, expect, it } from "vitest"

import { applyLayerEvent, type ExpertMap } from "./brain"

describe("applyLayerEvent", () => {
  it("只更新当前层热度，并按真实槽位刷新 RAM 层级", () => {
    const snapshot: ExpertMap = {
      rows: 2,
      cols: 4,
      map: "0102030445464748",
      hits: "",
      seq: 3,
    }

    const next = applyLayerEvent(snapshot, {
      seq: 4,
      row: 1,
      map: "090a0b0c",
      hits: "05",
      resident: "84",
    })

    expect(next.map).toBe("01024304090a0b4c")
    expect(next.hits).toBe("05")
    expect(next.seq).toBe(4)
    expect(snapshot.map).toBe("0102030445464748")
  })

  it("拒绝尺寸错误的增量，避免把坏帧画进画布", () => {
    const snapshot: ExpertMap = { rows: 1, cols: 2, map: "0000", hits: "", seq: 0 }
    expect(() => applyLayerEvent(snapshot, {
      seq: 1,
      row: 0,
      map: "01",
      hits: "01",
      resident: "00",
    })).toThrow("专家遥测数据尺寸无效")
  })
})
