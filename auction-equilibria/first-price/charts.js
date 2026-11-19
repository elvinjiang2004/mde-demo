(function () {
  "use strict";

  function create(state, elements, distributionSpec) {
    var auctionControls = window.AuctionControls;
    var model = window.FPAModel;
    var distributions = window.AuctionDistributions;
    function appendSvg(parent, name, attributes, text) {
      var node = window.SvgUtils.appendSvg(parent, name, attributes, text);
      if (name === "text" && typeof text === "string") { ChartLayout.mathText(node, text); }
      return node;
    }
    function units(pixels) { return ChartLayout.svgUnits(elements.chart, pixels); }
    var formatEditableNumber = auctionControls.formatEditableNumber;
    var formatChoiceNumber = auctionControls.formatChoiceNumber;
    var chart = window.AuctionChart;
    var formatMoney = chart.formatMoney;
    var formatPercent = chart.formatPercent;
    var roundCoordinate = chart.roundCoordinate;
    var yScale = chart.yScale;
    var densityY = chart.densityY;
    var densityScaleMaximum = chart.densityScaleMaximum;
    var uniqueByBid = chart.uniqueByBid;
    var drawPanelScaffold = chart.drawPanelScaffold;
    var drawCurve = chart.drawCurve;
    var drawCircle = chart.drawCircle;
    var lastChartLayout = { width: 1000, left: 90, right: 975 };
    var valuePdfSignature = null;
    var curveCache = null;
    var curveCacheBuildCount = 0;

    function drawDiamond(svg, x, y, className) {
      chart.drawDiamond(svg, x, y, className, units(5));
    }

    function getChartLayout() {
      var layout = chart.chartLayout(
        elements.chart.parentElement.clientWidth ||
          elements.chart.clientWidth ||
          1000
      );
      var scale = (elements.chart.clientWidth || layout.width) / layout.width;
      layout.left = Math.max(layout.left, 68 / scale);
      layout.densityTop = Math.max(layout.densityTop, 80 / scale);
      layout.cdfTop = Math.max(layout.cdfTop, layout.densityTop + layout.densityHeight + 110 / scale);
      var bottom = layout.cdfTop + layout.cdfHeight;
      layout.endpointLabelY = bottom + 44 / scale;
      layout.bracketY = bottom + 72 / scale;
      layout.bracketLabelY = bottom + 94 / scale;
      layout.height = Math.max(layout.height, bottom + 116 / scale);
      return layout;
    }

    function drawValuePdfPreview() {
      var svg = elements.valuePdfPreview;
      if (!svg) {
        return;
      }
      var signature = [state.a, state.b, state.alpha, state.beta, Math.round(svg.getBoundingClientRect().width)].join("|");
      if (signature === valuePdfSignature && svg.childNodes.length > 0) {
        return;
      }
      valuePdfSignature = signature;
      chart.drawValueDensityPreview(svg, {
        lower: state.a,
        upper: state.b,
        lowerSymbol: "v̲ᵢ",
        upperSymbol: "v̅ᵢ",
        alpha: state.alpha,
        beta: state.beta,
        distribution: distributionSpec(),
        pdf: distributions.pdf,
        formatEditableNumber: formatEditableNumber,
        formatChoiceNumber: formatChoiceNumber
      });
    }
    function chartPointerToBid(event, clampOutside) {
      var rect = elements.chart.getBoundingClientRect();
      if (!(rect.width > 0)) {
        return null;
      }
      var svgX =
        (event.clientX - rect.left) / rect.width * lastChartLayout.width;
      var left = lastChartLayout.left;
      var right = lastChartLayout.right;

      if (svgX < left || svgX > right) {
        if (!clampOutside) {
          return null;
        }
        return svgX < left ? state.a : state.b;
      }

      var ratio = (svgX - left) / (right - left);
      return state.a + ratio * (state.b - state.a);
    }

    function drawChart(current, equilibrium) {
      var svg = elements.chart;
      var layout = getChartLayout();
      var width = layout.width;
      var height = layout.height;
      var left = layout.left;
      var right = layout.right;
      var plotWidth = right - left;
      var densityTop = layout.densityTop;
      var densityHeight = layout.densityHeight;
      var cdfTop = layout.cdfTop;
      var cdfHeight = layout.cdfHeight;
      var cdfBottom = cdfTop + cdfHeight;
      var span = state.b - state.a;
      svg.setAttribute("viewBox", "0 0 " + width + " " + height);
      ChartLayout.setTextSize(svg);
      var underlying = cachedUnderlyingCurves(layout);
      var samples = sampleWinningProbabilities(
        underlying.winningProbability, current, equilibrium
      );
      var selectedDensity = model.highestOpponentBidDensity(
        current.bid, state.n, state.a, state.b, distributionSpec()
      );
      var densitySamples = sampleDensity(
        underlying.density, current.bid, selectedDensity
      );
      var densityPeak = densityScaleMaximum(densitySamples.curve);
      lastChartLayout = layout;
      svg.dataset.curveCacheKey = underlying.signature;
      svg.dataset.curveCacheBuildCount = String(underlying.buildCount);
      svg.setAttribute("viewBox", "0 0 " + width + " " + height);
      ChartLayout.setTextSize(svg);

      function xScale(value) {
        return left + ((value - state.a) / span) * plotWidth;
      }

      var densityPanel = {
        id: "density-y",
        top: densityTop,
        height: densityHeight,
        min: 0,
        max: densityPeak * 1.12,
        title: null
      };
      var cdfPanel = {
        id: "probability-y",
        top: cdfTop,
        height: cdfHeight,
        min: 0,
        max: 1,
        title: null,
        percent: true
      };

      svg.replaceChildren();
      appendSvg(svg, "title", { id: "chart-title" },
        "First-price auction winning probability and expected-payoff rectangle");
      appendSvg(svg, "desc", { id: "chart-description" },
        chartDescription(current, equilibrium));

      drawPanelScaffold(svg, densityPanel, left, right);
      drawPanelScaffold(svg, cdfPanel, left, right);
      drawPanelTitles(svg, densityPanel, cdfPanel, left, right, layout.height);

      drawDensityArea(
        svg,
        densitySamples.support,
        Math.min(current.bid, current.maximumEquilibriumBid),
        xScale,
        densityPanel,
        left,
        current.winProbability
      );
      drawCurve(
        svg,
        densitySamples.curve,
        function (point) { return xScale(point.bid); },
        function (point) { return densityY(point.density, densityPanel); },
        "curve highest-bid-density-curve"
      );

      var supportX = xScale(current.maximumEquilibriumBid);
      appendSvg(svg, "line", {
        x1: supportX,
        y1: densityTop,
        x2: supportX,
        y2: densityTop + densityHeight,
        class: "support-guide",
        "data-support-bid": current.maximumEquilibriumBid
      });


      var equilibriumX = xScale(equilibrium.bid);
      appendSvg(svg, "line", {
        x1: equilibriumX,
        y1: densityTop,
        x2: equilibriumX,
        y2: densityTop + densityHeight,
        class: "equilibrium-marker density-equilibrium-marker",
        "data-equilibrium-bid": equilibrium.bid
      });
      drawProbabilityAreaLabel(svg, current, xScale, densityPanel, left,
        xScale(Math.min(current.bid, current.maximumEquilibriumBid)), layout.compact,
        function (bid) { return interpolatedDensity(underlying.density.support, bid); });
      var chosenX = xScale(current.bid);
      drawSelectedMarker(svg, chosenX, densityTop, densityTop + densityHeight);
      drawCircle(
        svg,
        chosenX,
        densityY(selectedDensity, densityPanel),
        "chosen-point"
      );

      drawExpectedPayoffRectangle(
        svg,
        current,
        xScale,
        cdfPanel,
        left,
        right,
        layout.compact
      );
      drawCurve(
        svg,
        samples,
        function (point) { return xScale(point.bid); },
        function (point) { return yScale(point.winProbability, cdfPanel); },
        "curve highest-bid-cdf-curve"
      );

      var cdfZeroY = yScale(0, cdfPanel);
      drawBidAxis(svg, xScale, left, right, cdfZeroY);

      drawWinningProbabilityGuideLine(
        svg,
        current,
        chosenX,
        cdfPanel,
        left
      );

      drawSelectedMarker(svg, chosenX, cdfTop, cdfBottom);
      drawCircle(
        svg,
        chosenX,
        yScale(current.winProbability, cdfPanel),
        "chosen-point"
      );

      var equilibriumY = yScale(equilibrium.winProbability, cdfPanel);
      appendSvg(svg, "line", {
        x1: equilibriumX,
        y1: cdfTop,
        x2: equilibriumX,
        y2: cdfBottom,
        class: "equilibrium-marker"
      });
      drawDiamond(
        svg,
        equilibriumX,
        equilibriumY,
        "equilibrium-point"
      );
      drawAxisPayoffDecomposition(
        svg,
        current,
        xScale,
        cdfZeroY,
        left,
        right,
        layout
      );

      appendSvg(svg, "rect", {
        x: left,
        y: densityTop,
        width: plotWidth,
        height: cdfBottom - densityTop,
        class: "drag-overlay",
        "aria-hidden": "true"
      });

      bringMetricLabelsToForeground(svg, current);
      bindProbes(svg, densityPanel, cdfPanel, left, right, equilibrium);
    }

    function bidDistributionNotation(name) {
      var s = PlotProbe.symbol;
      return [s(name, [s("β", "", [s("Y", "i")], "I")], [s("x", "i")])];
    }

    function drawPanelTitles(svg, densityPanel, cdfPanel, left, right, height) {
      var scale = 1 / units(1);
      var reservedHeight = 2 * 1.4 * .86 * parseFloat(getComputedStyle(document.documentElement).fontSize);
      [densityPanel, cdfPanel].forEach(function (panel, index) {
        var title = document.getElementById(index === 0 ? "density-plot-title" : "cdf-plot-title");
        title.style.left = left * scale + "px";
        title.style.width = (right - left) * scale + "px";
        title.style.bottom = (height - panel.top) * scale + 26 + "px";
        // Reserve the HTML title's two-line slot in the composite's fixed bounds.
        appendSvg(svg, "rect", { x: left, y: panel.top - units(26 + reservedHeight), width: right - left,
          height: units(reservedHeight), fill: "none", stroke: "none", class: "first-price-title-space", "pointer-events": "none", "aria-hidden": "true" });
      });
    }

    function bindProbes(svg, densityPanel, cdfPanel, left, right, equilibrium) {
      var P = PlotProbe, spec = distributionSpec();
      var support = model.maximumEquilibriumBid(state.n, state.a, state.b, spec);
      var knots = [state.a, equilibrium.bid, support, state.b];
      var references = [{ key: "equilibrium-bid", label: "Equilibrium bid", value: equilibrium.bid, color: "var(--orange)",
        notation: [P.symbol("β", "", [P.symbol("v", "i")], "I")] }];
      P.attach(svg, { editable: true, modifier: "alt", views: function () { return [
        { id: "density", name: "Bid", frame: { left: left, right: right, top: densityPanel.top, bottom: densityPanel.top + densityPanel.height },
          domain: [state.a, state.b], yDomain: [densityPanel.min, densityPanel.max], input: [P.symbol("x", "i")], knots: knots, references: references,
          sample: function (bid) {
            var value = model.highestOpponentBidDensity(bid, state.n, state.a, state.b, spec);
            var rows = [{ key: "density", label: "Opposing-bid density", notation: bidDistributionNotation("f"), value: value, color: "var(--blue)" }];
            if (bid === support && support < state.b && value !== 0) {
              rows.push(Object.assign({}, rows[0], { key: "density-right", value: 0, open: true, side: "right limit" }));
            }
            return rows;
          } },
        { id: "probability", name: "Bid", frame: { left: left, right: right, top: cdfPanel.top, bottom: cdfPanel.top + cdfPanel.height },
          domain: [state.a, state.b], yDomain: [0, 1], input: [P.symbol("x", "i")], knots: knots, references: references,
          sample: function (bid) { return [
            { key: "cdf", label: "Opposing-bid CDF", notation: bidDistributionNotation("F"),
              value: model.winProbability(bid, state.n, state.a, state.b, spec), color: "var(--blue)" }
          ]; } }
      ]; } });
    }

    function cachedUnderlyingCurves(layout) {
      var displayed = PlotStyle.dimensions(elements.chart, { left: layout.left, right: layout.right, top: 0, bottom: layout.height });
      var signature = [state.n, state.a, state.b, state.alpha, state.beta, Math.ceil(displayed.width / 32), Math.ceil(displayed.height / 32)].join("|");
      if (curveCache && curveCache.signature === signature) {
        return curveCache;
      }
      var sampled = sampleUnderlyingCurves(layout, displayed);
      curveCache = {
        signature: signature,
        buildCount: curveCacheBuildCount + 1,
        winningProbability: sampled.winningProbability,
        density: sampled.density
      };
      curveCacheBuildCount = curveCache.buildCount;
      return curveCache;
    }

    function sampleUnderlyingCurves(layout, displayed) {
      var spec = distributionSpec();
      var supportEnd = model.maximumEquilibriumBid(
        state.n, state.a, state.b, spec
      );
      var support = [], probability = [];
      function evaluate(t) {
        // Plot parametrically in the opponent's value; no inverse solve is
        // needed at each sample. Cluster samples near both support endpoints.
        var position = (1 - Math.cos(Math.PI * t)) / 2;
        var value = state.a + position * (state.b - state.a);
        var bid = model.equilibriumBid(value, state.n, state.a, state.b, spec);
        var win = Math.pow(distributions.cdf(value, state.a, state.b, spec), state.n - 1);
        var density = value > bid ? win / (value - bid) :
          densityForPlot(bid, state.a, supportEnd);
        return { bid: bid, density: density, winProbability: win };
      }
      var peak = 1;
      for (var i = 0; i <= 32; i += 1) { peak = Math.max(peak, evaluate(i / 32).density); }
      var ratio = displayed.height / layout.height;
      var points = PlotStyle.adaptive(evaluate, function (p) {
        var px = (p.bid - state.a) / (state.b - state.a) * displayed.width;
        return [[px, p.winProbability * layout.cdfHeight * ratio],
          [px, p.density / (peak * 1.12) * layout.densityHeight * ratio]];
      }, 0, 1, { segments: Math.max(4, Math.ceil(displayed.width / 96)) });
      points.forEach(function (p) {
        support.push({ bid: p.bid, density: p.density });
        probability.push({ bid: p.bid, winProbability: p.winProbability });
      });
      var curve = support.slice();
      curve.push({ bid: supportEnd, density: 0 });
      if (supportEnd < state.b - model.EPSILON) {
        curve.push({ bid: state.b, density: 0 });
      }
      // The repeated endpoint draws the vertical density cutoff; do not deduplicate it.
      if (supportEnd < state.b) { probability.push({ bid: state.b, winProbability: 1 }); }
      return { winningProbability: uniqueByBid(probability),
        density: { supportEnd: supportEnd, support: uniqueByBid(support), curve: curve } };
    }

    function sampleWinningProbabilities(base, current, equilibrium) {
      var points = base.slice();
      var spec = distributionSpec();
      [{ bid: state.value },
        { bid: current.bid, winProbability: current.winProbability },
        { bid: equilibrium.bid, winProbability: equilibrium.winProbability },
        { bid: current.maximumEquilibriumBid, winProbability: 1 }]
        .forEach(function (point) {
          var bid = model.clamp(point.bid, state.a, state.b);
          points.push({ bid: bid, winProbability: point.winProbability === undefined ?
            model.winProbability(bid, state.n, state.a, state.b, spec) : point.winProbability });
        });
      points.sort(function (first, second) { return first.bid - second.bid; });
      return uniqueByBid(points);
    }

    function sampleDensity(base, selectedBid, selectedDensity) {
      var support = base.support.slice();
      var capped = model.clamp(selectedBid, state.a, base.supportEnd);
      support.push({ bid: capped, density: Math.abs(capped - selectedBid) <= model.EPSILON ?
        selectedDensity : interpolatedDensity(base.support, capped) });
      support.sort(function (first, second) { return first.bid - second.bid; });
      support = uniqueByBid(support);
      var curve = support.slice();
      curve.push({ bid: base.supportEnd, density: 0 });
      if (base.supportEnd < state.b - model.EPSILON) {
        curve.push({ bid: state.b, density: 0 });
      }
      // Preserve both heights at supportEnd, including when reusing cached samples.
      return { support: support, curve: curve };
    }

    function interpolatedDensity(points, bid) {
      var last = points.length - 1;
      var bounded = model.clamp(bid, points[0].bid, points[last].bid);
      var low = 0;
      var high = last;
      while (high - low > 1) {
        var middle = Math.floor((low + high) / 2);
        if (points[middle].bid <= bounded) { low = middle; } else { high = middle; }
      }
      var left = points[low];
      var right = points[high];
      var gap = right.bid - left.bid;
      return Math.abs(gap) <= model.EPSILON ? left.density :
        left.density + (bounded - left.bid) / gap * (right.density - left.density);
    }
    function densityForPlot(bid, supportStart, supportEnd) {
      var density = model.highestOpponentBidDensity(
        bid,
        state.n,
        state.a,
        state.b,
        distributionSpec()
      );
      if (Number.isFinite(density) && density >= 0) {
        return density;
      }

      var supportSpan = supportEnd - supportStart;
      var inwardBid = bid <= supportStart + supportSpan / 2 ?
        supportStart + supportSpan / 1000 :
        supportEnd - supportSpan / 1000;
      density = model.highestOpponentBidDensity(
        inwardBid,
        state.n,
        state.a,
        state.b,
        distributionSpec()
      );
      return Number.isFinite(density) && density >= 0 ? density : 0;
    }

    function drawDensityArea(
      svg,
      points,
      endBid,
      xScale,
      panel,
      left,
      winProbability
    ) {
      if (endBid <= state.a + model.EPSILON) {
        return;
      }

      var included = points.filter(function (point) {
        return point.bid <= endBid + model.EPSILON;
      });
      var endPoint = included[included.length - 1];
      if (!endPoint || Math.abs(endPoint.bid - endBid) > model.EPSILON) {
        included.push({
          bid: endBid,
          density: model.highestOpponentBidDensity(
            endBid,
            state.n,
            state.a,
            state.b,
            distributionSpec()
          )
        });
      }

      var baseY = yScale(0, panel);
      var path = "M " + roundCoordinate(left) + " " + roundCoordinate(baseY);
      included.forEach(function (point) {
        path += " L " + roundCoordinate(xScale(point.bid)) + " " +
          roundCoordinate(densityY(point.density, panel));
      });
      path += " L " + roundCoordinate(xScale(endBid)) + " " +
        roundCoordinate(baseY) + " Z";

      appendSvg(svg, "path", {
        d: path,
        class: "winning-area",
        "data-metric": "win-probability",
        "data-end-bid": endBid,
        "data-probability": winProbability
      });
    }

    function drawExpectedPayoffRectangle(
      svg,
      current,
      xScale,
      panel,
      left,
      right,
      compact
    ) {
      var bidX = xScale(current.bid);
      var valueX = xScale(state.value);
      var probabilityY = yScale(current.winProbability, panel);
      var baseY = yScale(0, panel);
      var signedWidth = state.value - current.bid;
      var signedPayoff = current.expectedPayoff;
      var rectangleState = signedPayoff > model.EPSILON ?
        "positive" : (signedPayoff < -model.EPSILON ? "negative" : "zero");
      var rectangleWidth = Math.abs(valueX - bidX);
      var rectangleHeight = Math.max(0, baseY - probabilityY);
      var rectangleClass = "expected-payoff-rectangle expected-payoff-" +
        rectangleState;
      var rectangle = appendSvg(svg, "rect", {
        x: Math.min(bidX, valueX),
        y: probabilityY,
        width: rectangleWidth,
        height: rectangleHeight,
        class: rectangleClass,
        "data-metric": "expected-payoff",
        "data-state": rectangleState,
        "data-probability": current.winProbability,
        "data-signed-width": signedWidth,
        "data-signed-payoff": signedPayoff,
        "data-bid": current.bid,
        "data-value": state.value
      });

      appendSvg(rectangle, "title", {},
        "Expected payoff rectangle: probability " +
        formatPercent(current.winProbability) + ", signed width " +
        formatMoney(signedWidth, state.b - state.a) + ", signed payoff " +
        formatMoney(signedPayoff, state.b - state.a) + ".");

      appendSvg(svg, "line", {
        x1: valueX,
        y1: panel.top,
        x2: valueX,
        y2: baseY,
        class: "cdf-value-guide",
        "data-value": state.value,
        "data-notation": "v_i"
      });

      if (rectangleState === "zero") {
        drawZeroExpectedPayoff(
          svg,
          bidX,
          valueX,
          probabilityY,
          baseY,
          rectangleWidth,
          rectangleHeight,
          current
        );
      }

      var payoffText = formatMoney(signedPayoff, state.b - state.a);
      var label = "Expected payoff = " + payoffText;
      var lineHeight = units(18);
      var candidates = [
        [label],
        ["Expected payoff ", "= " + payoffText],
        ["Expected ", "payoff ", "= " + payoffText]
      ];
      var chosen = null;

      candidates.some(function (lines) {
        var block = svgTextBlock(lines, lineHeight);
        if (rectangleWidth >= block.width + units(12)) {
          chosen = block;
          return true;
        }
        return false;
      });

      if (chosen) {
        var chosenY = probabilityY + rectangleHeight / 2 + units(4) -
          (chosen.lines.length - 1) * lineHeight / 2;
        appendSvgTextLines(svg, {
          x: (bidX + valueX) / 2,
          y: chosenY,
          class: "expected-payoff-label annotation-halo" +
            (rectangleState === "negative" ? " negative-metric" : ""),
          "text-anchor": "middle",
          "data-metric": "expected-payoff-label",
          "data-layout": chosen.lines.length === 1 ? "single" : "wrapped",
          "data-state": rectangleState,
          "data-placement": "inside-area",
          "data-horizontal-fit": "true",
          "data-foreground": "true"
        }, chosen.lines, lineHeight, label);
        return;
      }

      var fallback = markerAttachedTextPlacement(
        candidates,
        lineHeight,
        bidX,
        left,
        right,
        units(8)
      );
      fallback.y = probabilityY + rectangleHeight / 2 + units(4) -
        (fallback.block.lines.length - 1) * lineHeight / 2;

      appendSvgTextLines(svg, {
        x: fallback.x,
        y: fallback.y,
        class: "expected-payoff-label annotation-halo" +
          (rectangleState === "negative" ? " negative-metric" : ""),
        "text-anchor": fallback.anchor,
        "data-metric": "expected-payoff-label",
        "data-layout": fallback.block.lines.length === 1 ? "single" : "wrapped",
        "data-state": rectangleState,
        "data-placement": fallback.placement,
        "data-horizontal-fit": "false",
        "data-foreground": "true"
      }, fallback.block.lines, lineHeight, label);
    }

    function drawZeroExpectedPayoff(
      svg,
      bidX,
      valueX,
      probabilityY,
      baseY,
      rectangleWidth,
      rectangleHeight,
      current
    ) {
      var commonAttributes = {
        class: "zero-expected-payoff",
        "data-metric": "expected-payoff-zero",
        "data-state": "zero",
        "data-probability": current.winProbability,
        "data-signed-width": state.value - current.bid,
        "data-signed-payoff": current.expectedPayoff
      };

      if (rectangleWidth < 1 && rectangleHeight < 1) {
        appendSvg(svg, "circle", Object.assign({}, commonAttributes, {
          cx: bidX,
          cy: baseY,
          r: 5
        }));
        return;
      }

      if (rectangleWidth < 1) {
        appendSvg(svg, "line", Object.assign({}, commonAttributes, {
          x1: bidX,
          y1: probabilityY,
          x2: bidX,
          y2: baseY
        }));
        return;
      }

      appendSvg(svg, "line", Object.assign({}, commonAttributes, {
        x1: Math.min(bidX, valueX),
        y1: baseY,
        x2: Math.max(bidX, valueX),
        y2: baseY
      }));
    }

    function drawWinningProbabilityGuideLine(
      svg,
      current,
      selectedX,
      panel,
      left
    ) {
      var guideY = yScale(current.winProbability, panel);
      appendSvg(svg, "line", {
        x1: left,
        y1: guideY,
        x2: selectedX,
        y2: guideY,
        class: "winning-probability-guide-line",
        "data-probability": current.winProbability
      });
    }

    function drawBidAxis(svg, xScale, left, right, zeroY) {
      appendSvg(svg, "line", {
        x1: left,
        y1: zeroY,
        x2: right,
        y2: zeroY,
        class: "axis-line zero-line cdf-zero-axis",
        "data-axis-value": "0"
      });

      PlotStyle.axis(svg, { orientation: "x", frame: { left: left, right: right, top: zeroY, bottom: zeroY },
        domain: [state.a, state.b] });

    }

    function drawAxisPayoffDecomposition(
      svg,
      current,
      xScale,
      zeroY,
      left,
      right,
      layout
    ) {
      var paymentX = xScale(current.bid);
      var valueX = xScale(state.value);
      var signedPayoffIfWin = state.value - current.bid;
      var stateName = signedPayoffIfWin > model.EPSILON ?
        "positive" : (signedPayoffIfWin < -model.EPSILON ? "negative" : "zero");
      var closeEndpoints = Math.abs(paymentX - valueX) < units(120);
      var paymentLabel = "xᵢ = " +
        formatMoney(current.paymentIfWin, state.b - state.a);
      var valueLabel = "vᵢ = " +
        formatMoney(state.value, state.b - state.a);
      var paymentPlacement;
      var valuePlacement;

      if (stateName === "zero") {
        appendSvg(svg, "line", {
          x1: paymentX,
          y1: zeroY - 9,
          x2: paymentX,
          y2: zeroY + 9,
          class: "axis-payment-marker axis-value-marker",
          "data-payment": current.paymentIfWin,
          "data-value": state.value,
          "data-state": "zero"
        });
        appendSvg(svg, "text", {
          x: paymentX,
          y: layout.endpointLabelY,
          class: "axis-payment-label axis-value-label annotation-halo",
          "text-anchor": axisCenteredAnchor(paymentX, left, right),
          "data-payment": current.paymentIfWin,
          "data-value": state.value
        }, "xᵢ = vᵢ = " +
          formatMoney(current.bid, state.b - state.a));
      } else {
        appendSvg(svg, "line", {
          x1: paymentX,
          y1: zeroY - 9,
          x2: paymentX,
          y2: zeroY + 9,
          class: "axis-payment-marker",
          "data-payment": current.paymentIfWin,
          "data-bid": current.bid
        });
        appendSvg(svg, "line", {
          x1: valueX,
          y1: zeroY - 7,
          x2: valueX,
          y2: zeroY + 7,
          class: "axis-value-marker",
          "data-value": state.value
        });

        paymentPlacement = axisEndpointLabelPlacement(
          paymentX,
          paymentX < valueX ? -1 : 1,
          paymentLabel,
          left,
          right
        );
        valuePlacement = axisEndpointLabelPlacement(
          valueX,
          valueX < paymentX ? -1 : 1,
          valueLabel,
          left,
          right
        );

        appendSvg(svg, "text", {
          x: paymentPlacement.x,
          y: layout.endpointLabelY - (closeEndpoints ? units(7) : 0),
          class: "axis-payment-label annotation-halo",
          "text-anchor": paymentPlacement.anchor,
          "data-payment": current.paymentIfWin,
          "data-bid": current.bid
        }, paymentLabel);
        appendSvg(svg, "text", {
          x: valuePlacement.x,
          y: layout.endpointLabelY + (closeEndpoints ? units(11) : 0),
          class: "axis-value-label annotation-halo",
          "text-anchor": valuePlacement.anchor,
          "data-value": state.value
        }, valueLabel);
      }

      drawPayoffIfWinBracket(
        svg,
        paymentX,
        valueX,
        signedPayoffIfWin,
        stateName,
        left,
        right,
        layout
      );
    }

    function drawPayoffIfWinBracket(
      svg,
      paymentX,
      valueX,
      signedPayoffIfWin,
      stateName,
      left,
      right,
      layout
    ) {
      var bracketLeft = Math.min(paymentX, valueX);
      var bracketRight = Math.max(paymentX, valueX);
      var group = appendSvg(svg, "g", {
        class: "payoff-if-win-bracket payoff-bracket-" + stateName,
        "data-state": stateName,
        "data-payment": state.bid,
        "data-value": state.value,
        "data-signed-width": signedPayoffIfWin,
        "data-signed-payoff-if-win": signedPayoffIfWin
      });
      var label = "Payoff if you win, vᵢ − xᵢ = " +
        formatMoney(signedPayoffIfWin, state.b - state.a);
      var labelWidth = ChartLayout.measureText(svg, label, "payoff-if-win-axis-label");
      var labelX = (bracketLeft + bracketRight) / 2;
      var labelAnchor = "middle";

      if (stateName === "zero") {
        appendSvg(group, "circle", {
          cx: paymentX,
          cy: layout.bracketY,
          r: 4,
          class: "payoff-bracket-zero-mark"
        });
      } else {
        appendSvg(group, "line", {
          x1: bracketLeft,
          y1: layout.bracketY,
          x2: bracketRight,
          y2: layout.bracketY,
          class: "payoff-bracket-line"
        });
        [bracketLeft, bracketRight].forEach(function (x) {
          appendSvg(group, "line", {
            x1: x,
            y1: layout.bracketY - 5,
            x2: x,
            y2: layout.bracketY + 5,
            class: "payoff-bracket-cap"
          });
        });
      }

      if (labelX - labelWidth / 2 < left + 4) {
        labelX = left + 4;
        labelAnchor = "start";
      } else if (labelX + labelWidth / 2 > right - 4) {
        labelX = right - 4;
        labelAnchor = "end";
      }

      appendSvg(group, "text", {
        x: labelX,
        y: layout.bracketLabelY,
        class: "payoff-if-win-axis-label annotation-halo",
        "text-anchor": labelAnchor
      }, label);
    }

    function axisEndpointLabelPlacement(x, direction, label, left, right) {
      var padding = units(7);
      var estimatedWidth = ChartLayout.measureText(elements.chart, label, "axis-payment-label");
      var placeLeft = direction < 0;

      if (placeLeft && x - padding - estimatedWidth < left) {
        placeLeft = false;
      } else if (!placeLeft && x + padding + estimatedWidth > right) {
        placeLeft = true;
      }

      return {
        x: x + (placeLeft ? -padding : padding),
        anchor: placeLeft ? "end" : "start"
      };
    }

    function axisCenteredAnchor(x, left, right) {
      if (x < left + units(105)) {
        return "start";
      }
      if (x > right - units(105)) {
        return "end";
      }
      return "middle";
    }

    function drawSelectedMarker(svg, x, top, bottom) {
      appendSvg(svg, "line", {
        x1: x,
        y1: top,
        x2: x,
        y2: bottom,
        class: "chosen-marker"
      });
    }

    function drawProbabilityAreaLabel(
      svg,
      current,
      xScale,
      panel,
      left,
      shadedRight,
      compact,
      densityAt
    ) {
      var probabilityText = formatPercent(current.winProbability);
      var label = "Probability of winning = " + probabilityText;
      var lineHeight = units(18);
      var horizontalPadding = units(10);
      var availableWidth = shadedRight - left;
      var right = xScale(state.b);
      var plotWidth = xScale(state.b) - left;
      var baseY = yScale(0, panel);
      var candidates = [
        [label],
        ["Probability of winning ", "= " + probabilityText],
        ["Probability ", "of winning ", "= " + probabilityText]
      ];
      var chosen = null;
      var heightSampleCount = 9;
      var sampledCandidateWidth = false;

      candidates.some(function (lines) {
        var block = svgTextBlock(lines, lineHeight);
        if (availableWidth < block.width + 2 * horizontalPadding) {
          return false;
        }

        var labelLeft = shadedRight - block.width - horizontalPadding;
        var availableHeight = Infinity;
        var sampleIndex;
        sampledCandidateWidth = true;

        for (sampleIndex = 0;
            sampleIndex < heightSampleCount;
            sampleIndex += 1) {
          var sampleX = labelLeft +
            (sampleIndex / (heightSampleCount - 1)) * block.width;
          var sampleBid = state.a +
            ((sampleX - left) / plotWidth) * (state.b - state.a);
          var sampleDensity = densityAt(sampleBid);
          availableHeight = Math.min(
            availableHeight,
            baseY - densityY(sampleDensity, panel)
          );
        }

        if (availableHeight < block.height + units(8)) {
          return false;
        }

        chosen = {
          block: block,
          labelLeft: labelLeft
        };
        return true;
      });

      if (!chosen) {
        var selectedX = xScale(current.bid);
        var fallbackLines = markerAttachedTextPlacement(
          candidates,
          lineHeight,
          selectedX,
          left,
          right,
          units(8)
        );
        fallbackLines.y = baseY - units(9) -
          (fallbackLines.block.lines.length - 1) * lineHeight;

        appendSvgTextLines(svg, {
          x: fallbackLines.x,
          y: fallbackLines.y,
          class: "area-label annotation-halo",
          "text-anchor": fallbackLines.anchor || "middle",
          "data-metric": "win-probability",
          "data-probability": current.winProbability,
          "data-layout": fallbackLines.block.lines.length === 1 ?
            "single" : "wrapped",
          "data-placement": fallbackLines.placement,
          "data-vertical-placement": "panel-floor",
          "data-height-check": sampledCandidateWidth ?
            "sampled-width" : "not-applicable",
          "data-height-samples": sampledCandidateWidth ? heightSampleCount : 0,
          "data-foreground": "true"
        }, fallbackLines.block.lines, lineHeight, label);
        return;
      }

      appendSvgTextLines(svg, {
        x: chosen.labelLeft + chosen.block.width / 2,
        y: baseY - units(9) -
          (chosen.block.lines.length - 1) * lineHeight,
        class: "area-label annotation-halo",
        "text-anchor": "middle",
        "data-metric": "win-probability",
        "data-probability": current.winProbability,
        "data-layout": chosen.block.lines.length === 1 ? "single" : "wrapped",
        "data-placement": "inside-area",
        "data-height-check": "sampled-width",
        "data-height-samples": heightSampleCount,
        "data-foreground": "true"
      }, chosen.block.lines, lineHeight, label);
    }

    function svgTextBlock(lines, lineHeight) {
      var widestLine = lines.reduce(function (widest, line) {
        return Math.max(widest, ChartLayout.measureText(elements.chart, line.trim(), "area-label"));
      }, 0);
      return {
        lines: lines,
        width: widestLine,
        height: units(15) + (lines.length - 1) * lineHeight
      };
    }

    function markerAttachedTextPlacement(
      candidates,
      lineHeight,
      markerX,
      left,
      right,
      gap
    ) {
      var edgePadding = units(4);
      var rightSpace = right - markerX - gap - edgePadding;
      var leftSpace = markerX - left - gap - edgePadding;
      var placement = null;

      candidates.some(function (lines) {
        var block = svgTextBlock(lines, lineHeight);
        if (rightSpace >= block.width) {
          placement = {
            block: block,
            x: markerX + gap,
            anchor: "start",
            placement: "marker-right"
          };
          return true;
        }
        return false;
      });

      if (!placement) {
        candidates.some(function (lines) {
          var block = svgTextBlock(lines, lineHeight);
          if (leftSpace >= block.width) {
            placement = {
              block: block,
              x: markerX - gap,
              anchor: "end",
              placement: "marker-left"
            };
            return true;
          }
          return false;
        });
      }

      if (!placement) {
        var fallbackLines = candidates[candidates.length - 1];
        var useRight = rightSpace >= leftSpace;
        placement = {
          block: svgTextBlock(fallbackLines, lineHeight),
          x: markerX + (useRight ? gap : -gap),
          anchor: useRight ? "start" : "end",
          placement: useRight ? "marker-right" : "marker-left"
        };
      }

      return placement;
    }

    function appendSvgTextLines(
      parent,
      attributes,
      lines,
      lineHeight,
      accessibleLabel
    ) {
      var textAttributes = Object.assign({}, attributes, {
        "aria-label": accessibleLabel,
        "data-line-count": lines.length
      });
      var textNode = appendSvg(parent, "text", textAttributes);

      lines.forEach(function (line, index) {
        appendSvg(textNode, "tspan", {
          x: attributes.x,
          dy: index === 0 ? 0 : lineHeight
        }, line);
      });

      return textNode;
    }

    function bringMetricLabelsToForeground(svg, current) {
      [".area-label", ".expected-payoff-label"].forEach(function (selector) {
        var label = svg.querySelector(selector);
        if (label) {
          label.dataset.value = selector === ".area-label" ? current.winProbability : current.expectedPayoff;
          svg.appendChild(label);
        }
      });
    }

    function chartDescription(current, equilibrium) {
      var span = state.b - state.a;
      var rectangleDescription = current.expectedPayoff < -model.EPSILON ?
        "The red rectangle denotes a negative signed payoff because the " +
          "bid exceeds the value." :
        (Math.abs(current.expectedPayoff) <= model.EPSILON ?
          "The expected-payoff rectangle has zero area." :
          "The shaded rectangle lies under the CDF.");
      return "The first panel plots the PDF of the highest equilibrium bid " +
        "among the other " + (state.n - 1) + " buyer" +
        (state.n - 1 === 1 ? "" : "s") + ". Its area through the proposed " +
        "bid gives the probability of winning, " +
        formatPercent(current.winProbability) + ". The second panel plots the " +
        "probability of winning against bid x subscript i. A dashed horizontal guide " +
        "marks the selected probability, " +
        formatPercent(current.winProbability) + ". " +
        "The axis marks x subscript i, payment upon winning, at " +
        formatMoney(current.paymentIfWin, span) +
        ", and brackets v subscript i minus x subscript i, payoff if you win, " +
        "equal to " + formatMoney(current.surplusIfWin, span) +
        ". A rectangle from x subscript i to v subscript i has probability height " +
        formatPercent(current.winProbability) + ", signed monetary width " +
        formatMoney(state.value - state.bid, span) + ", and signed area equal " +
        "to expected payoff, " + formatMoney(current.expectedPayoff, span) +
        ". " + rectangleDescription + " The maximum occurs at the equilibrium " +
        "bid beta superscript I of v subscript i, " +
        formatMoney(equilibrium.bid, span) +
        ", where expected payoff " +
        "is " + formatMoney(equilibrium.expectedPayoff, span) + ".";
    }

    function distributionSummary() {
      return "The value distribution is transformed Beta with alpha " +
        formatChoiceNumber(state.alpha) + ", beta " +
        formatChoiceNumber(state.beta) + ", and support from " +
        formatEditableNumber(state.a) + " to " +
        formatEditableNumber(state.b);
    }

    return Object.freeze({
      drawChart: drawChart,
      drawValuePdfPreview: drawValuePdfPreview,
      chartPointerToBid: chartPointerToBid,
      distributionSummary: distributionSummary
    });
  }

  window.FirstPriceCharts = Object.freeze({ create: create });
}());
