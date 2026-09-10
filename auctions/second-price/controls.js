(function () {
  "use strict";

  function create(state, elements, defaults, render, charts, distributionSpec) {
    var model = window.SPAModel;
    var distributions = window.AuctionDistributions;
    var math = window.MechanismMath;
    var auctionControls = window.AuctionControls;
    var rangeStep = auctionControls.rangeStep;
    var formatEditableNumber = auctionControls.formatEditableNumber;
    var formatChoiceNumber = auctionControls.formatChoiceNumber;
    var configureRange = auctionControls.configureRange;
    var configureNumberInput = auctionControls.configureNumberInput;
    var commitTypedChoice = auctionControls.commitTypedChoice;
    var formatMoney = window.AuctionChart.formatMoney;
    var DEFAULTS = defaults;
    var chartDragActive = false;
    var resizeTimer = null;
    var chartPointerToBid = charts.chartPointerToBid;

    var valueBidControls = auctionControls.createValueBidControls(
      state, elements, render
    );
    var setBid = valueBidControls.setBid;
    var setValue = valueBidControls.setValue;
    var shapeParameterControls = auctionControls.createShapeParameterControls(
      state, elements, render
    );
    var setShapeParameter = shapeParameterControls.setShapeParameter;
    var commitShapeParameter = shapeParameterControls.commitShapeParameter;


    function bindEvents() {
      auctionControls.bindCommonAuctionEvents({
        state: state,
        elements: elements,
        render: render,
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
        var bid = chartPointerToBid(event, false);
        if (bid === null) {
          return;
        }
        chartDragActive = true;
        try {
          elements.chart.setPointerCapture(event.pointerId);
        } catch (error) {
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
    }

    function scheduleResize() {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(render, 100);
    }
    function updateBoundsFromInputs() {
      var nextA = Number.parseFloat(elements.lowerBound.value);
      var nextB = Number.parseFloat(elements.upperBound.value);
      var validation = model.validateAuction(
        state.n, nextA, nextB, distributionSpec()
      );

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

    function syncControlsFromState() {
      elements.bidderCount.value = String(state.n);
      elements.lowerBound.value = String(state.a);
      elements.upperBound.value = String(state.b);

      var step = rangeStep(state.b - state.a);
      configureRange(elements.valueSlider, state.a, state.b, step, state.value);
      configureRange(
        elements.bidSlider,
        state.a,
        state.b,
        step,
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
        formatMoney(state.value, span) + " value units"
      );
      elements.bidSlider.setAttribute(
        "aria-valuetext",
        formatMoney(state.bid, span) + " value units"
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

  window.SecondPriceControls = Object.freeze({ create: create });
}());
