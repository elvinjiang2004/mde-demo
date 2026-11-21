(function (global) {
  "use strict";
  var visuals = global.BilateralTradeVisuals;
  var appendSvg = global.SvgUtils.appendSvg;
  var layout = global.ChartLayout;
  var style = global.PlotStyle;
  var LAYOUT = { viewWidth: 480, viewHeight: 520, left: 70, right: 450, top: 40, bottom: 420 };
  var SIZE = LAYOUT.right - LAYOUT.left;
  var definitions = [
    { id: "q", title: "Allocation rule, \\(q(v,c)\\)", extent: 1, symbol: "q" },
    { id: "pB", title: "Buyer payment, \\(p_B(v,c)\\)", extent: visuals.SIGNED_COLOR_EXTENT, symbol: "p", subscript: "B" },
    { id: "pS", title: "Seller payment, \\(p_S(v,c)\\)", extent: visuals.SIGNED_COLOR_EXTENT, symbol: "p", subscript: "S" },
    { id: "buyerIC", title: "Buyer interim-deviation payoff, \\(U_B(v,v')\\)", extent: visuals.SIGNED_COLOR_EXTENT, domain: "buyer", symbol: "U", subscript: "B" },
    { id: "sellerIC", title: "Seller interim-deviation payoff, \\(U_S(c,c')\\)", extent: visuals.SIGNED_COLOR_EXTENT, domain: "seller", symbol: "U", subscript: "S" },
    { id: "revenue", title: "Net revenue, \\(R(v,c)\\)", extent: visuals.SIGNED_COLOR_EXTENT, symbol: "R" },
    { id: "buyerPayoff", title: "Buyer truthful payoff, \\(u_B(v,c)\\)", extent: visuals.SIGNED_COLOR_EXTENT, symbol: "u", subscript: "B" },
    { id: "sellerPayoff", title: "Seller truthful payoff, \\(u_S(v,c)\\)", extent: visuals.SIGNED_COLOR_EXTENT, symbol: "u", subscript: "S" },
    { id: "efficiency", title: "Lost gains from trade, \\(L(v,c)\\)", symbol: "L" }
  ];
  function number(x) {
    return x === 0 ? "0" : style.summary(x);
  }
  function domains(def, rule) {
    return def.domain === "buyer" ? [[0, 1], [0, 1]] :
      def.domain === "seller" ? [rule.sellerSupport, rule.sellerSupport] : [[0, 1], rule.sellerSupport];
  }
  function create(surfaceContainer, diagnosticContainer) {
    var rule = null;
    var colors = visuals.readHeatmapPalette(getComputedStyle(document.documentElement));
    var panels = definitions.map(function (def, index) {
      var container = document.createElement("div");
      container.className = index < 3 ? "surface-editor" : "diagnostic-panel";
      container.id = "panel-" + def.id;
      var figure = document.createElement("figure");
      figure.className = "diagnostic-figure math-chart-figure chart-figure";
      container.appendChild(figure);
      var caption = document.createElement("figcaption");
      caption.id = "title-" + def.id;
      caption.textContent = def.title;
      figure.appendChild(caption);
      var viewport = document.createElement("div");
      viewport.className = "chart-viewport stable-chart-viewport chart-plot-viewport";
      viewport.dataset.chartPadding = "14";
      figure.appendChild(viewport);
      var frame = document.createElement("div");
      frame.className = "math-chart-frame chart-canvas-frame chart-480x520-frame field-chart";
      viewport.appendChild(frame);
      var svg = appendSvg(frame, "svg", {
        id: def.id + "-chart", viewBox: "0 0 480 520", tabindex: "0", role: "img",
        "class": (index < 3 ? "tradeoff-chart" : "diagnostic-chart") + " chart-480x520",
        "aria-labelledby": "title-" + def.id + " description-" + def.id,
        "aria-describedby": "probe-help", "aria-keyshortcuts": "ArrowLeft ArrowRight ArrowUp ArrowDown Home End Escape"
      });
      appendSvg(svg, "title", {}, def.title.replace(/\\[()]/g, ""));
      var description = appendSvg(svg, "desc", { id: "description-" + def.id });
      var vectorRegions = index < 3 || def.id === "efficiency";
      var field = appendSvg(svg, vectorRegions ? "svg" : "image", {
        x: LAYOUT.left, y: LAYOUT.top, width: SIZE, height: SIZE,
        preserveAspectRatio: "none", "data-layer": "field"
      });
      if (vectorRegions) { field.setAttribute("viewBox", "0 0 1 1"); }
      var frameLayer = appendSvg(svg, "g", { "data-layer": "frame" });
      appendSvg(frameLayer, "rect", {
        x: LAYOUT.left, y: LAYOUT.top, width: SIZE, height: SIZE, fill: "none", class: "axis-line"
      });
      var xAxis = style.axis(frameLayer, { orientation: "x", frame: LAYOUT, domain: [0, 1] });
      var yAxis = style.axis(frameLayer, { orientation: "y", frame: LAYOUT, domain: [0, 1] });
      var overlays = appendSvg(svg, "g", { "data-layer": "overlay" });
      var labels = def.domain === "buyer" ? ["True buyer value, \\(v\\)", "Alternate buyer report, \\(v'\\)"] :
        def.domain === "seller" ? ["True seller value, \\(c\\)", "Alternate seller report, \\(c'\\)"] :
          ["Buyer value, \\(v\\)", "Seller value, \\(c\\)"];
      ["x", "y"].forEach(function (axis, i) {
        var label = document.createElement("p");
        label.className = "math-chart-axis-label math-chart-" + axis + "-axis-label";
        label.textContent = labels[i];
        if (axis === "x") {
          label.classList.add("chart-x-axis-label");
          viewport.appendChild(label);
        } else {
          frame.appendChild(label);
        }
      });
      var readout = document.createElement("p");
      readout.className = "sr-only";
      readout.id = "probe-" + def.id;
      container.appendChild(readout);
      var status = document.createElement("div");
      status.className = "diagnostic-text field-status";
      if (index >= 3) { container.appendChild(status); }
      (index < 3 ? surfaceContainer : diagnosticContainer).appendChild(container);
      var panel = {
        def: def, svg: svg, field: field, xAxis: xAxis, yAxis: yAxis, overlays: overlays, description: description,
        readout: readout, status: status, selected: [0.5, 0.5], visible: false, key: "", domainKey: "",
        resolution: 0, quality: "final", main: index < 3, vector: vectorRegions
      };
      if (!vectorRegions || def.id === "pB" || def.id === "pS") {
        style.watchResize(svg, "field", function () {
          draw(panel, panel.quality);
        }, function () {
          return panel.resolution ? style.rasterSize(svg, LAYOUT, panel.quality) : 0;
        });
      }
      function setProbe(x, y, announce) {
        panel.selected = [Math.max(0, Math.min(1, x)), Math.max(0, Math.min(1, y))];
        panel.visible = true;
        updateProbe(panel);
        if (announce) { document.getElementById("probe-announcement").textContent = panel.readout.textContent; }
      }
      visuals.bindProbeChart(svg, LAYOUT, function () {
        return { x: panel.selected[0], y: panel.selected[1] };
      }, setProbe, function () { panel.visible = false; updateProbe(panel); });
      global.TradeDemoStyle.bindEdgeHover(svg, LAYOUT, setProbe);
      return panel;
    });
    function updateProbe(panel) {
      if (!rule) { return; }
      var old = panel.svg.querySelector(".chart-480x520-probe");
      if (old) { old.remove(); }
      var domain = domains(panel.def, rule);
      var x = domain[0][0] + panel.selected[0];
      var y = domain[1][0] + panel.selected[1];
      var value = rule.field(panel.def.id, x, y);
      var names = panel.def.domain === "buyer" ? ["v", "v′"] : panel.def.domain === "seller" ? ["c", "c′"] : ["v", "c"];
      panel.readout.textContent = names[0] + " = " + style.probe(x) + ", " + names[1] + " = " +
        style.probe(y) + "; value = " + style.probe(value);
      if (!panel.visible) { return; }
      var scaffold = visuals.drawProbeScaffold(panel.svg, {
        layout: LAYOUT, x: LAYOUT.left + SIZE * panel.selected[0], y: LAYOUT.bottom - SIZE * panel.selected[1],
        boxWidth: 94,
        groupClass: (panel.main ? "surface-probe" : "diagnostic-probe") + " chart-480x520-probe",
        radius: panel.main ? 3.5 : 3, xValue: style.probe(x), yValue: style.probe(y)
      });
      layout.appendProbeValueText(scaffold.group, scaffold.textX, scaffold.textY, {
        symbol: panel.def.symbol, subscript: panel.def.subscript, args: names, value: style.probe(value)
      });
    }
    function drawRegions(field, def, resolution) {
      var prefix = "lying-cost-" + def.id + "-";
      var edge = 1 - rule.epsilon;
      var tradePoints = edge + ",1 1,1 1," + edge;
      var noTradePoints = "0,0 1,0 1," + edge + " " + edge + ",1 0,1";
      var content;
      var paymentColor = def.id === "pS" ? colors.red : colors.green;
      if (def.id === "efficiency") {
        // The fixed efficient allocation has zero lost gains at every profile.
        return;
      }
      if (def.id === "q") {
        content = '<rect width="1" height="1" fill="rgb(' + colors.neutral.join(",") + ')"/>' +
          '<polygon points="' + tradePoints + '" fill="rgb(' + colors.blue.join(",") + ')"/>';
      } else if (rule.id === "split-the-difference") {
        // In normalized image coordinates, payment is k*x+(1-k)*(b-y).
        // Gradient direction (k,-(1-k))/normSquared makes opacity equal price.
        var normSquared = rule.k * rule.k + (1 - rule.k) * (1 - rule.k);
        content = '<defs><linearGradient id="' + prefix + 'auction-price" gradientUnits="userSpaceOnUse" x1="0" y1="' +
          rule.sellerSupport[1] + '" x2="' + (rule.k / normSquared) + '" y2="' +
          (rule.sellerSupport[1] - (1 - rule.k) / normSquared) + '">' +
          '<stop offset="0" stop-color="rgb(' + paymentColor.join(",") + ')" stop-opacity="0"/>' +
          '<stop offset="1" stop-color="rgb(' + paymentColor.join(",") + ')" stop-opacity="' + (1 / def.extent) + '"/>' +
          '</linearGradient></defs><polygon points="' + tradePoints + '" fill="url(#' + prefix + 'auction-price)"/>';
      } else {
        // Each payment branch varies along one axis. Sample that smooth color
        // field separately, then let vector clips draw the exact jump at v=c.
        function texture(trades) {
          var canvas = document.createElement("canvas");
          var buyer = def.id === "pB";
          canvas.width = buyer ? resolution : 1;
          canvas.height = buyer ? 1 : resolution;
          var context = canvas.getContext("2d");
          var pixels = context.createImageData(canvas.width, canvas.height);
          for (var i = 0; i < resolution; i += 1) {
            var coordinate = buyer ? (i + 0.5) / resolution :
              rule.sellerSupport[1] - (i + 0.5) / resolution;
            var value = buyer ? (trades ? coordinate : 0) - rule.buyerRent(coordinate) :
              (trades ? coordinate : 0) + rule.sellerRent(coordinate);
            var rgba = visuals.signedChannels(def.id === "pS" ? -value : value, def.extent, colors.red, colors.green);
            pixels.data.set(rgba, i * 4);
          }
          context.putImageData(pixels, 0, 0);
          return canvas.toDataURL();
        }
        content = '<defs><clipPath id="' + prefix + 'trade" clipPathUnits="userSpaceOnUse"><polygon points="' + tradePoints +
          '"/></clipPath><clipPath id="' + prefix + 'no-trade" clipPathUnits="userSpaceOnUse"><polygon points="' + noTradePoints +
          '"/></clipPath></defs>';
        [false, true].forEach(function (trades) {
          content += '<image width="1" height="1" preserveAspectRatio="none" clip-path="url(#' + prefix +
            (trades ? "trade" : "no-trade") + ')" href="' + texture(trades) + '"/>';
        });
      }
      // Inline geometry paints with the boundary overlay in the same frame.
      // An SVG image data URL may finish decoding only after that frame.
      field.innerHTML = content;
    }
    function draw(panel, quality, force) {
      var def = panel.def;
      // The rule identity must invalidate every panel when a curated preset changes.
      var minimum = rule.id === "minimum-rent";
      var buyerDependent = def.id === "buyerIC" || (minimum && ["pB", "buyerPayoff", "revenue"].includes(def.id));
      var sellerDependent = def.id === "sellerIC" || (minimum && ["pS", "sellerPayoff", "revenue"].includes(def.id));
      var kDependent = !minimum && !["q", "efficiency", "revenue"].includes(def.id);
      var key = [rule.id, rule.epsilon, buyerDependent ? rule.gammaB : "",
        sellerDependent ? rule.gammaS : "", kDependent ? rule.k : ""].join(":");
      var hasTexture = !panel.vector || (minimum && (def.id === "pB" || def.id === "pS"));
      var resolution = hasTexture ? style.rasterSize(panel.svg, LAYOUT, quality) : 0;
      // An unchanged raster at final quality can also serve as a preview.
      var reusable = panel.resolution === resolution ||
        (quality === "preview" && panel.resolution > resolution);
      if (key === panel.key && reusable && !force) {
        if (hasTexture && quality === "final") {
          panel.quality = quality;
          panel.field.dataset.rasterQuality = quality;
        }
        return;
      }
      var domain = domains(def, rule);
      if (panel.vector) {
        drawRegions(panel.field, def, resolution);
      } else {
        var money = def.id === "revenue";
        panel.field.setAttribute("href", global.SvgUtils.createFieldRaster(resolution, function (x, y) {
          return rule.field(def.id, domain[0][0] + x, domain[1][0] + y);
        }, function (value) {
          return visuals.signedChannels(value, def.extent,
            money ? colors.red : colors.blue, money ? colors.green : colors.yellow);
        }));
      }
      panel.key = key;
      panel.resolution = resolution;
      panel.quality = quality;
      panel.field.dataset.edgeRenderer = panel.vector ? "vector-regions" : "raster";
      if (hasTexture) {
        panel.field.dataset.resolution = resolution;
        panel.field.dataset.rasterQuality = quality;
      } else {
        delete panel.field.dataset.resolution;
        delete panel.field.dataset.rasterQuality;
      }
      var domainKey = domain.join(";");
      if (domainKey !== panel.domainKey) {
        panel.domainKey = domainKey;
        panel.xAxis.update(domain[0]);
        panel.yAxis.update(domain[1]);
        panel.description.textContent = "Read-only plot. Horizontal support [" + domain[0].join(", ") +
          "], vertical support [" + domain[1].join(", ") + "]. Pointer and keyboard probes evaluate exact values.";
      }
      panel.overlays.replaceChildren();
      if (def.domain) {
        var path = "M" + LAYOUT.left + " " + LAYOUT.bottom + "L" + LAYOUT.right + " " + LAYOUT.top;
        appendSvg(panel.overlays, "path", { d: path, "class": "truthful-report-line" });
        var trace = def.domain === "buyer" ? rule.buyerBestReportTrace : rule.sellerBestReportTrace;
        var bestPath = trace.map(function (point, index) {
          return (index ? "L" : "M") + (LAYOUT.left + SIZE * (point[0] - domain[0][0])) + " " +
            (LAYOUT.bottom - SIZE * (point[1] - domain[1][0]));
        }).join("");
        appendSvg(panel.overlays, "path", { d: bestPath, "class": "best-report-line",
          "data-trace-segments": trace.length - 1 });
      } else {
        var e = rule.epsilon;
        if (e > 0) {
          appendSvg(panel.overlays, "path", { d: "M" + (LAYOUT.left + SIZE * (1 - e)) + " " + LAYOUT.bottom + "L" + LAYOUT.right + " " + (LAYOUT.bottom - SIZE * e), "class": panel.main ? "preset-boundary" : "diagonal-guide" });
        } else {
          appendSvg(panel.overlays, "circle", { cx: LAYOUT.right, cy: LAYOUT.bottom, r: 2.6, "class": "preset-boundary", fill: "none" });
        }
      }
      updateProbe(panel);
    }
    function updateStatuses() {
      var t = rule.totals;
      var statuses = {
        buyerIC: ["BIC: " + (t.buyerBIC ? "passes" : "fails") +
          " (best-response path (orange points) " +
          (t.buyerBIC ? "lies on" : "does not lie entirely on") + " v′ = v)",
          "DSIC: " + (t.buyerDSIC ? "passes" : "fails") + " (maximum deviation gain = " + number(t.buyerMaximumExPostGain) + ")"],
        sellerIC: ["BIC: " + (t.sellerBIC ? "passes" : "fails") +
          " (best-response path (orange points) " +
          (t.sellerBIC ? "lies on" : "does not lie entirely on") + " c′ = c)",
          "DSIC: " + (t.sellerDSIC ? "passes" : "fails") + " (maximum deviation gain = " + number(t.sellerMaximumExPostGain) + ")"],
        revenue: ["Ex-ante BB: " + (t.exAnteBB ? "passes" : "fails") + " (expected revenue = " + number(t.revenue) + ")",
          "Ex-post BB: " + (t.exPostBB ? "passes" : "fails") + " (largest deficit = " + number(t.largestDeficit) + ")"],
        buyerPayoff: ["Buyer ex-ante IR: passes (expected payoff = " + number(t.buyerUtility) + ")", "Buyer interim IR: " + (t.buyerInterimIR ? "passes" : "fails") + " (minimum = 0)", "Buyer ex-post IR: " + (t.buyerExPostIR ? "passes" : "fails") + " (minimum = 0)"],
        sellerPayoff: ["Seller ex-ante IR: passes (expected payoff = " + number(t.sellerUtility) + ")", "Seller interim IR: " + (t.sellerInterimIR ? "passes" : "fails") + " (minimum = 0)", "Seller ex-post IR: " + (t.sellerExPostIR ? "passes" : "fails") + " (minimum = 0)"],
        efficiency: ["Ex-ante efficiency: passes (expected loss = " + number(t.expectedEfficiencyLoss) + ")", "Ex-post efficiency: passes (largest loss = " + number(t.largestEfficiencyLoss) + ")"]
      };
      panels.forEach(function (panel) {
        panel.status.replaceChildren();
        (statuses[panel.def.id] || []).forEach(function (text) {
          var p = document.createElement("p");
          var split = text.indexOf(": ") + 2;
          var verdict = text.slice(split).split(" ")[0];
          p.className = verdict === "passes" ? "verdict-pass" : "verdict-fail";
          p.textContent = text;
          panel.status.appendChild(p);
        });
      });
    }
    return {
      render: function (nextRule, quality, force) {
        rule = nextRule;
        if (force) { colors = visuals.readHeatmapPalette(getComputedStyle(document.documentElement)); }
        panels.forEach(function (panel) { draw(panel, quality, force); });
        updateStatuses();
      },
      number: number
    };
  }
  global.LyingCostCharts = Object.freeze({ create: create });
})(window);
