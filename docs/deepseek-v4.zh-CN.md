# DeepSeek V4 目标引擎（colibri CPU）

[English](deepseek-v4.md)

这是 V4 拆分后第一个 PR 中的 DeepSeek V4 Flash 目标引擎。DSpark 推测解码
不属于本 PR，将放在后续连续（stacked）PR 中。

## 当前范围

- 生产代码位于 `c/deepseek_v4.c`，实验性公共 engine/session API 位于
  `c/deepseek_v4.h`。
- 官方分片 safetensors checkpoint 通过共享 `st.h` 加载。
- 标准 MXFP4 矩阵乘法使用共享 `quant.h`。
- 统一入口 `c/coli` 会把 `run`、`chat`、`serve`、`web` 路由到 V4，
  服务模式会跨请求保留引擎和缓存。
- `--no-dspark` 只是兼容性空操作。本 PR 没有 DSpark 模型、内存层级或推测循环。
- 支持 x86-64、aarch64 Linux 和 Windows/MSYS2。

销毁 engine 前必须先销毁全部 session。

## 共享迁移状态

| checkpoint 路径 | 当前实现 | 后续工作 |
|---|---|---|
| safetensors 索引与区间读取 | 共享 `st.h` | 已完成 |
| fmt7 标准 MXFP4 matmul | 共享 `quant.h` | 已完成 |
| fmt7 常驻 rows16 专家缓存 | 临时 V4 私有布局 | **TODO：**上游提供常驻 rows16 API 后迁移 |
| fmt8 E4M3 + UE8M0 128x128 scales | 共享 `st_read_scale_f32` + `quant.h` `matmul_fp8` | 已完成 |

目前只剩 rows16 常驻缓存布局仍为 V4 私有实现。源码中的
`TODO(upstream-fmt7-rows16)` 明确标出了删除该专用布局前仍需补齐的共享 API。

## 内存策略

典型 checkpoint 有 43 层 transformer、hidden size 4096，每个稀疏层有
256 个路由专家，top-k 为 6。稠密权重大约占 6.27 GiB，常驻 BF16 输出
head 大约占 1.06 GiB；路由专家权重按 RAM 预算流式读取和缓存。

规划器先预留工作区与最小专家工作集，再在预算允许时启用 dense/head 常驻
并扩大专家缓存。Dense 常驻与 DSpark 相互独立，在当前 target-only 版本和
旧调用方传入 `--no-dspark` 时都能正常工作。

`--ram GiB` 是规划预算，不是操作系统硬上限；不传入时按当前可用内存估算。

## 下载

```bash
hf download deepseek-ai/DeepSeek-V4-Flash-0731 \
  --local-dir /path/to/DeepSeek-V4-Flash
```

即使下载工具报告成功，个别 shard 也可能被截断。如果 `st.h` 以越界错误拒绝
某个 shard，请先把所有本地 shard 的文件大小与 Hugging Face 仓库逐一核对，
不要直接判断为引擎故障。

## 构建与使用

```bash
cd c
make deepseek-v4
python ./coli run --model /path/to/DeepSeek-V4-Flash --ram 32 \
  "What is the capital of France?"
python ./coli chat --model /path/to/DeepSeek-V4-Flash --ram 32
python ./coli serve --model /path/to/DeepSeek-V4-Flash --ram 32
python ./coli web --model /path/to/DeepSeek-V4-Flash --ram 32
```

### 低内存 SSD 流式模式

内存不足 16 GB、但模型位于高速 SSD 时，可以显式启用单槽流式模式：

```bash
python ./coli run --model /path/to/DeepSeek-V4-Flash \
  --low-memory --ram 3 --ctx 256 --ngen 8 \
  "请只回答两个字：你好"
```

该模式仍然计算模型路由选中的全部 top-k 专家，不改变模型精度或路由语义。
区别是所有层共用一个专家槽位，并在当前专家计算完成后同步从 SSD 读取下一
个专家；约 1 GiB 的 BF16 输出头也按需从模型盘读取。这样会降低内存占用，
但同时失去并行预读、专家缓存命中和驻留输出头，生成速度会明显下降。

Prompt Prefill 使用最多 32 token 的分块工作区，而不是按照整个 `--ctx` 预留
两块激活数组。可以通过 `COLI_V4_PREFILL_CHUNK=25..64` 调整分块；较大的分块
可能提高 Prefill 吞吐，但会增加内存。长期压缩注意力状态仍保留在内存中。

低内存规划不会接受高于操作系统当前可用内存的 `--ram` 预算，并会保留系统
余量，避免主动依赖压缩内存或 Swap。默认规划和默认并行加载路径保持不变。

M1 8 GB、167 GB Flash 检查点的真实测试中，Chat 模板首 token 用时约 82 秒，
`/usr/bin/time -l` 报告最大 RSS 约 251 MiB、`swaps` 为 0。该数字只描述一次
本机测量，不是其他硬件的性能承诺。

V4 chat 使用模型原生标记。原生服务当前只支持 greedy 和一个活动 KV slot，
tools 与 grammar 会被拒绝。请求会重新 prefill，但进程、权重、dense、
head 与专家缓存会保持热状态。

## 验证

Tiny safetensors fixture 在本地生成、已忽略且不提交：

```bash
python -m pip install -r tools/requirements-deepseek-v4-tiny.txt
make deepseek-v4-tiny-check
```

测试覆盖加载、teacher forcing、greedy decode、长/重复 session、
`--no-dspark` 兼容，以及持久化 `SUBMIT`/`DATA`/`DONE` 协议中的两次请求。

真实 checkpoint 可运行：

```bash
make deepseek-v4-oracle MODEL=/path/to/DeepSeek-V4-Flash \
  MEMORY_GB=32 ORACLE_TEACHER_FORCING=32 ORACLE_GREEDY=20
```

这个 oracle 只验证目标引擎。DSpark 开关速度、接受率和 token 一致性证据
属于后续 stacked DSpark PR。

## 后续工作

- 增加非 greedy 采样与更多服务 slot。
- 上游提供常驻 rows16 API 后，删除剩余的 V4 私有 rows16 缓存布局。
- stacked PR 恢复 DSpark 时必须保持目标 token 不变，并提供开关性能与接受率数据。
