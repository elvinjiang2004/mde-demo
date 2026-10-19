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
      state.n = Number.parseInt(elements.bidderCount.value, 10);
      options.render();
    });

    ["alpha", "beta"].forEach(function (name) {
      numeric.bindPair({
        number: elements[name + "Number"], range: elements[name + "Slider"], numberEvent: "change",
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
