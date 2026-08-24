(function () {
  "use strict";

  var model = window.SPAModel;
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
  var resizeTimer = null;
  var mathTypesetQueue = Promise.resolve();
  var mathLoadPromise = null;
  var mathRequestVersions = new WeakMap();
  var lastChartLayout = {
    width: 1000,
    left: 90,
    right: 975
  };

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
      chart: byId("second-price-chart")
    };

    typesetInitialHtmlMath();
    bindEvents();
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
      var validation = validateAuctionInputs(state.n, inputA, inputB);

      if (!validation.valid) {
        showError(validation.errors.join(" "));
        revertBoundsInputs();
        return;
      }

      setValue(distributions.quantile(
        Math.random(),
        state.a,
        state.b,
        distributionSpec()
      ));
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
      try {
        elements.chart.setPointerCapture(event.pointerId);
      } catch (error) {
        // Synthetic pointer events do not always establish an active pointer.
      }
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
      if (chartDragActive) {
        var bid = chartPointerToBid(event, true);
        if (bid !== null) {
          setBid(bid);
        }
      }
      chartDragActive = false;
      if (elements.chart.hasPointerCapture &&
          elements.chart.hasPointerCapture(event.pointerId)) {
        elements.chart.releasePointerCapture(event.pointerId);
      }
    });

    elements.chart.addEventListener("pointercancel", function () {
      chartDragActive = false;
    });

    elements.chart.addEventListener("keydown", function (event) {
      var step = rangeStep(bidDomainSpan());
      var nextBid = null;

      if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
        nextBid = state.bid - step;
      } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
        nextBid = state.bid + step;
      } else if (event.key === "Home") {
        nextBid = state.a;
      } else if (event.key === "End") {
        nextBid = bidUpperBound();
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

  function updateBoundsFromInputs() {
    var nextA = Number.parseFloat(elements.lowerBound.value);
    var nextB = Number.parseFloat(elements.upperBound.value);
    var validation = validateAuctionInputs(state.n, nextA, nextB);

    if (!validation.valid) {
      showError(validation.errors.join(" "));
      revertBoundsInputs();
      return;
    }

    var oldSpan = state.b - state.a;
    var valuePosition = oldSpan > 0 ? (state.value - state.a) / oldSpan : 0.8;
    var bidPosition = oldSpan > 0 ?
      (state.bid - state.a) / oldSpan : 0.3;
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
    state.bid = model.clamp(nextBid, state.a, bidUpperBound());
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

  function syncControlsFromState() {
    elements.bidderCount.value = String(state.n);
    elements.lowerBound.value = String(state.a);
    elements.upperBound.value = String(state.b);

    configureRange(elements.valueSlider, state.a, state.b, state.value);
    configureRange(
      elements.bidSlider,
      state.a,
      bidUpperBound(),
      state.bid
    );
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
      bidUpperBound(),
      state.bid,
      formatChoiceNumber
    );
    elements.alphaSlider.value = String(state.alpha);
    elements.betaSlider.value = String(state.beta);
    elements.alphaNumber.value = formatChoiceNumber(state.alpha);
    elements.betaNumber.value = formatChoiceNumber(state.beta);
  }

  function bidUpperBound() {
    return state.b;
  }

  function bidDomainSpan() {
    return bidUpperBound() - state.a;
  }

  function validateAuctionInputs(n, a, b) {
    var validation = model.validateAuction(n, a, b, distributionSpec());
    return {
      valid: validation.valid,
      errors: validation.errors.slice()
    };
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

  function renderValuePdfPreview() {
    var svg = elements.valuePdfPreview;
    if (!svg) {
      return;
    }

    var width = 320;
    var height = 120;
    var left = 14;
    var right = 306;
    var top = 9;
    var base = 91;
    var count = 161;
    var endpointInset = 1 / (count * 3);
    var samples = [];
    var maximum = 0;
    var i;

    while (svg.firstChild) {
      svg.removeChild(svg.firstChild);
    }
    svg.setAttribute("viewBox", "0 0 " + width + " " + height);
    svg.setAttribute("data-alpha", state.alpha);
    svg.setAttribute("data-beta", state.beta);
    svg.setAttribute("data-lower-bound", state.a);
    svg.setAttribute("data-upper-bound", state.b);

    appendSvg(svg, "title", { id: "value-pdf-preview-title" },
      "PDF of Value");
    appendSvg(svg, "desc", { id: "value-pdf-preview-description" },
      "Beta value density on [" + formatEditableNumber(state.a) + ", " +
      formatEditableNumber(state.b) + "] with alpha " +
      formatChoiceNumber(state.alpha) + " and beta " +
      formatChoiceNumber(state.beta) + ".");

    for (i = 0; i < count; i += 1) {
      var ratio = i / (count - 1);
      var evaluationRatio = ratio;
      if (ratio === 0) {
        evaluationRatio = endpointInset;
      } else if (ratio === 1) {
        evaluationRatio = 1 - endpointInset;
      }
      var value = state.a + evaluationRatio * (state.b - state.a);
      var density = distributions.pdf(
        value,
        state.a,
        state.b,
        distributionSpec()
      );
      if (!Number.isFinite(density) || density < 0) {
        density = 0;
      }
      maximum = Math.max(maximum, density);
      samples.push({ ratio: ratio, density: density });
    }
    if (!Number.isFinite(maximum) || maximum <= 0) {
      maximum = 1;
    }

    var curvePath = "";
    samples.forEach(function (sample, index) {
      var x = left + sample.ratio * (right - left);
      var y = base - (sample.density / maximum) * (base - top);
      curvePath += (index === 0 ? "M " : " L ") +
        roundCoordinate(x) + " " + roundCoordinate(y);
    });
    var areaPath = "M " + left + " " + base + " " +
      curvePath.replace(/^M /, "L ") + " L " + right + " " + base + " Z";

    appendSvg(svg, "path", {
      d: areaPath,
      class: "value-pdf-area"
    });
    appendSvg(svg, "line", {
      x1: left,
      y1: base,
      x2: right,
      y2: base,
      class: "value-pdf-axis"
    });
    appendSvg(svg, "path", {
      d: curvePath,
      class: "value-pdf-curve"
    });
    appendSvg(svg, "line", {
      x1: left,
      y1: base - 4,
      x2: left,
      y2: base + 4,
      class: "value-pdf-axis"
    });
    appendSvg(svg, "line", {
      x1: right,
      y1: base - 4,
      x2: right,
      y2: base + 4,
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

  function revertBoundsInputs() {
    elements.lowerBound.value = formatEditableNumber(state.a);
    elements.upperBound.value = formatEditableNumber(state.b);
  }

  function configureRange(range, min, max, value) {
    range.min = String(min);
    range.max = String(max);
    range.step = "any";
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
    var truthful = model.truthfulOutcomes(
      state.value,
      state.n,
      state.a,
      state.b,
      distributionSpec()
    );

    updateControls();
    renderValuePdfPreview();
    drawChart(current, truthful);
    updateAccessibleSummary(current, truthful);
  }

  function updateControls() {
    var span = state.b - state.a;
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
      formatMoney(state.value, span) + " value units"
    );
    elements.bidSlider.setAttribute(
      "aria-valuetext",
      formatMoney(state.bid, span) + " value units"
    );
  }

  function updateAccessibleSummary(current, truthful) {
    var span = state.b - state.a;
    var conditionalPayment = current.expectedPaymentIfWin === null ?
      "undefined because the winning probability is zero" :
      formatMoney(current.expectedPaymentIfWin, span);
    elements.liveSummary.textContent =
      distributionSummary() + ". Private value " +
      formatMoney(state.value, span) +
      ", proposed bid " + formatMoney(state.bid, span) +
      ", probability of winning " + formatPercent(current.winProbability) +
      ", expected payment conditional on winning " + conditionalPayment +
      ", expected payoff " + formatMoney(current.expectedPayoff, span) +
      ", and truthful bid " + formatMoney(truthful.bid, span) + ".";
  }

  function chartPointerToBid(event, clampOutside) {
    var rectangle = elements.chart.getBoundingClientRect();
    if (rectangle.width <= 0) {
      return null;
    }

    var svgX = (event.clientX - rectangle.left) *
      lastChartLayout.width / rectangle.width;
    if (svgX < lastChartLayout.left || svgX > lastChartLayout.right) {
      if (!clampOutside) {
        return null;
      }
      svgX = model.clamp(
        svgX,
        lastChartLayout.left,
        lastChartLayout.right
      );
    }
    var ratio = (svgX - lastChartLayout.left) /
      (lastChartLayout.right - lastChartLayout.left);

    return state.a + ratio * bidDomainSpan();
  }

  function drawChart(current, truthful) {
    var svg = elements.chart;
    var layout = getChartLayout();
    var left = layout.left;
    var right = layout.right;
    var plotWidth = right - left;
    var xSpan = bidDomainSpan();
    var densitySamples = sampleDensity(241, current.bid);
    var cdfSamples = sampleCdf(241, current.bid, state.value);
    var densityMax = densityScaleMaximum(densitySamples) * 1.08;

    var densityPanel = {
      top: layout.densityTop,
      height: layout.densityHeight,
      min: 0,
      max: densityMax,
      title: "PDF of highest opposing bid",
      format: formatDensityAxis,
      tickCount: 3
    };
    var cdfPanel = {
      top: layout.cdfTop,
      height: layout.cdfHeight,
      min: 0,
      max: 1,
      title: "Expected payoff",
      format: formatProbabilityAxis,
      tickCount: 4
    };

    lastChartLayout = layout;
    svg.setAttribute(
      "viewBox",
      "0 0 " + layout.width + " " + layout.height
    );
    while (svg.firstChild) {
      svg.removeChild(svg.firstChild);
    }

    appendSvg(svg, "title", { id: "chart-title" },
      "Second-price auction expected payoff by proposed bid");
    appendSvg(svg, "desc", { id: "chart-description" },
      chartDescription(current, truthful));

    drawPanelScaffold(svg, densityPanel, left, right);
    drawPanelScaffold(svg, cdfPanel, left, right);

    var xScale = function (value) {
      return left + ((value - state.a) / xSpan) * plotWidth;
    };

    drawDensityArea(
      svg,
      densitySamples,
      current.bid,
      xScale,
      densityPanel,
      left
    );
    drawCurve(
      svg,
      densitySamples,
      function (point) { return xScale(point.bid); },
      function (point) { return densityY(point.density, densityPanel); },
      "curve highest-bid-density-curve"
    );

    var truthfulX = xScale(truthful.bid);
    appendSvg(svg, "line", {
      x1: truthfulX,
      y1: densityPanel.top,
      x2: truthfulX,
      y2: densityPanel.top + densityPanel.height,
      class: "equilibrium-marker density-equilibrium-marker truthful-marker",
      "data-truthful-bid": truthful.bid
    });
    drawDensityTruthfulAnnotation(
      svg,
      truthfulX,
      densityPanel,
      left,
      right,
      truthful.bid
    );

    var chosenX = xScale(current.bid);
    var densityAtBid = model.highestOpponentBidDensity(
      current.bid,
      state.n,
      state.a,
      state.b,
      distributionSpec()
    );
    drawSelectedMarker(
      svg,
      chosenX,
      densityPanel.top,
      densityPanel.top + densityPanel.height
    );
    drawCircle(
      svg,
      chosenX,
      densityY(densityAtBid, densityPanel),
      "chosen-point"
    );

    drawSecondPricePayoffArea(
      svg,
      current,
      truthful,
      cdfSamples,
      xScale,
      cdfPanel,
      left
    );
    drawCurve(
      svg,
      cdfSamples,
      function (point) { return xScale(point.bid); },
      function (point) { return yScale(point.cdf, cdfPanel); },
      "curve highest-bid-cdf-curve second-price-cdf-curve"
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

    var cdfTop = cdfPanel.top;
    var cdfBottom = cdfPanel.top + cdfPanel.height;
    drawSelectedMarker(svg, chosenX, cdfTop, cdfBottom);
    drawCircle(
      svg,
      chosenX,
      yScale(current.winProbability, cdfPanel),
      "chosen-point selected-cdf-point"
    );

    var truthfulY = yScale(truthful.winProbability, cdfPanel);
    appendSvg(svg, "line", {
      x1: truthfulX,
      y1: cdfTop,
      x2: truthfulX,
      y2: cdfBottom,
      class: "equilibrium-marker truthful-marker",
      "data-truthful-bid": truthful.bid
    });
    drawDiamond(
      svg,
      truthfulX,
      truthfulY,
      "equilibrium-point truthful-point"
    );
    if (Math.abs(current.bid - truthful.bid) <= model.EPSILON) {
      appendSvg(svg, "circle", {
        cx: truthfulX,
        cy: truthfulY,
        r: 3,
        class: "chosen-point coincident-choice-point",
        "data-bid": current.bid,
        "data-truthful-bid": truthful.bid
      });
    }
    drawTruthfulAnnotation(
      svg,
      truthfulX,
      truthfulY,
      cdfPanel,
      left,
      right,
      truthful.bid
    );
    drawAxisChoiceLabels(
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
      y: densityPanel.top,
      width: plotWidth,
      height: cdfBottom - densityPanel.top,
      class: "drag-overlay",
      "aria-hidden": "true"
    });

    drawExpectedPayoffLabel(
      svg,
      current,
      truthful,
      xScale,
      cdfPanel,
      left,
      right,
      layout.compact
    );
    drawProbabilityAreaLabel(
      svg,
      current,
      xScale,
      densityPanel,
      left,
      xScale(Math.min(current.bid, state.b)),
      layout.compact
    );
    drawWinningProbabilityGuideLabel(
      svg,
      current,
      cdfPanel,
      left,
      right,
      layout.compact
    );
  }

  function sampleDensity(count, selectedBid) {
    var points = [];
    var i;
    for (i = 0; i < count; i += 1) {
      var bid = state.a + (i / (count - 1)) * bidDomainSpan();
      points.push({
        bid: bid,
        density: densityForPlot(bid)
      });
    }
    points.push({
      bid: state.b,
      density: densityForPlot(state.b)
    });
    points.push({
      bid: state.b,
      density: 0
    });
    points.push({
      bid: selectedBid,
      density: densityForPlot(selectedBid)
    });
    points.sort(function (first, second) {
      if (Math.abs(first.bid - second.bid) > model.EPSILON) {
        return first.bid - second.bid;
      }
      return second.density - first.density;
    });
    return uniqueDensityPoints(points);
  }

  function densityForPlot(bid) {
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

    var span = state.b - state.a;
    var inwardBid = bid <= state.a + span / 2 ?
      state.a + span / 1000 : state.b - span / 1000;
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
    var finite = points.map(function (point) {
      return point.density;
    }).filter(function (density) {
      return Number.isFinite(density) && density > 0;
    }).sort(function (first, second) {
      return first - second;
    });

    if (finite.length === 0) {
      return 1;
    }
    return finite[finite.length - 1];
  }

  function densityY(value, panel) {
    var bounded = Number.isFinite(value) ?
      model.clamp(value, panel.min, panel.max) : panel.max;
    return yScale(bounded, panel);
  }

  function sampleCdf(count, selectedBid, value) {
    var points = [];
    var i;
    for (i = 0; i < count; i += 1) {
      var bid = state.a + (i / (count - 1)) * bidDomainSpan();
      points.push({
        bid: bid,
        cdf: model.highestOpponentBidCdf(
          bid,
          state.n,
          state.a,
          state.b,
          distributionSpec()
        )
      });
    }
    [state.b, selectedBid, value].forEach(function (bid) {
      points.push({
        bid: bid,
        cdf: model.highestOpponentBidCdf(
          bid,
          state.n,
          state.a,
          state.b,
          distributionSpec()
        )
      });
    });
    points.sort(function (first, second) { return first.bid - second.bid; });
    return uniqueByBid(points);
  }

  function uniqueDensityPoints(points) {
    return points.filter(function (point, index) {
      if (index === 0) {
        return true;
      }
      var previous = points[index - 1];
      return Math.abs(point.bid - previous.bid) > model.EPSILON ||
        Math.abs(point.density - previous.density) > model.EPSILON;
    });
  }

  function uniqueByBid(points) {
    return points.filter(function (point, index) {
      return index === 0 ||
        Math.abs(point.bid - points[index - 1].bid) > model.EPSILON;
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
        endpointLabelY: 746,
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
      endpointLabelY: 726,
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
      y: panel.top - 27,
      class: "panel-caption"
    }, panel.title);

    panelTicks(panel.min, panel.max, panel.tickCount).forEach(function (tick) {
      var y = yScale(tick, panel);
      appendSvg(svg, "line", {
        x1: left,
        y1: y,
        x2: right,
        y2: y,
        class: Math.abs(tick) <= model.EPSILON ?
          "zero-line" : "grid-line"
      });
      appendSvg(svg, "text", {
        x: left - 10,
        y: y + 4,
        class: "axis-text",
        "text-anchor": "end"
      }, panel.format(tick));
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
    return ticks;
  }

  function drawDensityArea(svg, points, endBid, xScale, panel, left) {
    var selected = points.filter(function (point) {
      return point.bid <= endBid + model.EPSILON;
    });
    var baseY = yScale(0, panel);
    var path = "M " + roundCoordinate(left) + " " + roundCoordinate(baseY);

    selected.forEach(function (point) {
      path += " L " + roundCoordinate(xScale(point.bid)) + " " +
        roundCoordinate(densityY(point.density, panel));
    });
    path += " L " + roundCoordinate(xScale(endBid)) + " " +
      roundCoordinate(baseY) + " Z";

    appendSvg(svg, "path", {
      d: path,
      class: "winning-area",
      "data-start-bid": state.a,
      "data-end-bid": endBid,
      "data-probability": model.winProbability(
        endBid,
        state.n,
        state.a,
        state.b,
        distributionSpec()
      )
    });
  }

  function winProbabilityLabelCandidates(winProbability) {
    var fullLabel = "Probability of winning = " + formatPercent(winProbability);
    return {
      fullLabel: fullLabel,
      lines: [
        [fullLabel],
        ["Probability of winning", "= " + formatPercent(winProbability)],
        ["Probability", "of winning", "= " + formatPercent(winProbability)]
      ]
    };
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
    var labelCandidates = winProbabilityLabelCandidates(current.winProbability);
    var fullLabel = labelCandidates.fullLabel;
    var candidates = labelCandidates.lines;
    var availableWidth = shadedRight - left;
    var lineHeight = 13;
    var characterWidth = compact ? 5.4 : 5.8;
    var horizontalPadding = 12;
    var baseY = yScale(0, panel);
    var plotWidth = xScale(state.b) - left;
    var selected = null;
    var widthFits = false;

    candidates.some(function (candidate) {
      var block = svgTextBlock(candidate, characterWidth, lineHeight);
      if (block.width + 2 * horizontalPadding > availableWidth) {
        return false;
      }
      widthFits = true;

      var labelLeft = shadedRight - block.width - horizontalPadding;
      var labelRight = shadedRight - horizontalPadding;
      var minimumHeight = Infinity;
      var sampleCount = 7;
      var sampleIndex;

      for (sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
        var sampleX = labelLeft +
          (sampleIndex / (sampleCount - 1)) * (labelRight - labelLeft);
        var sampleBid = state.a +
          ((sampleX - left) / plotWidth) * (state.b - state.a);
        var sampleDensity = model.highestOpponentBidDensity(
          sampleBid,
          state.n,
          state.a,
          state.b,
          distributionSpec()
        );
        minimumHeight = Math.min(
          minimumHeight,
          baseY - densityY(sampleDensity, panel)
        );
      }

      if (minimumHeight >= block.height + 12) {
        selected = {
          lines: candidate,
          block: block,
          x: (labelLeft + labelRight) / 2,
          y: baseY - 6 - block.height / 2
        };
        return true;
      }
      return false;
    });

    var label;
    if (selected && current.winProbability > model.EPSILON) {
      label = appendSvgTextLines(
        svg,
        selected.x,
        selected.y,
        selected.lines,
        "area-label probability-label annotation-halo",
        "middle",
        lineHeight,
        fullLabel,
        selected.lines.length === 1 ? "inside-single" : "inside-wrapped"
      );
      label.setAttribute("data-placement", "inside");
    } else {
      var plotRight = xScale(state.b);
      var rightSpace = plotRight - shadedRight - horizontalPadding;
      var outsideLines = null;
      var placeRight = true;

      candidates.some(function (candidate) {
        var candidateBlock = svgTextBlock(
          candidate,
          characterWidth,
          lineHeight
        );
        if (candidateBlock.width <= rightSpace) {
          outsideLines = candidate;
          return true;
        }
        return false;
      });

      if (!outsideLines) {
        placeRight = false;
        var leftSpace = shadedRight - left - horizontalPadding;
        candidates.some(function (candidate) {
          var candidateBlock = svgTextBlock(
            candidate,
            characterWidth,
            lineHeight
          );
          if (candidateBlock.width <= leftSpace) {
            outsideLines = candidate;
            return true;
          }
          return false;
        });
      }

      if (!outsideLines) {
        outsideLines = candidates[candidates.length - 1];
      }

      label = appendSvgTextLines(
        svg,
        shadedRight + (placeRight ? horizontalPadding : -horizontalPadding),
        baseY - 10 - ((outsideLines.length - 1) * lineHeight) / 2,
        outsideLines,
        "area-label probability-label annotation-halo",
        placeRight ? "start" : "end",
        lineHeight,
        fullLabel,
        placeRight ? "right-of-highlight" : "left-of-marker"
      );
      label.setAttribute(
        "data-placement",
        placeRight ? "right-of-highlight" : "left-of-marker"
      );
      label.setAttribute("data-vertical-placement", "panel-floor");
      label.setAttribute("data-marker-distance", horizontalPadding);
      label.setAttribute(
        "data-fit-failure",
        widthFits && current.winProbability > model.EPSILON ?
          "height" : "width"
      );
    }
    label.setAttribute("data-probability", current.winProbability);
    label.setAttribute("data-foreground", "true");
  }

  function drawSecondPricePayoffArea(
    svg,
    current,
    truthful,
    points,
    xScale,
    panel,
    left
  ) {
    var baseY = yScale(0, panel);
    var group = appendSvg(svg, "g", {
      class: "spa-payoff-area",
      "data-state": current.bid < state.value - model.EPSILON ?
        "underbid" : (current.bid > state.value + model.EPSILON ?
          "overbid" : "truthful"),
      "data-bid": current.bid,
      "data-value": state.value,
      "data-expected-payoff": current.expectedPayoff,
      "data-truthful-payoff": truthful.expectedPayoff,
      "data-probability": current.winProbability
    });

    if (current.bid <= state.value + model.EPSILON) {
      var selectedPoints = points.filter(function (point) {
        return point.bid <= current.bid + model.EPSILON;
      });
      var positivePath = "M " + roundCoordinate(left) + " " +
        roundCoordinate(baseY);
      selectedPoints.forEach(function (point) {
        positivePath += " L " + roundCoordinate(xScale(point.bid)) + " " +
          roundCoordinate(yScale(point.cdf, panel));
      });
      positivePath += " L " + roundCoordinate(xScale(state.value)) + " " +
        roundCoordinate(yScale(current.winProbability, panel));
      positivePath += " L " + roundCoordinate(xScale(state.value)) + " " +
        roundCoordinate(baseY) + " Z";

      appendSvg(group, "path", {
        d: positivePath,
        class: "spa-payoff-area-positive",
        "data-positive-area": current.expectedPayoff,
        "data-expected-payoff": current.expectedPayoff
      });
    } else {
      var truthfulPoints = points.filter(function (point) {
        return point.bid <= state.value + model.EPSILON;
      });
      var truthfulPath = "M " + roundCoordinate(left) + " " +
        roundCoordinate(baseY);
      truthfulPoints.forEach(function (point) {
        truthfulPath += " L " + roundCoordinate(xScale(point.bid)) + " " +
          roundCoordinate(yScale(point.cdf, panel));
      });
      truthfulPath += " L " + roundCoordinate(xScale(state.value)) + " " +
        roundCoordinate(baseY) + " Z";
      appendSvg(group, "path", {
        d: truthfulPath,
        class: "spa-payoff-area-positive",
        "data-positive-area": truthful.expectedPayoff
      });

      var lossPoints = points.filter(function (point) {
        return point.bid >= state.value - model.EPSILON &&
          point.bid <= current.bid + model.EPSILON;
      }).reverse();
      var lossPath = "M " + roundCoordinate(xScale(state.value)) + " " +
        roundCoordinate(yScale(current.winProbability, panel)) +
        " L " + roundCoordinate(xScale(current.bid)) + " " +
        roundCoordinate(yScale(current.winProbability, panel));
      lossPoints.forEach(function (point) {
        lossPath += " L " + roundCoordinate(xScale(point.bid)) + " " +
          roundCoordinate(yScale(point.cdf, panel));
      });
      lossPath += " Z";

      var loss = truthful.expectedPayoff - current.expectedPayoff;
      appendSvg(group, "path", {
        d: lossPath,
        class: "spa-payoff-area-negative",
        "data-loss-area": loss,
        "data-expected-payoff": current.expectedPayoff
      });
    }

    if (Math.abs(current.expectedPayoff) <= model.EPSILON) {
      appendSvg(group, "circle", {
        cx: xScale(current.bid),
        cy: baseY,
        r: 4,
        class: "zero-expected-payoff",
        "data-expected-payoff": current.expectedPayoff
      });
    }
  }

  function drawExpectedPayoffLabel(
    svg,
    current,
    truthful,
    xScale,
    panel,
    left,
    right,
    compact
  ) {
    var baseY = yScale(0, panel);
    var payoffSign = current.expectedPayoff < -model.EPSILON ?
      "negative" : (current.expectedPayoff > model.EPSILON ?
        "positive" : "zero");
    var negative = payoffSign === "negative";
    var fullLabel = "Expected payoff = " +
      formatMoney(current.expectedPayoff, state.b - state.a);
    var candidates = [
      [fullLabel],
      ["Expected payoff", "= " +
        formatMoney(current.expectedPayoff, state.b - state.a)],
      ["Expected", "payoff", "= " +
        formatMoney(current.expectedPayoff, state.b - state.a)]
    ];
    var lineHeight = 13;
    var characterWidth = compact ? 5.4 : 5.8;
    var horizontalPadding = 9;
    var bidX = xScale(current.bid);
    var valueX = xScale(state.value);
    var overbid = current.bid > state.value + model.EPSILON;
    var lines = null;
    var block = null;
    var labelX;
    var labelY;
    var anchor;
    var placement;
    var widthFits = false;
    var heightFits = false;

    function fitLinesToWidth(width) {
      var match = null;
      candidates.some(function (candidate) {
        var candidateBlock = svgTextBlock(
          candidate,
          characterWidth,
          lineHeight
        );
        if (candidateBlock.width + 2 * horizontalPadding <= width) {
          match = { lines: candidate, block: candidateBlock };
          return true;
        }
        return false;
      });
      return match;
    }

    function placeBesideBid(preferredSide) {
      var sides = preferredSide === "left" ?
        ["left", "right"] : ["right", "left"];
      var match = null;
      var side = sides[0];

      sides.some(function (candidateSide) {
        var available = candidateSide === "right" ?
          right - bidX - horizontalPadding :
          bidX - left - horizontalPadding;
        var candidateMatch = fitLinesToWidth(available);
        if (candidateMatch) {
          side = candidateSide;
          match = candidateMatch;
          return true;
        }
        return false;
      });

      if (!match) {
        side = right - bidX >= bidX - left ? "right" : "left";
        lines = candidates[candidates.length - 1];
        block = svgTextBlock(lines, characterWidth, lineHeight);
      } else {
        lines = match.lines;
        block = match.block;
      }

      labelX = bidX + (side === "right" ?
        horizontalPadding : -horizontalPadding);
      anchor = side === "right" ? "start" : "end";
      placement = side === "right" ?
        "bid-marker-right" : "bid-marker-left";
      return side;
    }

    function keepLabelInPanel(rawY, textBlock) {
      return model.clamp(
        rawY,
        panel.top + textBlock.height / 2 + 8,
        baseY - textBlock.height / 2 - 8
      );
    }

    if (overbid) {
      var selectedProbabilityY = yScale(current.winProbability, panel);
      var truthfulProbabilityY = yScale(truthful.winProbability, panel);
      var regionWidth = negative ? bidX - valueX : valueX - left;
      var regionMatch = fitLinesToWidth(regionWidth);

      if (regionMatch) {
        lines = regionMatch.lines;
        block = regionMatch.block;
        widthFits = true;
      } else {
        lines = candidates[candidates.length - 1];
        block = svgTextBlock(lines, characterWidth, lineHeight);
      }

      if (negative) {
        if (regionMatch) {
          labelX = valueX + horizontalPadding;
          anchor = "start";
          placement = "inside-red-area";
        } else if (right - valueX >= block.width + horizontalPadding + 4) {
          labelX = valueX + horizontalPadding;
          anchor = "start";
          placement = "red-area-right-of-value";
        } else {
          labelX = right - 4;
          anchor = "end";
          placement = "red-area-right-edge";
        }
        labelY = keepLabelInPanel(
          (selectedProbabilityY + truthfulProbabilityY) / 2,
          block
        );
      } else {
        labelX = regionMatch ?
          valueX - horizontalPadding :
          Math.min(
            right - 4,
            Math.max(left + 4 + block.width, valueX - horizontalPadding)
          );
        anchor = "end";
        placement = regionMatch ?
          "inside-green-area" : "green-area-near-value";
        labelY = keepLabelInPanel(
          (truthfulProbabilityY + baseY) / 2,
          block
        );
      }
      heightFits = block.height + 12 <= Math.abs(
        baseY - truthfulProbabilityY
      );
    } else {
      var rectangleTop = yScale(current.winProbability, panel);
      var rectangleWidth = valueX - bidX;
      var insideMatch = fitLinesToWidth(rectangleWidth);

      if (insideMatch) {
        lines = insideMatch.lines;
        block = insideMatch.block;
        labelX = (bidX + valueX) / 2;
        labelY = keepLabelInPanel(
          (rectangleTop + baseY) / 2,
          block
        );
        anchor = "middle";
        placement = "inside";
        widthFits = true;
        heightFits = block.height + 12 <= baseY - rectangleTop;
      } else {
        placeBesideBid("right");
        labelY = keepLabelInPanel(
          Math.abs(current.expectedPayoff) <= model.EPSILON ?
            baseY - 50 : (rectangleTop + baseY) / 2,
          block
        );
      }
    }

    var label = appendSvgTextLines(
      svg,
      labelX,
      labelY,
      lines,
      "expected-payoff-label annotation-halo" +
        (negative ? " negative-metric" : ""),
      anchor,
      lineHeight,
      fullLabel,
      placement === "inside" ?
        (lines.length === 1 ? "inside-single" : "inside-wrapped") :
        placement
    );
    label.setAttribute("data-placement", placement);
    if (placement !== "inside") {
      label.setAttribute("data-marker-distance", horizontalPadding);
    }
    label.setAttribute("data-payoff-sign", payoffSign);
    label.setAttribute(
      "data-payoff-region",
      negative ? "red" : "green"
    );
    if (!overbid) {
      label.setAttribute("data-width-fit", widthFits);
      label.setAttribute("data-height-fit", heightFits);
    }
    if (payoffSign === "zero") {
      label.setAttribute("style", "fill: var(--ink)");
    }
    label.setAttribute("data-expected-payoff", current.expectedPayoff);
    label.setAttribute("data-foreground", "true");
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

    var tickValues = [state.a, state.b];
    tickValues.forEach(function (value, index) {
      var x = xScale(value);
      var anchor = index === 0 ? "start" :
        (index === tickValues.length - 1 ? "end" : "middle");
      appendSvg(svg, "line", {
        x1: x,
        y1: zeroY,
        x2: x,
        y2: zeroY + 6,
        class: "axis-line"
      });
      appendSvg(svg, "text", {
        x: x + (index === 0 ? 2 :
          (index === tickValues.length - 1 ? -2 : 0)),
        y: zeroY + 20,
        class: "axis-text annotation-halo",
        "text-anchor": anchor,
        "data-bid-tick": value
      }, formatAxisMoney(value));
    });
  }

  function drawAxisChoiceLabels(
    svg,
    current,
    xScale,
    zeroY,
    left,
    right,
    layout
  ) {
    var bidX = xScale(current.bid);
    var valueX = xScale(state.value);
    var close = Math.abs(bidX - valueX) < (layout.compact ? 105 : 120);

    if (Math.abs(current.bid - state.value) <= model.EPSILON) {
      appendSvg(svg, "line", {
        x1: bidX,
        y1: zeroY - 9,
        x2: bidX,
        y2: zeroY + 9,
        class: "axis-bid-marker axis-value-marker",
        "data-bid": current.bid,
        "data-value": state.value
      });
      appendSvg(svg, "text", {
        x: bidX,
        y: layout.endpointLabelY,
        class: "axis-bid-label axis-value-label annotation-halo",
        "text-anchor": axisAnchor(bidX, left, right)
      }, "x₁ = v₁ = " + formatMoney(state.value, state.b - state.a));
      return;
    }

    appendSvg(svg, "line", {
      x1: bidX,
      y1: zeroY - 9,
      x2: bidX,
      y2: zeroY + 9,
      class: "axis-bid-marker",
      "data-bid": current.bid
    });
    appendSvg(svg, "line", {
      x1: valueX,
      y1: zeroY - 8,
      x2: valueX,
      y2: zeroY + 8,
      class: "axis-value-marker",
      "data-value": state.value
    });

    var bidDirection = bidX < valueX ? -1 : 1;
    var valueDirection = -bidDirection;
    var bidAnchor = bidDirection < 0 ? "end" : "start";
    var valueAnchor = valueDirection < 0 ? "end" : "start";
    var bidLabelX = bidX + bidDirection * 7;
    var valueLabelX = valueX + valueDirection * 7;

    if (bidLabelX < left + 5) {
      bidAnchor = "start";
      bidLabelX = bidX + 7;
    } else if (bidLabelX > right - 5) {
      bidAnchor = "end";
      bidLabelX = bidX - 7;
    }
    if (valueLabelX < left + 5) {
      valueAnchor = "start";
      valueLabelX = valueX + 7;
    } else if (valueLabelX > right - 5) {
      valueAnchor = "end";
      valueLabelX = valueX - 7;
    }

    appendSvg(svg, "text", {
      x: bidLabelX,
      y: layout.endpointLabelY,
      class: "axis-bid-label annotation-halo",
      "text-anchor": bidAnchor
    }, "x₁ = " + formatMoney(current.bid, state.b - state.a));
    appendSvg(svg, "text", {
      x: valueLabelX,
      y: layout.endpointLabelY + (close ? 15 : 0),
      class: "axis-value-label annotation-halo",
      "text-anchor": valueAnchor
    }, "v₁ = " + formatMoney(state.value, state.b - state.a));
  }

  function axisAnchor(x, left, right) {
    if (x < left + 55) {
      return "start";
    }
    if (x > right - 55) {
      return "end";
    }
    return "middle";
  }

  function drawWinningProbabilityGuideLine(svg, current, selectedX, panel, left) {
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
    left,
    right,
    compact
  ) {
    var guideY = yScale(current.winProbability, panel);
    var labelCandidates = winProbabilityLabelCandidates(current.winProbability);
    var fullLabel = labelCandidates.fullLabel;
    var candidates = labelCandidates.lines;
    var characterWidth = compact ? 5.4 : 5.8;
    var lineHeight = 13;
    var padding = 10;
    var available = right - left - padding * 2;
    var selected = null;

    candidates.some(function (candidate) {
      var block = svgTextBlock(candidate, characterWidth, lineHeight);
      if (block.width <= available) {
        selected = { lines: candidate, block: block };
        return true;
      }
      return false;
    });

    if (!selected) {
      selected = {
        lines: candidates[candidates.length - 1],
        block: svgTextBlock(
          candidates[candidates.length - 1],
          characterWidth,
          lineHeight
        )
      };
    }

    var roomAbove = guideY - panel.top;
    var labelY;
    if (selected.lines.length === 1) {
      labelY = guideY <= panel.top + 18 ? guideY + 17 : guideY - 8;
    } else {
      labelY = roomAbove >= selected.block.height + 18 ?
        guideY - selected.block.height / 2 - 10 :
        guideY + selected.block.height / 2 + 10;
    }
    var label = appendSvgTextLines(
      svg,
      left + padding,
      labelY,
      selected.lines,
      "winning-probability-guide-label annotation-halo",
      "start",
      lineHeight,
      fullLabel,
      "y-axis-right"
    );
    label.setAttribute("data-placement", "y-axis-right");
    label.setAttribute("data-axis-distance", padding);
    label.setAttribute("data-guide-y", guideY);
    label.setAttribute("data-probability", current.winProbability);
    label.setAttribute("data-foreground", "true");
  }

  function drawTruthfulAnnotation(
    svg,
    x,
    y,
    panel,
    left,
    right,
    truthfulBid
  ) {
    var placeLeft = x > left + (right - left) * 0.76;
    var panelBottom = panel.top + panel.height;
    var labelY = y > panelBottom - 32 ? y - 34 : y - 10;
    appendSvg(svg, "text", {
      x: x + (placeLeft ? -10 : 10),
      y: Math.max(panel.top + 15, labelY),
      class: "maximum-label truthful-label annotation-halo",
      "text-anchor": placeLeft ? "end" : "start",
      "data-truthful-bid": truthfulBid
    }, "βᴵᴵ(v₁) = " + formatMoney(truthfulBid, state.b - state.a));
  }

  function drawDensityTruthfulAnnotation(
    svg,
    x,
    panel,
    left,
    right,
    truthfulBid
  ) {
    var placeLeft = x > left + (right - left) * 0.76;
    appendSvg(svg, "text", {
      x: x + (placeLeft ? -10 : 10),
      y: panel.top + 17,
      class: "maximum-label density-equilibrium-label annotation-halo",
      "text-anchor": placeLeft ? "end" : "start",
      "data-panel": "pdf",
      "data-truthful-bid": truthfulBid
    }, "βᴵᴵ(v₁) = " + formatMoney(truthfulBid, state.b - state.a));
  }

  function drawSelectedMarker(svg, x, top, bottom) {
    appendSvg(svg, "line", {
      x1: x,
      y1: top,
      x2: x,
      y2: bottom,
      class: "chosen-marker",
      "data-bid": state.bid
    });
  }

  function drawCurve(svg, points, getX, getY, className) {
    var path = "";
    points.forEach(function (point, index) {
      path += (index === 0 ? "M " : " L ") +
        roundCoordinate(getX(point)) + " " +
        roundCoordinate(getY(point));
    });
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
    var radius = 8;
    var points = [
      [x, y - radius],
      [x + radius, y],
      [x, y + radius],
      [x - radius, y]
    ].map(function (point) {
      return roundCoordinate(point[0]) + "," + roundCoordinate(point[1]);
    }).join(" ");
    appendSvg(svg, "polygon", { points: points, class: className });
  }

  function svgTextBlock(lines, characterWidth, lineHeight) {
    var maximumLength = lines.reduce(function (maximum, line) {
      return Math.max(maximum, line.length);
    }, 0);
    return {
      width: maximumLength * characterWidth,
      height: lines.length * lineHeight
    };
  }

  function appendSvgTextLines(
    parent,
    x,
    centerY,
    lines,
    className,
    anchor,
    lineHeight,
    ariaLabel,
    layoutName
  ) {
    var text = appendSvg(parent, "text", {
      x: x,
      y: centerY - ((lines.length - 1) * lineHeight) / 2,
      class: className,
      "text-anchor": anchor,
      "aria-label": ariaLabel,
      "data-layout": layoutName
    });
    lines.forEach(function (line, index) {
      appendSvg(text, "tspan", {
        x: x,
        dy: index === 0 ? 0 : lineHeight
      }, line + (index < lines.length - 1 ? " " : ""));
    });
    return text;
  }

  function appendSvg(parent, name, attributes, text) {
    var element = document.createElementNS(SVG_NS, name);
    Object.keys(attributes || {}).forEach(function (key) {
      element.setAttribute(key, String(attributes[key]));
    });
    if (text !== undefined) {
      element.textContent = text;
    }
    parent.appendChild(element);
    return element;
  }

  function roundCoordinate(value) {
    return Math.round(value * 1000) / 1000;
  }

  function chartDescription(current, truthful) {
    var span = state.b - state.a;
    var payment = current.expectedPaymentIfWin === null ?
      "undefined at zero winning probability" :
      formatMoney(current.expectedPaymentIfWin, span);
    var areaState = current.bid > state.value + model.EPSILON ?
      "For an overbid, the green and red regions combine to give the " +
        "selected bid's expected payoff." :
      "The green CDF area records the selected bid's expected payoff.";
    return "The first panel shows the density of the highest opposing bid " +
      "and a shaded winning probability of " +
      formatPercent(current.winProbability) + ". The second panel plots its " +
      "CDF against the bid. " + areaState + " The selected bid is " +
      formatMoney(current.bid, span) + ", expected payment conditional on " +
      "winning is " + payment + ", expected payoff is " +
      formatMoney(current.expectedPayoff, span) + ", and the truthful bid " +
      "beta superscript II of v one equals " +
      formatMoney(truthful.bid, span) + ".";
  }

  function formatMoney(value, span) {
    if (!Number.isFinite(value)) {
      return "—";
    }
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
