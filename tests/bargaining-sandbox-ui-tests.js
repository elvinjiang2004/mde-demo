(function () {
  "use strict";

  var frame = document.getElementById("app-frame");
  var testKeepAlive = window.setInterval(function () {}, 50);

  frame.addEventListener("load", function () {
    waitFor(function () {
      var appDocument = frame.contentDocument;
      return appDocument && appDocument.querySelector(
        "#allocation-chart image[data-renderer='raster']"
      ) && appDocument.querySelector(
        ".sandbox-diagnostic-grid .math-chart-axis-label mjx-container"
      );
    }, 10000).then(runTests).catch(function (error) {
      addResult("The sandbox initializes before the interface tests", error);
      finish(1);
    });
  });

  function assert(condition, message) {
    if (!condition) {
      throw new Error(message || "Assertion failed.");
    }
  }

  function assertClose(actual, expected, message, tolerance) {
    var allowed = tolerance === undefined ? 1e-7 : tolerance;
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
          reject(new Error("Timed out waiting for the sandbox interface."));
        } else {
          window.setTimeout(check, 25);
        }
      }
      check();
    });
  }

  function nextFrames(count) {
    return new Promise(function (resolve) {
      window.setTimeout(resolve, Math.max(1, count) * 25);
    });
  }

  function dispatchChange(element, appWindow) {
    element.dispatchEvent(new appWindow.Event("change", { bubbles: true }));
  }

  function dispatchInput(element, appWindow) {
    element.dispatchEvent(new appWindow.Event("input", { bubbles: true }));
  }

  function dispatchKey(element, key, appWindow) {
    element.dispatchEvent(new appWindow.KeyboardEvent("keydown", {
      key: key,
      bubbles: true,
      cancelable: true
    }));
  }

  function releaseKey(element, key, appWindow) {
    element.dispatchEvent(new appWindow.KeyboardEvent("keyup", {
      key: key,
      bubbles: true,
      cancelable: true
    }));
  }

  function firePointer(element, type, clientX, clientY, pointerId, appWindow) {
    element.dispatchEvent(new appWindow.PointerEvent(type, {
      bubbles: true,
      clientX: clientX,
      clientY: clientY,
      pointerId: pointerId
    }));
  }

  function clientPoint(chart, svgX, svgY) {
    var rect = chart.getBoundingClientRect();
    return {
      x: rect.left + svgX / chart.viewBox.baseVal.width * rect.width,
      y: rect.top + svgY / chart.viewBox.baseVal.height * rect.height
    };
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
    var model = appWindow.BargainingSandboxModel;
    var R = model.CELL_RESOLUTION;

    function click(id) {
      appDocument.getElementById(id).click();
    }

    function dataBoolean(id, key) {
      return appDocument.getElementById(id).dataset[key] === "true";
    }

    function assertAgentStatuses(expected) {
      assert(dataBoolean("buyer-ic-text", "buyerBic") === expected.bic,
        "The buyer BIC label should match the preset.");
      assert(dataBoolean("seller-ic-text", "sellerBic") === expected.bic,
        "The seller BIC label should match the preset.");
      assert(dataBoolean("buyer-ic-text", "buyerDsic") === expected.dsic,
        "The buyer DSIC label should match the preset.");
      assert(dataBoolean("seller-ic-text", "sellerDsic") === expected.dsic,
        "The seller DSIC label should match the preset.");
    }

    function assertIrStatuses(expected) {
      ["Buyer", "Seller"].forEach(function (agent) {
        var lower = agent.toLowerCase();
        var id = lower + "-payoff-text";
        assert(dataBoolean(id, "exAnte" + agent + "Ir") === expected.exAnte,
          agent + " ex-ante IR should match the preset.");
        assert(dataBoolean(id, "interim" + agent + "Ir") === expected.interim,
          agent + " interim IR should match the preset.");
        assert(dataBoolean(id, "exPost" + agent + "Ir") === expected.exPost,
          agent + " ex-post IR should match the preset.");
      });
    }

    function assertBudgetBalance(expected) {
      assert(dataBoolean("revenue-text", "exPostBudgetBalanced") === expected,
        "The ex-post BB label should match the preset.");
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

    function setAllocationBrush(value) {
      var number = appDocument.getElementById("allocation-value-number");
      number.value = String(value);
      dispatchChange(number, appWindow);
    }

    function applySelectedAllocation(value) {
      setAllocationBrush(value);
      var chart = appDocument.getElementById("allocation-chart");
      dispatchKey(chart, "Enter", appWindow);
      releaseKey(chart, "Enter", appWindow);
    }

    var tests = [
      {
        name: "The sandbox route is title-only and loads local shared runtimes in order",
        run: function () {
          var sources = Array.from(appDocument.scripts).map(function (script) {
            return script.getAttribute("src");
          }).filter(Boolean);
          assert(JSON.stringify(sources) === JSON.stringify([
            "../../js/components.js",
            "../../js/mathjax-config.js",
            "../../assets/mathjax/tex-svg.js",
            "../../js/mathjax-runtime.js",
            "../../js/math-utils.js",
            "../../js/svg-utils.js",
            "../../js/bilateral-trade-envelope.js",
            "../../js/bilateral-trade-visuals.js",
            "model.js",
            "app.js"
          ]), "Shared elements, local MathJax, numeric/SVG helpers, and module files should load in order.");
          assert(appWindow.BilateralTradeVisuals &&
            typeof appWindow.BilateralTradeVisuals.bindProbeChart === "function" &&
            typeof appWindow.BilateralTradeVisuals.drawProbeScaffold === "function",
          "The shared bilateral-trade visual pipeline should be available.");
          var introduction = appDocument.querySelector(".introduction");
          assert(introduction.querySelector("h1").textContent ===
            "Bargaining Mechanism Sandbox", "The user-specified title should be present.");
          assert(introduction.querySelectorAll(":scope > *").length === 1,
            "The introduction should contain only the title.");
          assert(!appDocument.querySelector(".derivation, .notes, .references"),
            "No lesson-content sections should be published yet.");
          assert(appWindow.MechanismMath && model &&
            typeof appWindow.SvgUtils.createTriangleMesh === "function",
          "The shared runtimes and isolated sandbox model should be available.");
        }
      },
      {
        name: "Three read-only preset surfaces and six compact diagnostics use the shared geometry",
        run: function () {
          var surfaceIds = [
            "allocation-chart", "buyer-payment-chart", "seller-payment-chart"
          ];
          surfaceIds.forEach(function (id) {
            var chart = appDocument.getElementById(id);
            assert(chart && chart.getAttribute("viewBox") === "0 0 480 520",
              id + " should use the shared 480 by 520 geometry.");
            assert(chart.getAttribute("tabindex") === "0" &&
              chart.getAttribute("aria-keyshortcuts").includes("ArrowUp") &&
              chart.getAttribute("aria-readonly") === "true" &&
              chart.querySelector("title") && chart.querySelector("desc"),
            id + " should expose its read-only preset state, title, and description.");
          });
          assert(appDocument.querySelectorAll(".surface-editor-grid > .surface-editor").length === 3,
            "The surface editor should contain exactly q, pB, and pS.");
          assert(appDocument.querySelectorAll(
            ".sandbox-diagnostic-grid > .diagnostic-panel"
          ).length === 6, "The sandbox should retain the six M-S diagnostic panels.");
          assert(JSON.stringify(Array.from(appDocument.querySelectorAll(
            ".sandbox-diagnostic-grid .diagnostic-chart"
          )).map(function (chart) { return chart.id; })) === JSON.stringify([
            "buyer-ic-chart", "seller-ic-chart", "revenue-chart",
            "buyer-payoff-chart", "seller-payoff-chart", "efficiency-chart"
          ]),
          "The sandbox diagnostics should match the M-S left-to-right, " +
            "top-to-bottom order.");
          assert(Array.from(appDocument.querySelectorAll(
            ".sandbox-diagnostic-grid .diagnostic-chart"
          )).every(function (chart) {
            return chart.getAttribute("viewBox") === "0 0 480 520";
          }), "Every sandbox chart should use the same 480 by 520 geometry.");
          var mainGeometryChart = appDocument.getElementById("allocation-chart");
          var diagnosticGeometryChart = appDocument.getElementById("buyer-ic-chart");
          var mainPlotPixels = Number(mainGeometryChart.querySelector("image")
            .getAttribute("width")) * mainGeometryChart.getBoundingClientRect().width / 480;
          var diagnosticPlotPixels = Number(diagnosticGeometryChart.querySelector("image")
            .getAttribute("width")) *
              diagnosticGeometryChart.getBoundingClientRect().width / 480;
          assert(Math.abs(mainPlotPixels - diagnosticPlotPixels) <= 2 &&
            mainPlotPixels >= 335 && mainPlotPixels <= 350,
          "Main and diagnostic plot squares should share one intermediate rendered size.");
          assert(Array.from(appDocument.querySelectorAll(
            ".surface-editor .math-chart-y-axis-label"
          )).every(function (label) {
            return label.textContent.includes("Seller value") &&
              label.querySelector("mjx-container");
          }) && appDocument.getElementById("seller-ic-chart-description")
            .textContent.includes("true seller value") &&
            !/seller cost/i.test(appDocument.documentElement.textContent),
          "Every main y-axis and accessible description should use seller value.");
          var expectedDiagnosticAxes = [
            ["Buyer value", "Alternate buyer report"],
            ["Seller value", "Alternate seller report"],
            ["Buyer value", "Seller value"],
            ["Buyer value", "Seller value"],
            ["Buyer value", "Seller value"],
            ["Buyer value", "Seller value"]
          ];
          Array.from(appDocument.querySelectorAll(
            ".sandbox-diagnostic-grid > .diagnostic-panel"
          )).forEach(function (panel, index) {
            var xLabel = panel.querySelector(".math-chart-x-axis-label");
            var yLabel = panel.querySelector(".math-chart-y-axis-label");
            assert(xLabel.textContent.includes(expectedDiagnosticAxes[index][0]) &&
              yLabel.textContent.includes(expectedDiagnosticAxes[index][1]) &&
              xLabel.querySelector("mjx-container") && yLabel.querySelector("mjx-container"),
            "Every diagnostic axis should show its full name and rendered math symbol.");
          });
          assert(Array.from(appDocument.querySelectorAll(
            ".surface-choice-controls"
          )).every(function (control) {
            return control.hidden;
          }), "Preset surfaces should expose no manual editing controls.");
        }
      },
      {
        name: "Interim payoff panels map exact deviations and keep following after a click",
        run: async function () {
          click("preset-vcg");
          ["buyer", "seller"].forEach(function (agent) {
            var chart = appDocument.getElementById(agent + "-ic-chart");
            assert(chart.querySelectorAll("image[data-renderer='payoff-raster']").length === 1 &&
              chart.querySelector("image").dataset.rasterSize === "330" &&
              chart.querySelector(".truthful-report-line") &&
              chart.querySelector(".best-report-line") &&
              chart.dataset.bic === "true" &&
              chart.dataset.colorLow === "blue" &&
              chart.dataset.colorZero === "clear" &&
              chart.dataset.colorHigh === "yellow" &&
              Number(chart.dataset.maxDeviationGain) <= model.VERDICT_TOLERANCE,
            agent + " payoff should combine an exact utility raster with truthful and best-report traces.");
          });
          assert(appDocument.querySelector("#buyer-ic-chart + .math-chart-x-axis-label")
            .textContent.includes("Buyer value") &&
            appDocument.querySelector("#buyer-ic-chart ~ .math-chart-y-axis-label")
              .textContent.includes("Alternate buyer report"),
          "The buyer payoff axes should name the value and alternate report fully.");

          var buyerChart = appDocument.getElementById("buyer-ic-chart");
          var probePoint = clientPoint(buyerChart, 70 + 380 * 0.6, 420 - 380 * 0.2);
          firePointer(buyerChart, "pointerdown", probePoint.x, probePoint.y, 71, appWindow);
          await nextFrames(2);
          var buyerProbe = buyerChart.querySelector(".ic-probe");
          var buyerProbeValue = buyerProbe.querySelector(".plot-probe-text");
          var buyerCoordinates = Array.from(buyerProbe.querySelectorAll(
            ".plot-probe-coordinate"
          )).map(function (label) { return label.textContent; });
          assert(buyerProbe && buyerProbeValue.textContent.includes("= +0.100") &&
            buyerProbeValue.querySelector(".plot-probe-symbol").textContent === "U" &&
            buyerProbeValue.querySelector(".plot-probe-subscript").textContent === "B" &&
            buyerProbeValue.querySelector(".plot-probe-subscript")
              .getAttribute("baseline-shift") === "sub" &&
            buyerProbe.querySelectorAll(".plot-probe-text").length === 1 &&
            JSON.stringify(buyerCoordinates) === JSON.stringify(["0.600", "0.200"]) &&
            parseFloat(appWindow.getComputedStyle(buyerProbeValue).fontSize) *
              buyerChart.getBoundingClientRect().width /
              buyerChart.viewBox.baseVal.width <= 12 &&
            Number(buyerProbe.querySelector(".plot-probe-box")
              .getAttribute("width")) <= 80,
          "The buyer IC probe should put exact coordinates on the axes and only utility in its math-formatted box.");
          var movedPoint = clientPoint(buyerChart, 70 + 380 * 0.4, 420 - 380 * 0.1);
          firePointer(buyerChart, "pointermove", movedPoint.x, movedPoint.y, 71, appWindow);
          assert(Array.from(buyerChart.querySelectorAll(
            ".ic-probe .plot-probe-coordinate"
          )).map(function (label) { return label.textContent; }).join(",") ===
              "0.400,0.100",
          "Clicking a diagnostic should not pin the probe or stop pointer following.");

          click("preset-split-difference");
          assert(Number(appDocument.getElementById("buyer-ic-chart")
            .dataset.maxDeviationGain) > model.VERDICT_TOLERANCE,
          "A non-IC direct rule should move the best-report trace off the truthful diagonal.");
          click("preset-vcg");
        }
      },
      {
        name: "The default VCG preset reports actual-payment IC, all IR levels, and its deficit",
        run: function () {
          assertAgentStatuses({ bic: true, dsic: true });
          assertIrStatuses({ exAnte: true, interim: true, exPost: true });
          assertBudgetBalance(false);
          assertClose(
            Number(appDocument.getElementById("efficiency-text").dataset.efficiencyLoss),
            0,
            "VCG should be efficient."
          );
          assert(appDocument.getElementById("buyer-ic-text").textContent.includes("Buyer BIC") &&
            appDocument.getElementById("buyer-ic-text").textContent.includes("Buyer DSIC") &&
            appDocument.getElementById("buyer-payoff-text").textContent.includes("ex-ante IR") &&
            appDocument.getElementById("buyer-payoff-text").textContent.includes("interim IR") &&
            appDocument.getElementById("buyer-payoff-text").textContent.includes("ex-post IR") &&
            appDocument.getElementById("revenue-text").textContent.includes("Ex-post BB"),
          "Every requested diagnostic label should be visible.");
          assert(appDocument.getElementById("buyer-ic-text").children.length === 2 &&
            appDocument.getElementById("seller-ic-text").children.length === 2 &&
            !appDocument.getElementById("buyer-ic-text").textContent.includes("Q") &&
            !appDocument.getElementById("seller-ic-text").textContent.includes("Q") &&
            appDocument.getElementById("buyer-payoff-text").children.length === 3 &&
            appDocument.getElementById("seller-payoff-text").children.length === 3 &&
            !appDocument.getElementById("buyer-payoff-text").textContent
              .includes("Expected buyer payoff:") &&
            !appDocument.getElementById("seller-payoff-text").textContent
              .includes("Expected seller payoff:"),
          "The four requested redundant first diagnostic lines should be absent.");
        }
      },
      {
        name: "All six direct-mechanism presets expose their controls and distinguishing verdicts",
        run: function () {
          click("preset-posted-price");
          var postedBuyerSlider = appDocument.getElementById(
            "posted-buyer-price-slider"
          );
          var postedSellerSlider = appDocument.getElementById(
            "posted-seller-receipt-slider"
          );
          assert(!appDocument.getElementById("posted-price-control").hidden &&
            !appDocument.getElementById("posted-seller-receipt-control").hidden &&
            Number(postedBuyerSlider.value) === 0.5 &&
            Number(postedSellerSlider.value) === 0.5 &&
            Number(postedBuyerSlider.step) === 0.01 &&
            Number(postedSellerSlider.step) === 0.01,
          "Posted price should expose hundredth-step buyer-price and seller-receipt controls.");
          assertAgentStatuses({ bic: true, dsic: true });
          assertIrStatuses({ exAnte: true, interim: true, exPost: true });
          assertBudgetBalance(true);

          click("preset-agv");
          assert(!appDocument.getElementById("agv-k-control").hidden,
            "The AGV normalization should appear with its preset.");
          assertAgentStatuses({ bic: true, dsic: false });
          assertIrStatuses({ exAnte: true, interim: false, exPost: false });
          assertBudgetBalance(true);

          click("preset-split-difference");
          var splitSlider = appDocument.getElementById("split-seller-share-slider");
          var splitThresholdSlider = appDocument.getElementById(
            "split-threshold-slider"
          );
          assert(!appDocument.getElementById("split-threshold-control").hidden &&
            !appDocument.getElementById("split-seller-share-control").hidden &&
            Number(appDocument.getElementById("split-threshold-number").value) ===
              0 &&
            Number(splitThresholdSlider.value) === 0 &&
            Number(splitThresholdSlider.min) === 0 &&
            Number(splitThresholdSlider.max) === 1 &&
            Number(splitThresholdSlider.step) === 0.01 &&
            Number(appDocument.getElementById("split-seller-share-number").value) === 0.5 &&
            Number(splitSlider.value) === 0.5 && Number(splitSlider.min) === 0 &&
            Number(splitSlider.max) === 1 && Number(splitSlider.step) === 0.01,
          "Split-the-difference should expose a threshold defaulting to zero and a seller share defaulting to one half.");
          assertAgentStatuses({ bic: false, dsic: false });
          assertIrStatuses({ exAnte: true, interim: true, exPost: true });
          assertBudgetBalance(true);

          click("preset-chatterjee-samuelson");
          assert(!appDocument.getElementById("cs-threshold-control") &&
            !appDocument.getElementById("cs-seller-share-control") &&
            appDocument.getElementById("split-threshold-control").hidden &&
            appDocument.getElementById("split-seller-share-control").hidden,
          "Chatterjee-Samuelson should be fixed at its canonical rule without parameter controls.");
          assertAgentStatuses({ bic: true, dsic: false });
          assertIrStatuses({ exAnte: true, interim: true, exPost: true });
          assertBudgetBalance(true);

          click("preset-revenue-threshold");
          ["revenue-threshold", "revenue-buyer-markup",
            "revenue-seller-discount"].forEach(function (prefix) {
            var slider = appDocument.getElementById(prefix + "-slider");
            assert(!appDocument.getElementById(prefix + "-control").hidden &&
              Number(slider.value) === 0.5 && Number(slider.min) === 0 &&
              Number(slider.max) === 1 && Number(slider.step) === 0.01,
            prefix + " should expose a hundredth-step control defaulting to one half.");
          });
          assertAgentStatuses({ bic: true, dsic: true });
          assertIrStatuses({ exAnte: true, interim: true, exPost: true });
          assertBudgetBalance(false);

          click("preset-vcg");
          assertAgentStatuses({ bic: true, dsic: true });
          assertBudgetBalance(false);
        }
      },
      {
        name: "Exact preset surfaces use smooth compact cached raster layers",
        run: function () {
          click("preset-agv");
          ["allocation-chart", "buyer-payment-chart", "seller-payment-chart"]
            .forEach(function (id) {
              var chart = appDocument.getElementById(id);
              var images = chart.querySelectorAll("image[data-renderer='raster']");
              assert(images.length === 1 &&
                images[0].getAttribute("href").indexOf("data:image/png") === 0 &&
                images[0].dataset.rasterSize === "800",
              id + " should contain one local raster layer.");
              assert(chart.querySelectorAll("*").length < 50,
                id + " should not rebuild thousands of SVG nodes.");
            });
          assert(appDocument.getElementById("allocation-chart")
            .querySelector(".preset-boundary") &&
            !appDocument.getElementById("buyer-payment-chart")
              .querySelector(".preset-boundary"),
          "The AGV allocation should show its exact discontinuity while its continuous payments need none.");
          assert(appDocument.querySelector("#buyer-payment-chart image").getAttribute("href") !==
            appDocument.querySelector("#seller-payment-chart image").getAttribute("href") &&
            appDocument.getElementById("seller-payment-chart").dataset.colorLow === "green" &&
            appDocument.getElementById("seller-payment-chart").dataset.colorZero === "clear" &&
            appDocument.getElementById("seller-payment-chart").dataset.colorHigh === "red",
          "Seller payments should use their requested green-clear-red scale independently.");
          assert(appDocument.getElementById("buyer-payment-chart-description")
            .textContent.includes("cached raster"),
          "The accessible description should disclose the display pipeline.");
        }
      },
      {
        name: "The remaining diagnostics use exact cached rasters and exact compact probes",
        run: async function () {
          click("preset-vcg");
          ["buyer-payoff-chart", "seller-payoff-chart", "revenue-chart",
            "efficiency-chart"].forEach(function (id) {
            var chart = appDocument.getElementById(id);
            var image = chart.querySelector("image[data-renderer='diagnostic-raster']");
            assert(image && image.dataset.rasterSize === "330" &&
              image.getAttribute("href").indexOf("data:image/png") === 0 &&
              chart.tabIndex === 0 && chart.querySelectorAll("*").length < 35 &&
              chart.querySelector("desc").textContent.includes("probe values are exact"),
            id + " should use one accessible exact-field raster.");
          });
          ["buyer-payoff-chart", "seller-payoff-chart"].forEach(function (id) {
            var chart = appDocument.getElementById(id);
            assert(chart.dataset.colorLow === "blue" &&
              chart.dataset.colorZero === "clear" &&
              chart.dataset.colorHigh === "yellow",
            id + " should use the shared blue-clear-yellow payoff scale.");
          });
          var buyerPayoff = appDocument.getElementById("buyer-payoff-chart");
          var point = clientPoint(buyerPayoff, 70 + 380 * 0.8, 420 - 380 * 0.3);
          firePointer(buyerPayoff, "pointermove", point.x, point.y, 73, appWindow);
          await nextFrames(1);
          var fieldProbe = buyerPayoff.querySelector(".field-probe");
          assert(fieldProbe && fieldProbe.querySelector(".plot-probe-text")
              .textContent.includes("= +0.500") &&
            fieldProbe.querySelector(".plot-probe-symbol").textContent === "u" &&
            fieldProbe.querySelector(".plot-probe-subscript").textContent === "B" &&
            Array.from(fieldProbe.querySelectorAll(".plot-probe-coordinate"))
              .map(function (label) { return label.textContent; }).join(",") ===
                "0.800,0.300" &&
            Number(fieldProbe.querySelector(".plot-probe-box")
              .getAttribute("width")) <= 104,
          "The truthful buyer-payoff probe should evaluate the exact VCG patch.");
          var revenue = appDocument.getElementById("revenue-chart");
          var revenuePoint = clientPoint(
            revenue, 70 + 380 * 0.8, 420 - 380 * 0.3
          );
          firePointer(
            revenue, "pointermove", revenuePoint.x, revenuePoint.y,
            75, appWindow
          );
          await nextFrames(1);
          assert(revenue.querySelector(".field-probe .plot-probe-symbol")
            .textContent === "Rev",
          "The revenue probe should use Rev rather than R.");
          var efficiency = appDocument.getElementById("efficiency-chart");
          var efficiencyPoint = clientPoint(
            efficiency, 70 + 380 * 0.8, 420 - 380 * 0.3
          );
          firePointer(
            efficiency, "pointermove", efficiencyPoint.x, efficiencyPoint.y,
            76, appWindow
          );
          await nextFrames(1);
          var efficiencyProbe = efficiency.querySelector(".field-probe");
          assert(efficiencyProbe.querySelector(".plot-probe-text").textContent ===
              "Loss = 0.000" &&
            !efficiencyProbe.querySelector(".plot-probe-symbol") &&
            Array.from(efficiencyProbe.querySelectorAll(".plot-probe-coordinate"))
              .map(function (label) { return label.textContent; }).join(",") ===
                "0.800,0.300",
          "The efficiency box should show only three-decimal loss.");
        }
      },
      {
        name: "Preset surface probes report exact model values without recomputing diagnostics",
        run: async function () {
          click("preset-vcg");
          var chart = appDocument.getElementById("allocation-chart");
          var point = clientPoint(chart, 70 + 380 * 0.8, 420 - 380 * 0.3);
          firePointer(chart, "pointerdown", point.x, point.y, 72, appWindow);
          firePointer(chart, "pointerup", point.x, point.y, 72, appWindow);
          await nextFrames(2);
          var probe = chart.querySelector(".surface-probe");
          var allocationOutput = probe ?
            probe.querySelector(".plot-probe-text") : null;
          var allocationCoordinates = probe ?
            Array.from(probe.querySelectorAll(".plot-probe-coordinate"))
              .map(function (label) { return label.textContent; }) : [];
          assert(probe && allocationOutput && allocationOutput.textContent
              .includes("q = 1.000") &&
            probe.querySelectorAll(".plot-probe-text").length === 1 &&
            !allocationOutput.textContent.includes("p") &&
            allocationCoordinates.join(",") === "0.800,0.300",
          "The allocation hover box should contain only exact q, with v and c beside the axes. Received " +
            (allocationOutput ? allocationOutput.textContent : "no output") +
            " at " + allocationCoordinates.join(",") + ".");
          var movedSurfacePoint = clientPoint(
            chart, 70 + 380 * 0.7, 420 - 380 * 0.2
          );
          firePointer(
            chart, "pointermove", movedSurfacePoint.x, movedSurfacePoint.y,
            72, appWindow
          );
          await nextFrames(2);
          assert(Array.from(chart.querySelectorAll(
            ".surface-probe .plot-probe-coordinate"
          )).map(function (label) { return label.textContent; }).join(",") ===
              "0.700,0.200",
          "A main probe should keep following the pointer after a click.");
          var paymentProbes = [
            { id: "buyer-payment-chart", subscript: "B", value: "0.300" },
            { id: "seller-payment-chart", subscript: "S", value: "0.800" }
          ];
          for (var index = 0; index < paymentProbes.length; index += 1) {
            var specification = paymentProbes[index];
            var paymentChart = appDocument.getElementById(specification.id);
            var paymentPoint = clientPoint(
              paymentChart, 70 + 380 * 0.8, 420 - 380 * 0.3
            );
            firePointer(
              paymentChart, "pointerdown", paymentPoint.x, paymentPoint.y,
              74 + index, appWindow
            );
            await nextFrames(1);
            var paymentProbe = paymentChart.querySelector(".surface-probe");
            var paymentOutput = paymentProbe ?
              paymentProbe.querySelector(".plot-probe-text") : null;
            assert(paymentProbe && paymentOutput &&
              paymentOutput.textContent.includes("= " + specification.value) &&
              paymentOutput.querySelector(".plot-probe-symbol").textContent === "p" &&
              paymentOutput.querySelector(".plot-probe-subscript").textContent ===
                specification.subscript &&
              paymentProbe.querySelectorAll(".plot-probe-text").length === 1 &&
              Array.from(paymentProbe.querySelectorAll(".plot-probe-coordinate"))
                .map(function (label) { return label.textContent; }).join(",") ===
                  "0.800,0.300",
            specification.id + " should show only its exact payment output in the box.");
          }
          chart.focus();
          dispatchKey(chart, "ArrowRight", appWindow);
          assert(appDocument.getElementById("surface-probe-status")
            .textContent.includes("allocation"),
          "A read-only preset chart should expose the same exact probe by keyboard.");
          dispatchKey(chart, "Escape", appWindow);
        }
      },
      {
        name: "Posted-price controls allow subsidy spreads and AGV remains unrestricted in sign",
        run: function () {
          click("preset-posted-price");
          var buyer = appDocument.getElementById("posted-buyer-price-number");
          var seller = appDocument.getElementById("posted-seller-receipt-number");
          buyer.value = "0.67";
          dispatchChange(buyer, appWindow);
          assert(buyer.value === "0.67" && seller.value === "0.50" &&
            appDocument.getElementById("posted-buyer-price-slider").value === "0.67",
          "A buyer-price change should preserve a lower seller receipt.");
          seller.value = "0.72";
          dispatchChange(seller, appWindow);
          assert(buyer.value === "0.67" && seller.value === "0.72" &&
            appDocument.getElementById("posted-seller-receipt-slider").value === "0.72",
          "Raising the seller receipt above the buyer price should leave the buyer control unchanged.");
          buyer.value = "0.43";
          dispatchChange(buyer, appWindow);
          assert(buyer.value === "0.43" && seller.value === "0.72" &&
            Number(appDocument.getElementById("revenue-text")
              .dataset.expectedRevenue) < 0,
          "Lowering the buyer price should leave the seller receipt unchanged and permit an expected subsidy.");

          click("preset-agv");
          var k = appDocument.getElementById("agv-k-number");
          var slider = appDocument.getElementById("agv-k-slider");
          k.value = "-0.75";
          dispatchChange(k, appWindow);
          assert(k.value === "-0.75" && slider.value === "-0.75" &&
            Number(slider.min) <= -0.75 && Number(slider.max) >= 0.75,
          "The AGV constant should accept signed values beyond the slider's initial soft range.");
        }
      },
      {
        name: "Preset sliders preview surfaces and debounce diagnostics after pointer release",
        run: async function () {
          click("preset-split-difference");
          var splitSlider = appDocument.getElementById("split-seller-share-slider");
          var splitNumber = appDocument.getElementById("split-seller-share-number");
          var splitPaymentBefore = appDocument.querySelector(
            "#buyer-payment-chart image[data-renderer='raster']"
          ).getAttribute("href");
          var splitDiagnosticBefore = appDocument.querySelector(
            "#buyer-ic-chart image[data-renderer='payoff-raster']"
          ).getAttribute("href");
          var splitPayoffBefore = appDocument.getElementById(
            "buyer-payoff-text"
          ).dataset.expectedBuyerPayoff;
          firePointer(splitSlider, "pointerdown", 0, 0, 91, appWindow);
          splitSlider.value = "0.75";
          dispatchInput(splitSlider, appWindow);
          assert(Number(splitNumber.value) === 0.75,
            "The split seller-share number should follow the active slider gesture.");
          await nextFrames(6);
          var splitPreview = appDocument.querySelector(
            "#buyer-payment-chart image[data-renderer='raster']"
          );
          assert(splitPreview.getAttribute("href") !== splitPaymentBefore &&
            splitPreview.dataset.rasterSize === "240" &&
            appDocument.querySelector(
              "#buyer-ic-chart image[data-renderer='payoff-raster']"
            ).getAttribute("href") === splitDiagnosticBefore &&
            appDocument.getElementById("buyer-payoff-text")
              .dataset.expectedBuyerPayoff === splitPayoffBefore,
          "Split payments should preview while exact diagnostics remain committed.");
          firePointer(splitSlider, "pointerup", 0, 0, 91, appWindow);
          assert(appDocument.querySelector(
            "#buyer-payment-chart image[data-renderer='raster']"
          ).dataset.rasterSize === "240" &&
            appDocument.querySelector(
              "#buyer-ic-chart image[data-renderer='payoff-raster']"
            ).getAttribute("href") === splitDiagnosticBefore,
          "Pointer release should retain the final preview during the diagnostic debounce.");
          await nextFrames(4);
          assert(appDocument.querySelector(
            "#buyer-ic-chart image[data-renderer='payoff-raster']"
          ).getAttribute("href") === splitDiagnosticBefore,
          "Split diagnostics should remain unchanged during the first half of the debounce.");
          await waitFor(function () {
            return appDocument.querySelector(
              "#buyer-ic-chart image[data-renderer='payoff-raster']"
            ).getAttribute("href") !== splitDiagnosticBefore;
          }, 2500);
          assert(appDocument.querySelector(
            "#buyer-payment-chart image[data-renderer='raster']"
          ).dataset.rasterSize === "800",
          "Split diagnostics should commit with the full preset raster after the debounce.");
          var splitPaymentAfterRelease = appDocument.querySelector(
            "#buyer-payment-chart image[data-renderer='raster']"
          ).getAttribute("href");
          var splitPayoffAfterRelease = appDocument.getElementById(
            "buyer-payoff-text"
          ).dataset.expectedBuyerPayoff;
          splitNumber.value = "0.6";
          dispatchChange(splitNumber, appWindow);
          assert(Number(splitSlider.value) === 0.6 &&
            appDocument.querySelector(
              "#buyer-payment-chart image[data-renderer='raster']"
            ).getAttribute("href") !== splitPaymentAfterRelease &&
            appDocument.getElementById("buyer-payoff-text")
              .dataset.expectedBuyerPayoff !== splitPayoffAfterRelease,
          "A split number-field change should synchronize and apply immediately.");

          var splitThresholdSlider = appDocument.getElementById(
            "split-threshold-slider"
          );
          var splitThresholdNumber = appDocument.getElementById(
            "split-threshold-number"
          );
          var allocationChart = appDocument.getElementById("allocation-chart");
          var splitAllocationBefore = allocationChart.querySelector(
            "image[data-renderer='raster']"
          ).getAttribute("href");
          var splitBoundaryBefore = allocationChart.querySelector(
            ".preset-boundary"
          ).getAttribute("x1");
          var splitThresholdDiagnosticBefore = appDocument.querySelector(
            "#buyer-ic-chart image[data-renderer='payoff-raster']"
          ).getAttribute("href");
          var splitLossBefore = appDocument.getElementById(
            "efficiency-text"
          ).dataset.efficiencyLoss;
          firePointer(splitThresholdSlider, "pointerdown", 0, 0, 92, appWindow);
          splitThresholdSlider.value = "0.4";
          dispatchInput(splitThresholdSlider, appWindow);
          assert(Number(splitThresholdNumber.value) === 0.4,
            "The split threshold number should follow the active slider gesture.");
          await nextFrames(6);
          var splitThresholdPreview = allocationChart.querySelector(
            "image[data-renderer='raster']"
          );
          assert(splitThresholdPreview.getAttribute("href") !==
              splitAllocationBefore &&
            splitThresholdPreview.dataset.rasterSize === "240" &&
            allocationChart.querySelector(".preset-boundary").getAttribute("x1") !==
              splitBoundaryBefore &&
            appDocument.querySelector(
              "#buyer-ic-chart image[data-renderer='payoff-raster']"
            ).getAttribute("href") === splitThresholdDiagnosticBefore &&
            appDocument.getElementById("efficiency-text")
              .dataset.efficiencyLoss === splitLossBefore,
          "The split allocation should preview while diagnostics remain committed.");
          firePointer(
            splitThresholdSlider, "pointercancel", 0, 0, 92, appWindow
          );
          var firstThresholdPreviewHref = allocationChart.querySelector(
            "image[data-renderer='raster']"
          ).getAttribute("href");
          assert(allocationChart.querySelector(
            "image[data-renderer='raster']"
          ).dataset.rasterSize === "240" &&
            appDocument.querySelector(
              "#buyer-ic-chart image[data-renderer='payoff-raster']"
            ).getAttribute("href") === splitThresholdDiagnosticBefore &&
            appDocument.getElementById("efficiency-text")
              .dataset.efficiencyLoss === splitLossBefore,
          "Pointer cancellation should schedule rather than immediately run exact diagnostics.");
          await nextFrames(2);
          firePointer(splitThresholdSlider, "pointerdown", 0, 0, 96, appWindow);
          splitThresholdSlider.value = "0.45";
          dispatchInput(splitThresholdSlider, appWindow);
          firePointer(splitThresholdSlider, "pointerup", 0, 0, 96, appWindow);
          assert(Number(splitThresholdNumber.value) === 0.45 &&
            allocationChart.querySelector(
              "image[data-renderer='raster']"
            ).getAttribute("href") !== firstThresholdPreviewHref &&
            allocationChart.querySelector(
              "image[data-renderer='raster']"
            ).dataset.rasterSize === "240",
          "A rapid second gesture should flush its latest preview on release.");
          await nextFrames(7);
          assert(appDocument.querySelector(
            "#buyer-ic-chart image[data-renderer='payoff-raster']"
          ).getAttribute("href") === splitThresholdDiagnosticBefore &&
            appDocument.getElementById("efficiency-text")
              .dataset.efficiencyLoss === splitLossBefore,
          "A rapid second gesture should cancel and restart the first pending commit.");
          await waitFor(function () {
            return appDocument.querySelector(
              "#buyer-ic-chart image[data-renderer='payoff-raster']"
            ).getAttribute("href") !== splitThresholdDiagnosticBefore;
          }, 2500);
          assert(allocationChart.querySelector(
            "image[data-renderer='raster']"
          ).dataset.rasterSize === "800" &&
            appDocument.getElementById("efficiency-text")
              .dataset.efficiencyLoss !== splitLossBefore,
          "Only the rescheduled split threshold should commit after its debounce.");

          var keyboardBoundaryBefore = allocationChart.querySelector(".preset-boundary")
            .getAttribute("x1");
          var keyboardLossBefore = appDocument.getElementById(
            "efficiency-text"
          ).dataset.efficiencyLoss;
          splitThresholdSlider.value = "0.35";
          dispatchInput(splitThresholdSlider, appWindow);
          assert(Number(splitThresholdNumber.value) === 0.35 &&
            allocationChart.querySelector(".preset-boundary").getAttribute("x1") !==
              keyboardBoundaryBefore &&
            appDocument.getElementById("efficiency-text")
              .dataset.efficiencyLoss !== keyboardLossBefore &&
            allocationChart.querySelector(
              "image[data-renderer='raster']"
            ).dataset.rasterSize === "800",
          "Slider input without a pointer gesture should apply diagnostics immediately for keyboard use.");

          click("preset-posted-price");
          var postedSellerSlider = appDocument.getElementById(
            "posted-seller-receipt-slider"
          );
          var postedAllocationBefore = appDocument.querySelector(
            "#allocation-chart image[data-renderer='raster']"
          ).getAttribute("href");
          var postedLossBefore = appDocument.getElementById(
            "efficiency-text"
          ).dataset.efficiencyLoss;
          firePointer(postedSellerSlider, "pointerdown", 0, 0, 93, appWindow);
          postedSellerSlider.value = "0.63";
          dispatchInput(postedSellerSlider, appWindow);
          await nextFrames(6);
          assert(Number(appDocument.getElementById(
            "posted-buyer-price-number"
          ).value) === 0.43 &&
            Number(appDocument.getElementById(
              "posted-seller-receipt-number"
            ).value) === 0.63 &&
            appDocument.querySelector(
              "#allocation-chart image[data-renderer='raster']"
            ).getAttribute("href") !== postedAllocationBefore &&
            appDocument.getElementById("efficiency-text")
              .dataset.efficiencyLoss === postedLossBefore,
          "The seller receipt should preview trade without changing the buyer price.");
          firePointer(postedSellerSlider, "pointerup", 0, 0, 93, appWindow);
          assert(appDocument.getElementById("efficiency-text")
            .dataset.efficiencyLoss === postedLossBefore &&
            appDocument.querySelector(
              "#allocation-chart image[data-renderer='raster']"
            ).dataset.rasterSize === "240",
          "Seller-price release should retain its preview during the debounce.");
          await waitFor(function () {
            return appDocument.getElementById("efficiency-text")
              .dataset.efficiencyLoss !== postedLossBefore;
          }, 2500);
          assert(appDocument.querySelector(
            "#allocation-chart image[data-renderer='raster']"
          ).dataset.rasterSize === "800",
          "Seller-price diagnostics should commit after the debounce.");
          var postedBuyerSlider = appDocument.getElementById(
            "posted-buyer-price-slider"
          );
          var postedAllocationAfterSeller = appDocument.querySelector(
            "#allocation-chart image[data-renderer='raster']"
          ).getAttribute("href");
          var postedLossAfterSeller = appDocument.getElementById(
            "efficiency-text"
          ).dataset.efficiencyLoss;
          firePointer(postedBuyerSlider, "pointerdown", 0, 0, 95, appWindow);
          postedBuyerSlider.value = "0.58";
          dispatchInput(postedBuyerSlider, appWindow);
          await nextFrames(6);
          assert(Number(appDocument.getElementById(
            "posted-buyer-price-number"
          ).value) === 0.58 &&
            Number(appDocument.getElementById(
              "posted-seller-receipt-number"
            ).value) === 0.63 &&
            appDocument.querySelector(
              "#allocation-chart image[data-renderer='raster']"
            ).getAttribute("href") !== postedAllocationAfterSeller &&
            appDocument.getElementById("efficiency-text")
              .dataset.efficiencyLoss === postedLossAfterSeller,
          "The buyer price should preview trade without changing the seller receipt or committed diagnostics.");
          firePointer(postedBuyerSlider, "pointercancel", 0, 0, 95, appWindow);
          assert(appDocument.getElementById("efficiency-text")
            .dataset.efficiencyLoss === postedLossAfterSeller,
          "Buyer-price cancellation should retain committed diagnostics during the debounce.");
          await waitFor(function () {
            return appDocument.getElementById("efficiency-text")
              .dataset.efficiencyLoss !== postedLossAfterSeller;
          }, 2500);
          var postedBuyerNumber = appDocument.getElementById(
            "posted-buyer-price-number"
          );
          postedBuyerNumber.value = "0.42";
          dispatchChange(postedBuyerNumber, appWindow);
          assert(Number(appDocument.getElementById(
            "posted-seller-receipt-number"
          ).value) === 0.63,
          "A buyer-price number change should leave the seller receipt unchanged.");

          click("preset-revenue-threshold");
          var markupSlider = appDocument.getElementById(
            "revenue-buyer-markup-slider"
          );
          var revenuePaymentBefore = appDocument.querySelector(
            "#buyer-payment-chart image[data-renderer='raster']"
          ).getAttribute("href");
          var expectedRevenueBefore = appDocument.getElementById(
            "revenue-text"
          ).dataset.expectedRevenue;
          firePointer(markupSlider, "pointerdown", 0, 0, 94, appWindow);
          markupSlider.value = "0.4";
          dispatchInput(markupSlider, appWindow);
          await nextFrames(6);
          assert(appDocument.querySelector(
            "#buyer-payment-chart image[data-renderer='raster']"
          ).getAttribute("href") !== revenuePaymentBefore &&
            appDocument.getElementById("revenue-text")
              .dataset.expectedRevenue === expectedRevenueBefore,
          "Revenue-threshold payments should preview without changing diagnostics.");
          firePointer(markupSlider, "pointerup", 0, 0, 94, appWindow);
          assert(appDocument.getElementById("revenue-text")
            .dataset.expectedRevenue === expectedRevenueBefore,
          "Revenue-threshold release should retain committed diagnostics during the debounce.");
          await waitFor(function () {
            return appDocument.getElementById("revenue-text")
              .dataset.expectedRevenue !== expectedRevenueBefore;
          }, 2500);
        }
      },
      {
        name: "Immediate preset actions cancel pending debounced commits",
        run: async function () {
          click("preset-split-difference");
          var slider = appDocument.getElementById("split-threshold-slider");
          var number = appDocument.getElementById("split-threshold-number");
          var originalSetTimeout = appWindow.setTimeout;
          var originalClearTimeout = appWindow.clearTimeout;
          var scheduledCommitIds = [];
          var clearedIds = [];
          appWindow.setTimeout = function (callback, delay) {
            var timerId = originalSetTimeout.call(appWindow, callback, delay);
            if (delay === 200) {
              scheduledCommitIds.push(timerId);
            }
            return timerId;
          };
          appWindow.clearTimeout = function (timerId) {
            clearedIds.push(timerId);
            return originalClearTimeout.call(appWindow, timerId);
          };
          try {
            var committedLoss = appDocument.getElementById(
              "efficiency-text"
            ).dataset.efficiencyLoss;
            firePointer(slider, "pointerdown", 0, 0, 97, appWindow);
            slider.value = "0.22";
            dispatchInput(slider, appWindow);
            firePointer(slider, "pointerup", 0, 0, 97, appWindow);
            assert(scheduledCommitIds.length === 1,
              "Pointer release should schedule one 200 ms exact commit.");
            var carriedCommitTimer = scheduledCommitIds[0];
            firePointer(slider, "pointerdown", 0, 0, 100, appWindow);
            firePointer(slider, "pointerup", 0, 0, 100, appWindow);
            assert(clearedIds.includes(carriedCommitTimer) &&
              scheduledCommitIds.length === 2,
            "A no-change follow-up gesture should carry the dirty preview into one rescheduled commit.");
            var numberCommitTimer = scheduledCommitIds[1];
            number.value = "0.18";
            dispatchChange(number, appWindow);
            assert(clearedIds.includes(numberCommitTimer) &&
              Number(slider.value) === 0.18 &&
              appDocument.getElementById("efficiency-text")
                .dataset.efficiencyLoss !== committedLoss,
            "An immediate number change should cancel the pending timer and commit exactly.");

            firePointer(slider, "pointerdown", 0, 0, 98, appWindow);
            slider.value = "0.27";
            dispatchInput(slider, appWindow);
            firePointer(slider, "pointercancel", 0, 0, 98, appWindow);
            var presetSwitchTimer = scheduledCommitIds[
              scheduledCommitIds.length - 1
            ];
            click("preset-vcg");
            assert(clearedIds.includes(presetSwitchTimer) &&
              appDocument.getElementById("preset-vcg")
                .getAttribute("aria-pressed") === "true",
            "Switching presets should cancel the pending exact commit.");
            await nextFrames(10);
            assert(appDocument.getElementById("preset-vcg")
                .getAttribute("aria-pressed") === "true" &&
              appDocument.getElementById("preset-split-difference")
                .getAttribute("aria-pressed") === "false",
            "A canceled timer should not restore its stale preset.");

            click("preset-split-difference");
            var originalSetPointerCapture = slider.setPointerCapture;
            var originalHasPointerCapture = slider.hasPointerCapture;
            var originalReleasePointerCapture = slider.releasePointerCapture;
            var capturedPointerId = null;
            var releasedPointerId = null;
            slider.setPointerCapture = function (pointerId) {
              capturedPointerId = pointerId;
            };
            slider.hasPointerCapture = function (pointerId) {
              return capturedPointerId === pointerId;
            };
            slider.releasePointerCapture = function (pointerId) {
              releasedPointerId = pointerId;
              capturedPointerId = null;
            };
            try {
              firePointer(slider, "pointerdown", 0, 0, 101, appWindow);
              slider.value = "0.28";
              dispatchInput(slider, appWindow);
              click("preset-vcg");
              slider.value = "0.29";
              dispatchInput(slider, appWindow);
              assert(releasedPointerId === 101 &&
                appDocument.getElementById("preset-vcg")
                  .getAttribute("aria-pressed") === "true" &&
                appDocument.getElementById("preset-split-difference")
                  .getAttribute("aria-pressed") === "false",
              "A preset switch should release capture and ignore stale hidden-slider input.");
            } finally {
              slider.setPointerCapture = originalSetPointerCapture;
              slider.hasPointerCapture = originalHasPointerCapture;
              slider.releasePointerCapture = originalReleasePointerCapture;
            }

            click("preset-split-difference");
            firePointer(slider, "pointerdown", 0, 0, 99, appWindow);
            slider.value = "0.31";
            dispatchInput(slider, appWindow);
            firePointer(slider, "pointerup", 0, 0, 99, appWindow);
            var modeSwitchTimer = scheduledCommitIds[
              scheduledCommitIds.length - 1
            ];
            click("preset-custom");
            assert(clearedIds.includes(modeSwitchTimer) &&
              appDocument.getElementById("preset-custom")
                .getAttribute("aria-pressed") === "true",
            "Switching to Custom should cancel the pending preset commit.");
            await nextFrames(10);
            assert(appDocument.getElementById("preset-custom")
                .getAttribute("aria-pressed") === "true",
            "A canceled preset timer should not exit Custom mode.");
          } finally {
            scheduledCommitIds.forEach(function (timerId) {
              originalClearTimeout.call(appWindow, timerId);
            });
            appWindow.setTimeout = originalSetTimeout;
            appWindow.clearTimeout = originalClearTimeout;
          }
        }
      },
      {
        name: "Custom without Fix IC/IR exposes three independent brush editors",
        run: function () {
          click("preset-custom");
          assert(!appDocument.getElementById("fix-ic-ir-control").hidden &&
            !appDocument.getElementById("fix-ic-ir-checkbox").checked,
          "Custom should reveal the unchecked Fix IC/IR checkbox.");
          assert(Array.from(appDocument.querySelectorAll(
            ".surface-choice-controls"
          )).every(function (control) {
            return !control.hidden;
          }), "Unchecked Custom should expose all three editing controls.");
          var allocationChart = appDocument.getElementById("allocation-chart");
          assert(allocationChart.querySelector("image").dataset.rasterSize === "240",
            "Custom should retain the lower-cost editing raster.");
          ["allocation-chart", "buyer-payment-chart", "seller-payment-chart"]
            .forEach(function (id) {
              var chart = appDocument.getElementById(id);
              assert(chart.getAttribute("tabindex") === "0" &&
                chart.getAttribute("aria-readonly") === "false" &&
                chart.getAttribute("aria-keyshortcuts").includes("ArrowUp") &&
                chart.getAttribute("aria-keyshortcuts").includes("l") &&
                chart.getAttribute("aria-keyshortcuts").includes("r") &&
                chart.getAttribute("aria-keyshortcuts").includes("Enter") &&
                chart.getAttribute("aria-keyshortcuts").includes("Space"),
              id + " should expose its full keyboard editing path.");
            });
          var buyerSlider = appDocument.getElementById("buyer-payment-value-slider");
          var sellerSlider = appDocument.getElementById("seller-payment-value-slider");
          var buyerBefore = buyerSlider.getAttribute("aria-valuetext");
          var sellerBefore = sellerSlider.getAttribute("aria-valuetext");
          dispatchKey(allocationChart, "ArrowLeft", appWindow);
          assert(buyerSlider.getAttribute("aria-valuetext") === buyerBefore &&
            sellerSlider.getAttribute("aria-valuetext") === sellerBefore &&
            buyerSlider.getAttribute("aria-valuetext").includes("brush =") &&
            sellerSlider.getAttribute("aria-valuetext").includes("brush ="),
          "Moving one chart should not change any surface's chosen brush.");
          assert(allocationChart.querySelector(".cell-cursor") &&
            !appDocument.getElementById("buyer-payment-chart")
              .querySelector(".cell-cursor") &&
            !appDocument.getElementById("seller-payment-chart")
              .querySelector(".cell-cursor"),
          "Only the active allocation surface should display the shared selection.");

          var buyerChart = appDocument.getElementById("buyer-payment-chart");
          buyerChart.dispatchEvent(new appWindow.FocusEvent("focus"));
          assert(buyerChart.querySelector(".cell-cursor") &&
            !allocationChart.querySelector(".cell-cursor") &&
            !appDocument.getElementById("seller-payment-chart")
              .querySelector(".cell-cursor"),
          "Focusing another editable surface should move the visible selector there only.");
          dispatchKey(buyerChart, "Home", appWindow);
          assert(buyerChart.querySelector(".cell-label").textContent
              .startsWith("[0.00, 0.01)") &&
            buyerChart.querySelector(".cell-label").textContent.endsWith(" L"),
          "Home should start on the leftmost cell's L triangle.");
          dispatchKey(buyerChart, "ArrowRight", appWindow);
          assert(buyerChart.querySelector(".cell-label").textContent
              .startsWith("[0.00, 0.01)") &&
            buyerChart.querySelector(".cell-label").textContent.endsWith(" R"),
          "The first ArrowRight should visit R in the same cell.");
          dispatchKey(buyerChart, "ArrowRight", appWindow);
          assert(buyerChart.querySelector(".cell-label").textContent
              .startsWith("[0.01, 0.02)") &&
            buyerChart.querySelector(".cell-label").textContent.endsWith(" L"),
          "The next ArrowRight should move to L in the next cell.");
          var down;
          for (down = 0; down < 2 * R; down += 1) {
            dispatchKey(buyerChart, "ArrowDown", appWindow);
          }
          assert(buyerChart.querySelector(".cell-label").textContent
              .includes("× [0.00, 0.01) R"),
          "Repeated ArrowDown should reach the bottom row's R triangle.");
          dispatchKey(buyerChart, "ArrowUp", appWindow);
          assert(buyerChart.querySelector(".cell-label").textContent
              .includes("× [0.00, 0.01) L"),
          "The first ArrowUp should visit L in the same row.");
          dispatchKey(buyerChart, "ArrowUp", appWindow);
          assert(buyerChart.querySelector(".cell-label").textContent
              .includes("× [0.01, 0.02) R"),
          "The next ArrowUp should move to R in the next row.");
          dispatchKey(buyerChart, "L", appWindow);
          assert(buyerChart.querySelector(".cell-label").textContent.endsWith(" L"),
            "Keyboard navigation should retain the upper-left L triangle.");
          dispatchKey(buyerChart, "R", appWindow);
          assert(buyerChart.querySelector(".cell-label").textContent.endsWith(" R"),
            "Keyboard navigation should retain the lower-right R triangle.");

          var buyerNumber = appDocument.getElementById("buyer-payment-value-number");
          var buyerDiagnosticBefore = appDocument.querySelector(
            "#buyer-ic-chart image[data-renderer='payoff-raster']"
          ).getAttribute("href");
          buyerNumber.value = "-1.25";
          dispatchChange(buyerNumber, appWindow);
          assert(buyerNumber.value === "-1.25" &&
            Number(buyerSlider.min) <= -1.25 &&
            appDocument.querySelector(
              "#buyer-ic-chart image[data-renderer='payoff-raster']"
            ).getAttribute("href") === buyerDiagnosticBefore,
          "Choosing a signed payment brush should not edit a triangle or diagnostics.");
          dispatchKey(buyerChart, "Enter", appWindow);
          releaseKey(buyerChart, "Enter", appWindow);
          assert(appDocument.getElementById("preset-custom")
            .getAttribute("aria-pressed") === "true",
          "Manual edits should remain in the persistent Custom workspace.");
          assert(!dataBoolean("buyer-ic-text", "buyerBic"),
            "Editing one Custom payment triangle should make buyer BIC fail.");

          var allocationNumber = appDocument.getElementById("allocation-value-number");
          allocationNumber.value = "1.5";
          dispatchChange(allocationNumber, appWindow);
          assert(allocationNumber.value === "1.00",
            "Allocation edits should remain clamped to probabilities.");
        }
      },
      {
        name: "Holding Space paints each keyboard-selected Custom triangle",
        run: function () {
          click("preset-custom");
          var chart = appDocument.getElementById("allocation-chart");
          var number = appDocument.getElementById("allocation-value-number");
          var beforeEfficiency = appDocument.querySelector(
            "#efficiency-chart image[data-renderer='diagnostic-raster']"
          ).getAttribute("href");

          number.value = "0.42";
          dispatchChange(number, appWindow);
          dispatchKey(chart, "Home", appWindow);
          dispatchKey(chart, " ", appWindow);
          dispatchKey(chart, "ArrowRight", appWindow);
          dispatchKey(chart, "ArrowRight", appWindow);
          assert(appDocument.querySelector(
            "#efficiency-chart image[data-renderer='diagnostic-raster']"
          ).getAttribute("href") === beforeEfficiency,
          "Exact diagnostics should remain unchanged while Space is held.");
          releaseKey(chart, " ", appWindow);
          assert(appDocument.querySelector(
            "#efficiency-chart image[data-renderer='diagnostic-raster']"
          ).getAttribute("href") !== beforeEfficiency,
          "Releasing Space should commit one exact diagnostic refresh.");

          dispatchKey(chart, "Home", appWindow);
          assert(chart.querySelector(".surface-probe .plot-probe-text")
            .textContent.includes("q = 0.420"),
          "The starting L triangle should receive the held-key brush.");
          dispatchKey(chart, "ArrowRight", appWindow);
          assert(chart.querySelector(".surface-probe .plot-probe-text")
            .textContent.includes("q = 0.420"),
          "The same cell's R triangle should receive the held-key brush.");
          dispatchKey(chart, "ArrowRight", appWindow);
          assert(chart.querySelector(".surface-probe .plot-probe-text")
            .textContent.includes("q = 0.420"),
          "The next cell's L triangle should receive the held-key brush.");
          dispatchKey(chart, "ArrowRight", appWindow);
          assert(!chart.querySelector(".surface-probe .plot-probe-text")
            .textContent.includes("q = 0.420"),
          "Navigation after release should not keep painting.");
        }
      },
      {
        name: "Machine-scale payment entries are rejected without corrupting diagnostics",
        run: function () {
          click("preset-custom");
          var buyerNumber = appDocument.getElementById("buyer-payment-value-number");
          var before = buyerNumber.value;
          buyerNumber.value = "1e141";
          dispatchChange(buyerNumber, appWindow);
          assert(buyerNumber.value === before &&
            appDocument.getElementById("sandbox-validation-status")
              .textContent.includes("not applied") &&
            !dataBoolean("buyer-ic-text", "buyerBic"),
          "An out-of-domain payment should be rejected while preserving the prior Custom rule.");

          click("preset-agv");
          var k = appDocument.getElementById("agv-k-number");
          var beforeK = k.value;
          k.value = "-1e141";
          dispatchChange(k, appWindow);
          assert(k.value === beforeK &&
            appDocument.getElementById("sandbox-validation-status")
              .textContent.includes("not applied") &&
            dataBoolean("buyer-ic-text", "buyerBic"),
          "An out-of-domain preset parameter should leave the prior mechanism intact.");
        }
      },
      {
        name: "Custom surfaces repaint during strokes while exact dependents wait for release",
        run: async function () {
          click("preset-custom");
          var buyerChart = appDocument.getElementById("buyer-payment-chart");
          var buyerNumber = appDocument.getElementById("buyer-payment-value-number");
          var buyerPoint = clientPoint(buyerChart, 310, 250);
          var buyerSurfaceBefore = appDocument.querySelector(
            "#buyer-payment-chart image[data-renderer='raster']"
          ).getAttribute("href");
          var buyerDiagnosticBefore = appDocument.querySelector(
            "#buyer-ic-chart image[data-renderer='payoff-raster']"
          ).getAttribute("href");
          buyerNumber.value = "0.63";
          dispatchChange(buyerNumber, appWindow);
          assert(appDocument.querySelector(
            "#buyer-payment-chart image[data-renderer='raster']"
          ).getAttribute("href") === buyerSurfaceBefore,
          "Changing the payment brush should not edit the surface.");
          firePointer(
            buyerChart, "pointerdown", buyerPoint.x, buyerPoint.y, 83, appWindow
          );
          await nextFrames(2);
          assert(appDocument.querySelector(
            "#buyer-payment-chart image[data-renderer='raster']"
          ).getAttribute("href") !== buyerSurfaceBefore,
          "An editable Custom payment surface should repaint during the stroke.");
          assert(appDocument.querySelector(
            "#buyer-ic-chart image[data-renderer='payoff-raster']"
          ).getAttribute("href") === buyerDiagnosticBefore,
          "Payment diagnostics should wait while the pointer remains down.");
          await nextFrames(6);
          assert(appDocument.querySelector(
            "#buyer-ic-chart image[data-renderer='payoff-raster']"
          ).getAttribute("href") === buyerDiagnosticBefore,
          "Pausing mid-stroke should not trigger payment diagnostics.");
          firePointer(
            buyerChart, "pointerup", buyerPoint.x, buyerPoint.y, 83, appWindow
          );
          assert(appDocument.querySelector(
            "#buyer-ic-chart image[data-renderer='payoff-raster']"
          ).getAttribute("href") !== buyerDiagnosticBefore,
          "Payment diagnostics should refresh on pointer release.");

          click("fix-ic-ir-checkbox");
          var allocationChart = appDocument.getElementById("allocation-chart");
          var allocationNumber = appDocument.getElementById("allocation-value-number");
          var allocationPoint = clientPoint(
            allocationChart, 70 + 380 * 0.8, 420 - 380 * 0.3
          );
          var allocationBefore = appDocument.querySelector(
            "#allocation-chart image[data-renderer='raster']"
          ).getAttribute("href");
          var derivedPaymentBefore = appDocument.querySelector(
            "#buyer-payment-chart image[data-renderer='raster']"
          ).getAttribute("href");
          allocationNumber.value = "0";
          dispatchChange(allocationNumber, appWindow);
          assert(appDocument.querySelector(
            "#allocation-chart image[data-renderer='raster']"
          ).getAttribute("href") === allocationBefore,
          "Changing the allocation brush should not edit the surface.");
          firePointer(
            allocationChart, "pointerdown", allocationPoint.x,
            allocationPoint.y, 84, appWindow
          );
          await nextFrames(2);
          assert(appDocument.querySelector(
            "#allocation-chart image[data-renderer='raster']"
          ).getAttribute("href") !== allocationBefore,
          "Checked Custom should repaint the edited allocation during the stroke.");
          assert(appDocument.querySelector(
            "#buyer-payment-chart image[data-renderer='raster']"
          ).getAttribute("href") === derivedPaymentBefore,
          "The implied payment surfaces should wait while the pointer remains down.");
          await nextFrames(6);
          assert(appDocument.querySelector(
            "#buyer-payment-chart image[data-renderer='raster']"
          ).getAttribute("href") === derivedPaymentBefore,
          "Pausing mid-stroke should not derive new payment rules.");
          firePointer(
            allocationChart, "pointerup", allocationPoint.x,
            allocationPoint.y, 84, appWindow
          );
          assert(appDocument.querySelector(
            "#buyer-payment-chart image[data-renderer='raster']"
          ).getAttribute("href") !== derivedPaymentBefore,
          "The exact implied payments should refresh on pointer release.");
          click("fix-ic-ir-checkbox");
        }
      },
      {
        name: "Presets ignore editing gestures while Custom drags clamp off-plot",
        run: function () {
          click("preset-vcg");
          var paymentChart = appDocument.getElementById("buyer-payment-chart");
          var paymentPoint = clientPoint(paymentChart, 310, 250);
          firePointer(
            paymentChart, "pointerdown", paymentPoint.x, paymentPoint.y, 81, appWindow
          );
          firePointer(
            paymentChart, "pointerup", paymentPoint.x, paymentPoint.y, 81, appWindow
          );
          assert(dataBoolean("buyer-ic-text", "buyerBic") &&
            appDocument.getElementById("preset-vcg").getAttribute("aria-pressed") === "true",
          "A pointer gesture should not select or alter a fixed preset.");

          click("preset-custom");
          var allocationChart = appDocument.getElementById("allocation-chart");
          setAllocationBrush(0);
          var start = clientPoint(allocationChart, 250, 240);
          var outside = clientPoint(allocationChart, 500, -10);
          firePointer(allocationChart, "pointerdown", start.x, start.y, 82, appWindow);
          firePointer(allocationChart, "pointermove", outside.x, outside.y, 82, appWindow);
          firePointer(allocationChart, "pointerup", outside.x, outside.y, 82, appWindow);
          assert(allocationChart.querySelector(".cell-label").textContent
              .includes("[0.99, 1.00) × [0.99, 1.00)") &&
            appDocument.getElementById("allocation-value-number").value === "0.00",
          "An active drag should preserve the chosen brush and paint the clamped boundary triangle.");
        }
      },
      {
        name: "Custom Fix IC/IR derives payments and locks both payment editors",
        run: function () {
          click("preset-custom");
          var buyerNumber = appDocument.getElementById("buyer-payment-value-number");
          buyerNumber.value = "0.37";
          dispatchChange(buyerNumber, appWindow);
          dispatchKey(
            appDocument.getElementById("buyer-payment-chart"), "Enter", appWindow
          );
          releaseKey(
            appDocument.getElementById("buyer-payment-chart"), "Enter", appWindow
          );
          var beforeRaster = appDocument.querySelector(
            "#buyer-payment-chart image[data-renderer='raster']"
          ).getAttribute("href");
          click("fix-ic-ir-checkbox");
          assert(appDocument.getElementById("fix-ic-ir-checkbox").checked &&
            appDocument.querySelector("label[for='fix-ic-ir-checkbox']")
              .textContent === "Fix IC/IR",
          "The Custom checkbox should turn on with the exact requested label.");
          assert(!appDocument.getElementById("allocation-edit-controls").hidden &&
            appDocument.getElementById("buyer-payment-edit-controls").hidden &&
            appDocument.getElementById("seller-payment-edit-controls").hidden,
          "Only the allocation editor should remain available while Fix IC/IR is on.");
          assert(appDocument.getElementById("allocation-chart").tabIndex === 0 &&
            appDocument.getElementById("buyer-payment-chart").tabIndex === 0 &&
            appDocument.getElementById("seller-payment-chart").tabIndex === 0 &&
            appDocument.getElementById("buyer-payment-chart")
              .getAttribute("aria-readonly") === "true" &&
            !appDocument.getElementById("buyer-payment-chart")
              .getAttribute("aria-keyshortcuts").includes(" l "),
          "Derived payment charts should retain inspection without a keyboard editing path.");
          assert(appDocument.querySelector(
            "#buyer-payment-chart image[data-renderer='raster']"
          ).getAttribute("href") !== beforeRaster,
          "Turning on Fix IC/IR should replace the manual payment display.");
          assert(dataBoolean("buyer-payoff-text", "exPostBuyerIr") &&
            dataBoolean("seller-payoff-text", "exPostSellerIr"),
          "Zero-boundary envelope payments should remain ex-post individually rational.");
          var fixedRaster = appDocument.querySelector(
            "#buyer-payment-chart image[data-renderer='raster']"
          ).getAttribute("href");
          buyerNumber.value = "-0.91";
          dispatchChange(buyerNumber, appWindow);
          assert(appDocument.querySelector(
            "#buyer-payment-chart image[data-renderer='raster']"
          ).getAttribute("href") === fixedRaster,
          "A hidden payment input should not alter a derived payment rule.");
          click("fix-ic-ir-checkbox");
          assert(!appDocument.getElementById("fix-ic-ir-checkbox").checked &&
            appDocument.getElementById("buyer-payment-value-number").value === "0.37" &&
            !appDocument.getElementById("buyer-payment-edit-controls").hidden,
          "Turning Fix IC/IR off should restore the saved manual payment brush and rule.");
        }
      },
      {
        name: "Fix IC/IR recalculates even after the allocation is made nonmonotone",
        run: async function () {
          click("preset-custom");
          click("fix-ic-ir-checkbox");
          var chart = appDocument.getElementById("allocation-chart");
          dispatchKey(chart, "R", appWindow);
          dispatchKey(chart, "End", appWindow);
          for (var down = 0; down < 2 * R; down += 1) {
            dispatchKey(chart, "ArrowDown", appWindow);
          }
          var firstRaster = appDocument.querySelector(
            "#buyer-payment-chart image[data-renderer='raster']"
          ).getAttribute("href");
          applySelectedAllocation(0);
          await nextFrames(2);
          var secondRaster = appDocument.querySelector(
            "#buyer-payment-chart image[data-renderer='raster']"
          ).getAttribute("href");
          dispatchKey(chart, "ArrowLeft", appWindow);
          applySelectedAllocation(1);
          assert(appDocument.getElementById("fix-ic-ir-checkbox").checked &&
            secondRaster !== firstRaster,
          "The envelope payments should recalculate after an allocation change.");
          assert(!dataBoolean("buyer-ic-text", "buyerDsic") &&
            dataBoolean("buyer-payoff-text", "exPostBuyerIr") &&
            dataBoolean("seller-payoff-text", "exPostSellerIr"),
          "The calculation should run despite nonmonotonicity while diagnostics report the IC failure.");
          click("fix-ic-ir-checkbox");
        }
      },
      {
        name: "Every chart retains finite geometry, accessible names, and no MathJax inside SVG",
        run: function () {
          [
            "allocation-chart", "buyer-payment-chart", "seller-payment-chart",
            "buyer-ic-chart", "seller-ic-chart", "buyer-payoff-chart",
            "seller-payoff-chart", "revenue-chart", "efficiency-chart"
          ].forEach(function (id) {
            var chart = appDocument.getElementById(id);
            assert(!/(NaN|Infinity|undefined)/.test(numericSvgAttributes(chart)),
              id + " should contain finite SVG coordinates.");
            assert(chart.querySelector("title") && chart.querySelector("desc") &&
              !chart.querySelector("mjx-container"),
            id + " should keep an accessible SVG name without embedding MathJax.");
          });
          assert(appDocument.getElementById("live-summary").getAttribute("aria-live") ===
            "polite" && appDocument.getElementById("live-summary").textContent.includes("BIC") &&
            appDocument.getElementById("live-summary").textContent.includes("ex-post IR") &&
            appDocument.getElementById("live-summary").textContent.includes("budget balance"),
          "The restrained live region should summarize the requested verdicts.");
        }
      },
      {
        name: "The three-surface layout responds at 1280, 768, 375, and 320 CSS pixels",
        run: async function () {
          async function assertColumns(width, expected) {
            frame.style.width = width + "px";
            await nextFrames(3);
            var grid = appDocument.querySelector(".surface-editor-grid");
            var columns = appWindow.getComputedStyle(grid)
              .gridTemplateColumns.split(" ").length;
            assert(columns === expected,
              "Expected " + expected + " surface columns at " + width + " CSS pixels.");
            assert(appDocument.documentElement.scrollWidth <= appWindow.innerWidth + 1,
              "The page should not overflow horizontally at " + width + " CSS pixels.");
            ["allocation-chart", "buyer-ic-chart"].forEach(function (id) {
              var chart = appDocument.getElementById(id);
              var chartRect = chart.getBoundingClientRect();
              var plotLeft = chartRect.left + 70 / 480 * chartRect.width;
              var plotBottom = chartRect.top + 420 / 520 * chartRect.height;
              var chartFrame = chart.parentElement;
              var xLabelRect = chartFrame.querySelector(
                ".math-chart-x-axis-label"
              ).getBoundingClientRect();
              var yLabelRect = chartFrame.querySelector(
                ".math-chart-y-axis-label"
              ).getBoundingClientRect();
              assert(xLabelRect.top >= plotBottom && yLabelRect.right <= plotLeft,
              id + " axis labels should remain clear of the plot at " + width +
                " CSS pixels.");
            });
          }
          await assertColumns(1280, 3);
          await assertColumns(768, 2);
          await assertColumns(375, 1);
          await assertColumns(320, 1);
          frame.style.width = "1400px";
          await nextFrames(2);
        }
      }
    ];

    var failures = 0;
    for (var i = 0; i < tests.length; i += 1) {
      try {
        await tests[i].run();
        addResult(tests[i].name, null);
      } catch (error) {
        failures += 1;
        addResult(tests[i].name, error);
      }
    }
    finish(failures);
  }

  function finish(failures) {
    var summary = document.getElementById("summary");
    summary.textContent = failures ?
      failures + " interface test(s) failed." :
      "All bargaining-sandbox interface tests passed.";
    summary.className = failures ? "fail" : "pass";
    document.body.dataset.status = failures ? "failed" : "passed";
    document.title = failures ?
      "FAIL — Bargaining-sandbox interface tests" :
      "PASS — Bargaining-sandbox interface tests";
    window.clearInterval(testKeepAlive);
  }
})();
