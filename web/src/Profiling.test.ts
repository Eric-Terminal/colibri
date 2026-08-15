import { describe, expect, it } from "vitest"

import { deriveProfileTurn } from "./Profiling"

describe("性能阶段分解", () => {
  it("只把未采集的剩余时间归入其他", () => {
    const turn = deriveProfileTurn({
      wall_s: 10,
      prompt_tokens: 4,
      completion_tokens: 5,
      expert_disk_s: 1,
      expert_wait_s: 1,
      dense_load_s: 2,
      expert_matmul_s: 1.5,
      shared_expert_s: 1,
      router_s: 0.25,
      attention_s: 1.25,
      block_overhead_s: 0.5,
      lm_head_s: 0.5,
      forwards: 5,
    })

    expect(turn.other_s).toBe(2)
    expect(turn.toks).toBe(0.5)
  })
})
