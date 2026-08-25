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

    function reset() {
      appDocument.getElementById("preset-efficient").click();
    }

    function withReset(callback) {
      reset();
      var result;
      try {
        result = callback();
      } catch (error) {
        reset();
        throw error;
      }
      if (result && typeof result.then === "function") {
        return Promise.resolve(result).finally(reset);
      }
      reset();
      return result;
    }

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
          var references = appDocument.querySelectorAll(".reference-list li");
          assert(references.length === 1 &&
            /Myerson/.test(references[0].textContent) &&
            /Satterthwaite/.test(references[0].textContent) &&
            references[0].querySelector(
              'a[href="https://doi.org/10.1016/0022-0531(83)90048-0"]'
            ),
          "References should contain the requested 1983 Myerson-Satterthwaite paper.");
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
            appDocument.querySelector(
              ".bilateral-main-chart-figure > figcaption"
            ),
            appDocument.querySelector(".bilateral-main-x-axis-label"),
            appDocument.querySelector(".bilateral-main-y-axis-label"),
            appDocument.getElementById("buyer-ic-chart")
              .closest("figure").querySelector("figcaption"),
            appDocument.getElementById("seller-ic-chart")
              .closest("figure").querySelector("figcaption"),
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
          var mathOnlyAxes = Array.from(appDocument.querySelectorAll(
            ".bilateral-diagnostic-x-axis-label, " +
            ".bilateral-diagnostic-y-axis-label"
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
          assert(appDocument.getElementById("cell-value-control-label")
            .querySelectorAll("mjx-container").length === 0,
          "The selected-cell control label is dynamic plain text, not MathJax.");
          assert(appDocument.getElementById("cell-value-control-label")
            .textContent.indexOf("∈") >= 0,
          "The selected-cell control label should still render a real " +
            "Unicode ∈ character even without MathJax.");
          assert(!appDocument.querySelector("#paint-chart .panel-caption") &&
            !appDocument.querySelector("#paint-chart .axis-title"),
          "The main plot's mixed title and axes should live outside its SVG.");
          assert(appDocument.getElementById("paint-chart-title").textContent ===
            "Allocation rule, q(v,c)",
          "The main plot's accessible title should mirror the comma-space convention.");
          var paintRect = appDocument.getElementById("paint-chart")
            .getBoundingClientRect();
          var xAxisRect = appDocument.querySelector(".bilateral-main-x-axis-label")
            .getBoundingClientRect();
          var yAxisRect = appDocument.querySelector(".bilateral-main-y-axis-label")
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
            var xRect = frame.querySelector(".bilateral-diagnostic-x-axis-label")
              .getBoundingClientRect();
            var yRect = frame.querySelector(".bilateral-diagnostic-y-axis-label")
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
        name: "Preset buttons reproduce their model-level closed forms",
        run: function () {
          withReset(function () {
            assert(!appDocument.getElementById("preset-random") &&
              !appDocument.getElementById("reset-button"),
            "Random and Reset the example should no longer be offered.");
            assert(appDocument.getElementById("preset-posted-price") &&
              appDocument.getElementById("preset-chatterjee"),
            "Posted price and Chatterjee-Samuelson presets should be offered.");

            var buyerIc = appDocument.getElementById("buyer-ic-text");
            var sellerIc = appDocument.getElementById("seller-ic-text");

            appDocument.getElementById("preset-always").click();
            var budget = appDocument.getElementById("budget-text");
            var buyerUtility = appDocument.getElementById("buyer-utility-text");
            assertClose(Number(budget.dataset.expectedRevenue), -1,
              "Always-trade should have an exact expected deficit of 1.", 1e-6);
            assertClose(Number(buyerUtility.dataset.minBuyerUtility), 0,
              "Minimum buyer utility should still vanish at v = 0.", 1e-6);
            assertClose(Number(buyerUtility.dataset.expectedBuyerUtility), 0.5,
              "Expected buyer rent under certain trade equals E[V] = 0.5.", 1e-6);
            assert(buyerIc.dataset.icImplementable === "true" &&
              sellerIc.dataset.icImplementable === "true",
            "A constant allocation rule is trivially IC on both sides.");

            appDocument.getElementById("preset-never").click();
            assertClose(Number(budget.dataset.expectedRevenue), 0,
              "Never-trade should be exactly expected-revenue neutral.", 1e-9);
            assert(budget.dataset.exPostBudgetBalanced === "true",
              "Never-trade should be exactly ex-post budget balanced.");

            appDocument.getElementById("preset-efficient").click();
            var efficiency = appDocument.getElementById("efficiency-text");
            assertClose(Number(efficiency.dataset.efficiencyLoss), 0,
              "The efficient preset should have zero efficiency loss.", 1e-6);
            assertClose(Number(buyerUtility.dataset.expectedBuyerUtility), 1 / 6,
              "Expected buyer rent at the efficient benchmark equals E[(V-C)+] = 1/6 " +
              "exactly, not just approximately, under the triangular mesh.",
              1e-6);
            assert(buyerIc.dataset.icImplementable === "true" &&
              sellerIc.dataset.icImplementable === "true" &&
              buyerIc.dataset.buyerIcViolationCount === "0" &&
              sellerIc.dataset.sellerIcViolationCount === "0",
            "The efficient benchmark's interim probabilities are exactly monotonic.");
          });
        }
      },
      {
        name: "The main column and diagnostic grid sit side by side with a compact q slider",
        run: function () {
          withReset(function () {
            var mainColumn = appDocument.querySelector(".bilateral-main-column");
            var grid = appDocument.querySelector(".diagnostic-panel-grid");
            assert(mainColumn && mainColumn.contains(
              appDocument.getElementById("paint-chart")
            ) && mainColumn.contains(
              appDocument.getElementById("cell-value-slider")
            ), "The main column should hold both the paint chart and its controls.");
            assert(grid && appWindow.getComputedStyle(grid).display === "grid",
              "The six diagnostic panels should be arranged in a grid.");

            var layout = appDocument.querySelector(".bilateral-layout");
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
          });
        }
      },
      {
        name: "Presets are laid out horizontally with a Presets: label",
        run: function () {
          withReset(function () {
            var container = appDocument.querySelector(".preset-buttons");
            var label = container.querySelector(".preset-buttons-label");
            assert(label && label.textContent.trim() === "Presets:",
              "The preset buttons should be introduced with a Presets: label.");
            assert(appWindow.getComputedStyle(container).flexDirection === "row",
              "The preset buttons should be arranged horizontally.");
            assert(container.firstElementChild === label,
              "The Presets: label should precede the buttons.");
          });
        }
      },
      {
        name: "The diagnostic plots form a three-column by two-row wide-screen grid",
        run: function () {
          withReset(function () {
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

            var layout = appDocument.querySelector(".bilateral-layout");
            var contentWidth = appDocument.querySelector("main.page-width")
              .getBoundingClientRect().width;
            assert(Math.abs(layout.getBoundingClientRect().width - contentWidth) < 1,
              "The interactive demo should use the auction pages' full shared content width.");
          });
        }
      },
      {
        name: "The posted-price preset shows an adjustable price slider that live-updates the grid",
        run: function () {
          withReset(function () {
            var control = appDocument.getElementById("posted-price-control");
            assert(control.hidden, "The posted-price control should start hidden.");

            appDocument.getElementById("preset-posted-price").click();
            assert(!control.hidden,
              "Selecting the posted-price preset should reveal its slider.");

            var priceSlider = appDocument.getElementById("posted-price-slider");
            var priceNumber = appDocument.getElementById("posted-price-number");
            var budget = appDocument.getElementById("budget-text");
            var efficiency = appDocument.getElementById("efficiency-text");
            assert(priceSlider.getAttribute("step") === "0.05",
              "The price slider's step should match the 20-cell grid's 0.05 spacing.");

            priceNumber.value = "0.37";
            dispatchChange(priceNumber, appWindow);
            assertClose(Number(priceNumber.value), 0.35,
              "An off-grid typed price should snap to the nearest cell boundary.", 1e-12);
            assertClose(Number(priceSlider.value), 0.35,
              "The slider should display the same snapped posted price.", 1e-12);
            var snapped = model.summarize(model.postedPriceGrid(0.35));
            assertClose(Number(budget.dataset.expectedRevenue),
              snapped.verdicts.expectedRevenue,
              "The displayed grid should use the snapped posted price.", 1e-9);
            assertClose(Number(efficiency.dataset.welfare),
              snapped.verdicts.welfare,
              "The snapped price should regenerate the allocation and its welfare.", 1e-9);

            priceSlider.value = "0.3";
            dispatchInput(priceSlider, appWindow);
            var expected = model.summarize(model.postedPriceGrid(0.3));
            assertClose(Number(budget.dataset.expectedRevenue),
              expected.verdicts.expectedRevenue,
              "Moving the price slider should live-update the induced grid.", 1e-9);
            assertClose(Number(efficiency.dataset.welfare),
              expected.verdicts.welfare,
              "Moving the price slider should update allocation-dependent welfare.", 1e-9);
            assertClose(Number(budget.dataset.expectedRevenue), 0,
              "The posted-price mechanism should be exactly budget balanced.", 1e-9);
            assert(budget.dataset.exPostBudgetBalanced === "true",
              "Posted price should be exactly ex-post budget balanced, not just in expectation.");

            appDocument.getElementById("preset-always").click();
            assert(control.hidden,
              "Selecting a different preset should hide the price slider again.");

            appDocument.getElementById("preset-posted-price").click();
            var chart = appDocument.getElementById("paint-chart");
            var rect = chart.getBoundingClientRect();
            firePointer(chart, "pointerdown",
              rect.left + rect.width * 0.5, rect.top + rect.height * 0.5, 71);
            firePointer(chart, "pointerup",
              rect.left + rect.width * 0.5, rect.top + rect.height * 0.5, 71);
            assert(control.hidden,
              "Painting manually should hide the price slider (it no longer governs the grid).");
          });
        }
      },
      {
        name: "The Chatterjee-Samuelson preset is IC-implementable with a small positive efficiency loss",
        run: function () {
          withReset(function () {
            appDocument.getElementById("preset-chatterjee").click();
            var buyerIc = appDocument.getElementById("buyer-ic-text");
            var sellerIc = appDocument.getElementById("seller-ic-text");
            var efficiency = appDocument.getElementById("efficiency-text");
            var budget = appDocument.getElementById("budget-text");

            assert(buyerIc.dataset.icImplementable === "true" &&
              sellerIc.dataset.icImplementable === "true",
            "The double auction's induced allocation should be IC-implementable.");
            var loss = Number(efficiency.dataset.efficiencyLoss);
            assert(loss > 0 && loss < 1 / 6,
              "The double auction should be inefficient but far better than never trading.");
            assertClose(Number(budget.dataset.expectedRevenue), 0,
              "The double auction's expected revenue should be exactly zero.", 0.01);
          });
        }
      },
      {
        name: "The net-revenue plot stays a heatmap; its text is a single expected-revenue line",
        run: function () {
          withReset(function () {
            var chart = appDocument.getElementById("budget-chart");
            assert(chart.querySelectorAll("polygon").length === 800,
              "The net-revenue plot should still render the full pointwise " +
              "v-c heatmap (800 triangles), unchanged from the other heatmap panels.");

            var text = appDocument.getElementById("budget-text");
            appDocument.getElementById("preset-always").click();
            assert(text.querySelectorAll("p").length === 1,
              "The text below the plot should be a single line, not the " +
              "previous three (ex-post BB, ex-post no-deficit, expected).");
            assert(text.querySelector("p").textContent ===
              "Expected revenue: -1.000.",
              "That single line should read only the expected revenue, " +
              "with no separate no-deficit yes/no wording.");
            assert(text.querySelector("p").className === "verdict-fail",
              "Always-trade's guaranteed deficit should still color the line red.");

            appDocument.getElementById("preset-never").click();
            assert(text.querySelectorAll("p").length === 1 &&
              text.querySelector("p").textContent === "Expected revenue: 0.000." &&
              text.querySelector("p").className === "verdict-pass",
            "Never-trade's exact zero revenue (no deficit) should read as a single green line.");

            assert(text.dataset.exPostBudgetBalanced !== undefined &&
              text.dataset.exPostNoDeficit !== undefined,
            "The ex-post verdicts should remain available as data attributes " +
              "even though they are no longer separately rendered as text.");
          });
        }
      },
      {
        name: "IR utility text reports expected rent, always green since IR cannot fail",
        run: function () {
          withReset(function () {
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
          });
        }
      },
      {
        name: "The selected-cell slider, number input, and dynamic label stay synchronized",
        run: function () {
          withReset(function () {
            var slider = appDocument.getElementById("cell-value-slider");
            var number = appDocument.getElementById("cell-value-number");
            var label = appDocument.getElementById("cell-value-control-label");

            assert(label.textContent.startsWith("Allocation probability on v ∈ ["),
              "The label should describe the selected triangle's v and c " +
              "ranges using set-membership notation (v ∈ [...)).");
            assert(/, [LR]$/.test(label.textContent),
              "The label should end with the selected triangle's L/R side.");

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
          });
        }
      },
      {
        name: "The selected cell's range in the label and in-graph marker update dynamically",
        run: function () {
          withReset(function () {
            var chart = appDocument.getElementById("paint-chart");
            var label = appDocument.getElementById("cell-value-control-label");
            var before = label.textContent;

            chart.dispatchEvent(new appWindow.KeyboardEvent("keydown", {
              key: "ArrowRight", bubbles: true, cancelable: true
            }));
            assert(label.textContent !== before,
              "ArrowRight should move the selected cell and update the label.");
            assert(chart.querySelector(".cell-label"),
              "An in-graph label should identify the selected cell.");

            chart.dispatchEvent(new appWindow.KeyboardEvent("keydown", {
              key: "Home", bubbles: true, cancelable: true
            }));
            assert(label.textContent.includes("v ∈ [0.00, 0.05)"),
              "Home should move the selection to the leftmost cell, v in [0, 0.05).");
            assert(chart.querySelector(".cell-label").textContent.startsWith("[0.00, 0.05)"),
              "The in-graph label should also reflect the leftmost cell.");

            chart.dispatchEvent(new appWindow.KeyboardEvent("keydown", {
              key: "End", bubbles: true, cancelable: true
            }));
            assert(label.textContent.includes("v ∈ [0.95, 1.00)"),
              "End should move the selection to the rightmost cell, v in [0.95, 1).");

            assert(chart.getAttribute("aria-keyshortcuts").includes("ArrowUp") &&
              chart.getAttribute("aria-keyshortcuts").includes("Home") &&
              chart.getAttribute("aria-keyshortcuts").includes("l") &&
              chart.getAttribute("aria-keyshortcuts").includes("r"),
            "Declared keyboard shortcuts should match the implemented keys.");
          });
        }
      },
      {
        name: "L and R keys select the two triangles of the current cell independently",
        run: function () {
          withReset(function () {
            appDocument.getElementById("preset-never").click();
            var chart = appDocument.getElementById("paint-chart");
            var slider = appDocument.getElementById("cell-value-slider");
            var label = appDocument.getElementById("cell-value-control-label");

            function press(key) {
              chart.dispatchEvent(new appWindow.KeyboardEvent("keydown", {
                key: key, bubbles: true, cancelable: true
              }));
            }

            press("Home");
            press("r");
            assert(label.textContent.endsWith(", R"),
              "Pressing r should select the right (lower) triangle.");
            slider.value = "0.8";
            dispatchInput(slider, appWindow);

            press("l");
            assert(label.textContent.endsWith(", L"),
              "Pressing l should select the left (upper) triangle of the same cell.");
            assertClose(Number(slider.value), 0,
              "The L triangle should still read its own (untouched, 0) " +
              "value, not the R triangle's freshly painted 0.8.", 1e-9);

            press("r");
            assertClose(Number(slider.value), 0.8,
              "Reselecting R should show the 0.8 it was painted with, " +
              "confirming the two triangles hold independent values.", 1e-9);
          });
        }
      },
      {
        name: "Painting a non-monotonic pattern flips the IC verdict",
        run: function () {
          return withReset(async function () {
            appDocument.getElementById("preset-never").click();
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
          });
        }
      },
      {
        name: "Dragging beyond the plot edge still paints the boundary cell",
        run: function () {
          withReset(function () {
            appDocument.getElementById("preset-never").click();
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

            var label = appDocument.getElementById("cell-value-control-label");
            assert(label.textContent.includes("v ∈ [0.95, 1.00)"),
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
          });
        }
      },
      {
        name: "Every SVG panel keeps finite coordinates and an accessible title/description",
        run: function () {
          withReset(function () {
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
          });
        }
      },
      {
        name: "The accessible live summary reports the current diagnostics",
        run: function () {
          withReset(function () {
            var summary = appDocument.getElementById("live-summary");
            assert(summary.getAttribute("aria-live") === "polite",
              "The live summary should be politely announced.");
            assert(summary.textContent.includes("IC-implementable") ||
              summary.textContent.includes("Expected buyer rent"),
            "The live summary should describe the IC and IR state.");
            assert(summary.textContent.includes("Expected budget balance") ||
              summary.textContent.includes("budget"),
            "The live summary should describe the budget-balance state.");
          });
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
