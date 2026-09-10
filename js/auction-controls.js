"use strict";

(function () {
  function rangeStep(span) {
    return Math.max(span / 500, Number.EPSILON);
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

  function configureRange(range, min, max, step, value) {
    range.min = String(min);
    range.max = String(max);
    range.step = String(step);
    range.value = String(window.NumberUtils.clamp(value, min, max));
  }

  function configureNumberInput(input, min, max, value, formatter) {
    input.min = String(min);
    input.max = String(max);
    input.step = "any";
    input.value = (formatter || formatEditableNumber)(
      window.NumberUtils.clamp(value, min, max)
    );
  }

  function commitTypedChoice(input, currentValue, setter, formatter) {
    var nextValue = input.valueAsNumber;
    if (!Number.isFinite(nextValue)) {
      input.value = (formatter || formatEditableNumber)(currentValue);
      return;
    }
    setter(nextValue);
  }

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
      var nextValue = input.valueAsNumber;
      if (!Number.isFinite(nextValue)) {
        input.value = formatChoiceNumber(state[name]);
        return;
      }
      setShapeParameter(name, nextValue);
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
      state.n = Number.parseInt(elements.bidderCount.value, 10);
      options.render();
    });

    elements.alphaSlider.addEventListener("input", function () {
      options.setShapeParameter(
        "alpha", Number.parseFloat(elements.alphaSlider.value)
      );
    });
    elements.betaSlider.addEventListener("input", function () {
      options.setShapeParameter(
        "beta", Number.parseFloat(elements.betaSlider.value)
      );
    });
    elements.alphaNumber.addEventListener("change", function () {
      options.commitShapeParameter("alpha", elements.alphaNumber);
    });
    elements.betaNumber.addEventListener("change", function () {
      options.commitShapeParameter("beta", elements.betaNumber);
    });

    elements.lowerBound.addEventListener("change", options.updateBounds);
    elements.upperBound.addEventListener("change", options.updateBounds);

    elements.valueSlider.addEventListener("input", function () {
      options.setValue(Number.parseFloat(elements.valueSlider.value));
    });
    elements.bidSlider.addEventListener("input", function () {
      options.setBid(Number.parseFloat(elements.bidSlider.value));
    });
    elements.valueNumber.addEventListener("change", function () {
      commitTypedChoice(
        elements.valueNumber, state.value, options.setValue, formatChoiceNumber
      );
    });
    elements.bidNumber.addEventListener("change", function () {
      commitTypedChoice(
        elements.bidNumber, state.bid, options.setBid, formatChoiceNumber
      );
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

  window.AuctionControls = Object.freeze({
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
