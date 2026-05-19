export class FlowToolbar {
  constructor({
    container,
    graph,
    onLayoutChange,
    handleReset,
    enableReLayout = false,
    children,
    layouts,
  }) {
    this.container = container;
    this.graph = graph;
    this.onLayoutChange = onLayoutChange;
    this.handleReset = handleReset;
    this.enableReLayout = enableReLayout;
    this.children = children;
    this.layouts = layouts || [
      { key: "fdp", label: "FDP", title: "Force layout" },
      { key: "dot", label: "DOT", title: "Directional layout" },
      { key: "layer", label: "LYR", title: "Layer layout" },
      { key: "xyFlow", label: "XY", title: "XYFlow layout" },
      { key: "radial", label: "RAD", title: "Radial layout" },
      { key: "grid", label: "GRID", title: "Grid layout" },
    ];
    this.activeLayout = "dot";
    this.zoom = 1;
    this.render();
    this.bindGraphEvents();
  }

  setActiveLayout(layout) {
    this.activeLayout = layout;
    this.container.querySelectorAll("[data-layout]").forEach((button) => {
      button.classList.toggle("active", button.dataset.layout === layout);
    });
  }

  setZoom(zoom) {
    this.zoom = Number.isFinite(zoom) ? zoom : 1;
    const label = this.container.querySelector("[data-role='zoom-label']");
    if (label) label.textContent = `${Math.round(this.zoom * 100)}%`;
  }

  bindGraphEvents() {
    const root = this.graph?.container;
    if (!root) return;
    root.addEventListener("topo:viewport", (event) => this.setZoom(event.detail.zoom));
  }

  render() {
    const layoutButtons = this.layouts.map((item) => {
      return `<button type="button" title="${escapeHtml(item.title || item.label)}" data-layout="${escapeHtml(item.key)}">${escapeHtml(item.label)}</button>`;
    }).join("");
    const reset = this.handleReset ? '<button type="button" title="Reset" data-action="reset">RST</button>' : "";
    const relayout = this.enableReLayout ? '<button type="button" title="Re-layout" data-action="relayout">RLY</button>' : "";
    this.container.innerHTML = `
      <div class="flow-toolbar" aria-label="Topology toolbar">
        <button type="button" title="Fit view" data-action="fit">F</button>
        <button type="button" title="Zoom out" data-action="zoom-out">-</button>
        <span class="toolbar-zoom" data-role="zoom-label">100%</span>
        <button type="button" title="Zoom in" data-action="zoom-in">+</button>
        <button type="button" title="Center" data-action="center">C</button>
        ${reset}
        ${relayout}
        <div class="toolbar-divider"></div>
        ${layoutButtons}
        <div data-role="toolbar-children"></div>
      </div>
    `;
    this.setActiveLayout(this.activeLayout);
    this.setZoom(this.graph?.getGraph?.().getViewport?.().zoom ?? 1);
    this.renderChildren();

    this.container.addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button) return;

      const graph = this.graph.getGraph();
      if (button.dataset.action === "fit") graph.fitView({ padding: 0.16 });
      if (button.dataset.action === "center") graph.fitCenter();
      if (button.dataset.action === "zoom-in") graph.zoomTo(graph.getViewport().zoom + 0.12);
      if (button.dataset.action === "zoom-out") graph.zoomTo(graph.getViewport().zoom - 0.12);
      if (button.dataset.action === "reset") this.handleReset?.();
      if (button.dataset.action === "relayout") graph.setData({ ...graph.getData(), clearStatus: true, preserveOrigin: true });

      if (button.dataset.layout) {
        this.setActiveLayout(button.dataset.layout);
        this.onLayoutChange?.(button.dataset.layout);
      }
    });
  }

  renderChildren() {
    const host = this.container.querySelector("[data-role='toolbar-children']");
    if (!host || !this.children) return;
    if (typeof this.children === "string") {
      host.innerHTML = this.children;
    } else if (this.children instanceof Node) {
      host.replaceChildren(this.children);
    } else if (typeof this.children === "function") {
      const rendered = this.children();
      if (rendered instanceof Node) host.replaceChildren(rendered);
      if (typeof rendered === "string") host.innerHTML = rendered;
    }
    if (host.childNodes.length) {
      host.before(Object.assign(document.createElement("div"), { className: "toolbar-divider" }));
    }
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
