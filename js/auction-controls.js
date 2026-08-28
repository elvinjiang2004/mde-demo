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

  window.AuctionControls = Object.freeze({
    rangeStep: rangeStep,
    formatEditableNumber: formatEditableNumber,
    formatChoiceNumber: formatChoiceNumber,
    configureRange: configureRange,
    configureNumberInput: configureNumberInput,
    commitTypedChoice: commitTypedChoice,
    createValueBidControls: createValueBidControls,
    createShapeParameterControls: createShapeParameterControls
  });
})();
