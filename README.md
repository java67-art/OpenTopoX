# OpenTopoX

OpenTopoX is a standalone observability topology framework built with native
DOM, SVG, and JavaScript modules. It focuses on rendering, layout, interaction,
realtime updates, and data adapters for service maps, infrastructure graphs,
dependency graphs, and other topology views.

OpenTopoX does not bundle third-party graph rendering, layout, or application
framework runtimes. The npm package name is `opentopox`.

OpenTopoX 是一个独立的可观测拓扑图框架，基于浏览器原生 DOM、SVG 和
JavaScript 模块实现。它面向服务拓扑、基础设施拓扑、依赖关系图等场景，提供
渲染、布局、交互、实时更新和数据适配能力。

OpenTopoX 不内置第三方图渲染、布局或应用框架运行时。npm 包名为
`opentopox`。

## Features / 特性

- DOM/SVG topology rendering with Bezier edges, labels, directional markers,
  minimap, themes, and large-graph performance controls.
- Built-in layouts: `dot`, `fdp`, `layer`, `xyFlow`, `radial`, `grid`,
  `entityFlow`, and `preset`.
- Runtime graph API for data updates, viewport control, selection, focus,
  filtering, and incremental patch application.
- Agent Bridge context extraction for visible views, selected nodes/edges,
  neighborhood expansion, redaction, and clipboard handoff.
- Agentic Topology Observability helpers for lightweight Agent activity
  events, realtime topology patches, and readonly AI Chat topology blocks.
- Realtime topology protocol helpers, WebSocket/SSE/polling/manual adapters,
  graph store, batching scheduler, and stale-message guards.
- Optional UI helpers for toolbar controls, legends, context menus, tooltips,
  detail drawers, and shape registration.
- TypeScript declarations for the public ESM entry.

- 使用 DOM/SVG 渲染拓扑节点、Bezier 连线、标签、方向箭头、小地图、主题和大图性能模式。
- 内置 `dot`、`fdp`、`layer`、`xyFlow`、`radial`、`grid`、`entityFlow`、`preset` 布局。
- 提供运行时图 API，支持数据更新、视口控制、选择、聚焦、过滤和增量 patch。
- 提供 Agent Bridge 上下文提取能力，支持可见视图、选中节点/边、邻居扩展、脱敏和剪切板传递。
- 提供 Agentic Topology Observability 能力，支持轻量 Agent 活动事件、实时拓扑 patch 和 AI Chat 只读拓扑块。
- 提供实时拓扑协议工具、WebSocket/SSE/polling/manual 适配器、Graph Store、批处理调度器和旧消息防护。
- 提供可选 UI 组件，包括工具栏、图例、右键菜单、Tooltip、详情抽屉和 shape 注册。
- 提供公开 ESM 入口的 TypeScript 声明。

## Repository Layout / 仓库结构

```txt
src/framework/               Framework source / 框架源码
docs/                        Public integration, security, and runtime docs / 文档
examples/                    Browser examples / 浏览器示例
tests/unit/                  Node.js unit tests / 单元测试
benchmarks/                  Local performance benchmarks / 性能基准
scripts/build-package.mjs    Dist package builder / 发布包构建脚本
```

Generated artifacts, local captures, screenshots, credentials, and private
research notes should not be committed to this repository.

不要提交生成物、本地截图、访问凭据、私有链接、抓包文件或私有调研记录。

## Publication Boundary / 发布边界

OpenTopoX is published from this directory only. Sibling workspaces or extraction
projects, such as local demos, captures, or migration notes, are not part of the
OpenTopoX repository or npm package.

OpenTopoX 只从当前目录发布。旁路工作区、完整 demo、截图产物、迁移记录或提取过程目录
不属于 OpenTopoX 独立仓库和 npm 包。

## Install / 安装

When published as a package:

```sh
npm install opentopox
```

发布到 npm 后可使用：

```sh
npm install opentopox
```

For local development from this repository:

```sh
npm install
npm run check
```

本地开发：

```sh
npm install
npm run check
```

## Usage / 使用

```js
import { NewTopoGraph } from "opentopox";
import "opentopox/style.css";

const topo = new NewTopoGraph({
  container: document.querySelector("#graph"),
  config: {
    theme: "neutral",
    nodeDraggable: true,
    minimap: true,
    grid: true,
  },
});

const graph = topo.getGraph();

graph.setLayout({
  topoType: "dot",
  rankDir: "LR",
});

await graph.setData({
  nodes: [
    {
      id: "api",
      type: "cardLayerNode",
      data: {
        title: "API Service",
        domain: "service",
        status: "ok",
      },
    },
    {
      id: "db",
      type: "cardLayerNode",
      data: {
        title: "Database",
        domain: "database",
        status: "warn",
      },
    },
  ],
  edges: [
    {
      id: "api-db",
      source: "api",
      target: "db",
      label: "queries",
      data: {
        latency: "28ms",
      },
    },
  ],
});
```

Direct source-path usage also works for static examples:

```html
<link rel="stylesheet" href="./src/framework/topology.css" />
<script type="module">
  import { NewTopoGraph } from "./src/framework/index.js";
</script>
```

静态示例或源码方式接入时，也可以直接使用源码路径。

## Public API Surface / 公共 API 口径

OpenTopoX keeps one recommended API path for each integration task:

- Use `NewTopoGraph` for the main DOM/SVG topology renderer.
- Use `createTopologyGraph()` and preset graph classes for common topology
  entry points.
- Use `registerNodeShape()` and `registerEdgeShape()` for custom rendering.
- Use `registerTopologyShape(kind, type, shape)` only as a compatibility helper
  around the node/edge shape registry.
- Use realtime protocol, adapter, store, and scheduler helpers together when
  consuming streaming topology updates.

OpenTopoX 为每类接入任务保留一个推荐路径：

- 主渲染器使用 `NewTopoGraph`。
- 常见拓扑入口使用 `createTopologyGraph()` 和预设图类。
- 自定义渲染优先使用 `registerNodeShape()` 和 `registerEdgeShape()`。
- `registerTopologyShape(kind, type, shape)` 仅作为兼容便捷入口，本质上转发到节点/边 shape 注册表。
- 实时拓扑更新使用 protocol、adapter、store 和 scheduler 组合。

Common imports:

```js
import {
  NewTopoGraph,
  StandardTopologyGraph,
  LayeredTopologyGraph,
  SpatialTopologyGraph,
  FlowTopologyGraph,
  createTopologyGraph,
  selectTopologyGraph,
  registerNodeShape,
  registerEdgeShape,
  TopoLayout,
  registerLayoutExecutor,
  FlowToolbar,
  FlowLegend,
  ContextMenu,
  Tooltip,
  TopologyDetailDrawer,
  FlowControls,
  Toolbar,
  buildCloudResourceTopology,
  buildCloudResourceTopologyFromQuery,
  buildGlobalEntityTopology,
  createCloudResourceQueryProvider,
  createResourceBatchSelection,
  normalizeCloudResourceQueryResult,
  paginateResources,
  createEntityTopologyView,
  buildTopologyDetailModel,
  filterTopologyData,
  getDataByNodeGroup,
  processParallelEdges,
  mergeParallelEdges,
  createTopologyContext,
  formatTopologyContextAsMarkdown,
  createRealtimeTopologySnapshot,
  createRealtimeNodePatch,
  createRealtimeEdgePatch,
  createRealtimeTopologyPatch,
  validateRealtimeTopologyMessage,
  shouldAcceptRealtimeTopologyMessage,
  createTopologyDataAdapter,
  TOPOLOGY_DATA_TRANSPORTS,
  createTopologyGraphStore,
  createTopologyUpdateScheduler,
  register,
} from "opentopox";
```

Compatibility import for older preset-style integrations:

```js
import { registerTopologyShape } from "opentopox";

registerTopologyShape("node", "service-card", {
  render(node) {
    return `<strong>${node.data?.title || node.id}</strong>`;
  },
});
```

The full export list is defined by `src/framework/index.js` and
`src/framework/index.d.ts`.

完整导出清单以 `src/framework/index.js` 和 `src/framework/index.d.ts` 为准。

## Build / 构建

```sh
npm run build
```

The build command writes a publishable `dist/` directory with framework files,
public docs, license, notice files, and a dist-level package manifest.

构建命令会生成可发布的 `dist/` 目录，包含框架文件、公开文档、许可证、声明文件和
`dist/package.json`。

## Test / 测试

```sh
npm run check
```

This runs syntax checks, unit tests, and a package build.

该命令会执行语法检查、单元测试和发布包构建。

Run only unit tests / 仅运行单元测试：

```sh
npm run test:unit
```

Run the topology benchmark / 运行拓扑性能基准：

```sh
npm run benchmark:topology
```

Benchmark sizes can be adjusted locally / 可在本地调整基准规模：

```sh
TOPOLOGY_BENCH_SIZES=500,1000 TOPOLOGY_BENCH_EDGE_MULTIPLIERS=1 npm run benchmark:topology
```

## Documentation / 文档

- [Usage Guide / 使用文档](./USAGE.md)
- [Developer Guide / 开发者指南](./DEVELOPER_GUIDE.md)
- [Security Guidelines / 安全接入约束](./docs/security-guidelines.md)
- [Realtime Protocol / 实时协议](./docs/realtime-topology-protocol.md)
- [Realtime Runtime / 实时运行时链路](./docs/realtime-topology-runtime.md)
- [Performance And Troubleshooting / 性能与故障排查](./docs/performance-and-troubleshooting.md)
- [Topology Data Adapter / 实时接入适配器](./docs/topology-data-adapter.md)

## Community / 社区

- [Contributing](./CONTRIBUTING.md)
- [Code of Conduct](./CODE_OF_CONDUCT.md)
- [Security Policy](./SECURITY.md)
- [Maintainers](./MAINTAINERS.md)

## Local Example / 本地示例

```sh
npm run serve
```

Then open / 然后打开：

```txt
http://127.0.0.1:5177/examples/minimal-realtime/
```

Example entry points / 示例入口：

- `examples/basic-usage/`
- `examples/cloud-resource-topology/`
- `examples/preset-entry/`
- `examples/minimal-realtime/`

## License / 许可证

MIT. See [LICENSE](./LICENSE) and [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

MIT 许可证。详见 [LICENSE](./LICENSE) 和
[THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。
