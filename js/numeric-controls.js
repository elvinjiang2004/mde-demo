(function () {
  "use strict";

  function formatNumber(value) {
    return Number.isFinite(value) ? String(Number.parseFloat(value.toPrecision(12))) : "";
  }

  function readFinite(input) {
    return input.value.trim() !== "" && Number.isFinite(input.valueAsNumber) ? input.valueAsNumber : null;
  }

  function configureRange(range, min, max, step, value) {
    range.min = String(min); range.max = String(max); range.step = String(step);
    range.value = String(window.NumberUtils.clamp(value, min, max));
  }

  function configureNumberInput(input, min, max, value, formatter) {
    input.min = String(min); input.max = String(max); input.step = "any";
    input.value = (formatter || formatNumber)(window.NumberUtils.clamp(value, min, max));
  }

  function commit(input, currentValue, update, formatter) {
    var value = readFinite(input);
    if (value === null) {
      input.value = (formatter || formatNumber)(currentValue);
      return false;
    }
    update(value);
    return true;
  }

  function bindPair(options) {
    var bindings = [];
    function listen(node, event, callback) {
      node.addEventListener(event, callback);
      bindings.push(function () { node.removeEventListener(event, callback); });
    }
    [options.number, options.range].forEach(function (input, index) {
      listen(input, index === 0 ? (options.numberEvent || "input") : "input", function () {
        if (options.beforeInput) { options.beforeInput(); }
        var value = readFinite(input);
        if (value === null) {
          if (options.invalid) { options.invalid(input); }
        } else {
          options.update(value);
        }
      });
      if (options.afterCommit) { listen(input, "change", options.afterCommit); }
    });
    return function () { bindings.forEach(function (remove) { remove(); }); };
  }

  window.NumericControls = Object.freeze({
    formatNumber: formatNumber, readFinite: readFinite, configureRange: configureRange,
    configureNumberInput: configureNumberInput, commit: commit, bindPair: bindPair
  });
})();
