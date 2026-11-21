(function () {
  "use strict";
  var state = { gammaB: 0.25, gammaS: 0.25, epsilon: 1, k: 0.5 };
  var parameters = ["gammaB", "gammaS", "epsilon", "k"];
  var labels = { gammaB: "buyer lying cost", gammaS: "seller lying cost", epsilon: "support overlap", k: "buyer-report weight" };
  var activePreset = "minimum-rent";
  var pending = null;
  var frame = null;
  var qualityFrame = null;
  var rule = null;
  var count = 0;
  var root = document.getElementById("lying-cost-explorable");
  var charts = LyingCostCharts.create(document.getElementById("surfaces"), document.getElementById("diagnostics"));
  function set(id, text) { document.getElementById(id).textContent = text; }
  function controls() {
    parameters.forEach(function (name) {
      document.getElementById(name + "-slider").value = state[name];
      document.getElementById(name + "-number").value = state[name];
    });
    document.getElementById("k-control").hidden = activePreset !== "split-the-difference";
  }
  function render(quality) {
    rule = LyingCostModel.create(state, activePreset);
    charts.render(rule, quality);
    var t = rule.totals, format = charts.number;
    set("live-status", LyingCostModel.presets[activePreset].label + ". Buyer lying cost " + format(state.gammaB) + "; seller lying cost " + format(state.gammaS) +
      (activePreset === "split-the-difference" ? "; k " + format(state.k) : "") +
      "; epsilon " + format(state.epsilon) + ". BIC: " + (t.buyerBIC && t.sellerBIC ? "passes" : "fails") +
      ". DSIC: " + (t.buyerDSIC && t.sellerDSIC ? "passes" : "fails") +
      ". Expected revenue under truthful reporting " + format(t.revenue) + ".");
    root.dataset.preset = activePreset;
    root.dataset.implementable = t.implementable;
    root.dataset.gammaB = state.gammaB;
    root.dataset.gammaS = state.gammaS;
    root.dataset.k = state.k;
    root.dataset.epsilon = state.epsilon;
    root.dataset.liveRenderCount = ++count;
  }
  function commit() {
    frame = null;
    if (!pending) { return; }
    state = pending;
    pending = null;
    controls();
    render("preview");
  }
  function schedule(name, value) {
    if (qualityFrame !== null) { cancelAnimationFrame(qualityFrame); qualityFrame = null; }
    pending = Object.assign({}, pending || state);
    pending[name] = value;
    if (frame === null) { frame = requestAnimationFrame(commit); }
  }
  function finishGesture() {
    if (qualityFrame !== null) { cancelAnimationFrame(qualityFrame); }
    qualityFrame = requestAnimationFrame(function () {
      qualityFrame = null;
      if (pending) { if (frame !== null) { cancelAnimationFrame(frame); } commit(); }
      charts.render(rule, "final");
    });
  }
  parameters.forEach(function (name) {
    var slider = document.getElementById(name + "-slider");
    var input = document.getElementById(name + "-number");
    slider.addEventListener("input", function () { input.value = slider.value; schedule(name, Number(slider.value)); });
    slider.addEventListener("change", finishGesture);
    slider.addEventListener("pointercancel", finishGesture);
    slider.addEventListener("blur", finishGesture);
    function validate() {
      var value = input.valueAsNumber;
      if (!Number.isFinite(value) || value < 0 || value > 1) {
        input.setAttribute("aria-invalid", "true");
        set("input-error", "Enter a number from 0 to 1 for " + labels[name] + ".");
        return;
      }
      input.removeAttribute("aria-invalid");
      set("input-error", "");
      slider.value = value;
      schedule(name, value);
    }
    input.addEventListener("input", validate);
    input.addEventListener("change", function () { validate(); finishGesture(); });
    input.addEventListener("blur", function () {
      if (input.getAttribute("aria-invalid") === "true") {
        input.value = (pending || state)[name];
        input.removeAttribute("aria-invalid");
        set("input-error", "");
      }
    });
  });
  Object.keys(LyingCostModel.presets).forEach(function (id) {
    var button = document.createElement("button");
    button.id = "preset-" + id;
    button.type = "button";
    button.className = "text-button preset-button";
    button.textContent = LyingCostModel.presets[id].label;
    button.setAttribute("aria-pressed", String(id === activePreset));
    button.addEventListener("click", function () {
      if (frame !== null) { cancelAnimationFrame(frame); frame = null; }
      if (qualityFrame !== null) { cancelAnimationFrame(qualityFrame); qualityFrame = null; }
      if (pending) { state = pending; pending = null; }
      activePreset = id;
      document.querySelectorAll(".preset-button").forEach(function (item) {
        item.setAttribute("aria-pressed", String(item === button));
      });
      controls();
      render("final");
    });
    document.getElementById("preset-buttons").appendChild(button);
  });
  function recolor() { charts.render(rule, "final", true); }
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", recolor);
  window.addEventListener("beforeprint", recolor);
  window.addEventListener("afterprint", recolor);
  controls();
  render("final");
  MechanismMath.typesetInitial("main");
})();
