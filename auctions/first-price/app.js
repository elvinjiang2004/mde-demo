(function () {
  "use strict";

  var model = window.FPAModel;
  var distributions = window.AuctionDistributions;
  var SVG_NS = "http://www.w3.org/2000/svg";
  var DEFAULTS = {
    n: 2,
    a: 0,
    b: 100,
    value: 50,
    bid: 30,
    alpha: 1,
    beta: 1
  };

  var state = {
    n: DEFAULTS.n,
    a: DEFAULTS.a,
    b: DEFAULTS.b,
    value: DEFAULTS.value,
    bid: DEFAULTS.bid,
    alpha: DEFAULTS.alpha,
    beta: DEFAULTS.beta
  };

  var elements = {};
  var chartDragActive = false;
  var mathTypesetQueue = Promise.resolve();
  var mathLoadPromise = null;
  var mathRequestVersions = new WeakMap();
  var lastChartLayout = {
    width: 1000,
    left: 90,
    right: 975
  };
  var resizeTimer = null;
  var valuePdfSignature = null;

  document.addEventListener("DOMContentLoaded", initialize);

  function initialize() {
    elements = {
      bidderCount: byId("bidder-count"),
      alphaNumber: byId("alpha-number"),
      alphaSlider: byId("alpha-slider"),
      betaNumber: byId("beta-number"),
      betaSlider: byId("beta-slider"),
      lowerBound: byId("lower-bound"),
      upperBound: byId("upper-bound"),
      valueSlider: byId("value-slider"),
      valueNumber: byId("value-number"),
      bidSlider: byId("bid-slider"),
      bidNumber: byId("bid-number"),
      valueMinLabel: byId("value-min-label"),
      valueMaxLabel: byId("value-max-label"),
      bidMinLabel: byId("bid-min-label"),
      bidMaxLabel: byId("bid-max-label"),
      randomValueButton: byId("random-value-button"),
      resetButton: byId("reset-button"),
      inputError: byId("input-error"),
      liveSummary: byId("live-summary"),
      valuePdfPreview: byId("value-pdf-preview"),
      chart: byId("tradeoff-chart")
    };

    typesetInitialHtmlMath();
    bindEvents();
    initEquationChainDividers();
    syncControlsFromState();
    render();
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function waitForMathJax() {
    function readyMathJax() {
      var mathJax = window.MathJax;
      if (!mathJax || typeof mathJax.typesetPromise !== "function") {
        return null;
      }
      if (mathJax.startup && mathJax.startup.promise) {
        return Promise.resolve(mathJax.startup.promise).then(function () {
          return mathJax;
        });
      }
      return Promise.resolve(mathJax);
    }

    var ready = readyMathJax();
    if (ready) {
      return ready;
    }
    if (document.readyState === "complete") {
      return Promise.resolve(null);
    }
    if (!mathLoadPromise) {
      mathLoadPromise = new Promise(function (resolve) {
        window.addEventListener("load", function () {
          resolve(readyMathJax());
        }, { once: true });
      }).then(function (mathJax) {
        return mathJax;
      });
    }
    return mathLoadPromise;
  }

  function setMathText(element, texSource) {
    if (!element || element.namespaceURI === SVG_NS ||
        element.dataset.mathSource === texSource) {
      return;
    }

    var version = (mathRequestVersions.get(element) || 0) + 1;
    mathRequestVersions.set(element, version);
    element.dataset.mathSource = texSource;

    var update = mathTypesetQueue.catch(function () {
      // Leave the next update usable if MathJax failed on an earlier node.
    }).then(function () {
      if (mathRequestVersions.get(element) !== version) {
        return null;
      }
      return waitForMathJax().then(function (mathJax) {
        if (mathRequestVersions.get(element) !== version) {
          return null;
        }
        if (mathJax && typeof mathJax.typesetClear === "function") {
          mathJax.typesetClear([element]);
        }
        element.textContent = texSource;
        if (!mathJax) {
          return null;
        }
        return mathJax.typesetPromise([element]);
      });
    });
    mathTypesetQueue = update.catch(function () {
      // Raw TeX remains visible when the renderer is unavailable or fails.
    });
    window.mechanismMathReady = mathTypesetQueue;
  }

  function typesetInitialHtmlMath() {
    var targets = Array.prototype.slice.call(document.querySelectorAll(
      ".introduction, .model-specifications, .choice-controls, .derivation, " +
      ".notes, .references"
    ));
    var initialTypeset = mathTypesetQueue.catch(function () {
      // Keep initial typesetting independent of an earlier dynamic failure.
    }).then(function () {
      return waitForMathJax();
    }).then(function (mathJax) {
      if (!mathJax || targets.length === 0) {
        return null;
      }
      return mathJax.typesetPromise(targets);
    });
    mathTypesetQueue = initialTypeset.catch(function () {
      // Keep a resolved public readiness hook if MathJax cannot render.
    });
    window.mechanismMathReady = mathTypesetQueue;
  }

  function bindEvents() {
    elements.bidderCount.addEventListener("change", function () {
      state.n = Number.parseInt(elements.bidderCount.value, 10);
      render();
    });

    elements.alphaSlider.addEventListener("input", function () {
      setShapeParameter("alpha", Number.parseFloat(elements.alphaSlider.value));
    });
    elements.betaSlider.addEventListener("input", function () {
      setShapeParameter("beta", Number.parseFloat(elements.betaSlider.value));
    });
    elements.alphaNumber.addEventListener("change", function () {
      commitShapeParameter("alpha", elements.alphaNumber);
    });
    elements.betaNumber.addEventListener("change", function () {
      commitShapeParameter("beta", elements.betaNumber);
    });

    elements.lowerBound.addEventListener("change", updateBoundsFromInputs);
    elements.upperBound.addEventListener("change", updateBoundsFromInputs);

    elements.valueSlider.addEventListener("input", function () {
      setValue(Number.parseFloat(elements.valueSlider.value));
    });

    elements.bidSlider.addEventListener("input", function () {
      setBid(Number.parseFloat(elements.bidSlider.value));
    });

    elements.valueNumber.addEventListener("change", function () {
      commitTypedChoice(
        elements.valueNumber,
        state.value,
        setValue,
        formatChoiceNumber
      );
    });

    elements.bidNumber.addEventListener("change", function () {
      commitTypedChoice(
        elements.bidNumber,
        state.bid,
        setBid,
        formatChoiceNumber
      );
    });

    elements.randomValueButton.addEventListener("click", function () {
      var inputA = Number.parseFloat(elements.lowerBound.value);
      var inputB = Number.parseFloat(elements.upperBound.value);
      var validation = model.validateAuction(
        state.n,
        inputA,
        inputB,
        distributionSpec()
      );

      if (!validation.valid) {
        showError(validation.errors.join(" "));
        return;
      }

      var draw = distributions.quantile(
        Math.random(),
        state.a,
        state.b,
        distributionSpec()
      );
      setValue(draw);
    });

    elements.resetButton.addEventListener("click", function () {
      state.n = DEFAULTS.n;
      state.a = DEFAULTS.a;
      state.b = DEFAULTS.b;
      state.value = DEFAULTS.value;
      state.bid = DEFAULTS.bid;
      state.alpha = DEFAULTS.alpha;
      state.beta = DEFAULTS.beta;
      clearError();
      syncControlsFromState();
      render();
    });

    elements.chart.addEventListener("pointerdown", function (event) {
      var bid = chartPointerToBid(event, false);
      if (bid === null) {
        return;
      }
      chartDragActive = true;
      elements.chart.setPointerCapture(event.pointerId);
      setBid(bid);
    });

    elements.chart.addEventListener("pointermove", function (event) {
      if (!chartDragActive) {
        return;
      }
      var bid = chartPointerToBid(event, true);
      if (bid !== null) {
        setBid(bid);
      }
    });

    elements.chart.addEventListener("pointerup", function (event) {
      chartDragActive = false;
      if (elements.chart.hasPointerCapture(event.pointerId)) {
        elements.chart.releasePointerCapture(event.pointerId);
      }
    });

    elements.chart.addEventListener("pointercancel", function () {
      chartDragActive = false;
    });

    elements.chart.addEventListener("keydown", function (event) {
      var step = rangeStep(state.b - state.a);
      var nextBid = null;

      if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
        nextBid = state.bid - step;
      } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
        nextBid = state.bid + step;
      } else if (event.key === "Home") {
        nextBid = state.a;
      } else if (event.key === "End") {
        nextBid = state.b;
      }

      if (nextBid !== null) {
        event.preventDefault();
        setBid(nextBid);
      }
    });

    window.addEventListener("resize", function () {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(render, 100);
    });
  }

  function initEquationChainDividers() {
    var toggles = Array.prototype.slice.call(
      document.querySelectorAll(".equation-chain-divider-toggle")
    );

    toggles.forEach(function (toggle) {
      var rows = [];
      var node = toggle.nextElementSibling;
      while (node && node.classList.contains("equation-step-extra")) {
        rows.push(node);
        node = node.nextElementSibling;
      }

      if (rows.length === 0) {
        return;
      }

      var bottomRule = document.createElement("div");
      bottomRule.className = "equation-chain-divider-rule";
      bottomRule.hidden = true;
      rows[rows.length - 1].after(bottomRule);

      toggle.hidden = false;
      var glyph = toggle.querySelector(".equation-chain-divider-toggle-glyph");

      toggle.addEventListener("click", function () {
        var expanded = toggle.getAttribute("aria-expanded") === "true";
        rows.forEach(function (row) {
          row.hidden = expanded;
        });
        bottomRule.hidden = expanded;
        toggle.setAttribute("aria-expanded", String(!expanded));
        if (glyph) {
          glyph.textContent = expanded ? "+" : "−";
        }
      });
    });
  }

  function updateBoundsFromInputs() {
    var nextA = Number.parseFloat(elements.lowerBound.value);
    var nextB = Number.parseFloat(elements.upperBound.value);
    var validation = model.validateAuction(
      state.n,
      nextA,
      nextB,
      distributionSpec()
    );

    if (!validation.valid) {
      showError(validation.errors.join(" "));
      elements.lowerBound.value = formatEditableNumber(state.a);
      elements.upperBound.value = formatEditableNumber(state.b);
      return;
    }

    var oldSpan = state.b - state.a;
    var valuePosition = oldSpan > 0 ? (state.value - state.a) / oldSpan : 0.8;
    var bidPosition = oldSpan > 0 ? (state.bid - state.a) / oldSpan : 0.3;
    var newSpan = nextB - nextA;

    state.a = nextA;
    state.b = nextB;
    state.value = nextA + model.clamp(valuePosition, 0, 1) * newSpan;
    state.bid = nextA + model.clamp(bidPosition, 0, 1) * newSpan;

    clearError();
    syncControlsFromState();
    render();
  }

  function setBid(nextBid) {
    if (!Number.isFinite(nextBid)) {
      return;
    }
    state.bid = model.clamp(nextBid, state.a, state.b);
    elements.bidSlider.value = String(state.bid);
    render();
  }

  function setValue(nextValue) {
    if (!Number.isFinite(nextValue)) {
      return;
    }
    state.value = model.clamp(nextValue, state.a, state.b);
    elements.valueSlider.value = String(state.value);
    render();
  }

  function commitTypedChoice(input, currentValue, setter, formatter) {
    var nextValue = input.valueAsNumber;
    if (!Number.isFinite(nextValue)) {
      input.value = (formatter || formatEditableNumber)(currentValue);
      return;
    }
    setter(nextValue);
  }

  function commitShapeParameter(name, input) {
    var nextValue = input.valueAsNumber;
    if (!Number.isFinite(nextValue)) {
      input.value = formatChoiceNumber(state[name]);
      return;
    }
    setShapeParameter(name, nextValue);
  }

  function setShapeParameter(name, nextValue) {
    if (!Number.isFinite(nextValue)) {
      return;
    }
    state[name] = Math.round(model.clamp(nextValue, 0.2, 10) * 10) / 10;
    elements[name + "Slider"].value = String(state[name]);
    elements[name + "Number"].value = formatChoiceNumber(state[name]);
    render();
  }

  function distributionSpec() {
    return {
      type: "beta",
      alpha: state.alpha,
      beta: state.beta
    };
  }

  function syncControlsFromState() {
    elements.bidderCount.value = String(state.n);
    elements.lowerBound.value = String(state.a);
    elements.upperBound.value = String(state.b);

    var step = rangeStep(state.b - state.a);
    configureRange(elements.valueSlider, state.a, state.b, step, state.value);
    configureRange(elements.bidSlider, state.a, state.b, step, state.bid);
    configureNumberInput(
      elements.valueNumber,
      state.a,
      state.b,
      state.value,
      formatChoiceNumber
    );
    configureNumberInput(
      elements.bidNumber,
      state.a,
      state.b,
      state.bid,
      formatChoiceNumber
    );
    elements.alphaSlider.value = String(state.alpha);
    elements.betaSlider.value = String(state.beta);
    elements.alphaNumber.value = formatChoiceNumber(state.alpha);
    elements.betaNumber.value = formatChoiceNumber(state.beta);
  }

  function configureRange(range, min, max, step, value) {
    range.min = String(min);
    range.max = String(max);
    range.step = String(step);
    range.value = String(model.clamp(value, min, max));
  }

  function configureNumberInput(input, min, max, value, formatter) {
    input.min = String(min);
    input.max = String(max);
    input.step = "any";
    input.value = (formatter || formatEditableNumber)(
      model.clamp(value, min, max)
    );
  }

  function rangeStep(span) {
    return Math.max(span / 500, Number.EPSILON);
  }

  function showError(message) {
    elements.inputError.textContent = message;
    elements.inputError.hidden = false;
  }

  function clearError() {
    elements.inputError.textContent = "";
    elements.inputError.hidden = true;
  }

  function render() {
    var validation = model.validateChoice(
      state.n,
      state.a,
      state.b,
      state.value,
      state.bid,
      distributionSpec()
    );

    if (!validation.valid) {
      showError(validation.errors.join(" "));
      return;
    }

    clearError();

    var current = model.outcomes(
      state.value,
      state.bid,
      state.n,
      state.a,
      state.b,
      distributionSpec()
    );
    var equilibrium = model.equilibriumOutcomes(
      state.value,
      state.n,
      state.a,
      state.b,
      distributionSpec()
    );

    updateControls();
    drawValuePdfPreview();
    drawChart(current, equilibrium);
    updateAccessibleSummary(current, equilibrium);
  }

  function updateControls() {
    var span = state.b - state.a;
    var valueText = formatMoney(state.value, span);
    var bidText = formatMoney(state.bid, span);
    var lowerText = formatMoney(state.a, span);
    var upperText = formatMoney(state.b, span);

    elements.valueSlider.value = String(state.value);
    elements.bidSlider.value = String(state.bid);
    elements.valueNumber.value = formatChoiceNumber(state.value);
    elements.bidNumber.value = formatChoiceNumber(state.bid);
    setMathText(elements.valueMinLabel, "\\(a=" + lowerText + "\\)");
    setMathText(elements.valueMaxLabel, "\\(b=" + upperText + "\\)");
    setMathText(elements.bidMinLabel, "\\(a=" + lowerText + "\\)");
    setMathText(elements.bidMaxLabel, "\\(b=" + upperText + "\\)");

    elements.valueSlider.setAttribute(
      "aria-valuetext",
      valueText + " value units"
    );
    elements.bidSlider.setAttribute(
      "aria-valuetext",
      bidText + " value units"
    );
  }

  function updateAccessibleSummary(current, equilibrium) {
    var span = state.b - state.a;
    var rectangleState = current.expectedPayoff < -model.EPSILON ?
      "a negative signed rectangle" :
      (Math.abs(current.expectedPayoff) <= model.EPSILON ?
        "a zero-area rectangle" : "a positive rectangle");
    elements.liveSummary.textContent =
      distributionSummary() + ". With " + state.n +
      " bidders, your private value is " +
      formatMoney(state.value, span) + " and your proposed bid is " +
      formatMoney(state.bid, span) + ". The area under the PDF of beta " +
      "superscript I of Y subscript 1, the highest opposing bid, gives a " +
      "probability of winning of " +
      formatPercent(current.winProbability) + ". On the CDF panel's bid axis, " +
      "x subscript 1 is the payment upon winning, " +
      formatMoney(current.paymentIfWin, span) +
      ", and v subscript 1 minus x subscript 1 is the " +
      "payoff if you win, " + formatMoney(current.surplusIfWin, span) + ". " +
      "The " +
      rectangleState + " has probability height " +
      formatPercent(current.winProbability) + ", signed width " +
      formatMoney(state.value - state.bid, span) + ", and expected payoff " +
      formatMoney(current.expectedPayoff, span) + ". The equilibrium bid is " +
      formatMoney(equilibrium.bid, span) + " and its expected payoff is " +
      formatMoney(equilibrium.expectedPayoff, span) + ".";
  }

  function drawValuePdfPreview() {
    var svg = elements.valuePdfPreview;
    if (!svg) {
      return;
    }
    var signature = [state.a, state.b, state.alpha, state.beta].join("|");
    if (signature === valuePdfSignature && svg.childNodes.length > 0) {
      return;
    }
    valuePdfSignature = signature;

    var width = 320;
    var height = 120;
    var left = 14;
    var right = 306;
    var top = 9;
    var baseY = 91;
    var plotHeight = baseY - top;
    var span = state.b - state.a;
    var spec = distributionSpec();
    var sampleCount = 161;
    var endpointInset = 1 / (sampleCount * 3);
    var points = [];
    var peak = 0;
    var i;

    for (i = 0; i < sampleCount; i += 1) {
      var ratio = i / (sampleCount - 1);
      var evaluationRatio = model.clamp(
        ratio,
        endpointInset,
        1 - endpointInset
      );
      var density = distributions.pdf(
        state.a + evaluationRatio * span,
        state.a,
        state.b,
        spec
      );
      if (!Number.isFinite(density) || density < 0) {
        density = 0;
      }
      peak = Math.max(peak, density);
      points.push({ ratio: ratio, density: density });
    }

    peak = peak > 0 ? peak : 1;

    function previewX(ratio) {
      return left + ratio * (right - left);
    }

    function previewY(density) {
      var bounded = model.clamp(density, 0, peak);
      return baseY - (bounded / peak) * plotHeight;
    }

    svg.setAttribute("viewBox", "0 0 " + width + " " + height);
    svg.setAttribute("role", "img");
    svg.setAttribute(
      "aria-labelledby",
      "value-pdf-preview-title value-pdf-preview-description"
    );
    svg.replaceChildren();
    appendSvg(svg, "title", { id: "value-pdf-preview-title" },
      "PDF of Value");
    appendSvg(svg, "desc", { id: "value-pdf-preview-description" },
      "Beta value density on [" + formatEditableNumber(state.a) + ", " +
      formatEditableNumber(state.b) + "] with alpha " +
      formatChoiceNumber(state.alpha) + " and beta " +
      formatChoiceNumber(state.beta) + ".");

    appendSvg(svg, "line", {
      x1: left,
      y1: baseY,
      x2: right,
      y2: baseY,
      class: "value-pdf-axis"
    });

    var curvePath = points.map(function (point, index) {
      return (index === 0 ? "M " : "L ") +
        roundCoordinate(previewX(point.ratio)) + " " +
        roundCoordinate(previewY(point.density));
    }).join(" ");
    var areaPath = "M " + left + " " + baseY + " " +
      curvePath.replace(/^M /, "L ") + " L " + right + " " + baseY + " Z";

    appendSvg(svg, "path", {
      d: areaPath,
      class: "value-pdf-area",
      "data-alpha": state.alpha,
      "data-beta": state.beta,
      "data-lower-bound": state.a,
      "data-upper-bound": state.b
    });
    appendSvg(svg, "path", {
      d: curvePath,
      class: "value-pdf-curve",
      "data-alpha": state.alpha,
      "data-beta": state.beta,
      "data-lower-bound": state.a,
      "data-upper-bound": state.b
    });

    appendSvg(svg, "line", {
      x1: left,
      y1: baseY - 4,
      x2: left,
      y2: baseY + 4,
      class: "value-pdf-axis"
    });
    appendSvg(svg, "line", {
      x1: right,
      y1: baseY - 4,
      x2: right,
      y2: baseY + 4,
      class: "value-pdf-axis"
    });
    appendSvg(svg, "text", {
      x: left,
      y: 108,
      class: "value-pdf-endpoint-label",
      "text-anchor": "start",
      "data-endpoint": "a"
    }, "a = " + formatAxisMoney(state.a));
    appendSvg(svg, "text", {
      x: right,
      y: 108,
      class: "value-pdf-endpoint-label",
      "text-anchor": "end",
      "data-endpoint": "b"
    }, "b = " + formatAxisMoney(state.b));
  }

  function chartPointerToBid(event, clampOutside) {
    var rect = elements.chart.getBoundingClientRect();
    if (!(rect.width > 0)) {
      return null;
    }
    var svgX =
      (event.clientX - rect.left) / rect.width * lastChartLayout.width;
    var left = lastChartLayout.left;
    var right = lastChartLayout.right;

    if (svgX < left || svgX > right) {
      if (!clampOutside) {
        return null;
      }
      return svgX < left ? state.a : state.b;
    }

    var ratio = (svgX - left) / (right - left);
    return state.a + ratio * (state.b - state.a);
  }

  function drawChart(current, equilibrium) {
    var svg = elements.chart;
    var layout = getChartLayout();
    var width = layout.width;
    var height = layout.height;
    var left = layout.left;
    var right = layout.right;
    var plotWidth = right - left;
    var densityTop = layout.densityTop;
    var densityHeight = layout.densityHeight;
    var cdfTop = layout.cdfTop;
    var cdfHeight = layout.cdfHeight;
    var cdfBottom = cdfTop + cdfHeight;
    var span = state.b - state.a;
    var samples = sampleWinningProbabilities(321);
    var densitySamples = sampleDensity(361, current.bid);
    var densityPeak = densityScaleMaximum(densitySamples.curve);

    lastChartLayout = layout;
    svg.setAttribute("viewBox", "0 0 " + width + " " + height);

    function xScale(value) {
      return left + ((value - state.a) / span) * plotWidth;
    }

    var densityPanel = {
      top: densityTop,
      height: densityHeight,
      min: 0,
      max: densityPeak * 1.12,
      label: "PDF of highest opposing bid",
      format: formatDensityAxis,
      tickCount: 3
    };
    var cdfPanel = {
      top: cdfTop,
      height: cdfHeight,
      min: 0,
      max: 1,
      label: "Expected payoff",
      format: formatProbabilityAxis,
      tickCount: 4
    };

    svg.replaceChildren();
    appendSvg(svg, "title", { id: "chart-title" },
      "First-price auction winning probability and expected-payoff rectangle");
    appendSvg(svg, "desc", { id: "chart-description" },
      chartDescription(current, equilibrium));

    drawPanelScaffold(svg, densityPanel, left, right);
    drawPanelScaffold(svg, cdfPanel, left, right);

    drawDensityArea(
      svg,
      densitySamples.support,
      Math.min(current.bid, current.maximumEquilibriumBid),
      xScale,
      densityPanel,
      left,
      current.winProbability
    );
    drawCurve(
      svg,
      densitySamples.curve,
      function (point) { return xScale(point.bid); },
      function (point) { return densityY(point.density, densityPanel); },
      "curve highest-bid-density-curve"
    );

    var supportX = xScale(current.maximumEquilibriumBid);
    appendSvg(svg, "line", {
      x1: supportX,
      y1: densityTop,
      x2: supportX,
      y2: densityTop + densityHeight,
      class: "support-guide",
      "data-support-bid": current.maximumEquilibriumBid
    });
    appendSvg(svg, "text", {
      x: supportX > left + plotWidth * 0.76 ? supportX - 7 : supportX + 7,
      y: densityTop + 16,
      class: "support-label annotation-halo",
      "text-anchor": supportX > left + plotWidth * 0.76 ? "end" : "start"
    }, "βᴵ(b) = " + formatMoney(current.maximumEquilibriumBid, span));

    var equilibriumX = xScale(equilibrium.bid);
    appendSvg(svg, "line", {
      x1: equilibriumX,
      y1: densityTop,
      x2: equilibriumX,
      y2: densityTop + densityHeight,
      class: "equilibrium-marker density-equilibrium-marker",
      "data-equilibrium-bid": equilibrium.bid
    });
    drawDensityEquilibriumAnnotation(
      svg,
      equilibrium.bid,
      equilibriumX,
      densityPanel,
      left,
      right,
      layout.compact
    );

    var shadedRight = xScale(Math.min(current.bid, current.maximumEquilibriumBid));
    drawProbabilityAreaLabel(
      svg,
      current,
      xScale,
      densityPanel,
      left,
      shadedRight,
      layout.compact
    );

    var chosenX = xScale(current.bid);
    var currentDensity = model.highestOpponentBidDensity(
      current.bid,
      state.n,
      state.a,
      state.b,
      distributionSpec()
    );

    drawSelectedMarker(svg, chosenX, densityTop, densityTop + densityHeight);
    drawCircle(
      svg,
      chosenX,
      densityY(currentDensity, densityPanel),
      "chosen-point"
    );

    drawExpectedPayoffRectangle(
      svg,
      current,
      xScale,
      cdfPanel,
      left,
      right,
      layout.compact
    );
    drawCurve(
      svg,
      samples,
      function (point) { return xScale(point.bid); },
      function (point) { return yScale(point.winProbability, cdfPanel); },
      "curve highest-bid-cdf-curve"
    );

    var cdfZeroY = yScale(0, cdfPanel);
    drawBidAxis(svg, xScale, left, right, cdfZeroY);

    drawWinningProbabilityGuideLine(
      svg,
      current,
      chosenX,
      cdfPanel,
      left
    );

    drawSelectedMarker(svg, chosenX, cdfTop, cdfBottom);
    drawCircle(
      svg,
      chosenX,
      yScale(current.winProbability, cdfPanel),
      "chosen-point"
    );

    var equilibriumY = yScale(equilibrium.winProbability, cdfPanel);
    appendSvg(svg, "line", {
      x1: equilibriumX,
      y1: cdfTop,
      x2: equilibriumX,
      y2: cdfBottom,
      class: "equilibrium-marker"
    });
    drawDiamond(
      svg,
      equilibriumX,
      equilibriumY,
      "equilibrium-point"
    );
    drawMaximumAnnotation(
      svg,
      equilibrium,
      equilibriumX,
      equilibriumY,
      cdfPanel,
      left,
      right,
      layout.compact
    );
    drawAxisPayoffDecomposition(
      svg,
      current,
      xScale,
      cdfZeroY,
      left,
      right,
      layout
    );

    appendSvg(svg, "rect", {
      x: left,
      y: densityTop,
      width: plotWidth,
      height: cdfBottom - densityTop,
      class: "drag-overlay",
      "aria-hidden": "true"
    });

    bringMetricLabelsToForeground(svg);

    drawWinningProbabilityGuideLabel(
      svg,
      current,
      cdfPanel,
      left
    );
  }

  function sampleWinningProbabilities(count) {
    var points = [];
    var span = state.b - state.a;
    var spec = distributionSpec();
    var i;

    for (i = 0; i < count; i += 1) {
      var bid = state.a + (i / (count - 1)) * span;
      points.push({
        bid: bid,
        winProbability: model.winProbability(
          bid, state.n, state.a, state.b, spec
        )
      });
    }

    [
      state.value,
      state.bid,
      model.equilibriumBid(
        state.value,
        state.n,
        state.a,
        state.b,
        distributionSpec()
      ),
      model.maximumEquilibriumBid(
        state.n,
        state.a,
        state.b,
        distributionSpec()
      )
    ].forEach(function (bid) {
      var boundedBid = model.clamp(bid, state.a, state.b);
      points.push({
        bid: boundedBid,
        winProbability: model.winProbability(
          boundedBid, state.n, state.a, state.b, spec
        )
      });
    });

    points.sort(function (first, second) {
      return first.bid - second.bid;
    });

    return uniqueByBid(points);
  }

  function sampleDensity(count, selectedBid) {
    var supportEnd = model.maximumEquilibriumBid(
      state.n,
      state.a,
      state.b,
      distributionSpec()
    );
    var support = [];
    var i;

    for (i = 0; i < count; i += 1) {
      var bid = state.a + (i / (count - 1)) * (supportEnd - state.a);
      support.push({
        bid: bid,
        density: densityForPlot(bid, state.a, supportEnd)
      });
    }

    var cappedSelected = model.clamp(selectedBid, state.a, supportEnd);
    support.push({
      bid: cappedSelected,
      density: densityForPlot(cappedSelected, state.a, supportEnd)
    });
    support.sort(function (first, second) {
      return first.bid - second.bid;
    });
    support = uniqueByBid(support);

    var curve = support.slice();
    curve.push({ bid: supportEnd, density: 0 });
    if (supportEnd < state.b - model.EPSILON) {
      curve.push({ bid: state.b, density: 0 });
    }

    return { support: support, curve: curve };
  }

  function densityForPlot(bid, supportStart, supportEnd) {
    var density = model.highestOpponentBidDensity(
      bid,
      state.n,
      state.a,
      state.b,
      distributionSpec()
    );
    if (Number.isFinite(density) && density >= 0) {
      return density;
    }

    var supportSpan = supportEnd - supportStart;
    var inwardBid = bid <= supportStart + supportSpan / 2 ?
      supportStart + supportSpan / 1000 :
      supportEnd - supportSpan / 1000;
    density = model.highestOpponentBidDensity(
      inwardBid,
      state.n,
      state.a,
      state.b,
      distributionSpec()
    );
    return Number.isFinite(density) && density >= 0 ? density : 0;
  }

  function densityScaleMaximum(points) {
    var maximum = 0;
    points.forEach(function (point) {
      if (Number.isFinite(point.density) && point.density > maximum) {
        maximum = point.density;
      }
    });
    return maximum > 0 ? maximum : 1;
  }

  function densityY(value, panel) {
    var bounded = Number.isFinite(value) ?
      model.clamp(value, panel.min, panel.max) : panel.max;
    return yScale(bounded, panel);
  }

  function uniqueByBid(points) {
    return points.filter(function (point, index) {
      if (index === 0) {
        return true;
      }
      return Math.abs(point.bid - points[index - 1].bid) > model.EPSILON;
    });
  }

  function getChartLayout() {
    var availableWidth =
      elements.chart.parentElement.clientWidth ||
      elements.chart.clientWidth ||
      1000;
    var compact = availableWidth < 700;

    if (compact) {
      return {
        width: 560,
        height: 820,
        left: 72,
        right: 544,
        densityTop: 80,
        densityHeight: 170,
        cdfTop: 350,
        cdfHeight: 350,
        endpointLabelY: 740,
        bracketY: 758,
        bracketLabelY: 780,
        compact: true
      };
    }

    return {
      width: 1000,
      height: 800,
      left: 90,
      right: 975,
      densityTop: 70,
      densityHeight: 170,
      cdfTop: 330,
      cdfHeight: 350,
      endpointLabelY: 720,
      bracketY: 738,
      bracketLabelY: 760,
      compact: false
    };
  }

  function yScale(value, panel) {
    var ratio = (value - panel.min) / (panel.max - panel.min);
    return panel.top + panel.height - ratio * panel.height;
  }

  function drawPanelScaffold(svg, panel, left, right) {
    appendSvg(svg, "rect", {
      x: left,
      y: panel.top,
      width: right - left,
      height: panel.height,
      class: "panel-background"
    });
    appendSvg(svg, "text", {
      x: left,
      y: panel.top - 29,
      class: "panel-caption"
    }, panel.label);

    var ticks = panelTicks(panel.min, panel.max, panel.tickCount);
    ticks.forEach(function (value) {
      var y = yScale(value, panel);
      appendSvg(svg, "line", {
        x1: left,
        y1: y,
        x2: right,
        y2: y,
        class: Math.abs(value) < model.EPSILON ? "zero-line" : "grid-line"
      });
      appendSvg(svg, "text", {
        x: left - 10,
        y: y + 4,
        class: "axis-text",
        "text-anchor": "end"
      }, panel.format(value));
    });

    appendSvg(svg, "line", {
      x1: left,
      y1: panel.top,
      x2: left,
      y2: panel.top + panel.height,
      class: "axis-line"
    });

  }

  function panelTicks(minimum, maximum, count) {
    var ticks = [];
    var i;
    for (i = 0; i <= count; i += 1) {
      ticks.push(minimum + (i / count) * (maximum - minimum));
    }
    if (minimum < 0 && maximum > 0) {
      ticks.push(0);
    }
    ticks.sort(function (first, second) { return first - second; });
    return ticks.filter(function (value, index) {
      return index === 0 || Math.abs(value - ticks[index - 1]) > model.EPSILON;
    });
  }

  function drawDensityArea(
    svg,
    points,
    endBid,
    xScale,
    panel,
    left,
    winProbability
  ) {
    if (endBid <= state.a + model.EPSILON) {
      return;
    }

    var included = points.filter(function (point) {
      return point.bid <= endBid + model.EPSILON;
    });
    var endPoint = included[included.length - 1];
    if (!endPoint || Math.abs(endPoint.bid - endBid) > model.EPSILON) {
      included.push({
        bid: endBid,
        density: model.highestOpponentBidDensity(
          endBid,
          state.n,
          state.a,
          state.b,
          distributionSpec()
        )
      });
    }

    var baseY = yScale(0, panel);
    var path = "M " + roundCoordinate(left) + " " + roundCoordinate(baseY);
    included.forEach(function (point) {
      path += " L " + roundCoordinate(xScale(point.bid)) + " " +
        roundCoordinate(densityY(point.density, panel));
    });
    path += " L " + roundCoordinate(xScale(endBid)) + " " +
      roundCoordinate(baseY) + " Z";

    appendSvg(svg, "path", {
      d: path,
      class: "winning-area",
      "data-metric": "win-probability",
      "data-end-bid": endBid,
      "data-probability": winProbability
    });
  }

  function drawProbabilityAreaLabel(
    svg,
    current,
    xScale,
    panel,
    left,
    shadedRight,
    compact
  ) {
    var probabilityText = formatPercent(current.winProbability);
    var label = "Probability of winning = " + probabilityText;
    var lineHeight = 13;
    var characterWidth = compact ? 5.7 : 6.1;
    var horizontalPadding = 12;
    var availableWidth = shadedRight - left;
    var right = xScale(state.b);
    var plotWidth = xScale(state.b) - left;
    var baseY = yScale(0, panel);
    var candidates = [
      [label],
      ["Probability of winning ", "= " + probabilityText],
      ["Probability ", "of winning ", "= " + probabilityText]
    ];
    var chosen = null;
    var heightSampleCount = 9;
    var sampledCandidateWidth = false;

    candidates.some(function (lines) {
      var block = svgTextBlock(lines, characterWidth, lineHeight);
      if (availableWidth < block.width + 2 * horizontalPadding) {
        return false;
      }

      var labelLeft = shadedRight - block.width - horizontalPadding;
      var availableHeight = Infinity;
      var sampleIndex;
      sampledCandidateWidth = true;

      for (sampleIndex = 0;
          sampleIndex < heightSampleCount;
          sampleIndex += 1) {
        var sampleX = labelLeft +
          (sampleIndex / (heightSampleCount - 1)) * block.width;
        var sampleBid = state.a +
          ((sampleX - left) / plotWidth) * (state.b - state.a);
        var sampleDensity = model.highestOpponentBidDensity(
          sampleBid,
          state.n,
          state.a,
          state.b,
          distributionSpec()
        );
        availableHeight = Math.min(
          availableHeight,
          baseY - densityY(sampleDensity, panel)
        );
      }

      if (availableHeight < block.height + 10) {
        return false;
      }

      chosen = {
        block: block,
        labelLeft: labelLeft
      };
      return true;
    });

    if (!chosen) {
      var selectedX = xScale(current.bid);
      var fallbackLines = markerAttachedTextPlacement(
        candidates,
        characterWidth,
        lineHeight,
        selectedX,
        left,
        right,
        8
      );
      fallbackLines.y = baseY - 10 -
        (fallbackLines.block.lines.length - 1) * lineHeight;

      appendSvgTextLines(svg, {
        x: fallbackLines.x,
        y: fallbackLines.y,
        class: "area-label annotation-halo",
        "text-anchor": fallbackLines.anchor || "middle",
        "data-metric": "win-probability",
        "data-probability": current.winProbability,
        "data-layout": fallbackLines.block.lines.length === 1 ?
          "single" : "wrapped",
        "data-placement": fallbackLines.placement,
        "data-vertical-placement": "panel-floor",
        "data-height-check": sampledCandidateWidth ?
          "sampled-width" : "not-applicable",
        "data-height-samples": sampledCandidateWidth ? heightSampleCount : 0,
        "data-foreground": "true"
      }, fallbackLines.block.lines, lineHeight, label);
      return;
    }

    appendSvgTextLines(svg, {
      x: chosen.labelLeft + chosen.block.width / 2,
      y: baseY - 10 -
        (chosen.block.lines.length - 1) * lineHeight,
      class: "area-label annotation-halo",
      "text-anchor": "middle",
      "data-metric": "win-probability",
      "data-probability": current.winProbability,
      "data-layout": chosen.block.lines.length === 1 ? "single" : "wrapped",
      "data-placement": "inside-area",
      "data-height-check": "sampled-width",
      "data-height-samples": heightSampleCount,
      "data-foreground": "true"
    }, chosen.block.lines, lineHeight, label);
  }

  function drawExpectedPayoffRectangle(
    svg,
    current,
    xScale,
    panel,
    left,
    right,
    compact
  ) {
    var bidX = xScale(current.bid);
    var valueX = xScale(state.value);
    var probabilityY = yScale(current.winProbability, panel);
    var baseY = yScale(0, panel);
    var signedWidth = state.value - current.bid;
    var signedPayoff = current.expectedPayoff;
    var rectangleState = signedPayoff > model.EPSILON ?
      "positive" : (signedPayoff < -model.EPSILON ? "negative" : "zero");
    var rectangleWidth = Math.abs(valueX - bidX);
    var rectangleHeight = Math.max(0, baseY - probabilityY);
    var rectangleClass = "expected-payoff-rectangle expected-payoff-" +
      rectangleState;
    var rectangle = appendSvg(svg, "rect", {
      x: Math.min(bidX, valueX),
      y: probabilityY,
      width: rectangleWidth,
      height: rectangleHeight,
      class: rectangleClass,
      "data-metric": "expected-payoff",
      "data-state": rectangleState,
      "data-probability": current.winProbability,
      "data-signed-width": signedWidth,
      "data-signed-payoff": signedPayoff,
      "data-bid": current.bid,
      "data-value": state.value
    });

    appendSvg(rectangle, "title", {},
      "Expected payoff rectangle: probability " +
      formatPercent(current.winProbability) + ", signed width " +
      formatMoney(signedWidth, state.b - state.a) + ", signed payoff " +
      formatMoney(signedPayoff, state.b - state.a) + ".");

    appendSvg(svg, "line", {
      x1: valueX,
      y1: panel.top,
      x2: valueX,
      y2: baseY,
      class: "cdf-value-guide",
      "data-value": state.value,
      "data-notation": "v_1"
    });

    if (rectangleState === "zero") {
      drawZeroExpectedPayoff(
        svg,
        bidX,
        valueX,
        probabilityY,
        baseY,
        rectangleWidth,
        rectangleHeight,
        current
      );
    }

    var payoffText = formatMoney(signedPayoff, state.b - state.a);
    var label = "Expected payoff = " + payoffText;
    var lineHeight = 13;
    var characterWidth = compact ? 5.6 : 5.9;
    var candidates = [
      [label],
      ["Expected payoff ", "= " + payoffText],
      ["Expected ", "payoff ", "= " + payoffText]
    ];
    var chosen = null;

    candidates.some(function (lines) {
      var block = svgTextBlock(lines, characterWidth, lineHeight);
      if (rectangleWidth >= block.width + 18) {
        chosen = block;
        return true;
      }
      return false;
    });

    if (chosen) {
      var chosenY = probabilityY + rectangleHeight / 2 + 4 -
        (chosen.lines.length - 1) * lineHeight / 2;
      appendSvgTextLines(svg, {
        x: (bidX + valueX) / 2,
        y: chosenY,
        class: "expected-payoff-label annotation-halo" +
          (rectangleState === "negative" ? " negative-metric" : ""),
        "text-anchor": "middle",
        "data-metric": "expected-payoff-label",
        "data-layout": chosen.lines.length === 1 ? "single" : "wrapped",
        "data-state": rectangleState,
        "data-placement": "inside-area",
        "data-horizontal-fit": "true",
        "data-foreground": "true"
      }, chosen.lines, lineHeight, label);
      return;
    }

    var fallback = markerAttachedTextPlacement(
      candidates,
      characterWidth,
      lineHeight,
      bidX,
      left,
      right,
      8
    );
    fallback.y = probabilityY + rectangleHeight / 2 + 4 -
      (fallback.block.lines.length - 1) * lineHeight / 2;

    appendSvgTextLines(svg, {
      x: fallback.x,
      y: fallback.y,
      class: "expected-payoff-label annotation-halo" +
        (rectangleState === "negative" ? " negative-metric" : ""),
      "text-anchor": fallback.anchor,
      "data-metric": "expected-payoff-label",
      "data-layout": fallback.block.lines.length === 1 ? "single" : "wrapped",
      "data-state": rectangleState,
      "data-placement": fallback.placement,
      "data-horizontal-fit": "false",
      "data-foreground": "true"
    }, fallback.block.lines, lineHeight, label);
  }

  function drawZeroExpectedPayoff(
    svg,
    bidX,
    valueX,
    probabilityY,
    baseY,
    rectangleWidth,
    rectangleHeight,
    current
  ) {
    var commonAttributes = {
      class: "zero-expected-payoff",
      "data-metric": "expected-payoff-zero",
      "data-state": "zero",
      "data-probability": current.winProbability,
      "data-signed-width": state.value - current.bid,
      "data-signed-payoff": current.expectedPayoff
    };

    if (rectangleWidth < 1 && rectangleHeight < 1) {
      appendSvg(svg, "circle", Object.assign({}, commonAttributes, {
        cx: bidX,
        cy: baseY,
        r: 5
      }));
      return;
    }

    if (rectangleWidth < 1) {
      appendSvg(svg, "line", Object.assign({}, commonAttributes, {
        x1: bidX,
        y1: probabilityY,
        x2: bidX,
        y2: baseY
      }));
      return;
    }

    appendSvg(svg, "line", Object.assign({}, commonAttributes, {
      x1: Math.min(bidX, valueX),
      y1: baseY,
      x2: Math.max(bidX, valueX),
      y2: baseY
    }));
  }

  function drawWinningProbabilityGuideLine(
    svg,
    current,
    selectedX,
    panel,
    left
  ) {
    var guideY = yScale(current.winProbability, panel);
    appendSvg(svg, "line", {
      x1: left,
      y1: guideY,
      x2: selectedX,
      y2: guideY,
      class: "winning-probability-guide-line",
      "data-probability": current.winProbability
    });
  }

  function drawWinningProbabilityGuideLabel(
    svg,
    current,
    panel,
    left
  ) {
    var guideY = yScale(current.winProbability, panel);
    var labelY = guideY <= panel.top + 18 ? guideY + 17 : guideY - 8;
    var label = "Probability of winning = " +
      formatPercent(current.winProbability);
    appendSvg(svg, "text", {
      x: left + 8,
      y: labelY,
      class: "winning-probability-guide-label annotation-halo",
      "text-anchor": "start",
      "data-probability": current.winProbability,
      "data-placement": "axis-right",
      "data-guide-y": guideY,
      "data-foreground": "true"
    }, label);
  }

  function bringMetricLabelsToForeground(svg) {
    [".area-label", ".expected-payoff-label"].forEach(function (selector) {
      var label = svg.querySelector(selector);
      if (label) {
        svg.appendChild(label);
      }
    });
  }

  function drawBidAxis(svg, xScale, left, right, zeroY) {
    appendSvg(svg, "line", {
      x1: left,
      y1: zeroY,
      x2: right,
      y2: zeroY,
      class: "axis-line cdf-zero-axis",
      "data-axis-value": "0"
    });

    var tickCount = 5;
    var i;
    for (i = 0; i <= tickCount; i += 1) {
      var value = state.a + (i / tickCount) * (state.b - state.a);
      var x = xScale(value);
      var anchor = i === 0 ? "start" : (i === tickCount ? "end" : "middle");
      appendSvg(svg, "line", {
        x1: x,
        y1: zeroY,
        x2: x,
        y2: zeroY + 6,
        class: "axis-line"
      });
      appendSvg(svg, "text", {
        x: x + (i === 0 ? 2 : (i === tickCount ? -2 : 0)),
        y: zeroY + 20,
        class: "axis-text annotation-halo",
        "text-anchor": anchor
      }, formatAxisMoney(value));
    }

  }

  function drawAxisPayoffDecomposition(
    svg,
    current,
    xScale,
    zeroY,
    left,
    right,
    layout
  ) {
    var paymentX = xScale(current.bid);
    var valueX = xScale(state.value);
    var signedPayoffIfWin = state.value - current.bid;
    var stateName = signedPayoffIfWin > model.EPSILON ?
      "positive" : (signedPayoffIfWin < -model.EPSILON ? "negative" : "zero");
    var closeEndpoints = Math.abs(paymentX - valueX) <
      (layout.compact ? 105 : 120);
    var paymentLabel = "x₁ = " +
      formatMoney(current.paymentIfWin, state.b - state.a);
    var valueLabel = "v₁ = " +
      formatMoney(state.value, state.b - state.a);
    var paymentPlacement;
    var valuePlacement;

    if (stateName === "zero") {
      appendSvg(svg, "line", {
        x1: paymentX,
        y1: zeroY - 9,
        x2: paymentX,
        y2: zeroY + 9,
        class: "axis-payment-marker axis-value-marker",
        "data-payment": current.paymentIfWin,
        "data-value": state.value,
        "data-state": "zero"
      });
      appendSvg(svg, "text", {
        x: paymentX,
        y: layout.endpointLabelY,
        class: "axis-payment-label axis-value-label annotation-halo",
        "text-anchor": axisCenteredAnchor(paymentX, left, right),
        "data-payment": current.paymentIfWin,
        "data-value": state.value
      }, "x₁ = v₁ = " +
        formatMoney(current.bid, state.b - state.a));
    } else {
      appendSvg(svg, "line", {
        x1: paymentX,
        y1: zeroY - 9,
        x2: paymentX,
        y2: zeroY + 9,
        class: "axis-payment-marker",
        "data-payment": current.paymentIfWin,
        "data-bid": current.bid
      });
      appendSvg(svg, "line", {
        x1: valueX,
        y1: zeroY - 7,
        x2: valueX,
        y2: zeroY + 7,
        class: "axis-value-marker",
        "data-value": state.value
      });

      paymentPlacement = axisEndpointLabelPlacement(
        paymentX,
        paymentX < valueX ? -1 : 1,
        paymentLabel,
        left,
        right
      );
      valuePlacement = axisEndpointLabelPlacement(
        valueX,
        valueX < paymentX ? -1 : 1,
        valueLabel,
        left,
        right
      );

      appendSvg(svg, "text", {
        x: paymentPlacement.x,
        y: layout.endpointLabelY - (closeEndpoints ? 7 : 0),
        class: "axis-payment-label annotation-halo",
        "text-anchor": paymentPlacement.anchor,
        "data-payment": current.paymentIfWin,
        "data-bid": current.bid
      }, paymentLabel);
      appendSvg(svg, "text", {
        x: valuePlacement.x,
        y: layout.endpointLabelY + (closeEndpoints ? 7 : 0),
        class: "axis-value-label annotation-halo",
        "text-anchor": valuePlacement.anchor,
        "data-value": state.value
      }, valueLabel);
    }

    drawPayoffIfWinBracket(
      svg,
      paymentX,
      valueX,
      signedPayoffIfWin,
      stateName,
      left,
      right,
      layout
    );
  }

  function drawPayoffIfWinBracket(
    svg,
    paymentX,
    valueX,
    signedPayoffIfWin,
    stateName,
    left,
    right,
    layout
  ) {
    var bracketLeft = Math.min(paymentX, valueX);
    var bracketRight = Math.max(paymentX, valueX);
    var group = appendSvg(svg, "g", {
      class: "payoff-if-win-bracket payoff-bracket-" + stateName,
      "data-state": stateName,
      "data-payment": state.bid,
      "data-value": state.value,
      "data-signed-width": signedPayoffIfWin,
      "data-signed-payoff-if-win": signedPayoffIfWin
    });
    var label = "Payoff if you win: v₁ − x₁ = " +
      formatMoney(signedPayoffIfWin, state.b - state.a);
    var labelWidth = label.length * (layout.compact ? 5.6 : 5.9);
    var labelX = (bracketLeft + bracketRight) / 2;
    var labelAnchor = "middle";

    if (stateName === "zero") {
      appendSvg(group, "circle", {
        cx: paymentX,
        cy: layout.bracketY,
        r: 4,
        class: "payoff-bracket-zero-mark"
      });
    } else {
      appendSvg(group, "line", {
        x1: bracketLeft,
        y1: layout.bracketY,
        x2: bracketRight,
        y2: layout.bracketY,
        class: "payoff-bracket-line"
      });
      [bracketLeft, bracketRight].forEach(function (x) {
        appendSvg(group, "line", {
          x1: x,
          y1: layout.bracketY - 5,
          x2: x,
          y2: layout.bracketY + 5,
          class: "payoff-bracket-cap"
        });
      });
    }

    if (labelX - labelWidth / 2 < left + 4) {
      labelX = left + 4;
      labelAnchor = "start";
    } else if (labelX + labelWidth / 2 > right - 4) {
      labelX = right - 4;
      labelAnchor = "end";
    }

    appendSvg(group, "text", {
      x: labelX,
      y: layout.bracketLabelY,
      class: "payoff-if-win-axis-label annotation-halo",
      "text-anchor": labelAnchor
    }, label);
  }

  function axisEndpointLabelPlacement(x, direction, label, left, right) {
    var padding = 7;
    var estimatedWidth = label.length * 5.8;
    var placeLeft = direction < 0;

    if (placeLeft && x - padding - estimatedWidth < left) {
      placeLeft = false;
    } else if (!placeLeft && x + padding + estimatedWidth > right) {
      placeLeft = true;
    }

    return {
      x: x + (placeLeft ? -padding : padding),
      anchor: placeLeft ? "end" : "start"
    };
  }

  function axisCenteredAnchor(x, left, right) {
    if (x < left + 105) {
      return "start";
    }
    if (x > right - 105) {
      return "end";
    }
    return "middle";
  }

  function annotationLabelFitsRight(label, x, left, right, padding, compact) {
    var estimatedWidth = label.length * (compact ? 5.6 : 5.9);
    var rightSpace = right - x - padding;
    var leftSpace = x - left - padding;
    return rightSpace >= estimatedWidth || rightSpace >= leftSpace;
  }

  function drawMaximumAnnotation(
    svg,
    equilibrium,
    equilibriumX,
    equilibriumY,
    panel,
    left,
    right,
    compact
  ) {
    var label = "βᴵ(v₁) = " +
      formatMoney(equilibrium.bid, state.b - state.a);
    var useRight = annotationLabelFitsRight(
      label, equilibriumX, left, right, 14, compact
    );
    var labelY = equilibriumY < panel.top + 34 ?
      equilibriumY + 24 : equilibriumY - 11;

    appendSvg(svg, "text", {
      x: equilibriumX + (useRight ? 13 : -13),
      y: clampLabelY(labelY, panel.top, panel.top + panel.height),
      class: "maximum-label annotation-halo",
      "text-anchor": useRight ? "start" : "end",
      "data-metric": "equilibrium-maximum",
      "data-equilibrium-bid": equilibrium.bid,
      "data-equilibrium-payoff": equilibrium.expectedPayoff
    }, label);
  }

  function drawDensityEquilibriumAnnotation(
    svg,
    equilibriumBid,
    equilibriumX,
    panel,
    left,
    right,
    compact
  ) {
    var label = "βᴵ(v₁) = " +
      formatMoney(equilibriumBid, state.b - state.a);
    var useRight = annotationLabelFitsRight(
      label, equilibriumX, left, right, 12, compact
    );

    appendSvg(svg, "text", {
      x: equilibriumX + (useRight ? 10 : -10),
      y: panel.top + 36,
      class: "maximum-label density-equilibrium-label annotation-halo",
      "text-anchor": useRight ? "start" : "end",
      "data-panel": "pdf",
      "data-equilibrium-bid": equilibriumBid
    }, label);
  }

  function drawSelectedMarker(svg, x, top, bottom) {
    appendSvg(svg, "line", {
      x1: x,
      y1: top,
      x2: x,
      y2: bottom,
      class: "chosen-marker"
    });
  }

  function drawCurve(svg, points, getX, getY, className) {
    if (points.length < 2) {
      return;
    }
    var path = points.map(function (point, index) {
      return (index === 0 ? "M" : "L") + " " +
        roundCoordinate(getX(point)) + " " +
        roundCoordinate(getY(point));
    }).join(" ");
    appendSvg(svg, "path", { d: path, class: className });
  }

  function drawCircle(svg, x, y, className) {
    appendSvg(svg, "circle", {
      cx: x,
      cy: y,
      r: 6,
      class: className
    });
  }

  function drawDiamond(svg, x, y, className) {
    var radius = 7;
    appendSvg(svg, "polygon", {
      points: [
        x + "," + (y - radius),
        (x + radius) + "," + y,
        x + "," + (y + radius),
        (x - radius) + "," + y
      ].join(" "),
      class: className
    });
  }

  function clampLabelY(value, top, bottom) {
    return model.clamp(value, top + 14, bottom - 8);
  }

  function svgTextBlock(lines, characterWidth, lineHeight) {
    var widestLine = lines.reduce(function (widest, line) {
      return Math.max(widest, line.trim().length * characterWidth);
    }, 0);
    return {
      lines: lines,
      width: widestLine,
      height: 11 + (lines.length - 1) * lineHeight
    };
  }

  function markerAttachedTextPlacement(
    candidates,
    characterWidth,
    lineHeight,
    markerX,
    left,
    right,
    gap
  ) {
    var edgePadding = 4;
    var rightSpace = right - markerX - gap - edgePadding;
    var leftSpace = markerX - left - gap - edgePadding;
    var placement = null;

    candidates.some(function (lines) {
      var block = svgTextBlock(lines, characterWidth, lineHeight);
      if (rightSpace >= block.width) {
        placement = {
          block: block,
          x: markerX + gap,
          anchor: "start",
          placement: "marker-right"
        };
        return true;
      }
      return false;
    });

    if (!placement) {
      candidates.some(function (lines) {
        var block = svgTextBlock(lines, characterWidth, lineHeight);
        if (leftSpace >= block.width) {
          placement = {
            block: block,
            x: markerX - gap,
            anchor: "end",
            placement: "marker-left"
          };
          return true;
        }
        return false;
      });
    }

    if (!placement) {
      var fallbackLines = candidates[candidates.length - 1];
      var useRight = rightSpace >= leftSpace;
      placement = {
        block: svgTextBlock(fallbackLines, characterWidth, lineHeight),
        x: markerX + (useRight ? gap : -gap),
        anchor: useRight ? "start" : "end",
        placement: useRight ? "marker-right" : "marker-left"
      };
    }

    return placement;
  }

  function appendSvgTextLines(
    parent,
    attributes,
    lines,
    lineHeight,
    accessibleLabel
  ) {
    var textAttributes = Object.assign({}, attributes, {
      "aria-label": accessibleLabel,
      "data-line-count": lines.length
    });
    var textNode = appendSvg(parent, "text", textAttributes);

    lines.forEach(function (line, index) {
      appendSvg(textNode, "tspan", {
        x: attributes.x,
        dy: index === 0 ? 0 : lineHeight
      }, line);
    });

    return textNode;
  }

  function appendSvg(parent, name, attributes, text) {
    var node = document.createElementNS(SVG_NS, name);
    Object.keys(attributes || {}).forEach(function (key) {
      node.setAttribute(key, String(attributes[key]));
    });
    if (typeof text === "string") {
      node.textContent = text;
    }
    parent.appendChild(node);
    return node;
  }

  function roundCoordinate(value) {
    return Math.round(value * 100) / 100;
  }

  function chartDescription(current, equilibrium) {
    var span = state.b - state.a;
    var rectangleDescription = current.expectedPayoff < -model.EPSILON ?
      "The red rectangle denotes a negative signed payoff because the " +
        "bid exceeds the value." :
      (Math.abs(current.expectedPayoff) <= model.EPSILON ?
        "The expected-payoff rectangle has zero area." :
        "The shaded rectangle lies under the CDF.");
    return "The first panel plots the PDF of the highest equilibrium bid " +
      "among the other " + (state.n - 1) + " bidder" +
      (state.n - 1 === 1 ? "" : "s") + ". Its area through the proposed " +
      "bid gives the probability of winning, " +
      formatPercent(current.winProbability) + ". The second panel plots the " +
      "probability of winning against bid x subscript 1. A dashed horizontal guide " +
      "marks the selected probability, " +
      formatPercent(current.winProbability) + ". " +
      "The axis marks x subscript 1, payment upon winning, at " +
      formatMoney(current.paymentIfWin, span) +
      ", and brackets v subscript 1 minus x subscript 1, payoff if you win, " +
      "equal to " + formatMoney(current.surplusIfWin, span) +
      ". A rectangle from x subscript 1 to v subscript 1 has probability height " +
      formatPercent(current.winProbability) + ", signed monetary width " +
      formatMoney(state.value - state.bid, span) + ", and signed area equal " +
      "to expected payoff, " + formatMoney(current.expectedPayoff, span) +
      ". " + rectangleDescription + " The maximum occurs at the equilibrium " +
      "bid beta superscript I of v subscript 1, " +
      formatMoney(equilibrium.bid, span) +
      ", where expected payoff " +
      "is " + formatMoney(equilibrium.expectedPayoff, span) + ".";
  }

  function formatMoney(value, span) {
    var cleaned = Math.abs(value) < 1e-10 ? 0 : value;
    var digits = span <= 2 ? 3 : (span <= 20 ? 2 : 1);
    return new Intl.NumberFormat(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: digits
    }).format(cleaned);
  }

  function formatEditableNumber(value) {
    if (!Number.isFinite(value)) {
      return "";
    }
    return String(Number.parseFloat(value.toPrecision(12)));
  }

  function formatChoiceNumber(value) {
    if (!Number.isFinite(value)) {
      return "";
    }
    return String(Number.parseFloat(value.toFixed(1)));
  }

  function distributionSummary() {
    return "The value distribution is transformed Beta with alpha " +
      formatChoiceNumber(state.alpha) + ", beta " +
      formatChoiceNumber(state.beta) + ", and support from " +
      formatEditableNumber(state.a) + " to " +
      formatEditableNumber(state.b);
  }

  function formatAxisMoney(value) {
    return formatMoney(value, state.b - state.a);
  }

  function formatDensityAxis(value) {
    var absolute = Math.abs(value);
    if (absolute > 0 && (absolute < 0.001 || absolute >= 10000)) {
      return value.toExponential(1);
    }
    return new Intl.NumberFormat(undefined, {
      maximumSignificantDigits: 3
    }).format(value);
  }

  function formatProbabilityAxis(value) {
    return new Intl.NumberFormat(undefined, {
      style: "percent",
      maximumFractionDigits: 0
    }).format(value);
  }

  function formatPercent(value) {
    return new Intl.NumberFormat(undefined, {
      style: "percent",
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    }).format(value);
  }
}());
