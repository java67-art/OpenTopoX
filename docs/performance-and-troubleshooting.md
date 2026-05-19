# 性能阈值与故障排查

本文档给应用开发者一个上线前的性能基线、排查路径和实时更新 API 使用示例。

## 推荐阈值

| 场景 | 建议阈值 | 说明 |
| --- | --- | --- |
| 首屏 500 节点 / 1x 边 | 1.5s 内完成首屏渲染 | 使用示例页和 `benchmark:topology` 记录本机基线 |
| 1000 节点 / 1x 边 | 自动开启性能模式前后都应可交互 | 边标签可降级关闭 |
| 3000 节点 / 3x 边 | 优先保证拖拽、缩放和 patch 不阻塞 | 建议关闭动画和边标签 |
| 10Hz 指标更新 | P95 patch 小于 16ms | 只更新节点/边 `data`，避免触发布局 |
| 1Hz 结构变更 | P95 patch 小于 50ms | 小批量增删用 light structure patch |
| 长任务 | 单次交互不应持续出现 50ms+ 长任务 | 浏览器基准会输出 long task 计数 |

阈值是默认建议，不是硬编码断言。业务侧应结合设备、浏览器、数据规模和页面复杂度设定自己的发布门槛。

## 基准命令

Node 核心路径：

```sh
npm run benchmark:topology
```

本仓库当前只内置 Node 核心路径基准。若接入方增加浏览器基准脚本，建议同时覆盖首屏渲染、增量 patch、视口缩放和长任务计数。

## Graph Store 设计

`TopologyGraphStore` 是实时链路的权威数据层，不直接操作 DOM。

职责：

- 保存当前 `nodes` 和 `edges`。
- 应用 `snapshot` 替换全量数据。
- 应用 `nodePatch`、`edgePatch` 和 `topologyPatch`。
- 用版本和序号避免旧消息覆盖新状态。
- 通过 `validateGraphData()` 过滤破坏性数据。
- 输出 `getData()` 给 `NewTopoGraph.setData()`。

推荐链路：

```js
const store = createTopologyGraphStore();
const scheduler = createTopologyUpdateScheduler({
  graph: topo,
  store,
  flushIntervalMs: 160,
});

scheduler.bindAdapter(adapter);
```

这样做的好处是：连接层、数据层、批处理层、渲染层各自独立，断线重连和乱序消息不会直接污染图实例。

## Patch API 示例

只更新指标和状态：

```js
graph.patchGraphData({
  nodePatches: [{
    id: "service-a",
    data: {
      status: "warn",
      metric: { label: "P95", value: "186 ms" },
    },
  }],
}, {
  preserveViewport: true,
  autoFit: false,
});
```

更新边指标：

```js
graph.patchGraphData({
  edgePatches: [{
    id: "service-a-db",
    data: {
      status: "critical",
      latency: "420 ms",
    },
  }],
});
```

小规模结构变更：

```js
graph.patchGraphData({
  addedNodes: [{
    id: "canary-a",
    type: "cardNode",
    data: {
      title: "Canary",
      status: "ok",
      metric: { label: "RPS", value: "120" },
    },
  }],
  addedEdges: [{
    id: "service-a-canary-a",
    source: "service-a",
    target: "canary-a",
    label: "shadow",
  }],
}, {
  preserveViewport: true,
  autoFit: false,
});
```

需要完整重排时再使用：

```js
await graph.setData({
  nodes,
  edges,
  clearStatus: true,
  preserveViewport: false,
  autoFit: true,
});
```

## 常见问题

### 高频更新后视口跳动

检查 `TopologyUpdateScheduler` 或 `patchGraphData()` 是否传入：

```js
{
  preserveViewport: true,
  autoFit: false,
  silentSelection: true,
}
```

### 指标更新导致布局重算

优先使用 `nodePatches` 和 `edgePatches`，不要为纯指标变化调用 `setData()`。

### 边标签太多导致卡顿

设置：

```js
new NewTopoGraph({
  config: {
    performanceEdgeLabelLimit: 80,
    autoPerformanceMode: true,
  },
});
```

大图下框架会自动关闭过量边标签。

### 消息乱序或旧数据覆盖新数据

确保后端输出稳定的：

- `version`
- `seq`
- `serverTime`
- `source`

`TopologyDataAdapter` 会根据 cursor 丢弃 stale 消息。

### 断线后恢复慢

检查：

- `reconnectDelayMs`
- `reconnectMaxDelayMs`
- `maxReconnectAttempts`
- 服务端是否支持按 cursor 补数据

恢复后建议服务端先发 `snapshot`，再继续发 patch。

### 自定义节点出现 XSS 风险

参考 [security-guidelines.md](./security-guidelines.md)，不要把未可信字段直接拼进 HTML。

## 发布前验收

推荐合并前至少保留最近一次结果：

- `npm run check`
- `npm run benchmark:topology`
- `npm_config_cache=.cache/npm npm pack --dry-run`

如项目后续补充浏览器或视觉回归脚本，其输出也应作为 PR 评论或发布记录保存。
