(function (global) {
  "use strict";

  var model = global.BargainingSandboxModel;
  var math = global.MechanismMath;
  var numbers = global.NumberUtils;
  var svgUtils = global.SvgUtils;
  var visuals = global.BilateralTradeVisuals;
  var R = model.CUSTOM_RESOLUTION;
  var mesh = svgUtils.createTriangleMesh(R);
  var PREVIEW_RASTER_SIZE = 240;
  var DIAGNOSTIC_RASTER_SIZE = 330;
  var SURFACE_KEYS = Object.freeze(["q", "pB", "pS"]);
  var DIAGNOSTIC_KEYS = Object.freeze([
    "buyerIc", "sellerIc", "revenue",
    "buyerPayoff", "sellerPayoff", "efficiency"
  ]);
  var RENDER_KEYS = Object.freeze(SURFACE_KEYS.concat(DIAGNOSTIC_KEYS));
  var PRESET_KEYS = Object.freeze([
    "vcg", "posted-price", "agv", "split-the-difference",
    "chatterjee-samuelson", "revenue-threshold", "custom"
  ]);
  var PRESET_LABELS = Object.freeze({
    vcg: "VCG",
    "posted-price": "Posted price",
    agv: "AGV",
    "split-the-difference": "Split-the-difference",
    "chatterjee-samuelson": "Chatterjee-Samuelson",
    "revenue-threshold": "Revenue threshold",
    custom: "Custom"
  });
  var CONTROL_DEFINITIONS = Object.freeze({
    postedBuyerPrice: Object.freeze({
      prefix: "posted-buyer-price",
      preset: "posted-price",
      parameter: "buyerPrice",
      kind: "unit"
    }),
    postedSellerPrice: Object.freeze({
      prefix: "posted-seller-price",
      preset: "posted-price",
      parameter: "sellerPrice",
      kind: "unit"
    }),
    agvConstant: Object.freeze({
      prefix: "agv-constant",
      preset: "agv",
      parameter: "constant",
      kind: "signed"
    }),
    splitThreshold: Object.freeze({
      prefix: "split-threshold",
      preset: "split-the-difference",
      parameter: "threshold",
      kind: "unit"
    }),
    splitSellerShare: Object.freeze({
      prefix: "split-seller-share",
      preset: "split-the-difference",
      parameter: "sellerShare",
      kind: "unit"
    }),
    threshold: Object.freeze({
      prefix: "threshold",
      preset: "revenue-threshold",
      parameter: "threshold",
      kind: "unit"
    }),
    buyerMarkup: Object.freeze({
      prefix: "buyer-markup",
      preset: "revenue-threshold",
      parameter: "buyerMarkup",
      kind: "unit"
    }),
    sellerDiscount: Object.freeze({
      prefix: "seller-discount",
      preset: "revenue-threshold",
      parameter: "sellerDiscount",
      kind: "unit"
    })
  });
  var LAYOUT = {
    viewWidth: 480,
    viewHeight: 520,
    left: 70,
    right: 450,
    top: 40,
    bottom: 420
  };
  var elements = {};
  var controls = {};
  var surfaces = {};
  var diagnostics = {};
  var state = {
    activePreset: "vcg",
    parameters: {
      postedBuyerPrice: 0.5,
      postedSellerPrice: 0.5,
      agvConstant: 0.25,
      splitThreshold: 0,
      splitSellerShare: 0.5,
      threshold: 0.5,
      buyerMarkup: 0.5,
      sellerDiscount: 0.5
    },
    rule: null,
    summary: null,
    palette: null,
    generation: 0,
    liveRenderCount: 0,
    renderCounts: {
      q: 0, pB: 0, pS: 0, buyerIc: 0, sellerIc: 0,
      revenue: 0, buyerPayoff: 0, sellerPayoff: 0, efficiency: 0
    },
    qualityCounts: {
      q: 0, pB: 0, pS: 0, buyerIc: 0, sellerIc: 0,
      revenue: 0, buyerPayoff: 0, sellerPayoff: 0, efficiency: 0
    },
    previewFields: {},
    surfaceProbes: {
      q: { v: 0.5, c: 0.5, visible: false },
      pB: { v: 0.5, c: 0.5, visible: false },
      pS: { v: 0.5, c: 0.5, visible: false }
    },
    diagnosticProbes: {
      buyerIc: { x: 0.5, y: 0.5, visible: false },
      sellerIc: { x: 0.5, y: 0.5, visible: false },
      revenue: { x: 0.5, y: 0.5, visible: false },
      buyerPayoff: { x: 0.5, y: 0.5, visible: false },
      sellerPayoff: { x: 0.5, y: 0.5, visible: false },
      efficiency: { x: 0.5, y: 0.5, visible: false }
    },
    selected: { i: 0, j: 0, isLower: false },
    activeSurface: "q",
    brushes: { q: 0, pB: 0, pS: 0 },
    custom: createCustomState()
  };
  var pendingParameters = null;
  var pendingDependencies = {};
  var liveFrame = null;
  var activePointers = {};
  var pointerEndGeneration = {};
  var pendingQuality = {};
  var qualityQueue = [];
  var qualityFrame = null;
  var qualityToken = -1;

  var charts;
  var editor;

  document.addEventListener("DOMContentLoaded", initialize);

  function initialize() {
    elements = {
      root: byId("bargaining-sandbox-explorable"),
      validationStatus: byId("formula-validation-status"),
      probeStatus: byId("formula-probe-status"),
      diagnosticLiveStatus: byId("diagnostic-live-status"),
      parameterRow: document.querySelector(".sandbox-action-row"),
      fixIcIrControl: byId("fix-ic-ir-control"),
      fixIcIrCheckbox: byId("fix-ic-ir-checkbox"),
      presetButtons: {}
    };
    PRESET_KEYS.forEach(function (key) {
      elements.presetButtons[key] = byId("preset-" + key);
    });
    Object.keys(CONTROL_DEFINITIONS).forEach(function (key) {
      controls[key] = controlElements(CONTROL_DEFINITIONS[key].prefix);
      controls[key].container = byId(
        CONTROL_DEFINITIONS[key].prefix + "-control"
      );
    });
    surfaces = {
      q: surfaceElements("allocation", "Allocation rule, q(v,c)"),
      pB: surfaceElements("buyer-payment", "Buyer payment, p B(v,c)"),
      pS: surfaceElements("seller-payment", "Seller payment, p S(v,c)")
    };
    diagnostics = {
      buyerIc: {
        chart: byId("buyer-ic-chart"),
        text: byId("buyer-ic-text"),
        title: "Buyer interim-deviation payoff, U B(v,r)",
        kind: "ic",
        agent: "buyer"
      },
      sellerIc: {
        chart: byId("seller-ic-chart"),
        text: byId("seller-ic-text"),
        title: "Seller interim-deviation payoff, U S(c,s)",
        kind: "ic",
        agent: "seller"
      },
      revenue: {
        chart: byId("revenue-chart"),
        text: byId("revenue-text"),
        title: "Net revenue, R(v,c)",
        kind: "field"
      },
      buyerPayoff: {
        chart: byId("buyer-payoff-chart"),
        text: byId("buyer-payoff-text"),
        title: "Buyer truthful payoff, u B(v,c)",
        kind: "field"
      },
      sellerPayoff: {
        chart: byId("seller-payoff-chart"),
        text: byId("seller-payoff-text"),
        title: "Seller truthful payoff, u S(v,c)",
        kind: "field"
      },
      efficiency: {
        chart: byId("efficiency-chart"),
        text: byId("efficiency-text"),
        title: "Efficiency comparison",
        kind: "field"
      }
    };
    state.palette = visuals.readHeatmapPalette(
      global.getComputedStyle(document.documentElement)
    );
    state.rule = currentRule();
    state.summary = model.summarize(state.rule);
    var page = { elements: elements, surfaces: surfaces,
      diagnostics: diagnostics, presetLabels: PRESET_LABELS };
    var geometry = { mesh: mesh, layout: LAYOUT };
    charts = global.BargainingSandboxCharts.create(
      state, page, geometry,
      function (key) { return editor.isSurfaceEditable(key); }
    );
    editor = global.BargainingSandboxEditor.create(
      state, page, geometry, charts, {
        recomputeCustom: recomputeCustom,
        formatChoice: formatChoice, invalidateQuality: invalidateQuality
      }
    );

    math.typesetInitial(".introduction, .explorable, .mechanism-details");
    bindPresetButtons();
    bindControls();
    editor.bindCustomControls();
    syncPresetUi();
    charts.bindProbes();
    bindPaletteChanges();
    charts.drawSurface("q", PREVIEW_RASTER_SIZE);
    charts.drawSurface("pB", PREVIEW_RASTER_SIZE);
    charts.drawSurface("pS", PREVIEW_RASTER_SIZE);
    DIAGNOSTIC_KEYS.forEach(function (key) {
      charts.drawDiagnostic(key, PREVIEW_RASTER_SIZE);
    });
    charts.updateDiagnosticLiveStatus();
    syncRootState("initial");
    requestQuality(allRenderDependencies());
    document.body.dataset.bargainingSandboxReady = "true";
    global.BargainingSandboxApp = Object.freeze({
      snapshot: snapshot
    });
  }

  function bindPaletteChanges() {
    if (typeof global.matchMedia === "function") {
      ["(prefers-color-scheme: dark)", "print"].forEach(function (query) {
        var media = global.matchMedia(query);
        if (typeof media.addEventListener === "function") {
          media.addEventListener("change", refreshPalette);
        } else if (typeof media.addListener === "function") {
          media.addListener(refreshPalette);
        }
      });
    }
    global.addEventListener("beforeprint", refreshPalette);
    global.addEventListener("afterprint", refreshPalette);
  }

  function refreshPalette() {
    var palette = visuals.readHeatmapPalette(
      global.getComputedStyle(document.documentElement)
    );
    if (JSON.stringify(palette) === JSON.stringify(state.palette)) {
      return;
    }
    state.palette = palette;
    invalidateQuality();
    SURFACE_KEYS.forEach(function (key) {
      charts.drawSurface(key, PREVIEW_RASTER_SIZE);
    });
    DIAGNOSTIC_KEYS.forEach(function (key) {
      charts.drawDiagnostic(key, DIAGNOSTIC_RASTER_SIZE);
    });
    // Recolor the existing exact state; a palette event must not commit a stroke.
    if (state.activePreset === "custom") {
      elements.root.dataset.qualityStatus = "complete";
    } else {
      requestQuality(allRenderDependencies());
    }
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function controlElements(prefix) {
    return {
      slider: byId(prefix + "-slider"),
      number: byId(prefix + "-number")
    };
  }

  function surfaceElements(prefix, title) {
    return {
      chart: byId(prefix + "-chart"),
      slider: byId(prefix + "-value-slider"),
      number: byId(prefix + "-value-number"),
      endpoints: byId(prefix + "-range-endpoints"),
      controls: byId(prefix + "-edit-controls"),
      title: title
    };
  }

  function createCustomState() {
    return {
      q: model.createEfficientCustomAllocation(),
      manualPB: model.createCustomPaymentGrid(0),
      manualPS: model.createCustomPaymentGrid(0),
      derivedPayments: null,
      derivedRevision: -1,
      fixIcIr: false,
      qRevision: 0,
      pBRevision: 0,
      pSRevision: 0
    };
  }

  function currentRule() {
    if (state.activePreset === "custom") {
      return currentCustomRule();
    }
    if (state.activePreset === "vcg") {
      return model.createVcgRule();
    }
    if (state.activePreset === "posted-price") {
      return model.createPostedPriceRule(
        state.parameters.postedBuyerPrice,
        state.parameters.postedSellerPrice
      );
    }
    if (state.activePreset === "agv") {
      return model.createAgvRule(state.parameters.agvConstant);
    }
    if (state.activePreset === "split-the-difference") {
      return model.createSplitDifferenceRule(
        state.parameters.splitSellerShare,
        state.parameters.splitThreshold
      );
    }
    if (state.activePreset === "chatterjee-samuelson") {
      return model.createChatterjeeSamuelsonRule();
    }
    return model.createRevenueThresholdRule(
      state.parameters.threshold,
      state.parameters.buyerMarkup,
      state.parameters.sellerDiscount
    );
  }

  function currentCustomRule() {
    var custom = state.custom;
    if (custom.fixIcIr && custom.derivedRevision !== custom.qRevision) {
      custom.derivedPayments = model.zeroBoundaryPayments(custom.q);
      custom.derivedRevision = custom.qRevision;
    }
    return model.createCustomRule(
      custom.q,
      custom.fixIcIr ? custom.derivedPayments.pB : custom.manualPB,
      custom.fixIcIr ? custom.derivedPayments.pS : custom.manualPS,
      {
        q: custom.qRevision,
        pB: custom.pBRevision,
        pS: custom.pSRevision,
        paymentMode: custom.fixIcIr ? "fixed" : "manual"
      }
    );
  }

  function snapshot() {
    return Object.freeze({
      activePreset: state.activePreset,
      parameters: Object.freeze(Object.assign({}, state.parameters)),
      threshold: state.parameters.threshold,
      buyerMarkup: state.parameters.buyerMarkup,
      sellerDiscount: state.parameters.sellerDiscount,
      custom: Object.freeze({
        resolution: R,
        fixIcIr: state.custom.fixIcIr,
        activeSurface: state.activeSurface,
        selected: Object.freeze(Object.assign({}, state.selected)),
        brushes: Object.freeze(Object.assign({}, state.brushes)),
        qRevision: state.custom.qRevision,
        pBRevision: state.custom.pBRevision,
        pSRevision: state.custom.pSRevision,
        derivedRevision: state.custom.derivedRevision
      }),
      generation: state.generation,
      liveRenderCount: state.liveRenderCount,
      renderCounts: Object.freeze({
        q: state.renderCounts.q,
        pB: state.renderCounts.pB,
        pS: state.renderCounts.pS,
        buyerIc: state.renderCounts.buyerIc,
        sellerIc: state.renderCounts.sellerIc,
        revenue: state.renderCounts.revenue,
        buyerPayoff: state.renderCounts.buyerPayoff,
        sellerPayoff: state.renderCounts.sellerPayoff,
        efficiency: state.renderCounts.efficiency
      }),
      qualityCounts: Object.freeze({
        q: state.qualityCounts.q,
        pB: state.qualityCounts.pB,
        pS: state.qualityCounts.pS,
        buyerIc: state.qualityCounts.buyerIc,
        sellerIc: state.qualityCounts.sellerIc,
        revenue: state.qualityCounts.revenue,
        buyerPayoff: state.qualityCounts.buyerPayoff,
        sellerPayoff: state.qualityCounts.sellerPayoff,
        efficiency: state.qualityCounts.efficiency
      }),
      buyerIcStateKey: model.dependencyKey(state.rule, "buyerIc"),
      diagnosticStateKeys: Object.freeze({
        buyerIc: model.dependencyKey(state.rule, "buyerIc"),
        sellerIc: model.dependencyKey(state.rule, "sellerIc"),
        revenue: model.dependencyKey(state.rule, "revenue"),
        buyerPayoff: model.dependencyKey(state.rule, "buyerPayoff"),
        sellerPayoff: model.dependencyKey(state.rule, "sellerPayoff"),
        efficiency: model.dependencyKey(state.rule, "efficiency")
      })
    });
  }

  function allRenderDependencies() {
    var result = {};
    RENDER_KEYS.forEach(function (key) {
      result[key] = true;
    });
    return result;
  }

  function bindControls() {
    Object.keys(CONTROL_DEFINITIONS).forEach(bindControl);
  }

  function customDependencies(changedSurface) {
    var dependencies = {};
    if (changedSurface === "pB" && !state.custom.fixIcIr) {
      dependencies.buyerIc = true;
      dependencies.revenue = true;
      dependencies.buyerPayoff = true;
      return dependencies;
    }
    if (changedSurface === "pS" && !state.custom.fixIcIr) {
      dependencies.sellerIc = true;
      dependencies.revenue = true;
      dependencies.sellerPayoff = true;
      return dependencies;
    }
    if (changedSurface === "q" && state.custom.fixIcIr) {
      dependencies.pB = true;
      dependencies.pS = true;
    }
    if (changedSurface === "fix-ic-ir") {
      dependencies.pB = true;
      dependencies.pS = true;
    }
    DIAGNOSTIC_KEYS.forEach(function (key) {
      dependencies[key] = true;
    });
    return dependencies;
  }

  function recomputeCustom(reason, changedSurface) {
    if (state.activePreset !== "custom") {
      return;
    }
    var dependencies = customDependencies(changedSurface);
    invalidateQuality();
    state.rule = currentRule();
    state.summary = model.summarize(state.rule);
    SURFACE_KEYS.forEach(function (key) {
      if (dependencies[key]) {
        charts.drawSurface(key, PREVIEW_RASTER_SIZE);
      }
    });
    DIAGNOSTIC_KEYS.forEach(function (key) {
      if (dependencies[key]) {
        charts.drawDiagnostic(key, DIAGNOSTIC_RASTER_SIZE);
      }
    });
    charts.updateDiagnosticLiveStatus();
    state.liveRenderCount += 1;
    elements.root.dataset.liveRenderCount = String(state.liveRenderCount);
    elements.root.dataset.qualityStatus = "complete";
    syncRootState(Object.keys(dependencies).sort().join(" "));
  }

  function bindPresetButtons() {
    PRESET_KEYS.forEach(function (key) {
      elements.presetButtons[key].addEventListener("click", function () {
        selectPreset(key);
      });
    });
  }

  function syncPresetUi() {
    PRESET_KEYS.forEach(function (key) {
      elements.presetButtons[key].setAttribute(
        "aria-pressed", String(key === state.activePreset)
      );
    });
    var visibleCount = 0;
    Object.keys(CONTROL_DEFINITIONS).forEach(function (key) {
      var visible = CONTROL_DEFINITIONS[key].preset === state.activePreset;
      controls[key].container.hidden = !visible;
      if (visible) {
        visibleCount += 1;
      }
    });
    elements.fixIcIrControl.hidden = state.activePreset !== "custom";
    elements.fixIcIrCheckbox.checked = state.custom.fixIcIr;
    elements.parameterRow.hidden = visibleCount === 0 &&
      state.activePreset !== "custom";
    editor.syncEditingState();
    editor.syncSurfaceControls();
  }

  function selectPreset(key) {
    if (key === state.activePreset) {
      return;
    }
    if (liveFrame !== null) {
      global.cancelAnimationFrame(liveFrame);
      liveFrame = null;
    }
    // Preserve an input accepted before its coalesced render when switching presets.
    if (pendingParameters) {
      state.parameters = pendingParameters;
    }
    pendingParameters = null;
    pendingDependencies = {};
    activePointers = {};
    invalidateQuality();
    state.activePreset = key;
    if (key === "custom") {
      state.activeSurface = "q";
    }
    state.rule = currentRule();
    state.summary = model.summarize(state.rule);
    syncPresetUi();
    RENDER_KEYS.forEach(function (renderKey) {
      if (SURFACE_KEYS.indexOf(renderKey) >= 0) {
        charts.drawSurface(renderKey, PREVIEW_RASTER_SIZE);
      } else {
        charts.drawDiagnostic(
          renderKey,
          key === "custom" ? DIAGNOSTIC_RASTER_SIZE : PREVIEW_RASTER_SIZE
        );
      }
    });
    charts.updateDiagnosticLiveStatus();
    state.liveRenderCount += 1;
    elements.root.dataset.liveRenderCount = String(state.liveRenderCount);
    syncRootState("preset");
    if (key === "custom") {
      elements.root.dataset.qualityStatus = "complete";
    } else {
      requestQuality(allRenderDependencies());
    }
  }

  function bindControl(key) {
    var control = controls[key];
    var definition = CONTROL_DEFINITIONS[key];
    control.slider.addEventListener("pointerdown", function () {
      activePointers[key] = true;
      pointerEndGeneration[key] = -1;
      invalidateQuality();
    });
    control.slider.addEventListener("input", function () {
      var value = parameterChoice(definition, control.slider.value);
      syncControl(key, value);
      scheduleLiveParameter(key, value);
    });
    control.slider.addEventListener("pointerup", function () {
      finishPointerGesture(key);
    });
    control.slider.addEventListener("pointercancel", function () {
      finishPointerGesture(key);
    });
    control.slider.addEventListener("change", function () {
      if (activePointers[key]) {
        return;
      }
      if (pointerEndGeneration[key] !== state.generation) {
        requestQuality(pendingOrParameterDependencies(key));
      }
    });
    control.number.addEventListener("change", function () {
      var value = control.number.valueAsNumber;
      if (!validParameterValue(definition, value)) {
        elements.validationStatus.textContent = definition.kind === "unit" ?
          "Enter a number from 0 to 1 in hundredth steps." :
          "Enter a finite AGV constant within the diagnostic range.";
        syncControl(key, state.parameters[key]);
        return;
      }
      value = parameterChoice(definition, value);
      elements.validationStatus.textContent = "";
      syncControl(key, value);
      scheduleLiveParameter(key, value);
      requestQuality(pendingOrParameterDependencies(key));
    });
  }

  function finishPointerGesture(key) {
    activePointers[key] = false;
    pointerEndGeneration[key] = state.generation;
    requestQuality(pendingOrParameterDependencies(key));
  }

  function unitChoice(value) {
    return numbers.clamp(Math.round(Number(value) * 100) / 100, 0, 1);
  }

  function parameterChoice(definition, value) {
    if (definition.kind === "unit") {
      return unitChoice(value);
    }
    return Math.round(Number(value) * 100) / 100;
  }

  function validParameterValue(definition, value) {
    return Number.isFinite(value) && Math.abs(value) <= 1e140 &&
      (definition.kind !== "unit" || value >= 0 && value <= 1);
  }

  function formatChoice(value) {
    return String(Number(value.toFixed(2)));
  }

  function syncControl(key, value) {
    if (CONTROL_DEFINITIONS[key].kind === "signed") {
      var slider = controls[key].slider;
      var extent = Math.max(
        Math.abs(Number(slider.min)), Math.abs(Number(slider.max)), Math.abs(value)
      );
      slider.min = String(-extent);
      slider.max = String(extent);
      var endpoints = byId(CONTROL_DEFINITIONS[key].prefix + "-endpoints");
      endpoints.children[0].textContent = formatChoice(Number(slider.min));
      endpoints.children[1].textContent = formatChoice(Number(slider.max));
    }
    controls[key].slider.value = String(value);
    controls[key].number.value = formatChoice(value);
  }

  function dependenciesForParameter(key) {
    var result = {};
    var parameter = CONTROL_DEFINITIONS[key].parameter;
    RENDER_KEYS.forEach(function (renderKey) {
      if (model.fieldDependencies(state.rule, renderKey)
          .indexOf(parameter) >= 0) {
        result[renderKey] = true;
      }
    });
    return result;
  }

  function pendingOrParameterDependencies(key) {
    var result = {};
    mergeDependencies(result, pendingDependencies);
    mergeDependencies(result, dependenciesForParameter(key));
    return result;
  }

  function mergeDependencies(target, source) {
    Object.keys(source).forEach(function (key) {
      if (source[key]) {
        target[key] = true;
      }
    });
  }

  function scheduleLiveParameter(key, value) {
    invalidateQuality();
    if (!pendingParameters) {
      pendingParameters = Object.assign({}, state.parameters);
    }
    pendingParameters[key] = value;
    mergeDependencies(pendingDependencies, dependenciesForParameter(key));
    elements.root.dataset.pendingGeneration = String(state.generation);
    if (liveFrame === null) {
      liveFrame = global.requestAnimationFrame(commitLiveParameters);
    }
  }

  function invalidateQuality() {
    state.generation += 1;
    qualityQueue = [];
    pendingQuality = {};
    qualityToken = -1;
    if (qualityFrame !== null) {
      global.cancelAnimationFrame(qualityFrame);
      qualityFrame = null;
    }
    if (elements.root) {
      elements.root.dataset.qualityStatus = "idle";
    }
  }

  function commitLiveParameters() {
    liveFrame = null;
    if (!pendingParameters) {
      return;
    }
    var dependencies = pendingDependencies;
    state.parameters = pendingParameters;
    pendingParameters = null;
    pendingDependencies = {};
    state.rule = currentRule();
    state.summary = model.summarize(state.rule);
    if (dependencies.q) {
      charts.drawSurface("q", PREVIEW_RASTER_SIZE);
    }
    if (dependencies.pB) {
      charts.drawSurface("pB", PREVIEW_RASTER_SIZE);
    }
    if (dependencies.pS) {
      charts.drawSurface("pS", PREVIEW_RASTER_SIZE);
    }
    DIAGNOSTIC_KEYS.forEach(function (key) {
      if (dependencies[key]) {
        charts.drawDiagnostic(key, PREVIEW_RASTER_SIZE);
      }
    });
    charts.updateDiagnosticLiveStatus();
    state.liveRenderCount += 1;
    elements.root.dataset.liveRenderCount = String(state.liveRenderCount);
    syncRootState(Object.keys(dependencies).sort().join(" "));
    if (Object.keys(pendingQuality).length > 0 && !hasActivePointer()) {
      startQualityWork();
    }
  }

  function syncRootState(dependencies) {
    elements.root.dataset.activePreset = state.activePreset;
    elements.root.dataset.postedBuyerPrice =
      String(state.parameters.postedBuyerPrice);
    elements.root.dataset.postedSellerPrice =
      String(state.parameters.postedSellerPrice);
    elements.root.dataset.agvConstant = String(state.parameters.agvConstant);
    elements.root.dataset.splitThreshold =
      String(state.parameters.splitThreshold);
    elements.root.dataset.splitSellerShare =
      String(state.parameters.splitSellerShare);
    elements.root.dataset.threshold = String(state.parameters.threshold);
    elements.root.dataset.buyerMarkup = String(state.parameters.buyerMarkup);
    elements.root.dataset.sellerDiscount = String(state.parameters.sellerDiscount);
    elements.root.dataset.lastLiveDependencies = dependencies;
    elements.root.dataset.appliedGeneration = String(state.generation);
    elements.root.dataset.customFixIcIr = String(state.custom.fixIcIr);
    elements.root.dataset.customQRevision = String(state.custom.qRevision);
    elements.root.dataset.customPBRevision = String(state.custom.pBRevision);
    elements.root.dataset.customPSRevision = String(state.custom.pSRevision);
  }

  function hasActivePointer() {
    return Object.keys(activePointers).some(function (key) {
      return activePointers[key];
    });
  }

  function requestQuality(dependencies) {
    mergeDependencies(pendingQuality, dependencies);
    mergeDependencies(pendingQuality, state.previewFields);
    if (liveFrame === null && !hasActivePointer()) {
      startQualityWork();
    }
  }

  function startQualityWork() {
    if (qualityFrame !== null || qualityQueue.length > 0 ||
        Object.keys(pendingQuality).length === 0) {
      return;
    }
    qualityToken = state.generation;
    RENDER_KEYS.forEach(function (key) {
      if (pendingQuality[key]) {
        qualityQueue.push(key);
      }
    });
    pendingQuality = {};
    elements.root.dataset.qualityStatus = "scheduled";
    elements.root.dataset.qualityGeneration = String(qualityToken);
    qualityFrame = global.requestAnimationFrame(runQualityTask);
  }

  function runQualityTask() {
    qualityFrame = null;
    if (qualityToken !== state.generation) {
      qualityQueue = [];
      elements.root.dataset.qualityStatus = "superseded";
      return;
    }
    var key = qualityQueue.shift();
    if (SURFACE_KEYS.indexOf(key) >= 0) {
      charts.upgradeSurfaceRaster(key, qualityToken);
    } else {
      charts.upgradeDiagnosticRaster(key, qualityToken);
    }
    if (qualityToken !== state.generation) {
      qualityQueue = [];
      elements.root.dataset.qualityStatus = "superseded";
      return;
    }
    if (qualityQueue.length > 0) {
      elements.root.dataset.qualityStatus = "running";
      qualityFrame = global.requestAnimationFrame(runQualityTask);
      return;
    }
    elements.root.dataset.qualityStatus = "complete";
    if (Object.keys(pendingQuality).length > 0 && !hasActivePointer()) {
      startQualityWork();
    }
  }

}(window));
