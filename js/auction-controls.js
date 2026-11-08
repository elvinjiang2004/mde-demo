"use strict";

(function () {
  function rangeStep(span) {
    return Math.max(span / 500, Number.EPSILON);
  }

  var numeric = window.NumericControls;
  var formatEditableNumber = numeric.formatNumber;

  function formatChoiceNumber(value) {
    if (!Number.isFinite(value)) {
      return "";
    }
    return String(Number.parseFloat(value.toFixed(1)));
  }

  var configureRange = numeric.configureRange;
  var configureNumberInput = numeric.configureNumberInput;
  var commitTypedChoice = numeric.commit;

  function createValueBidControls(state, elements, render) {
    var clamp = window.NumberUtils.clamp;
    return {
      setBid: function (nextBid) {
        if (!Number.isFinite(nextBid)) {
          return;
        }
        state.bid = clamp(nextBid, state.a, state.b);
        elements.bidSlider.value = String(state.bid);
        render();
      },
      setValue: function (nextValue) {
        if (!Number.isFinite(nextValue)) {
          return;
        }
        state.value = clamp(nextValue, state.a, state.b);
        elements.valueSlider.value = String(state.value);
        render();
      }
    };
  }

  function createShapeParameterControls(state, elements, render) {
    var clamp = window.NumberUtils.clamp;

    function setShapeParameter(name, nextValue) {
      if (!Number.isFinite(nextValue)) {
        return;
      }
      state[name] = Math.round(clamp(nextValue, 0.2, 10) * 10) / 10;
      elements[name + "Slider"].value = String(state[name]);
      elements[name + "Number"].value = formatChoiceNumber(state[name]);
      render();
    }

    function commitShapeParameter(name, input) {
      numeric.commit(input, state[name], function (value) {
        setShapeParameter(name, value);
      }, formatChoiceNumber);
    }

    return {
      setShapeParameter: setShapeParameter,
      commitShapeParameter: commitShapeParameter
    };
  }

  function bindCommonAuctionEvents(options) {
    var state = options.state;
    var elements = options.elements;
    elements.bidderCount.addEventListener("change", function () {
      if (options.beforeParameterChange) { options.beforeParameterChange(); }
      state.n = Number.parseInt(elements.bidderCount.value, 10);
      options.render();
    });

    ["alpha", "beta"].forEach(function (name) {
      numeric.bindPair({
        number: elements[name + "Number"], range: elements[name + "Slider"], numberEvent: "change",
        beforeInput: options.beforeParameterChange,
        update: function (value) { options.setShapeParameter(name, value); },
        invalid: function (input) { input.value = formatChoiceNumber(state[name]); }
      });
    });
    elements.lowerBound.addEventListener("change", options.updateBounds);
    elements.upperBound.addEventListener("change", options.updateBounds);
    ["value", "bid"].forEach(function (name) {
      numeric.bindPair({
        number: elements[name + "Number"], range: elements[name + "Slider"], numberEvent: "change",
        update: name === "value" ? options.setValue : options.setBid,
        invalid: function (input) { input.value = formatChoiceNumber(state[name]); }
      });
    });

    elements.randomValueButton.addEventListener("click", options.randomValue);
    elements.resetButton.addEventListener("click", options.reset);

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
        options.setBid(nextBid);
      }
    });

    window.addEventListener("resize", options.resize);
  }

  function createController(options) {
    var state = options.state, elements = options.elements, defaults = options.defaults;
    var render = options.render, charts = options.charts, distributionSpec = options.distributionSpec;
    var model = options.model;
    var distributions = window.AuctionDistributions;
    var math = window.MechanismMath;
    var formatMoney = window.AuctionChart.formatMoney;
    var DEFAULTS = defaults;
    var chartPointerId = null;
    var resizeTimer = null;
    var pointerFrame = null;
    var pendingPointerBid = null;
    var chartPointerToBid = charts.chartPointerToBid;

    var valueBidControls = createValueBidControls(
      state, elements, render
    );
    var setBid = valueBidControls.setBid;
    var setValue = valueBidControls.setValue;
    var shapeParameterControls = createShapeParameterControls(
      state, elements, render
    );
    var setShapeParameter = shapeParameterControls.setShapeParameter;
    var commitShapeParameter = shapeParameterControls.commitShapeParameter;


    function schedulePointerBid(bid) {
      pendingPointerBid = bid;
      if (pointerFrame !== null) {
        return;
      }
      pointerFrame = window.requestAnimationFrame(function () {
        pointerFrame = null;
        if (pendingPointerBid === null) {
          return;
        }
        var nextBid = pendingPointerBid;
        pendingPointerBid = null;
        setBid(nextBid);
      });
    }

    function flushPointerBid() {
      if (pendingPointerBid === null) {
        return;
      }
      if (pointerFrame !== null) {
        window.cancelAnimationFrame(pointerFrame);
        pointerFrame = null;
      }
      var nextBid = pendingPointerBid;
      pendingPointerBid = null;
      setBid(nextBid);
    }

    function finishChartDrag(event) {
      if (chartPointerId === null || (event && event.pointerId !== chartPointerId)) {
        return;
      }
      var pointerId = chartPointerId;
      chartPointerId = null;
      if (event && event.type === "pointerup") {
        var bid = chartPointerToBid(event, true);
        if (bid !== null) { schedulePointerBid(bid); }
      }
      flushPointerBid();
      if (elements.chart.hasPointerCapture(pointerId)) {
        elements.chart.releasePointerCapture(pointerId);
      }
    }
    function bindEvents() {
      bindCommonAuctionEvents({
        state: state,
        elements: elements,
        render: render,
        beforeParameterChange: finishChartDrag,
        setBid: setBid,
        setValue: setValue,
        setShapeParameter: setShapeParameter,
        commitShapeParameter: commitShapeParameter,
        updateBounds: updateBoundsFromInputs,
        randomValue: randomizeValue,
        reset: resetState,
        resize: scheduleResize
      });
      elements.chart.addEventListener("pointerdown", function (event) {
        if (!event.isPrimary || event.button !== 0 || chartPointerId !== null) { return; }
        var bid = chartPointerToBid(event, false);
        if (bid === null) {
          return;
        }
        chartPointerId = event.pointerId;
        try { elements.chart.setPointerCapture(event.pointerId); } catch (error) {
          // Synthetic pointer events have no native pointer to capture.
        }
        schedulePointerBid(bid);
      });

      elements.chart.addEventListener("pointermove", function (event) {
        if (event.pointerId !== chartPointerId) {
          return;
        }
        var bid = chartPointerToBid(event, true);
        if (bid !== null) {
          schedulePointerBid(bid);
        }
      });

      ["pointerup", "pointercancel", "lostpointercapture"].forEach(function (type) {
        elements.chart.addEventListener(type, finishChartDrag);
      });

    }

    function randomizeValue() {
      var inputA = Number.parseFloat(elements.lowerBound.value);
      var inputB = Number.parseFloat(elements.upperBound.value);
      var validation = model.validateAuction(
        state.n, inputA, inputB, distributionSpec()
      );
      if (!validation.valid) {
        showError(validation.errors.join(" "));
        revertBoundsInputs();
        return;
      }
      setValue(distributions.quantile(
        Math.random(), state.a, state.b, distributionSpec()
      ));
    }

    function resetState() {
      finishChartDrag();
      state.n = DEFAULTS.n;
      state.a = DEFAULTS.a;
      state.b = DEFAULTS.b;
      state.value = model.clamp(state.value, state.a, state.b);
      state.bid = model.clamp(state.bid, state.a, state.b);
      state.alpha = DEFAULTS.alpha;
      state.beta = DEFAULTS.beta;
      clearError();
      syncControlsFromState();
      render();
    }

    function scheduleResize() {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(render, 100);
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
        revertBoundsInputs();
        return;
      }

      // Commit pending coordinates in the old support before rescaling them.
      finishChartDrag();
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

    function revertBoundsInputs() {
      elements.lowerBound.value = formatEditableNumber(state.a);
      elements.upperBound.value = formatEditableNumber(state.b);
    }

    function showError(message) {
      elements.inputError.textContent = message;
      elements.inputError.hidden = false;
    }

    function clearError() {
      elements.inputError.textContent = "";
      elements.inputError.hidden = true;
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
      math.setText(elements.valueMinLabel, "\\(a=" + lowerText + "\\)");
      math.setText(elements.valueMaxLabel, "\\(b=" + upperText + "\\)");
      math.setText(elements.bidMinLabel, "\\(a=" + lowerText + "\\)");
      math.setText(elements.bidMaxLabel, "\\(b=" + upperText + "\\)");

      elements.valueSlider.setAttribute(
        "aria-valuetext",
        valueText + " value units"
      );
      elements.bidSlider.setAttribute(
        "aria-valuetext",
        bidText + " value units"
      );
    }

    return Object.freeze({
      bindEvents: bindEvents,
      syncControlsFromState: syncControlsFromState,
      updateControls: updateControls,
      showError: showError,
      clearError: clearError
    });
  }

  window.AuctionControls = Object.freeze({
    createController: createController,
    rangeStep: rangeStep,
    formatEditableNumber: formatEditableNumber,
    formatChoiceNumber: formatChoiceNumber,
    configureRange: configureRange,
    configureNumberInput: configureNumberInput,
    commitTypedChoice: commitTypedChoice,
    createValueBidControls: createValueBidControls,
    createShapeParameterControls: createShapeParameterControls,
    bindCommonAuctionEvents: bindCommonAuctionEvents
  });
})();
