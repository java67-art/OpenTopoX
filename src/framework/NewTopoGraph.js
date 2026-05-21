import { TopoLayout, getNodeBaseSize, getNodeSize } from "./TopoLayout.js";
import {
  createTopologyContext,
  formatTopologyContextAsMarkdown,
  getVisibleGraphData as getVisibleTopologyGraphData,
  serializeTopologyContext,
} from "./TopologyContextBridge.js";
import { getEdgeShape, getNodeShape, registerEdgeShape, registerNodeShape } from "./Registry.js";
import { validateGraphData } from "./TopologyGraphStore.js";

const SVG_NS = "http://www.w3.org/2000/svg";
let graphInstanceSeed = 0;

export class NewTopoGraph {
  constructor({
    container,
    config = {},
    style = {},
    className = "",
    onLoad,
    handleNodeClick,
    handleEdgeClick,
    handleCloseInfo,
    renderAddNodeModal,
    onDeleteNode,
  }) {
    if (!container) throw new Error("NewTopoGraph requires a container");
    this.container = container;
    this.config = config;
    this.handleNodeClick = handleNodeClick;
    this.handleEdgeClick = handleEdgeClick;
    this.handleCloseInfo = handleCloseInfo;
    this.renderAddNodeModal = renderAddNodeModal;
    this.onDeleteNode = onDeleteNode;
    this.nodes = [];
    this.edges = [];
    this.originData = { nodes: [], edges: [] };
    this.currentFocusId = "";
    this.nodeType = "cardNode";
    this.viewport = { x: 0, y: 0, zoom: 1 };
    this.selected = null;
    this.selection = { nodes: [], edges: [], primary: null };
    this.selectionMode = config.selectionMode || "default";
    this.areaSelection = null;
    this.animate = config.animate ?? true;
    this.userAnimate = this.animate;
    this.performanceMode = false;
    this.autoPerformanceActive = false;
    this.edgeLabelsVisible = true;
    this.userEdgeLabelsVisible = this.edgeLabelsVisible;
    this.autoEdgeLabelsHidden = false;
    this.graphType = config.type || config.graphType || "default";
    this.agentLoopInsertCount = 0;
    this.nodeDraggable = config.nodeDraggable ?? true;
    this.hoverHighlight = config.hoverHighlight ?? true;
    this.hoverHighlightDegree = config.hoverHighlightDegree ?? 1;
    this.effectiveHoverHighlightDegree = this.hoverHighlightDegree;
    this.minimapEnabled = config.minimap ?? false;
    this.gridVisible = config.grid ?? false;
    this.minimapWidth = config.minimapWidth ?? 220;
    this.minimapHeight = config.minimapHeight ?? 150;
    this.minimapEdgeLimit = config.minimapEdgeLimit ?? 1200;
    this.fitViewPadding = config.fitViewPadding ?? 0.15;
    this.performanceEdgeLabelLimit = config.performanceEdgeLabelLimit ?? 60;
    this.autoPerformanceMode = config.autoPerformanceMode ?? true;
    this.performanceNodeLimit = config.performanceNodeLimit ?? 1000;
    this.performanceTotalElementLimit = config.performanceTotalElementLimit ?? 2500;
    this.validateData = config.validateData ?? true;
    this.allowedNodeTypes = config.allowedNodeTypes || [];
    this.throwOnInvalid = config.throwOnInvalid ?? false;
    this.onValidation = config.onValidation;
    this.onValidationError = config.onValidationError;
    this.lightStructurePatch = config.lightStructurePatch ?? true;
    this.lightStructureNodeLimit = config.lightStructureNodeLimit ?? 6;
    this.lightStructureEdgeLimit = config.lightStructureEdgeLimit ?? 24;
    this.debugPanelEnabled = config.debugPanel ?? false;
    this.debugMetrics = {};
    this.lastRenderStats = { nodes: 0, edges: 0, durationMs: 0, performanceMode: false };
    this.layoutVersion = 0;
    this.viewportTimer = null;
    this.nodeElementById = new Map();
    this.edgeElementById = new Map();
    this.edgeRenderFrame = null;
    this.hoverRenderFrame = null;
    this.minimapRenderFrame = null;
    this.nodeAnimationFrame = null;
    this.nodeAnimationTimer = null;
    this.pendingNodeAnimation = null;
    this.fullscreenFallback = false;
    this.instanceId = createGraphInstanceId();
    this.edgeMarkerId = `topo-arrow-${this.instanceId}`;
    this.minimapShadowId = `minimap-soft-shadow-${this.instanceId}`;
    this.handleFullscreenChange = () => this.syncFullscreenState();
    this.handleKeydown = (event) => this.handleGraphKeydown(event);
    this.hoverState = null;
    this.suppressNodeClick = null;
    this.isMinimapDragging = false;
    this.layout = new TopoLayout({ options: { topoType: "dot", rankDir: "LR" } });
    this.buildShell(style, className);
    this.setGraphType(this.graphType);
    this.setNodeDraggable(this.nodeDraggable);
    this.setTheme(config.theme || "neutral");
    this.bindCanvasEvents();
    document.addEventListener("fullscreenchange", this.handleFullscreenChange);
    document.addEventListener("keydown", this.handleKeydown);
    onLoad?.();
  }

  getGraph() {
    return {
      getData: () => this.getData(),
      getGraphData: () => this.getData(),
      getNodes: () => this.getNodes(),
      getEdges: () => this.getEdges(),
      setData: (data) => this.setData(data),
      setGroupData: (data) => this.setGroupData(data),
      updateGraphData: (nodes, edges, options) => this.updateGraphData(nodes, edges, options),
      showOriginData: (options) => this.showOriginData(options),
      handleFocusNode: (id, options) => this.handleFocusNode(id, options),
      reverseData: (options) => this.showOriginData(options),
      getGraphType: () => this.graphType,
      setGraphType: (type) => this.setGraphType(type),
      insertNodeOnEdge: (edgeId, node, options) => this.insertNodeOnEdge(edgeId, node, options),
      deleteNode: (id, options) => this.deleteNode(id, options),
      setLayout: (options, nodeType) => this.setLayout(options, nodeType),
      setAnimateMode: (enabled) => this.setAnimateMode(enabled),
      setPerformanceMode: (enabled) => this.setPerformanceMode(enabled),
      setEdgeLabelsVisible: (enabled) => this.setEdgeLabelsVisible(enabled),
      areEdgeLabelsVisible: () => this.edgeLabelsVisible,
      setNodeDraggable: (enabled) => this.setNodeDraggable(enabled),
      setHoverHighlight: (enabled, options) => this.setHoverHighlight(enabled, options),
      setMinimapVisible: (enabled) => this.setMinimapVisible(enabled),
      setGridVisible: (enabled) => this.setGridVisible(enabled),
      setDebugPanelVisible: (enabled) => this.setDebugPanelVisible(enabled),
      isDebugPanelVisible: () => this.debugPanelEnabled,
      updateDebugMetrics: (metrics) => this.updateDebugMetrics(metrics),
      setTheme: (theme) => this.setTheme(theme),
      getOptions: () => this.getOptions(),
      getPluginInstance: (name) => this.getPluginInstance(name),
      render: () => this.render(),
      registerNodeShape: (type, shape) => registerNodeShape(type, shape),
      registerEdgeShape: (type, shape) => registerEdgeShape(type, shape),
      fitView: (options) => this.fitView(options),
      fitCenter: () => this.fitCenter(),
      zoomTo: (zoom) => this.zoomTo(zoom),
      focusNode: (id) => this.focusNode(id),
      getContainer: () => this.container,
      getRootElement: () => this.root,
      selectNode: (id, options) => this.selectNode(id, options),
      getSelection: () => this.getSelection(),
      setSelection: (selection, options) => this.setSelection(selection, options),
      toggleSelectionItem: (item, options) => this.toggleSelectionItem(item, options),
      clearSelection: (options) => this.clearSelection(options),
      selectArea: (rect, options) => this.selectArea(rect, options),
      selectVisible: (options) => this.selectVisible(options),
      invertSelection: (options) => this.invertSelection(options),
      selectByCriteria: (criteria, options) => this.selectByCriteria(criteria, options),
      setSelectionMode: (mode) => this.setSelectionMode(mode),
      getSelectionMode: () => this.selectionMode,
      getVisibleGraphData: (options) => this.getVisibleGraphData(options),
      extractContext: (options) => this.extractContext(options),
      copyContext: (options) => this.copyContext(options),
      updateNode: (id, patch) => this.updateNode(id, patch),
      updateNodeData: (id, patch) => this.updateNodeData(id, patch),
      updateEdge: (id, patch) => this.updateEdge(id, patch),
      updateEdgeData: (id, patch) => this.updateEdgeData(id, patch),
      patchGraphData: (patch, options) => this.patchGraphData(patch, options),
      getInternalNode: (id) => this.getInternalNode(id),
      getSelected: () => this.selected ? { ...this.selected } : null,
      getViewport: () => ({ ...this.viewport }),
      setViewport: (viewport) => this.setViewport(viewport),
      getRenderStats: () => ({ ...this.lastRenderStats }),
      isNodeDraggable: () => this.nodeDraggable,
      isGridVisible: () => this.gridVisible,
      isFullscreen: () => this.isFullscreen(),
      setFullscreen: (enabled) => this.setFullscreen(enabled),
      toggleFullscreen: () => this.toggleFullscreen(),
    };
  }

  getData() {
    return {
      nodes: this.getNodes(),
      edges: this.getEdges(),
    };
  }

  getNodes() {
    return this.nodes.map((node) => cloneGraphItem(node));
  }

  getEdges() {
    return this.edges.map((edge) => cloneGraphItem(edge));
  }

  setLayout(options = {}, nodeType) {
    this.layout.cancelWorkerLayout?.("Layout replaced");
    this.layout = new TopoLayout({ options });
    if (nodeType) this.nodeType = nodeType;
    return this;
  }

  setGraphType(type = "default") {
    this.graphType = type || "default";
    this.config.type = this.graphType;
    if (!this.root) return this;
    this.root.classList.forEach((name) => {
      if (name.startsWith("is-graph-")) this.root.classList.remove(name);
    });
    this.root.classList.add(`is-graph-${this.graphType}`);
    this.root.classList.toggle("is-agentloop", this.isAgentLoop());
    return this;
  }

  isAgentLoop() {
    return this.graphType === "agentloop";
  }

  setAnimateMode(enabled) {
    this.userAnimate = Boolean(enabled);
    this.applyAnimateMode(!this.performanceMode && this.userAnimate);
  }

  applyAnimateMode(enabled) {
    this.animate = Boolean(enabled);
    this.nodeLayer?.classList.toggle("no-animate", !this.animate);
    this.root?.classList.toggle("no-animate", !this.animate);
  }

  setPerformanceMode(enabled) {
    this.autoPerformanceActive = false;
    this.performanceMode = Boolean(enabled);
    this.root.classList.toggle("is-performance", this.performanceMode);
    this.applyAnimateMode(!this.performanceMode && this.userAnimate);
    this.render();
  }

  setEdgeLabelsVisible(enabled) {
    this.userEdgeLabelsVisible = Boolean(enabled);
    this.edgeLabelsVisible = this.userEdgeLabelsVisible && !this.autoEdgeLabelsHidden;
    this.lastRenderStats = {
      ...this.lastRenderStats,
      edgeLabelsVisible: this.edgeLabelsVisible,
      autoEdgeLabelsHidden: this.autoEdgeLabelsHidden,
    };
    this.renderEdges();
  }

  syncAutoPerformanceMode({ nodeCount = this.nodes.length, edgeCount = this.edges.length } = {}) {
    if (!this.autoPerformanceMode) return;
    const totalElementCount = nodeCount + edgeCount;
    const shouldUsePerformanceMode = nodeCount >= this.performanceNodeLimit
      || totalElementCount >= this.performanceTotalElementLimit;
    if (shouldUsePerformanceMode && !this.performanceMode) {
      this.autoPerformanceActive = true;
      this.performanceMode = true;
    } else if (!shouldUsePerformanceMode && this.autoPerformanceActive) {
      this.autoPerformanceActive = false;
      this.performanceMode = false;
    }

    this.autoEdgeLabelsHidden = edgeCount > this.performanceEdgeLabelLimit;
    this.edgeLabelsVisible = this.userEdgeLabelsVisible && !this.autoEdgeLabelsHidden;
    this.effectiveHoverHighlightDegree = totalElementCount >= this.performanceTotalElementLimit
      ? Math.min(1, this.hoverHighlightDegree)
      : this.hoverHighlightDegree;
    this.root?.classList.toggle("is-performance", this.performanceMode);
    this.applyAnimateMode(!this.performanceMode && this.userAnimate);
  }

  setNodeDraggable(enabled) {
    this.nodeDraggable = Boolean(enabled);
    this.root?.classList.toggle("is-draggable", this.nodeDraggable);
  }

  setHoverHighlight(enabled, { degree } = {}) {
    this.hoverHighlight = Boolean(enabled);
    if (Number.isFinite(degree)) this.hoverHighlightDegree = Math.max(0, degree);
    this.effectiveHoverHighlightDegree = this.hoverHighlightDegree;
    if (!this.hoverHighlight) this.clearHoverHighlight();
  }

  setMinimapVisible(enabled) {
    this.minimapEnabled = Boolean(enabled);
    this.root?.classList.toggle("has-minimap", this.minimapEnabled);
    this.scheduleMinimapRender();
  }

  setGridVisible(enabled) {
    this.gridVisible = Boolean(enabled);
    this.root?.classList.toggle("has-grid", this.gridVisible);
  }

  setDebugPanelVisible(enabled) {
    this.debugPanelEnabled = Boolean(enabled);
    this.root?.classList.toggle("has-debug-panel", this.debugPanelEnabled);
    if (this.debugPanel) this.debugPanel.hidden = !this.debugPanelEnabled;
    this.renderDebugPanel();
  }

  updateDebugMetrics(metrics = {}) {
    this.debugMetrics = {
      ...this.debugMetrics,
      ...cloneGraphItem(metrics),
      updatedAt: Date.now(),
    };
    this.renderDebugPanel();
    return this.debugMetrics;
  }

  getOptions() {
    return {
      layout: { ...this.layout.options },
      graphType: this.graphType,
      nodeType: this.nodeType,
      plugins: {
        debugPanel: this.debugPanelEnabled,
        fullscreen: true,
        grid: this.gridVisible,
        minimap: this.minimapEnabled,
      },
    };
  }

  getPluginInstance(name) {
    if (name === "fullscreen") {
      return {
        request: () => this.setFullscreen(true),
        exit: () => this.setFullscreen(false),
        toggle: () => this.toggleFullscreen(),
        isEnabled: () => this.isFullscreen(),
      };
    }
    if (name === "grid") {
      return {
        show: () => this.setGridVisible(true),
        hide: () => this.setGridVisible(false),
        toggle: () => this.setGridVisible(!this.gridVisible),
        isVisible: () => this.gridVisible,
      };
    }
    if (name === "minimap") {
      return {
        show: () => this.setMinimapVisible(true),
        hide: () => this.setMinimapVisible(false),
        toggle: () => this.setMinimapVisible(!this.minimapEnabled),
        isVisible: () => this.minimapEnabled,
      };
    }
    return null;
  }

  setTheme(theme = "neutral") {
    this.theme = theme;
    this.config.theme = theme;
    if (!this.root) return;
    this.root.classList.forEach((name) => {
      if (name.startsWith("theme-")) this.root.classList.remove(name);
    });
    this.root.classList.add(`theme-${theme}`);
  }

  async setData({
    nodes = [],
    edges = [],
    centerNodeId,
    clearStatus = false,
    disableAnimate = false,
    preserveOrigin = false,
    preserveViewport = false,
    autoFit = true,
    silentSelection = false,
  } = {}) {
    const startedAt = performance.now();
    const layoutVersion = this.layoutVersion += 1;
    this.hoverState = null;
    const validation = this.validateData
      ? validateGraphData(nodes, edges, this.getValidationOptions())
      : createValidationResult(nodes, edges);
    this.emitValidationResult(validation, { source: "setData", layoutVersion });
    const graphNodes = validation.nodes;
    const graphEdges = validation.edges;
    const previousPositions = this.captureNodePositions();
    if (!preserveOrigin) {
      this.originData = {
        nodes: graphNodes.map((node) => cloneGraphItem(node)),
        edges: graphEdges.map((edge) => cloneGraphItem(edge)),
      };
    }
    let layoutResult;
    try {
      layoutResult = await this.layout.execute({
        nodes: graphNodes.filter((node) => !node.data?.isParent),
        edges: graphEdges,
        innerFunc: { getInternalNode: (id) => this.getInternalNode(id) },
        clearStatus,
      });
    } catch (error) {
      if (!error?.cancelled) throw error;
      return {
        stale: true,
        cancelled: true,
        layoutVersion,
        currentLayoutVersion: this.layoutVersion,
      };
    }
    if (layoutVersion !== this.layoutVersion) {
      return {
        stale: true,
        layoutVersion,
        currentLayoutVersion: this.layoutVersion,
      };
    }

    this.nodes = [...(layoutResult.parent || []), ...(layoutResult.nodes || [])].map((node) => ({
      ...node,
      type: this.resolveNodeType(node),
    }));
    this.edges = graphEdges.map((edge) => ({
      type: "flowEdge",
      markerEnd: "arrow",
      ...edge,
    }));
    this.pruneSelection({ emit: false });
    this.syncAutoPerformanceMode({ nodeCount: this.nodes.length, edgeCount: this.edges.length });
    this.pendingNodeAnimation = this.createNodeAnimation(previousPositions, { centerNodeId, disableAnimate });

    this.render();
    this.lastRenderStats = {
      nodes: this.nodes.length,
      edges: this.edges.length,
      durationMs: Math.round((performance.now() - startedAt) * 10) / 10,
      performanceMode: this.performanceMode,
      layout: this.layout.options.topoType || "dot",
      theme: this.theme,
      edgeLabelsVisible: this.edgeLabelsVisible,
      autoEdgeLabelsHidden: this.autoEdgeLabelsHidden,
      effectiveHoverHighlightDegree: this.effectiveHoverHighlightDegree,
      layoutMeta: layoutResult.meta || {},
      validation,
      layoutVersion,
      stale: false,
    };
    this.container.dispatchEvent(new CustomEvent("topo:render", {
      detail: this.lastRenderStats,
      bubbles: true,
    }));
    this.renderDebugPanel();

    if (centerNodeId && !disableAnimate && this.animate && !preserveViewport) {
      if (silentSelection) this.focusViewportOnNode(centerNodeId);
      else this.focusNode(centerNodeId);
    } else if (autoFit && !preserveViewport) {
      this.scheduleViewportFit({ padding: this.fitViewPadding, layoutVersion });
    } else {
      this.applyViewport();
    }

    return layoutResult;
  }

  getValidationOptions() {
    return {
      additionalAllowedNodeTypes: this.allowedNodeTypes,
    };
  }

  emitValidationResult(validation, detail = {}) {
    const eventDetail = {
      ...detail,
      validation,
    };
    this.onValidation?.(validation, eventDetail);
    if (!validation.valid || validation.hasWarnings) {
      this.onValidationError?.(validation, eventDetail);
    }
    this.container.dispatchEvent(new CustomEvent("topo:validation", {
      detail: eventDetail,
      bubbles: true,
    }));
    if (this.throwOnInvalid && !validation.valid) {
      const error = new Error(`Invalid topology graph data: ${validation.errors.join("; ")}`);
      error.validation = validation;
      throw error;
    }
  }

  async setGroupData({
    mainGraph,
    subGraphs = [],
    centerNodeId,
    clearStatus = false,
    disableAnimate = false,
    preserveOrigin = false,
    preserveViewport = false,
    autoFit = true,
    silentSelection = false,
  } = {}) {
    const startedAt = performance.now();
    const layoutVersion = this.layoutVersion += 1;
    const previousPositions = this.captureNodePositions();
    const layoutResult = this.layout.groupLayout({ mainGraph, subGraphs });
    if (layoutVersion !== this.layoutVersion) {
      return {
        stale: true,
        layoutVersion,
        currentLayoutVersion: this.layoutVersion,
      };
    }
    const nodes = [...(layoutResult.parent || []), ...(layoutResult.nodes || [])].map((node) => ({
      ...node,
      type: this.resolveNodeType(node),
    }));
    const edges = (layoutResult.edges || []).map((edge) => ({
      type: "flowEdge",
      markerEnd: "arrow",
      ...edge,
    }));

    if (!preserveOrigin) {
      this.originData = {
        nodes: nodes.map((node) => cloneGraphItem(node)),
        edges: edges.map((edge) => cloneGraphItem(edge)),
      };
    }

    this.nodes = nodes;
    this.edges = edges;
    this.pruneSelection({ emit: false });
    this.syncAutoPerformanceMode({ nodeCount: this.nodes.length, edgeCount: this.edges.length });
    this.pendingNodeAnimation = this.createNodeAnimation(previousPositions, { centerNodeId, disableAnimate });
    this.render();
    this.lastRenderStats = {
      nodes: this.nodes.length,
      edges: this.edges.length,
      durationMs: Math.round((performance.now() - startedAt) * 10) / 10,
      performanceMode: this.performanceMode,
      layout: "groupLayout",
      theme: this.theme,
      edgeLabelsVisible: this.edgeLabelsVisible,
      autoEdgeLabelsHidden: this.autoEdgeLabelsHidden,
      effectiveHoverHighlightDegree: this.effectiveHoverHighlightDegree,
      layoutVersion,
      stale: false,
    };
    this.container.dispatchEvent(new CustomEvent("topo:render", {
      detail: this.lastRenderStats,
      bubbles: true,
    }));
    this.renderDebugPanel();

    if (centerNodeId && !disableAnimate && this.animate && !preserveViewport) {
      if (silentSelection) this.focusViewportOnNode(centerNodeId);
      else this.focusNode(centerNodeId);
    } else if (autoFit && !preserveViewport && layoutResult.fitViewNodes?.length) {
      this.scheduleViewportFit({ padding: this.fitViewPadding, nodes: layoutResult.fitViewNodes, layoutVersion });
    } else if (autoFit && !preserveViewport) {
      this.scheduleViewportFit({ padding: this.fitViewPadding, layoutVersion });
    } else {
      this.applyViewport();
    }

    return layoutResult;
  }

  updateNodeData(id, patch) {
    const startedAt = performance.now();
    let changed = false;
    let updatedNode = null;
    this.nodes = this.nodes.map((node) => {
      if (node.id !== id) return node;
      changed = true;
      updatedNode = { ...node, data: { ...node.data, ...patch } };
      return updatedNode;
    });
    if (!changed) return null;
    this.renderNodeUpdates([id]);
    this.renderEdgeUpdates(this.getConnectedEdgeIds([id]));
    this.scheduleMinimapRender();
    this.recordPatchStats({ startedAt, nodePatches: 1, edgePatches: 0 });
    return updatedNode;
  }

  updateNode(id, patch) {
    const startedAt = performance.now();
    let changed = false;
    let updatedNode = null;
    this.nodes = this.nodes.map((node) => {
      if (node.id !== id) return node;
      const nextPatch = typeof patch === "function" ? patch(cloneGraphItem(node)) : patch;
      if (!nextPatch) return node;
      changed = true;
      updatedNode = mergeNodePatch(node, nextPatch);
      return updatedNode;
    });
    if (!changed) return null;
    this.renderNodeUpdates([id]);
    this.renderEdgeUpdates(this.getConnectedEdgeIds([id]));
    this.scheduleMinimapRender();
    this.recordPatchStats({ startedAt, nodePatches: 1, edgePatches: 0 });
    return updatedNode;
  }

  updateEdgeData(id, patch) {
    const startedAt = performance.now();
    let changed = false;
    let updatedEdge = null;
    this.edges = this.edges.map((edge) => {
      if (edge.id !== id) return edge;
      changed = true;
      updatedEdge = { ...edge, data: { ...edge.data, ...patch } };
      return updatedEdge;
    });
    if (!changed) return null;
    this.renderEdgeUpdates([id]);
    this.scheduleMinimapRender();
    this.recordPatchStats({ startedAt, nodePatches: 0, edgePatches: 1 });
    return updatedEdge;
  }

  updateEdge(id, patch) {
    const startedAt = performance.now();
    let changed = false;
    let updatedEdge = null;
    this.edges = this.edges.map((edge) => {
      if (edge.id !== id) return edge;
      const nextPatch = typeof patch === "function" ? patch(cloneGraphItem(edge)) : patch;
      if (!nextPatch) return edge;
      changed = true;
      updatedEdge = mergeEdgePatch(edge, nextPatch);
      return updatedEdge;
    });
    if (!changed) return null;
    this.renderEdgeUpdates([id]);
    this.scheduleMinimapRender();
    this.recordPatchStats({ startedAt, nodePatches: 0, edgePatches: 1 });
    return updatedEdge;
  }

  patchGraphData(patch = {}, options = {}) {
    const startedAt = performance.now();
    const patchOptions = { ...(patch.options || {}), ...options };
    const nodePatches = normalizePatchList(patch.nodePatches);
    const edgePatches = normalizePatchList(patch.edgePatches);
    const addedNodes = normalizeGraphItemList(patch.addedNodes || patch.addNodes);
    const updatedNodes = normalizeGraphItemList(patch.updatedNodes || patch.updateNodes);
    const removedNodeIds = normalizeIdList(patch.removedNodeIds || patch.removeNodeIds);
    const addedEdges = normalizeGraphItemList(patch.addedEdges || patch.addEdges);
    const updatedEdges = normalizeGraphItemList(patch.updatedEdges || patch.updateEdges);
    const removedEdgeIds = normalizeIdList(patch.removedEdgeIds || patch.removeEdgeIds);
    const removedNodeIdSet = new Set(removedNodeIds);
    const removedEdgeIdSet = new Set(removedEdgeIds);
    const hasStructureChange = Boolean(
      addedNodes.length
      || updatedNodes.length
      || removedNodeIds.length
      || addedEdges.length
      || updatedEdges.length
      || removedEdgeIds.length,
    );

    if (hasStructureChange) {
      const nodeById = new Map(this.getNodes().map((node) => [node.id, node]));
      const edgeById = new Map(this.getEdges().map((edge) => [edge.id, edge]));
      for (const id of removedNodeIdSet) nodeById.delete(id);
      for (const id of removedEdgeIdSet) edgeById.delete(id);
      for (const edge of edgeById.values()) {
        if (removedNodeIdSet.has(edge.source) || removedNodeIdSet.has(edge.target)) {
          edgeById.delete(edge.id);
        }
      }
      for (const node of addedNodes) if (node?.id) nodeById.set(node.id, cloneGraphItem(node));
      for (const node of updatedNodes) {
        if (!node?.id) continue;
        const existing = nodeById.get(node.id);
        nodeById.set(node.id, existing ? mergeNodePatch(existing, node) : cloneGraphItem(node));
      }
      for (const item of nodePatches) {
        const existing = nodeById.get(item.id);
        if (existing) nodeById.set(item.id, mergeNodePatch(existing, patchFromRealtimeItem(item)));
      }
      for (const edge of addedEdges) if (edge?.id) edgeById.set(edge.id, cloneGraphItem(edge));
      for (const edge of updatedEdges) {
        if (!edge?.id) continue;
        const existing = edgeById.get(edge.id);
        edgeById.set(edge.id, existing ? mergeEdgePatch(existing, edge) : cloneGraphItem(edge));
      }
      for (const item of edgePatches) {
        const existing = edgeById.get(item.id);
        if (existing) edgeById.set(item.id, mergeEdgePatch(existing, patchFromRealtimeItem(item)));
      }
      const lightResult = this.applyLightStructurePatch({
        startedAt,
        nodeById,
        edgeById,
        addedNodes,
        updatedNodes,
        removedNodeIds,
        addedEdges,
        updatedEdges,
        removedEdgeIds,
        nodePatches,
        edgePatches,
        options: patchOptions,
      });
      if (lightResult) return lightResult;
      return this.setData({
        nodes: [...nodeById.values()],
        edges: [...edgeById.values()].filter((edge) => nodeById.has(edge.source) && nodeById.has(edge.target)),
        preserveOrigin: patchOptions.preserveOrigin ?? true,
        clearStatus: patchOptions.clearStatus ?? true,
        disableAnimate: patchOptions.disableAnimate ?? true,
        centerNodeId: patchOptions.centerNodeId,
        autoFit: patchOptions.autoFit,
        preserveViewport: patchOptions.preserveViewport,
        silentSelection: patchOptions.silentSelection,
      });
    }

    let nodePatchCount = 0;
    let edgePatchCount = 0;
    const changedNodeIds = new Set();
    const changedEdgeIds = new Set();
    if (nodePatches.length) {
      const patchById = new Map(nodePatches.map((item) => [item.id, patchFromRealtimeItem(item)]));
      this.nodes = this.nodes.map((node) => {
        const nextPatch = patchById.get(node.id);
        if (!nextPatch) return node;
        nodePatchCount += 1;
        changedNodeIds.add(node.id);
        return mergeNodePatch(node, nextPatch);
      });
    }
    if (edgePatches.length) {
      const patchById = new Map(edgePatches.map((item) => [item.id, patchFromRealtimeItem(item)]));
      this.edges = this.edges.map((edge) => {
        const nextPatch = patchById.get(edge.id);
        if (!nextPatch) return edge;
        edgePatchCount += 1;
        changedEdgeIds.add(edge.id);
        return mergeEdgePatch(edge, nextPatch);
      });
    }
    if (!nodePatchCount && !edgePatchCount) return { nodePatches: 0, edgePatches: 0 };
    if (nodePatchCount) this.renderNodeUpdates(changedNodeIds);
    const affectedEdgeIds = new Set([...changedEdgeIds, ...this.getConnectedEdgeIds(changedNodeIds)]);
    if (affectedEdgeIds.size) this.renderEdgeUpdates(affectedEdgeIds);
    this.scheduleMinimapRender();
    this.recordPatchStats({ startedAt, nodePatches: nodePatchCount, edgePatches: edgePatchCount });
    return {
      nodePatches: nodePatchCount,
      edgePatches: edgePatchCount,
      affectedEdges: affectedEdgeIds.size,
    };
  }

  applyLightStructurePatch({
    startedAt,
    nodeById,
    edgeById,
    addedNodes = [],
    updatedNodes = [],
    removedNodeIds = [],
    addedEdges = [],
    updatedEdges = [],
    removedEdgeIds = [],
    nodePatches = [],
    edgePatches = [],
    options = {},
  } = {}) {
    if (!this.shouldApplyLightStructurePatch({
      addedNodes,
      updatedNodes,
      removedNodeIds,
      addedEdges,
      updatedEdges,
      removedEdgeIds,
      options,
    })) {
      return null;
    }

    const addedNodeIds = new Set(addedNodes.map((node) => node?.id).filter(Boolean));
    const changedNodeIds = new Set([
      ...addedNodeIds,
      ...updatedNodes.map((node) => node?.id).filter(Boolean),
      ...nodePatches.map((patch) => patch?.id).filter(Boolean),
    ]);
    const changedEdgeIds = new Set([
      ...addedEdges.map((edge) => edge?.id).filter(Boolean),
      ...updatedEdges.map((edge) => edge?.id).filter(Boolean),
      ...removedEdgeIds,
      ...edgePatches.map((patch) => patch?.id).filter(Boolean),
    ]);

    let index = 0;
    for (const id of addedNodeIds) {
      const node = nodeById.get(id);
      if (!node || node.position || node.data?.position) continue;
      node.position = this.inferLightStructureNodePosition(node, edgeById, index);
      index += 1;
    }

    const validation = this.validateData
      ? validateGraphData([...nodeById.values()], [...edgeById.values()], this.getValidationOptions())
      : createValidationResult([...nodeById.values()], [...edgeById.values()]);
    this.emitValidationResult(validation, { source: "patchGraphData" });
    if (validation.errors.length) return null;

    this.hoverState = null;
    this.nodes = validation.nodes.map((node) => ({
      ...node,
      type: this.resolveNodeType(node),
    }));
    this.edges = validation.edges.map((edge) => ({
      type: "flowEdge",
      markerEnd: "arrow",
      ...edge,
    }));
    this.pruneSelection({ emit: false });
    if (!options.preserveOrigin) {
      this.originData = {
        nodes: validation.nodes.map((node) => cloneGraphItem(node)),
        edges: validation.edges.map((edge) => cloneGraphItem(edge)),
      };
    }
    this.syncAutoPerformanceMode({ nodeCount: this.nodes.length, edgeCount: this.edges.length });
    this.renderNodes();
    this.renderEdges();
    this.applyViewport();
    this.scheduleMinimapRender();

    const result = {
      structural: true,
      relayout: false,
      addedNodes: addedNodes.length,
      updatedNodes: updatedNodes.length + nodePatches.length,
      removedNodeIds: removedNodeIds.length,
      addedEdges: addedEdges.length,
      updatedEdges: updatedEdges.length + edgePatches.length,
      removedEdgeIds: removedEdgeIds.length,
      changedNodes: changedNodeIds.size,
      changedEdges: changedEdgeIds.size,
      validation,
    };
    this.recordPatchStats({
      startedAt,
      nodePatches: result.updatedNodes + result.addedNodes + result.removedNodeIds,
      edgePatches: result.updatedEdges + result.addedEdges + result.removedEdgeIds,
      structurePatch: result,
    });
    return result;
  }

  shouldApplyLightStructurePatch({
    addedNodes = [],
    updatedNodes = [],
    removedNodeIds = [],
    addedEdges = [],
    updatedEdges = [],
    removedEdgeIds = [],
    options = {},
  } = {}) {
    if (!this.lightStructurePatch || options.relayout === true || options.forceLayout === true) return false;
    const nodeChangeCount = addedNodes.length + updatedNodes.length + removedNodeIds.length;
    const edgeChangeCount = addedEdges.length + updatedEdges.length + removedEdgeIds.length;
    if (nodeChangeCount > this.lightStructureNodeLimit) return false;
    if (edgeChangeCount > this.lightStructureEdgeLimit) return false;
    const removedNodeIdSet = new Set(removedNodeIds);
    if (this.nodes.some((node) => removedNodeIdSet.has(node.parentId))) return false;
    const unsafeNodeChange = [...addedNodes, ...updatedNodes].some((node) => {
      const type = this.resolveNodeType(node || {});
      return node?.parentId
        || node?.extent
        || node?.expandParent
        || node?.data?.isParent
        || isParentNode(node, type);
    });
    return !unsafeNodeChange;
  }

  inferLightStructureNodePosition(node, edgeById, index = 0) {
    const rankDir = this.layout.options.rankDir || "LR";
    const relatedEdge = [...edgeById.values()].find((edge) => edge.source === node.id || edge.target === node.id);
    const neighborId = relatedEdge?.source === node.id ? relatedEdge.target : relatedEdge?.source;
    const neighbor = neighborId ? this.nodes.find((item) => item.id === neighborId) : null;
    const neighborPosition = neighbor ? this.getNodeAbsolutePosition(neighbor) : null;
    const offset = rankDir === "TB"
      ? { x: (index % 3) * 260, y: 180 + Math.floor(index / 3) * 120 }
      : { x: 260 + Math.floor(index / 3) * 260, y: (index % 3 - 1) * 120 };
    if (neighborPosition) {
      return {
        x: Math.round(neighborPosition.x + offset.x),
        y: Math.round(neighborPosition.y + offset.y),
      };
    }
    const bounds = this.getBounds();
    return {
      x: Math.round(bounds.x + bounds.width + 220 + Math.floor(index / 3) * 260),
      y: Math.round(bounds.y + (index % 3) * 120),
    };
  }

  recordPatchStats({ startedAt, nodePatches = 0, edgePatches = 0, structurePatch = null }) {
    this.lastRenderStats = {
      ...this.lastRenderStats,
      patchDurationMs: Math.round((performance.now() - startedAt) * 10) / 10,
      nodePatches,
      edgePatches,
      structurePatch,
      lastPatchAt: Date.now(),
      nodes: this.nodes.length,
      edges: this.edges.length,
      performanceMode: this.performanceMode,
      edgeLabelsVisible: this.edgeLabelsVisible,
      autoEdgeLabelsHidden: this.autoEdgeLabelsHidden,
    };
    this.container.dispatchEvent(new CustomEvent("topo:patch", {
      detail: this.lastRenderStats,
      bubbles: true,
    }));
    this.renderDebugPanel();
  }

  getInternalNode(id) {
    const node = this.nodes.find((item) => item.id === id);
    if (!node) return null;
    return {
      ...cloneGraphItem(node),
      position: this.getNodeAbsolutePosition(node),
      measured: getNodeSize(node),
    };
  }

  async updateGraphData(nodes = [], edges = [], options = {}) {
    if (!options.remain) {
      this.originData = {
        nodes: (options.origin?.nodes || options.origin?.nodeRes || nodes).map((node) => cloneGraphItem(node)),
        edges: (options.origin?.edges || options.origin?.edgesRes || edges).map((edge) => cloneGraphItem(edge)),
      };
    }

    const focusId = options.focusId || options.id || options.centerNodeId;
    this.currentFocusId = focusId || "";
    return this.setData({
      nodes,
      edges,
      centerNodeId: focusId,
      clearStatus: options.clearStatus,
      disableAnimate: options.disableAnimate,
      preserveOrigin: true,
    });
  }

  async handleFocusNode(id, { degree = 1, direction = "both", disableAnimate = false } = {}) {
    const sourceData = this.originData.nodes.length ? this.originData : this.getData();
    const related = getRelatedData(id, sourceData.nodes, sourceData.edges, { degree, direction });
    if (!related.nodes.length) return null;
    this.currentFocusId = id;
    await this.setData({
      nodes: related.nodes.map((node) => node.id === id ? disableExpandAction(node) : node),
      edges: related.edges,
      centerNodeId: id,
      clearStatus: true,
      disableAnimate,
      preserveOrigin: true,
    });
    return related;
  }

  async showOriginData({ centerNodeId, disableAnimate = false } = {}) {
    const sourceData = this.originData.nodes.length ? this.originData : this.getData();
    this.currentFocusId = "";
    return this.setData({
      ...sourceData,
      centerNodeId,
      clearStatus: true,
      disableAnimate,
      preserveOrigin: true,
    });
  }

  focusNode(id) {
    const focused = this.focusViewportOnNode(id);
    if (!focused) return;
    this.selectNode(id, { emit: false });
  }

  focusViewportOnNode(id) {
    const node = this.nodes.find((item) => item.id === id);
    if (!node) return false;

    const rect = this.container.getBoundingClientRect();
    const size = getNodeSize(node);
    const position = this.getNodeAbsolutePosition(node);
    const zoom = Math.max(0.8, Math.min(1.25, this.viewport.zoom));
    this.viewport = {
      zoom,
      x: rect.width / 2 - (position.x + size.width / 2) * zoom,
      y: rect.height / 2 - (position.y + size.height / 2) * zoom,
    };
    this.applyViewport();
    return true;
  }

  selectNode(id, { emit = true } = {}) {
    const node = this.nodes.find((item) => item.id === id);
    if (!node) return null;
    this.setSelection({ nodes: [id], edges: [], primary: { type: "node", id } }, { emit });
    if (emit) this.handleNodeClick?.(node);
    return node;
  }

  getSelection() {
    return cloneSelection(this.selection);
  }

  setSelection(selection = {}, { emit = true, render = true } = {}) {
    const next = this.normalizeSelection(selection);
    const previous = this.selection;
    this.selection = next;
    this.selected = next.primary ? { ...next.primary } : null;
    if (render) this.renderSelection();
    if (emit && !areSelectionsEqual(previous, next)) {
      this.container.dispatchEvent(new CustomEvent("topo:selection-change", {
        detail: { selection: this.getSelection(), previous: cloneSelection(previous) },
        bubbles: true,
      }));
    }
    return this.getSelection();
  }

  toggleSelectionItem(item = {}, { emit = true } = {}) {
    if (item.type !== "node" && item.type !== "edge") return this.getSelection();
    const selection = this.getSelection();
    const collection = item.type === "node" ? selection.nodes : selection.edges;
    const index = collection.indexOf(item.id);
    if (index >= 0) collection.splice(index, 1);
    else collection.push(item.id);
    const primary = index >= 0 && selection.primary?.type === item.type && selection.primary?.id === item.id
      ? resolvePrimarySelection(selection)
      : { type: item.type, id: item.id };
    return this.setSelection({ ...selection, primary }, { emit });
  }

  clearSelection({ emit = true } = {}) {
    return this.setSelection({ nodes: [], edges: [], primary: null }, { emit });
  }

  selectArea(rect, { append = false, emit = true, includeEdges = true, edgeMode = "intersect" } = {}) {
    const normalizedRect = normalizeRect(rect);
    const selectedNodeIds = this.nodes
      .filter((node) => doesNodeRectIntersect(node, normalizedRect, (item) => this.getNodeAbsolutePosition(item)))
      .map((node) => node.id);
    const selectedEdgeIds = includeEdges
      ? this.getEdgesIntersectingRect(normalizedRect, selectedNodeIds, { edgeMode })
      : [];
    const base = append ? this.getSelection() : { nodes: [], edges: [], primary: null };
    const nodes = [...new Set([...base.nodes, ...selectedNodeIds])];
    const edges = [...new Set([...base.edges, ...selectedEdgeIds])];
    const primary = selectedNodeIds.length
      ? { type: "node", id: selectedNodeIds[0] }
      : selectedEdgeIds.length
        ? { type: "edge", id: selectedEdgeIds[0] }
        : resolvePrimarySelection({ nodes, edges }) || base.primary;
    const next = this.setSelection({ nodes, edges, primary }, { emit });
    this.container.dispatchEvent(new CustomEvent("topo:selection-area-end", {
      detail: { rect: normalizedRect, selection: next, nodeIds: selectedNodeIds, edgeIds: selectedEdgeIds },
      bubbles: true,
    }));
    return next;
  }

  selectVisible({ append = false, emit = true, includeEdges = true } = {}) {
    const visible = this.getVisibleGraphData();
    const base = append ? this.getSelection() : { nodes: [], edges: [], primary: null };
    const nodes = [...new Set([...base.nodes, ...visible.nodes.map((node) => node.id)])];
    const edges = includeEdges
      ? [...new Set([...base.edges, ...visible.edges.map((edge) => edge.id)])]
      : base.edges;
    return this.setSelection({
      nodes,
      edges,
      primary: resolvePrimarySelection({ nodes, edges }),
    }, { emit });
  }

  invertSelection({ scope = "visible", emit = true, includeEdges = true } = {}) {
    const candidates = scope === "all" ? this.getData() : this.getVisibleGraphData();
    const candidateNodeIds = new Set(candidates.nodes.map((node) => node.id));
    const candidateEdgeIds = new Set(includeEdges ? candidates.edges.map((edge) => edge.id) : []);
    const current = this.getSelection();
    const nodeIds = new Set(current.nodes);
    const edgeIds = new Set(current.edges);

    for (const id of candidateNodeIds) {
      if (nodeIds.has(id)) nodeIds.delete(id);
      else nodeIds.add(id);
    }
    for (const id of candidateEdgeIds) {
      if (edgeIds.has(id)) edgeIds.delete(id);
      else edgeIds.add(id);
    }
    if (scope === "all") {
      for (const id of current.nodes) if (!candidateNodeIds.has(id)) nodeIds.delete(id);
      for (const id of current.edges) if (!candidateEdgeIds.has(id)) edgeIds.delete(id);
    }

    const next = {
      nodes: [...nodeIds],
      edges: includeEdges ? [...edgeIds] : current.edges,
    };
    return this.setSelection({ ...next, primary: resolvePrimarySelection(next) }, { emit });
  }

  selectByCriteria(criteria = {}, { append = false, emit = true, visibleOnly = false, includeEdges = true } = {}) {
    if (!criteria || typeof criteria !== "object") return this.getSelection();
    const graph = visibleOnly ? this.getVisibleGraphData() : this.getData();
    const selectedNodeIds = graph.nodes
      .filter((node) => matchesSelectionCriteria(node, "node", criteria))
      .map((node) => node.id);
    const selectedNodeIdSet = new Set(selectedNodeIds);
    const explicitlySelectedEdgeIds = new Set(graph.edges
      .filter((edge) => matchesSelectionCriteria(edge, "edge", criteria))
      .map((edge) => edge.id));
    const selectedEdgeIds = includeEdges
      ? graph.edges
        .filter((edge) => explicitlySelectedEdgeIds.has(edge.id) || (selectedNodeIdSet.has(edge.source) && selectedNodeIdSet.has(edge.target)))
        .map((edge) => edge.id)
      : [...explicitlySelectedEdgeIds];
    const base = append ? this.getSelection() : { nodes: [], edges: [], primary: null };
    const nodes = [...new Set([...base.nodes, ...selectedNodeIds])];
    const edges = [...new Set([...base.edges, ...selectedEdgeIds])];
    return this.setSelection({
      nodes,
      edges,
      primary: resolvePrimarySelection({ nodes, edges }),
    }, { emit });
  }

  setSelectionMode(mode = "default") {
    const previous = this.selectionMode;
    this.selectionMode = mode === "area" ? "area" : "default";
    this.root?.classList.toggle("is-selection-mode-area", this.selectionMode === "area");
    if (previous !== this.selectionMode) {
      this.container.dispatchEvent(new CustomEvent("topo:selection-mode-change", {
        detail: { mode: this.selectionMode, previous },
        bubbles: true,
      }));
    }
    return this.selectionMode;
  }

  normalizeSelection(selection = {}) {
    const validNodeIds = new Set(this.nodes.map((node) => node.id));
    const validEdgeIds = new Set(this.edges.map((edge) => edge.id));
    const nodes = [...new Set(selection.nodes || [])].filter((id) => validNodeIds.has(id));
    const edges = [...new Set(selection.edges || [])].filter((id) => validEdgeIds.has(id));
    let primary = selection.primary || null;
    if (primary?.type === "node" && !validNodeIds.has(primary.id)) primary = null;
    if (primary?.type === "edge" && !validEdgeIds.has(primary.id)) primary = null;
    if (!primary) primary = resolvePrimarySelection({ nodes, edges });
    return { nodes, edges, primary };
  }

  pruneSelection({ emit = false } = {}) {
    return this.setSelection(this.selection, { emit, render: false });
  }

  selectGraphItem(type, id, event, item) {
    const additive = isAdditiveSelectionEvent(event);
    const selection = additive
      ? this.toggleSelectionItem({ type, id })
      : this.setSelection({
        nodes: type === "node" ? [id] : [],
        edges: type === "edge" ? [id] : [],
        primary: { type, id },
      });
    if (type === "node") this.handleNodeClick?.(item);
    if (type === "edge") this.handleEdgeClick?.(item);
    return selection;
  }

  getEdgesIntersectingRect(rect, selectedNodeIds = [], { edgeMode = "intersect" } = {}) {
    const selectedNodeIdSet = new Set(selectedNodeIds);
    return this.edges
      .filter((edge) => {
        const source = this.nodes.find((node) => node.id === edge.source);
        const target = this.nodes.find((node) => node.id === edge.target);
        if (!source || !target) return false;
        if (edgeMode === "connected") return selectedNodeIdSet.has(edge.source) && selectedNodeIdSet.has(edge.target);
        const sourceCenter = this.getNodeCenter(source);
        const targetCenter = this.getNodeCenter(target);
        return segmentIntersectsRect(sourceCenter, targetCenter, rect)
          || (selectedNodeIdSet.has(edge.source) && selectedNodeIdSet.has(edge.target));
      })
      .map((edge) => edge.id);
  }

  getNodeCenter(node) {
    const position = this.getNodeAbsolutePosition(node);
    const size = getNodeSize(node);
    return {
      x: position.x + size.width / 2,
      y: position.y + size.height / 2,
    };
  }

  getContextNodes() {
    return this.nodes.map((node) => ({
      ...cloneGraphItem(node),
      position: this.getNodeAbsolutePosition(node),
      measured: getNodeSize(node),
    }));
  }

  getVisibleGraphData(options = {}) {
    return getVisibleTopologyGraphData({
      nodes: this.getContextNodes(),
      edges: this.getEdges(),
      visibleRect: options.visibleRect || this.getVisibleGraphRect(),
    });
  }

  extractContext(options = {}) {
    const contextOptions = this.resolveContextOptions(options);
    const context = createTopologyContext({
      nodes: this.getContextNodes(),
      edges: this.getEdges(),
      selection: this.getSelection(),
      visibleRect: this.getVisibleGraphRect(),
      viewport: { ...this.viewport },
      source: {
        graphType: this.graphType,
        layout: this.layout.options.topoType || "dot",
      },
      options: contextOptions,
    });
    const result = serializeTopologyContext(context, { format: contextOptions.format || "json" });
    this.container.dispatchEvent(new CustomEvent("topo:context-extract", {
      detail: { context, format: contextOptions.format || "json" },
      bubbles: true,
    }));
    return result;
  }

  async copyContext(options = {}) {
    const contextOptions = this.resolveContextOptions(options);
    const context = createTopologyContext({
      nodes: this.getContextNodes(),
      edges: this.getEdges(),
      selection: this.getSelection(),
      visibleRect: this.getVisibleGraphRect(),
      viewport: { ...this.viewport },
      source: {
        graphType: this.graphType,
        layout: this.layout.options.topoType || "dot",
      },
      options: { ...contextOptions, format: "json" },
    });
    const text = options.text || formatTopologyContextAsMarkdown(context);
    let copied = false;
    let error = null;
    try {
      if (globalThis.navigator?.clipboard?.writeText) {
        await globalThis.navigator.clipboard.writeText(text);
        copied = true;
      }
    } catch (copyError) {
      error = copyError;
    }
    const detail = { copied, text, context, error };
    this.container.dispatchEvent(new CustomEvent("topo:context-copy", {
      detail,
      bubbles: true,
    }));
    return detail;
  }

  resolveContextOptions(options = {}) {
    if ((options.scope === "selected" || !options.scope) && !hasSelection(this.selection)) {
      return {
        ...options,
        scope: "visible",
        includeMode: "visible",
      };
    }
    return options;
  }

  zoomTo(zoom) {
    const rect = this.container.getBoundingClientRect();
    const nextZoom = clamp(zoom, 0.12, 2);
    const center = {
      x: (rect.width / 2 - this.viewport.x) / this.viewport.zoom,
      y: (rect.height / 2 - this.viewport.y) / this.viewport.zoom,
    };
    this.viewport = {
      zoom: nextZoom,
      x: rect.width / 2 - center.x * nextZoom,
      y: rect.height / 2 - center.y * nextZoom,
    };
    this.applyViewport();
  }

  getViewport() {
    return { ...this.viewport };
  }

  setViewport(viewport = {}) {
    this.viewport = {
      x: Number.isFinite(viewport.x) ? viewport.x : this.viewport.x,
      y: Number.isFinite(viewport.y) ? viewport.y : this.viewport.y,
      zoom: Number.isFinite(viewport.zoom) ? clamp(viewport.zoom, 0.12, 2) : this.viewport.zoom,
    };
    this.applyViewport();
  }

  fitCenter() {
    const bounds = this.getBounds();
    const rect = this.container.getBoundingClientRect();
    this.viewport.x = rect.width / 2 - (bounds.x + bounds.width / 2) * this.viewport.zoom;
    this.viewport.y = rect.height / 2 - (bounds.y + bounds.height / 2) * this.viewport.zoom;
    this.applyViewport();
  }

  fitView({ padding = 0.12, nodes } = {}) {
    const selectedNodes = nodes?.length
      ? this.nodes.filter((node) => nodes.some((item) => item.id === node.id))
      : this.nodes;
    const bounds = this.getBounds(selectedNodes);
    const rect = this.container.getBoundingClientRect();
    if (!bounds.width || !bounds.height || !rect.width || !rect.height) return;

    const paddedWidth = bounds.width * (1 + padding * 2);
    const paddedHeight = bounds.height * (1 + padding * 2);
    const zoom = clamp(Math.min(rect.width / paddedWidth, rect.height / paddedHeight), 0.12, 1.35);
    this.viewport = {
      zoom,
      x: rect.width / 2 - (bounds.x + bounds.width / 2) * zoom,
      y: rect.height / 2 - (bounds.y + bounds.height / 2) * zoom,
    };
    this.applyViewport();
  }

  scheduleViewportFit({ padding = 0.12, nodes, layoutVersion = this.layoutVersion } = {}) {
    if (this.viewportTimer) clearTimeout(this.viewportTimer);
    this.viewportTimer = window.setTimeout(() => {
      this.viewportTimer = null;
      if (layoutVersion !== this.layoutVersion) return;
      this.fitView({ padding, nodes });
    }, 60);
  }

  destroy() {
    if (this.edgeRenderFrame) cancelAnimationFrame(this.edgeRenderFrame);
    if (this.hoverRenderFrame) cancelAnimationFrame(this.hoverRenderFrame);
    if (this.minimapRenderFrame) cancelAnimationFrame(this.minimapRenderFrame);
    if (this.nodeAnimationFrame) cancelAnimationFrame(this.nodeAnimationFrame);
    if (this.nodeAnimationTimer) clearTimeout(this.nodeAnimationTimer);
    if (this.viewportTimer) clearTimeout(this.viewportTimer);
    document.removeEventListener("fullscreenchange", this.handleFullscreenChange);
    document.removeEventListener("keydown", this.handleKeydown);
    this.nodeElementById.clear();
    this.edgeElementById.clear();
    this.container.innerHTML = "";
  }

  isFullscreen() {
    return this.fullscreenFallback || document.fullscreenElement === this.root || this.root?.classList.contains("is-fullscreen");
  }

  async setFullscreen(enabled) {
    const shouldEnable = Boolean(enabled);
    if (shouldEnable) {
      this.fullscreenFallback = false;
      if (this.root.requestFullscreen && !document.fullscreenElement) {
        try {
          await this.root.requestFullscreen();
        } catch {
          this.fullscreenFallback = true;
        }
      } else {
        this.fullscreenFallback = true;
      }
    } else {
      this.fullscreenFallback = false;
      if (document.fullscreenElement === this.root && document.exitFullscreen) {
        try {
          await document.exitFullscreen();
        } catch {
          this.fullscreenFallback = false;
        }
      }
    }
    this.syncFullscreenState();
    window.setTimeout(() => this.fitView({ padding: this.fitViewPadding }), 80);
    return this.isFullscreen();
  }

  toggleFullscreen() {
    return this.setFullscreen(!this.isFullscreen());
  }

  syncFullscreenState() {
    const enabled = this.fullscreenFallback || document.fullscreenElement === this.root;
    this.root?.classList.toggle("is-fullscreen", enabled);
    this.container.dispatchEvent(new CustomEvent("topo:fullscreen", {
      detail: { enabled },
      bubbles: true,
    }));
  }

  buildShell(style, className) {
    this.container.innerHTML = "";
    this.root = document.createElement("div");
    this.root.className = `new-topo-graph ${className}`.trim();
    this.root.classList.toggle("has-grid", this.gridVisible);
    Object.assign(this.root.style, style);

    this.viewportEl = document.createElement("div");
    this.viewportEl.className = "topo-viewport";

    this.svg = document.createElementNS(SVG_NS, "svg");
    this.svg.classList.add("topo-svg");
    this.edgeLayer = document.createElementNS(SVG_NS, "g");
    this.svg.appendChild(this.edgeLayer);

    this.nodeLayer = document.createElement("div");
    this.nodeLayer.className = "topo-node-layer";

    this.minimap = document.createElement("div");
    this.minimap.className = "topo-minimap";
    this.minimap.title = "Global navigation";
    this.minimap.style.width = `${this.minimapWidth}px`;
    this.minimap.style.height = `${this.minimapHeight}px`;

    this.minimapSvg = document.createElementNS(SVG_NS, "svg");
    this.minimapSvg.classList.add("topo-minimap-svg");
    this.minimap.appendChild(this.minimapSvg);

    this.debugPanel = document.createElement("div");
    this.debugPanel.className = "topo-debug-panel";
    this.debugPanel.hidden = !this.debugPanelEnabled;

    this.selectionMarquee = document.createElement("div");
    this.selectionMarquee.className = "topo-selection-marquee";
    this.selectionMarquee.hidden = true;

    this.viewportEl.append(this.svg, this.nodeLayer);
    this.root.append(this.viewportEl, this.selectionMarquee, this.minimap, this.debugPanel);
    this.root.classList.toggle("has-minimap", this.minimapEnabled);
    this.root.classList.toggle("has-debug-panel", this.debugPanelEnabled);
    this.root.classList.toggle("is-selection-mode-area", this.selectionMode === "area");
    this.container.append(this.root);
    this.bindMinimapEvents();
    this.renderDebugPanel();
  }

  bindCanvasEvents() {
    let dragging = false;
    let areaDragging = false;
    let start = null;

    this.root.addEventListener("pointerdown", (event) => {
      if (event.target.closest(".topo-node") || event.target.closest(".topo-edge-hit")) return;
      if (this.shouldStartAreaSelection(event)) {
        areaDragging = true;
        start = {
          x: event.clientX,
          y: event.clientY,
          append: isAdditiveSelectionEvent(event),
        };
        this.areaSelection = start;
        this.root.setPointerCapture(event.pointerId);
        this.root.classList.add("is-area-selecting");
        this.updateSelectionMarquee(start, event);
        this.container.dispatchEvent(new CustomEvent("topo:selection-area-start", {
          detail: { point: this.toGraphPoint(event.clientX, event.clientY) },
          bubbles: true,
        }));
        this.handleCloseInfo?.();
        return;
      }
      dragging = true;
      start = { x: event.clientX, y: event.clientY, vx: this.viewport.x, vy: this.viewport.y };
      this.root.setPointerCapture(event.pointerId);
      this.root.classList.add("is-panning");
      this.handleCloseInfo?.();
    });

    this.root.addEventListener("pointermove", (event) => {
      if (areaDragging && start) {
        this.updateSelectionMarquee(start, event);
        return;
      }
      if (!dragging || !start) return;
      this.viewport.x = start.vx + event.clientX - start.x;
      this.viewport.y = start.vy + event.clientY - start.y;
      this.applyViewport();
    });

    const endDrag = (event) => {
      if (areaDragging && start) {
        const rect = this.getGraphRectFromClientPoints(start, event);
        const append = start.append;
        const cancelled = this.areaSelection?.cancelled;
        areaDragging = false;
        this.areaSelection = null;
        start = null;
        this.hideSelectionMarquee();
        this.root.classList.remove("is-area-selecting");
        try {
          this.root.releasePointerCapture(event.pointerId);
        } catch {
          // Pointer capture can already be released.
        }
        if (!cancelled) this.selectArea(rect, { append });
        return;
      }
      if (!dragging) return;
      dragging = false;
      start = null;
      try {
        this.root.releasePointerCapture(event.pointerId);
      } catch {
        // Pointer capture can already be released.
      }
      this.root.classList.remove("is-panning");
    };

    this.root.addEventListener("pointerup", endDrag);
    this.root.addEventListener("pointercancel", endDrag);

    this.root.addEventListener("wheel", (event) => {
      event.preventDefault();
      const delta = event.deltaY > 0 ? -0.08 : 0.08;
      this.zoomTo(this.viewport.zoom + delta);
    }, { passive: false });
  }

  shouldStartAreaSelection(event) {
    return this.selectionMode === "area" || event.shiftKey;
  }

  updateSelectionMarquee(start, event) {
    if (!this.selectionMarquee) return;
    const rect = this.root.getBoundingClientRect();
    const left = Math.min(start.x, event.clientX) - rect.left;
    const top = Math.min(start.y, event.clientY) - rect.top;
    const width = Math.abs(event.clientX - start.x);
    const height = Math.abs(event.clientY - start.y);
    Object.assign(this.selectionMarquee.style, {
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      height: `${height}px`,
    });
    this.selectionMarquee.hidden = false;
  }

  hideSelectionMarquee() {
    if (!this.selectionMarquee) return;
    this.selectionMarquee.hidden = true;
    Object.assign(this.selectionMarquee.style, {
      left: "0px",
      top: "0px",
      width: "0px",
      height: "0px",
    });
  }

  getGraphRectFromClientPoints(start, event) {
    const a = this.toGraphPoint(start.x, start.y);
    const b = this.toGraphPoint(event.clientX, event.clientY);
    return normalizeRect({
      x: Math.min(a.x, b.x),
      y: Math.min(a.y, b.y),
      width: Math.abs(b.x - a.x),
      height: Math.abs(b.y - a.y),
    });
  }

  toGraphPoint(clientX, clientY) {
    const rect = this.container.getBoundingClientRect();
    return {
      x: (clientX - rect.left - this.viewport.x) / this.viewport.zoom,
      y: (clientY - rect.top - this.viewport.y) / this.viewport.zoom,
    };
  }

  handleGraphKeydown(event) {
    if (event.key !== "Escape") return;
    if (isEditableTarget(event.target)) return;
    if (this.areaSelection) {
      this.areaSelection.cancelled = true;
      this.hideSelectionMarquee();
      this.root?.classList.remove("is-area-selecting");
      return;
    }
    if (this.selection.nodes.length || this.selection.edges.length) this.clearSelection();
  }

  bindMinimapEvents() {
    let dragging = false;

    const start = (event) => {
      if (!this.minimapEnabled || !this.nodes.length) return;
      event.preventDefault();
      event.stopPropagation();
      dragging = true;
      this.isMinimapDragging = true;
      this.minimap.setPointerCapture(event.pointerId);
      this.minimap.classList.add("is-dragging");
      this.navigateFromMinimap(event);
    };

    const move = (event) => {
      if (!dragging) return;
      event.preventDefault();
      event.stopPropagation();
      this.navigateFromMinimap(event);
    };

    const end = (event) => {
      if (!dragging) return;
      event.preventDefault();
      event.stopPropagation();
      dragging = false;
      this.isMinimapDragging = false;
      this.minimap.classList.remove("is-dragging");
      try {
        this.minimap.releasePointerCapture(event.pointerId);
      } catch {
        // Pointer capture can already be released by the browser.
      }
    };

    this.minimap.addEventListener("pointerdown", start);
    this.minimap.addEventListener("pointermove", move);
    this.minimap.addEventListener("pointerup", end);
    this.minimap.addEventListener("pointercancel", end);
    this.minimap.addEventListener("wheel", (event) => event.stopPropagation(), { passive: true });
  }

  navigateFromMinimap(event) {
    const transform = this.getMinimapTransform();
    if (!transform) return;

    const rect = this.minimap.getBoundingClientRect();
    const graphPoint = {
      x: transform.bounds.x + (event.clientX - rect.left - transform.offsetX) / transform.scale,
      y: transform.bounds.y + (event.clientY - rect.top - transform.offsetY) / transform.scale,
    };
    const hostRect = this.container.getBoundingClientRect();
    this.viewport = {
      ...this.viewport,
      x: hostRect.width / 2 - graphPoint.x * this.viewport.zoom,
      y: hostRect.height / 2 - graphPoint.y * this.viewport.zoom,
    };
    this.applyViewport();
  }

  renderDebugPanel() {
    if (!this.debugPanel || !this.debugPanelEnabled) return;
    const stats = this.lastRenderStats || {};
    const metrics = this.debugMetrics || {};
    const validation = stats.validation || metrics.lastValidation || null;
    const rows = [
      ["connection", metrics.connectionStatus || metrics.status || "-"],
      ["messageRate", formatDebugValue(metrics.messageRate, "/s")],
      ["queue", metrics.queueSize ?? metrics.lastQueueSize ?? "-"],
      ["version", metrics.currentGraphVersion ?? metrics.snapshotVersion ?? metrics.version ?? "-"],
      ["flush", formatDebugValue(metrics.flushDuration, "ms")],
      ["layout", formatDebugValue(stats.layoutMeta?.durationMs ?? stats.layoutDurationMs ?? stats.durationMs, "ms")],
      ["render", formatDebugValue(stats.durationMs, "ms")],
      ["patch", formatDebugValue(stats.patchDurationMs, "ms")],
      ["dropped", metrics.droppedUpdates ?? metrics.droppedMessages ?? "-"],
      ["worker", stats.layoutMeta?.worker === true ? "on" : stats.layoutMeta?.fallbackReason ? "fallback" : "off"],
      ["validation", validation ? formatValidationSummary(validation) : "-"],
    ];
    const recentErrors = metrics.lastErrors || validation?.errors || [];
    this.debugPanel.innerHTML = `
      <div class="topo-debug-title">Realtime Debug</div>
      <div class="topo-debug-grid">
        ${rows.map(([label, value]) => `
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(value)}</strong>
        `).join("")}
      </div>
      ${recentErrors.length ? `<div class="topo-debug-errors">${escapeHtml(recentErrors.slice(-2).join(" | "))}</div>` : ""}
    `;
  }

  render() {
    this.root.classList.toggle("no-animate", !this.animate);
    this.root.classList.toggle("is-performance", this.performanceMode);
    this.renderNodes();
    this.renderEdges();
    this.applyViewport();
  }

  renderNodeUpdates(ids = []) {
    this.renderNodes(ids);
  }

  renderNodes(nodeIds = null) {
    const targetIds = nodeIds == null ? null : new Set(nodeIds);
    const isPartialRender = Boolean(targetIds);
    if (!isPartialRender) {
      if (this.nodeAnimationFrame) cancelAnimationFrame(this.nodeAnimationFrame);
      if (this.nodeAnimationTimer) clearTimeout(this.nodeAnimationTimer);
      const nextIds = new Set(this.nodes.map((node) => node.id));
      for (const [id, element] of this.nodeElementById.entries()) {
        if (nextIds.has(id)) continue;
        element.remove();
        this.nodeElementById.delete(id);
      }
    }

    const animation = isPartialRender ? null : this.pendingNodeAnimation;
    const animatedElements = [];
    for (const node of this.nodes) {
      if (targetIds && !targetIds.has(node.id)) continue;
      const type = this.resolveNodeType(node);
      const isGroupNode = isParentNode(node, type);
      const tagName = isGroupNode ? "DIV" : "BUTTON";
      let element = this.nodeElementById.get(node.id);
      if (!element || element.tagName !== tagName) {
        element?.remove();
        element = this.createNodeElement(node, type, isGroupNode);
        this.nodeElementById.set(node.id, element);
      }
      element.__topoNode = node;
      if (!isPartialRender && this.nodeLayer.lastChild !== element) this.nodeLayer.appendChild(element);
      else if (!element.parentNode) this.nodeLayer.appendChild(element);
      const sizeChanged = this.updateNodeElement(element, node, { type, isGroupNode, animation, animatedElements });
      if (sizeChanged) {
        const connectedEdgeIds = this.getConnectedEdgeIds([node.id]);
        if (connectedEdgeIds.length) this.renderEdges(connectedEdgeIds);
        this.scheduleMinimapRender();
      }
    }
    if (animatedElements.length) this.playNodeAnimation(animatedElements, animation);
    if (!isPartialRender) this.pendingNodeAnimation = null;
    this.renderSelection();
    this.renderHoverHighlight();
  }

  createNodeElement(node, type, isGroupNode) {
    const element = document.createElement(isGroupNode ? "div" : "button");
    if (!isGroupNode) element.type = "button";
    element.dataset.nodeId = node.id;
    element.dataset.nodeType = type;
    element.addEventListener("pointerdown", (event) => {
      const currentNode = element.__topoNode;
      if (!currentNode) return;
      if (isParentNode(currentNode, this.resolveNodeType(currentNode))) return;
      this.startNodeDrag(event, currentNode, element);
    });
    element.addEventListener("pointerenter", () => this.activateHoverHighlight(element.dataset.nodeId));
    element.addEventListener("pointerleave", () => this.clearHoverHighlight());
    element.addEventListener("click", (event) => {
      const currentNode = element.__topoNode;
      if (!currentNode) return;
      const currentType = this.resolveNodeType(currentNode);
      event.stopPropagation();
      if (currentNode.data?.action?.disableClick || isParentNode(currentNode, currentType)) {
        this.handleCloseInfo?.();
        return;
      }
      if (this.suppressNodeClick === currentNode.id) {
        this.suppressNodeClick = null;
        return;
      }
      this.selectGraphItem("node", currentNode.id, event, currentNode);
    });
    return element;
  }

  updateNodeElement(element, node, { type, isGroupNode, animation, animatedElements }) {
    const size = getNodeBaseSize(node);
    const status = node.data?.status || "ok";
    const position = this.getNodeAbsolutePosition(node);
    element.className = `topo-node ${type} status-${status}`;
    element.dataset.nodeId = node.id;
    element.dataset.nodeType = type;
    element.style.width = `${size.width}px`;
    element.style.height = `${size.height}px`;
    element.style.opacity = "";
    element.style.setProperty("--node-accent", node.data?.color || getDomainColor(node.data?.domain, status));
    element.classList.toggle("is-static", node.draggable === false || isGroupNode);

    const startPosition = animation?.from.get(node.id);
    const canAnimateNode = Boolean(animation && (startPosition || animation.enterFrom));
    element.classList.remove("is-animating", "is-entering");
    element.style.transform = startPosition
      ? `translate(${startPosition.x}px, ${startPosition.y}px)`
      : `translate(${position.x}px, ${position.y}px)`;
    if (canAnimateNode && !startPosition) {
      element.style.opacity = "0";
      element.style.transform = `translate(${animation.enterFrom.x}px, ${animation.enterFrom.y}px) scale(0.94)`;
    }
    if (canAnimateNode) {
      element.classList.add(startPosition ? "is-animating" : "is-entering");
      animatedElements.push({ element, position, hasStart: Boolean(startPosition) });
    }

    element.innerHTML = renderNodeContent(node, type);
    if (this.isAgentLoop() && isAgentLoopDeletableNode(node, type)) {
      const deleteControl = document.createElement("span");
      deleteControl.className = "agent-node-delete";
      deleteControl.title = "Delete node";
      deleteControl.textContent = "×";
      deleteControl.addEventListener("pointerdown", (event) => event.stopPropagation());
      deleteControl.addEventListener("click", (event) => {
        event.stopPropagation();
        this.deleteNode(node.id);
      });
      element.appendChild(deleteControl);
    }
    return isGroupNode ? this.clearMeasuredNodeSize(node, size) : this.syncRenderedNodeSize(element, node, size);
  }

  syncRenderedNodeSize(element, node, baseSize) {
    const measuredWidth = Math.max(Number(baseSize.width) || 0, Math.ceil(element.scrollWidth));
    const measuredHeight = Math.max(Number(baseSize.height) || 0, Math.ceil(element.scrollHeight));
    const nextSize = {
      width: measuredWidth,
      height: measuredHeight,
    };
    const previousSize = node.__topoMeasuredSize || baseSize;
    const changed = Math.abs((Number(previousSize.width) || 0) - nextSize.width) >= 1
      || Math.abs((Number(previousSize.height) || 0) - nextSize.height) >= 1;
    const needsMeasuredSize = measuredWidth > (Number(baseSize.width) || 0)
      || measuredHeight > (Number(baseSize.height) || 0);

    if (needsMeasuredSize) {
      Object.defineProperty(node, "__topoMeasuredSize", {
        configurable: true,
        enumerable: false,
        writable: true,
        value: nextSize,
      });
      element.style.width = `${nextSize.width}px`;
      element.style.height = `${nextSize.height}px`;
      return changed;
    }

    return this.clearMeasuredNodeSize(node, baseSize) || changed;
  }

  clearMeasuredNodeSize(node, baseSize = getNodeBaseSize(node)) {
    const previousSize = node.__topoMeasuredSize;
    if (!previousSize) return false;
    delete node.__topoMeasuredSize;
    return Math.abs((Number(previousSize.width) || 0) - (Number(baseSize.width) || 0)) >= 1
      || Math.abs((Number(previousSize.height) || 0) - (Number(baseSize.height) || 0)) >= 1;
  }

  renderEdgeUpdates(ids = []) {
    this.renderEdges(ids);
  }

  getConnectedEdgeIds(nodeIds = []) {
    const idSet = nodeIds instanceof Set ? nodeIds : new Set(nodeIds);
    if (!idSet.size) return [];
    return this.edges
      .filter((edge) => idSet.has(edge.source) || idSet.has(edge.target))
      .map((edge) => edge.id);
  }

  renderEdges(edgeIds = null) {
    this.ensureEdgeDefs();
    const targetIds = edgeIds == null ? null : new Set(edgeIds);
    const isPartialRender = Boolean(targetIds);
    const nextIds = new Set(this.edges.map((edge) => edge.id));
    if (!isPartialRender) {
      for (const [id, element] of this.edgeElementById.entries()) {
        if (nextIds.has(id)) continue;
        element.remove();
        this.edgeElementById.delete(id);
      }
    }

    const nodeById = new Map(this.nodes.map((node) => [node.id, node]));
    const edgeById = new Map(this.edges.map((edge) => [edge.id, edge]));
    const shouldRenderLabel = this.edgeLabelsVisible && !(this.performanceMode && this.edges.length > this.performanceEdgeLabelLimit);
    const targetEdges = targetIds
      ? [...targetIds].map((id) => edgeById.get(id)).filter(Boolean)
      : this.edges;

    for (const id of targetIds || []) {
      if (edgeById.has(id)) continue;
      this.edgeElementById.get(id)?.remove();
      this.edgeElementById.delete(id);
    }

    for (const edge of targetEdges) {
      const previousElement = this.edgeElementById.get(edge.id);
      previousElement?.remove();
      const element = this.createEdgeElement(edge, nodeById, shouldRenderLabel);
      if (!element) {
        this.edgeElementById.delete(edge.id);
        continue;
      }
      this.edgeElementById.set(edge.id, element);
      this.edgeLayer.appendChild(element);
    }
    this.renderSelection();
    this.renderHoverHighlight();
  }

  ensureEdgeDefs() {
    if (this.edgeDefs?.parentNode === this.edgeLayer) return;
    this.edgeDefs = document.createElementNS(SVG_NS, "defs");
    this.edgeDefs.innerHTML = `<marker id="${this.edgeMarkerId}" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L0,6 L9,3 z" fill="currentColor"></path></marker>`;
    this.edgeLayer.prepend(this.edgeDefs);
  }

  createEdgeElement(edge, nodeById, shouldRenderLabel) {
    const source = nodeById.get(edge.source);
    const target = nodeById.get(edge.target);
    if (!source || !target) return null;
    const edgeType = this.resolveEdgeType(edge);
    const edgeShape = getEdgeShape(edgeType);
    const path = buildEdgePath(
      this.getRenderedNode(source),
      this.getRenderedNode(target),
      this.layout.options.rankDir || "LR",
      edge,
    );

    const group = document.createElementNS(SVG_NS, "g");
    group.classList.add("topo-edge");
    group.dataset.edgeId = edge.id;
    group.dataset.edgeType = edgeType;
    group.__topoEdge = edge;
    if (edgeShape?.className) group.classList.add(...toClassList(edgeShape.className));
    if ((edge.data?.parallelTotal || 1) > 1) {
      group.classList.add("is-parallel-edge");
      group.dataset.parallelTotal = String(edge.data.parallelTotal);
    }

    const visible = document.createElementNS(SVG_NS, "path");
    visible.setAttribute("d", path.d);
    visible.classList.add("topo-edge-path", `status-${edge.data?.status || "ok"}`);
    if (edgeShape?.pathClassName) visible.classList.add(...toClassList(edgeShape.pathClassName));
    const markerEnd = edgeShape?.markerEnd === false ? "" : edgeShape?.markerEnd || `url(#${this.edgeMarkerId})`;
    if (markerEnd) visible.setAttribute("marker-end", markerEnd);
    applySvgAttributes(visible, edgeShape?.pathAttributes, edge);

    const hit = document.createElementNS(SVG_NS, "path");
    hit.setAttribute("d", path.d);
    hit.classList.add("topo-edge-hit");
    hit.addEventListener("click", (event) => {
      const currentEdge = group.__topoEdge || edge;
      event.stopPropagation();
      this.selectGraphItem("edge", currentEdge.id, event, currentEdge);
    });

    group.append(visible, hit);
    const edgeLabel = typeof edgeShape?.labelFormatter === "function"
      ? edgeShape.labelFormatter(edge)
      : edge.label;
    if (edgeLabel && shouldRenderLabel) {
      const label = document.createElementNS(SVG_NS, "text");
      label.classList.add("topo-edge-label");
      label.setAttribute("x", String(path.label.x));
      label.setAttribute("y", String(path.label.y));
      label.textContent = edgeLabel;
      group.appendChild(label);
    }
    if (this.isAgentLoop()) {
      group.appendChild(this.createAgentEdgeAction(edge, path));
    }
    return group;
  }

  createAgentEdgeAction(edge, path) {
    const action = document.createElementNS(SVG_NS, "g");
    action.classList.add("topo-edge-add");
    action.dataset.edgeId = edge.id;
    action.setAttribute("transform", `translate(${path.label.x}, ${path.label.y + 20})`);
    action.setAttribute("tabindex", "0");
    action.setAttribute("role", "button");
    action.setAttribute("aria-label", "Add operator");

    const circle = document.createElementNS(SVG_NS, "circle");
    circle.setAttribute("r", "12");
    circle.classList.add("topo-edge-add-circle");

    const text = document.createElementNS(SVG_NS, "text");
    text.classList.add("topo-edge-add-text");
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("dominant-baseline", "central");
    text.textContent = "+";

    const handleAdd = async (event) => {
      event.stopPropagation();
      const customNode = await this.renderAddNodeModal?.({
        edge: cloneGraphItem(edge),
        graph: this.getGraph(),
      });
      if (customNode === false) return;
      await this.insertNodeOnEdge(edge.id, customNode || undefined);
    };

    action.append(circle, text);
    action.addEventListener("click", handleAdd);
    circle.addEventListener("click", handleAdd);
    action.addEventListener("keydown", async (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      await this.insertNodeOnEdge(edge.id);
    });
    return action;
  }

  async insertNodeOnEdge(edgeId, node = {}, { centerNodeId } = {}) {
    const edge = this.edges.find((item) => item.id === edgeId);
    if (!edge) return null;

    const nextNode = this.createAgentLoopNode(edge, node);
    const sourceEdge = {
      ...cloneGraphItem(edge),
      id: `${edge.id}:to:${nextNode.id}`,
      target: nextNode.id,
      label: edge.data?.sourceLabel || "输入",
      data: {
        ...edge.data,
        status: edge.data?.status || "ok",
      },
    };
    const targetEdge = {
      ...cloneGraphItem(edge),
      id: `${nextNode.id}:to:${edge.target}`,
      source: nextNode.id,
      label: edge.data?.targetLabel || edge.label || "输出",
      data: {
        ...edge.data,
        status: edge.data?.status || "ok",
      },
    };
    const nodes = [...this.getNodes(), nextNode];
    const edges = this.getEdges().filter((item) => item.id !== edgeId).concat(sourceEdge, targetEdge);
    await this.setData({ nodes, edges, centerNodeId: centerNodeId || nextNode.id, clearStatus: true });
    this.container.dispatchEvent(new CustomEvent("topo:agentloop-insert", {
      detail: { edgeId, node: cloneGraphItem(nextNode), edges: [sourceEdge, targetEdge] },
      bubbles: true,
    }));
    return nextNode;
  }

  async deleteNode(id, { reconnect = true, centerNodeId } = {}) {
    const node = this.nodes.find((item) => item.id === id);
    if (!node) return null;
    const incoming = this.edges.filter((edge) => edge.target === id);
    const outgoing = this.edges.filter((edge) => edge.source === id);
    const nextNodes = this.getNodes().filter((item) => item.id !== id);
    const nextEdges = this.getEdges().filter((edge) => edge.source !== id && edge.target !== id);

    if (reconnect && incoming.length === 1 && outgoing.length === 1 && incoming[0].source !== outgoing[0].target) {
      nextEdges.push({
        id: `reconnect:${incoming[0].source}:to:${outgoing[0].target}:${this.agentLoopInsertCount}`,
        source: incoming[0].source,
        target: outgoing[0].target,
        label: outgoing[0].label || incoming[0].label || "连接",
        data: {
          ...outgoing[0].data,
          status: maxEdgeStatus([incoming[0], outgoing[0]]),
        },
      });
    }

    this.onDeleteNode?.(cloneGraphItem(node), { graph: this.getGraph() });
    await this.setData({ nodes: nextNodes, edges: nextEdges, centerNodeId, clearStatus: true });
    this.container.dispatchEvent(new CustomEvent("topo:agentloop-delete", {
      detail: { node: cloneGraphItem(node) },
      bubbles: true,
    }));
    return node;
  }

  createAgentLoopNode(edge, node = {}) {
    this.agentLoopInsertCount += 1;
    const id = node.id || `operator-${this.agentLoopInsertCount}`;
    return {
      id,
      type: node.type || "operatorNode",
      ...node,
      data: {
        title: "新增算子",
        subTitle: edge.label ? `插入 ${edge.label}` : "Agent step",
        icon: "OP",
        domain: "operator",
        group: "compute",
        status: "ok",
        color: "#0891b2",
        metric: { label: "输入", value: "1" },
        size: { width: 200, height: 78 },
        ...node.data,
      },
    };
  }

  startNodeDrag(event, node, element) {
    if (!this.nodeDraggable || event.button !== 0 || node.draggable === false || node.data?.isParent) return;
    event.stopPropagation();
    const startPosition = this.getNodeAbsolutePosition(node);
    const start = {
      clientX: event.clientX,
      clientY: event.clientY,
      nodeX: startPosition.x,
      nodeY: startPosition.y,
      moved: false,
    };

    const move = (moveEvent) => {
      const dx = (moveEvent.clientX - start.clientX) / this.viewport.zoom;
      const dy = (moveEvent.clientY - start.clientY) / this.viewport.zoom;
      if (!start.moved && Math.hypot(dx, dy) < 3) return;
      start.moved = true;
      const nextAbsolutePosition = {
        x: Math.round(start.nodeX + dx),
        y: Math.round(start.nodeY + dy),
      };
      node.position = this.toStoredNodePosition(node, nextAbsolutePosition);
      const renderPosition = this.getNodeAbsolutePosition(node);
      element.classList.add("is-dragging");
      this.root.classList.add("is-node-dragging");
      element.style.transform = `translate(${renderPosition.x}px, ${renderPosition.y}px)`;
      this.scheduleEdgeRender();
      this.scheduleMinimapRender();
    };

    const end = (endEvent) => {
      element.removeEventListener("pointermove", move);
      element.removeEventListener("pointerup", end);
      element.removeEventListener("pointercancel", end);
      try {
        element.releasePointerCapture(endEvent.pointerId);
      } catch {
        // Pointer capture can already be released by the browser on cancellation.
      }
      element.classList.remove("is-dragging");
      this.root.classList.remove("is-node-dragging");

      if (!start.moved) return;
      this.suppressNodeClick = node.id;
      window.setTimeout(() => {
        if (this.suppressNodeClick === node.id) this.suppressNodeClick = null;
      }, 0);
      this.renderEdges();
      this.setSelection({ nodes: [node.id], edges: [], primary: { type: "node", id: node.id } });
      this.handleNodeClick?.(node);
      this.container.dispatchEvent(new CustomEvent("topo:node-drag", {
        detail: { node: { ...cloneGraphItem(node), positionAbsolute: this.getNodeAbsolutePosition(node) } },
        bubbles: true,
      }));
    };

    element.addEventListener("pointermove", move);
    element.addEventListener("pointerup", end);
    element.addEventListener("pointercancel", end);
    try {
      element.setPointerCapture(event.pointerId);
    } catch {
      // Non-primary pointers may not allow capture in every browser.
    }
  }

  scheduleEdgeRender() {
    if (this.edgeRenderFrame) return;
    this.edgeRenderFrame = requestAnimationFrame(() => {
      this.edgeRenderFrame = null;
      this.renderEdges();
    });
  }

  activateHoverHighlight(nodeId) {
    if (!this.hoverHighlight || this.performanceMode && this.nodes.length + this.edges.length > 8000) return;
    this.hoverState = this.computeHoverHighlight(nodeId, this.effectiveHoverHighlightDegree ?? this.hoverHighlightDegree);
    this.scheduleHoverRender();
  }

  clearHoverHighlight() {
    if (!this.hoverState) return;
    this.hoverState = null;
    this.scheduleHoverRender();
  }

  computeHoverHighlight(nodeId, degree = 1) {
    const relatedNodes = new Set([nodeId]);
    const relatedEdges = new Set();
    let frontier = new Set([nodeId]);
    const maxDegree = Math.max(0, Number(degree) || 0);

    for (let level = 0; level < maxDegree && frontier.size; level += 1) {
      const next = new Set();
      for (const edge of this.edges) {
        const touchesFrontier = frontier.has(edge.source) || frontier.has(edge.target);
        if (!touchesFrontier) continue;
        relatedEdges.add(edge.id);
        if (!relatedNodes.has(edge.source)) next.add(edge.source);
        if (!relatedNodes.has(edge.target)) next.add(edge.target);
        relatedNodes.add(edge.source);
        relatedNodes.add(edge.target);
      }
      frontier = next;
    }

    return { nodeId, relatedNodes, relatedEdges };
  }

  scheduleHoverRender() {
    if (this.hoverRenderFrame) return;
    this.hoverRenderFrame = requestAnimationFrame(() => {
      this.hoverRenderFrame = null;
      this.renderHoverHighlight();
    });
  }

  scheduleMinimapRender() {
    if (!this.minimapSvg || this.minimapRenderFrame) return;
    this.minimapRenderFrame = requestAnimationFrame(() => {
      this.minimapRenderFrame = null;
      this.renderMinimap();
    });
  }

  renderMinimap() {
    if (!this.minimapSvg) return;
    this.minimapSvg.innerHTML = "";
    this.root.classList.toggle("has-minimap", this.minimapEnabled);
    if (!this.minimapEnabled || !this.nodes.length) return;

    const transform = this.getMinimapTransform();
    if (!transform) return;

    const { width, height, scale, offsetX, offsetY, bounds } = transform;
    this.minimapSvg.setAttribute("viewBox", `0 0 ${width} ${height}`);

    const defs = document.createElementNS(SVG_NS, "defs");
    defs.innerHTML = `<filter id="${this.minimapShadowId}" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="1" stdDeviation="1.2" flood-color="#0f172a" flood-opacity="0.12"/></filter>`;
    this.minimapSvg.appendChild(defs);

    const nodeById = new Map(this.nodes.map((node) => [node.id, node]));
    if (this.edges.length <= this.minimapEdgeLimit) {
      const edgeLayer = document.createElementNS(SVG_NS, "g");
      edgeLayer.classList.add("topo-minimap-edges");
      for (const edge of this.edges) {
        const source = nodeById.get(edge.source);
        const target = nodeById.get(edge.target);
        if (!source || !target) continue;
      const sourceSize = getNodeSize(source);
      const targetSize = getNodeSize(target);
      const sourcePosition = this.getNodeAbsolutePosition(source);
      const targetPosition = this.getNodeAbsolutePosition(target);
      const line = document.createElementNS(SVG_NS, "line");
      line.classList.add("topo-minimap-edge");
      line.setAttribute("x1", String(offsetX + (sourcePosition.x + sourceSize.width / 2 - bounds.x) * scale));
      line.setAttribute("y1", String(offsetY + (sourcePosition.y + sourceSize.height / 2 - bounds.y) * scale));
      line.setAttribute("x2", String(offsetX + (targetPosition.x + targetSize.width / 2 - bounds.x) * scale));
      line.setAttribute("y2", String(offsetY + (targetPosition.y + targetSize.height / 2 - bounds.y) * scale));
        edgeLayer.appendChild(line);
      }
      this.minimapSvg.appendChild(edgeLayer);
    }

    const nodeLayer = document.createElementNS(SVG_NS, "g");
    nodeLayer.classList.add("topo-minimap-nodes");
    for (const node of this.nodes) {
      const size = getNodeSize(node);
      const position = this.getNodeAbsolutePosition(node);
      const rect = document.createElementNS(SVG_NS, "rect");
      rect.classList.add("topo-minimap-node");
      rect.setAttribute("x", String(offsetX + (position.x - bounds.x) * scale));
      rect.setAttribute("y", String(offsetY + (position.y - bounds.y) * scale));
      rect.setAttribute("width", String(Math.max(2, size.width * scale)));
      rect.setAttribute("height", String(Math.max(2, size.height * scale)));
      rect.setAttribute("rx", "1.5");
      rect.setAttribute("fill", node.data?.color || getDomainColor(node.data?.domain, node.data?.status || "ok"));
      rect.setAttribute("filter", `url(#${this.minimapShadowId})`);
      nodeLayer.appendChild(rect);
    }
    this.minimapSvg.appendChild(nodeLayer);

    const viewport = this.getVisibleGraphRect();
    const viewportRect = document.createElementNS(SVG_NS, "rect");
    viewportRect.classList.add("topo-minimap-viewport");
    viewportRect.setAttribute("x", String(offsetX + (viewport.x - bounds.x) * scale));
    viewportRect.setAttribute("y", String(offsetY + (viewport.y - bounds.y) * scale));
    viewportRect.setAttribute("width", String(Math.max(8, viewport.width * scale)));
    viewportRect.setAttribute("height", String(Math.max(8, viewport.height * scale)));
    viewportRect.setAttribute("rx", "2.5");
    this.minimapSvg.appendChild(viewportRect);
  }

  getMinimapTransform() {
    if (!this.nodes.length || !this.minimap) return null;
    const rect = this.minimap.getBoundingClientRect();
    const width = rect.width || this.minimapWidth;
    const height = rect.height || this.minimapHeight;
    const bounds = this.getBounds();
    if (!bounds.width || !bounds.height) return null;

    const padding = 10;
    const scale = Math.min((width - padding * 2) / bounds.width, (height - padding * 2) / bounds.height);
    if (!Number.isFinite(scale) || scale <= 0) return null;

    return {
      width,
      height,
      scale,
      bounds,
      offsetX: (width - bounds.width * scale) / 2,
      offsetY: (height - bounds.height * scale) / 2,
    };
  }

  getVisibleGraphRect() {
    const rect = this.container.getBoundingClientRect();
    return {
      x: -this.viewport.x / this.viewport.zoom,
      y: -this.viewport.y / this.viewport.zoom,
      width: rect.width / this.viewport.zoom,
      height: rect.height / this.viewport.zoom,
    };
  }

  renderHoverHighlight() {
    const state = this.hoverState;
    const hasState = Boolean(state);
    this.root.classList.toggle("has-hover-highlight", hasState);

    this.root.querySelectorAll(".topo-node").forEach((element) => {
      const related = hasState && state.relatedNodes.has(element.dataset.nodeId);
      element.classList.toggle("is-hover-related", related);
      element.classList.toggle("is-hover-dimmed", hasState && !related);
    });

    this.root.querySelectorAll(".topo-edge").forEach((element) => {
      const related = hasState && state.relatedEdges.has(element.dataset.edgeId);
      element.classList.toggle("is-hover-related", related);
      element.classList.toggle("is-hover-dimmed", hasState && !related);
    });
  }

  renderSelection() {
    this.root.querySelectorAll(".is-selected, .is-multi-selected").forEach((item) => {
      item.classList.remove("is-selected", "is-multi-selected");
    });
    const selection = this.selection || { nodes: [], edges: [] };
    for (const id of selection.nodes || []) {
      this.root.querySelector(`.topo-node[data-node-id="${cssEscape(id)}"]`)?.classList.add("is-multi-selected");
    }
    for (const id of selection.edges || []) {
      this.root.querySelector(`.topo-edge[data-edge-id="${cssEscape(id)}"]`)?.classList.add("is-multi-selected");
    }
    if (!this.selected) return;
    const selector = this.selected.type === "node"
      ? `.topo-node[data-node-id="${cssEscape(this.selected.id)}"]`
      : `.topo-edge[data-edge-id="${cssEscape(this.selected.id)}"]`;
    this.root.querySelector(selector)?.classList.add("is-selected", "is-multi-selected");
  }

  applyViewport() {
    const value = `translate(${this.viewport.x}px, ${this.viewport.y}px) scale(${this.viewport.zoom})`;
    this.svg.style.transform = value;
    this.nodeLayer.style.transform = value;
    this.scheduleMinimapRender();
    this.container.dispatchEvent(new CustomEvent("topo:viewport", {
      detail: { ...this.viewport },
      bubbles: true,
    }));
  }

  getBounds(nodes = this.nodes) {
    if (!nodes.length) return { x: 0, y: 0, width: 1, height: 1 };
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const node of nodes) {
      const size = getNodeSize(node);
      const position = this.getNodeAbsolutePosition(node);
      minX = Math.min(minX, position.x);
      minY = Math.min(minY, position.y);
      maxX = Math.max(maxX, position.x + size.width);
      maxY = Math.max(maxY, position.y + size.height);
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  captureNodePositions() {
    return new Map(this.nodes.map((node) => [node.id, {
      position: this.getNodeAbsolutePosition(node),
      size: getNodeSize(node),
    }]));
  }

  createNodeAnimation(previousPositions, { centerNodeId, disableAnimate } = {}) {
    if (disableAnimate || !this.animate || this.performanceMode || !previousPositions.size) return null;
    const from = new Map();
    let changed = false;
    for (const node of this.nodes) {
      const previous = previousPositions.get(node.id);
      if (!previous) continue;
      const next = this.getNodeAbsolutePosition(node);
      if (Math.abs(previous.position.x - next.x) > 1 || Math.abs(previous.position.y - next.y) > 1) {
        from.set(node.id, previous.position);
        changed = true;
      }
    }
    const centerPosition = centerNodeId ? previousPositions.get(centerNodeId)?.position : null;
    const hasNewNodes = this.nodes.some((node) => !previousPositions.has(node.id));
    if (!changed && !hasNewNodes) return null;
    return {
      from,
      enterFrom: centerPosition || [...previousPositions.values()][0]?.position || { x: 0, y: 0 },
      duration: this.config.nodeAnimationDuration ?? 280,
    };
  }

  playNodeAnimation(animatedElements, animation) {
    this.root.classList.add("is-node-animating");
    this.nodeAnimationFrame = requestAnimationFrame(() => {
      this.nodeAnimationFrame = null;
      for (const item of animatedElements) {
        item.element.style.transform = `translate(${item.position.x}px, ${item.position.y}px)`;
        item.element.style.opacity = "1";
        if (!item.hasStart) item.element.style.transform = `translate(${item.position.x}px, ${item.position.y}px) scale(1)`;
      }
      this.scheduleEdgeRender();
      this.scheduleMinimapRender();
    });
    this.nodeAnimationTimer = window.setTimeout(() => {
      this.nodeAnimationTimer = null;
      this.root.classList.remove("is-node-animating");
      this.root.querySelectorAll(".topo-node.is-animating, .topo-node.is-entering").forEach((element) => {
        element.classList.remove("is-animating", "is-entering");
        element.style.opacity = "";
      });
      this.container.dispatchEvent(new CustomEvent("topo:node-animation", {
        detail: { count: animatedElements.length },
        bubbles: true,
      }));
    }, animation.duration + 40);
  }

  resolveNodeType(node) {
    if (node.type) return node.type;
    if (node.data?.isParent) return "labeledGroupNode";
    return this.nodeType || "cardNode";
  }

  resolveEdgeType(edge) {
    return edge.type || edge.data?.edgeType || edge.data?.shape || "default";
  }

  getNodeAbsolutePosition(node, visited = new Set()) {
    const position = node?.position || { x: 0, y: 0 };
    if (!node?.parentId || visited.has(node.id)) {
      return { x: Number(position.x) || 0, y: Number(position.y) || 0 };
    }
    visited.add(node.id);
    const parent = this.nodes.find((item) => item.id === node.parentId);
    if (!parent) return { x: Number(position.x) || 0, y: Number(position.y) || 0 };
    const parentPosition = this.getNodeAbsolutePosition(parent, visited);
    return {
      x: parentPosition.x + (Number(position.x) || 0),
      y: parentPosition.y + (Number(position.y) || 0),
    };
  }

  getRenderedNode(node) {
    return {
      ...node,
      position: this.getNodeAbsolutePosition(node),
    };
  }

  toStoredNodePosition(node, absolutePosition) {
    if (!node.parentId) return absolutePosition;
    const parent = this.nodes.find((item) => item.id === node.parentId);
    if (!parent) return absolutePosition;
    const parentPosition = this.getNodeAbsolutePosition(parent);
    return {
      x: absolutePosition.x - parentPosition.x,
      y: absolutePosition.y - parentPosition.y,
    };
  }
}

export class CopilotTopoGraph extends NewTopoGraph {
  constructor(options = {}) {
    super({
      ...options,
      config: { ...options.config, type: "copilot" },
    });
  }
}

export class AgentLoopTopoGraph extends NewTopoGraph {
  constructor(options = {}) {
    super({
      ...options,
      config: { ...options.config, type: "agentloop" },
    });
  }
}

function renderNodeContent(node, type = "cardNode") {
  const customShape = getNodeShape(type);
  if (customShape) {
    const rendered = renderCustomNodeShape(customShape, node, type);
    if (rendered != null) return rendered;
  }
  return renderDefaultNodeContent(node, type);
}

function renderDefaultNodeContent(node, type = "cardNode") {
  if (type === "labeledGroupNode" || type === "groupNodeWithHandles") return renderGroupNodeContent(node, type);
  if (type === "cardLayerNode") return renderCardLayerNodeContent(node);
  if (["componentNode", "planNode", "operatorNode", "inputSourceNode", "sinkNode", "flowNode", "flowLayerNode"].includes(type)) {
    return renderRichNodeContent(node, type);
  }

  const data = node.data || {};
  const status = data.status || "ok";
  const metric = data.metric ? `<div class="node-metric"><span>${escapeHtml(data.metric.label)}</span><strong>${escapeHtml(data.metric.value)}</strong></div>` : "";
  const tags = (data.tags || []).slice(0, 3).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("");
  return `
    <div class="node-head">
      <span class="node-icon">${escapeHtml(data.icon || "N")}</span>
      <span class="node-status ${status}"></span>
    </div>
    <div class="node-title">${escapeHtml(data.title || node.id)}</div>
    <div class="node-subtitle">${escapeHtml(data.subTitle || data.domain || "")}</div>
    ${metric}
    <div class="node-tags">${tags}</div>
  `;
}

function renderCustomNodeShape(shape, node, type) {
  const renderer = typeof shape === "function" ? shape : shape.render;
  if (typeof renderer !== "function") return null;
  return renderer(node, {
    type,
    escapeHtml,
    renderMetric: renderNodeMetric,
    defaultRender: () => renderDefaultNodeContent(node, type),
  });
}

function isAgentLoopDeletableNode(node, type) {
  return type === "operatorNode" && node.data?.action?.disableDelete !== true;
}

function maxEdgeStatus(edges = []) {
  const weight = { ok: 0, warn: 1, critical: 2 };
  return edges.reduce((current, edge) => {
    const status = edge.data?.status || "ok";
    return (weight[status] ?? 0) > (weight[current] ?? 0) ? status : current;
  }, "ok");
}

function renderCardLayerNodeContent(node) {
  const data = node.data || {};
  const status = data.status || "ok";
  const descriptionItems = Array.isArray(data.descriptions)
    ? data.descriptions
    : data.description
      ? [data.description]
      : [];
  const descriptions = descriptionItems
    .slice(0, 3)
    .map((item) => `<div class="layer-description">${escapeHtml(item.label || item.name || item)}<strong>${escapeHtml(item.value || "")}</strong></div>`)
    .join("");
  const badge = data.badge || data.alarm || (status !== "ok" ? status : "");
  return `
    <div class="node-handle handle-top"></div>
    <div class="layer-node-head">
      <span class="node-icon">${escapeHtml(data.icon || data.style?.iconClass || "N")}</span>
      <div class="layer-node-title-wrap">
        <div class="node-title">${escapeHtml(data.title || node.id)}</div>
        <div class="node-subtitle">${escapeHtml(data.subTitle || data.name || data.domain || "")}</div>
      </div>
      ${badge ? `<span class="node-badge">${escapeHtml(badge)}</span>` : ""}
    </div>
    ${descriptions ? `<div class="layer-descriptions">${descriptions}</div>` : renderNodeMetric(data)}
    <div class="node-handle handle-bottom"></div>
  `;
}

function renderRichNodeContent(node, type) {
  const data = node.data || {};
  const title = data.title || data._fields?.title || node.id;
  const summary = data.summary || data._fields?.summary || data.subTitle || "";
  return `
    <div class="node-handle handle-top"></div>
    <div class="rich-node-head">
      <span class="node-icon">${escapeHtml(data.icon || data.style?.iconClass || type.slice(0, 2).toUpperCase())}</span>
      <div>
        <div class="node-title">${escapeHtml(title)}</div>
        <div class="node-subtitle">${escapeHtml(summary)}</div>
      </div>
    </div>
    ${renderNodeMetric(data)}
    <div class="node-handle handle-bottom"></div>
  `;
}

function renderGroupNodeContent(node, type) {
  const data = node.data || {};
  const label = data.label || data.title || node.id;
  return `
    <div class="group-node-frame">
      <div class="group-node-label">${escapeHtml(label)}</div>
      ${type === "groupNodeWithHandles" ? '<div class="node-handle handle-top"></div><div class="node-handle handle-bottom"></div>' : ""}
    </div>
  `;
}

function renderNodeMetric(data) {
  return data.metric
    ? `<div class="node-metric"><span>${escapeHtml(data.metric.label)}</span><strong>${escapeHtml(data.metric.value)}</strong></div>`
    : "";
}

function buildEdgePath(source, target, rankDir, edge = {}) {
  const sourceSize = getNodeSize(source);
  const targetSize = getNodeSize(target);
  const parallelOffset = Number(edge.data?.parallelOffset || 0);

  if (rankDir === "TB") {
    const baseFrom = {
      x: source.position.x + sourceSize.width / 2,
      y: source.position.y + sourceSize.height,
    };
    const baseTo = {
      x: target.position.x + targetSize.width / 2,
      y: target.position.y,
    };
    const normal = getNormal(baseTo.x - baseFrom.x, baseTo.y - baseFrom.y);
    const from = offsetPoint(baseFrom, normal, parallelOffset);
    const to = offsetPoint(baseTo, normal, parallelOffset);
    const mid = (from.y + to.y) / 2;
    return {
      d: `M ${from.x} ${from.y} C ${from.x} ${mid}, ${to.x} ${mid}, ${to.x} ${to.y}`,
      label: { x: (from.x + to.x) / 2, y: mid - 8 },
    };
  }

  const sourceCenter = {
    x: source.position.x + sourceSize.width / 2,
    y: source.position.y + sourceSize.height / 2,
  };
  const targetCenter = {
    x: target.position.x + targetSize.width / 2,
    y: target.position.y + targetSize.height / 2,
  };
  const from = getAnchorPoint(source, sourceSize, targetCenter);
  const to = getAnchorPoint(target, targetSize, sourceCenter);
  const sx = from.x;
  const sy = from.y;
  const tx = to.x;
  const ty = to.y;
  const dx = tx - sx;
  const dy = ty - sy;
  const normal = getNormal(dx, dy);
  const horizontal = Math.abs(dx) >= Math.abs(dy);
  const bend = Math.max(70, Math.hypot(dx, dy) * 0.34);
  const c1 = horizontal ? { x: sx + Math.sign(dx || 1) * bend, y: sy } : { x: sx, y: sy + Math.sign(dy || 1) * bend };
  const c2 = horizontal ? { x: tx - Math.sign(dx || 1) * bend, y: ty } : { x: tx, y: ty - Math.sign(dy || 1) * bend };
  const shiftedFrom = offsetPoint({ x: sx, y: sy }, normal, parallelOffset);
  const shiftedTo = offsetPoint({ x: tx, y: ty }, normal, parallelOffset);
  const shiftedC1 = offsetPoint(c1, normal, parallelOffset);
  const shiftedC2 = offsetPoint(c2, normal, parallelOffset);
  return {
    d: `M ${shiftedFrom.x} ${shiftedFrom.y} C ${shiftedC1.x} ${shiftedC1.y}, ${shiftedC2.x} ${shiftedC2.y}, ${shiftedTo.x} ${shiftedTo.y}`,
    label: { x: (shiftedFrom.x + shiftedTo.x) / 2, y: (shiftedFrom.y + shiftedTo.y) / 2 - 8 },
  };
}

function getNormal(dx, dy) {
  const length = Math.hypot(dx, dy) || 1;
  return {
    x: -dy / length,
    y: dx / length,
  };
}

function offsetPoint(point, normal, offset) {
  if (!offset) return point;
  return {
    x: Math.round((point.x + normal.x * offset) * 10) / 10,
    y: Math.round((point.y + normal.y * offset) * 10) / 10,
  };
}

function getAnchorPoint(node, size, toward) {
  const center = {
    x: node.position.x + size.width / 2,
    y: node.position.y + size.height / 2,
  };
  const dx = toward.x - center.x;
  const dy = toward.y - center.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return {
      x: center.x + Math.sign(dx || 1) * size.width / 2,
      y: center.y,
    };
  }
  return {
    x: center.x,
    y: center.y + Math.sign(dy || 1) * size.height / 2,
  };
}

function getDomainColor(domain, status) {
  const colors = {
    external: "#64748b",
    loadbalancer: "#0ea5e9",
    ecs: "#2563eb",
    redis: "#16a34a",
    rds: "#dc2626",
    log: "#7c3aed",
    alert: "#d97706",
    gateway: "#0891b2",
    function: "#9333ea",
    queue: "#ea580c",
  };
  return colors[domain] || colors[status] || "#2563eb";
}

function getRelatedData(focusId, nodes, edges, { degree = 1, direction = "both" } = {}) {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  if (!nodeById.has(focusId)) return { nodes: [], edges: [] };

  const relatedNodes = new Set([focusId]);
  const relatedEdges = new Set();
  let frontier = new Set([focusId]);
  const maxDegree = Math.max(1, Number(degree) || 1);

  for (let level = 0; level < maxDegree && frontier.size; level += 1) {
    const next = new Set();
    for (const edge of edges) {
      const isIncoming = frontier.has(edge.target);
      const isOutgoing = frontier.has(edge.source);
      const allowed = direction === "upstream"
        ? isIncoming
        : direction === "downstream"
          ? isOutgoing
          : isIncoming || isOutgoing;
      if (!allowed) continue;

      relatedEdges.add(edge.id);
      if (!relatedNodes.has(edge.source)) next.add(edge.source);
      if (!relatedNodes.has(edge.target)) next.add(edge.target);
      relatedNodes.add(edge.source);
      relatedNodes.add(edge.target);
    }
    frontier = next;
  }

  return {
    nodes: nodes.filter((node) => relatedNodes.has(node.id)),
    edges: edges.filter((edge) => relatedEdges.has(edge.id) && relatedNodes.has(edge.source) && relatedNodes.has(edge.target)),
  };
}

function disableExpandAction(node) {
  return {
    ...cloneGraphItem(node),
    data: {
      ...node.data,
      action: {
        ...node.data?.action,
        enableExpand: false,
      },
    },
  };
}

function isParentNode(node, type) {
  return Boolean(node?.data?.isParent || type === "labeledGroupNode" || type === "groupNodeWithHandles");
}

function mergeNodePatch(node, patch) {
  return {
    ...node,
    ...patch,
    data: patch.data ? { ...node.data, ...patch.data } : node.data,
    position: patch.position ? { ...patch.position } : node.position,
    style: patch.style ? { ...node.style, ...patch.style } : node.style,
  };
}

function mergeEdgePatch(edge, patch) {
  return {
    ...edge,
    ...patch,
    data: patch.data ? { ...edge.data, ...patch.data } : edge.data,
  };
}

function createValidationResult(nodes = [], edges = []) {
  return {
    valid: true,
    hasWarnings: false,
    errors: [],
    warnings: [],
    nodes: nodes.map((node) => cloneGraphItem(node)),
    edges: edges.map((edge) => cloneGraphItem(edge)),
    duplicateNodes: 0,
    duplicateEdges: 0,
    invalidEdges: 0,
    invalidStatuses: 0,
    missingTitles: 0,
    cyclicParents: 0,
    unknownNodeTypes: 0,
  };
}

function createGraphInstanceId() {
  graphInstanceSeed += 1;
  return `graph-${graphInstanceSeed}`;
}

function normalizeGraphItemList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (value instanceof Map) return [...value.values()].filter(Boolean);
  if (value instanceof Set) return [...value].filter(Boolean);
  if (typeof value === "object") return Object.entries(value).map(([id, item]) => ({ id, ...(item || {}) }));
  return [];
}

function normalizeIdList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (value instanceof Set) return [...value].filter(Boolean);
  if (value instanceof Map) return [...value.keys()].filter(Boolean);
  return [value].filter(Boolean);
}

function normalizePatchList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (value instanceof Set) return [...value];
  if (value instanceof Map) {
    return [...value.entries()].map(([id, patch]) => ({ id, ...(patch || {}) }));
  }
  if (typeof value === "object") {
    return Object.entries(value).map(([id, patch]) => ({ id, ...(patch || {}) }));
  }
  return [];
}

function patchFromRealtimeItem(item = {}) {
  const { data, id, patch, position, replace, style, ...rest } = item;
  return {
    ...rest,
    ...(patch || {}),
    ...(data ? { data } : {}),
    ...(position ? { position } : {}),
    ...(style ? { style } : {}),
  };
}

function cloneSelection(selection = {}) {
  return {
    nodes: [...(selection.nodes || [])],
    edges: [...(selection.edges || [])],
    primary: selection.primary ? { ...selection.primary } : null,
  };
}

function areSelectionsEqual(left = {}, right = {}) {
  return arrayEqual(left.nodes || [], right.nodes || [])
    && arrayEqual(left.edges || [], right.edges || [])
    && (left.primary?.type || "") === (right.primary?.type || "")
    && (left.primary?.id || "") === (right.primary?.id || "");
}

function arrayEqual(left, right) {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

function resolvePrimarySelection(selection = {}) {
  if (selection.nodes?.length) return { type: "node", id: selection.nodes[0] };
  if (selection.edges?.length) return { type: "edge", id: selection.edges[0] };
  return null;
}

function hasSelection(selection = {}) {
  return Boolean(selection.nodes?.length || selection.edges?.length);
}

function normalizeRect(rect = {}) {
  const x = Number(rect.x) || 0;
  const y = Number(rect.y) || 0;
  const width = Number(rect.width) || 0;
  const height = Number(rect.height) || 0;
  return {
    x: width < 0 ? x + width : x,
    y: height < 0 ? y + height : y,
    width: Math.abs(width),
    height: Math.abs(height),
  };
}

function doesNodeRectIntersect(node, rect, resolvePosition) {
  const position = resolvePosition(node);
  const size = getNodeSize(node);
  return rectsIntersect(rect, {
    x: position.x,
    y: position.y,
    width: size.width,
    height: size.height,
  });
}

function rectsIntersect(left, right) {
  return left.x <= right.x + right.width
    && left.x + left.width >= right.x
    && left.y <= right.y + right.height
    && left.y + left.height >= right.y;
}

function segmentIntersectsRect(a, b, rect) {
  if (pointInRect(a, rect) || pointInRect(b, rect)) return true;
  const topLeft = { x: rect.x, y: rect.y };
  const topRight = { x: rect.x + rect.width, y: rect.y };
  const bottomRight = { x: rect.x + rect.width, y: rect.y + rect.height };
  const bottomLeft = { x: rect.x, y: rect.y + rect.height };
  return segmentsIntersect(a, b, topLeft, topRight)
    || segmentsIntersect(a, b, topRight, bottomRight)
    || segmentsIntersect(a, b, bottomRight, bottomLeft)
    || segmentsIntersect(a, b, bottomLeft, topLeft);
}

function pointInRect(point, rect) {
  return point.x >= rect.x
    && point.x <= rect.x + rect.width
    && point.y >= rect.y
    && point.y <= rect.y + rect.height;
}

function segmentsIntersect(a, b, c, d) {
  const orientationA = orientation(a, b, c);
  const orientationB = orientation(a, b, d);
  const orientationC = orientation(c, d, a);
  const orientationD = orientation(c, d, b);

  if (orientationA !== orientationB && orientationC !== orientationD) return true;
  if (orientationA === 0 && pointOnSegment(c, a, b)) return true;
  if (orientationB === 0 && pointOnSegment(d, a, b)) return true;
  if (orientationC === 0 && pointOnSegment(a, c, d)) return true;
  if (orientationD === 0 && pointOnSegment(b, c, d)) return true;
  return false;
}

function orientation(a, b, c) {
  const value = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
  if (Math.abs(value) < 0.000001) return 0;
  return value > 0 ? 1 : 2;
}

function pointOnSegment(point, a, b) {
  return point.x <= Math.max(a.x, b.x) + 0.000001
    && point.x >= Math.min(a.x, b.x) - 0.000001
    && point.y <= Math.max(a.y, b.y) + 0.000001
    && point.y >= Math.min(a.y, b.y) - 0.000001;
}

function matchesSelectionCriteria(item, kind, criteria = {}) {
  if (typeof criteria.predicate === "function" && criteria.predicate(item, kind)) return true;
  const data = item.data || {};
  const tagValues = Array.isArray(data.tags) ? data.tags : data.tags ? [data.tags] : [];
  if (matchesCriteriaValue(item.id, criteria.ids, criteria.id)) return true;
  if (kind === "node" && matchesCriteriaValue(item.id, criteria.nodeIds, criteria.nodeId)) return true;
  if (kind === "edge" && matchesCriteriaValue(item.id, criteria.edgeIds, criteria.edgeId)) return true;
  if (matchesCriteriaValue(item.type, criteria.types, criteria.type)) return true;
  if (matchesCriteriaValue(data.domain, criteria.domains, criteria.domain)) return true;
  if (matchesCriteriaValue(data.status, criteria.statuses, criteria.status)) return true;
  if (matchesCriteriaValue(data.group, criteria.groups, criteria.group)) return true;
  if (matchesCriteriaList(tagValues, criteria.tags, criteria.tag)) return true;
  if (kind === "edge" && (
    matchesCriteriaValue(item.source, criteria.sources, criteria.source)
    || matchesCriteriaValue(item.target, criteria.targets, criteria.target)
  )) {
    return true;
  }
  return false;
}

function matchesCriteriaValue(value, plural, singular) {
  const values = normalizeCriteriaValues(plural, singular);
  if (!values.length) return false;
  return values.some((item) => String(value ?? "") === String(item));
}

function matchesCriteriaList(itemValues, plural, singular) {
  const values = normalizeCriteriaValues(plural, singular);
  if (!values.length) return false;
  const normalizedItems = new Set(itemValues.map((item) => String(item)));
  return values.some((item) => normalizedItems.has(String(item)));
}

function normalizeCriteriaValues(plural, singular) {
  const values = [];
  if (Array.isArray(plural)) values.push(...plural);
  else if (plural instanceof Set) values.push(...plural);
  else if (plural != null) values.push(plural);
  if (singular != null) values.push(singular);
  return values.filter((value) => value != null && value !== "");
}

function isAdditiveSelectionEvent(event) {
  if (!event) return false;
  return event.ctrlKey || event.metaKey;
}

function isEditableTarget(target) {
  if (!target) return false;
  const tagName = target.tagName;
  return target.isContentEditable || tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT";
}

function formatDebugValue(value, suffix = "") {
  if (value == null || value === "") return "-";
  if (Number.isFinite(value)) return `${Math.round(value * 10) / 10}${suffix}`;
  return String(value);
}

function formatValidationSummary(validation = {}) {
  const errorCount = validation.errors?.length
    ?? ((validation.duplicateNodes || 0) + (validation.duplicateEdges || 0) + (validation.invalidEdges || 0));
  const warningCount = validation.warnings?.length
    ?? ((validation.invalidStatuses || 0) + (validation.missingTitles || 0) + (validation.cyclicParents || 0) + (validation.unknownNodeTypes || 0));
  if (!errorCount && !warningCount) return "ok";
  return `${errorCount}e/${warningCount}w`;
}

function cloneGraphItem(item) {
  if (Array.isArray(item)) return item.map((entry) => cloneGraphItem(entry));
  if (!item || typeof item !== "object") return item;
  const clone = {};
  for (const [key, value] of Object.entries(item)) {
    clone[key] = cloneGraphItem(value);
  }
  return clone;
}

function toClassList(value) {
  return String(value || "")
    .split(/\s+/)
    .map((name) => name.trim())
    .filter(Boolean);
}

function applySvgAttributes(element, attributes, edge) {
  const resolved = typeof attributes === "function" ? attributes(edge) : attributes;
  if (!resolved || typeof resolved !== "object") return;
  Object.entries(resolved).forEach(([name, value]) => {
    if (value == null || value === false) return;
    element.setAttribute(name, String(value));
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cssEscape(value) {
  if (window.CSS?.escape) return CSS.escape(value);
  return String(value).replace(/"/g, '\\"');
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
