(function (global) {
  "use strict";
  function create(state, elements, defaults, render, charts) {
    var dragPointer = null;
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
        endDrag();
        state[field] = Math.round(Math.max(0, Math.min(100, value)) * 10) / 10;
        render();
      }
      global.NumericControls.bindPair({ number: number, range: slider, update: update });
      number.addEventListener("change", function () {
        global.NumericControls.commit(number, state[field], update);
      });
    }
    function inspect(event, clampOutside, editBid) {
      var position = charts.pointerPosition(event, clampOutside);
      if (!position) { return; }
      state.opposing = position.opposing;
      if (editBid) { state.bid = Math.round(position.opposing * 10) / 10; }
      state.probe = { y: position.y };
      render();
    }
    function hideProbe() {
      if (!state.probe) { return; }
      state.probe = null;
      render();
    }
    function endDrag(event) {
      if (dragPointer === null || (event && event.pointerId !== dragPointer)) { return; }
      var pointer = dragPointer;
      dragPointer = null;
      elements.chart.classList.remove("plot-dragging");
      if (elements.chart.hasPointerCapture(pointer)) { elements.chart.releasePointerCapture(pointer); }
    }
    function scheduleRender() {
      if (renderFrame !== null) { return; }
      renderFrame = global.requestAnimationFrame(function () { renderFrame = null; render(); });
    }
    function bindEvents() {
      bindPair("value"); bindPair("bid");
      elements.reset.addEventListener("click", function () {
        endDrag();
        state.value = defaults.value; state.bid = defaults.bid; state.opposing = defaults.opposing;
        state.probe = null;
        render();
        elements.summary.textContent = "Demo reset. Private value 50, proposed bid 30.";
      });
      elements.chart.addEventListener("pointermove", function (event) {
        if (!event.isPrimary) { return; }
        if (dragPointer !== null) {
          if (event.pointerId === dragPointer) { inspect(event, true, true); }
        } else if (event.pointerType !== "touch" && event.buttons === 0) {
          if (charts.pointerPosition(event, false)) { inspect(event, false); }
          else { hideProbe(); }
        }
      });
      elements.chart.addEventListener("pointerdown", function (event) {
        if (!event.isPrimary || event.button !== 0 || dragPointer !== null) { return; }
        if (!charts.pointerPosition(event, false)) { return; }
        event.preventDefault();
        dragPointer = event.pointerId;
        elements.chart.classList.add("plot-dragging");
        try { elements.chart.setPointerCapture(dragPointer); } catch (error) { /* Synthetic pointers have no native capture. */ }
        elements.chart.focus({ preventScroll: true });
        inspect(event, false, true);
      });
      elements.chart.addEventListener("pointerup", function (event) {
        if (event.pointerId !== dragPointer) { return; }
        inspect(event, true, true);
        endDrag(event);
      });
      ["pointercancel", "lostpointercapture"].forEach(function (name) {
        elements.chart.addEventListener(name, endDrag);
      });
      elements.chart.addEventListener("pointerleave", function () { if (dragPointer === null) { hideProbe(); } });
      elements.chart.addEventListener("focus", function () {
        state.probe = { y: null };
        render();
      });
      elements.chart.addEventListener("blur", function () { endDrag(); hideProbe(); });
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
