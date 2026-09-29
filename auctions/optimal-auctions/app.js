"use strict";

(function () {
  var M = window.OptimalAuctionsModel;
  var C = window.OptimalAuctionsCharts;
  function byId(id) { return document.getElementById(id); }
  var svg = byId("allocation-chart");
  var lotterySvg = byId("lottery-chart");
  var grid = M.preset("efficient");
  var brush = [0, 0];
  var brushValid = true;
  var selected = { i: 0, j: 0, half: "lower" };
  var probe = { x: 0.5, y: 0.5, visible: false };
  var stroke = null;
  var heldKeys = {};
  var lotteryPointer = null;
  var frame = null;
  var result;
  var view = C.allocation(svg, grid);

  function selection() {
    view.select(selected);
    view.probe(probe, grid);
    var q = grid[selected.half][selected.i][selected.j];
    var label = "Cell " + (selected.i + 1) + ", " + (selected.j + 1) + "; " +
      (selected.half === "lower" ? "right" : "left") + " triangle. " +
      "q₁ = " + q[0].toFixed(3) + ", q₂ = " + q[1].toFixed(3) + ", no sale = " + (1 - q[0] - q[1]).toFixed(3) + ".";
    byId("selected-cell").textContent = label;
    byId("selected-cell").dataset.q1 = q[0];
    byId("selected-cell").dataset.q2 = q[1];
    byId("selected-cell").dataset.cell = [selected.i, selected.j, selected.half].join(",");
    byId("allocation-description").textContent = "800 editable triangles. Blue allocates to bidder 1, orange to bidder 2, and the background means no sale; mixtures are lotteries. " + label;
  }

  function selectProbe() {
    probe = { x: (selected.i + (selected.half === "lower" ? 2 / 3 : 1 / 3)) / 20,
      y: (selected.j + (selected.half === "lower" ? 1 / 3 : 2 / 3)) / 20, visible: true };
    selection();
  }

  function render() {
    if (frame !== null) { cancelAnimationFrame(frame); frame = null; }
    result = M.diagnose(grid);
    view.update(grid);
    selection();
    result.bidders.forEach(function (agent, index) {
      var bidder = index + 1;
      C.interim(byId("interim-" + bidder + "-chart"), agent, bidder);
      C.payment(byId("payment-" + bidder + "-chart"), agent, bidder);
      byId("bic-verdict-" + bidder).textContent = agent.bic ? "BIC: passes" : "BIC: fails";
      byId("bic-monotonicity-" + bidder).textContent = agent.bic ? "is weakly increasing" : "is not weakly increasing";
      byId("bic-status-" + bidder).dataset.bic = String(agent.bic);
      byId("payment-caption-" + bidder).textContent = agent.bic ? "Interim payment" : "Payment candidate";
    });
    byId("revenue-label").textContent = result.bic ? "Expected revenue" : "Envelope revenue candidate";
    byId("revenue-value").textContent = C.fixed(result.revenue);
    byId("revenue-value").dataset.value = result.revenue;
    document.body.dataset.ready = "true";
  }

  function schedule() {
    if (frame === null) { frame = requestAnimationFrame(render); }
  }

  function announce() {
    byId("live-summary").textContent = result.bidders.map(function (agent, index) { return "Bidder " + (index + 1) + ": " + byId("bic-status-" + (index + 1)).textContent; }).join(". ") + ". " + byId("revenue-label").textContent + ": " + C.fixed(result.revenue) + ". " + byId("selected-cell").textContent;
  }

  function updateBrush() {
    byId("brush-q1").value = brush[0];
    byId("brush-q2").value = brush[1];
    byId("brush-error").textContent = "";
    ["brush-q1", "brush-q2"].forEach(function (id) { byId(id).removeAttribute("aria-invalid"); });
    brushValid = true;
    C.lottery(lotterySvg, brush);
    byId("lottery-description").textContent = "Left/right adjusts bidder 1 and up/down adjusts bidder 2. Home selects no sale. Current probabilities: " + brush[0].toFixed(3) + ", " + brush[1].toFixed(3) + ".";
  }

  function paint(cell) {
    if (!brushValid) { return false; }
    var old = grid[cell.half][cell.i][cell.j];
    if (old[0] === brush[0] && old[1] === brush[1]) { return false; }
    stroke.changed = true;
    grid[cell.half][cell.i][cell.j] = brush.slice();
    return true;
  }

  function visit(p) {
    if (!p || !p.inside) {
      if (stroke) { stroke.last = null; }
      probe.visible = false; view.probe(probe, grid); return;
    }
    probe = { x: p.x, y: p.y, visible: true };
    if (stroke && stroke.kind === "pointer") {
      selected = M.cellAt(p.x, p.y);
      var from = stroke.last || p;
      var steps = Math.max(1, Math.ceil(Math.max(Math.abs(p.x - from.x), Math.abs(p.y - from.y)) * 160));
      for (var k = 0; k <= steps; k += 1) {
        paint(M.cellAt(NumberUtils.clamp(from.x + (p.x - from.x) * k / steps, 0, 1),
          NumberUtils.clamp(from.y + (p.y - from.y) * k / steps, 0, 1)));
      }
      stroke.last = p;
      if (stroke.changed) { schedule(); }
      selection();
    } else { view.probe(probe, grid); }
  }

  function finishStroke() {
    if (!stroke) { return; }
    var ended = stroke;
    stroke = null; heldKeys = {};
    if (ended.kind === "pointer" && svg.hasPointerCapture(ended.id)) { svg.releasePointerCapture(ended.id); }
    if (ended.changed) { render(); }
    announce();
  }

  svg.addEventListener("pointerdown", function (event) {
    if (event.button !== 0 || (stroke && stroke.kind === "pointer")) { return; }
    var p = C.reportPoint(svg, event);
    if (!p || !p.inside) { return; }
    finishStroke();
    event.preventDefault();
    svg.focus({ preventScroll: true });
    stroke = { kind: "pointer", id: event.pointerId, changed: false, last: null };
    svg.setPointerCapture(event.pointerId);
    visit(p);
  });
  svg.addEventListener("pointermove", function (event) {
    if (stroke && (stroke.kind !== "pointer" || event.pointerId !== stroke.id)) { return; }
    visit(C.reportPoint(svg, event));
  });
  ["pointerup", "pointercancel", "lostpointercapture"].forEach(function (name) {
    svg.addEventListener(name, function (event) { if (stroke && stroke.kind === "pointer" && event.pointerId === stroke.id) { finishStroke(); } });
  });
  svg.addEventListener("pointerleave", function () {
    if (!stroke && document.activeElement !== svg) { probe.visible = false; view.probe(probe, grid); }
  });
  svg.addEventListener("focus", function () { selectProbe(); announce(); });
  svg.addEventListener("blur", function () {
    if (stroke && stroke.kind === "keyboard") { finishStroke(); }
    probe.visible = false; view.probe(probe, grid);
  });
  svg.addEventListener("keydown", function (event) {
    if (stroke && stroke.kind === "pointer") { return; }
    var key = event.key.toLowerCase();
    var moved = true;
    // Traverse both halves in the same order as the M-S editor.
    if (key === "arrowright" || key === "arrowleft") {
      var horizontal = NumberUtils.clamp(2 * selected.i + (selected.half === "lower" ? 1 : 0) + (key === "arrowright" ? 1 : -1), 0, 39);
      selected.i = Math.floor(horizontal / 2); selected.half = horizontal % 2 ? "lower" : "upper";
    } else if (key === "arrowup" || key === "arrowdown") {
      var vertical = NumberUtils.clamp(2 * selected.j + (selected.half === "upper" ? 1 : 0) + (key === "arrowup" ? 1 : -1), 0, 39);
      selected.j = Math.floor(vertical / 2); selected.half = vertical % 2 ? "upper" : "lower";
    } else if (key === "home") { selected.i = 0; selected.half = "upper"; }
    else if (key === "end") { selected.i = 19; selected.half = "lower"; }
    else if (key === "l") { selected.half = "upper"; }
    else if (key === "r") { selected.half = "lower"; }
    else if (key === " " || key === "enter") {
      heldKeys[key] = true;
      if (!stroke) { stroke = { kind: "keyboard", changed: false }; }
    } else if (key === "escape") {
      finishStroke(); probe.visible = false; view.probe(probe, grid); event.preventDefault(); return;
    } else { moved = false; }
    if (moved) {
      event.preventDefault();
      if (stroke && stroke.kind === "keyboard" && paint(selected)) { schedule(); }
      selectProbe(); announce();
    }
  });
  svg.addEventListener("keyup", function (event) {
    var key = event.key.toLowerCase();
    if (key === " " || key === "enter") {
      event.preventDefault(); delete heldKeys[key];
      if (stroke && stroke.kind === "keyboard" && !heldKeys.enter && !heldKeys[" "]) { finishStroke(); }
    }
  });

  ["brush-q1", "brush-q2"].forEach(function (id) {
    byId(id).addEventListener("input", function () {
      try {
        brush = M.lottery(byId("brush-q1").valueAsNumber, byId("brush-q2").valueAsNumber);
        updateBrush();
      } catch (error) {
        brushValid = false;
        byId(id).setAttribute("aria-invalid", "true");
        byId("brush-error").textContent = "Use probabilities in [0,1] whose sum is at most 1.";
      }
    });
    byId(id).addEventListener("change", function () { if (!brushValid) { updateBrush(); } });
  });
  lotterySvg.addEventListener("pointerdown", function (event) {
    if (event.button !== 0 || lotteryPointer !== null) { return; }
    event.preventDefault(); lotterySvg.focus({ preventScroll: true });
    lotteryPointer = event.pointerId;
    lotterySvg.setPointerCapture(event.pointerId);
    brush = C.lotteryPoint(lotterySvg, event); updateBrush();
  });
  lotterySvg.addEventListener("pointermove", function (event) {
    if (event.pointerId === lotteryPointer) { brush = C.lotteryPoint(lotterySvg, event); updateBrush(); }
  });
  ["pointerup", "pointercancel", "lostpointercapture"].forEach(function (name) {
    lotterySvg.addEventListener(name, function (event) {
      if (event.pointerId !== lotteryPointer) { return; }
      lotteryPointer = null;
      if (lotterySvg.hasPointerCapture(event.pointerId)) { lotterySvg.releasePointerCapture(event.pointerId); }
    });
  });
  lotterySvg.addEventListener("keydown", function (event) {
    var key = event.key.toLowerCase();
    var step = event.shiftKey ? 0.1 : 0.01;
    if (key === "home") { brush = [0, 0]; }
    else if (["arrowleft", "arrowright", "arrowup", "arrowdown"].indexOf(key) >= 0) {
      var index = key === "arrowleft" || key === "arrowright" ? 0 : 1;
      var delta = key === "arrowright" || key === "arrowup" ? step : -step;
      brush[index] = Number(NumberUtils.clamp(Math.round((brush[index] + delta) * 100) / 100, 0, 1 - brush[1 - index]).toFixed(12));
    } else { return; }
    event.preventDefault(); updateBrush();
  });
  // Native chart dimensions are reserved in HTML/CSS. Only a genuine change
  // in available width requires responsive text placement, never new content.
  byId("reset-button").addEventListener("click", function () {
    var active = stroke;
    stroke = null; heldKeys = {};
    if (active && active.kind === "pointer" && svg.hasPointerCapture(active.id)) { svg.releasePointerCapture(active.id); }
    grid = M.preset("efficient");
    render(); announce();
  });
  var widths = new WeakMap();
  var resize = new ResizeObserver(function (entries) {
    var changed = false;
    entries.forEach(function (entry) {
      var width = entry.contentRect.width;
      if (widths.get(entry.target) !== width) { widths.set(entry.target, width); changed = true; }
    });
    if (changed) { render(); C.lottery(lotterySvg, brush); }
  });
  document.querySelectorAll("#auction-demo svg[viewBox]").forEach(function (chart) {
    widths.set(chart, parseFloat(getComputedStyle(chart).width));
    resize.observe(chart);
  });
  var theme = window.matchMedia("(prefers-color-scheme: dark)");
  theme.addEventListener("change", function () { view.update(grid); C.lottery(lotterySvg, brush); });
  MechanismMath.typesetInitial("main");
  updateBrush();
  render();
}());
