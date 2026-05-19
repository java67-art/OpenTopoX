export type TopologyStatus = "ok" | "warn" | "critical" | (string & {});
export type TopologyDirection = "upstream" | "downstream" | "both";
export type RealtimeTopologyMessageType = "snapshot" | "nodePatch" | "edgePatch" | "topologyPatch";
export type TopologyDataTransport = "manual" | "websocket" | "sse" | "polling";
export type TopologyConnectionStatus = "idle" | "connecting" | "live" | "reconnecting" | "stale" | "offline";

export interface TopologyPoint {
  x: number;
  y: number;
}

export interface TopologyViewport extends TopologyPoint {
  zoom: number;
}

export interface TopologyMetric {
  label?: string;
  value?: string | number;
  [key: string]: unknown;
}

export interface TopologyNodeData {
  title?: string;
  label?: string;
  name?: string;
  subTitle?: string;
  summary?: string;
  domain?: string;
  group?: string;
  icon?: string;
  color?: string;
  status?: TopologyStatus;
  metric?: TopologyMetric;
  tags?: string[];
  size?: { width?: number; height?: number } | [number, number];
  isParent?: boolean;
  action?: Record<string, unknown>;
  descriptions?: Array<string | { label?: string; name?: string; value?: string | number }>;
  datasets?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface TopologyNode {
  id: string;
  type?: string;
  data?: TopologyNodeData;
  position?: TopologyPoint;
  parentId?: string;
  extent?: "parent" | string;
  expandParent?: boolean;
  draggable?: boolean;
  style?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface TopologyEdgeData {
  status?: TopologyStatus;
  latency?: string | number;
  traffic?: string | number;
  edgeType?: string;
  shape?: string;
  parallelTotal?: number;
  parallelOffset?: number;
  [key: string]: unknown;
}

export interface TopologyEdge {
  id: string;
  source: string;
  target: string;
  type?: string;
  label?: string;
  markerEnd?: string;
  data?: TopologyEdgeData;
  style?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface TopologyGraphData {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
}

export interface TopologyPatchItem<TData extends Record<string, unknown> = Record<string, unknown>> {
  id: string;
  data?: Partial<TData>;
  patch?: Record<string, unknown>;
  position?: TopologyPoint;
  style?: Record<string, unknown>;
  replace?: boolean;
  removeFields?: string[];
  [key: string]: unknown;
}

export interface TopologyGraphPatch {
  nodePatches?: Array<TopologyPatchItem<TopologyNodeData>> | Record<string, Partial<TopologyPatchItem<TopologyNodeData>>> | Map<string, Partial<TopologyPatchItem<TopologyNodeData>>>;
  edgePatches?: Array<TopologyPatchItem<TopologyEdgeData>> | Record<string, Partial<TopologyPatchItem<TopologyEdgeData>>> | Map<string, Partial<TopologyPatchItem<TopologyEdgeData>>>;
  addedNodes?: TopologyNode[];
  addNodes?: TopologyNode[];
  updatedNodes?: Array<Partial<TopologyNode> & { id: string }>;
  updateNodes?: Array<Partial<TopologyNode> & { id: string }>;
  removedNodeIds?: string[];
  removeNodeIds?: string[];
  addedEdges?: TopologyEdge[];
  addEdges?: TopologyEdge[];
  updatedEdges?: Array<Partial<TopologyEdge> & { id: string }>;
  updateEdges?: Array<Partial<TopologyEdge> & { id: string }>;
  removedEdgeIds?: string[];
  removeEdgeIds?: string[];
  options?: Partial<SetDataOptions> & Record<string, unknown>;
  [key: string]: unknown;
}

export interface SetDataOptions {
  nodes?: TopologyNode[];
  edges?: TopologyEdge[];
  centerNodeId?: string;
  clearStatus?: boolean;
  disableAnimate?: boolean;
  preserveOrigin?: boolean;
  preserveViewport?: boolean;
  autoFit?: boolean;
  silentSelection?: boolean;
}

export interface LayoutOptions {
  topoType?: "dot" | "fdp" | "layer" | "xyFlow" | "radial" | "grid" | "preset" | "entityFlow" | "worker" | "workerDot" | "workerFdp" | string;
  rankDir?: "LR" | "TB" | string;
  rankSep?: number;
  nodeSep?: number;
  clusterSpacing?: number;
  layerSpacing?: number;
  autoWorker?: boolean;
  useWorker?: boolean;
  workerNodeLimit?: number;
  workerTotalElementLimit?: number;
  workerTimeoutMs?: number;
  workerFallback?: boolean;
  [key: string]: unknown;
}

export interface RenderStats {
  nodes: number;
  edges: number;
  durationMs?: number;
  patchDurationMs?: number;
  performanceMode?: boolean;
  layout?: string;
  layoutVersion?: number;
  edgeLabelsVisible?: boolean;
  stale?: boolean;
  [key: string]: unknown;
}

export interface GraphApi {
  getData(): TopologyGraphData;
  getGraphData(): TopologyGraphData;
  getNodes(): TopologyNode[];
  getEdges(): TopologyEdge[];
  setData(data?: SetDataOptions): Promise<unknown>;
  setGroupData(data?: Record<string, unknown>): Promise<unknown>;
  updateGraphData(nodes?: TopologyNode[], edges?: TopologyEdge[], options?: Record<string, unknown>): Promise<unknown>;
  showOriginData(options?: Record<string, unknown>): Promise<unknown>;
  handleFocusNode(id: string, options?: { degree?: number; direction?: TopologyDirection; disableAnimate?: boolean }): Promise<unknown>;
  setLayout(options?: LayoutOptions, nodeType?: string): NewTopoGraph;
  setAnimateMode(enabled: boolean): void;
  setPerformanceMode(enabled: boolean): void;
  setEdgeLabelsVisible(enabled: boolean): void;
  areEdgeLabelsVisible(): boolean;
  setNodeDraggable(enabled: boolean): void;
  setHoverHighlight(enabled: boolean, options?: { degree?: number }): void;
  setMinimapVisible(enabled: boolean): void;
  setGridVisible(enabled: boolean): void;
  setDebugPanelVisible(enabled: boolean): void;
  isDebugPanelVisible(): boolean;
  updateDebugMetrics(metrics?: Record<string, unknown>): Record<string, unknown>;
  setTheme(theme: string): void;
  render(): void;
  fitView(options?: { padding?: number; nodes?: TopologyNode[] }): void;
  fitCenter(): void;
  zoomTo(zoom: number): void;
  focusNode(id: string): void;
  selectNode(id: string, options?: { emit?: boolean }): TopologyNode | null;
  updateNode(id: string, patch: Partial<TopologyNode> | ((node: TopologyNode) => Partial<TopologyNode> | null | undefined)): TopologyNode | null;
  updateNodeData(id: string, patch: Partial<TopologyNodeData>): TopologyNode | null;
  updateEdge(id: string, patch: Partial<TopologyEdge> | ((edge: TopologyEdge) => Partial<TopologyEdge> | null | undefined)): TopologyEdge | null;
  updateEdgeData(id: string, patch: Partial<TopologyEdgeData>): TopologyEdge | null;
  patchGraphData(patch?: TopologyGraphPatch, options?: Partial<SetDataOptions>): unknown;
  getInternalNode(id: string): (TopologyNode & { measured?: { width: number; height: number } }) | null;
  getSelected(): { type: "node" | "edge"; id: string } | null;
  getViewport(): TopologyViewport;
  setViewport(viewport?: Partial<TopologyViewport>): void;
  getRenderStats(): RenderStats;
  getContainer(): HTMLElement;
  getRootElement(): HTMLElement;
  [key: string]: unknown;
}

export interface NewTopoGraphOptions {
  container: HTMLElement;
  config?: LayoutOptions & {
    type?: string;
    graphType?: string;
    theme?: string;
    nodeDraggable?: boolean;
    hoverHighlight?: boolean;
    hoverHighlightDegree?: number;
    minimap?: boolean;
    grid?: boolean;
    debugPanel?: boolean;
    autoPerformanceMode?: boolean;
    performanceNodeLimit?: number;
    performanceTotalElementLimit?: number;
    validateData?: boolean;
    [key: string]: unknown;
  };
  style?: Partial<CSSStyleDeclaration> | Record<string, string | number>;
  className?: string;
  onLoad?: () => void;
  handleNodeClick?: (node: TopologyNode) => void;
  handleEdgeClick?: (edge: TopologyEdge) => void;
  handleCloseInfo?: () => void;
  renderAddNodeModal?: (context: { edge: TopologyEdge; graph: GraphApi }) => Promise<TopologyNode | false | undefined> | TopologyNode | false | undefined;
  onDeleteNode?: (node: TopologyNode, context: { graph: GraphApi }) => void;
}

export declare class NewTopoGraph {
  constructor(options: NewTopoGraphOptions);
  getGraph(): GraphApi;
  getData(): TopologyGraphData;
  getNodes(): TopologyNode[];
  getEdges(): TopologyEdge[];
  setLayout(options?: LayoutOptions, nodeType?: string): this;
  setData(data?: SetDataOptions): Promise<unknown>;
  setGroupData(data?: Record<string, unknown>): Promise<unknown>;
  destroy(): void;
}

export declare class CopilotTopoGraph extends NewTopoGraph {}
export declare class AgentLoopTopoGraph extends NewTopoGraph {}

export declare class TopoLayout {
  constructor(options?: { options?: LayoutOptions });
  options: LayoutOptions;
  execute(data?: { nodes?: TopologyNode[]; edges?: TopologyEdge[]; innerFunc?: Record<string, unknown>; clearStatus?: boolean }): Promise<unknown>;
  executeSync(data?: { nodes?: TopologyNode[]; edges?: TopologyEdge[]; innerFunc?: Record<string, unknown>; clearStatus?: boolean }): unknown;
  groupLayout(data?: Record<string, unknown>): unknown;
  cancelWorkerLayout(reason?: string): boolean;
}

export interface RealtimeTopologyMessage<TPayload = Record<string, unknown>> {
  protocol?: string;
  type: RealtimeTopologyMessageType;
  version: string | number;
  seq: number;
  serverTime: string;
  source: string;
  traceId?: string;
  payload: TPayload;
  meta?: Record<string, unknown>;
}

export interface TopologyGraphStoreSnapshot {
  version: string | number;
  currentGraphVersion: string | number;
  snapshotVersion: string | number;
  selectedId: string;
  viewport: TopologyViewport | null;
  connectionStatus: TopologyConnectionStatus;
  nodeCount: number;
  edgeCount: number;
  metrics: Record<string, number>;
  lastErrors: string[];
  lastWarnings: string[];
  [key: string]: unknown;
}

export declare class TopologyGraphStore {
  constructor(options?: { nodes?: TopologyNode[]; edges?: TopologyEdge[]; version?: string | number; selectedId?: string; viewport?: TopologyViewport | null; connectionStatus?: TopologyConnectionStatus });
  subscribe(listener: (event: Record<string, unknown>) => void): () => void;
  subscribe(type: string, listener: (event: Record<string, unknown>) => void): () => void;
  bindAdapter(adapter: TopologyDataAdapter): () => void;
  applyMessage(message: RealtimeTopologyMessage | string, context?: Record<string, unknown>): unknown;
  replace(data?: TopologyGraphData & { version?: string | number; meta?: Record<string, unknown> }, options?: Record<string, unknown>): unknown;
  getData(): TopologyGraphData;
  getNodes(): TopologyNode[];
  getEdges(): TopologyEdge[];
  getSnapshot(): TopologyGraphStoreSnapshot;
}

export interface TopologyDataAdapterStatus {
  status: TopologyConnectionStatus;
  transport: TopologyDataTransport;
  connected: boolean;
  messageCount: number;
  droppedMessages: number;
  messageLag: number | null;
  messageRate: number;
  [key: string]: unknown;
}

export declare class TopologyDataAdapter {
  constructor(options?: Record<string, unknown>);
  connect(): Promise<this>;
  disconnect(options?: { status?: TopologyConnectionStatus }): this;
  reconnect(): Promise<this>;
  subscribe(listener: (event: Record<string, unknown>) => void): () => void;
  subscribe(type: string, listener: (event: Record<string, unknown>) => void): () => void;
  ingest(raw: RealtimeTopologyMessage | string, context?: Record<string, unknown>): unknown;
  getStatus(): TopologyDataAdapterStatus;
}

export declare class TopologyUpdateScheduler {
  constructor(options?: { graph?: NewTopoGraph | GraphApi | null; store?: TopologyGraphStore | null; flushIntervalMs?: number; maxQueueSize?: number; defaultSetDataOptions?: Partial<SetDataOptions>; [key: string]: unknown });
  subscribe(listener: (event: Record<string, unknown>) => void): () => void;
  subscribe(type: string, listener: (event: Record<string, unknown>) => void): () => void;
  bindAdapter(adapter: TopologyDataAdapter): () => void;
  enqueueMessage(message: RealtimeTopologyMessage, meta?: Record<string, unknown>): Record<string, unknown>;
  enqueueGraphPatch(patch: TopologyGraphPatch, meta?: Record<string, unknown>): Record<string, unknown>;
  flush(): Promise<Record<string, unknown>>;
  getMetrics(): Record<string, unknown>;
  destroy(): void;
}

export declare const REALTIME_TOPOLOGY_PROTOCOL: string;
export declare const REALTIME_TOPOLOGY_MESSAGE_TYPES: Record<string, RealtimeTopologyMessageType>;
export declare const REALTIME_TOPOLOGY_PATCH_OPERATIONS: Record<string, string>;
export declare const TOPOLOGY_DATA_TRANSPORTS: Record<string, TopologyDataTransport>;
export declare const TOPOLOGY_DATA_ADAPTER_STATUS: Record<string, TopologyConnectionStatus>;
export declare const TOPOLOGY_DATA_ADAPTER_EVENTS: Record<string, string>;
export declare const TOPOLOGY_GRAPH_STORE_EVENTS: Record<string, string>;
export declare const TOPOLOGY_GRAPH_STORE_STATUS: Record<string, TopologyConnectionStatus>;
export declare const TOPOLOGY_UPDATE_SCHEDULER_EVENTS: Record<string, string>;

export declare function createTopologyDataAdapter(options?: Record<string, unknown>): TopologyDataAdapter;
export declare function createTopologyGraphStore(options?: ConstructorParameters<typeof TopologyGraphStore>[0]): TopologyGraphStore;
export declare function createTopologyUpdateScheduler(options?: ConstructorParameters<typeof TopologyUpdateScheduler>[0]): TopologyUpdateScheduler;
export declare function createRealtimeTopologyMessage(options?: Partial<RealtimeTopologyMessage>): RealtimeTopologyMessage;
export declare function createRealtimeTopologySnapshot(options?: { nodes?: TopologyNode[]; edges?: TopologyEdge[]; payload?: Record<string, unknown>; [key: string]: unknown }): RealtimeTopologyMessage;
export declare function createRealtimeNodePatch(options?: { patches?: Array<TopologyPatchItem<TopologyNodeData>>; payload?: Record<string, unknown>; [key: string]: unknown }): RealtimeTopologyMessage;
export declare function createRealtimeEdgePatch(options?: { patches?: Array<TopologyPatchItem<TopologyEdgeData>>; payload?: Record<string, unknown>; [key: string]: unknown }): RealtimeTopologyMessage;
export declare function createRealtimeTopologyPatch(options?: Partial<TopologyGraphPatch> & Record<string, unknown>): RealtimeTopologyMessage;
export declare function normalizeRealtimeTopologyMessage(input: RealtimeTopologyMessage | string): RealtimeTopologyMessage;
export declare function validateRealtimeTopologyMessage(message: RealtimeTopologyMessage | string, options?: Record<string, unknown>): { valid: boolean; errors: string[]; warnings: string[]; message: RealtimeTopologyMessage };
export declare function shouldAcceptRealtimeTopologyMessage(message: RealtimeTopologyMessage | string, cursor?: Record<string, unknown>, options?: Record<string, unknown>): { accept: boolean; reason?: string; validation?: Record<string, unknown>; cursor?: Record<string, unknown> };
export declare function validateGraphData(nodes?: TopologyNode[], edges?: TopologyEdge[], options?: Record<string, unknown>): { valid: boolean; hasWarnings: boolean; errors: string[]; warnings: string[]; nodes: TopologyNode[]; edges: TopologyEdge[]; [key: string]: unknown };

export declare function register(name: string, value?: unknown): () => void;
export declare function registerNodeShape(type: string, shape: unknown): () => void;
export declare function registerEdgeShape(type: string, shape: unknown): () => void;
export declare function getNodeShape(type: string): unknown;
export declare function getEdgeShape(type: string): unknown;
export declare function parseDotGraph(dotSource?: string, options?: { nodeType?: string }): TopologyGraphData;
export declare function registerLayoutExecutor(type: string, executor: (...args: unknown[]) => unknown): () => void;
export declare function unregisterLayoutExecutor(type: string): void;
export declare function getRegisteredLayoutExecutors(): string[];

export declare const FlowToolbar: any;
export declare const FlowLegend: any;
export declare const FlowControls: any;
export declare const Toolbar: any;
export declare const ContextMenu: any;
export declare const Tooltip: any;
export declare const TopologyDetailDrawer: any;
export declare const StandardTopologyGraph: any;
export declare const LayeredTopologyGraph: any;
export declare const SpatialTopologyGraph: any;
export declare const FlowTopologyGraph: any;
export declare const createTopologyGraph: any;
export declare const selectTopologyGraph: any;
export declare const registerTopologyShape: any;
export declare const buildCloudResourceTopology: any;
export declare const buildCloudResourceTopologyFromQuery: any;
export declare const buildGlobalEntityTopology: any;
export declare const createCloudResourceQueryProvider: any;
export declare const createResourceBatchSelection: any;
export declare const normalizeCloudResourceQueryResult: any;
export declare const paginateResources: any;
export declare const filterTopologyData: any;
export declare const getDataByNodeGroup: any;
export declare const getParallelEdgeKey: any;
export declare const mergeParallelEdges: any;
export declare const processParallelEdges: any;
export declare const DEFAULT_EXPAND_LIMIT: number;
export declare const DEFAULT_MAX_RENDER_NODES: number;
export declare const buildTopologyDetailModel: any;
export declare const createEntityTopologyView: any;
export declare const resolveEdgeMetricTitle: any;
export declare const toggleGroupId: any;
