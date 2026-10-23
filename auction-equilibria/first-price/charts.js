(function () {
  "use strict";

  function create(state, elements, distributionSpec) {
    var auctionControls = window.AuctionControls;
    var model = window.FPAModel;
    var distributions = window.AuctionDistributions;
    var appendSvg = window.SvgUtils.appendSvg;
    var formatEditableNumber = auctionControls.formatEditableNumber;
    var formatChoiceNumber = auctionControls.formatChoiceNumber;
    var chart = window.AuctionChart;
    var formatMoney = chart.formatMoney;
    var formatDensityAxis = chart.formatDensityAxis;
    var formatProbabilityAxis = chart.formatProbabilityAxis;
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
      chart.drawDiamond(svg, x, y, className, 7);
    }

    function getChartLayout() {
      return chart.chartLayout(
        elements.chart.parentElement.clientWidth ||
          elements.chart.clientWidth ||
          1000,
        { endpointLabelY: 740, bracketY: 758, bracketLabelY: 780 },
        { endpointLabelY: 720, bracketY: 738, bracketLabelY: 760 }
      );
    }

    function drawValuePdfPreview() {
      var svg = elements.valuePdfPreview;
      if (!svg) {
        return;
      }
      var signature = [state.a, state.b, state.alpha, state.beta].join("|");
      if (signature === valuePdfSignature && svg.childNodes.length > 0) {
        return;
      }
      valuePdfSignature = signature;
      chart.drawValueDensityPreview(svg, {
        lower: state.a,
        upper: state.b,
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
      var underlying = cachedUnderlyingCurves(321, 361);
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

      function xScale(value) {
        return left + ((value - state.a) / span) * plotWidth;
      }

      var densityPanel = {
        top: densityTop,
        height: densityHeight,
        min: 0,
        max: densityPeak * 1.12,
        title: "PDF of highest opposing bid",
        format: formatDensityAxis,
        tickCount: 3
      };
      var cdfPanel = {
        top: cdfTop,
        height: cdfHeight,
        min: 0,
        max: 1,
        title: "Expected payoff",
        format: formatProbabilityAxis,
        tickCount: 4
      };

      svg.replaceChildren();
      appendSvg(svg, "title", { id: "chart-title" },
        "First-price auction winning probability and expected-payoff rectangle");
      appendSvg(svg, "desc", { id: "chart-description" },
        chartDescription(current, equilibrium));

      drawPanelScaffold(svg, densityPanel, left, right);
      drawPanelScaffold(svg, cdfPanel, left, right);

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
      appendSvg(svg, "text", {
        x: supportX > left + plotWidth * 0.76 ? supportX - 7 : supportX + 7,
        y: densityTop + 16,
        class: "support-label annotation-halo",
        "text-anchor": supportX > left + plotWidth * 0.76 ? "end" : "start"
      }, "βᴵ(b) = " + formatMoney(current.maximumEquilibriumBid, span));

      var equilibriumX = xScale(equilibrium.bid);
      appendSvg(svg, "line", {
        x1: equilibriumX,
        y1: densityTop,
        x2: equilibriumX,
        y2: densityTop + densityHeight,
        class: "equilibrium-marker density-equilibrium-marker",
        "data-equilibrium-bid": equilibrium.bid
      });
      drawDensityEquilibriumAnnotation(
        svg,
        equilibrium.bid,
        equilibriumX,
        densityPanel,
        left,
        right,
        layout.compact
      );

      var shadedRight = xScale(Math.min(current.bid, current.maximumEquilibriumBid));
      drawProbabilityAreaLabel(
        svg,
        current,
        xScale,
        densityPanel,
        left,
        shadedRight,
        layout.compact,
        function (bid) {
          return interpolatedDensity(underlying.density.support, bid);
        }
      );
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
      drawMaximumAnnotation(
        svg,
        equilibrium,
        equilibriumX,
        equilibriumY,
        cdfPanel,
        left,
        right,
        layout.compact
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

      bringMetricLabelsToForeground(svg);

      drawWinningProbabilityGuideLabel(
        svg,
        current,
        cdfPanel,
        left
      );
    }

    function cachedUnderlyingCurves(probabilityCount, densityCount) {
      var signature = [state.n, state.a, state.b, state.alpha, state.beta].join("|");
      if (curveCache && curveCache.signature === signature) {
        return curveCache;
      }
      curveCache = {
        signature: signature,
        buildCount: curveCacheBuildCount + 1,
        winningProbability: sampleWinningProbabilityBase(probabilityCount),
        density: sampleDensityBase(densityCount)
      };
      curveCacheBuildCount = curveCache.buildCount;
      return curveCache;
    }

    function sampleWinningProbabilityBase(count) {
      var points = [];
      var span = state.b - state.a;
      var spec = distributionSpec();
      var i;
      for (i = 0; i < count; i += 1) {
        var bid = state.a + (i / (count - 1)) * span;
        points.push({ bid: bid, winProbability: model.winProbability(
          bid, state.n, state.a, state.b, spec
        ) });
      }
      return points;
    }

    function sampleDensityBase(count) {
      var supportEnd = model.maximumEquilibriumBid(
        state.n, state.a, state.b, distributionSpec()
      );
      var support = [];
      var i;
      for (i = 0; i < count; i += 1) {
        var bid = state.a + (i / (count - 1)) * (supportEnd - state.a);
        support.push({ bid: bid, density: densityForPlot(bid, state.a, supportEnd) });
      }
      var curve = support.slice();
      curve.push({ bid: supportEnd, density: 0 });
      if (supportEnd < state.b - model.EPSILON) {
        curve.push({ bid: state.b, density: 0 });
      }
      // The repeated endpoint draws the vertical density cutoff; do not deduplicate it.
      return { supportEnd: supportEnd, support: uniqueByBid(support), curve: curve };
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
      var lineHeight = 13;
      var characterWidth = compact ? 5.7 : 6.1;
      var horizontalPadding = 12;
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
        var block = svgTextBlock(lines, characterWidth, lineHeight);
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

        if (availableHeight < block.height + 10) {
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
          characterWidth,
          lineHeight,
          selectedX,
          left,
          right,
          8
        );
        fallbackLines.y = baseY - 10 -
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
        y: baseY - 10 -
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
        "data-notation": "v_1"
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
      var lineHeight = 13;
      var characterWidth = compact ? 5.6 : 5.9;
      var candidates = [
        [label],
        ["Expected payoff ", "= " + payoffText],
        ["Expected ", "payoff ", "= " + payoffText]
      ];
      var chosen = null;

      candidates.some(function (lines) {
        var block = svgTextBlock(lines, characterWidth, lineHeight);
        if (rectangleWidth >= block.width + 18) {
          chosen = block;
          return true;
        }
        return false;
      });

      if (chosen) {
        var chosenY = probabilityY + rectangleHeight / 2 + 4 -
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
        characterWidth,
        lineHeight,
        bidX,
        left,
        right,
        8
      );
      fallback.y = probabilityY + rectangleHeight / 2 + 4 -
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

    function drawWinningProbabilityGuideLabel(
      svg,
      current,
      panel,
      left
    ) {
      var guideY = yScale(current.winProbability, panel);
      var labelY = guideY <= panel.top + 18 ? guideY + 17 : guideY - 8;
      var label = "Probability of winning = " +
        formatPercent(current.winProbability);
      appendSvg(svg, "text", {
        x: left + 8,
        y: labelY,
        class: "winning-probability-guide-label annotation-halo",
        "text-anchor": "start",
        "data-probability": current.winProbability,
        "data-placement": "axis-right",
        "data-guide-y": guideY,
        "data-foreground": "true"
      }, label);
    }

    function bringMetricLabelsToForeground(svg) {
      [".area-label", ".expected-payoff-label"].forEach(function (selector) {
        var label = svg.querySelector(selector);
        if (label) {
          svg.appendChild(label);
        }
      });
    }

    function drawBidAxis(svg, xScale, left, right, zeroY) {
      appendSvg(svg, "line", {
        x1: left,
        y1: zeroY,
        x2: right,
        y2: zeroY,
        class: "axis-line cdf-zero-axis",
        "data-axis-value": "0"
      });

      var tickCount = 5;
      var i;
      for (i = 0; i <= tickCount; i += 1) {
        var value = state.a + (i / tickCount) * (state.b - state.a);
        var x = xScale(value);
        var anchor = i === 0 ? "start" : (i === tickCount ? "end" : "middle");
        appendSvg(svg, "line", {
          x1: x,
          y1: zeroY,
          x2: x,
          y2: zeroY + 6,
          class: "axis-line"
        });
        appendSvg(svg, "text", {
          x: x + (i === 0 ? 2 : (i === tickCount ? -2 : 0)),
          y: zeroY + 20,
          class: "axis-text annotation-halo",
          "text-anchor": anchor
        }, formatAxisMoney(value));
      }

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
      var closeEndpoints = Math.abs(paymentX - valueX) <
        (layout.compact ? 105 : 120);
      var paymentLabel = "x₁ = " +
        formatMoney(current.paymentIfWin, state.b - state.a);
      var valueLabel = "v₁ = " +
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
        }, "x₁ = v₁ = " +
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
          y: layout.endpointLabelY - (closeEndpoints ? 7 : 0),
          class: "axis-payment-label annotation-halo",
          "text-anchor": paymentPlacement.anchor,
          "data-payment": current.paymentIfWin,
          "data-bid": current.bid
        }, paymentLabel);
        appendSvg(svg, "text", {
          x: valuePlacement.x,
          y: layout.endpointLabelY + (closeEndpoints ? 7 : 0),
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
      var label = "Payoff if you win, v₁ − x₁ = " +
        formatMoney(signedPayoffIfWin, state.b - state.a);
      var labelWidth = label.length * (layout.compact ? 5.6 : 5.9);
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
      var padding = 7;
      var estimatedWidth = label.length * 5.8;
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
      if (x < left + 105) {
        return "start";
      }
      if (x > right - 105) {
        return "end";
      }
      return "middle";
    }

    function annotationLabelFitsRight(label, x, left, right, padding, compact) {
      var estimatedWidth = label.length * (compact ? 5.6 : 5.9);
      var rightSpace = right - x - padding;
      var leftSpace = x - left - padding;
      return rightSpace >= estimatedWidth || rightSpace >= leftSpace;
    }

    function drawMaximumAnnotation(
      svg,
      equilibrium,
      equilibriumX,
      equilibriumY,
      panel,
      left,
      right,
      compact
    ) {
      var label = "βᴵ(v₁) = " +
        formatMoney(equilibrium.bid, state.b - state.a);
      var useRight = annotationLabelFitsRight(
        label, equilibriumX, left, right, 14, compact
      );
      var labelY = equilibriumY < panel.top + 34 ?
        equilibriumY + 24 : equilibriumY - 11;

      appendSvg(svg, "text", {
        x: equilibriumX + (useRight ? 13 : -13),
        y: clampLabelY(labelY, panel.top, panel.top + panel.height),
        class: "maximum-label annotation-halo",
        "text-anchor": useRight ? "start" : "end",
        "data-metric": "equilibrium-maximum",
        "data-equilibrium-bid": equilibrium.bid,
        "data-equilibrium-payoff": equilibrium.expectedPayoff
      }, label);
    }

    function drawDensityEquilibriumAnnotation(
      svg,
      equilibriumBid,
      equilibriumX,
      panel,
      left,
      right,
      compact
    ) {
      var label = "βᴵ(v₁) = " +
        formatMoney(equilibriumBid, state.b - state.a);
      var useRight = annotationLabelFitsRight(
        label, equilibriumX, left, right, 12, compact
      );

      appendSvg(svg, "text", {
        x: equilibriumX + (useRight ? 10 : -10),
        y: panel.top + 36,
        class: "maximum-label density-equilibrium-label annotation-halo",
        "text-anchor": useRight ? "start" : "end",
        "data-panel": "pdf",
        "data-equilibrium-bid": equilibriumBid
      }, label);
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

    function clampLabelY(value, top, bottom) {
      return model.clamp(value, top + 14, bottom - 8);
    }

    function svgTextBlock(lines, characterWidth, lineHeight) {
      var widestLine = lines.reduce(function (widest, line) {
        return Math.max(widest, line.trim().length * characterWidth);
      }, 0);
      return {
        lines: lines,
        width: widestLine,
        height: 11 + (lines.length - 1) * lineHeight
      };
    }

    function markerAttachedTextPlacement(
      candidates,
      characterWidth,
      lineHeight,
      markerX,
      left,
      right,
      gap
    ) {
      var edgePadding = 4;
      var rightSpace = right - markerX - gap - edgePadding;
      var leftSpace = markerX - left - gap - edgePadding;
      var placement = null;

      candidates.some(function (lines) {
        var block = svgTextBlock(lines, characterWidth, lineHeight);
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
          var block = svgTextBlock(lines, characterWidth, lineHeight);
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
          block: svgTextBlock(fallbackLines, characterWidth, lineHeight),
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

    function chartDescription(current, equilibrium) {
      var span = state.b - state.a;
      var rectangleDescription = current.expectedPayoff < -model.EPSILON ?
        "The red rectangle denotes a negative signed payoff because the " +
          "bid exceeds the value." :
        (Math.abs(current.expectedPayoff) <= model.EPSILON ?
          "The expected-payoff rectangle has zero area." :
          "The shaded rectangle lies under the CDF.");
      return "The first panel plots the PDF of the highest equilibrium bid " +
        "among the other " + (state.n - 1) + " bidder" +
        (state.n - 1 === 1 ? "" : "s") + ". Its area through the proposed " +
        "bid gives the probability of winning, " +
        formatPercent(current.winProbability) + ". The second panel plots the " +
        "probability of winning against bid x subscript 1. A dashed horizontal guide " +
        "marks the selected probability, " +
        formatPercent(current.winProbability) + ". " +
        "The axis marks x subscript 1, payment upon winning, at " +
        formatMoney(current.paymentIfWin, span) +
        ", and brackets v subscript 1 minus x subscript 1, payoff if you win, " +
        "equal to " + formatMoney(current.surplusIfWin, span) +
        ". A rectangle from x subscript 1 to v subscript 1 has probability height " +
        formatPercent(current.winProbability) + ", signed monetary width " +
        formatMoney(state.value - state.bid, span) + ", and signed area equal " +
        "to expected payoff, " + formatMoney(current.expectedPayoff, span) +
        ". " + rectangleDescription + " The maximum occurs at the equilibrium " +
        "bid beta superscript I of v subscript 1, " +
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

    function formatAxisMoney(value) {
      return formatMoney(value, state.b - state.a);
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
