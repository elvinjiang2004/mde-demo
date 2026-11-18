(function (global) {
  "use strict";
  function create(state, elements, defaults, render, charts) {
    var touchPointer = null;
    var renderFrame = null;
    var sizeObserver;

    function syncControlsFromState() {
      ["value", "bid"].forEach(function (field) {
        document.getElementById(field + "-number").value = state[field];
        var slider = document.getElementById(field + "-slider");
        slider.value = state[field];
        slider.setAttribute("aria-valuetext", charts.format(state[field]));
      });
    }
    function bindPair(field) {
      var number = document.getElementById(field + "-number");
      var slider = document.getElementById(field + "-slider");
      function update(value) {
        state[field] = Math.round(Math.max(0, Math.min(100, value)) * 10) / 10;
        render();
      }
      global.NumericControls.bindPair({ number: number, range: slider, update: update });
      number.addEventListener("change", function () {
        global.NumericControls.commit(number, state[field], update);
      });
    }
    function inspect(event, clampOutside) {
      var position = charts.pointerPosition(event, clampOutside);
      if (!position) { return; }
      state.opposing = position.opposing;
      state.probe = { y: position.y };
      render();
    }
    function hideProbe() {
      if (!state.probe) { return; }
      state.probe = null;
      render();
    }
    function endTouch(event) {
      if (touchPointer === null || (event && event.pointerId !== touchPointer)) { return; }
      var pointer = touchPointer;
      touchPointer = null;
      if (elements.chart.hasPointerCapture(pointer)) { elements.chart.releasePointerCapture(pointer); }
    }
    function scheduleRender() {
      if (renderFrame !== null) { return; }
      renderFrame = global.requestAnimationFrame(function () { renderFrame = null; render(); });
    }
    function bindEvents() {
      bindPair("value"); bindPair("bid");
      elements.reset.addEventListener("click", function () {
        endTouch();
        state.value = defaults.value; state.bid = defaults.bid; state.opposing = defaults.opposing;
        state.probe = null;
        render();
        elements.summary.textContent = "Demo reset. Private value 50, proposed bid 30.";
      });
      elements.chart.addEventListener("pointermove", function (event) {
        if (!event.isPrimary) { return; }
        if (touchPointer !== null) {
          if (event.pointerId === touchPointer) { inspect(event, true); }
        } else if (event.pointerType !== "touch" && event.buttons === 0) {
          if (charts.pointerPosition(event, false)) { inspect(event, false); }
          else { hideProbe(); }
        }
      });
      elements.chart.addEventListener("pointerdown", function (event) {
        if (!event.isPrimary || event.button !== 0 || touchPointer !== null) { return; }
        if (!charts.pointerPosition(event, false)) { return; }
        inspect(event, false);
        if (event.pointerType === "touch") {
          touchPointer = event.pointerId;
          try { elements.chart.setPointerCapture(touchPointer); } catch (error) { /* Synthetic pointers have no native capture. */ }
        }
      });
      elements.chart.addEventListener("pointerup", function (event) {
        if (event.pointerId !== touchPointer) { return; }
        inspect(event, true);
        endTouch(event);
      });
      ["pointercancel", "lostpointercapture"].forEach(function (name) {
        elements.chart.addEventListener(name, endTouch);
      });
      elements.chart.addEventListener("pointerleave", function () { if (touchPointer === null) { hideProbe(); } });
      elements.chart.addEventListener("focus", function () {
        state.probe = { y: null };
        render();
      });
      elements.chart.addEventListener("blur", hideProbe);
      elements.chart.addEventListener("keydown", function (event) {
        var next = state.opposing;
        if (event.key === "ArrowLeft") { next -= event.shiftKey ? 10 : 1; }
        else if (event.key === "ArrowRight") { next += event.shiftKey ? 10 : 1; }
        else if (event.key === "Home") { next = 0; }
        else if (event.key === "End") { next = 100; }
        else if (event.key === "Escape") { event.preventDefault(); hideProbe(); return; }
        else { return; }
        event.preventDefault();
        state.opposing = Math.max(0, Math.min(100, next));
        state.probe = { y: null };
        render();
      });
      global.addEventListener("resize", scheduleRender);
      sizeObserver = new global.ResizeObserver(scheduleRender);
      sizeObserver.observe(elements.chart);
    }
    return Object.freeze({ bindEvents: bindEvents, syncControlsFromState: syncControlsFromState });
  }
  global.SecondPriceControls = Object.freeze({ create: create });
})(window);
