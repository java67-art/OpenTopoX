import assert from "node:assert/strict";
import test from "node:test";

import { NewTopoGraph } from "../../src/framework/index.js";

test("NewTopoGraph graph indexes keep connected edge lookups current", () => {
  const graph = createGraphStub({
    nodes: [
      { id: "group-a", type: "labeledGroupNode", data: { title: "Group A" } },
      { id: "api", parentId: "group-a", data: { title: "API" } },
      { id: "db", data: { title: "DB" } },
      { id: "cache", data: { title: "Cache" } },
    ],
    edges: [
      { id: "api-db", source: "api", target: "db" },
      { id: "api-cache", source: "api", target: "cache" },
      { id: "db-cache", source: "db", target: "cache" },
    ],
  });

  graph.rebuildGraphIndexes();

  assert.equal(graph.nodeById.get("api").parentId, "group-a");
  assert.deepEqual([...graph.childrenByParentId.get("group-a")], ["api"]);
  assert.deepEqual(new Set(graph.getConnectedEdgeIds(["api"])), new Set(["api-db", "api-cache"]));

  const previousNode = graph.nodeById.get("api");
  graph.updateNodeIndex({ ...previousNode, parentId: "group-b" }, previousNode);
  assert.equal(graph.childrenByParentId.get("group-a").has("api"), false);
  assert.deepEqual([...graph.childrenByParentId.get("group-b")], ["api"]);

  const previousEdge = graph.edgeById.get("api-db");
  graph.updateEdgeIndex({ ...previousEdge, target: "cache" }, previousEdge);
  assert.equal(graph.edgeIdsByNodeId.get("db").has("api-db"), false);
  assert.deepEqual(new Set(graph.getConnectedEdgeIds(["cache"])), new Set(["api-cache", "db-cache", "api-db"]));
});

test("NewTopoGraph canvas edge mode is gated by performance config", () => {
  const graph = createGraphStub({
    edges: Array.from({ length: 2000 }, (_, index) => ({
      id: `edge-${index}`,
      source: `node-${index}`,
      target: `node-${index + 1}`,
    })),
    canvasEdges: true,
    canvasEdgeThreshold: 2000,
    performanceMode: true,
    graphType: "default",
  });

  assert.equal(graph.shouldUseCanvasEdges(), true);

  graph.canvasEdges = false;
  assert.equal(graph.shouldUseCanvasEdges(), false);

  graph.canvasEdges = true;
  graph.performanceMode = false;
  assert.equal(graph.shouldUseCanvasEdges(), false);

  graph.performanceMode = true;
  graph.canvasEdgeThreshold = 2001;
  assert.equal(graph.shouldUseCanvasEdges(), false);

  graph.canvasEdgeThreshold = 2000;
  graph.graphType = "agentloop";
  assert.equal(graph.shouldUseCanvasEdges(), false);
});

function createGraphStub(options = {}) {
  const graph = Object.create(NewTopoGraph.prototype);
  Object.assign(graph, {
    nodes: [],
    edges: [],
    nodeById: new Map(),
    edgeById: new Map(),
    edgeIdsByNodeId: new Map(),
    childrenByParentId: new Map(),
    minimapStaticDirty: false,
    minimapTransform: { cached: true },
    canvasEdges: true,
    canvasEdgeThreshold: 2000,
    performanceMode: true,
    graphType: "default",
    ...options,
  });
  return graph;
}
