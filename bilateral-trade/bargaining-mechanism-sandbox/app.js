(function () {
  "use strict";

  var model = window.BargainingSandboxModel;
  var math = window.MechanismMath;
  var numbers = window.NumberUtils;
  var visuals = window.BilateralTradeVisuals;
  var appendSvg = window.SvgUtils.appendSvg;
  var createFieldRaster = window.SvgUtils.createFieldRaster;
  var plotPointFromEvent = visuals.plotPointFromEvent;
  var formatProbe = visuals.formatProbe;
  var R = model.CELL_RESOLUTION;
  var CELL_SIZE = model.CELL_SIZE;
  var mesh = window.SvgUtils.createTriangleMesh(R);
  var CUSTOM_SURFACE_RASTER_SIZE = 240;
  var PRESET_PREVIEW_RASTER_SIZE = 240;
  var PRESET_SURFACE_RASTER_SIZE = 800;
  var PRESET_COMMIT_DELAY_MS = 200;
  var DIAGNOSTIC_RASTER_SIZE = visuals.DIAGNOSTIC_RASTER_SIZE;
  var PRESET_CACHE_LIMIT = 4;
  var RASTER_CACHE_LIMIT = 48;

  var MAIN_LAYOUT = {
    viewWidth: 480,
    viewHeight: 520,
    left: 70,
    right: 450,
    top: 40,
    bottom: 420
  };
  var DIAG_LAYOUT = MAIN_LAYOUT;
  var elements = {};
  var surfaces = {};
  var state = {
    rule: null,
    selected: { i: 0, j: 0, isLower: true },
    activeSurface: "q",
    brushes: { q: 0, pB: 0, pS: 0 },
    activePreset: "vcg",
    postedBuyerPrice: 0.5,
    postedSellerReceipt: 0.5,
    agvK: 0.25,
    splitThreshold: 0,
    splitSellerShare: 0.5,
    revenueThreshold: 0.5,
    revenueBuyerMarkup: 0.5,
    revenueSellerDiscount: 0.5,
    presetPreview: false,
    custom: null,
    renderKey: "preset:vcg",
    lastSummary: null,
    lastSummaryKey: null,
    diagnosticRule: null,
    heatmapPalette: null,
    surfaceProbe: { key: "q", v: 0.5, c: 0.5, visible: false },
    icProbe: {
      buyer: { trueType: 0.5, report: 0.5, visible: false },
      seller: { trueType: 0.5, report: 0.5, visible: false }
    },
    fieldProbe: {
      buyerPayoff: { v: 0.5, c: 0.5, visible: false },
      sellerPayoff: { v: 0.5, c: 0.5, visible: false },
      revenue: { v: 0.5, c: 0.5, visible: false },
      efficiency: { v: 0.5, c: 0.5, visible: false }
    }
  };
  var dragState = null;
  var repaintRequested = false;
  var presetUpdateRequested = false;
  var pendingPreset = null;
  var presetSliderDrag = null;
  var presetCommitTimer = null;
  var pendingPresetCommit = null;
  var presetCache = {};
  var presetCacheOrder = [];
  var rasterCache = {};
  var rasterCacheOrder = [];
  var pendingSurfaceKeys = {};
  var keyboardPaintState = {
    key: null,
    enter: false,
    space: false,
    dirty: false
  };

  document.addEventListener("DOMContentLoaded", initialize);

  function initialize() {
    elements = {
      presetVcg: byId("preset-vcg"),
      presetPostedPrice: byId("preset-posted-price"),
      presetAgv: byId("preset-agv"),
      presetSplitDifference: byId("preset-split-difference"),
      presetChatterjeeSamuelson: byId("preset-chatterjee-samuelson"),
      presetRevenueThreshold: byId("preset-revenue-threshold"),
      presetCustom: byId("preset-custom"),
      postedPriceControl: byId("posted-price-control"),
      postedBuyerPriceSlider: byId("posted-buyer-price-slider"),
      postedBuyerPriceNumber: byId("posted-buyer-price-number"),
      postedSellerReceiptControl: byId("posted-seller-receipt-control"),
      postedSellerReceiptSlider: byId("posted-seller-receipt-slider"),
      postedSellerReceiptNumber: byId("posted-seller-receipt-number"),
      agvKControl: byId("agv-k-control"),
      agvKSlider: byId("agv-k-slider"),
      agvKNumber: byId("agv-k-number"),
      agvKEndpoints: byId("agv-k-endpoints"),
      splitThresholdControl: byId("split-threshold-control"),
      splitThresholdSlider: byId("split-threshold-slider"),
      splitThresholdNumber: byId("split-threshold-number"),
      splitSellerShareControl: byId("split-seller-share-control"),
      splitSellerShareSlider: byId("split-seller-share-slider"),
      splitSellerShareNumber: byId("split-seller-share-number"),
      revenueThresholdControl: byId("revenue-threshold-control"),
      revenueThresholdSlider: byId("revenue-threshold-slider"),
      revenueThresholdNumber: byId("revenue-threshold-number"),
      revenueBuyerMarkupControl: byId("revenue-buyer-markup-control"),
      revenueBuyerMarkupSlider: byId("revenue-buyer-markup-slider"),
      revenueBuyerMarkupNumber: byId("revenue-buyer-markup-number"),
      revenueSellerDiscountControl: byId("revenue-seller-discount-control"),
      revenueSellerDiscountSlider: byId("revenue-seller-discount-slider"),
      revenueSellerDiscountNumber: byId("revenue-seller-discount-number"),
      validationStatus: byId("sandbox-validation-status"),
      fixIcIrControl: byId("fix-ic-ir-control"),
      fixIcIrCheckbox: byId("fix-ic-ir-checkbox"),
      buyerIcChart: byId("buyer-ic-chart"),
      buyerIcText: byId("buyer-ic-text"),
      sellerIcChart: byId("seller-ic-chart"),
      sellerIcText: byId("seller-ic-text"),
      buyerPayoffChart: byId("buyer-payoff-chart"),
      buyerPayoffText: byId("buyer-payoff-text"),
      sellerPayoffChart: byId("seller-payoff-chart"),
      sellerPayoffText: byId("seller-payoff-text"),
      revenueChart: byId("revenue-chart"),
      revenueText: byId("revenue-text"),
      efficiencyChart: byId("efficiency-chart"),
      efficiencyText: byId("efficiency-text"),
      surfaceProbeStatus: byId("surface-probe-status"),
      icProbeStatus: byId("ic-probe-status"),
      liveSummary: byId("live-summary")
    };
    surfaces = {
      q: surfaceElements("allocation", "Allocation rule, q(v,c)"),
      pB: surfaceElements("buyer-payment", "Buyer payment, p B(v,c)"),
      pS: surfaceElements("seller-payment", "Seller payment, p S(v,c)")
    };

    state.custom = createCustomState();
    var center = Math.floor((R - 1) / 2);
    state.selected = { i: center, j: center, isLower: true };

    math.typesetInitial(".introduction, .explorable");
    bindEvents();
    applyPreset("vcg");
  }

  function byId(id) {
    return document.getElementById(id);
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
      q: model.efficientGrid(),
      manualPB: model.constantPatchGrid(0),
      manualPS: model.constantPatchGrid(0),
      derivedPayments: null,
      derivedRevision: -1,
      fixIcIr: false,
      qRevision: 0,
      pBRevision: 0,
      pSRevision: 0,
      summaryKey: null,
      summary: null
    };
  }

  function bindEvents() {
    elements.presetVcg.addEventListener("click", function () {
      applyPreset("vcg");
    });
    elements.presetPostedPrice.addEventListener("click", function () {
      applyPreset("posted-price");
    });
    elements.presetAgv.addEventListener("click", function () {
      applyPreset("agv");
    });
    elements.presetSplitDifference.addEventListener("click", function () {
      applyPreset("split-the-difference");
    });
    elements.presetChatterjeeSamuelson.addEventListener("click", function () {
      applyPreset("chatterjee-samuelson");
    });
    elements.presetRevenueThreshold.addEventListener("click", function () {
      applyPreset("revenue-threshold");
    });
    elements.presetCustom.addEventListener("click", function () {
      applyCustom();
    });

    bindPresetSlider(
      "posted-price", elements.postedBuyerPriceSlider, setPostedBuyerPrice
    );
    bindPresetNumber(
      "posted-price", elements.postedBuyerPriceNumber,
      function () { return state.postedBuyerPrice; }, setPostedBuyerPrice
    );
    bindPresetSlider(
      "posted-price", elements.postedSellerReceiptSlider, setPostedSellerReceipt
    );
    bindPresetNumber(
      "posted-price", elements.postedSellerReceiptNumber,
      function () { return state.postedSellerReceipt; }, setPostedSellerReceipt
    );
    bindPresetSlider("agv", elements.agvKSlider, setAgvK);
    bindPresetNumber(
      "agv", elements.agvKNumber, function () { return state.agvK; }, setAgvK
    );
    bindPresetSlider(
      "split-the-difference", elements.splitThresholdSlider, setSplitThreshold
    );
    bindPresetNumber(
      "split-the-difference", elements.splitThresholdNumber,
      function () { return state.splitThreshold; }, setSplitThreshold
    );
    bindPresetSlider(
      "split-the-difference",
      elements.splitSellerShareSlider,
      setSplitSellerShare
    );
    bindPresetNumber(
      "split-the-difference", elements.splitSellerShareNumber,
      function () { return state.splitSellerShare; }, setSplitSellerShare
    );
    bindPresetSlider(
      "revenue-threshold", elements.revenueThresholdSlider, setRevenueThreshold
    );
    bindPresetNumber(
      "revenue-threshold", elements.revenueThresholdNumber,
      function () { return state.revenueThreshold; }, setRevenueThreshold
    );
    bindPresetSlider(
      "revenue-threshold", elements.revenueBuyerMarkupSlider,
      setRevenueBuyerMarkup
    );
    bindPresetNumber(
      "revenue-threshold", elements.revenueBuyerMarkupNumber,
      function () { return state.revenueBuyerMarkup; }, setRevenueBuyerMarkup
    );
    bindPresetSlider(
      "revenue-threshold", elements.revenueSellerDiscountSlider,
      setRevenueSellerDiscount
    );
    bindPresetNumber(
      "revenue-threshold", elements.revenueSellerDiscountNumber,
      function () { return state.revenueSellerDiscount; }, setRevenueSellerDiscount
    );
    elements.fixIcIrCheckbox.addEventListener("change", setFixIcIr);

    Object.keys(surfaces).forEach(function (key) {
      var surface = surfaces[key];
      surface.slider.addEventListener("input", function () {
        setBrushValue(key, Number.parseFloat(surface.slider.value));
      });
      surface.number.addEventListener("change", function () {
        if (!Number.isFinite(surface.number.valueAsNumber)) {
          syncSurfaceControl(key);
          return;
        }
        setBrushValue(key, surface.number.valueAsNumber);
      });
      bindSurfaceChart(key, surface.chart);
    });
    bindIcChart("buyer", elements.buyerIcChart);
    bindIcChart("seller", elements.sellerIcChart);
    bindFieldChart("buyerPayoff", elements.buyerPayoffChart);
    bindFieldChart("sellerPayoff", elements.sellerPayoffChart);
    bindFieldChart("revenue", elements.revenueChart);
    bindFieldChart("efficiency", elements.efficiencyChart);

    if (typeof window.matchMedia === "function") {
      ["(prefers-color-scheme: dark)", "print"].forEach(function (queryText) {
        var mediaQuery = window.matchMedia(queryText);
        var handlePaletteChange = function () {
          recomputeAndDrawAll();
        };
        if (typeof mediaQuery.addEventListener === "function") {
          mediaQuery.addEventListener("change", handlePaletteChange);
        } else if (typeof mediaQuery.addListener === "function") {
          mediaQuery.addListener(handlePaletteChange);
        }
      });
    }
  }

  function bindPresetNumber(key, number, currentValue, setter) {
    number.addEventListener("change", function () {
      if (state.activePreset !== key) {
        number.value = formatChoice(currentValue());
        return;
      }
      if (!Number.isFinite(number.valueAsNumber)) {
        number.value = formatChoice(currentValue());
        return;
      }
      if (setter(number.valueAsNumber)) {
        applyPreset(key);
      }
    });
  }

  function bindPresetSlider(key, slider, setter) {
    slider.addEventListener("pointerdown", function (event) {
      if (state.activePreset !== key) {
        return;
      }
      var carryPendingCommit =
        state.presetPreview && state.activePreset === key;
      cancelPendingPresetCommit();
      presetSliderDrag = {
        key: key,
        pointerId: event.pointerId,
        slider: slider,
        dirty: carryPendingCommit
      };
      if (typeof slider.setPointerCapture === "function") {
        try {
          slider.setPointerCapture(event.pointerId);
        } catch {}
      }
    });
    slider.addEventListener("input", function () {
      if (state.activePreset !== key) {
        return;
      }
      if (!setter(Number.parseFloat(slider.value))) {
        return;
      }
      if (presetSliderDrag && presetSliderDrag.key === key &&
          presetSliderDrag.slider === slider) {
        presetSliderDrag.dirty = true;
        schedulePresetPreview(key);
        return;
      }
      applyPreset(key);
    });
    slider.addEventListener("pointerup", endPresetSliderDrag);
    slider.addEventListener("pointercancel", endPresetSliderDrag);
  }

  function endPresetSliderDrag(event) {
    if (!presetSliderDrag || presetSliderDrag.pointerId !== event.pointerId) {
      return;
    }
    var key = presetSliderDrag.key;
    var shouldApply = presetSliderDrag.dirty && state.activePreset === key;
    cancelPresetSliderDrag();
    pendingPreset = null;
    if (shouldApply) {
      previewPreset(key);
      schedulePresetCommit(key);
    }
  }

  function cancelPresetSliderDrag() {
    if (!presetSliderDrag) {
      return;
    }
    var slider = presetSliderDrag.slider;
    var pointerId = presetSliderDrag.pointerId;
    if (typeof slider.hasPointerCapture === "function" &&
        typeof slider.releasePointerCapture === "function") {
      try {
        if (slider.hasPointerCapture(pointerId)) {
          slider.releasePointerCapture(pointerId);
        }
      } catch {}
    }
    presetSliderDrag = null;
  }

  function cancelPendingPresetCommit() {
    if (presetCommitTimer !== null) {
      window.clearTimeout(presetCommitTimer);
      presetCommitTimer = null;
    }
    pendingPresetCommit = null;
  }

  function schedulePresetCommit(key) {
    cancelPendingPresetCommit();
    pendingPresetCommit = key;
    presetCommitTimer = window.setTimeout(function () {
      var next = pendingPresetCommit;
      presetCommitTimer = null;
      pendingPresetCommit = null;
      if (next && state.activePreset === next && !presetSliderDrag) {
        applyPreset(next);
      }
    }, PRESET_COMMIT_DELAY_MS);
  }

  function bindSurfaceChart(key, chart) {
    chart.addEventListener("pointerdown", function (event) {
      finishKeyboardPaint();
      var point = plotPointFromEvent(chart, event, MAIN_LAYOUT);
      if (!point) {
        return;
      }
      setSurfaceProbe(key, point.x, point.y, true);
      if (!isSurfaceEditable(key)) {
        return;
      }
      activateSurface(key, false);
      var triangle = mesh.pointerToTriangle(chart, event, MAIN_LAYOUT);
      if (!triangle || !triangle.insidePlot) {
        return;
      }
      var brushValue = state.brushes[key];
      dragState = {
        key: key,
        pointerId: event.pointerId,
        value: brushValue,
        last: selectionKey(triangle.i, triangle.j, triangle.isLower),
        dirty: false
      };
      dragState.dirty = paintSurfaceTriangle(
        key, triangle.i, triangle.j, triangle.isLower, brushValue
      );
      if (typeof chart.setPointerCapture === "function") {
        try {
          chart.setPointerCapture(event.pointerId);
        } catch {}
      }
    });
    chart.addEventListener("pointermove", function (event) {
      if (!dragState || dragState.key !== key || dragState.pointerId !== event.pointerId) {
        var point = plotPointFromEvent(chart, event, MAIN_LAYOUT);
        if (point) {
          setSurfaceProbe(key, point.x, point.y, false);
        }
        return;
      }
      var triangle = mesh.pointerToTriangle(chart, event, MAIN_LAYOUT);
      if (!triangle) {
        return;
      }
      var nextKey = selectionKey(triangle.i, triangle.j, triangle.isLower);
      if (nextKey === dragState.last) {
        return;
      }
      dragState.last = nextKey;
      dragState.dirty = paintSurfaceTriangle(
        key, triangle.i, triangle.j, triangle.isLower, dragState.value
      ) || dragState.dirty;
    });
    chart.addEventListener("pointerup", endPointerDrag);
    chart.addEventListener("pointercancel", endPointerDrag);
    chart.addEventListener("pointerleave", function () {
      if (document.activeElement !== chart) {
        hideSurfaceProbe(key);
      }
    });
    chart.addEventListener("focus", function () {
      if (isSurfaceEditable(key)) {
        activateSurface(key, true);
        var point = model.triangleCentroid(
          state.selected.i, state.selected.j, state.selected.isLower
        );
        setSurfaceProbe(key, point.v, point.c, true);
      } else {
        setSurfaceProbe(key, state.surfaceProbe.v, state.surfaceProbe.c, true);
      }
    });
    chart.addEventListener("blur", function () {
      hideSurfaceProbe(key);
      if (keyboardPaintState.key === key) {
        finishKeyboardPaint();
      }
    });
    chart.addEventListener("keydown", function (event) {
      var handled = true;
      var selectionChanged = false;
      if (event.key === "Escape") {
        hideSurfaceProbe(key);
        finishKeyboardPaint();
      } else if (isSurfaceEditable(key)) {
        if (event.key === "ArrowLeft") {
          moveHorizontalSelection(-1);
          selectionChanged = true;
        } else if (event.key === "ArrowRight") {
          moveHorizontalSelection(1);
          selectionChanged = true;
        } else if (event.key === "ArrowUp") {
          moveVerticalSelection(1);
          selectionChanged = true;
        } else if (event.key === "ArrowDown") {
          moveVerticalSelection(-1);
          selectionChanged = true;
        } else if (event.key === "Home") {
          selectTriangle(0, state.selected.j, false);
          selectionChanged = true;
        } else if (event.key === "End") {
          selectTriangle(R - 1, state.selected.j, true);
          selectionChanged = true;
        } else if (event.key === "l" || event.key === "L") {
          selectTriangle(state.selected.i, state.selected.j, false);
          selectionChanged = true;
        } else if (event.key === "r" || event.key === "R") {
          selectTriangle(state.selected.i, state.selected.j, true);
          selectionChanged = true;
        } else if (event.key === "Enter" || event.key === " ") {
          startKeyboardPaint(key, event.key);
        } else {
          handled = false;
        }
        if (selectionChanged && keyboardPaintActive(key)) {
          applyKeyboardBrush(key);
        }
        if (handled && event.key !== "Escape") {
          var selectedPoint = model.triangleCentroid(
            state.selected.i, state.selected.j, state.selected.isLower
          );
          setSurfaceProbe(key, selectedPoint.v, selectedPoint.c, true);
        }
      } else {
        var step = event.shiftKey ? 0.1 : 0.01;
        var v = state.surfaceProbe.v;
        var c = state.surfaceProbe.c;
        if (event.key === "ArrowLeft") {
          v -= step;
        } else if (event.key === "ArrowRight") {
          v += step;
        } else if (event.key === "ArrowUp") {
          c += step;
        } else if (event.key === "ArrowDown") {
          c -= step;
        } else if (event.key === "Home") {
          v = 0;
        } else if (event.key === "End") {
          v = 1;
        } else {
          handled = false;
        }
        if (handled && event.key !== "Escape") {
          setSurfaceProbe(key, v, c, true);
        }
      }
      if (handled) {
        event.preventDefault();
      }
    });
    chart.addEventListener("keyup", function (event) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        stopKeyboardPaint(key, event.key);
      }
    });
  }

  function bindIcChart(agent, chart) {
    visuals.bindProbeChart(
      chart,
      DIAG_LAYOUT,
      function () {
        return {
          x: state.icProbe[agent].trueType,
          y: state.icProbe[agent].report
        };
      },
      function (x, y, announce) { setIcProbe(agent, x, y, announce); },
      function () { hideIcProbe(agent); }
    );
  }

  function bindFieldChart(key, chart) {
    visuals.bindProbeChart(
      chart,
      DIAG_LAYOUT,
      function () {
        return { x: state.fieldProbe[key].v, y: state.fieldProbe[key].c };
      },
      function (x, y, announce) { setFieldProbe(key, x, y, announce); },
      function () { hideFieldProbe(key); }
    );
  }

  function setSurfaceProbe(key, v, c, announce) {
    state.surfaceProbe = {
      key: key,
      v: numbers.clamp(v, 0, 1),
      c: numbers.clamp(c, 0, 1),
      visible: true
    };
    drawSurfaceProbe(surfaces[key].chart, key);
    if (announce) {
      announceSurfaceProbe();
    }
  }

  function hideSurfaceProbe(key) {
    if (state.surfaceProbe.key !== key) {
      return;
    }
    state.surfaceProbe.visible = false;
    var group = surfaces[key].chart.querySelector(".surface-probe");
    if (group) {
      group.remove();
    }
  }

  function setIcProbe(agent, trueType, report, announce) {
    state.icProbe[agent] = {
      trueType: numbers.clamp(trueType, 0, 1),
      report: numbers.clamp(report, 0, 1),
      visible: true
    };
    drawIcProbe(agent);
    if (announce) {
      announceIcProbe(agent);
    }
  }

  function hideIcProbe(agent) {
    state.icProbe[agent].visible = false;
    var group = (agent === "buyer" ? elements.buyerIcChart : elements.sellerIcChart)
      .querySelector(".ic-probe");
    if (group) {
      group.remove();
    }
  }

  function setFieldProbe(key, v, c, announce) {
    state.fieldProbe[key] = {
      v: numbers.clamp(v, 0, 1),
      c: numbers.clamp(c, 0, 1),
      visible: true
    };
    drawFieldProbe(key);
    if (announce) {
      announceFieldProbe(key);
    }
  }

  function hideFieldProbe(key) {
    state.fieldProbe[key].visible = false;
    var group = fieldChart(key).querySelector(".field-probe");
    if (group) {
      group.remove();
    }
  }

  function endPointerDrag(event) {
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }
    var chart = surfaces[dragState.key].chart;
    if (typeof chart.hasPointerCapture === "function" &&
        typeof chart.releasePointerCapture === "function") {
      try {
        if (chart.hasPointerCapture(event.pointerId)) {
          chart.releasePointerCapture(event.pointerId);
        }
      } catch {}
    }
    var shouldRefresh = dragState.dirty;
    dragState = null;
    if (shouldRefresh) {
      recomputeAndDrawAll();
    }
  }

  function selectionKey(i, j, isLower) {
    return i + ":" + j + ":" + (isLower ? "R" : "L");
  }

  function activateSurface(key, redraw) {
    if (!isSurfaceEditable(key) || state.activeSurface === key) {
      return;
    }
    state.activeSurface = key;
    Object.keys(surfaces).forEach(function (surfaceKey) {
      var chart = surfaces[surfaceKey].chart;
      var cursor = chart.querySelector(".cell-cursor");
      var label = chart.querySelector(".cell-label");
      if (cursor) {
        cursor.remove();
      }
      if (label) {
        label.remove();
      }
    });
    if (redraw && state.activePreset === "custom") {
      drawCustomSurface(key);
    }
  }

  function moveHorizontalSelection(direction) {
    if (direction > 0) {
      if (!state.selected.isLower) {
        selectTriangle(state.selected.i, state.selected.j, true);
      } else if (state.selected.i < R - 1) {
        selectTriangle(state.selected.i + 1, state.selected.j, false);
      }
    } else if (state.selected.isLower) {
      selectTriangle(state.selected.i, state.selected.j, false);
    } else if (state.selected.i > 0) {
      selectTriangle(state.selected.i - 1, state.selected.j, true);
    }
  }

  function moveVerticalSelection(direction) {
    if (direction > 0) {
      if (state.selected.isLower) {
        selectTriangle(state.selected.i, state.selected.j, false);
      } else if (state.selected.j < R - 1) {
        selectTriangle(state.selected.i, state.selected.j + 1, true);
      }
    } else if (!state.selected.isLower) {
      selectTriangle(state.selected.i, state.selected.j, true);
    } else if (state.selected.j > 0) {
      selectTriangle(state.selected.i, state.selected.j - 1, false);
    }
  }

  function keyboardPaintActive(key) {
    return keyboardPaintState.key === key &&
      (keyboardPaintState.enter || keyboardPaintState.space);
  }

  function startKeyboardPaint(key, pressedKey) {
    if (keyboardPaintState.key !== null && keyboardPaintState.key !== key) {
      finishKeyboardPaint();
    }
    keyboardPaintState.key = key;
    keyboardPaintState[pressedKey === "Enter" ? "enter" : "space"] = true;
    applyKeyboardBrush(key);
  }

  function applyKeyboardBrush(key) {
    keyboardPaintState.dirty = paintSurfaceTriangle(
      key,
      state.selected.i,
      state.selected.j,
      state.selected.isLower,
      state.brushes[key]
    ) || keyboardPaintState.dirty;
  }

  function stopKeyboardPaint(key, releasedKey) {
    if (keyboardPaintState.key !== key) {
      return;
    }
    keyboardPaintState[releasedKey === "Enter" ? "enter" : "space"] = false;
    if (!keyboardPaintActive(key)) {
      finishKeyboardPaint();
    }
  }

  function finishKeyboardPaint() {
    var shouldRefresh = keyboardPaintState.dirty;
    keyboardPaintState.key = null;
    keyboardPaintState.enter = false;
    keyboardPaintState.space = false;
    keyboardPaintState.dirty = false;
    if (shouldRefresh) {
      recomputeAndDrawAll();
    }
  }

  function selectTriangle(i, j, isLower) {
    state.selected = { i: i, j: j, isLower: isLower };
    if (state.lastSummary && state.activePreset === "custom" &&
        isSurfaceEditable(state.activeSurface)) {
      drawCustomSurface(state.activeSurface);
    }
  }

  function presetCacheKey(key) {
    if (key === "posted-price") {
      return key + ":" + state.postedBuyerPrice.toFixed(2) + ":" +
        state.postedSellerReceipt.toFixed(2);
    }
    if (key === "agv") {
      return key + ":" + String(state.agvK);
    }
    if (key === "split-the-difference") {
      return key + ":" + state.splitThreshold.toFixed(2) + ":" +
        state.splitSellerShare.toFixed(2);
    }
    if (key === "revenue-threshold") {
      return key + ":" + state.revenueThreshold.toFixed(2) + ":" +
        state.revenueBuyerMarkup.toFixed(2) + ":" +
        state.revenueSellerDiscount.toFixed(2);
    }
    return key;
  }

  function presetRule(key) {
    if (key === "vcg") {
      return model.presetVcg();
    }
    if (key === "posted-price") {
      return model.presetPostedPrice(
        state.postedBuyerPrice, state.postedSellerReceipt
      );
    }
    if (key === "agv") {
      return model.presetAgv(state.agvK);
    }
    if (key === "split-the-difference") {
      return model.presetSplitDifference(
        state.splitSellerShare, state.splitThreshold
      );
    }
    if (key === "chatterjee-samuelson") {
      return model.presetChatterjeeSamuelson();
    }
    return model.presetRevenueThreshold(
      state.revenueThreshold,
      state.revenueBuyerMarkup,
      state.revenueSellerDiscount
    );
  }

  function cachedValue(cache, order, limit, key, createValue) {
    if (cache[key]) {
      return cache[key];
    }
    var value = createValue();
    cache[key] = value;
    order.push(key);
    while (order.length > limit) {
      delete cache[order.shift()];
    }
    return value;
  }

  function presetEntry(key) {
    var cacheKey = presetCacheKey(key);
    return cachedValue(
      presetCache, presetCacheOrder, PRESET_CACHE_LIMIT, cacheKey,
      function () {
        var rule = presetRule(key);
        return {
          cacheKey: cacheKey,
          rule: rule,
          summary: model.summarize(rule)
        };
      }
    );
  }

  function applyPreset(key) {
    cancelPendingPresetCommit();
    pendingPreset = null;
    cancelPresetSliderDrag();
    var entry = presetEntry(key);
    state.rule = entry.rule;
    state.activePreset = key;
    state.presetPreview = false;
    state.renderKey = "preset:" + entry.cacheKey;
    state.lastSummary = entry.summary;
    state.lastSummaryKey = state.renderKey;
    elements.validationStatus.textContent = "";
    syncPresetControls();
    syncSurfaceControls();
    recomputeAndDrawAll();
  }

  function previewPreset(key) {
    state.rule = presetRule(key);
    state.presetPreview = true;
    state.renderKey = "preset:" + presetCacheKey(key);
    elements.validationStatus.textContent = "";
    drawSurfaces(state.lastSummary);
  }

  function applyCustom() {
    cancelPendingPresetCommit();
    pendingPreset = null;
    cancelPresetSliderDrag();
    state.activePreset = "custom";
    state.activeSurface = "q";
    state.presetPreview = false;
    state.rule = currentCustomRule();
    state.renderKey = customRenderKey();
    state.lastSummary = state.custom.summary;
    state.lastSummaryKey = state.custom.summaryKey;
    elements.validationStatus.textContent = "";
    syncPresetControls();
    syncSurfaceControls();
    recomputeAndDrawAll();
  }

  function currentCustomRule() {
    var custom = state.custom;
    if (custom.fixIcIr && custom.derivedRevision !== custom.qRevision) {
      custom.derivedPayments = model.zeroBoundaryPayments(custom.q);
      custom.derivedRevision = custom.qRevision;
    }
    return {
      q: custom.q,
      pB: custom.fixIcIr ? custom.derivedPayments.pB : custom.manualPB,
      pS: custom.fixIcIr ? custom.derivedPayments.pS : custom.manualPS
    };
  }

  function customRenderKey() {
    var custom = state.custom;
    return custom.fixIcIr ?
      "custom:fixed:" + custom.qRevision :
      "custom:manual:" + [
        custom.qRevision, custom.pBRevision, custom.pSRevision
      ].join(":");
  }

  function invalidateCustomSummary(deferDerivedPayments) {
    state.custom.summary = null;
    state.custom.summaryKey = null;
    state.renderKey = customRenderKey();
    state.lastSummaryKey = null;
    if (!deferDerivedPayments) {
      state.rule = currentCustomRule();
    }
  }

  function syncPresetControls() {
    var buttons = {
      vcg: elements.presetVcg,
      "posted-price": elements.presetPostedPrice,
      agv: elements.presetAgv,
      "split-the-difference": elements.presetSplitDifference,
      "chatterjee-samuelson": elements.presetChatterjeeSamuelson,
      "revenue-threshold": elements.presetRevenueThreshold,
      custom: elements.presetCustom
    };
    Object.keys(buttons).forEach(function (key) {
      buttons[key].setAttribute("aria-pressed", String(state.activePreset === key));
    });
    elements.postedPriceControl.hidden = state.activePreset !== "posted-price";
    elements.postedSellerReceiptControl.hidden =
      state.activePreset !== "posted-price";
    elements.agvKControl.hidden = state.activePreset !== "agv";
    elements.splitThresholdControl.hidden =
      state.activePreset !== "split-the-difference";
    elements.splitSellerShareControl.hidden =
      state.activePreset !== "split-the-difference";
    elements.revenueThresholdControl.hidden =
      state.activePreset !== "revenue-threshold";
    elements.revenueBuyerMarkupControl.hidden =
      state.activePreset !== "revenue-threshold";
    elements.revenueSellerDiscountControl.hidden =
      state.activePreset !== "revenue-threshold";
    elements.fixIcIrControl.hidden = state.activePreset !== "custom";
    elements.fixIcIrCheckbox.checked = state.custom.fixIcIr;
    elements.postedBuyerPriceSlider.value = String(state.postedBuyerPrice);
    elements.postedBuyerPriceNumber.value = formatChoice(state.postedBuyerPrice);
    elements.postedSellerReceiptSlider.value = String(state.postedSellerReceipt);
    elements.postedSellerReceiptNumber.value = formatChoice(
      state.postedSellerReceipt
    );
    ensureSymmetricRange(
      elements.agvKSlider, elements.agvKEndpoints, state.agvK, 0.5
    );
    elements.agvKSlider.value = String(state.agvK);
    elements.agvKNumber.value = formatChoice(state.agvK);
    elements.splitThresholdSlider.value = String(state.splitThreshold);
    elements.splitThresholdNumber.value = formatChoice(state.splitThreshold);
    elements.splitSellerShareSlider.value = String(state.splitSellerShare);
    elements.splitSellerShareNumber.value = formatChoice(
      state.splitSellerShare
    );
    elements.revenueThresholdSlider.value = String(state.revenueThreshold);
    elements.revenueThresholdNumber.value = formatChoice(state.revenueThreshold);
    elements.revenueBuyerMarkupSlider.value = String(state.revenueBuyerMarkup);
    elements.revenueBuyerMarkupNumber.value = formatChoice(
      state.revenueBuyerMarkup
    );
    elements.revenueSellerDiscountSlider.value = String(
      state.revenueSellerDiscount
    );
    elements.revenueSellerDiscountNumber.value = formatChoice(
      state.revenueSellerDiscount
    );
    syncEditingState();
  }

  function unitChoice(value) {
    return Math.round(numbers.clamp(value, 0, 1) * 100) / 100;
  }

  function syncPostedPriceControls() {
    elements.postedBuyerPriceSlider.value = String(state.postedBuyerPrice);
    elements.postedBuyerPriceNumber.value = formatChoice(state.postedBuyerPrice);
    elements.postedSellerReceiptSlider.value = String(state.postedSellerReceipt);
    elements.postedSellerReceiptNumber.value = formatChoice(
      state.postedSellerReceipt
    );
  }

  function setPostedBuyerPrice(value) {
    if (!Number.isFinite(value)) {
      return false;
    }
    state.postedBuyerPrice = unitChoice(value);
    syncPostedPriceControls();
    return true;
  }

  function setPostedSellerReceipt(value) {
    if (!Number.isFinite(value)) {
      return false;
    }
    state.postedSellerReceipt = unitChoice(value);
    syncPostedPriceControls();
    return true;
  }

  function setAgvK(value) {
    if (!Number.isFinite(value)) {
      return false;
    }
    if (!paymentValueInDomain(value)) {
      syncPresetControls();
      elements.validationStatus.textContent = paymentDomainMessage();
      return false;
    }
    state.agvK = value;
    ensureSymmetricRange(
      elements.agvKSlider, elements.agvKEndpoints, state.agvK, 0.5
    );
    elements.agvKSlider.value = String(state.agvK);
    elements.agvKNumber.value = formatChoice(state.agvK);
    return true;
  }

  function setSplitThreshold(value) {
    if (!Number.isFinite(value)) {
      return false;
    }
    state.splitThreshold = unitChoice(value);
    elements.splitThresholdSlider.value = String(state.splitThreshold);
    elements.splitThresholdNumber.value = formatChoice(state.splitThreshold);
    return true;
  }

  function setSplitSellerShare(value) {
    if (!Number.isFinite(value)) {
      return false;
    }
    state.splitSellerShare = unitChoice(value);
    elements.splitSellerShareSlider.value = String(state.splitSellerShare);
    elements.splitSellerShareNumber.value = formatChoice(
      state.splitSellerShare
    );
    return true;
  }

  function setRevenueThreshold(value) {
    if (!Number.isFinite(value)) {
      return false;
    }
    state.revenueThreshold = unitChoice(value);
    elements.revenueThresholdSlider.value = String(state.revenueThreshold);
    elements.revenueThresholdNumber.value = formatChoice(state.revenueThreshold);
    return true;
  }

  function setRevenueBuyerMarkup(value) {
    if (!Number.isFinite(value)) {
      return false;
    }
    state.revenueBuyerMarkup = unitChoice(value);
    elements.revenueBuyerMarkupSlider.value = String(state.revenueBuyerMarkup);
    elements.revenueBuyerMarkupNumber.value = formatChoice(
      state.revenueBuyerMarkup
    );
    return true;
  }

  function setRevenueSellerDiscount(value) {
    if (!Number.isFinite(value)) {
      return false;
    }
    state.revenueSellerDiscount = unitChoice(value);
    elements.revenueSellerDiscountSlider.value = String(
      state.revenueSellerDiscount
    );
    elements.revenueSellerDiscountNumber.value = formatChoice(
      state.revenueSellerDiscount
    );
    return true;
  }

  function schedulePresetPreview(key) {
    pendingPreset = key;
    if (presetUpdateRequested) {
      return;
    }
    presetUpdateRequested = true;
    window.requestAnimationFrame(function () {
      presetUpdateRequested = false;
      var next = pendingPreset;
      pendingPreset = null;
      if (next && state.activePreset === next && presetSliderDrag &&
          presetSliderDrag.key === next) {
        previewPreset(next);
      }
    });
  }

  function setFixIcIr() {
    if (state.activePreset !== "custom") {
      return;
    }
    state.custom.fixIcIr = elements.fixIcIrCheckbox.checked;
    if (state.custom.fixIcIr) {
      state.activeSurface = "q";
    }
    invalidateCustomSummary();
    syncPresetControls();
    syncSurfaceControls();
    recomputeAndDrawAll();
  }

  function isSurfaceEditable(key) {
    return state.activePreset === "custom" &&
      (key === "q" || !state.custom.fixIcIr);
  }

  function syncEditingState() {
    Object.keys(surfaces).forEach(function (key) {
      var editable = isSurfaceEditable(key);
      var chart = surfaces[key].chart;
      surfaces[key].controls.hidden = !editable;
      chart.tabIndex = 0;
      chart.setAttribute("aria-readonly", String(!editable));
      chart.setAttribute(
        "aria-keyshortcuts",
        editable ? "ArrowLeft ArrowRight ArrowUp ArrowDown Home End l r Enter Space Escape" :
          "ArrowLeft ArrowRight ArrowUp ArrowDown Home End Escape"
      );
    });
  }

  function syncSurfaceControls() {
    Object.keys(surfaces).forEach(syncSurfaceControl);
  }

  function syncSurfaceControl(key) {
    var surface = surfaces[key];
    var value = state.brushes[key];
    if (key !== "q") {
      ensureSymmetricRange(surface.slider, surface.endpoints, value, 1);
    }
    surface.slider.value = String(value);
    surface.number.value = formatChoice(value);
    surface.slider.setAttribute(
      "aria-valuetext",
      surfaceAriaValue(key, value)
    );
  }

  function ensureSymmetricRange(slider, endpoints, value, baseExtent) {
    var current = Math.max(
      Math.abs(Number.parseFloat(slider.min)),
      Math.abs(Number.parseFloat(slider.max)),
      baseExtent
    );
    var extent = Math.abs(value) > current ?
      Math.ceil(Math.abs(value) * 10) / 10 : current;
    slider.min = String(-extent);
    slider.max = String(extent);
    if (endpoints) {
      endpoints.firstElementChild.textContent = formatChoice(-extent);
      endpoints.lastElementChild.textContent = formatChoice(extent);
    }
  }

  function setBrushValue(key, value) {
    if (!isSurfaceEditable(key) || !Number.isFinite(value)) {
      return;
    }
    if (key !== "q" && !paymentValueInDomain(value)) {
      syncSurfaceControl(key);
      elements.validationStatus.textContent = paymentDomainMessage();
      return;
    }
    var next = key === "q" ? numbers.clamp(value, 0, 1) : value;
    state.brushes[key] = next;
    elements.validationStatus.textContent = "";
    syncSurfaceControl(key);
  }

  function writeSurfaceTriangle(key, i, j, isLower, value) {
    var grid = key === "q" ? state.custom.q :
      (key === "pB" ? state.custom.manualPB : state.custom.manualPS);
    var current = isLower ? grid.lower[i][j] : grid.upper[i][j];
    if (key === "q" ? current === value :
        current[0] === value && current.slice(1).every(function (coefficient) {
          return coefficient === 0;
        })) {
      return false;
    }
    var next = key === "q" ? value : model.constantPatch(value);
    if (isLower) {
      grid.lower[i][j] = next;
    } else {
      grid.upper[i][j] = next;
    }
    return true;
  }

  function recordSurfaceEdit(key) {
    if (key === "q") {
      state.custom.qRevision += 1;
    } else if (key === "pB") {
      state.custom.pBRevision += 1;
    } else {
      state.custom.pSRevision += 1;
    }
  }

  function paintSurfaceTriangle(key, i, j, isLower, value) {
    if (!isSurfaceEditable(key)) {
      return false;
    }
    activateSurface(key, false);
    state.selected = { i: i, j: j, isLower: isLower };
    var changed = writeSurfaceTriangle(key, i, j, isLower, value);
    if (changed) {
      recordSurfaceEdit(key);
      invalidateCustomSummary(true);
    }
    scheduleRepaint(key);
    return changed;
  }

  function scheduleRepaint(key) {
    pendingSurfaceKeys[key] = true;
    if (repaintRequested) {
      return;
    }
    drawPendingSurfaces();
    repaintRequested = true;
    window.requestAnimationFrame(function () {
      repaintRequested = false;
      drawPendingSurfaces();
    });
  }

  function drawPendingSurfaces() {
    var keys = Object.keys(pendingSurfaceKeys);
    pendingSurfaceKeys = {};
    if (state.activePreset === "custom") {
      keys.forEach(drawCustomSurface);
    }
  }

  function recomputeAndDrawAll() {
    pendingSurfaceKeys = {};
    repaintRequested = false;
    state.heatmapPalette = visuals.readHeatmapPalette(
      window.getComputedStyle(document.documentElement)
    );
    if (state.presetPreview && state.activePreset !== "custom") {
      drawSurfaces(state.lastSummary);
      drawDeviationCharts(state.lastSummary);
      drawPayoffCharts(state.lastSummary);
      drawRevenueChart(state.lastSummary);
      drawEfficiencyChart();
      return;
    }
    if (state.activePreset === "custom") {
      state.rule = currentCustomRule();
      state.renderKey = customRenderKey();
    }
    var summary = state.lastSummaryKey === state.renderKey ?
      state.lastSummary : model.summarize(state.rule);
    state.lastSummary = summary;
    state.lastSummaryKey = state.renderKey;
    state.diagnosticRule = state.rule;
    if (state.activePreset === "custom") {
      state.custom.summary = summary;
      state.custom.summaryKey = state.renderKey;
    }
    drawSurfaces(summary);
    drawDeviationCharts(summary);
    drawPayoffCharts(summary);
    drawRevenueChart(summary);
    drawEfficiencyChart();
    updateDiagnosticText(summary);
    updateLiveSummary(summary);
  }

  function qChannels(value) {
    return visuals.qChannels(state.heatmapPalette, value);
  }

  function drawSurfaces(summary) {
    var extents = paymentDisplayExtents(summary);
    drawSurface(
      "q", state.rule.q, null, qChannels, 1
    );
    drawSurface(
      "pB", null, state.rule.pB,
      function (value) {
        return visuals.signedChannels(
          value, extents.buyer, state.heatmapPalette.red, state.heatmapPalette.green
        );
      },
      extents.buyer
    );
    drawSurface(
      "pS", null, state.rule.pS,
      function (value) {
        return visuals.signedChannels(
          value, extents.seller, state.heatmapPalette.green, state.heatmapPalette.red
        );
      },
      extents.seller
    );
    surfaces.pS.chart.dataset.colorLow = "green";
    surfaces.pS.chart.dataset.colorZero = "clear";
    surfaces.pS.chart.dataset.colorHigh = "red";
  }

  function paymentDisplayExtents(summary, editedKey) {
    var buyerRange = summary ? summary.paymentRange.buyer : { min: 0, max: 0 };
    var sellerRange = summary ? summary.paymentRange.seller : { min: 0, max: 0 };
    var buyerExtra = editedKey === "pB" ? Math.abs(state.brushes.pB) : 0;
    var sellerExtra = editedKey === "pS" ? Math.abs(state.brushes.pS) : 0;
    return {
      buyer: Math.max(
        0.05,
        Math.abs(buyerRange.min),
        Math.abs(buyerRange.max),
        Math.abs(sellerRange.min),
        Math.abs(sellerRange.max),
        buyerExtra
      ),
      seller: Math.max(
        0.05, Math.abs(sellerRange.min), Math.abs(sellerRange.max), sellerExtra
      )
    };
  }

  function drawCustomSurface(key) {
    if (state.activePreset !== "custom") {
      return;
    }
    if (key === "q") {
      drawSurface(
        "q", state.custom.q, null, qChannels, 1
      );
      return;
    }
    var extents = paymentDisplayExtents(state.lastSummary, key);
    var patchGrid = key === "pB" ? state.custom.manualPB : state.custom.manualPS;
    var extent = key === "pB" ? extents.buyer : extents.seller;
    var lowColor = key === "pB" ? state.heatmapPalette.red : state.heatmapPalette.green;
    var highColor = key === "pB" ? state.heatmapPalette.green : state.heatmapPalette.red;
    drawSurface(
      key, null, patchGrid,
      function (value) {
        return visuals.signedChannels(value, extent, lowColor, highColor);
      },
      extent
    );
    if (key === "pS") {
      surfaces.pS.chart.dataset.colorLow = "green";
      surfaces.pS.chart.dataset.colorZero = "clear";
      surfaces.pS.chart.dataset.colorHigh = "red";
    }
  }

  function drawSurface(key, grid, patchGrid, colorFn, extent) {
    var svg = surfaces[key].chart;
    var rasterSize = state.activePreset === "custom" ?
      CUSTOM_SURFACE_RASTER_SIZE : (state.presetPreview ?
        PRESET_PREVIEW_RASTER_SIZE : PRESET_SURFACE_RASTER_SIZE);
    svg.replaceChildren();
    appendSvg(svg, "title", { id: svg.id + "-title" }, surfaces[key].title);
    appendSvg(svg, "desc", { id: svg.id + "-description" }, surfaceDescription(key));
    appendSvg(svg, "image", {
      x: MAIN_LAYOUT.left,
      y: MAIN_LAYOUT.top,
      width: MAIN_LAYOUT.right - MAIN_LAYOUT.left,
      height: MAIN_LAYOUT.bottom - MAIN_LAYOUT.top,
      href: surfaceRaster(key, grid, patchGrid, colorFn, extent, rasterSize),
      preserveAspectRatio: "none",
      "data-renderer": "raster",
      "data-raster-size": rasterSize
    });
    visuals.drawFrame(svg, MAIN_LAYOUT, mesh, false);
    drawPresetBoundary(svg, key);
    if (isSurfaceEditable(key) && state.activeSurface === key) {
      var corners = mesh.cellCorners(state.selected.i, state.selected.j, MAIN_LAYOUT);
      appendSvg(svg, "polygon", {
        points: mesh.trianglePoints(corners, state.selected.isLower),
        class: "cell-cursor"
      });
      drawCellLabel(svg, MAIN_LAYOUT, mesh.cellRect(
        state.selected.i, state.selected.j, MAIN_LAYOUT
      ));
    }
    drawSurfaceProbe(svg, key);
  }

  function paletteCacheKey() {
    return ["neutral", "blue", "green", "yellow", "orange", "red"].map(function (key) {
      return state.heatmapPalette[key].join(",");
    }).join("|");
  }

  function surfaceRuleKey(key) {
    if (state.activePreset !== "custom") {
      if (key === "q") {
        if (state.activePreset === "vcg" || state.activePreset === "agv") {
          return "preset:q:efficient";
        }
        var threshold = state.activePreset === "split-the-difference" ?
          state.rule.parameters.tradingThreshold :
          (state.activePreset === "chatterjee-samuelson" ||
            state.activePreset === "revenue-threshold" ?
            state.rule.parameters.threshold : null);
        if (threshold !== null) {
          return threshold === 0 ? "preset:q:efficient" :
            "preset:q:threshold:" + threshold;
        }
        return "preset:q:posted-price:" + state.rule.parameters.buyerPrice +
          ":" + state.rule.parameters.sellerReceipt;
      }
      if (state.activePreset !== "vcg") {
        return state.renderKey + ":shared-payment";
      }
      return state.renderKey + ":" + key;
    }
    if (key === "q") {
      return "custom:q:" + state.custom.qRevision;
    }
    if (state.custom.fixIcIr) {
      return "custom:fixed:" + key + ":" + state.custom.qRevision;
    }
    return "custom:manual:" + key + ":" +
      (key === "pB" ? state.custom.pBRevision : state.custom.pSRevision);
  }

  function surfaceRaster(key, grid, patchGrid, colorFn, extent, rasterSize) {
    var cacheKey = [
      key, surfaceRuleKey(key),
      paletteCacheKey(),
      typeof extent === "number" ? Number(extent).toPrecision(12) : String(extent),
      rasterSize
    ].join("|");
    return cachedValue(
      rasterCache, rasterCacheOrder, RASTER_CACHE_LIMIT, cacheKey,
      function () {
        return createSurfaceRaster(grid, patchGrid, colorFn, rasterSize);
      }
    );
  }

  function createSurfaceRaster(grid, patchGrid, colorFn, rasterSize) {
    var canvas = document.createElement("canvas");
    canvas.width = rasterSize;
    canvas.height = rasterSize;
    var context = canvas.getContext("2d");
    var image = context.createImageData(rasterSize, rasterSize);
    var data = image.data;
    var pixelX;
    var pixelY;
    for (pixelY = 0; pixelY < rasterSize; pixelY += 1) {
      var c = 1 - (pixelY + 0.5) / rasterSize;
      var j = Math.min(R - 1, Math.floor(c / CELL_SIZE));
      var localC = c - j * CELL_SIZE;
      for (pixelX = 0; pixelX < rasterSize; pixelX += 1) {
        var v = (pixelX + 0.5) / rasterSize;
        var i = Math.min(R - 1, Math.floor(v / CELL_SIZE));
        var isLower = v - i * CELL_SIZE >= localC;
        var rows = isLower ?
          (patchGrid ? patchGrid.lower : grid.lower) :
          (patchGrid ? patchGrid.upper : grid.upper);
        var represented = rows[i][j];
        var value = patchGrid ?
          model.evaluatePatch(represented, v, c) : represented;
        var color = colorFn(value);
        var offset = (pixelY * rasterSize + pixelX) * 4;
        data[offset] = color[0];
        data[offset + 1] = color[1];
        data[offset + 2] = color[2];
        data[offset + 3] = color.length > 3 ? color[3] : 255;
      }
    }
    context.putImageData(image, 0, 0);
    return canvas.toDataURL("image/png");
  }

  function drawPresetBoundary(svg, key) {
    if (state.activePreset === "custom" ||
        (state.activePreset === "agv" && key !== "q")) {
      return;
    }
    if (state.activePreset === "posted-price") {
      var buyerPrice = state.rule.parameters.buyerPrice;
      var sellerReceipt = state.rule.parameters.sellerReceipt;
      appendSvg(svg, "path", {
        d: "M " + mesh.svgXOf(buyerPrice, MAIN_LAYOUT) + " " +
          MAIN_LAYOUT.bottom + " L " + mesh.svgXOf(buyerPrice, MAIN_LAYOUT) +
          " " + mesh.svgYOf(sellerReceipt, MAIN_LAYOUT) + " L " +
          MAIN_LAYOUT.right + " " + mesh.svgYOf(sellerReceipt, MAIN_LAYOUT),
        class: "preset-boundary"
      });
      return;
    }
    var offset = state.activePreset === "split-the-difference" ?
      state.rule.parameters.tradingThreshold :
      (state.activePreset === "chatterjee-samuelson" ||
        state.activePreset === "revenue-threshold" ?
        state.rule.parameters.threshold : 0);
    appendSvg(svg, "line", {
      x1: mesh.svgXOf(offset, MAIN_LAYOUT),
      y1: mesh.svgYOf(0, MAIN_LAYOUT),
      x2: mesh.svgXOf(1, MAIN_LAYOUT),
      y2: mesh.svgYOf(1 - offset, MAIN_LAYOUT),
      class: "preset-boundary"
    });
  }

  function drawSurfaceProbe(svg, key) {
    var prior = svg.querySelector(".surface-probe");
    if (prior) {
      prior.remove();
    }
    var probe = state.surfaceProbe;
    if (!probe.visible || probe.key !== key || !state.rule) {
      return;
    }
    var values = model.ruleValuesAt(state.rule, probe.v, probe.c);
    var x = mesh.svgXOf(values.v, MAIN_LAYOUT);
    var y = mesh.svgYOf(values.c, MAIN_LAYOUT);
    var valueLabel;
    var boxWidth;
    if (key === "q") {
      valueLabel = { symbol: "q", value: formatProbe(values.q) };
      boxWidth = 72;
    } else {
      valueLabel = {
        symbol: "p",
        subscript: key === "pB" ? "B" : "S",
        value: formatProbe(key === "pB" ? values.pB : values.pS)
      };
      boxWidth = 82;
    }
    var scaffold = visuals.drawProbeScaffold(svg, {
      layout: MAIN_LAYOUT,
      x: x,
      y: y,
      boxWidth: boxWidth,
      groupClass: "surface-probe chart-480x520-probe",
      radius: 3.5,
      xValue: formatProbe(values.v),
      yValue: formatProbe(values.c)
    });
    visuals.appendProbeValueText(
      scaffold.group,
      scaffold.textX,
      scaffold.textY,
      valueLabel
    );
  }

  function announceSurfaceProbe() {
    var probe = state.surfaceProbe;
    var values = model.ruleValuesAt(state.rule, probe.v, probe.c);
    elements.surfaceProbeStatus.textContent =
      "Buyer value " + formatProbe(values.v) + ", seller value " +
      formatProbe(values.c) + ", triangle " + values.side +
      ": allocation " + formatProbe(values.q) + ", buyer payment " +
      formatProbe(values.pB) + ", seller payment " + formatProbe(values.pS) + ".";
  }

  function drawCellLabel(svg, layout, cursorRect) {
    var text = formatCellRange(state.selected.i) + " × " +
      formatCellRange(state.selected.j) + " " + selectionSide();
    visuals.drawCellLabel(svg, layout, cursorRect, text);
  }

  function drawDeviationCharts(summary) {
    var extent = visuals.payoffDisplayExtent(summary);
    drawDeviationChart(elements.buyerIcChart, "buyer", summary, extent);
    drawDeviationChart(elements.sellerIcChart, "seller", summary, extent);
  }

  function drawDeviationChart(svg, agent, summary, extent) {
    var diagnostic = summary.deviation[agent];
    var maxGain = diagnostic.bestResponses.reduce(function (maximum, response) {
      return Math.max(maximum, response.gain);
    }, 0);
    var buyer = agent === "buyer";
    var titleText = buyer ? "Buyer payoff, U B" : "Seller payoff, U S";
    var typeText = buyer ? "true buyer value" : "true seller value";
    svg.replaceChildren();
    appendSvg(svg, "title", { id: svg.id + "-title" }, titleText);
    appendSvg(svg, "desc", { id: svg.id + "-description" },
      "Color gives exact interim utility for each " + typeText +
      " and alternate report, with blue low, a clear zero, and yellow high. " +
      "The dashed diagonal is truthful reporting; " +
      "the solid line is the utility-maximizing report. Maximum displayed gain " +
      formatSigned(maxGain) + ".");
    appendSvg(svg, "image", {
      x: DIAG_LAYOUT.left,
      y: DIAG_LAYOUT.top,
      width: DIAG_LAYOUT.right - DIAG_LAYOUT.left,
      height: DIAG_LAYOUT.bottom - DIAG_LAYOUT.top,
      href: deviationRaster(agent, summary, extent),
      preserveAspectRatio: "none",
      "data-renderer": "payoff-raster",
      "data-raster-size": DIAGNOSTIC_RASTER_SIZE
    });
    visuals.drawLineFrame(svg, DIAG_LAYOUT, mesh);
    appendSvg(svg, "line", {
      x1: DIAG_LAYOUT.left,
      y1: DIAG_LAYOUT.bottom,
      x2: DIAG_LAYOUT.right,
      y2: DIAG_LAYOUT.top,
      class: "truthful-report-line"
    });
    appendSvg(svg, "polyline", {
      points: diagnostic.bestResponses.map(function (response) {
        return mesh.svgXOf(response.trueType, DIAG_LAYOUT) + "," +
          mesh.svgYOf(response.report, DIAG_LAYOUT);
      }).join(" "),
      class: "best-report-line"
    });
    svg.dataset.maxDeviationGain = String(maxGain);
    svg.dataset.bic = String(buyer ? summary.verdicts.buyerBic : summary.verdicts.sellerBic);
    svg.dataset.colorLow = "blue";
    svg.dataset.colorZero = "clear";
    svg.dataset.colorHigh = "yellow";
    drawIcProbe(agent);
  }

  function deviationRaster(agent, summary, extent) {
    var cacheKey = [
      "ic", state.renderKey, agent, paletteCacheKey(),
      Number(extent).toPrecision(12), DIAGNOSTIC_RASTER_SIZE
    ].join("|");
    return cachedValue(
      rasterCache, rasterCacheOrder, RASTER_CACHE_LIMIT, cacheKey,
      function () {
        return createDeviationRaster(agent, summary.interim, extent);
      }
    );
  }

  function createDeviationRaster(agent, interim, extent) {
    var canvas = document.createElement("canvas");
    canvas.width = DIAGNOSTIC_RASTER_SIZE;
    canvas.height = DIAGNOSTIC_RASTER_SIZE;
    var context = canvas.getContext("2d");
    var image = context.createImageData(DIAGNOSTIC_RASTER_SIZE, DIAGNOSTIC_RASTER_SIZE);
    var data = image.data;
    var pixelX;
    var pixelY;
    for (pixelY = 0; pixelY < DIAGNOSTIC_RASTER_SIZE; pixelY += 1) {
      var report = 1 - (pixelY + 0.5) / DIAGNOSTIC_RASTER_SIZE;
      for (pixelX = 0; pixelX < DIAGNOSTIC_RASTER_SIZE; pixelX += 1) {
        var trueType = (pixelX + 0.5) / DIAGNOSTIC_RASTER_SIZE;
        var utility = agent === "buyer" ?
          model.buyerInterimDeviationUtility(interim, trueType, report) :
          model.sellerInterimDeviationUtility(interim, trueType, report);
        var color = visuals.signedChannels(
          utility, extent, state.heatmapPalette.blue, state.heatmapPalette.yellow
        );
        var offset = (pixelY * DIAGNOSTIC_RASTER_SIZE + pixelX) * 4;
        data[offset] = color[0];
        data[offset + 1] = color[1];
        data[offset + 2] = color[2];
        data[offset + 3] = color.length > 3 ? color[3] : 255;
      }
    }
    context.putImageData(image, 0, 0);
    return canvas.toDataURL("image/png");
  }

  function drawIcProbe(agent) {
    var svg = agent === "buyer" ? elements.buyerIcChart : elements.sellerIcChart;
    if (!svg) {
      return;
    }
    var prior = svg.querySelector(".ic-probe");
    if (prior) {
      prior.remove();
    }
    var probe = state.icProbe[agent];
    if (!probe.visible || !state.lastSummary) {
      return;
    }
    var utility = agent === "buyer" ?
      model.buyerInterimDeviationUtility(
        state.lastSummary.interim, probe.trueType, probe.report
      ) : model.sellerInterimDeviationUtility(
        state.lastSummary.interim, probe.trueType, probe.report
      );
    var x = mesh.svgXOf(probe.trueType, DIAG_LAYOUT);
    var y = mesh.svgYOf(probe.report, DIAG_LAYOUT);
    drawCompactDiagnosticProbe(svg, "ic-probe", x, y, {
      symbol: "U",
      subscript: agent === "buyer" ? "B" : "S",
      value: formatSigned(utility)
    }, 76, formatProbe(probe.trueType), formatProbe(probe.report));
  }

  function drawCompactDiagnosticProbe(
    svg, className, x, y, valueLabel, boxWidth, xValue, yValue
  ) {
    var scaffold = visuals.drawProbeScaffold(svg, {
      layout: DIAG_LAYOUT,
      x: x,
      y: y,
      boxWidth: boxWidth,
      groupClass: className + " diagnostic-probe chart-480x520-probe",
      xValue: xValue,
      yValue: yValue
    });
    visuals.appendProbeValueText(
      scaffold.group,
      scaffold.textX,
      scaffold.textY,
      valueLabel
    );
  }

  function announceIcProbe(agent) {
    var probe = state.icProbe[agent];
    var utility = agent === "buyer" ?
      model.buyerInterimDeviationUtility(
        state.lastSummary.interim, probe.trueType, probe.report
      ) : model.sellerInterimDeviationUtility(
        state.lastSummary.interim, probe.trueType, probe.report
      );
    elements.icProbeStatus.textContent = (agent === "buyer" ?
      "Buyer true value " : "Seller true value ") + formatProbe(probe.trueType) +
      ", alternate report " + formatProbe(probe.report) + ", " +
      (agent === "buyer" ? "U B" : "U S") + " equals " +
      formatSigned(utility) + ".";
  }

  function drawPayoffCharts(summary) {
    var extent = visuals.payoffDisplayExtent(summary);
    var colorFn = function (value) {
      return visuals.signedChannels(
        value, extent, state.heatmapPalette.blue, state.heatmapPalette.yellow
      );
    };
    drawFieldDiagnostic(
      "buyerPayoff",
      elements.buyerPayoffChart,
      "Buyer payoff, u B",
      "Exact buyer truthful payoff at each buyer-value and seller-value report pair, with blue low, a clear zero, and yellow high.",
      function (v, c) {
        return model.patchGridValueAt(summary.patches.buyerPayoff, v, c);
      },
      colorFn,
      extent
    );
    drawFieldDiagnostic(
      "sellerPayoff",
      elements.sellerPayoffChart,
      "Seller payoff, u S",
      "Exact seller truthful payoff at each buyer-value and seller-value report pair, with blue low, a clear zero, and yellow high.",
      function (v, c) {
        return model.patchGridValueAt(summary.patches.sellerPayoff, v, c);
      },
      colorFn,
      extent
    );
    elements.buyerPayoffChart.dataset.colorLow = "blue";
    elements.buyerPayoffChart.dataset.colorZero = "clear";
    elements.buyerPayoffChart.dataset.colorHigh = "yellow";
    elements.sellerPayoffChart.dataset.colorLow = "blue";
    elements.sellerPayoffChart.dataset.colorZero = "clear";
    elements.sellerPayoffChart.dataset.colorHigh = "yellow";
  }

  function drawFieldDiagnostic(key, svg, titleText, descText, valueAt, colorFn, scaleKey) {
    svg.replaceChildren();
    appendSvg(svg, "title", { id: svg.id + "-title" }, titleText);
    appendSvg(svg, "desc", { id: svg.id + "-description" },
      descText + " Color is a cached display raster; probe values are exact.");
    appendSvg(svg, "image", {
      x: DIAG_LAYOUT.left,
      y: DIAG_LAYOUT.top,
      width: DIAG_LAYOUT.right - DIAG_LAYOUT.left,
      height: DIAG_LAYOUT.bottom - DIAG_LAYOUT.top,
      href: fieldRaster(key, valueAt, colorFn, scaleKey),
      preserveAspectRatio: "none",
      "data-renderer": "diagnostic-raster",
      "data-raster-size": DIAGNOSTIC_RASTER_SIZE
    });
    visuals.drawFrame(svg, DIAG_LAYOUT, mesh, true);
    drawFieldProbe(key);
  }

  function fieldRaster(key, valueAt, colorFn, scaleKey) {
    var cacheKey = [
      "field", state.renderKey, key, paletteCacheKey(), scaleKey,
      DIAGNOSTIC_RASTER_SIZE
    ].join("|");
    return cachedValue(
      rasterCache, rasterCacheOrder, RASTER_CACHE_LIMIT, cacheKey,
      function () {
        return createFieldRaster(DIAGNOSTIC_RASTER_SIZE, valueAt, colorFn);
      }
    );
  }

  function drawRevenueChart(summary) {
    var extent = Math.max(
      0.05,
      Math.abs(summary.verdicts.minRevenue),
      Math.abs(summary.verdicts.maxRevenue)
    );
    drawFieldDiagnostic(
      "revenue",
      elements.revenueChart,
      "Net revenue",
      "Exact intermediary net revenue at each buyer-value and seller-value report pair.",
      function (v, c) {
        return model.patchGridValueAt(summary.patches.revenue, v, c);
      },
      function (value) {
        return visuals.signedChannels(
          value, extent, state.heatmapPalette.red, state.heatmapPalette.green
        );
      },
      extent
    );
  }

  function drawEfficiencyChart() {
    drawFieldDiagnostic(
      "efficiency",
      elements.efficiencyChart,
      "Efficiency comparison",
      "Exact allocation error relative to efficient trade. Orange forward hatching marks over-trade and blue back hatching marks missing trade.",
      function (v, c) { return efficiencyValueAt(v, c); },
      efficiencyChannels,
      "allocation-error"
    );
  }

  function efficiencyValueAt(v, c) {
    var rule = state.diagnosticRule || state.rule;
    return model.allocationErrorAt(rule.q, v, c);
  }

  function efficiencyChannels(value, pixelX, pixelY) {
    return visuals.efficiencyChannels(
      value, pixelX, pixelY, state.heatmapPalette
    );
  }

  function fieldChart(key) {
    if (key === "buyerPayoff") {
      return elements.buyerPayoffChart;
    }
    if (key === "sellerPayoff") {
      return elements.sellerPayoffChart;
    }
    return key === "revenue" ? elements.revenueChart : elements.efficiencyChart;
  }

  function fieldValueAt(key, v, c) {
    if (key === "buyerPayoff") {
      return model.patchGridValueAt(state.lastSummary.patches.buyerPayoff, v, c);
    }
    if (key === "sellerPayoff") {
      return model.patchGridValueAt(state.lastSummary.patches.sellerPayoff, v, c);
    }
    if (key === "revenue") {
      return model.patchGridValueAt(state.lastSummary.patches.revenue, v, c);
    }
    return efficiencyValueAt(v, c);
  }

  function drawFieldProbe(key) {
    var svg = fieldChart(key);
    if (!svg) {
      return;
    }
    var prior = svg.querySelector(".field-probe");
    if (prior) {
      prior.remove();
    }
    var probe = state.fieldProbe[key];
    if (!probe.visible || !state.lastSummary) {
      return;
    }
    var value = fieldValueAt(key, probe.v, probe.c);
    var label;
    var width;
    if (key === "buyerPayoff") {
      label = { symbol: "u", subscript: "B", value: formatSigned(value) };
      width = 76;
    } else if (key === "sellerPayoff") {
      label = { symbol: "u", subscript: "S", value: formatSigned(value) };
      width = 76;
    } else if (key === "revenue") {
      label = { symbol: "Rev", value: formatSigned(value) };
      width = 86;
    } else {
      label = {
        label: "Loss",
        value: formatProbe(value.over + value.under)
      };
      width = 76;
    }
    drawCompactDiagnosticProbe(
      svg,
      "field-probe",
      mesh.svgXOf(probe.v, DIAG_LAYOUT),
      mesh.svgYOf(probe.c, DIAG_LAYOUT),
      label,
      width,
      formatProbe(probe.v),
      formatProbe(probe.c)
    );
  }

  function announceFieldProbe(key) {
    var probe = state.fieldProbe[key];
    var value = fieldValueAt(key, probe.v, probe.c);
    var result;
    if (key === "buyerPayoff") {
      result = "u B equals " + formatSigned(value);
    } else if (key === "sellerPayoff") {
      result = "u S equals " + formatSigned(value);
    } else if (key === "revenue") {
      result = "Rev equals " + formatSigned(value);
    } else {
      result = "allocation loss " + formatProbe(value.over + value.under);
    }
    elements.icProbeStatus.textContent = "Buyer value " +
      formatProbe(probe.v) + ", seller value " +
      formatProbe(probe.c) + ", " + result + ".";
  }

  function renderDiagnosticLines(container, lines) {
    container.replaceChildren();
    lines.forEach(function (line) {
      var paragraph = document.createElement("p");
      paragraph.textContent = line.text;
      paragraph.className = "verdict-" + line.state;
      container.appendChild(paragraph);
    });
  }

  function combinedViolation(check) {
    return Math.max(check.allocation.maxViolation, check.payment.maxViolation);
  }

  function updateDiagnosticText(summary) {
    var v = summary.verdicts;
    var buyerBicViolation = combinedViolation(summary.bic.buyer);
    var sellerBicViolation = combinedViolation(summary.bic.seller);
    var buyerDsicViolation = combinedViolation(summary.dsic.buyer);
    var sellerDsicViolation = combinedViolation(summary.dsic.seller);
    var maxImbalance = Math.max(Math.abs(v.minRevenue), Math.abs(v.maxRevenue));

    setDataset(elements.buyerIcText, {
      buyerBic: v.buyerBic,
      buyerDsic: v.buyerDsic,
      bicImplementable: v.bicImplementable,
      buyerBicViolation: buyerBicViolation,
      buyerDsicViolation: buyerDsicViolation
    });
    setDataset(elements.sellerIcText, {
      sellerBic: v.sellerBic,
      sellerDsic: v.sellerDsic,
      bicImplementable: v.bicImplementable,
      sellerBicViolation: sellerBicViolation,
      sellerDsicViolation: sellerDsicViolation
    });
    setDataset(elements.buyerPayoffText, {
      expectedBuyerPayoff: v.expectedBuyerPayoff,
      exAnteBuyerIr: v.exAnteBuyerIr,
      interimBuyerIr: v.interimBuyerIr,
      exPostBuyerIr: v.exPostBuyerIr,
      minInterimBuyerPayoff: v.minInterimBuyerPayoff,
      minBuyerPayoff: v.minBuyerPayoff
    });
    setDataset(elements.sellerPayoffText, {
      expectedSellerPayoff: v.expectedSellerPayoff,
      exAnteSellerIr: v.exAnteSellerIr,
      interimSellerIr: v.interimSellerIr,
      exPostSellerIr: v.exPostSellerIr,
      minInterimSellerPayoff: v.minInterimSellerPayoff,
      minSellerPayoff: v.minSellerPayoff
    });
    setDataset(elements.revenueText, {
      exPostBudgetBalanced: v.exPostBudgetBalanced,
      maxImbalance: maxImbalance,
      expectedRevenue: v.expectedRevenue
    });
    setDataset(elements.efficiencyText, {
      welfare: v.welfare,
      firstBestWelfare: v.firstBestWelfare,
      efficiencyLoss: v.efficiencyLoss
    });

    renderDiagnosticLines(elements.buyerIcText, [
      verdictLine("Buyer BIC", v.buyerBic, buyerBicViolation),
      verdictLine("Buyer DSIC", v.buyerDsic, buyerDsicViolation)
    ]);
    renderDiagnosticLines(elements.sellerIcText, [
      verdictLine("Seller BIC", v.sellerBic, sellerBicViolation),
      verdictLine("Seller DSIC", v.sellerDsic, sellerDsicViolation)
    ]);
    renderDiagnosticLines(elements.buyerPayoffText, [
      exAnteIrLine("Buyer ex-ante IR", v.exAnteBuyerIr, v.expectedBuyerPayoff),
      irLine("Buyer interim IR", v.interimBuyerIr, v.minInterimBuyerPayoff),
      irLine("Buyer ex-post IR", v.exPostBuyerIr, v.minBuyerPayoff)
    ]);
    renderDiagnosticLines(elements.sellerPayoffText, [
      exAnteIrLine("Seller ex-ante IR", v.exAnteSellerIr, v.expectedSellerPayoff),
      irLine("Seller interim IR", v.interimSellerIr, v.minInterimSellerPayoff),
      irLine("Seller ex-post IR", v.exPostSellerIr, v.minSellerPayoff)
    ]);
    renderDiagnosticLines(elements.revenueText, [
      {
        text: "Expected revenue: " + formatSigned(v.expectedRevenue) + ".",
        state: v.expectedNoDeficit ? "pass" : "fail"
      },
      {
        text: "Ex-post BB: " + (v.exPostBudgetBalanced ? "passes" : "fails") +
          " (maximum imbalance = " + formatSigned(maxImbalance) + ").",
        state: v.exPostBudgetBalanced ? "pass" : "fail"
      }
    ]);
    var efficient = Math.abs(v.efficiencyLoss) <= model.VERDICT_TOLERANCE;
    renderDiagnosticLines(elements.efficiencyText, [{
      text: efficient ?
        "Efficient (loss = " + formatSigned(v.efficiencyLoss) + ")." :
        "Inefficient (loss = " + formatSigned(v.efficiencyLoss) + ").",
      state: efficient ? "pass" : "fail"
    }]);
  }

  function setDataset(element, values) {
    Object.keys(values).forEach(function (key) {
      element.dataset[key] = String(values[key]);
    });
  }

  function verdictLine(label, holds, violation) {
    return {
      text: label + ": " + (holds ? "passes" : "fails") +
        " (maximum violation = " + formatSigned(violation) + ").",
      state: holds ? "pass" : "fail"
    };
  }

  function irLine(label, holds, minimum) {
    return {
      text: label + ": " + (holds ? "passes" : "fails") +
        " (minimum = " + formatSigned(minimum) + ").",
      state: holds ? "pass" : "fail"
    };
  }

  function exAnteIrLine(label, holds, payoff) {
    return {
      text: label + ": " + (holds ? "passes" : "fails") +
        " (payoff = " + formatSigned(payoff) + ").",
      state: holds ? "pass" : "fail"
    };
  }

  function updateLiveSummary(summary) {
    var v = summary.verdicts;
    elements.liveSummary.textContent =
      "Buyer BIC " + passWord(v.buyerBic) + ", buyer DSIC " + passWord(v.buyerDsic) +
      "; seller BIC " + passWord(v.sellerBic) + ", seller DSIC " +
      passWord(v.sellerDsic) + ". Buyer ex-ante, interim, and ex-post IR " +
      passWord(v.exAnteBuyerIr) + ", " + passWord(v.interimBuyerIr) + ", and " +
      passWord(v.exPostBuyerIr) + "; seller ex-ante, interim, and ex-post IR " +
      passWord(v.exAnteSellerIr) + ", " + passWord(v.interimSellerIr) + ", and " +
      passWord(v.exPostSellerIr) + ". Ex-post budget balance " +
      passWord(v.exPostBudgetBalanced) + ". Expected revenue " +
      formatSigned(v.expectedRevenue) + ". Welfare " + formatSigned(v.welfare) +
      ", efficiency loss " + formatSigned(v.efficiencyLoss) + ".";
  }

  function passWord(value) {
    return value ? "passes" : "fails";
  }

  function surfaceDescription(key) {
    var description = key === "q" ?
      "Allocation probability" : (key === "pB" ? "Buyer payment" : "Seller payment");
    var modeText = isSurfaceEditable(key) ? " Editable" : " Read-only";
    var selectionText = isSurfaceEditable(key) && state.activeSurface === key ?
      " Keyboard selection: " + selectionDescription() +
        ". Enter or Space applies this surface's brush." : "";
    var colorText = key === "pS" ?
      " Negative seller payments fade from green to clear at zero; positive " +
        "seller payments fade from clear to red." : "";
    return modeText + " " + description.toLowerCase() + " on a " + R + " by " + R +
      " triangular mesh, displayed through a cached raster with exact values available " +
      "from the pointer and keyboard probe." + selectionText + colorText;
  }

  function surfaceAriaValue(key, value) {
    var name = key === "q" ? "q" : (key === "pB" ? "p B" : "p S");
    return name + " brush = " + formatChoice(value);
  }

  function formatCellRange(index) {
    var low = index * CELL_SIZE;
    var high = (index + 1) * CELL_SIZE;
    return "[" + low.toFixed(2) + ", " + high.toFixed(2) + ")";
  }

  function selectionSide() {
    return state.selected.isLower ? "R" : "L";
  }

  function selectionDescription() {
    return "v ∈ " + formatCellRange(state.selected.i) + ", c ∈ " +
      formatCellRange(state.selected.j) + ", " + selectionSide();
  }

  function formatChoice(value) {
    return Math.abs(value) < 5e-10 ? "0.00" : value.toFixed(2);
  }

  function paymentValueInDomain(value) {
    return Math.abs(value) <= model.MAX_PAYMENT_COEFFICIENT;
  }

  function paymentDomainMessage() {
    return "Value not applied: its magnitude exceeds the numerical diagnostic range.";
  }

  function formatSigned(value) {
    var resolved = Math.abs(value) < 5e-10 ? 0 : value;
    return (resolved >= 0 ? "+" : "−") + Math.abs(resolved).toFixed(3);
  }
})();
