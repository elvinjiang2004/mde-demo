(function () {
  "use strict";

  var frame = document.getElementById("app-frame");
  var testKeepAlive = window.setInterval(function () {}, 50);
  frame.addEventListener("load", function () {
    waitFor(function () {
      var appDocument = frame.contentDocument;
      return appDocument && appDocument.querySelector(
        "#buyer-ic-chart image[data-renderer='payoff-raster']"
      ) && appDocument.querySelector(
        "#efficiency-chart image[data-renderer='diagnostic-raster']"
      ) && appDocument.querySelector(
        ".diagnostic-panel-grid .math-chart-axis-label mjx-container"
      );
    }, 10000).then(runTests).catch(function (error) {
      addResult("The bilateral-trade interface initializes before its tests", error);
      var summary = document.getElementById("summary");
      summary.textContent = "The interface tests could not start.";
      summary.className = "fail";
      document.body.dataset.status = "failed";
      document.title = "FAIL — Bilateral-trade interface tests";
      window.clearInterval(testKeepAlive);
    });
  });

  function assert(condition, message) {
    if (!condition) {
      throw new Error(message || "Assertion failed.");
    }
  }

  function assertClose(actual, expected, message, tolerance) {
    var allowed = tolerance === undefined ? 1e-6 : tolerance;
    if (!Number.isFinite(actual) || Math.abs(actual - expected) > allowed) {
      throw new Error(
        (message || "Values differ.") +
        " Expected " + expected + ", received " + actual + "."
      );
    }
  }

  function waitFor(predicate, timeout) {
    var started = Date.now();
    return new Promise(function (resolve, reject) {
      function check() {
        if (predicate()) {
          resolve();
        } else if (Date.now() - started >= timeout) {
          reject(new Error("Timed out waiting for the bilateral-trade interface."));
        } else {
          window.setTimeout(check, 25);
        }
      }
      check();
    });
  }

  function dispatchChange(element, appWindow) {
    element.dispatchEvent(new appWindow.Event("change", { bubbles: true }));
  }

  function dispatchInput(element, appWindow) {
    element.dispatchEvent(new appWindow.Event("input", { bubbles: true }));
  }

  function addResult(name, error) {
    var item = document.createElement("li");
    item.className = error ? "fail" : "pass";
    item.textContent = (error ? "FAIL — " : "PASS — ") + name +
      (error ? ": " + error.message : "");
    document.getElementById("results").appendChild(item);
  }

  async function runTests() {
    var appDocument = frame.contentDocument;
    var appWindow = frame.contentWindow;
    var model = appWindow.BilateralTradeModel;

    function numericSvgAttributes(chart) {
      var names = [
        "x", "x1", "x2", "y", "y1", "y2", "cx", "cy",
        "width", "height", "r", "d", "points", "transform"
      ];
      return Array.from(chart.querySelectorAll("*")).map(function (element) {
        return names.map(function (name) {
          return element.getAttribute(name) || "";
        }).join(" ");
      }).join(" ");
    }

  function paintEntireGrid(value) {
      var chart = appDocument.getElementById("paint-chart");
      var slider = appDocument.getElementById("brush-value-slider");
      var rect = chart.getBoundingClientRect();
      var viewWidth = chart.viewBox.baseVal.width;
      var viewHeight = chart.viewBox.baseVal.height;
      var left = 50;
      var right = 450;
      var top = 40;
      var bottom = 440;
      var R = model.CELL_RESOLUTION;

      slider.value = String(value);
      dispatchInput(slider, appWindow);

      function clientOf(svgX, svgY) {
        return {
          x: rect.left + (svgX / viewWidth) * rect.width,
          y: rect.top + (svgY / viewHeight) * rect.height
        };
      }

      function centroidClient(i, j, isLower) {
        var cell = (right - left) / R;
        var svgX = left + (i + (isLower ? 2 / 3 : 1 / 3)) * cell;
        var svgY = bottom - (j + (isLower ? 1 / 3 : 2 / 3)) *
          ((bottom - top) / R);
        return clientOf(svgX, svgY);
      }

      var first = centroidClient(0, 0, true);
      firePointer(chart, "pointerdown", first.x, first.y, 91);
      var i;
      var j;
      for (i = 0; i < R; i += 1) {
        for (j = 0; j < R; j += 1) {
          var lowerPoint = centroidClient(i, j, true);
          firePointer(chart, "pointermove", lowerPoint.x, lowerPoint.y, 91);
          var upperPoint = centroidClient(i, j, false);
          firePointer(chart, "pointermove", upperPoint.x, upperPoint.y, 91);
        }
      }
      firePointer(chart, "pointerup", first.x, first.y, 91);
    }

  function firePointer(chart, type, clientX, clientY, pointerId) {
    chart.setPointerCapture = function () {};
    chart.hasPointerCapture = function () { return false; };
    chart.releasePointerCapture = function () {};
    chart.dispatchEvent(new appWindow.PointerEvent(type, {
        bubbles: true,
        clientX: clientX,
        clientY: clientY,
        pointerId: pointerId
      }));
    }

    var tests = [
      {
        name: "The bilateral-trade route loads local MathJax before the module scripts",
        run: function () {
          var sources = Array.from(appDocument.querySelectorAll("head > script[defer]"))
            .map(function (script) { return script.getAttribute("src"); });
          assert(JSON.stringify(sources) === JSON.stringify([
            "../../js/components.js",
            "../../js/mathjax-config.js",
            "../../assets/mathjax/tex-svg.js",
            "../../js/mathjax-runtime.js",
            "../../js/math-utils.js",
            "../../js/svg-utils.js",
            "../../js/bilateral-trade-envelope.js",
            "../../js/bilateral-trade-visuals.js",
            "../../js/equation-chain.js",
            "model.js",
            "app.js"
          ]), "Shared components and local MathJax should load before the " +
            "module-specific scripts.");
          assert(sources.every(function (source) {
            return source && !/^https?:/i.test(source);
          }), "Every script should remain local for offline file use.");
          assert(appWindow.MathJax && /^4\./.test(appWindow.MathJax.version) &&
            typeof appWindow.MathJax.typesetPromise === "function",
          "The local MathJax 4 SVG renderer should be available.");
          assert(appWindow.MechanismMath &&
            typeof appWindow.MechanismMath.typesetInitial === "function" &&
            typeof appWindow.MechanismMath.setText === "function" &&
            appWindow.mechanismMathReady &&
            typeof appWindow.mechanismMathReady.then === "function",
          "The shared MathJax lifecycle and readiness promise should be available.");
          assert(appWindow.BilateralTradeVisuals &&
            typeof appWindow.BilateralTradeVisuals.bindProbeChart === "function" &&
            typeof appWindow.BilateralTradeVisuals.drawProbeScaffold === "function",
          "The shared bilateral-trade visual pipeline should be available.");
          assert(model && typeof model.summarize === "function",
            "BilateralTradeModel should be available to the page.");
          assert(appWindow.FPAModel === undefined && appWindow.SPAModel === undefined,
            "The bilateral-trade page should not load an auction model.");
          assert(appDocument.querySelector(".wordmark").getAttribute("href") ===
            "../../index.html",
          "The wordmark should link back to the root menu.");
          assert(appDocument.querySelector('link[rel="stylesheet"]')
            .getAttribute("href") === "../../styles.css",
          "The module should use the shared root stylesheet.");
        }
      },
      {
        name: "The shared triangle mesh preserves geometry, orientation, and pointer clamping",
        run: function () {
          var mesh = appWindow.SvgUtils.createTriangleMesh(model.CELL_RESOLUTION);
          var layout = {
            viewWidth: 480,
            viewHeight: 520,
            left: 50,
            right: 450,
            top: 40,
            bottom: 440
          };
          var svgStub = {
            getBoundingClientRect: function () {
              return { left: 0, top: 0, width: 480, height: 520 };
            }
          };

          function eventAt(v, c) {
            return {
              clientX: layout.left + v * (layout.right - layout.left),
              clientY: layout.bottom - c * (layout.bottom - layout.top)
            };
          }

          var lower = mesh.pointerToTriangle(
            svgStub, eventAt((6 + 2 / 3) / 20, (5 + 1 / 3) / 20), layout
          );
          var upper = mesh.pointerToTriangle(
            svgStub, eventAt((6 + 1 / 3) / 20, (5 + 2 / 3) / 20), layout
          );
          var diagonal = mesh.pointerToTriangle(
            svgStub, eventAt(0.025, 0.025), layout
          );
          var outside = mesh.pointerToTriangle(
            svgStub, { clientX: 580, clientY: 240 }, layout
          );

          assert(Object.isFrozen(mesh), "The configured mesh API should be immutable.");
          assert(lower.i === 6 && lower.j === 5 && lower.isLower && lower.insidePlot,
            "A lower-right centroid should select its R triangle.");
          assert(upper.i === 6 && upper.j === 5 && !upper.isLower && upper.insidePlot,
            "An upper-left centroid should select its L triangle.");
          assert(diagonal.i === 0 && diagonal.j === 0 && diagonal.isLower,
            "An exact diagonal tie should select the lower-right triangle.");
          assert(outside.i === 19 && !outside.insidePlot,
            "An off-plot pointer should clamp to the boundary while reporting outside.");

          var single = appWindow.SvgUtils.createTriangleMesh(1);
          var svg = appDocument.createElementNS("http://www.w3.org/2000/svg", "svg");
          var seen = [];
          single.drawTriangleMesh(svg, {
            lower: [[0.25]],
            upper: [[0.75]]
          }, {
            viewWidth: 100,
            viewHeight: 100,
            left: 0,
            right: 100,
            top: 0,
            bottom: 100
          }, function (value, i, j, isLower) {
            seen.push([value, i, j, isLower].join(":"));
            return isLower ? "red" : "blue";
          });

          var polygons = svg.querySelectorAll("polygon");
          assert(polygons.length === 2 &&
            polygons[0].getAttribute("points") === "0,100 100,100 100,0" &&
            polygons[1].getAttribute("points") === "0,100 0,0 100,0",
          "The renderer should preserve lower-right then upper-left geometry.");
          assert(seen.join("|") === "0.25:0:0:true|0.75:0:0:false",
            "The renderer should pass each triangle's value, indices, and side.");
        }
      },
      {
        name: "The user-authored introduction, empty Notes, and requested reference are present",
        run: function () {
          var introduction = appDocument.querySelector(".introduction");
          assert(introduction && introduction.querySelector("h1") &&
            introduction.querySelector("h1").textContent ===
              "The Myerson-Satterthwaite Theorem",
          "The page should use the requested theorem title.");
          assert(introduction.querySelectorAll(":scope > p").length === 3 &&
            introduction.querySelectorAll(":scope > ol > li").length === 4,
          "The supplied introduction should retain its three prose blocks and four conditions.");
          assert(introduction.querySelectorAll('mjx-container[jax="SVG"]').length > 0,
            "The introduction's mathematical notation should render with MathJax.");
          var notes = Array.from(appDocument.querySelectorAll(".notes-list li"));
          assert(notes.length > 0, "The Notes list should carry its authored bullets.");
          assert(notes.every(function (note) {
            return note.textContent.trim().length > 0;
          }), "No Notes bullet should be empty.");
          var references = Array.from(
            appDocument.querySelectorAll(".reference-list li")
          );
          assert(references.length === 4,
            "References should list the four requested works.");
          var referenceText = references.map(function (item) {
            return item.textContent;
          }).join(" ");
          assert(/Myerson/.test(referenceText) &&
            /Satterthwaite/.test(referenceText) &&
            appDocument.querySelector(
              '.reference-list a[href="https://doi.org/10.1016/0022-0531(83)90048-0"]'
            ),
          "References should contain the requested 1983 Myerson-Satterthwaite paper.");
          assert(/Börgers/.test(referenceText) &&
            /Krähmer/.test(referenceText) && /Strausz/.test(referenceText) &&
            /An Introduction to the Theory of Mechanism Design/.test(referenceText) &&
            /63–71/.test(referenceText),
          "References should contain the requested Börgers mechanism-design " +
            "text, cited to its pages 63-71.");
          assert(/Norman/.test(referenceText) &&
            /budget balance under/.test(referenceText) &&
            appDocument.querySelector(
              '.reference-list a[href="https://doi.org/10.1007/s00199-008-0347-7"]'
            ),
          "References should contain the requested Börgers-Norman budget-balance note.");
          assert(/Milgrom/.test(referenceText) && /Segal/.test(referenceText) &&
            /Envelope Theorems for Arbitrary\s+Choice Sets/.test(referenceText) &&
            appDocument.querySelector(
              '.reference-list a[href="https://doi.org/10.1111/1468-0262.00296"]'
            ),
          "References should contain Milgrom-Segal (2002), which the proof " +
            "cites in text for its Corollary 1.");
        }
      },
      {
        name: "No visible raw TeX delimiters remain after initial typesetting",
        run: function () {
          assert(!/\\\(|\\\[/.test(appDocument.body.textContent),
            "Initial HTML mathematics should render without visible raw delimiters.");
          assert(appDocument.querySelectorAll(
            ".explorable mjx-container[jax=\"SVG\"]"
          ).length > 0,
          "The diagnostic figure captions should render as MathJax.");
          var mixedPlotLabels = [
            appDocument.getElementById("paint-chart")
              .closest("figure").querySelector("figcaption"),
            appDocument.querySelector(".chart-480x520-x-axis-label"),
            appDocument.querySelector(".chart-480x520-y-axis-label")
          ];
          mixedPlotLabels.forEach(function (label) {
            assert(label && label.firstChild &&
              label.firstChild.nodeType === 3 &&
              /, $/.test(label.firstChild.nodeValue),
            "Every mixed plot label should separate its plain text and math " +
              "with a comma and a space.");
            assert(label.querySelector('mjx-container[jax="SVG"]'),
              "Every mixed plot label should render its notation with MathJax.");
          });
          var plainTextCaptions = [
            { id: "buyer-ic-chart", text: "Buyer IC" },
            { id: "seller-ic-chart", text: "Seller IC" },
            { id: "revenue-chart", text: "Net revenue" },
            { id: "buyer-payoff-chart", text: "Buyer IR" },
            { id: "seller-payoff-chart", text: "Seller IR" },
            { id: "efficiency-chart", text: "Efficiency" }
          ];
          plainTextCaptions.forEach(function (entry) {
            var label = appDocument.getElementById(entry.id)
              .closest("figure").querySelector("figcaption");
            assert(label.textContent === entry.text,
              "The " + entry.id + " figcaption should stay plain text with no math.");
            assert(!label.querySelector('mjx-container[jax="SVG"]'),
              "The " + entry.id + " figcaption should not render any MathJax notation.");
          });
          var labeledAxes = Array.from(appDocument.querySelectorAll(
            ".chart-220x240-x-axis-label, " +
            ".chart-220x240-y-axis-label"
          ));
          assert(labeledAxes.length === 12,
            "Each of the six diagnostic plots should have both labeled axes.");
          labeledAxes.forEach(function (label) {
            assert(label.querySelectorAll('mjx-container[jax="SVG"]').length === 1,
              "Each diagnostic axis should have one MathJax rendering.");
            assert(label.firstChild && label.firstChild.nodeType === 3 &&
              /, $/.test(label.firstChild.nodeValue),
            "Each diagnostic axis should separate its full text label and notation " +
              "with a comma and a space.");
          });
          var cellControlLabel = appDocument
            .getElementById("brush-value-control-label");
          assert(cellControlLabel.querySelector('mjx-container[jax="SVG"]'),
            "The static control label's q should render as MathJax.");
          assert(!/\\\(/.test(cellControlLabel.textContent),
            "The control label should retain no raw TeX delimiter.");
          assert(cellControlLabel.firstChild &&
            cellControlLabel.firstChild.nodeType === 3 &&
            /, $/.test(cellControlLabel.firstChild.nodeValue),
          "The control label should follow the site's comma-space " +
            "convention before its notation.");
          assert(appDocument.getElementById("brush-value-slider")
            .getAttribute("aria-valuetext").startsWith("Brush q = "),
          "The slider's accessible value text should identify the brush rather " +
            "than the selected triangle's current value.");
          assert(!appDocument.querySelector("#paint-chart .panel-caption") &&
            !appDocument.querySelector("#paint-chart .axis-title"),
          "The main plot's mixed title and axes should live outside its SVG.");
          assert(appDocument.getElementById("paint-chart-title").textContent ===
            "Allocation rule, q(v,c)",
          "The main plot's accessible title should mirror the comma-space convention.");
          var paintRect = appDocument.getElementById("paint-chart")
            .getBoundingClientRect();
          var xAxisRect = appDocument.querySelector(".chart-480x520-x-axis-label")
            .getBoundingClientRect();
          var yAxisRect = appDocument.querySelector(".chart-480x520-y-axis-label")
            .getBoundingClientRect();
          var mainLabelLeft = paintRect.left + 40 / 480 * paintRect.width;
          var mainLabelWidth = 440 / 480 * paintRect.width;
          assertClose(xAxisRect.left, mainLabelLeft,
            "The HTML buyer-value axis label should keep its established inset.", 1);
          assertClose(xAxisRect.width, mainLabelWidth,
            "The HTML buyer-value axis label should keep its established span.", 1);
          assert(yAxisRect.left >= paintRect.left &&
            yAxisRect.right <= paintRect.right &&
            yAxisRect.top >= paintRect.top &&
            yAxisRect.bottom <= paintRect.bottom,
          "The rotated seller-cost axis label should remain inside the main plot.");
          [
            "buyer-ic-chart", "seller-ic-chart", "buyer-payoff-chart",
            "seller-payoff-chart", "revenue-chart", "efficiency-chart"
          ].forEach(function (id) {
            var chart = appDocument.getElementById(id);
            var chartRect = chart.getBoundingClientRect();
            var frame = chart.closest(".math-chart-frame");
            var xRect = frame.querySelector(".chart-220x240-x-axis-label")
              .getBoundingClientRect();
            var yRect = frame.querySelector(".chart-220x240-y-axis-label")
              .getBoundingClientRect();
            assertClose(xRect.left, chartRect.left,
              "Chart " + id + "'s x label should keep its full-width span.", 1);
            assertClose(xRect.width, chartRect.width,
              "Chart " + id + "'s x label should span the chart.", 1);
            assert(yRect.left >= chartRect.left && yRect.right <= chartRect.right &&
              yRect.top >= chartRect.top && yRect.bottom <= chartRect.bottom,
            "Chart " + id + "'s y label should stay inside its plot.");
          });
          assert(appDocument.querySelectorAll(".explorable svg .axis-title").length === 0,
            "No static bilateral axis title should remain inside an SVG.");
        }
      },
      {
        name: "The diagnostic panels carry no explanatory prose or formulas",
        run: function () {
          assert(!appDocument.querySelector(
            ".diagnostic-panel-grid .equation-display"
          ),
            "The diagnostics area should not contain formula blocks.");
          assert(appDocument.querySelectorAll(".diagnostic-panel-grid").length === 1 &&
            appDocument.querySelectorAll(".diagnostic-panel-grid > .diagnostic-panel")
              .length === 6,
          "The diagnostics area should be exactly six compact panels.");
          assert(!appDocument.querySelector(".diagnostic-panel-grid h2") &&
            !appDocument.querySelector(".diagnostic-panel-grid h3"),
          "The diagnostics area should not carry section headings.");
        }
      },
      {
        name: "All six diagnostics render exact model-evaluated fields through compact rasters",
        run: function () {
          assert(typeof appWindow.SvgUtils.createFieldRaster === "function",
            "The exact field-raster helper should be shared through SvgUtils.");
          ["buyer-ic-chart", "seller-ic-chart"].forEach(function (id) {
            var chart = appDocument.getElementById(id);
            var image = chart.querySelector("image[data-renderer='payoff-raster']");
            assert(image && image.dataset.rasterSize === "330" &&
              image.getAttribute("href").indexOf("data:image/png") === 0,
            id + " should render exact interim deviation payoffs.");
            assert(chart.querySelector(".truthful-report-line") &&
              chart.querySelector(".best-report-line"),
            id + " should overlay truthful and exact best-report traces.");
          });
          ["buyer-payoff-chart", "seller-payoff-chart", "revenue-chart",
            "efficiency-chart"]
            .forEach(function (id) {
              var chart = appDocument.getElementById(id);
              var image = chart.querySelector("image[data-renderer='diagnostic-raster']");
              assert(image && image.dataset.rasterSize === "330" &&
                image.getAttribute("href").indexOf("data:image/png") === 0,
              id + " should render one exact model-evaluated field raster.");
              assert(chart.querySelectorAll("polygon[fill]").length === 0,
                id + " should not flatten its field to one value per triangle.");
            });
          ["buyer-ic-chart", "seller-ic-chart", "buyer-payoff-chart",
            "seller-payoff-chart"].forEach(function (id) {
              var chart = appDocument.getElementById(id);
              assert(chart.dataset.colorLow === "blue" &&
                chart.dataset.colorZero === "clear" &&
                chart.dataset.colorHigh === "yellow",
              id + " should use the sandbox blue-clear-yellow utility scale.");
            });
          var revenue = appDocument.getElementById("revenue-chart");
          assert(revenue.dataset.colorLow === "red" &&
            revenue.dataset.colorZero === "clear" &&
            revenue.dataset.colorHigh === "green" &&
            revenue.querySelector("desc").textContent.includes("clear at zero"),
          "M-S revenue should use the sandbox red-clear-green scale.");
        }
      },
      {
        name: "The allocation and all six diagnostics expose exact compact probes",
        run: function () {
          var paintChart = appDocument.getElementById("paint-chart");
          var paintRect = paintChart.getBoundingClientRect();
          var paintX = paintRect.left + (50 + 0.25 * 400) / 480 * paintRect.width;
          var paintY = paintRect.top + (440 - 0.75 * 400) / 520 * paintRect.height;
          firePointer(paintChart, "pointermove", paintX, paintY, 119);
          var allocationProbe = paintChart.querySelector(".allocation-probe");
          assert(allocationProbe && allocationProbe.querySelector(
            ".plot-probe-text"
          ).textContent === "q=0.000",
          "The allocation hover box should contain only its exact three-decimal q value.");
          assert(Array.from(allocationProbe.querySelectorAll(
            ".plot-probe-coordinate"
          )).map(function (node) { return node.textContent; }).join(",") ===
            "0.250,0.750",
          "The allocation probe should put its three-decimal coordinates by the axes.");
          assert(paintChart.getAttribute("aria-describedby") ===
            "diagnostic-probe-help" &&
            paintChart.getAttribute("aria-keyshortcuts").indexOf("Escape") >= 0,
          "The allocation probe should share the page's accessible probe instructions.");

          var entries = [
            { id: "buyer-ic-chart", symbol: "U", subscript: "B" },
            { id: "seller-ic-chart", symbol: "U", subscript: "S" },
            { id: "revenue-chart", symbol: "Rev" },
            { id: "buyer-payoff-chart", symbol: "u", subscript: "B" },
            { id: "seller-payoff-chart", symbol: "u", subscript: "S" },
            { id: "efficiency-chart", symbol: "Loss" }
          ];
          entries.forEach(function (entry, index) {
            var chart = appDocument.getElementById(entry.id);
            var rect = chart.getBoundingClientRect();
            var clientX = rect.left + (35 + 0.25 * 165) / 220 * rect.width;
            var clientY = rect.top + (180 - 0.75 * 165) / 240 * rect.height;
            firePointer(chart, "pointermove", clientX, clientY, 120 + index);
            var probe = chart.querySelector(".diagnostic-probe");
            var output = probe && probe.querySelector(".plot-probe-text");
            var coordinates = probe && probe.querySelectorAll(
              ".plot-probe-coordinate"
            );
            assert(probe && output,
              entry.id + " should reveal one compact output probe on pointer movement.");
            assert(output.firstChild.textContent === entry.symbol,
              entry.id + " should use the requested output symbol in its hover box.");
            if (entry.subscript) {
              assert(output.querySelector(".plot-probe-subscript").textContent ===
                entry.subscript,
              entry.id + " should render the payoff agent as a native SVG subscript.");
            }
            assert(/^[-A-Za-z]+[BS]?=-?\d+\.\d{3}$/.test(output.textContent),
              entry.id + " should show only its output, rounded to three decimals.");
            assert(coordinates.length === 2 &&
              coordinates[0].textContent === "0.250" &&
              coordinates[1].textContent === "0.750",
            entry.id + " should put its three-decimal coordinates beside the axes.");
            assert(chart.getAttribute("tabindex") === "0" &&
              chart.getAttribute("aria-describedby") === "diagnostic-probe-help",
            entry.id + " should expose the same probe through keyboard focus.");
          });

          var buyerChart = appDocument.getElementById("buyer-ic-chart");
          var expected = model.buyerInterimDeviationUtility(
            model.summarize(model.efficientGrid()).interim, 0.25, 0.75
          );
          assert(buyerChart.querySelector(".plot-probe-text").textContent ===
            "UB=" + (Math.abs(expected) < 1e-9 ? 0 : expected).toFixed(3),
          "The buyer IC probe should evaluate the exact interim payoff at the cursor.");
          buyerChart.focus();
          buyerChart.dispatchEvent(new appWindow.KeyboardEvent("keydown", {
            key: "ArrowRight", bubbles: true, cancelable: true
          }));
          assert(buyerChart.querySelectorAll(".plot-probe-coordinate")[0]
            .textContent === "0.260",
          "ArrowRight should move the focused probe by one hundredth.");
        }
      },
      {
        name: "The default view paints the efficient benchmark",
        run: function () {
          var expected = model.summarize(model.efficientGrid());
          var buyerIc = appDocument.getElementById("buyer-ic-text");
          var sellerIc = appDocument.getElementById("seller-ic-text");
          var efficiency = appDocument.getElementById("efficiency-text");
          assert(buyerIc.dataset.icImplementable === "true" &&
            sellerIc.dataset.icImplementable === "true",
          "The efficient benchmark is IC-implementable.");
          assert(buyerIc.dataset.buyerIcViolationCount === "0" &&
            sellerIc.dataset.sellerIcViolationCount === "0",
          "The efficient benchmark should have zero interim-monotonicity violations.");
          assertClose(Number(efficiency.dataset.efficiencyLoss), 0,
            "Efficiency loss should be zero at the efficient benchmark.", 1e-6);
          assertClose(Number(efficiency.dataset.welfare),
            expected.verdicts.welfare,
            "Displayed welfare should match the model.", 1e-6);
          var revenue = appDocument.getElementById("revenue-text");
          assert(revenue.dataset.exPostBudgetBalanced === "false",
            "The efficient benchmark should not be ex-post budget balanced.");
          assertClose(Number(revenue.dataset.expectedRevenue),
            expected.verdicts.expectedRevenue,
            "Displayed expected revenue should match the model.", 1e-6);
          assert(expected.verdicts.expectedRevenue < -0.05,
            "The efficient benchmark should run a meaningful expected deficit.");
        }
      },
      {
        name: "No preset or reset controls remain on the page",
        run: function () {
          assert(!appDocument.querySelector(".preset-buttons") &&
            !appDocument.getElementById("reset-button"),
          "The preset row and a reset button should both be absent.");
          [
            "preset-efficient", "preset-always", "preset-never",
            "preset-posted-price", "preset-chatterjee", "preset-random"
          ].forEach(function (id) {
            assert(!appDocument.getElementById(id),
              "Preset control " + id + " should no longer exist.");
          });
          assert(!appDocument.getElementById("posted-price-control") &&
            !appDocument.getElementById("posted-price-slider") &&
            !appDocument.getElementById("posted-price-number"),
          "The posted-price control belonged to a preset and should be gone.");
          var controls = appDocument.querySelector(".choice-controls");
          assert(controls.querySelectorAll(".range-group").length === 1,
            "Only the allocation-brush control should remain.");
          assert(controls.querySelectorAll("button").length === 0,
            "The painting controls should offer no buttons at all.");
        }
      },
      {
        name: "The main column and diagnostic grid sit side by side with a compact q slider",
        run: function () {
          (function () {
            var mainColumn = appDocument.querySelector(".main-column-480");
            var grid = appDocument.querySelector(".diagnostic-panel-grid");
            assert(mainColumn && mainColumn.contains(
              appDocument.getElementById("paint-chart")
            ) && mainColumn.contains(
              appDocument.getElementById("brush-value-slider")
            ), "The main column should hold both the paint chart and its controls.");
            assert(grid && appWindow.getComputedStyle(grid).display === "grid",
              "The six diagnostic panels should be arranged in a grid.");

            var layout = appDocument.querySelector(".main-diagnostic-layout");
            assert(layout.contains(mainColumn) && layout.contains(grid) &&
              mainColumn.compareDocumentPosition(grid) &
                appWindow.Node.DOCUMENT_POSITION_FOLLOWING,
            "The diagnostic grid should follow the main column (to its right on wide screens).");

            var slider = appDocument.getElementById("brush-value-slider");
            var sliderMaxWidth = parseFloat(
              appWindow.getComputedStyle(slider).maxWidth
            );
            var chartMaxWidth = parseFloat(
              appWindow.getComputedStyle(appDocument.getElementById("paint-chart"))
                .maxWidth
            );
            assert(Number.isFinite(sliderMaxWidth) &&
              sliderMaxWidth < chartMaxWidth,
            "The q slider should be visually much smaller than the main chart.");
          }());
        }
      },
      {
        name: "The diagnostic plots form a three-column by two-row wide-screen grid",
        run: function () {
          (function () {
            var panels = Array.from(appDocument.querySelectorAll(
              ".diagnostic-panel-grid > .diagnostic-panel"
            ));
            assert(panels.length === 6, "There should be six diagnostic panels.");
            var panelIds = panels.map(function (panel) {
              return panel.querySelector(".diagnostic-chart").id;
            });
            assert(JSON.stringify(panelIds) === JSON.stringify([
              "buyer-ic-chart", "seller-ic-chart", "revenue-chart",
              "buyer-payoff-chart", "seller-payoff-chart", "efficiency-chart"
            ]),
            "The diagnostics should run left-to-right, top-to-bottom as Buyer IC, " +
              "Seller IC, Net revenue, Buyer IR, Seller IR, and Efficiency.");

            var grid = appDocument.querySelector(".diagnostic-panel-grid");
            var columns = appWindow.getComputedStyle(grid)
              .gridTemplateColumns.split(" ").length;
            var rows = appWindow.getComputedStyle(grid)
              .gridTemplateRows.split(" ").length;
            assert(columns === 3 && rows === 2,
              "The six plots should form exactly three columns and two rows at the test width.");

            var layout = appDocument.querySelector(".main-diagnostic-layout");
            var contentWidth = appDocument.querySelector("main.page-width")
              .getBoundingClientRect().width;
            assert(Math.abs(layout.getBoundingClientRect().width - contentWidth) < 1,
              "The interactive demo should use the auction pages' full shared content width.");
          }());
        }
      },
      {
        name: "Payoff text reports expected payoff, always green since IR cannot fail",
        run: function () {
          (function () {
            var buyerPayoff = appDocument.getElementById("buyer-payoff-text");
            var sellerPayoff = appDocument.getElementById("seller-payoff-text");
            assert(buyerPayoff.textContent.includes("Expected buyer payoff") &&
              sellerPayoff.textContent.includes("Expected seller payoff"),
            "The payoff panels should report expected payoff, since the " +
              "minimum is always exactly zero and never fails.");
            assert(!buyerPayoff.textContent.includes("Never negative") &&
              !buyerPayoff.textContent.includes("Negative somewhere"),
            "The dead never-negative wording should be gone.");
            assert(buyerPayoff.querySelector("p").className === "verdict-pass" &&
              sellerPayoff.querySelector("p").className === "verdict-pass",
            "Expected-payoff lines are always the pass color, since ex-post " +
              "IR holds automatically for any q in [0,1].");
          }());
        }
      },
      {
        name: "The brush slider and number input stay synchronized without editing a triangle",
        run: function () {
          (function () {
            var slider = appDocument.getElementById("brush-value-slider");
            var number = appDocument.getElementById("brush-value-number");
            var label = appDocument.getElementById("brush-value-control-label");
            var beforeFills = Array.from(appDocument.querySelectorAll(
              "#paint-chart polygon[fill]"
            )).map(function (polygon) { return polygon.getAttribute("fill"); }).join("|");

            assert(/^Allocation brush,\s*$/.test(label.firstChild.nodeValue),
              "The static control label should identify the allocation brush.");
            assert(slider.getAttribute("aria-valuetext").startsWith("Brush q = "),
              "The slider should announce the brush rather than a selected value.");

            slider.value = "0.73";
            dispatchInput(slider, appWindow);
            assert(number.value === "0.73",
              "Typing the slider should update the number field.");

            number.value = "0.2";
            dispatchChange(number, appWindow);
            assert(slider.value === "0.2",
              "Changing the number field should update the slider.");
            assert(Array.from(appDocument.querySelectorAll(
              "#paint-chart polygon[fill]"
            )).map(function (polygon) { return polygon.getAttribute("fill"); }).join("|") ===
              beforeFills,
            "Changing the allocation brush alone should not edit any triangle.");

            number.value = "not-a-number";
            dispatchChange(number, appWindow);
            assert(number.value === "0.20",
              "An invalid typed value should revert to the last valid choice.");
          }());
        }
      },
      {
        name: "Keyboard selection moves independently of the allocation brush",
        run: function () {
          (function () {
            var chart = appDocument.getElementById("paint-chart");
            var slider = appDocument.getElementById("brush-value-slider");
            var staticLabel = appDocument.getElementById("brush-value-control-label")
              .textContent;
            var before = slider.getAttribute("aria-valuetext");

            chart.dispatchEvent(new appWindow.KeyboardEvent("keydown", {
              key: "ArrowRight", bubbles: true, cancelable: true
            }));
            assert(slider.getAttribute("aria-valuetext") === before,
              "ArrowRight should move the selected cell without changing the brush.");
            assert(chart.querySelector(".cell-label"),
              "An in-graph label should identify the selected cell.");

            chart.dispatchEvent(new appWindow.KeyboardEvent("keydown", {
              key: "Home", bubbles: true, cancelable: true
            }));
            assert(chart.querySelector(".cell-label").textContent.startsWith("[0.00, 0.05)"),
              "The in-graph label should also reflect the leftmost cell.");

            chart.dispatchEvent(new appWindow.KeyboardEvent("keydown", {
              key: "End", bubbles: true, cancelable: true
            }));
            assert(chart.querySelector(".cell-label").textContent.startsWith("[0.95, 1.00)"),
              "End should move the selection to the rightmost cell.");
            assert(appDocument.getElementById("brush-value-control-label")
              .textContent === staticLabel,
            "The visible control label should stay static while the " +
              "selection moves.");

            assert(chart.getAttribute("aria-keyshortcuts").includes("ArrowUp") &&
              chart.getAttribute("aria-keyshortcuts").includes("Home") &&
              chart.getAttribute("aria-keyshortcuts").includes("l") &&
              chart.getAttribute("aria-keyshortcuts").includes("r") &&
              chart.getAttribute("aria-keyshortcuts").includes("Enter") &&
              chart.getAttribute("aria-keyshortcuts").includes("Space"),
            "Declared keyboard shortcuts should match the implemented keys.");
          }());
        }
      },
      {
        name: "The allocation surface updates during a stroke and exact diagnostics wait for release",
        run: function () {
          return (async function () {
            paintEntireGrid(0);
            var slider = appDocument.getElementById("brush-value-slider");
            var chart = appDocument.getElementById("paint-chart");
            var rect = chart.getBoundingClientRect();
            var beforeFills = Array.from(chart.querySelectorAll("polygon[fill]"))
              .map(function (polygon) { return polygon.getAttribute("fill"); })
              .join("|");
            var beforeEfficiency = appDocument.querySelector(
              "#efficiency-chart image"
            ).getAttribute("href");
            slider.value = "1";
            dispatchInput(slider, appWindow);
            assert(Array.from(chart.querySelectorAll("polygon[fill]"))
              .map(function (polygon) { return polygon.getAttribute("fill"); })
              .join("|") === beforeFills,
            "Changing the brush should not repaint a triangle.");
            firePointer(
              chart,
              "pointerdown",
              rect.left + 250 / 480 * rect.width,
              rect.top + 240 / 520 * rect.height,
              50
            );
            await new Promise(function (resolve) {
              appWindow.requestAnimationFrame(resolve);
            });
            assert(Array.from(chart.querySelectorAll("polygon[fill]"))
              .map(function (polygon) { return polygon.getAttribute("fill"); })
              .join("|") !== beforeFills,
            "The touched allocation triangle should repaint during the stroke.");
            assert(appDocument.querySelector("#efficiency-chart image")
              .getAttribute("href") === beforeEfficiency,
            "Dependent diagnostic rasters should remain unchanged during the stroke.");
            await new Promise(function (resolve) {
              appWindow.setTimeout(resolve, 150);
            });
            assert(appDocument.querySelector("#efficiency-chart image")
              .getAttribute("href") === beforeEfficiency,
            "A pause while the pointer is held should not trigger exact diagnostics.");
            firePointer(
              chart,
              "pointerup",
              rect.left + 250 / 480 * rect.width,
              rect.top + 240 / 520 * rect.height,
              50
            );
            assert(appDocument.querySelector("#efficiency-chart image")
              .getAttribute("href") !== beforeEfficiency,
            "The exact diagnostics should refresh when the stroke is released.");
          }());
        }
      },
      {
        name: "Horizontal keyboard movement visits L and R without skipping either triangle",
        run: function () {
          (function () {
            paintEntireGrid(0);
            var chart = appDocument.getElementById("paint-chart");
            var slider = appDocument.getElementById("brush-value-slider");

            function press(key) {
              chart.dispatchEvent(new appWindow.KeyboardEvent("keydown", {
                key: key, bubbles: true, cancelable: true
              }));
            }
            function release(key) {
              chart.dispatchEvent(new appWindow.KeyboardEvent("keyup", {
                key: key, bubbles: true, cancelable: true
              }));
            }
            function selectedOutput() {
              return chart.querySelector(".allocation-probe .plot-probe-text")
                .textContent;
            }

            press("Home");
            assert(chart.querySelector(".cell-label").textContent
              .startsWith("[0.00, 0.05)") &&
              chart.querySelector(".cell-label").textContent.endsWith(" L"),
            "Home should start on the leftmost cell's L triangle.");
            press("ArrowRight");
            assert(chart.querySelector(".cell-label").textContent
              .startsWith("[0.00, 0.05)") &&
              chart.querySelector(".cell-label").textContent.endsWith(" R"),
            "The first ArrowRight should visit R in the same cell.");
            press("ArrowRight");
            assert(chart.querySelector(".cell-label").textContent
              .startsWith("[0.05, 0.10)") &&
              chart.querySelector(".cell-label").textContent.endsWith(" L"),
            "The next ArrowRight should move to L in the next cell.");
            var down;
            for (down = 0; down < 2 * model.CELL_RESOLUTION; down += 1) {
              press("ArrowDown");
            }
            assert(chart.querySelector(".cell-label").textContent
              .includes("× [0.00, 0.05) R"),
            "Repeated ArrowDown should reach the bottom row's R triangle.");
            press("ArrowUp");
            assert(chart.querySelector(".cell-label").textContent
              .includes("× [0.00, 0.05) L"),
            "The first ArrowUp should visit L in the same row.");
            press("ArrowUp");
            assert(chart.querySelector(".cell-label").textContent
              .includes("× [0.05, 0.10) R"),
            "The next ArrowUp should move to R in the next row.");

            press("Home");
            press("r");
            assert(chart.querySelector(".cell-label").textContent.endsWith(" R"),
              "Pressing r should select the right (lower) triangle.");
            slider.value = "0.8";
            dispatchInput(slider, appWindow);
            press("Enter");
            release("Enter");

            press("l");
            assert(chart.querySelector(".cell-label").textContent.endsWith(" L"),
              "Pressing l should select the left (upper) triangle of the same cell.");
            assert(selectedOutput() === "q=0.000" && slider.value === "0.8",
              "The L triangle should remain untouched while the brush stays at 0.8.");

            press("r");
            assert(selectedOutput() === "q=0.800" && slider.value === "0.8",
              "Reselecting R should recover its painted value without changing the brush.");
          }());
        }
      },
      {
        name: "Holding Enter paints every triangle reached by keyboard navigation",
        run: function () {
          paintEntireGrid(0);
          var chart = appDocument.getElementById("paint-chart");
          var slider = appDocument.getElementById("brush-value-slider");
          var beforeEfficiency = appDocument.querySelector(
            "#efficiency-chart image"
          ).getAttribute("href");

          function key(type, value) {
            chart.dispatchEvent(new appWindow.KeyboardEvent(type, {
              key: value, bubbles: true, cancelable: true
            }));
          }

          slider.value = "0.6";
          dispatchInput(slider, appWindow);
          key("keydown", "Home");
          key("keydown", "Enter");
          key("keydown", "ArrowRight");
          key("keydown", "ArrowRight");
          assert(appDocument.querySelector("#efficiency-chart image")
            .getAttribute("href") === beforeEfficiency,
          "Exact diagnostics should remain unchanged while Enter is held.");
          key("keyup", "Enter");
          assert(appDocument.querySelector("#efficiency-chart image")
            .getAttribute("href") !== beforeEfficiency,
          "Releasing Enter should commit one exact diagnostic refresh.");

          key("keydown", "Home");
          assert(chart.querySelector(".allocation-probe .plot-probe-text")
            .textContent === "q=0.600",
          "The starting L triangle should receive the held-key brush.");
          key("keydown", "ArrowRight");
          assert(chart.querySelector(".allocation-probe .plot-probe-text")
            .textContent === "q=0.600",
          "The same cell's R triangle should receive the held-key brush.");
          key("keydown", "ArrowRight");
          assert(chart.querySelector(".allocation-probe .plot-probe-text")
            .textContent === "q=0.600",
          "The next cell's L triangle should receive the held-key brush.");
          key("keydown", "ArrowRight");
          assert(chart.querySelector(".allocation-probe .plot-probe-text")
            .textContent === "q=0.000",
          "Navigation after release should not keep painting.");
        }
      },
      {
        name: "Painting a non-monotonic pattern flips the IC verdict",
        run: function () {
          return (async function () {
            paintEntireGrid(0);
            var chart = appDocument.getElementById("paint-chart");
            var slider = appDocument.getElementById("brush-value-slider");
            var buyerIc = appDocument.getElementById("buyer-ic-text");
            var sellerIc = appDocument.getElementById("seller-ic-text");
            var rect = chart.getBoundingClientRect();
            var viewWidth = chart.viewBox.baseVal.width;
            var viewHeight = chart.viewBox.baseVal.height;

            function clientOf(svgX, svgY) {
              return {
                x: rect.left + (svgX / viewWidth) * rect.width,
                y: rect.top + (svgY / viewHeight) * rect.height
              };
            }

            function press(key) {
              chart.dispatchEvent(new appWindow.KeyboardEvent("keydown", {
                key: key, bubbles: true, cancelable: true
              }));
            }

            var k;
            for (k = 0; k < 2 * model.CELL_RESOLUTION; k += 1) {
              press("ArrowDown");
            }
            press("End");
            press("r");
            slider.value = "1";
            dispatchInput(slider, appWindow);
            assert(buyerIc.dataset.icImplementable === "true" &&
              sellerIc.dataset.icImplementable === "true",
            "Choosing the paint value should not itself create this test's IC violation.");
            var point = clientOf(90, 240);
            firePointer(chart, "pointerdown", point.x, point.y, 51);
            firePointer(chart, "pointerup", point.x, point.y, 51);
            await new Promise(function (resolve) {
              appWindow.requestAnimationFrame(resolve);
            });

            assert(buyerIc.dataset.icImplementable === "false" &&
              sellerIc.dataset.icImplementable === "false",
            "An isolated spike should violate Bayesian IC on both sides.");
            assert(Number(buyerIc.dataset.buyerIcViolationCount) > 0,
              "The buyer interim-violation count should be positive.");
            assert(Number(sellerIc.dataset.sellerIcViolationCount) > 0,
              "The seller interim-violation count should be positive.");

            ["buyer-ic-chart", "seller-ic-chart"].forEach(function (id) {
              var icChart = appDocument.getElementById(id);
              assert(icChart.querySelector(
                "image[data-renderer='payoff-raster']"
              ), id + " should retain its exact payoff field after painting.");
              assert(Number(icChart.dataset.maxDeviationGain) > 0,
                id + " should report a positive exact deviation gain.");
              var truthful = icChart.querySelector(".truthful-report-line");
              var best = icChart.querySelector(".best-report-line");
              assert(truthful && best &&
                appWindow.getComputedStyle(truthful).stroke !== "none" &&
                appWindow.getComputedStyle(best).stroke !== "none",
              id + " should display truthful and best-report traces.");
            });

            var revenue = appDocument.getElementById("revenue-text");
            assert(!/formal value only|not IC-implementable/.test(revenue.textContent),
              "The revenue text no longer carries a not-IC-implementable caveat.");
          }());
        }
      },
      {
        name: "Dragging beyond the plot edge still paints the boundary cell",
        run: function () {
          (function () {
            paintEntireGrid(0);
            var chart = appDocument.getElementById("paint-chart");
            var slider = appDocument.getElementById("brush-value-slider");
            var rect = chart.getBoundingClientRect();

            chart.dispatchEvent(new appWindow.KeyboardEvent("keydown", {
              key: "Home", bubbles: true, cancelable: true
            }));
            chart.dispatchEvent(new appWindow.KeyboardEvent("keydown", {
              key: "r", bubbles: true, cancelable: true
            }));
            slider.value = "1";
            dispatchInput(slider, appWindow);

            firePointer(chart, "pointerdown",
              rect.left + rect.width * 0.5, rect.top + rect.height * 0.5, 61);
            firePointer(chart, "pointermove",
              rect.right + 200, rect.top + rect.height * 0.5, 61);
            firePointer(chart, "pointerup",
              rect.right + 200, rect.top + rect.height * 0.5, 61);

            assert(chart.querySelector(".cell-label").textContent
              .startsWith("[0.95, 1.00)"),
            "Dragging past the right edge should clamp to the rightmost cell.");

            chart.dispatchEvent(new appWindow.KeyboardEvent("keydown", {
              key: "Home", bubbles: true, cancelable: true
            }));
            chart.dispatchEvent(new appWindow.KeyboardEvent("keydown", {
              key: "End", bubbles: true, cancelable: true
            }));
            assert(chart.querySelector(".allocation-probe .plot-probe-text")
              .textContent === "q=1.000" && slider.value === "1",
              "Returning to the boundary triangle should show the painted value while preserving the brush.");
          }());
        }
      },
      {
        name: "Every SVG panel keeps finite coordinates and an accessible title/description",
        run: function () {
          (function () {
            [
              "paint-chart", "buyer-ic-chart", "seller-ic-chart",
              "buyer-payoff-chart", "seller-payoff-chart", "revenue-chart",
              "efficiency-chart"
            ].forEach(function (id) {
              var chart = appDocument.getElementById(id);
              assert(!/(NaN|Infinity|undefined)/.test(numericSvgAttributes(chart)),
                "Chart " + id + " should contain only finite coordinates.");
              assert(chart.querySelector("title") && chart.querySelector("desc"),
                "Chart " + id + " should expose a title and description.");
              assert(chart.querySelectorAll("mjx-container").length === 0,
                "Chart " + id + " should not contain MathJax output.");
            });
          }());
        }
      },
      {
        name: "The accessible live summary reports the current diagnostics",
        run: function () {
          (function () {
            var summary = appDocument.getElementById("live-summary");
            assert(summary.getAttribute("aria-live") === "polite",
              "The live summary should be politely announced.");
            assert(summary.textContent.includes("IC-implementable") ||
              summary.textContent.includes("Expected buyer payoff"),
            "The live summary should describe the IC and IR state.");
            assert(summary.textContent.includes("Expected revenue"),
              "The live summary should describe expected revenue.");
          }());
        }
      },
      {
        name: "Generated heatmaps use the active CSS RGB palette",
        run: function () {
          var root = appDocument.documentElement;
          var properties = [
            "--heatmap-neutral-rgb",
            "--heatmap-blue-rgb",
            "--heatmap-green-rgb",
            "--heatmap-yellow-rgb",
            "--heatmap-orange-rgb",
            "--heatmap-red-rgb"
          ];
          var previous = properties.map(function (propertyName) {
            return root.style.getPropertyValue(propertyName);
          });
          var slider = appDocument.getElementById("brush-value-slider");

          try {
            root.style.setProperty("--heatmap-neutral-rgb", "1, 2, 3");
            root.style.setProperty("--heatmap-blue-rgb", "101, 2, 3");
            root.style.setProperty("--heatmap-green-rgb", "1, 102, 3");
            root.style.setProperty("--heatmap-yellow-rgb", "103, 102, 3");
            root.style.setProperty("--heatmap-orange-rgb", "1, 2, 103");
            root.style.setProperty("--heatmap-red-rgb", "101, 102, 3");

            paintEntireGrid(0);
            slider.value = "1";
            dispatchInput(slider, appWindow);
            appDocument.getElementById("paint-chart").dispatchEvent(
              new appWindow.KeyboardEvent("keydown", {
                key: "Enter", bubbles: true, cancelable: true
              })
            );
            appDocument.getElementById("paint-chart").dispatchEvent(
              new appWindow.KeyboardEvent("keyup", {
                key: "Enter", bubbles: true, cancelable: true
              })
            );

            var paintFills = Array.from(appDocument.querySelectorAll(
              "#paint-chart polygon[fill]"
            )).map(function (polygon) { return polygon.getAttribute("fill"); });
            assert(paintFills.includes("rgb(1,2,3)") &&
              paintFills.includes("rgb(101,2,3)"),
            "The allocation heatmap should mix from the active neutral color " +
              "to the active blue color.");

            ["buyer-ic-chart", "seller-ic-chart", "buyer-payoff-chart",
              "seller-payoff-chart", "revenue-chart", "efficiency-chart"]
              .forEach(function (id) {
                var image = appDocument.querySelector(
                  "#" + id + " image"
                );
                assert(image && image.getAttribute("href").indexOf("data:image/png") === 0,
                  id + " should retain its generated raster under a palette change.");
              });
            assert(appDocument.getElementById("buyer-ic-chart")
              .dataset.colorHigh === "yellow",
            "The exact deviation fields should retain the yellow high endpoint.");
          } finally {
            properties.forEach(function (propertyName, index) {
              if (previous[index]) {
                root.style.setProperty(propertyName, previous[index]);
              } else {
                root.style.removeProperty(propertyName);
              }
            });
            slider.value = "0";
            dispatchInput(slider, appWindow);
          }
        }
      }
    ];

    var failures = 0;
    for (var testIndex = 0; testIndex < tests.length; testIndex += 1) {
      var test = tests[testIndex];
      try {
        await test.run();
        addResult(test.name, null);
      } catch (error) {
        failures += 1;
        addResult(test.name, error);
      }
    }

    var summary = document.getElementById("summary");
    var passed = tests.length - failures;
    summary.textContent = passed + " of " + tests.length +
      " bilateral-trade interface tests passed.";
    summary.className = failures ? "fail" : "pass";
    document.body.dataset.status = failures ? "failed" : "passed";
    document.title = (failures ? "FAIL" : "PASS") +
      " — Bilateral-trade interface tests";
    window.clearInterval(testKeepAlive);
  }
}());
