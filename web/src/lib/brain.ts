export interface ExpertLayerEvent {
  seq: number
  row: number
  map: string
  hits: string
  resident: string
}

export interface ExpertMap {
  rows: number
  cols: number
  map: string
  hits: string
  seq: number
  events?: ExpertLayerEvent[]
}

function decodeHex(hex: string, bytes: number) {
  if (hex.length !== bytes * 2 || !/^[0-9a-f]*$/i.test(hex)) {
    throw new Error("专家遥测数据尺寸无效。")
  }
  const values = new Uint8Array(bytes)
  for (let i = 0; i < bytes; i++) values[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return values
}

/** 将单层增量合并进累计热度图；驻留层级来自事件发生时的真实缓存槽。 */
export function applyLayerEvent(snapshot: ExpertMap, event: ExpertLayerEvent): ExpertMap {
  const { rows, cols } = snapshot
  if (event.row < 0 || event.row >= rows) throw new Error("专家遥测层号无效。")
  const cells = rows * cols
  const values = decodeHex(snapshot.map, cells)
  const heat = decodeHex(event.map, cols)
  const resident = decodeHex(event.resident, Math.ceil(cells / 8))

  for (let cell = 0; cell < cells; cell++) {
    values[cell] &= 0x3f
    if (resident[cell >> 3] & (1 << (cell & 7))) values[cell] |= 0x40
  }
  const base = event.row * cols
  for (let expert = 0; expert < cols; expert++) {
    values[base + expert] = (values[base + expert] & 0xc0) | (heat[expert] & 0x3f)
  }

  return {
    ...snapshot,
    map: Array.from(values, value => value.toString(16).padStart(2, "0")).join(""),
    hits: event.hits,
    seq: event.seq,
    events: [],
  }
}
