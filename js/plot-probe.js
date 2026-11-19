"use strict";

(function (global) {
  var append = global.SvgUtils.appendSvg;
  var controllers = new WeakMap();
  var serial = 0;
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function format(value) {
    return global.PlotStyle.probe(value);
  }
  function symbol(name, index, args, superscript, decoration) {
    return { symbol: name, subscript: index, args: args, superscript: superscript, decoration: decoration };
  }
  function expression(name, index, variable, variableIndex) {
    return [symbol(name, index, [symbol(variable, variableIndex === undefined ? index : variableIndex)])];
  }
  function snap(value, view) {
    view.domain.concat(view.knots || []).forEach(function (knot) {
      if (Math.abs(value - knot) < 1e-9 * Math.max(1, view.domain[1] - view.domain[0])) { value = knot; }
    });
    return value;
  }
  function rowNotation(row, view) {
    if (!row.side || !view.input || !view.input[0].symbol) { return row.notation || [row.key]; }
    var variable = view.input[0], sign = row.side === "left limit" ? "−" : "+";
    function limitParts(parts) {
      return parts.map(function (part) {
        if (typeof part === "string") { return part; }
        var next = Object.assign({}, part);
        if (part.symbol === variable.symbol && (part.subscript || "") === (variable.subscript || "")) { next.superscript = sign; }
        if (part.args) { next.args = limitParts(part.args); }
        if (Array.isArray(part.subscript)) { next.subscript = limitParts(part.subscript); }
        else if (part.symbol === "E" && part.subscript === variable.symbol) {
          next.subscript = [Object.assign({}, variable, { superscript: sign })];
        }
        return next;
      });
    }
    return limitParts(row.notation || [row.key]);
  }
  function math(parent, parts) {
    (Array.isArray(parts) ? parts : [parts]).forEach(function (part) {
      if (typeof part === "string") { append(parent, "tspan", {}, part); return; }
      var main = append(parent, "tspan", { class: "chart-math-symbol" }, part.symbol);
      if (part.decoration) { main.setAttribute("text-decoration", part.decoration); }
      [[part.subscript, "sub"], [part.superscript, "super"]].forEach(function (script) {
        if (script[0] === undefined || script[0] === null || script[0] === "") { return; }
        var span = append(parent, "tspan", { class: "chart-math-" + (script[1] === "sub" ? "subscript" : "superscript"), "baseline-shift": script[1] });
        if (Array.isArray(script[0])) { math(span, script[0]); }
        else { span.textContent = script[0]; }
      });
      if (part.args) { append(parent, "tspan", {}, "("); math(parent, part.args); append(parent, "tspan", {}, ")"); }
    });
  }
  function attach(svg, options) {
    var existing = controllers.get(svg);
    if (existing) { existing.update(options); return existing; }
    var settings = options;
    var state = { visible: false, view: null, x: null, y: null, touch: null };
    var pendingPointer = null, pointerFrame = null, editingPointer = null;
    var help = document.createElement("span");
    help.className = "sr-only";
    help.id = "plot-inspection-help-" + (++serial);
    var prefix = settings.modifier === "alt" ? "Alt+" : "";
    help.textContent = "Hover to inspect curve values. " + prefix + "Left and " + prefix + "Right move inspection; Shift uses larger steps. " +
      prefix + "Home and " + prefix + "End inspect endpoints. " +
      (settings.views().length > 1 ? prefix + "Up and " + prefix + "Down switch panels. " : "") + "Escape clears inspection.";
    var status = document.createElement("span");
    status.className = "sr-only";
    status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite");
    (svg.closest("figure") || svg.parentElement).appendChild(help);
    help.after(status);
    svg.setAttribute("aria-describedby", ((svg.getAttribute("aria-describedby") || "") + " " + help.id).trim());
    var shortcuts = ["ArrowLeft", "ArrowRight", "Home", "End"].map(function (key) { return prefix + key; });
    if (settings.views().length > 1) { shortcuts.push(prefix + "ArrowUp", prefix + "ArrowDown"); }
    shortcuts.push("Shift+" + prefix + "ArrowLeft", "Shift+" + prefix + "ArrowRight", "Escape");
    svg.setAttribute("aria-keyshortcuts", ((svg.getAttribute("aria-keyshortcuts") || "") + " " + shortcuts.join(" ")).trim());
    if (!svg.hasAttribute("tabindex")) { svg.setAttribute("tabindex", "0"); }
    svg.classList.add("curve-inspectable");
    function views() { return settings.views(); }
    function remove() { svg.querySelectorAll(":scope > .curve-probe").forEach(function (g) { g.remove(); }); }
    function hide() {
      pendingPointer = null;
      if (pointerFrame !== null) { cancelAnimationFrame(pointerFrame); pointerFrame = null; }
      if (!state.visible) { return; }
      state.visible = false; remove(); status.textContent = "";
      global.ChartLayout.refresh(svg);
    }
    function point(event) {
      var matrix = svg.getScreenCTM();
      return matrix ? new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse()) : null;
    }
    function inspect(event) {
      var p = point(event);
      if (!p) { return false; }
      var view = views().find(function (candidate) {
        var b = candidate.frame;
        return p.x >= b.left - 0.001 && p.x <= b.right + 0.001 && p.y >= b.top - 0.001 && p.y <= b.bottom + 0.001;
      });
      if (!view) { hide(); return false; }
      var b = view.frame, d = view.domain;
      state.view = view.id;
      state.x = d[0] + clamp((p.x - b.left) / (b.right - b.left), 0, 1) * (d[1] - d[0]);
      state.y = clamp(p.y, b.top, b.bottom); state.visible = true;
      draw(false); return true;
    }
    function draw(announce) {
      remove();
      if (!state.visible) { return; }
      var view = views().find(function (v) { return v.id === state.view; }) || views()[0];
      if (!view) { return; }
      var b = view.frame, d = view.domain;
      state.view = view.id;
      state.x = snap(clamp(state.x === null ? (d[0] + d[1]) / 2 : state.x, d[0], d[1]), view);
      var rows = view.sample(state.x).slice();
      (view.references || []).forEach(function (reference) {
        var distance = Math.abs(reference.value - state.x) / (d[1] - d[0]) * (b.right - b.left);
        if (distance <= global.ChartLayout.svgUnits(svg, reference.tolerance || 6)) {
          rows.push(Object.assign({}, reference, { marker: false }));
        }
      });
      if (!rows.length) { return; }
      var px = function (n) { return global.ChartLayout.svgUnits(svg, n); };
      var x = b.left + (state.x - d[0]) / (d[1] - d[0]) * (b.right - b.left);
      var y = state.y === null ? (b.top + b.bottom) / 2 : clamp(state.y, b.top, b.bottom);
      var group = append(svg, "g", { class: "curve-probe", "data-view": view.id, "data-input": state.x, "aria-hidden": "true" });
      append(group, "line", { x1: x, x2: x, y1: b.top, y2: b.bottom, class: "curve-probe-line" });
      rows.forEach(function (row) {
        var range = row.domain || view.yDomain;
        if (row.marker === false || !range || !Number.isFinite(row.value) || row.value < range[0] - 1e-10 || row.value > range[1] + 1e-10) { return; }
        var yy = b.bottom - (row.value - range[0]) / (range[1] - range[0]) * (b.bottom - b.top);
        append(group, "circle", { cx: x, cy: clamp(yy, b.top, b.bottom), r: px(row.radius || 3.5),
          class: "curve-probe-dot" + (row.open ? " curve-probe-open" : ""), "data-series": row.key, "data-value": row.value,
          style: "stroke:" + row.color + ";fill:" + (row.open ? "var(--surface-background)" : row.color) });
      });
      var coordinate = append(group, "text", { x: x, y: b.bottom + px(18), class: "plot-probe-coordinate curve-probe-coordinate", "text-anchor": "middle" });
      if (view.input) { math(coordinate, view.input); append(coordinate, "tspan", {}, " = "); }
      append(coordinate, "tspan", {}, format(state.x));
      var half = coordinate.getBBox().width / 2;
      coordinate.setAttribute("x", clamp(x, b.left + half, b.right - half));
      var box = append(group, "rect", { class: "plot-probe-box curve-probe-box" });
      var texts = rows.map(function (row) {
        var value = row.text === undefined ? format(row.value) : row.text;
        var text = append(group, "text", { x: 0, y: 0, class: "curve-probe-text", "data-series": row.key,
          "data-value": Number.isFinite(row.value) ? row.value : value, style: "fill:" + row.color });
        math(text, rowNotation(row, view));
        append(text, "tspan", {}, " = " + value);
        return text;
      });
      var padding = px(6), gap = px(8), rowGap = px(4);
      var metrics = texts.map(function (node) { return node.getBBox(); });
      var rowHeight = Math.max.apply(null, metrics.map(function (r) { return r.height; })) + rowGap;
      var maxRows = Math.max(1, Math.floor((b.bottom - b.top - 2 * padding + rowGap) / rowHeight));
      var columns = Math.ceil(rows.length / maxRows);
      var perColumn = Math.ceil(rows.length / columns), widths = [];
      for (var c = 0; c < columns; c += 1) {
        widths.push(Math.max.apply(null, metrics.slice(c * perColumn, (c + 1) * perColumn).map(function (r) { return r.width; })));
      }
      var width = 2 * padding + widths.reduce(function (a, n) { return a + n; }, 0) + (columns - 1) * gap;
      var height = 2 * padding + perColumn * rowHeight - rowGap;
      var bx = x + gap;
      if (bx + width > b.right) { bx = x - width - gap; }
      bx = clamp(bx, b.left, b.right - width);
      var by = y - height - gap;
      if (by < b.top) { by = y + gap; }
      by = clamp(by, b.top, b.bottom - height);
      box.setAttribute("x", bx); box.setAttribute("y", by); box.setAttribute("width", width); box.setAttribute("height", height);
      texts.forEach(function (node, i) {
        var column = Math.floor(i / perColumn), offset = widths.slice(0, column).reduce(function (a, n) { return a + n + gap; }, 0);
        node.setAttribute("x", bx + padding + offset - metrics[i].x);
        node.setAttribute("y", by + padding + (i % perColumn) * rowHeight - metrics[i].y);
      });
      if (announce) {
        status.textContent = (view.name || "Input") + " " + format(state.x) + ". " + rows.map(function (row) {
          return row.label + ": " + (row.text === undefined ? format(row.value) : row.text) + (row.side ? " (" + row.side + ")" : "");
        }).join("; ");
      }
      global.ChartLayout.refresh(svg);
    }
    svg.addEventListener("pointermove", function (event) {
      if (event.isPrimary === false || (state.touch !== null && event.pointerId !== state.touch)) { return; }
      if (event.buttons && state.touch === null) { return; }
      pendingPointer = { clientX: event.clientX, clientY: event.clientY };
      if (pointerFrame === null) {
        pointerFrame = requestAnimationFrame(function () {
          pointerFrame = null;
          var next = pendingPointer; pendingPointer = null;
          if (next) { inspect(next); }
        });
      }
    });
    svg.addEventListener("pointerdown", function (event) {
      if (event.isPrimary === false || event.button !== 0) { return; }
      if (settings.editable) {
        if (editingPointer !== null) { return; }
        editingPointer = event.pointerId; hide();
        // The editor retains capture and changes the object; touch also reads it.
        if (event.pointerType === "touch" && inspect(event)) { state.touch = event.pointerId; }
        return;
      }
      if (event.pointerType !== "touch" || state.touch !== null || !inspect(event)) { return; }
      state.touch = event.pointerId;
      try { svg.setPointerCapture(event.pointerId); } catch (error) { /* Synthetic pointer events have no capture. */ }
    });
    ["pointerup", "pointercancel", "lostpointercapture"].forEach(function (name) {
      svg.addEventListener(name, function (event) {
        if (event.pointerId === editingPointer) {
          editingPointer = null;
          if (name === "pointerup") { inspect(event); }
          else { hide(); }
        }
        if (event.pointerId !== state.touch) { return; }
        if (name === "pointerup") { inspect(event); }
        else { hide(); }
        state.touch = null;
      });
    });
    svg.addEventListener("pointerleave", function (event) {
      if (event.pointerId === editingPointer && state.touch === null && !svg.hasPointerCapture(event.pointerId)) { editingPointer = null; }
      if (document.activeElement !== svg && state.touch === null) { hide(); }
    });
    svg.addEventListener("focus", function (event) {
      if (event.target !== svg || editingPointer !== null) { return; }
      state.visible = true; draw(true);
    });
    svg.addEventListener("blur", hide);
    svg.addEventListener("keydown", function (event) {
      if (event.target !== svg || event.defaultPrevented) { return; }
      if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); hide(); return; }
      if (settings.modifier === "alt" && !event.altKey) { return; }
      var available = views();
      var view = available.find(function (v) { return v.id === state.view; }) || available[0];
      if (!view) { return; }
      if ((event.key === "ArrowUp" || event.key === "ArrowDown") && available.length > 1) {
        var index = available.indexOf(view), direction = event.key === "ArrowDown" ? 1 : -1;
        view = available[(index + direction + available.length) % available.length];
        state.view = view.id;
      }
      var d = view.domain, x = state.x === null ? (d[0] + d[1]) / 2 : state.x;
      var step = (d[1] - d[0]) * (event.shiftKey ? 0.1 : 0.01);
      if (event.key === "ArrowLeft") { x -= step; }
      else if (event.key === "ArrowRight") { x += step; }
      else if (event.key === "Home") { x = d[0]; }
      else if (event.key === "End") { x = d[1]; }
      else if ((event.key === "ArrowUp" || event.key === "ArrowDown") && available.length > 1) { /* Panel selected above. */ }
      else { return; }
      event.preventDefault(); event.stopImmediatePropagation();
      pendingPointer = null;
      if (pointerFrame !== null) { cancelAnimationFrame(pointerFrame); pointerFrame = null; }
      state.x = clamp(x, d[0], d[1]); state.y = null; state.visible = true; draw(true);
    }, true);
    var resize = new ResizeObserver(function () { if (state.visible) { draw(false); } });
    resize.observe(svg);
    var controller = { update: function (next) { settings = next; if (state.visible) { draw(false); } }, refresh: function () { if (state.visible) { draw(false); } }, hide: hide };
    controllers.set(svg, controller);
    return controller;
  }
  global.PlotProbe = Object.freeze({ attach: attach, format: format, math: math, symbol: symbol, expression: expression,
    refresh: function (svg) { var controller = controllers.get(svg); if (controller) { controller.refresh(); } } });
}(window));
