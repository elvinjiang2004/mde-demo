(function () {
  "use strict";

  function create(state, elements, distributionSpec) {
    var auctionControls = window.AuctionControls;
    var model = window.SPAModel;
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

    function drawDiamond(svg, x, y, className) {
      chart.drawDiamond(svg, x, y, className, 8);
    }

    function getChartLayout() {
      return chart.chartLayout(
        elements.chart.parentElement.clientWidth ||
          elements.chart.clientWidth ||
          1000,
        { endpointLabelY: 746 },
        { endpointLabelY: 726 }
      );
    }

    function renderValuePdfPreview() {
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
      var rectangle = elements.chart.getBoundingClientRect();
      if (rectangle.width <= 0) {
        return null;
      }

      var svgX = (event.clientX - rectangle.left) *
        lastChartLayout.width / rectangle.width;
      if (svgX < lastChartLayout.left || svgX > lastChartLayout.right) {
        if (!clampOutside) {
          return null;
        }
        svgX = model.clamp(
          svgX,
          lastChartLayout.left,
          lastChartLayout.right
        );
      }
      var ratio = (svgX - lastChartLayout.left) /
        (lastChartLayout.right - lastChartLayout.left);

      return state.a + ratio * (state.b - state.a);
    }

    function drawChart(current, truthful) {
      var svg = elements.chart;
      var layout = getChartLayout();
      var left = layout.left;
      var right = layout.right;
      var plotWidth = right - left;
      var xSpan = state.b - state.a;
      var densitySamples = sampleDensity(241, current.bid);
      var cdfSamples = sampleCdf(241, current.bid, state.value);
      var densityMax = densityScaleMaximum(densitySamples) * 1.08;

      var densityPanel = {
        top: layout.densityTop,
        height: layout.densityHeight,
        min: 0,
        max: densityMax,
        title: "PDF of highest opposing bid",
        format: formatDensityAxis,
        tickCount: 3
      };
      var cdfPanel = {
        top: layout.cdfTop,
        height: layout.cdfHeight,
        min: 0,
        max: 1,
        title: "Expected payoff",
        format: formatProbabilityAxis,
        tickCount: 4
      };

      lastChartLayout = layout;
      svg.setAttribute(
        "viewBox",
        "0 0 " + layout.width + " " + layout.height
      );
      while (svg.firstChild) {
        svg.removeChild(svg.firstChild);
      }

      appendSvg(svg, "title", { id: "chart-title" },
        "Second-price auction expected payoff by proposed bid");
      appendSvg(svg, "desc", { id: "chart-description" },
        chartDescription(current, truthful));

      drawPanelScaffold(svg, densityPanel, left, right);
      drawPanelScaffold(svg, cdfPanel, left, right);

      var xScale = function (value) {
        return left + ((value - state.a) / xSpan) * plotWidth;
      };

      drawDensityArea(
        svg,
        densitySamples,
        current.bid,
        xScale,
        densityPanel,
        left,
        current.winProbability
      );
      drawCurve(
        svg,
        densitySamples,
        function (point) { return xScale(point.bid); },
        function (point) { return densityY(point.density, densityPanel); },
        "curve highest-bid-density-curve"
      );

      var truthfulX = xScale(truthful.bid);
      appendSvg(svg, "line", {
        x1: truthfulX,
        y1: densityPanel.top,
        x2: truthfulX,
        y2: densityPanel.top + densityPanel.height,
        class: "equilibrium-marker density-equilibrium-marker truthful-marker",
        "data-truthful-bid": truthful.bid
      });
      drawDensityTruthfulAnnotation(
        svg,
        truthfulX,
        densityPanel,
        left,
        right,
        truthful.bid
      );

      var chosenX = xScale(current.bid);
      var densityAtBid = model.highestOpponentBidDensity(
        current.bid,
        state.n,
        state.a,
        state.b,
        distributionSpec()
      );
      drawSelectedMarker(
        svg,
        chosenX,
        densityPanel.top,
        densityPanel.top + densityPanel.height
      );
      drawCircle(
        svg,
        chosenX,
        densityY(densityAtBid, densityPanel),
        "chosen-point"
      );

      drawSecondPricePayoffArea(
        svg,
        current,
        truthful,
        cdfSamples,
        xScale,
        cdfPanel,
        left
      );
      drawCurve(
        svg,
        cdfSamples,
        function (point) { return xScale(point.bid); },
        function (point) { return yScale(point.cdf, cdfPanel); },
        "curve highest-bid-cdf-curve second-price-cdf-curve"
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

      var cdfTop = cdfPanel.top;
      var cdfBottom = cdfPanel.top + cdfPanel.height;
      drawSelectedMarker(svg, chosenX, cdfTop, cdfBottom);
      drawCircle(
        svg,
        chosenX,
        yScale(current.winProbability, cdfPanel),
        "chosen-point selected-cdf-point"
      );

      var truthfulY = yScale(truthful.winProbability, cdfPanel);
      appendSvg(svg, "line", {
        x1: truthfulX,
        y1: cdfTop,
        x2: truthfulX,
        y2: cdfBottom,
        class: "equilibrium-marker truthful-marker",
        "data-truthful-bid": truthful.bid
      });
      drawDiamond(
        svg,
        truthfulX,
        truthfulY,
        "equilibrium-point truthful-point"
      );
      if (Math.abs(current.bid - truthful.bid) <= model.EPSILON) {
        appendSvg(svg, "circle", {
          cx: truthfulX,
          cy: truthfulY,
          r: 3,
          class: "chosen-point coincident-choice-point",
          "data-bid": current.bid,
          "data-truthful-bid": truthful.bid
        });
      }
      drawTruthfulAnnotation(
        svg,
        truthfulX,
        truthfulY,
        cdfPanel,
        left,
        right,
        truthful.bid
      );
      drawAxisChoiceLabels(
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
        y: densityPanel.top,
        width: plotWidth,
        height: cdfBottom - densityPanel.top,
        class: "drag-overlay",
        "aria-hidden": "true"
      });

      drawExpectedPayoffLabel(
        svg,
        current,
        truthful,
        xScale,
        cdfPanel,
        left,
        right,
        layout.compact
      );
      drawProbabilityAreaLabel(
        svg,
        current,
        xScale,
        densityPanel,
        left,
        xScale(Math.min(current.bid, state.b)),
        layout.compact
      );
      drawWinningProbabilityGuideLabel(
        svg,
        current,
        cdfPanel,
        left,
        right,
        layout.compact
      );
    }

    function sampleDensity(count, selectedBid) {
      var points = [];
      var spec = distributionSpec();
      var i;
      for (i = 0; i < count; i += 1) {
        var bid = state.a + (i / (count - 1)) * (state.b - state.a);
        points.push({
          bid: bid,
          density: densityForPlot(bid, spec)
        });
      }
      points.push({
        bid: state.b,
        density: 0
      });
      points.push({
        bid: selectedBid,
        density: densityForPlot(selectedBid, spec)
      });
      points.sort(function (first, second) {
        if (Math.abs(first.bid - second.bid) > model.EPSILON) {
          return first.bid - second.bid;
        }
        return second.density - first.density;
      });
      return uniqueDensityPoints(points);
    }

    function densityForPlot(bid, spec) {
      var density = model.highestOpponentBidDensity(
        bid,
        state.n,
        state.a,
        state.b,
        spec
      );
      if (Number.isFinite(density) && density >= 0) {
        return density;
      }

      var span = state.b - state.a;
      var inwardBid = bid <= state.a + span / 2 ?
        state.a + span / 1000 : state.b - span / 1000;
      density = model.highestOpponentBidDensity(
        inwardBid,
        state.n,
        state.a,
        state.b,
        spec
      );
      return Number.isFinite(density) && density >= 0 ? density : 0;
    }

    function sampleCdf(count, selectedBid, value) {
      var points = [];
      var spec = distributionSpec();
      var i;
      for (i = 0; i < count; i += 1) {
        var bid = state.a + (i / (count - 1)) * (state.b - state.a);
        points.push({
          bid: bid,
          cdf: model.highestOpponentBidCdf(
            bid,
            state.n,
            state.a,
            state.b,
            spec
          )
        });
      }
      [selectedBid, value].forEach(function (bid) {
        points.push({
          bid: bid,
          cdf: model.highestOpponentBidCdf(
            bid,
            state.n,
            state.a,
            state.b,
            spec
          )
        });
      });
      points.sort(function (first, second) { return first.bid - second.bid; });
      return uniqueByBid(points);
    }

    function uniqueDensityPoints(points) {
      return points.filter(function (point, index) {
        if (index === 0) {
          return true;
        }
        var previous = points[index - 1];
        return Math.abs(point.bid - previous.bid) > model.EPSILON ||
          Math.abs(point.density - previous.density) > model.EPSILON;
      });
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
      var selected = points.filter(function (point) {
        return point.bid <= endBid + model.EPSILON;
      });
      var baseY = yScale(0, panel);
      var path = "M " + roundCoordinate(left) + " " + roundCoordinate(baseY);

      selected.forEach(function (point) {
        path += " L " + roundCoordinate(xScale(point.bid)) + " " +
          roundCoordinate(densityY(point.density, panel));
      });
      path += " L " + roundCoordinate(xScale(endBid)) + " " +
        roundCoordinate(baseY) + " Z";

      appendSvg(svg, "path", {
        d: path,
        class: "winning-area",
        "data-start-bid": state.a,
        "data-end-bid": endBid,
        "data-probability": winProbability
      });
    }

    function winProbabilityLabelCandidates(winProbability) {
      var fullLabel = "Probability of winning = " + formatPercent(winProbability);
      return {
        fullLabel: fullLabel,
        lines: [
          [fullLabel],
          ["Probability of winning", "= " + formatPercent(winProbability)],
          ["Probability", "of winning", "= " + formatPercent(winProbability)]
        ]
      };
    }

    function drawProbabilityAreaLabel(
      svg,
      current,
      xScale,
      panel,
      left,
      shadedRight,
      compact
    ) {
      var labelCandidates = winProbabilityLabelCandidates(current.winProbability);
      var fullLabel = labelCandidates.fullLabel;
      var candidates = labelCandidates.lines;
      var availableWidth = shadedRight - left;
      var lineHeight = 13;
      var characterWidth = compact ? 5.4 : 5.8;
      var horizontalPadding = 12;
      var baseY = yScale(0, panel);
      var plotWidth = xScale(state.b) - left;
      var selected = null;
      var widthFits = false;

      candidates.some(function (candidate) {
        var block = svgTextBlock(candidate, characterWidth, lineHeight);
        if (block.width + 2 * horizontalPadding > availableWidth) {
          return false;
        }
        widthFits = true;

        var labelLeft = shadedRight - block.width - horizontalPadding;
        var labelRight = shadedRight - horizontalPadding;
        var minimumHeight = Infinity;
        var sampleCount = 7;
        var sampleIndex;

        for (sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
          var sampleX = labelLeft +
            (sampleIndex / (sampleCount - 1)) * (labelRight - labelLeft);
          var sampleBid = state.a +
            ((sampleX - left) / plotWidth) * (state.b - state.a);
          var sampleDensity = model.highestOpponentBidDensity(
            sampleBid,
            state.n,
            state.a,
            state.b,
            distributionSpec()
          );
          minimumHeight = Math.min(
            minimumHeight,
            baseY - densityY(sampleDensity, panel)
          );
        }

        if (minimumHeight >= block.height + 12) {
          selected = {
            lines: candidate,
            block: block,
            x: (labelLeft + labelRight) / 2,
            y: baseY - 6 - block.height / 2
          };
          return true;
        }
        return false;
      });

      var label;
      if (selected && current.winProbability > model.EPSILON) {
        label = appendSvgTextLines(
          svg,
          selected.x,
          selected.y,
          selected.lines,
          "area-label probability-label annotation-halo",
          "middle",
          lineHeight,
          fullLabel,
          selected.lines.length === 1 ? "inside-single" : "inside-wrapped"
        );
        label.setAttribute("data-placement", "inside");
      } else {
        var plotRight = xScale(state.b);
        var rightSpace = plotRight - shadedRight - horizontalPadding;
        var outsideLines = null;
        var placeRight = true;

        candidates.some(function (candidate) {
          var candidateBlock = svgTextBlock(
            candidate,
            characterWidth,
            lineHeight
          );
          if (candidateBlock.width <= rightSpace) {
            outsideLines = candidate;
            return true;
          }
          return false;
        });

        if (!outsideLines) {
          placeRight = false;
          var leftSpace = shadedRight - left - horizontalPadding;
          candidates.some(function (candidate) {
            var candidateBlock = svgTextBlock(
              candidate,
              characterWidth,
              lineHeight
            );
            if (candidateBlock.width <= leftSpace) {
              outsideLines = candidate;
              return true;
            }
            return false;
          });
        }

        if (!outsideLines) {
          outsideLines = candidates[candidates.length - 1];
        }

        label = appendSvgTextLines(
          svg,
          shadedRight + (placeRight ? horizontalPadding : -horizontalPadding),
          baseY - 10 - ((outsideLines.length - 1) * lineHeight) / 2,
          outsideLines,
          "area-label probability-label annotation-halo",
          placeRight ? "start" : "end",
          lineHeight,
          fullLabel,
          placeRight ? "right-of-highlight" : "left-of-marker"
        );
        label.setAttribute(
          "data-placement",
          placeRight ? "right-of-highlight" : "left-of-marker"
        );
        label.setAttribute("data-vertical-placement", "panel-floor");
        label.setAttribute("data-marker-distance", horizontalPadding);
        label.setAttribute(
          "data-fit-failure",
          widthFits && current.winProbability > model.EPSILON ?
            "height" : "width"
        );
      }
      label.setAttribute("data-probability", current.winProbability);
      label.setAttribute("data-foreground", "true");
    }

    function drawSecondPricePayoffArea(
      svg,
      current,
      truthful,
      points,
      xScale,
      panel,
      left
    ) {
      var baseY = yScale(0, panel);
      var group = appendSvg(svg, "g", {
        class: "spa-payoff-area",
        "data-state": current.bid < state.value - model.EPSILON ?
          "underbid" : (current.bid > state.value + model.EPSILON ?
            "overbid" : "truthful"),
        "data-bid": current.bid,
        "data-value": state.value,
        "data-expected-payoff": current.expectedPayoff,
        "data-truthful-payoff": truthful.expectedPayoff,
        "data-probability": current.winProbability
      });

      if (current.bid <= state.value + model.EPSILON) {
        var selectedPoints = points.filter(function (point) {
          return point.bid <= current.bid + model.EPSILON;
        });
        var positivePath = "M " + roundCoordinate(left) + " " +
          roundCoordinate(baseY);
        selectedPoints.forEach(function (point) {
          positivePath += " L " + roundCoordinate(xScale(point.bid)) + " " +
            roundCoordinate(yScale(point.cdf, panel));
        });
        positivePath += " L " + roundCoordinate(xScale(state.value)) + " " +
          roundCoordinate(yScale(current.winProbability, panel));
        positivePath += " L " + roundCoordinate(xScale(state.value)) + " " +
          roundCoordinate(baseY) + " Z";

        appendSvg(group, "path", {
          d: positivePath,
          class: "spa-payoff-area-positive",
          "data-positive-area": current.expectedPayoff,
          "data-expected-payoff": current.expectedPayoff
        });
      } else {
        var truthfulPoints = points.filter(function (point) {
          return point.bid <= state.value + model.EPSILON;
        });
        var truthfulPath = "M " + roundCoordinate(left) + " " +
          roundCoordinate(baseY);
        truthfulPoints.forEach(function (point) {
          truthfulPath += " L " + roundCoordinate(xScale(point.bid)) + " " +
            roundCoordinate(yScale(point.cdf, panel));
        });
        truthfulPath += " L " + roundCoordinate(xScale(state.value)) + " " +
          roundCoordinate(baseY) + " Z";
        appendSvg(group, "path", {
          d: truthfulPath,
          class: "spa-payoff-area-positive",
          "data-positive-area": truthful.expectedPayoff
        });

        var lossPoints = points.filter(function (point) {
          return point.bid >= state.value - model.EPSILON &&
            point.bid <= current.bid + model.EPSILON;
        }).reverse();
        var lossPath = "M " + roundCoordinate(xScale(state.value)) + " " +
          roundCoordinate(yScale(current.winProbability, panel)) +
          " L " + roundCoordinate(xScale(current.bid)) + " " +
          roundCoordinate(yScale(current.winProbability, panel));
        lossPoints.forEach(function (point) {
          lossPath += " L " + roundCoordinate(xScale(point.bid)) + " " +
            roundCoordinate(yScale(point.cdf, panel));
        });
        lossPath += " Z";

        var loss = truthful.expectedPayoff - current.expectedPayoff;
        appendSvg(group, "path", {
          d: lossPath,
          class: "spa-payoff-area-negative",
          "data-loss-area": loss,
          "data-expected-payoff": current.expectedPayoff
        });
      }

      if (Math.abs(current.expectedPayoff) <= model.EPSILON) {
        appendSvg(group, "circle", {
          cx: xScale(current.bid),
          cy: baseY,
          r: 4,
          class: "zero-expected-payoff",
          "data-expected-payoff": current.expectedPayoff
        });
      }
    }

    function drawExpectedPayoffLabel(
      svg,
      current,
      truthful,
      xScale,
      panel,
      left,
      right,
      compact
    ) {
      var baseY = yScale(0, panel);
      var payoffSign = current.expectedPayoff < -model.EPSILON ?
        "negative" : (current.expectedPayoff > model.EPSILON ?
          "positive" : "zero");
      var negative = payoffSign === "negative";
      var fullLabel = "Expected payoff = " +
        formatMoney(current.expectedPayoff, state.b - state.a);
      var candidates = [
        [fullLabel],
        ["Expected payoff", "= " +
          formatMoney(current.expectedPayoff, state.b - state.a)],
        ["Expected", "payoff", "= " +
          formatMoney(current.expectedPayoff, state.b - state.a)]
      ];
      var lineHeight = 13;
      var characterWidth = compact ? 5.4 : 5.8;
      var horizontalPadding = 9;
      var bidX = xScale(current.bid);
      var valueX = xScale(state.value);
      var overbid = current.bid > state.value + model.EPSILON;
      var lines = null;
      var block = null;
      var labelX;
      var labelY;
      var anchor;
      var placement;
      var widthFits = false;
      var heightFits = false;

      function fitLinesToWidth(width) {
        var match = null;
        candidates.some(function (candidate) {
          var candidateBlock = svgTextBlock(
            candidate,
            characterWidth,
            lineHeight
          );
          if (candidateBlock.width + 2 * horizontalPadding <= width) {
            match = { lines: candidate, block: candidateBlock };
            return true;
          }
          return false;
        });
        return match;
      }

      function placeBesideBid(preferredSide) {
        var sides = preferredSide === "left" ?
          ["left", "right"] : ["right", "left"];
        var match = null;
        var side = sides[0];

        sides.some(function (candidateSide) {
          var available = candidateSide === "right" ?
            right - bidX : bidX - left;
          var candidateMatch = fitLinesToWidth(available);
          if (candidateMatch) {
            side = candidateSide;
            match = candidateMatch;
            return true;
          }
          return false;
        });

        if (!match) {
          side = right - bidX >= bidX - left ? "right" : "left";
          lines = candidates[candidates.length - 1];
          block = svgTextBlock(lines, characterWidth, lineHeight);
        } else {
          lines = match.lines;
          block = match.block;
        }

        labelX = bidX + (side === "right" ?
          horizontalPadding : -horizontalPadding);
        anchor = side === "right" ? "start" : "end";
        placement = side === "right" ?
          "bid-marker-right" : "bid-marker-left";
        return side;
      }

      function keepLabelInPanel(rawY, textBlock) {
        return model.clamp(
          rawY,
          panel.top + textBlock.height / 2 + 8,
          baseY - textBlock.height / 2 - 8
        );
      }

      function placeInPayoffRegion() {
        var regionLeft = negative ? valueX : left;
        var regionRight = negative ? bidX : valueX;
        var regionWidth = regionRight - regionLeft;
        var selectedProbabilityY = yScale(current.winProbability, panel);
        var spec = distributionSpec();
        var selected = null;

        candidates.some(function (candidate) {
          var candidateBlock = svgTextBlock(candidate, characterWidth, lineHeight);
          if (candidateBlock.width + 2 * horizontalPadding > regionWidth) {
            return false;
          }
          // Monotone G makes this edge the tightest vertical clearance:
          // green lies below G; red lies above G and below G(bid).
          var curveX = negative ?
            regionLeft + horizontalPadding + candidateBlock.width :
            regionRight - horizontalPadding - candidateBlock.width;
          var curveBid = state.a + (curveX - left) /
            (right - left) * (state.b - state.a);
          var curveY = yScale(model.highestOpponentBidCdf(
            curveBid, state.n, state.a, state.b, spec
          ), panel);
          var top = negative ? selectedProbabilityY : curveY;
          var bottom = negative ? curveY : baseY;
          selected = { lines: candidate, block: candidateBlock,
            top: top, bottom: bottom };
          return candidateBlock.height + 12 <= bottom - top;
        });

        if (selected) {
          lines = selected.lines;
          block = selected.block;
          labelX = negative ? regionLeft + horizontalPadding :
            regionRight - horizontalPadding;
          anchor = negative ? "start" : "end";
          labelY = keepLabelInPanel((selected.top + selected.bottom) / 2 + 4, block);
          widthFits = true;
          heightFits = block.height + 12 <= selected.bottom - selected.top;
        } else {
          // A vanishing region cannot contain readable text. Keep its label
          // centered on the region as far as the plot boundaries allow.
          lines = candidates[candidates.length - 1];
          block = svgTextBlock(lines, characterWidth, lineHeight);
          labelX = model.clamp((regionLeft + regionRight) / 2,
            left + block.width / 2 + horizontalPadding,
            right - block.width / 2 - horizontalPadding);
          anchor = "middle";
          var truthfulProbabilityY = yScale(truthful.winProbability, panel);
          labelY = keepLabelInPanel((negative ?
            selectedProbabilityY + truthfulProbabilityY :
            truthfulProbabilityY + baseY) / 2, block);
        }
        placement = negative ? "inside-red" : "inside-green";
      }

      if (overbid) {
        placeInPayoffRegion();
      } else {
        var rectangleTop = yScale(current.winProbability, panel);
        var rectangleWidth = valueX - bidX;
        var insideMatch = fitLinesToWidth(rectangleWidth);

        if (insideMatch) {
          lines = insideMatch.lines;
          block = insideMatch.block;
          labelX = (bidX + valueX) / 2;
          labelY = keepLabelInPanel(
            (rectangleTop + baseY) / 2,
            block
          );
          anchor = "middle";
          placement = "inside";
          widthFits = true;
          heightFits = block.height + 12 <= baseY - rectangleTop;
        } else {
          placeBesideBid("right");
          labelY = keepLabelInPanel(
            Math.abs(current.expectedPayoff) <= model.EPSILON ?
              baseY - 50 : (rectangleTop + baseY) / 2,
            block
          );
        }
      }

      var label = appendSvgTextLines(
        svg,
        labelX,
        labelY,
        lines,
        "expected-payoff-label annotation-halo" +
          (negative ? " negative-metric" : ""),
        anchor,
        lineHeight,
        fullLabel,
        placement === "inside" ?
          (lines.length === 1 ? "inside-single" : "inside-wrapped") :
          placement
      );
      label.setAttribute("data-placement", placement);
      if (placement === "bid-marker-left" || placement === "bid-marker-right") {
        label.setAttribute("data-marker-distance", horizontalPadding);
      }
      label.setAttribute("data-payoff-sign", payoffSign);
      label.setAttribute(
        "data-payoff-region",
        negative ? "red" : "green"
      );
      label.setAttribute("data-width-fit", widthFits);
      label.setAttribute("data-height-fit", heightFits);
      if (payoffSign === "zero") {
        label.setAttribute("style", "fill: var(--ink)");
      }
      label.setAttribute("data-expected-payoff", current.expectedPayoff);
      label.setAttribute("data-foreground", "true");
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

      var tickValues = [state.a, state.b];
      tickValues.forEach(function (value, index) {
        var x = xScale(value);
        var anchor = index === 0 ? "start" :
          (index === tickValues.length - 1 ? "end" : "middle");
        appendSvg(svg, "line", {
          x1: x,
          y1: zeroY,
          x2: x,
          y2: zeroY + 6,
          class: "axis-line"
        });
        appendSvg(svg, "text", {
          x: x + (index === 0 ? 2 :
            (index === tickValues.length - 1 ? -2 : 0)),
          y: zeroY + 20,
          class: "axis-text annotation-halo",
          "text-anchor": anchor,
          "data-bid-tick": value
        }, formatAxisMoney(value));
      });
    }

    function drawAxisChoiceLabels(
      svg,
      current,
      xScale,
      zeroY,
      left,
      right,
      layout
    ) {
      var bidX = xScale(current.bid);
      var valueX = xScale(state.value);
      var close = Math.abs(bidX - valueX) < (layout.compact ? 105 : 120);

      if (Math.abs(current.bid - state.value) <= model.EPSILON) {
        appendSvg(svg, "line", {
          x1: bidX,
          y1: zeroY - 9,
          x2: bidX,
          y2: zeroY + 9,
          class: "axis-bid-marker axis-value-marker",
          "data-bid": current.bid,
          "data-value": state.value
        });
        appendSvg(svg, "text", {
          x: bidX,
          y: layout.endpointLabelY,
          class: "axis-bid-label axis-value-label annotation-halo",
          "text-anchor": axisAnchor(bidX, left, right)
        }, "x₁ = v₁ = " + formatMoney(state.value, state.b - state.a));
        return;
      }

      appendSvg(svg, "line", {
        x1: bidX,
        y1: zeroY - 9,
        x2: bidX,
        y2: zeroY + 9,
        class: "axis-bid-marker",
        "data-bid": current.bid
      });
      appendSvg(svg, "line", {
        x1: valueX,
        y1: zeroY - 8,
        x2: valueX,
        y2: zeroY + 8,
        class: "axis-value-marker",
        "data-value": state.value
      });

      var bidDirection = bidX < valueX ? -1 : 1;
      var valueDirection = -bidDirection;
      var bidAnchor = bidDirection < 0 ? "end" : "start";
      var valueAnchor = valueDirection < 0 ? "end" : "start";
      var bidLabelX = bidX + bidDirection * 7;
      var valueLabelX = valueX + valueDirection * 7;

      if (bidLabelX < left + 5) {
        bidAnchor = "start";
        bidLabelX = bidX + 7;
      } else if (bidLabelX > right - 5) {
        bidAnchor = "end";
        bidLabelX = bidX - 7;
      }
      if (valueLabelX < left + 5) {
        valueAnchor = "start";
        valueLabelX = valueX + 7;
      } else if (valueLabelX > right - 5) {
        valueAnchor = "end";
        valueLabelX = valueX - 7;
      }

      appendSvg(svg, "text", {
        x: bidLabelX,
        y: layout.endpointLabelY,
        class: "axis-bid-label annotation-halo",
        "text-anchor": bidAnchor
      }, "x₁ = " + formatMoney(current.bid, state.b - state.a));
      appendSvg(svg, "text", {
        x: valueLabelX,
        y: layout.endpointLabelY + (close ? 15 : 0),
        class: "axis-value-label annotation-halo",
        "text-anchor": valueAnchor
      }, "v₁ = " + formatMoney(state.value, state.b - state.a));
    }

    function axisAnchor(x, left, right) {
      if (x < left + 55) {
        return "start";
      }
      if (x > right - 55) {
        return "end";
      }
      return "middle";
    }

    function drawWinningProbabilityGuideLine(svg, current, selectedX, panel, left) {
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
      left,
      right,
      compact
    ) {
      var guideY = yScale(current.winProbability, panel);
      var labelCandidates = winProbabilityLabelCandidates(current.winProbability);
      var fullLabel = labelCandidates.fullLabel;
      var candidates = labelCandidates.lines;
      var characterWidth = compact ? 5.4 : 5.8;
      var lineHeight = 13;
      var padding = 10;
      var available = right - left - padding * 2;
      var selected = null;

      candidates.some(function (candidate) {
        var block = svgTextBlock(candidate, characterWidth, lineHeight);
        if (block.width <= available) {
          selected = { lines: candidate, block: block };
          return true;
        }
        return false;
      });

      if (!selected) {
        selected = {
          lines: candidates[candidates.length - 1],
          block: svgTextBlock(
            candidates[candidates.length - 1],
            characterWidth,
            lineHeight
          )
        };
      }

      var roomAbove = guideY - panel.top;
      var labelY;
      if (selected.lines.length === 1) {
        labelY = guideY <= panel.top + 18 ? guideY + 17 : guideY - 8;
      } else {
        labelY = roomAbove >= selected.block.height + 18 ?
          guideY - selected.block.height / 2 - 10 :
          guideY + selected.block.height / 2 + 10;
      }
      var label = appendSvgTextLines(
        svg,
        left + padding,
        labelY,
        selected.lines,
        "winning-probability-guide-label annotation-halo",
        "start",
        lineHeight,
        fullLabel,
        "y-axis-right"
      );
      label.setAttribute("data-placement", "y-axis-right");
      label.setAttribute("data-axis-distance", padding);
      label.setAttribute("data-guide-y", guideY);
      label.setAttribute("data-probability", current.winProbability);
      label.setAttribute("data-foreground", "true");
    }

    function drawTruthfulAnnotation(
      svg,
      x,
      y,
      panel,
      left,
      right,
      truthfulBid
    ) {
      var placeLeft = x > left + (right - left) * 0.76;
      var panelBottom = panel.top + panel.height;
      var labelY = y > panelBottom - 32 ? y - 34 : y - 10;
      appendSvg(svg, "text", {
        x: x + (placeLeft ? -10 : 10),
        y: Math.max(panel.top + 15, labelY),
        class: "maximum-label truthful-label annotation-halo",
        "text-anchor": placeLeft ? "end" : "start",
        "data-truthful-bid": truthfulBid
      }, "βᴵᴵ(v₁) = " + formatMoney(truthfulBid, state.b - state.a));
    }

    function drawDensityTruthfulAnnotation(
      svg,
      x,
      panel,
      left,
      right,
      truthfulBid
    ) {
      var placeLeft = x > left + (right - left) * 0.76;
      appendSvg(svg, "text", {
        x: x + (placeLeft ? -10 : 10),
        y: panel.top + 17,
        class: "maximum-label density-equilibrium-label annotation-halo",
        "text-anchor": placeLeft ? "end" : "start",
        "data-panel": "pdf",
        "data-truthful-bid": truthfulBid
      }, "βᴵᴵ(v₁) = " + formatMoney(truthfulBid, state.b - state.a));
    }

    function drawSelectedMarker(svg, x, top, bottom) {
      appendSvg(svg, "line", {
        x1: x,
        y1: top,
        x2: x,
        y2: bottom,
        class: "chosen-marker",
        "data-bid": state.bid
      });
    }

    function svgTextBlock(lines, characterWidth, lineHeight) {
      var maximumLength = lines.reduce(function (maximum, line) {
        return Math.max(maximum, line.length);
      }, 0);
      return {
        width: maximumLength * characterWidth,
        height: lines.length * lineHeight
      };
    }

    function appendSvgTextLines(
      parent,
      x,
      centerY,
      lines,
      className,
      anchor,
      lineHeight,
      ariaLabel,
      layoutName
    ) {
      var text = appendSvg(parent, "text", {
        x: x,
        y: centerY - ((lines.length - 1) * lineHeight) / 2,
        class: className,
        "text-anchor": anchor,
        "aria-label": ariaLabel,
        "data-layout": layoutName
      });
      lines.forEach(function (line, index) {
        appendSvg(text, "tspan", {
          x: x,
          dy: index === 0 ? 0 : lineHeight
        }, line + (index < lines.length - 1 ? " " : ""));
      });
      return text;
    }

    function chartDescription(current, truthful) {
      var span = state.b - state.a;
      var payment = current.expectedPaymentIfWin === null ?
        "undefined at zero winning probability" :
        formatMoney(current.expectedPaymentIfWin, span);
      var areaState = current.bid > state.value + model.EPSILON ?
        "For an overbid, the green and red regions combine to give the " +
          "selected bid's expected payoff." :
        "The green CDF area records the selected bid's expected payoff.";
      return "The first panel shows the density of the highest opposing bid " +
        "and a shaded winning probability of " +
        formatPercent(current.winProbability) + ". The second panel plots its " +
        "CDF against the bid. " + areaState + " The selected bid is " +
        formatMoney(current.bid, span) + ", expected payment conditional on " +
        "winning is " + payment + ", expected payoff is " +
        formatMoney(current.expectedPayoff, span) + ", and the truthful bid " +
        "beta superscript II of v one equals " +
        formatMoney(truthful.bid, span) + ".";
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
      renderValuePdfPreview: renderValuePdfPreview,
      chartPointerToBid: chartPointerToBid,
      distributionSummary: distributionSummary
    });
  }

  window.SecondPriceCharts = Object.freeze({ create: create });
}());
