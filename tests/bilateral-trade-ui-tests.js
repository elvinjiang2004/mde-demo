(function () {
  "use strict";

  var frame = document.getElementById("app-frame");
  var testKeepAlive = window.setInterval(function () {}, 50);
  frame.addEventListener("load", function () {
    Promise.resolve(frame.contentWindow.mechanismMathReady).then(runTests).catch(
      function (error) {
        addResult("MathJax initializes before the interface tests", error);
        var summary = document.getElementById("summary");
        summary.textContent = "The interface tests could not start.";
        summary.className = "fail";
        document.body.dataset.status = "failed";
        document.title = "FAIL — Bilateral-trade interface tests";
        window.clearInterval(testKeepAlive);
      }
    );
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

    // The page intentionally offers no preset or reset control, so there is
    // no UI affordance that restores the initial efficient grid. Tests that
    // need a known starting grid paint one instead (see paintEntireGrid),
    // and the suite is ordered so the tests that mutate the grid run after
    // the ones that read the as-loaded default.
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

  // Fills every triangle with one value using only real painting, standing
  // in for the removed never-trade/always-trade presets. A single drag holds
  // the chosen paint value fixed while the pointer visits all 800 triangle
  // centroids, so the whole grid ends at that value.
  function paintEntireGrid(value) {
      var chart = appDocument.getElementById("paint-chart");
      var slider = appDocument.getElementById("cell-value-slider");
      var rect = chart.getBoundingClientRect();
      var viewWidth = chart.viewBox.baseVal.width;
      var viewHeight = chart.viewBox.baseVal.height;
      // Matches MAIN_LAYOUT in the module's app.js.
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

      // Both triangles of a cell, offset to either side of the cell's own
      // diagonal so each centroid lands unambiguously inside one of them.
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
    // Synthetic PointerEvents are not registered as active OS pointers, so
    // Chromium's native setPointerCapture throws before the handler reaches
    // the painting code. Pointer capture itself is a browser primitive rather
    // than this module's behavior under test; stub it for these event-driven
    // mapping and painting checks.
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
          assert(appDocument.querySelectorAll(".notes-list li").length === 0,
            "The Notes list should stay empty pending user-authored bullets.");
          var references = Array.from(
            appDocument.querySelectorAll(".reference-list li")
          );
          assert(references.length === 3,
            "References should list the three requested works.");
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
            appDocument.querySelector(".chart-480x520-y-axis-label"),
            appDocument.getElementById("buyer-utility-chart")
              .closest("figure").querySelector("figcaption"),
            appDocument.getElementById("seller-utility-chart")
              .closest("figure").querySelector("figcaption"),
            appDocument.getElementById("budget-chart")
              .closest("figure").querySelector("figcaption")
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
            { id: "seller-ic-chart", text: "Seller IC" }
          ];
          plainTextCaptions.forEach(function (entry) {
            var label = appDocument.getElementById(entry.id)
              .closest("figure").querySelector("figcaption");
            assert(label.textContent === entry.text,
              "The " + entry.id + " figcaption should stay plain text with no math.");
            assert(!label.querySelector('mjx-container[jax="SVG"]'),
              "The " + entry.id + " figcaption should not render any MathJax notation.");
          });
          var mathOnlyAxes = Array.from(appDocument.querySelectorAll(
            ".chart-220x240-x-axis-label, " +
            ".chart-220x240-y-axis-label"
          ));
          assert(mathOnlyAxes.length === 12,
            "Each of the six diagnostic plots should keep both existing math-only axes.");
          mathOnlyAxes.forEach(function (label) {
            assert(label.querySelectorAll('mjx-container[jax="SVG"]').length === 1,
              "Each math-only diagnostic axis should have one MathJax rendering.");
            assert(!label.firstChild ||
              label.firstChild.nodeType !== 3 ||
              label.firstChild.nodeValue.trim() === "",
            "Math-only diagnostic axes should not gain a plain-text prefix.");
          });
          var budgetCaption = appDocument.querySelector(
            "#budget-chart"
          ).closest("figure").querySelector("figcaption");
          assert(budgetCaption.querySelector('mjx-container[jax="SVG"]') &&
            !/\\\(/.test(budgetCaption.textContent),
          "The net-revenue figcaption should render as MathJax, not raw TeX.");
          var cellControlLabel = appDocument
            .getElementById("cell-value-control-label");
          assert(cellControlLabel.querySelector('mjx-container[jax="SVG"]'),
            "The static control label's q(v,c) should render as MathJax.");
          assert(!/\\\(/.test(cellControlLabel.textContent),
            "The control label should retain no raw TeX delimiter.");
          assert(cellControlLabel.firstChild &&
            cellControlLabel.firstChild.nodeType === 3 &&
            /, $/.test(cellControlLabel.firstChild.nodeValue),
          "The control label should follow the site's comma-space " +
            "convention before its notation.");
          assert(appDocument.getElementById("cell-value-slider")
            .getAttribute("aria-valuetext").indexOf("∈") >= 0,
          "The slider's accessible value text, which names the selected " +
            "triangle, should use a real Unicode ∈ character rather than " +
            "MathJax, since it updates on every paint stroke.");
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
          assertClose(xAxisRect.left, paintRect.left,
            "The HTML buyer-value axis label should begin at the main plot edge.", 1);
          assertClose(xAxisRect.width, paintRect.width,
            "The HTML buyer-value axis label should span only the main plot.", 1);
          assert(yAxisRect.left >= paintRect.left &&
            yAxisRect.right <= paintRect.right &&
            yAxisRect.top >= paintRect.top &&
            yAxisRect.bottom <= paintRect.bottom,
          "The rotated seller-cost axis label should remain inside the main plot.");
          [
            "buyer-ic-chart", "seller-ic-chart", "buyer-utility-chart",
            "seller-utility-chart", "budget-chart", "efficiency-chart"
          ].forEach(function (id) {
            var chart = appDocument.getElementById(id);
            var chartRect = chart.getBoundingClientRect();
            var frame = chart.closest(".math-chart-frame");
            var xRect = frame.querySelector(".chart-220x240-x-axis-label")
              .getBoundingClientRect();
            var yRect = frame.querySelector(".chart-220x240-y-axis-label")
              .getBoundingClientRect();
            assertClose(xRect.left, chartRect.left,
              "Chart " + id + "'s math-only x label should begin at its plot edge.", 1);
            assertClose(xRect.width, chartRect.width,
              "Chart " + id + "'s math-only x label should span only its plot.", 1);
            assert(yRect.left >= chartRect.left && yRect.right <= chartRect.right &&
              yRect.top >= chartRect.top && yRect.bottom <= chartRect.bottom,
            "Chart " + id + "'s math-only y label should stay inside its plot.");
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
          var budget = appDocument.getElementById("budget-text");
          assert(budget.dataset.exPostBudgetBalanced === "false",
            "The efficient benchmark should not be ex-post budget balanced.");
          assertClose(Number(budget.dataset.expectedRevenue),
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
            "Only the selected-triangle allocation control should remain.");
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
              appDocument.getElementById("cell-value-slider")
            ), "The main column should hold both the paint chart and its controls.");
            assert(grid && appWindow.getComputedStyle(grid).display === "grid",
              "The six diagnostic panels should be arranged in a grid.");

            var layout = appDocument.querySelector(".main-diagnostic-layout");
            assert(layout.contains(mainColumn) && layout.contains(grid) &&
              mainColumn.compareDocumentPosition(grid) &
                appWindow.Node.DOCUMENT_POSITION_FOLLOWING,
            "The diagnostic grid should follow the main column (to its right on wide screens).");

            var slider = appDocument.getElementById("cell-value-slider");
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
            var lastTwoIds = panels.slice(-2).map(function (panel) {
              return panel.querySelector(".diagnostic-chart").id;
            });
            assert(lastTwoIds[0] === "budget-chart" && lastTwoIds[1] === "efficiency-chart",
              "Budget balance and efficiency should be the last two (rightmost) panels.");

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
        name: "IR utility text reports expected rent, always green since IR cannot fail",
        run: function () {
          (function () {
            var buyerUtility = appDocument.getElementById("buyer-utility-text");
            var sellerUtility = appDocument.getElementById("seller-utility-text");
            assert(buyerUtility.textContent.includes("Expected buyer rent") &&
              sellerUtility.textContent.includes("Expected seller rent"),
            "The utility panels should report expected rent, since the " +
              "minimum is always exactly zero and never fails.");
            assert(!buyerUtility.textContent.includes("Never negative") &&
              !buyerUtility.textContent.includes("Negative somewhere"),
            "The dead never-negative wording should be gone.");
            assert(buyerUtility.querySelector("p").className === "verdict-pass" &&
              sellerUtility.querySelector("p").className === "verdict-pass",
            "Expected-rent lines are always the pass color, since ex-post " +
              "IR holds automatically for any q in [0,1].");
          }());
        }
      },
      {
        name: "The selected-cell slider and number input stay synchronized under a static label",
        run: function () {
          (function () {
            var slider = appDocument.getElementById("cell-value-slider");
            var number = appDocument.getElementById("cell-value-number");
            var label = appDocument.getElementById("cell-value-control-label");

            // The label is deliberately static: naming the selected cell's
            // own ranges here made it wrap its trailing ", R"/", L" onto a
            // second line. The selection is identified in-graph and through
            // the slider's aria-valuetext instead. Its own q(v,c) is
            // MathJax, so compare the surrounding prose rather than the
            // whole textContent.
            assert(/^Allocation probability,\s*$/.test(label.firstChild.nodeValue) &&
              /on selected triangle\s*$/.test(label.lastChild.nodeValue),
            "The control label should keep its short static wording around " +
              "the rendered q(v,c).");
            assert(!/∈|\[0\./.test(label.textContent),
              "The label should no longer embed live cell coordinates.");
            assert(/, [LR]$/.test(slider.getAttribute("aria-valuetext")),
              "The slider's accessible value text should still end with the " +
              "selected triangle's L/R side.");

            slider.value = "0.73";
            dispatchInput(slider, appWindow);
            assert(number.value === "0.73",
              "Typing the slider should update the number field.");

            number.value = "0.2";
            dispatchChange(number, appWindow);
            assert(slider.value === "0.2",
              "Changing the number field should update the slider.");

            number.value = "not-a-number";
            dispatchChange(number, appWindow);
            assert(number.value === "0.20",
              "An invalid typed value should revert to the last valid choice.");
          }());
        }
      },
      {
        name: "The selected cell's range in the in-graph marker and value text updates dynamically",
        run: function () {
          (function () {
            var chart = appDocument.getElementById("paint-chart");
            var slider = appDocument.getElementById("cell-value-slider");
            var staticLabel = appDocument.getElementById("cell-value-control-label")
              .textContent;
            var before = slider.getAttribute("aria-valuetext");

            chart.dispatchEvent(new appWindow.KeyboardEvent("keydown", {
              key: "ArrowRight", bubbles: true, cancelable: true
            }));
            assert(slider.getAttribute("aria-valuetext") !== before,
              "ArrowRight should move the selected cell and update the value text.");
            assert(chart.querySelector(".cell-label"),
              "An in-graph label should identify the selected cell.");

            chart.dispatchEvent(new appWindow.KeyboardEvent("keydown", {
              key: "Home", bubbles: true, cancelable: true
            }));
            assert(slider.getAttribute("aria-valuetext").includes("v ∈ [0.00, 0.05)"),
              "Home should move the selection to the leftmost cell, v in [0, 0.05).");
            assert(chart.querySelector(".cell-label").textContent.startsWith("[0.00, 0.05)"),
              "The in-graph label should also reflect the leftmost cell.");

            chart.dispatchEvent(new appWindow.KeyboardEvent("keydown", {
              key: "End", bubbles: true, cancelable: true
            }));
            assert(slider.getAttribute("aria-valuetext").includes("v ∈ [0.95, 1.00)"),
              "End should move the selection to the rightmost cell, v in [0.95, 1).");
            assert(appDocument.getElementById("cell-value-control-label")
              .textContent === staticLabel,
            "The visible control label should stay static while the " +
              "selection moves.");

            assert(chart.getAttribute("aria-keyshortcuts").includes("ArrowUp") &&
              chart.getAttribute("aria-keyshortcuts").includes("Home") &&
              chart.getAttribute("aria-keyshortcuts").includes("l") &&
              chart.getAttribute("aria-keyshortcuts").includes("r"),
            "Declared keyboard shortcuts should match the implemented keys.");
          }());
        }
      },
      {
        name: "L and R keys select the two triangles of the current cell independently",
        run: function () {
          (function () {
            paintEntireGrid(0);
            var chart = appDocument.getElementById("paint-chart");
            var slider = appDocument.getElementById("cell-value-slider");

            function press(key) {
              chart.dispatchEvent(new appWindow.KeyboardEvent("keydown", {
                key: key, bubbles: true, cancelable: true
              }));
            }
            function valueText() {
              return slider.getAttribute("aria-valuetext");
            }

            press("Home");
            press("r");
            assert(valueText().endsWith(", R"),
              "Pressing r should select the right (lower) triangle.");
            slider.value = "0.8";
            dispatchInput(slider, appWindow);

            press("l");
            assert(valueText().endsWith(", L"),
              "Pressing l should select the left (upper) triangle of the same cell.");
            assertClose(Number(slider.value), 0,
              "The L triangle should still read its own (untouched, 0) " +
              "value, not the R triangle's freshly painted 0.8.", 1e-9);

            press("r");
            assertClose(Number(slider.value), 0.8,
              "Reselecting R should show the 0.8 it was painted with, " +
              "confirming the two triangles hold independent values.", 1e-9);
          }());
        }
      },
      {
        name: "Painting a non-monotonic pattern flips the IC verdict",
        run: function () {
          return (async function () {
            paintEntireGrid(0);
            var chart = appDocument.getElementById("paint-chart");
            var slider = appDocument.getElementById("cell-value-slider");
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

            // Paint a single isolated triangle to q = 1 amid an otherwise
            // all-zero grid. Its row's interim average rises then falls
            // back to zero (a buyer IC violation), and its column's
            // interim average does the same across seller cost (a seller
            // IC violation) -- one paint stroke breaks both, even though
            // only one of the cell's two triangles is painted. Coordinates
            // are inside the current 480x520 plot area (v: 50-450, c: 40-440)
            // and fall exactly on a cell's lower-right (R) triangle.
            // Put the selected triangle at high v and low c before choosing
            // q=1. That boundary spike preserves both interim monotonicities,
            // so the verdict can only flip after the pointer stroke below.
            var k;
            for (k = 0; k < model.CELL_RESOLUTION; k += 1) {
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

            var budget = appDocument.getElementById("budget-text");
            assert(!/formal value only|not IC-implementable/.test(budget.textContent),
              "The budget text no longer carries a not-IC-implementable caveat.");
          }());
        }
      },
      {
        name: "Dragging beyond the plot edge still paints the boundary cell",
        run: function () {
          (function () {
            paintEntireGrid(0);
            var chart = appDocument.getElementById("paint-chart");
            var slider = appDocument.getElementById("cell-value-slider");
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

            assert(slider.getAttribute("aria-valuetext")
              .includes("v ∈ [0.95, 1.00)"),
            "Dragging past the right edge should clamp to the rightmost cell.");

            chart.dispatchEvent(new appWindow.KeyboardEvent("keydown", {
              key: "Home", bubbles: true, cancelable: true
            }));
            chart.dispatchEvent(new appWindow.KeyboardEvent("keydown", {
              key: "End", bubbles: true, cancelable: true
            }));
            assertClose(Number(slider.value), 1,
              "Returning to the boundary triangle should recover the value painted by the drag.",
              1e-9);
          }());
        }
      },
      {
        name: "Every SVG panel keeps finite coordinates and an accessible title/description",
        run: function () {
          (function () {
            [
              "paint-chart", "buyer-ic-chart", "seller-ic-chart",
              "buyer-utility-chart", "seller-utility-chart", "budget-chart",
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
              summary.textContent.includes("Expected buyer rent"),
            "The live summary should describe the IC and IR state.");
            assert(summary.textContent.includes("Expected budget balance") ||
              summary.textContent.includes("budget"),
            "The live summary should describe the budget-balance state.");
          }());
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
