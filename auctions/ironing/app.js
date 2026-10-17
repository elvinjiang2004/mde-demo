(function () {
  "use strict";
  var M = IroningModel, C = IroningCharts, clamp = NumberUtils.clamp;
  function el(id) { return document.getElementById(id); }
  var state = { n: 2, distribution: M.defaultDistribution, points: M.initial(2), selected: 5, drag: null, chosen: null };
  var charts = {
    allocation: C.create(el("allocation-chart"), [0, 1], [0, 0.5, 1]),
    payment: C.create(el("payment-chart"), [-1, 1], [-1, 0, 1]),
    integrated: C.create(el("integrated-chart"), [-0.2, 0], [-0.2, -0.1, 0]),
    feasibility: C.create(el("feasibility-chart"), [0, 2], [0, 1, 2])
  };
  var benchmark = M.benchmark(state.n, state.distribution), announceTimer = null;
  function fixed(x) { return (Math.abs(x) < 0.0000005 ? 0 : x).toFixed(6); }
  function cancelDrag() {
    var pointerId = state.drag, svg = el("allocation-chart");
    state.drag = null;
    if (pointerId !== null && svg.hasPointerCapture(pointerId)) { svg.releasePointerCapture(pointerId); }
  }
  function limits() {
    var i = state.selected, points = state.points;
    var lower = i ? points[i - 1].v : 0, upper = i < points.length - 1 ? points[i + 1].v : 1;
    if (i > 1 && points[i - 2].v === lower) { lower += Math.min(0.000001, (upper - lower) / 3); }
    if (i < points.length - 2 && points[i + 2].v === upper) { upper -= Math.min(0.000001, (upper - lower) / 3); }
    return { lower: lower, upper: upper, endpoint: i === 0 || i === points.length - 1 };
  }
  function syncControls() {
    var p = state.points[state.selected], bound = limits();
    el("allocation-chart").dataset.selectedIndex = state.selected;
    var valueNumber = el("value-number"), valueRange = el("value-range");
    valueNumber.min = bound.lower.toFixed(3); valueNumber.max = bound.upper.toFixed(3);
    valueRange.min = bound.lower; valueRange.max = bound.upper;
    valueNumber.disabled = valueRange.disabled = bound.endpoint;
    // Formatting never writes the rounded display back into the chosen rule.
    valueNumber.value = p.v.toFixed(3); valueRange.value = p.v;
    el("allocation-number").value = p.q.toFixed(3); el("allocation-range").value = p.q;
    el("value-range").setAttribute("aria-valuetext", "Value " + p.v.toFixed(3));
    el("allocation-range").setAttribute("aria-valuetext", "Allocation probability " + p.q.toFixed(3));
    el("bidder-number").value = state.n;
    ["split", "mass"].forEach(function (name) {
      ["number", "range"].forEach(function (kind) { el(name + "-" + kind).value = state.distribution[name]; });
    });
    el("split-range").setAttribute("aria-valuetext", "Breakpoint value " + state.distribution.split.toFixed(4));
    el("mass-range").setAttribute("aria-valuetext", (100 * state.distribution.mass).toFixed(2) + "% probability below the breakpoint");
    el("value-min-label").textContent = bound.lower.toFixed(3);
    el("value-max-label").textContent = bound.upper.toFixed(3);
    el("remove-point").disabled = bound.endpoint;
    el("add-point").disabled = state.points.length >= 32;
    // Every field now displays the accepted state, so previous input errors are resolved.
    el("control-error").textContent = "";
    el("distribution-error").textContent = "";
  }
  function currentRule() {
    var rule = state.chosen ? M.adoptedRule(state.chosen, state.n, state.distribution) : M.diagnose(state.points, state.n, state.distribution);
    rule.points = state.points;
    return rule;
  }
  function render() {
    var rule = currentRule();
    C.render(charts, rule, benchmark, state.selected);
    C.density(el("value-pdf-preview"), state.distribution);
    el("distribution-status").textContent = benchmark.ironing.intervals.length ? "Irregular distribution" : "Regular distribution";
    syncControls();
    var ic = el("bic-status"), feasible = el("feasibility-status");
    ic.dataset.passed = rule.monotone;
    el("bic-verdict").textContent = rule.monotone ? "BIC: passes" : "BIC: fails";
    el("bic-monotonicity").textContent = rule.monotone ? "is weakly increasing" : "is not weakly increasing";
    feasible.dataset.passed = rule.feasibility.feasible;
    feasible.textContent = rule.feasibility.feasible ? "Feasibility: passes (all capacity constraints hold)" : "Feasibility: fails (allocation exceeds capacity)";
    el("revenue-label").textContent = rule.valid ? "Expected revenue" : "Candidate revenue";
    el("payment-caption").textContent = rule.valid ? "Interim payment" : "Candidate interim payment";
    el("payment-kind").textContent = rule.valid ? "Zero lowest-type utility" : "Envelope candidate; truthful implementation fails";
    el("revenue-value").textContent = fixed(rule.revenue);
    el("revenue-value").dataset.value = rule.revenue;
    el("interpolation-kind").textContent = state.chosen ? "Exact optimal curves; editing connects displayed points linearly in value." : "Interpolation: linear in value.";
    el("pool-summary").textContent = benchmark.ironing.intervals.length ? benchmark.ironing.intervals.map(function (p) {
      return "Optimal ironing quantile: [" + p.lower.toFixed(4) + ", " + p.upper.toFixed(4) + "] (corresponds to [" +
        p.a.toFixed(4) + ", " + p.b.toFixed(4) + "] on value axis)";
    }).join("; ") : "Optimal ironing quantile: none (virtual values are nondecreasing)";
    el("allocation-description").textContent = ic.textContent + (rule.monotone ? "; Q is nondecreasing. " :
      "; Q decreases between v = " + rule.monotonicityWitness.from.toFixed(3) + " and " + rule.monotonicityWitness.to.toFixed(3) + ". ") +
      state.points.length + " draggable points. " + el("interpolation-kind").textContent + " " +
      "Solid blue is allocation; vertical scale 0 to 1. Positive pooling intervals are shaded.";
    el("payment-description").textContent = el("payment-kind").textContent + ". Payment is plotted against value v. Dotted jump guides connect open left limits to filled right-continuous values. Total expected revenue across all bidders: " + fixed(rule.revenue) + "; fixed vertical scale from −1 to 1.";
    el("integrated-description").textContent = "Lower-tail quantile u=F(v), from 0 to 1. Solid black is H(u), the integral from 0 to u of virtual value at inverse F, on the left scale " +
      charts.integrated.domain[0] + " to 0. Dashed gray is raw virtual value on the right scale " + el("integrated-chart").dataset.y2Min +
      " to 1, labeled phi composed with inverse F, with separate one-sided branches at the density breakpoint. " +
      "Dotted orange shows the lower convex hull of H and the ironed virtual value only inside each shaded ironing interval, including those below the sale cutoff. " + el("pool-summary").textContent;
    el("feasibility-description").textContent = feasible.textContent + "; all allocation-level sets are checked. Witness mass " + fixed(1 - rule.feasibility.witness.u) +
      ", capacity excess " + fixed(rule.feasibility.witness.excess) +
      ". Blue is n times the allocation integral over the highest-allocation type mass; dotted black is 1 minus (1 minus mass) to the power n.";
    clearTimeout(announceTimer);
    announceTimer = setTimeout(function () { el("live-summary").textContent = el("distribution-status").textContent + ". " + ic.textContent + ". " + feasible.textContent + ". " + el("revenue-label").textContent + " " + fixed(rule.revenue) + ". " + el("pool-summary").textContent; }, 180);
    document.body.dataset.ready = "true";
  }
  function edit(v, q) {
    var bound = limits(), p = state.points[state.selected];
    v = bound.endpoint ? p.v : clamp(v, bound.lower, bound.upper);
    q = clamp(q, 0, 1);
    // Clamping or moving an endpoint horizontally must not linearize an exact rule.
    if (v !== p.v || q !== p.q) {
      state.chosen = null;
      p.v = v; p.q = q;
    }
    render();
  }
  function bindNumberPair(prefix, update, errorId) {
    ["number", "range"].forEach(function (kind) {
      var input = el(prefix + "-" + kind);
      input.addEventListener("input", function () {
        cancelDrag();
        if (input.value.trim() === "" || !Number.isFinite(input.valueAsNumber)) {
          el(errorId || "control-error").textContent = "Enter a finite number."; return;
        }
        update(input.valueAsNumber);
      });
      input.addEventListener("change", function () { syncControls(); });
    });
  }
  bindNumberPair("value", function (v) { edit(v, state.points[state.selected].q); });
  bindNumberPair("allocation", function (q) { edit(state.points[state.selected].v, q); });
  el("bidder-number").addEventListener("input", function () {
    cancelDrag(); state.n = clamp(Math.round(Number(this.value)), 2, 5); benchmark = M.benchmark(state.n, state.distribution);
    render();
  });
  function changeDistribution(split, mass) {
    cancelDrag();
    var next = M.distribution(clamp(split, 0.1, 0.9), clamp(mass, 0.1, 0.9));
    state.distribution = next; benchmark = M.benchmark(state.n, next);
    render();
  }
  bindNumberPair("split", function (v) { changeDistribution(v, state.distribution.mass); }, "distribution-error");
  bindNumberPair("mass", function (p) { changeDistribution(state.distribution.split, p); }, "distribution-error");
  el("reset-parameters").addEventListener("click", function () {
    state.n = 2; changeDistribution(M.defaultDistribution.split, M.defaultDistribution.mass);
  });
  el("use-optimum").addEventListener("click", function () {
    cancelDrag(); state.chosen = benchmark; state.points = M.optimalPoints(benchmark);
    state.selected = Math.floor(state.points.length / 2); render();
  });
  el("reset-button").addEventListener("click", function () {
    cancelDrag(); state.chosen = null; state.points = M.initial(state.n, state.distribution); state.selected = Math.floor(state.points.length / 2);
    render();
  });
  el("add-point").addEventListener("click", function () {
    cancelDrag();
    if (state.points.length >= 32) { return; }
    var i = Math.min(state.selected, state.points.length - 2);
    if (state.points[i + 1].v - state.points[i].v < 0.00001) {
      i = state.points.findIndex(function (p, j) { return j < state.points.length - 1 && state.points[j + 1].v - p.v > 0.00001; });
    }
    if (i < 0) { return; }
    var v = (state.points[i].v + state.points[i + 1].v) / 2;
    var q = M.evaluate(currentRule(), v).q;
    state.points.splice(i + 1, 0, { v: v, q: q }); state.selected = i + 1; render();
  });
  el("remove-point").addEventListener("click", function () {
    if (limits().endpoint) { return; }
    cancelDrag(); state.chosen = null; state.points.splice(state.selected, 1); state.selected = Math.min(state.selected, state.points.length - 1); render();
  });
  var svg = el("allocation-chart");
  svg.addEventListener("focusin", function (event) {
    var handle = event.target.closest("[data-index]");
    if (handle && state.selected !== Number(handle.dataset.index)) { state.selected = Number(handle.dataset.index); render(); }
  });
  svg.addEventListener("pointerdown", function (event) {
    var handle = event.target.closest("[data-index]");
    if (!handle || event.button !== 0) { return; }
    event.preventDefault(); state.selected = Number(handle.dataset.index); handle.focus();
    state.drag = event.pointerId; svg.setPointerCapture(event.pointerId); render();
  });
  svg.addEventListener("pointermove", function (event) {
    if (state.drag !== event.pointerId) { return; }
    var p = C.pointer(svg, event); edit(p.v, p.q);
  });
  function endDrag(event) {
    if (state.drag !== event.pointerId) { return; }
    cancelDrag();
  }
  ["pointerup", "pointercancel", "lostpointercapture"].forEach(function (type) { svg.addEventListener(type, endDrag); });
  svg.addEventListener("keydown", function (event) {
    var handle = event.target.closest("[data-index]");
    if (!handle) { return; }
    var index = Number(handle.dataset.index), step = event.shiftKey ? 0.02 : 0.002;
    var p = state.points[index], v = p.v, q = p.q;
    if (event.key === "ArrowUp") { q += step; }
    else if (event.key === "ArrowDown") { q -= step; }
    else if (event.key === "ArrowLeft") { v -= step; }
    else if (event.key === "ArrowRight") { v += step; }
    else if (event.key === "Home") { q = 0; }
    else if (event.key === "End") { q = 1; }
    else if (event.key === "Escape") { cancelDrag(); return; }
    else { return; }
    event.preventDefault(); cancelDrag(); state.selected = index; edit(v, q);
  });
  render();
  MechanismMath.typesetInitial(".introduction, #distribution-controls, #auction-demo");
})();
