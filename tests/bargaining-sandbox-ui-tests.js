(function () {
  "use strict";

  var frame = document.getElementById("app-frame");
  var testKeepAlive = window.setInterval(function () {}, 50);

  frame.addEventListener("load", function () {
    waitFor(function () {
      var appDocument = frame.contentDocument;
      return appDocument &&
        appDocument.body.dataset.bargainingSandboxReady === "true" &&
        appDocument.querySelector(
          "canvas[data-chart-for='allocation-chart'][data-renderer='formula-canvas']"
        ) &&
        appDocument.querySelector(
          ".sandbox-diagnostic-grid .math-chart-axis-label mjx-container"
        );
    }, 15000).then(runTests).catch(function (error) {
      addResult("The Bargaining sandbox initializes", error);
      window.MechanismTest.finish(1, 1, {
        label: "Bargaining sandbox interface tests",
        title: "Bargaining Mechanism Sandbox interface tests",
        cleanup: function () { window.clearInterval(testKeepAlive); }
      });
    });
  });

  var assert = window.MechanismTest.assert;
  var addResult = window.MechanismTest.addResult;

  function assertClose(actual, expected, message, tolerance) {
    window.MechanismTest.assertClose(
      actual, expected, tolerance === undefined ? 1e-7 : tolerance, message
    );
  }

  function waitFor(predicate, timeout) {
    return window.MechanismTest.waitFor(
      predicate, timeout, "Timed out waiting for the Bargaining sandbox interface."
    );
  }

  function nextAppFrames(appWindow, count) {
    return window.MechanismTest.nextAnimationFrames(appWindow, count);
  }

  function dispatchChange(element, appWindow) {
    window.MechanismTest.dispatch(element, "change", appWindow);
  }

  function dispatchInput(element, appWindow) {
    window.MechanismTest.dispatch(element, "input", appWindow);
  }

  function dispatchKey(element, key, appWindow, shiftKey) {
    window.MechanismTest.dispatch(element, "keydown", appWindow, {
      key: key,
      shiftKey: Boolean(shiftKey)
    });
  }

  function dispatchKeyUp(element, key, appWindow) {
    window.MechanismTest.dispatch(element, "keyup", appWindow, { key: key });
  }

  function firePointer(element, type, clientX, clientY, pointerId, appWindow) {
    window.MechanismTest.dispatch(element, type, appWindow, {
      clientX: clientX || 0,
      clientY: clientY || 0,
      pointerId: pointerId || 1
    });
  }

  function clientPoint(chart, svgX, svgY) {
    var rect = chart.getBoundingClientRect();
    return {
      x: rect.left + svgX / chart.viewBox.baseVal.width * rect.width,
      y: rect.top + svgY / chart.viewBox.baseVal.height * rect.height
    };
  }


  async function runTests() {
    var appDocument = frame.contentDocument;
    var appWindow = frame.contentWindow;
    var model = appWindow.BargainingSandboxModel;
    var root = appDocument.getElementById("bargaining-sandbox-explorable");
    var surfaceIds = [
      "allocation-chart", "buyer-payment-chart", "seller-payment-chart"
    ];
    var diagnosticIds = [
      "buyer-ic-chart", "seller-ic-chart", "revenue-chart",
      "buyer-payoff-chart", "seller-payoff-chart", "efficiency-chart"
    ];
    var allChartIds = surfaceIds.concat(diagnosticIds);

    function image(id) {
      return appDocument.querySelector("canvas[data-chart-for=\x27" + id + "\x27][data-renderer]");
    }

    function renderCount(id) {
      return Number(appDocument.getElementById(id).dataset.renderCount);
    }

    function liveRenderCount() {
      return Number(root.dataset.liveRenderCount);
    }

    function waitForLiveCount(expected) {
      return waitFor(function () {
        return liveRenderCount() === expected;
      }, 5000).catch(function () {
        throw new Error(
          "Expected live render " + expected + ", observed " +
          liveRenderCount() + " with quality status " +
          root.dataset.qualityStatus + "."
        );
      });
    }

    function waitForQuality() {
      return waitFor(function () {
        return root.dataset.qualityStatus === "complete";
      }, 20000).catch(function () {
        throw new Error(
          "Quality remained " + root.dataset.qualityStatus +
          " at generation " + root.dataset.appliedGeneration +
          "; raster sizes were " +
          allChartIds.map(function (id) {
              return image(id).dataset.rasterSize;
            }).join(",") + "."
        );
      });
    }

    async function setNumbers(values) {
      var baseline = liveRenderCount();
      Object.keys(values).forEach(function (key) {
        var input = appDocument.getElementById(key + "-number");
        input.value = String(values[key]);
        dispatchChange(input, appWindow);
      });
      await waitForLiveCount(baseline + 1);
      await waitForQuality();
    }

    async function resetDefaults() {
      if (root.dataset.activePreset !== "revenue-threshold") {
        await selectPreset("revenue-threshold");
      }
      await setNumbers({
        threshold: 0.5,
        "buyer-markup": 0.5,
        "seller-discount": 0.5
      });
    }

    async function selectPreset(key) {
      if (root.dataset.activePreset === key) {
        return;
      }
      var baseline = liveRenderCount();
      appDocument.getElementById("preset-" + key).click();
      await waitForLiveCount(baseline + 1);
      await waitForQuality();
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

    function focusVisibleRule() {
      var stylesheets = Array.from(appDocument.styleSheets);
      for (var sheetIndex = 0; sheetIndex < stylesheets.length; sheetIndex += 1) {
        var rules = Array.from(stylesheets[sheetIndex].cssRules || []);
        for (var ruleIndex = 0; ruleIndex < rules.length; ruleIndex += 1) {
          if (rules[ruleIndex].type === appWindow.CSSRule.IMPORT_RULE) {
            rules = rules.concat(Array.from(rules[ruleIndex].styleSheet.cssRules));
            continue;
          }
          var selector = rules[ruleIndex].selectorText || "";
          if (selector.split(",").map(function (part) {
            return part.trim();
          }).includes("svg:focus-visible")) {
            return rules[ruleIndex];
          }
        }
      }
      return null;
    }

    await waitForQuality();

    var tests = [
      {
        name: "Palette changes recolor formula and Custom fields without changing the rule",
        run: async function () {
          var html = appDocument.documentElement;
          var prior = html.style.getPropertyValue("--heatmap-blue-rgb");
          var parameters = JSON.stringify(appWindow.BargainingSandboxApp.snapshot().parameters);
          try {
            html.style.setProperty("--heatmap-blue-rgb", "101, 2, 3");
            appWindow.dispatchEvent(new appWindow.Event("beforeprint"));
            await waitForQuality();
            var canvas = image("allocation-chart");
            var pixel = canvas.getContext("2d").getImageData(canvas.width - 2,
              canvas.height - 2, 1, 1).data;
            assert(pixel[0] === 101 && pixel[1] === 2 && pixel[2] === 3,
              "Formula canvas pixels must use the refreshed CSS palette.");
            assert(JSON.stringify(appWindow.BargainingSandboxApp.snapshot().parameters) === parameters,
              "Changing the palette must preserve the rule's parameters.");
            await selectPreset("custom");
            html.style.setProperty("--heatmap-blue-rgb", "21, 102, 3");
            appWindow.dispatchEvent(new appWindow.Event("afterprint"));
            var fills = Array.from(appDocument.querySelectorAll("#allocation-chart polygon"))
              .map(function (node) { return node.getAttribute("fill"); });
            assert(fills.includes("rgb(21,102,3)"),
              "Custom triangle fills must also use the refreshed CSS palette.");
          } finally {
            if (prior) {
              html.style.setProperty("--heatmap-blue-rgb", prior);
            } else {
              html.style.removeProperty("--heatmap-blue-rgb");
            }
            appWindow.dispatchEvent(new appWindow.Event("afterprint"));
            await resetDefaults();
          }
        }
      },
      {
        name: "A preset switch preserves the last coalesced input and both controls",
        run: async function () {
          await resetDefaults();
          var slider = appDocument.getElementById("threshold-slider");
          slider.value = "0.73";
          dispatchInput(slider, appWindow);
          appDocument.getElementById("preset-vcg").click();
          appDocument.getElementById("preset-revenue-threshold").click();
          await waitForQuality();
          assert(root.dataset.threshold === "0.73" && slider.value === "0.73" &&
            appDocument.getElementById("threshold-number").value === "0.73",
          "Switching before the coalesced frame must preserve the chosen parameter.");
          await resetDefaults();
        }
      },
      {
        name: "Empty numeric parameters and brushes preserve the represented state",
        run: async function () {
          await resetDefaults();
          var input = appDocument.getElementById("threshold-number");
          var baseline = liveRenderCount();
          input.value = "";
          dispatchChange(input, appWindow);
          await nextAppFrames(appWindow, 2);
          assert(root.dataset.threshold === "0.5" && input.value === "0.5" &&
            liveRenderCount() === baseline &&
            appDocument.getElementById("formula-validation-status").textContent,
          "An empty number is invalid, not a request for a zero threshold.");
          await selectPreset("custom");
          var payment = appDocument.getElementById("buyer-payment-value-number");
          payment.value = "-0.37";
          dispatchChange(payment, appWindow);
          payment.value = "";
          dispatchChange(payment, appWindow);
          assert(payment.value === "-0.37" &&
            appDocument.getElementById("buyer-payment-value-slider").value === "-0.37" &&
            appDocument.getElementById("formula-validation-status").textContent,
          "Clearing a payment brush must retain its previous signed value.");
          await resetDefaults();
        }
      },
      {
        name: "The AGV number path expands its signed slider symmetrically",
        run: async function () {
          await selectPreset("agv");
          await setNumbers({ "agv-constant": -3 });
          var slider = appDocument.getElementById("agv-constant-slider");
          assert(Number(slider.min) === -Number(slider.max) &&
            Number(slider.min) <= -3 && slider.value === "-3",
          "The signed AGV soft range must expand equally in both directions.");
          await setNumbers({ "agv-constant": 0.25 });
          await resetDefaults();
        }
      },
      {
        name: "The route is title-only and loads its isolated analytic and Custom stack",
        run: function () {
          window.MechanismTest.assertScriptOrder(appDocument, [
            "../../js/components.js",
            "../../js/mathjax-config.js",
            "../../assets/mathjax/tex-svg.js",
            "../../js/mathjax-runtime.js",
            "../../js/math-utils.js",
            "../../js/svg-utils.js",
            "../../js/bilateral-trade-envelope.js",
            "../../js/bilateral-trade-visuals.js",
            "formula-diagonal.js",
            "formula-posted-price.js",
            "formula-balanced-agv.js",
            "custom-grid.js",
            "formula-model.js",
            "model.js",
            "charts.js",
            "editor.js",
            "app.js"
          ]);
          var introduction = appDocument.querySelector(".introduction");
          assert(introduction.querySelector("h1").textContent === "Bargaining Mechanism Sandbox" &&
            introduction.querySelectorAll(":scope > p").length === 4 &&
            introduction.querySelectorAll(":scope > ol > li").length === 4 &&
            introduction.querySelector("em").textContent === "direct bargaining mechanism",
          "The introduction should retain the supplied prose and four criteria.");
          assert(introduction.querySelectorAll('mjx-container[jax="SVG"]').length > 0 &&
            !/\\\(|\\\[/.test(introduction.textContent) &&
            !introduction.querySelector("mjx-merror"),
          "The introduction's mathematical notation should render without errors.");
          var details = appDocument.querySelector(".mechanism-details");
          var detailRows = details.querySelectorAll("tbody tr");
          assert(details.previousElementSibling.id === "bargaining-sandbox-explorable" &&
            details.querySelector("h2").textContent === "Mechanism Details" &&
            detailRows.length === 8 &&
            details.querySelectorAll("thead th").length === 4,
          "The supplied eight-row mechanism table should follow the demo.");
          assert(details.querySelectorAll('mjx-container[jax="SVG"]').length > 0 &&
            !/\\\(|\\\[/.test(details.textContent) &&
            !details.querySelector("mjx-merror"),
          "The mechanism table's mathematical notation should render without errors.");
          var indicatorTex = Array.from(detailRows).slice(0, 6).map(function (row) {
            return row.querySelector('td [data-mml-node="math"]')
              .getAttribute("data-latex");
          });
          assert(indicatorTex.length === 6 && indicatorTex.every(function (tex) {
            return tex.includes("\\mathbb{1}(") && !tex.includes("\\mathbf{1}");
          }), "Every table indicator should use blackboard-bold 1 with parentheses.");
          assert(!appDocument.querySelector(".notes, .references"),
            "The sandbox should contain no unsupplied Notes or References.");
          assert(model && appWindow.BargainingSandboxApp &&
            !appWindow.LegacyBargainingSandboxModel,
          "The production page must not load the retired model fixture.");
        }
      },
      {
        name: "Three formula surfaces and all six diagnostics are present",
        run: function () {
          surfaceIds.forEach(function (id) {
              var chart = appDocument.getElementById(id);
              assert(chart.dataset.representation === "formula-regions",
                id + " should identify the formula representation.");
              assert(image(id) && image(id).dataset.renderer === "formula-canvas",
                id + " should have one compact direct-canvas raster.");
              assert(!chart.querySelector("polygon"),
                id + " should not construct a triangle mesh.");
            });
          assert(appDocument.querySelectorAll(
            ".sandbox-diagnostic-grid .diagnostic-panel"
          ).length === 6, "The sandbox should contain all six diagnostic panels.");
          assert(root.querySelectorAll("svg[id$='-chart'][role='img']").length === 9,
            "Three surfaces and six diagnostic charts should be rendered.");
          diagnosticIds.forEach(function (id) {
            assert(image(id) && image(id).dataset.renderer ===
              "formula-diagnostic-canvas",
            id + " should use a formula-backed display raster.");
            assert(!appDocument.getElementById(id).querySelector("polygon"),
              id + " should not construct an editable triangle mesh.");
          });
          ["buyer-ic-chart", "seller-ic-chart"].forEach(function (id) {
            assert(appDocument.querySelector("#" + id + " .truthful-report-line") &&
              appDocument.querySelector("#" + id + " .best-report-line"),
            id + " should retain exact truthful and best-report overlays.");
          });
        }
      },
      {
        name: "All six formula presets switch with only their own controls visible",
        run: async function () {
          var presetControls = {
            vcg: [],
            "posted-price": [
              "posted-buyer-price-control",
              "posted-seller-price-control"
            ],
            agv: ["agv-constant-control"],
            "split-the-difference": [
              "split-threshold-control",
              "split-seller-share-control"
            ],
            "chatterjee-samuelson": [],
            "revenue-threshold": [
              "threshold-control",
              "buyer-markup-control",
              "seller-discount-control"
            ]
          };
          var allControls = Object.keys(presetControls).reduce(function (
              result, key) {
            return result.concat(presetControls[key]);
          }, []);
          var priorCounts = allChartIds.map(renderCount);
          var switchCount = 0;
          var presetNames = Object.keys(presetControls);
          for (var presetIndex = 0;
              presetIndex < presetNames.length;
              presetIndex += 1) {
            var key = presetNames[presetIndex];
            if (root.dataset.activePreset !== key) {
              await selectPreset(key);
              switchCount += 1;
              allChartIds.forEach(function (id, index) {
                assert(renderCount(id) === priorCounts[index] + switchCount,
                  key + " should refresh every plot on selection.");
                assert(image(id).dataset.stateKey.includes(key),
                  id + " should identify the selected preset state.");
              });
            }
            Object.keys(presetControls).forEach(function (preset) {
              presetControls[preset].forEach(function (id) {
                assert(appDocument.getElementById(id).hidden ===
                  (preset !== key),
                id + " visibility should follow " + key + ".");
              });
            });
            assert(appDocument.getElementById("preset-" + key)
              .getAttribute("aria-pressed") === "true",
            key + " should expose its pressed state.");
          }
          assert(allControls.length === 8,
            "The five adjustable preset families should expose eight controls.");
          await resetDefaults();
        }
      },
      {
        name: "IC and BB summaries use ex-post gains and nonnegative deficits",
        run: async function () {
          function lines(id) {
            return Array.from(appDocument.getElementById(id).children).map(function (node) {
              return node.textContent;
            });
          }
          await selectPreset("chatterjee-samuelson");
          ["buyer-ic-text", "seller-ic-text"].forEach(function (id) {
            assert(lines(id).join("|") ===
              "BIC: passes|DSIC: fails (maximum deviation gain = 0.2500)",
            "The DSIC line must use the ex-post gain even when BIC passes.");
          });
          assert(lines("revenue-text").join("|") ===
            "Ex-ante BB: passes (expected revenue = 0)|Ex-post BB: passes (largest deficit = 0)",
          "Balanced transfers should show precisely the two requested BB lines.");
          await selectPreset("vcg");
          assert(lines("buyer-ic-text").join("|") ===
            "BIC: passes|DSIC: passes (maximum deviation gain = 0)",
          "VCG should report zero profitable deviations.");
          assert(lines("revenue-text").join("|") ===
            "Ex-ante BB: fails (expected revenue = -0.1667)|Ex-post BB: fails (largest deficit = 1.0000)",
          "VCG's worst shortfall is positive one, not negative revenue.");
          await resetDefaults();
          assert(lines("revenue-text").join("|") ===
            "Ex-ante BB: passes (expected revenue = 0.0417)|Ex-post BB: passes (largest deficit = 0)",
          "A surplus should pass both ex-ante and ex-post BB.");
          assert(appDocument.getElementById("revenue-text").children[1].className ===
            "verdict-pass", "A zero largest deficit should use the pass color for ex-post BB.");
        }
      },
      {
        name: "Efficiency splits expected loss and exact worst loss with matching verdicts",
        run: async function () {
          var text = appDocument.getElementById("efficiency-text");
          await selectPreset("vcg");
          assert(text.children.length === 2 && text.children[0].textContent ===
            "Ex-ante efficiency: passes (expected loss = 0)" &&
            text.children[1].textContent ===
            "Ex-post efficiency: passes (largest loss = 0 at (v, c) = (0, 0))",
          "Efficient trade should pass both notions and show zero worst loss.");
          await selectPreset("chatterjee-samuelson");
          assert(text.children[0].textContent === "Ex-ante efficiency: fails (expected loss = 0.0260)" &&
            text.children[1].textContent ===
            "Ex-post efficiency: fails (largest loss = 0.2500 approaching (v, c) = (0.2500, 0))",
          "The exact boundary limit must differ from expected welfare loss.");
          assert(Array.from(text.children).every(function (line) {
            return line.className === "verdict-fail";
          }), "Both efficiency lines should share the same status color.");
          var live = appDocument.getElementById("diagnostic-live-status");
          assert(live.textContent.includes(text.children[0].textContent) &&
            live.textContent.includes(text.children[1].textContent),
          "Accessible output must include both losses and the worst-loss location.");
          await selectPreset("custom");
          assert(text.children[0].textContent === "Ex-ante efficiency: passes (expected loss = 0)" &&
            text.children[1].textContent.includes("Ex-post efficiency: passes (largest loss = 0 at"),
          "Switching representation must refresh both efficiency readouts.");
          await resetDefaults();
        }
      },
      {
        name: "Custom mode renders three exact 20 by 20 split-triangle surfaces",
        run: async function () {
          await selectPreset("custom");
          assert(!appDocument.getElementById("fix-ic-ir-control").hidden,
            "Custom should expose the Fix IC/IR control.");
          ["buyer-ic-text", "seller-ic-text"].forEach(function (id) {
            assert(appDocument.getElementById(id).children[1].textContent ===
              "DSIC: fails (maximum deviation gain = 1.0000)",
            "The initial Custom rule should report its exact ex-post gain.");
          });
          surfaceIds.forEach(function (id) {
            var chart = appDocument.getElementById(id);
            assert(chart.dataset.representation === "triangle-grid" &&
              chart.dataset.renderer === "triangle-mesh" &&
              chart.dataset.triangleCount === "800",
            id + " should identify the 20 by 20 split-triangle renderer.");
            assert(chart.querySelectorAll(
              "polygon[data-custom-triangle='true']"
            ).length === 800, id + " should contain exactly 800 triangles.");
            assert(/^rgba?\(/.test(chart.querySelector(
              "polygon[data-custom-triangle='true']"
            ).getAttribute("fill")),
            id + " should convert raster channels to a valid SVG fill.");
            assert(!chart.querySelector("image"),
              id + " should not use a 100 by 100 or raster surface layer.");
          });
          ["allocation", "buyer-payment", "seller-payment"].forEach(
            function (prefix) {
              assert(!appDocument.getElementById(prefix + "-edit-controls").hidden,
                prefix + " should be editable before Fix IC/IR is selected.");
            }
          );
          ["buyer-ic-chart", "seller-ic-chart"].forEach(function (id) {
            var chart = appDocument.getElementById(id);
            assert(chart.querySelectorAll("[data-best-report-point]").length === 61 &&
              !chart.querySelector(".best-report-line") &&
              chart.dataset.maxDeviationGain === "not-computed",
            id + " should show optimized point marks without implying an exact joined trace.");
          });
          assert(root.dataset.qualityStatus === "complete",
            "Custom surfaces should not schedule a second raster-quality pass.");
        }
      },
      {
        name: "Custom keyboard painting, Fix IC/IR, and manual-payment restoration work together",
        run: async function () {
          await selectPreset("custom");
          var buyerNumber = appDocument.getElementById(
            "buyer-payment-value-number"
          );
          var buyerSlider = appDocument.getElementById(
            "buyer-payment-value-slider"
          );
          buyerNumber.value = "0.2";
          dispatchChange(buyerNumber, appWindow);
          assert(buyerSlider.value === "0.2",
            "The Custom buyer-payment brush inputs should stay synchronized.");

          var buyerChart = appDocument.getElementById("buyer-payment-chart");
          buyerChart.focus();
          var customCounts = {
            q: renderCount("allocation-chart"),
            pB: renderCount("buyer-payment-chart"),
            pS: renderCount("seller-payment-chart"),
            buyerIc: renderCount("buyer-ic-chart"),
            sellerIc: renderCount("seller-ic-chart"),
            revenue: renderCount("revenue-chart"),
            buyerPayoff: renderCount("buyer-payoff-chart"),
            sellerPayoff: renderCount("seller-payoff-chart"),
            efficiency: renderCount("efficiency-chart")
          };
          var baseline = liveRenderCount();
          var priorRevision = appWindow.BargainingSandboxApp.snapshot()
            .custom.pBRevision;
          dispatchKey(buyerChart, "Enter", appWindow);
          assert(liveRenderCount() === baseline,
            "A held keyboard brush should update the active triangle before diagnostics.");
          dispatchKeyUp(buyerChart, "Enter", appWindow);
          await waitForLiveCount(baseline + 1);
          var manualSnapshot = appWindow.BargainingSandboxApp.snapshot();
          assert(manualSnapshot.custom.pBRevision === priorRevision + 1,
            "Releasing the keyboard brush should commit one manual payment edit.");
          assert(buyerChart.querySelector(".surface-probe .plot-probe-text")
            .textContent.includes("0.200"),
          "The exact probe should report the painted manual payment.");
          assert(renderCount("buyer-ic-chart") === customCounts.buyerIc + 1 &&
            renderCount("revenue-chart") === customCounts.revenue + 1 &&
            renderCount("buyer-payoff-chart") === customCounts.buyerPayoff + 1 &&
            renderCount("allocation-chart") === customCounts.q &&
            renderCount("buyer-payment-chart") === customCounts.pB &&
            renderCount("seller-payment-chart") === customCounts.pS &&
            renderCount("seller-ic-chart") === customCounts.sellerIc &&
            renderCount("seller-payoff-chart") === customCounts.sellerPayoff &&
            renderCount("efficiency-chart") === customCounts.efficiency,
          "A manual buyer-payment edit should retain allocation, seller, and efficiency panels while refreshing only its three dependent diagnostics.");
          assert(root.dataset.lastLiveDependencies ===
              "buyerIc buyerPayoff revenue",
          "Custom dependency tracking should identify only buyer-payment diagnostics.");

          var sellerNumber = appDocument.getElementById(
            "seller-payment-value-number"
          );
          sellerNumber.value = "-0.15";
          dispatchChange(sellerNumber, appWindow);
          var sellerChart = appDocument.getElementById("seller-payment-chart");
          sellerChart.focus();
          baseline = liveRenderCount();
          priorRevision = appWindow.BargainingSandboxApp.snapshot()
            .custom.pSRevision;
          dispatchKey(sellerChart, "Enter", appWindow);
          dispatchKeyUp(sellerChart, "Enter", appWindow);
          await waitForLiveCount(baseline + 1);
          assert(appWindow.BargainingSandboxApp.snapshot().custom.pSRevision ===
              priorRevision + 1 &&
            sellerChart.querySelector(".surface-probe .plot-probe-text")
              .textContent.includes("-0.150"),
          "The seller-payment surface should have the same manual keyboard path.");

          var fix = appDocument.getElementById("fix-ic-ir-checkbox");
          baseline = liveRenderCount();
          fix.checked = true;
          dispatchChange(fix, appWindow);
          await waitForLiveCount(baseline + 1);
          assert(appDocument.getElementById("allocation-edit-controls").hidden ===
              false &&
            appDocument.getElementById("buyer-payment-edit-controls").hidden &&
            appDocument.getElementById("seller-payment-edit-controls").hidden,
          "Fix IC/IR should leave only allocation editable.");
          assert(buyerChart.getAttribute("aria-readonly") === "true" &&
            appDocument.getElementById("seller-payment-chart")
              .getAttribute("aria-readonly") === "true",
          "Derived payments should identify themselves as read-only.");
          var buyerGradients = buyerChart.querySelectorAll(
            "linearGradient[data-analytic-payment-gradient='true']"
          );
          var sellerGradients = sellerChart.querySelectorAll(
            "linearGradient[data-analytic-payment-gradient='true']"
          );
          assert(buyerGradients.length > 0 && sellerGradients.length > 0 &&
            buyerChart.querySelector("polygon[fill^='url(']") &&
            sellerChart.querySelector("polygon[fill^='url(']"),
          "Fixed payments should display affine variation inside their triangles.");
          assert(Array.from(buyerGradients).some(function (gradient) {
              return gradient.dataset.coefficientC === "1" &&
                gradient.dataset.coefficientV === "0";
            }) && Array.from(sellerGradients).some(function (gradient) {
              return gradient.dataset.coefficientV === "1" &&
                gradient.dataset.coefficientC === "0";
            }),
          "The efficient-rule display should carry the pB=c and pS=v patch slopes.");

          var tradePoint = clientPoint(buyerChart, 374, 344);
          firePointer(
            buyerChart, "pointerdown", tradePoint.x, tradePoint.y, 40, appWindow
          );
          assert(buyerChart.querySelector(".surface-probe .plot-probe-text")
            .textContent.includes("0.200"),
          "Fix IC/IR should derive the efficient-rule buyer payment pB(0.8,0.2)=0.2.");
          var sellerTradePoint = clientPoint(sellerChart, 374, 344);
          firePointer(
            sellerChart, "pointerdown", sellerTradePoint.x,
            sellerTradePoint.y, 41, appWindow
          );
          assert(sellerChart.querySelector(".surface-probe .plot-probe-text")
            .textContent.includes("0.800"),
          "Fix IC/IR should derive the efficient-rule seller payment pS(0.8,0.2)=0.8.");
          assert(appDocument.getElementById("buyer-ic-chart").dataset.bic ===
              "true" &&
            appDocument.getElementById("buyer-ic-chart").dataset.dsic ===
              "true" &&
            appDocument.getElementById("seller-ic-chart").dataset.bic ===
              "true" &&
            appDocument.getElementById("seller-ic-chart").dataset.dsic ===
              "true",
          "The initial efficient Custom rule should pass both exact IC checks after fixing payments.");

          var allocationBrush = appDocument.getElementById(
            "allocation-value-number"
          );
          allocationBrush.value = "0.4";
          dispatchChange(allocationBrush, appWindow);
          var allocationChart = appDocument.getElementById("allocation-chart");
          var allocationPoint = clientPoint(allocationChart, 374, 344);
          var beforeAllocation = appWindow.BargainingSandboxApp.snapshot();
          baseline = liveRenderCount();
          firePointer(
            allocationChart, "pointerdown", allocationPoint.x,
            allocationPoint.y, 42, appWindow
          );
          assert(liveRenderCount() === baseline,
            "A pointer stroke should defer dependent payment and diagnostic work.");
          firePointer(
            allocationChart, "pointerup", allocationPoint.x,
            allocationPoint.y, 42, appWindow
          );
          await waitForLiveCount(baseline + 1);
          var fixedSnapshot = appWindow.BargainingSandboxApp.snapshot();
          assert(fixedSnapshot.custom.qRevision ===
              beforeAllocation.custom.qRevision + 1 &&
            fixedSnapshot.custom.derivedRevision ===
              fixedSnapshot.custom.qRevision,
          "Ending an allocation stroke should regenerate both fixed payments once.");

          baseline = liveRenderCount();
          fix.checked = false;
          dispatchChange(fix, appWindow);
          await waitForLiveCount(baseline + 1);
          assert(!appDocument.getElementById("buyer-payment-edit-controls").hidden &&
            buyerChart.getAttribute("aria-readonly") === "false",
          "Turning Fix IC/IR off should restore payment editing.");
          var restoredPoint = clientPoint(
            buyerChart,
            70 + 380 / 60,
            420 - 380 / 30
          );
          firePointer(
            buyerChart, "pointerdown", restoredPoint.x,
            restoredPoint.y, 43, appWindow
          );
          assert(buyerChart.querySelector(".surface-probe .plot-probe-text")
            .textContent.includes("0.200"),
          "Turning Fix IC/IR off should restore the saved manual buyer payment.");
          firePointer(
            buyerChart, "pointerup", restoredPoint.x,
            restoredPoint.y, 43, appWindow
          );
          var restoredSellerPoint = clientPoint(
            sellerChart,
            70 + 380 / 60,
            420 - 380 / 30
          );
          firePointer(
            sellerChart, "pointerdown", restoredSellerPoint.x,
            restoredSellerPoint.y, 44, appWindow
          );
          assert(sellerChart.querySelector(".surface-probe .plot-probe-text")
            .textContent.includes("-0.150"),
          "Turning Fix IC/IR off should restore the saved manual seller payment.");
          firePointer(
            sellerChart, "pointerup", restoredSellerPoint.x,
            restoredSellerPoint.y, 44, appWindow
          );
          await resetDefaults();
        }
      },
      {
        name: "Posted, AGV, and split controls invalidate only exact dependencies",
        run: async function () {
          await selectPreset("posted-price");
          var postedCounts = allChartIds.map(renderCount);
          var postedBaseline = liveRenderCount();
          var postedSlider = appDocument.getElementById(
            "posted-buyer-price-slider"
          );
          firePointer(postedSlider, "pointerdown", 0, 0, 20, appWindow);
          postedSlider.value = "0.6";
          dispatchInput(postedSlider, appWindow);
          await waitForLiveCount(postedBaseline + 1);
          allChartIds.forEach(function (id, index) {
            assert(renderCount(id) === postedCounts[index] + 1,
              "Posted buyer price should refresh " + id + ".");
          });
          firePointer(postedSlider, "pointerup", 0, 0, 20, appWindow);
          await waitForQuality();

          await selectPreset("agv");
          var agvCounts = allChartIds.map(renderCount);
          var agvBaseline = liveRenderCount();
          var agvNumber = appDocument.getElementById("agv-constant-number");
          agvNumber.value = "0.75";
          dispatchChange(agvNumber, appWindow);
          await waitForLiveCount(agvBaseline + 1);
          await waitForQuality();
          ["buyer-payment-chart", "seller-payment-chart", "buyer-ic-chart",
            "seller-ic-chart", "buyer-payoff-chart", "seller-payoff-chart"]
            .forEach(function (id) {
              var index = allChartIds.indexOf(id);
              assert(renderCount(id) === agvCounts[index] + 1,
                "AGV constant should refresh " + id + ".");
            });
          ["allocation-chart", "revenue-chart", "efficiency-chart"]
            .forEach(function (id) {
              var index = allChartIds.indexOf(id);
              assert(renderCount(id) === agvCounts[index],
                "AGV constant should retain " + id + ".");
            });
          assert(Number(appDocument.getElementById("agv-constant-slider").max) >=
              0.75 && root.dataset.agvConstant === "0.75",
          "The signed AGV number path should expand rather than clamp its slider.");

          await selectPreset("split-the-difference");
          var splitCounts = allChartIds.map(renderCount);
          var splitBaseline = liveRenderCount();
          var splitSlider = appDocument.getElementById(
            "split-seller-share-slider"
          );
          firePointer(splitSlider, "pointerdown", 0, 0, 21, appWindow);
          splitSlider.value = "0.25";
          dispatchInput(splitSlider, appWindow);
          await waitForLiveCount(splitBaseline + 1);
          ["buyer-payment-chart", "seller-payment-chart", "buyer-ic-chart",
            "seller-ic-chart", "buyer-payoff-chart", "seller-payoff-chart"]
            .forEach(function (id) {
              var index = allChartIds.indexOf(id);
              assert(renderCount(id) === splitCounts[index] + 1,
                "Split share should refresh " + id + ".");
            });
          ["allocation-chart", "revenue-chart", "efficiency-chart"]
            .forEach(function (id) {
              var index = allChartIds.indexOf(id);
              assert(renderCount(id) === splitCounts[index],
                "Split share should retain " + id + ".");
            });
          firePointer(splitSlider, "pointerup", 0, 0, 21, appWindow);
          await waitForQuality();
          await resetDefaults();
        }
      },
      {
        name: "The app omits delayed, retired-model, and internal-residual paths",
        run: async function () {
          var sources = await Promise.all(["app.js", "charts.js", "editor.js"].map(
            async function (file) {
              var response = await fetch("../bilateral-trade/bargaining-mechanism-sandbox/" + file);
              return response.text();
            }
          ));
          var source = sources.join("\n");
          assert(!source.includes("setTimeout") &&
            !source.includes("LegacyBargainingSandboxModel") &&
            !source.includes("envelopeResidual") &&
            !appDocument.body.textContent.includes("Envelope payment residual"),
          "The sandbox app should use only its visible maximum-gain diagnostic.");
        }
      },
      {
        name: "Slider and number inputs stay synchronized and reject invalid numbers",
        run: async function () {
          var baseline = liveRenderCount();
          var thresholdNumber = appDocument.getElementById("threshold-number");
          var thresholdSlider = appDocument.getElementById("threshold-slider");
          thresholdNumber.value = "0.63";
          dispatchChange(thresholdNumber, appWindow);
          assert(thresholdSlider.value === "0.63",
            "The number path should immediately synchronize its slider.");
          await waitForLiveCount(baseline + 1);
          await waitForQuality();

          var markupSlider = appDocument.getElementById("buyer-markup-slider");
          var markupNumber = appDocument.getElementById("buyer-markup-number");
          baseline = liveRenderCount();
          firePointer(markupSlider, "pointerdown", 0, 0, 2, appWindow);
          markupSlider.value = "0.37";
          dispatchInput(markupSlider, appWindow);
          assert(markupNumber.value === "0.37",
            "The slider path should immediately synchronize its number input.");
          await waitForLiveCount(baseline + 1);
          firePointer(markupSlider, "pointerup", 0, 0, 2, appWindow);
          await waitForQuality();

          var discountNumber = appDocument.getElementById("seller-discount-number");
          var priorDiscount = root.dataset.sellerDiscount;
          discountNumber.value = "1.2";
          dispatchChange(discountNumber, appWindow);
          assert(root.dataset.sellerDiscount === priorDiscount &&
            appDocument.getElementById("formula-validation-status")
              .textContent.includes("0 to 1"),
          "An invalid number should leave the rule unchanged and report validation.");
          await resetDefaults();
        }
      },
      {
        name: "Threshold input refreshes every exact dependency before pointer release",
        run: async function () {
          await resetDefaults();
          var slider = appDocument.getElementById("threshold-slider");
          var baseline = liveRenderCount();
          var counts = {
            q: renderCount("allocation-chart"),
            pB: renderCount("buyer-payment-chart"),
            pS: renderCount("seller-payment-chart"),
            buyerIc: renderCount("buyer-ic-chart"),
            sellerIc: renderCount("seller-ic-chart"),
            revenue: renderCount("revenue-chart"),
            buyerPayoff: renderCount("buyer-payoff-chart"),
            sellerPayoff: renderCount("seller-payoff-chart"),
            efficiency: renderCount("efficiency-chart")
          };
          firePointer(slider, "pointerdown", 0, 0, 3, appWindow);
          slider.value = "0.4";
          dispatchInput(slider, appWindow);
          await waitForLiveCount(baseline + 1);
          assert(root.dataset.threshold === "0.4" &&
            root.dataset.qualityStatus === "idle",
          "The represented rule should be current while the pointer remains down.");
          assert(renderCount("allocation-chart") === counts.q + 1 &&
            renderCount("buyer-payment-chart") === counts.pB + 1 &&
            renderCount("seller-payment-chart") === counts.pS + 1 &&
            renderCount("buyer-ic-chart") === counts.buyerIc + 1 &&
            renderCount("seller-ic-chart") === counts.sellerIc + 1 &&
            renderCount("revenue-chart") === counts.revenue + 1 &&
            renderCount("buyer-payoff-chart") === counts.buyerPayoff + 1 &&
            renderCount("seller-payoff-chart") === counts.sellerPayoff + 1 &&
            renderCount("efficiency-chart") === counts.efficiency + 1,
          "Threshold should invalidate all nine formula fields.");
          allChartIds.forEach(function (id) {
              assert(image(id).dataset.rasterSize === "240",
                id + " should use live preview resolution during the gesture.");
            });
          assert(appDocument.getElementById("buyer-ic-chart").dataset.bic === "false",
            "The live buyer-BIC verdict should reflect t=0.4 and alpha=0.5.");
          firePointer(slider, "pointerup", 0, 0, 3, appWindow);
          await waitForQuality();
          await resetDefaults();
        }
      },
      {
        name: "Multiple same-frame slider inputs produce one latest-state live render",
        run: async function () {
          await resetDefaults();
          var slider = appDocument.getElementById("buyer-markup-slider");
          var baseline = liveRenderCount();
          var qCount = renderCount("allocation-chart");
          var sellerCount = renderCount("seller-payment-chart");
          var buyerCount = renderCount("buyer-payment-chart");
          var icCount = renderCount("buyer-ic-chart");
          var revenueCount = renderCount("revenue-chart");
          var buyerPayoffCount = renderCount("buyer-payoff-chart");
          var sellerIcCount = renderCount("seller-ic-chart");
          var sellerPayoffCount = renderCount("seller-payoff-chart");
          var efficiencyCount = renderCount("efficiency-chart");
          firePointer(slider, "pointerdown", 0, 0, 4, appWindow);
          ["0.49", "0.33", "0.21"].forEach(function (value) {
            slider.value = value;
            dispatchInput(slider, appWindow);
          });
          assert(liveRenderCount() === baseline,
            "Raw input events should not synchronously render.");
          await waitForLiveCount(baseline + 1);
          await nextAppFrames(appWindow, 1);
          assert(liveRenderCount() === baseline + 1 &&
            root.dataset.buyerMarkup === "0.21",
          "One frame should commit only the latest pending markup.");
          assert(renderCount("allocation-chart") === qCount &&
            renderCount("seller-payment-chart") === sellerCount &&
            renderCount("buyer-payment-chart") === buyerCount + 1 &&
            renderCount("buyer-ic-chart") === icCount + 1 &&
            renderCount("buyer-payoff-chart") === buyerPayoffCount + 1 &&
            renderCount("revenue-chart") === revenueCount + 1 &&
            renderCount("seller-ic-chart") === sellerIcCount &&
            renderCount("seller-payoff-chart") === sellerPayoffCount &&
            renderCount("efficiency-chart") === efficiencyCount,
          "Markup should redraw only buyer payment, buyer IC, buyer payoff, and revenue.");
          var trace = appDocument.querySelector(
            "#buyer-ic-chart .best-report-line"
          );
          var segmentCount = Number(trace.dataset.traceSegments);
          assert(trace.tagName.toLowerCase() === "path" && segmentCount > 1 &&
            (trace.getAttribute("d").match(/\bM\b/g) || []).length === segmentCount,
          "A discontinuous best response should use separate exact path subsegments.");
          firePointer(slider, "pointerup", 0, 0, 4, appWindow);
          await waitForQuality();
          await resetDefaults();
        }
      },
      {
        name: "Beta redraws only seller dependencies and preserves unrelated DOM identity",
        run: async function () {
          await resetDefaults();
          var slider = appDocument.getElementById("seller-discount-slider");
          var qImage = image("allocation-chart");
          var buyerImage = image("buyer-payment-chart");
          var icImage = image("buyer-ic-chart");
          var trace = appDocument.querySelector("#buyer-ic-chart .best-report-line");
          var buyerPayoffImage = image("buyer-payoff-chart");
          var efficiencyImage = image("efficiency-chart");
          var counts = {
            q: renderCount("allocation-chart"),
            pB: renderCount("buyer-payment-chart"),
            pS: renderCount("seller-payment-chart"),
            buyerIc: renderCount("buyer-ic-chart"),
            sellerIc: renderCount("seller-ic-chart"),
            revenue: renderCount("revenue-chart"),
            buyerPayoff: renderCount("buyer-payoff-chart"),
            sellerPayoff: renderCount("seller-payoff-chart"),
            efficiency: renderCount("efficiency-chart")
          };
          var baseline = liveRenderCount();
          firePointer(slider, "pointerdown", 0, 0, 5, appWindow);
          slider.value = "0.2";
          dispatchInput(slider, appWindow);
          await waitForLiveCount(baseline + 1);
          assert(image("allocation-chart") === qImage &&
            image("buyer-payment-chart") === buyerImage &&
            image("buyer-ic-chart") === icImage &&
            image("buyer-payoff-chart") === buyerPayoffImage &&
            image("efficiency-chart") === efficiencyImage &&
            appDocument.querySelector("#buyer-ic-chart .best-report-line") === trace,
          "Beta should retain unrelated raster and trace nodes exactly.");
          assert(renderCount("allocation-chart") === counts.q &&
            renderCount("buyer-payment-chart") === counts.pB &&
            renderCount("buyer-ic-chart") === counts.buyerIc &&
            renderCount("buyer-payoff-chart") === counts.buyerPayoff &&
            renderCount("efficiency-chart") === counts.efficiency &&
            renderCount("seller-payment-chart") === counts.pS + 1 &&
            renderCount("seller-ic-chart") === counts.sellerIc + 1 &&
            renderCount("seller-payoff-chart") === counts.sellerPayoff + 1 &&
            renderCount("revenue-chart") === counts.revenue + 1,
          "Beta should increment only seller payment, seller IC, seller payoff, and revenue.");
          assert(root.dataset.lastLiveDependencies ===
              "pS revenue sellerIc sellerPayoff" &&
            image("seller-payment-chart").dataset.rasterSize === "240",
          "The dependency key and preview layers should identify seller fields only.");
          firePointer(slider, "pointerup", 0, 0, 5, appWindow);
          await waitForQuality();
          assert(image("allocation-chart") === qImage &&
            image("buyer-payment-chart") === buyerImage &&
            image("buyer-ic-chart") === icImage &&
            image("buyer-payoff-chart") === buyerPayoffImage &&
            image("efficiency-chart") === efficiencyImage &&
            image("seller-payment-chart").dataset.rasterSize === "800",
          "The quality-only beta upgrade should still leave unrelated nodes untouched.");
          await resetDefaults();
        }
      },
      {
        name: "Quality upgrades preserve exact state and stale work cannot win",
        run: async function () {
          await resetDefaults();
          var thresholdSlider = appDocument.getElementById("threshold-slider");
          var markupSlider = appDocument.getElementById("buyer-markup-slider");
          var baseline = liveRenderCount();
          firePointer(thresholdSlider, "pointerdown", 0, 0, 6, appWindow);
          thresholdSlider.value = "0.3";
          dispatchInput(thresholdSlider, appWindow);
          await waitForLiveCount(baseline + 1);
          firePointer(thresholdSlider, "pointerup", 0, 0, 6, appWindow);

          firePointer(markupSlider, "pointerdown", 0, 0, 7, appWindow);
          markupSlider.value = "0.8";
          dispatchInput(markupSlider, appWindow);
          await waitForLiveCount(baseline + 2);
          var nodes = {
            q: image("allocation-chart"),
            pB: image("buyer-payment-chart"),
            pS: image("seller-payment-chart"),
            buyerIc: image("buyer-ic-chart"),
            sellerIc: image("seller-ic-chart"),
            revenue: image("revenue-chart"),
            buyerPayoff: image("buyer-payoff-chart"),
            sellerPayoff: image("seller-payoff-chart"),
            efficiency: image("efficiency-chart"),
            buyerTrace: appDocument.querySelector("#buyer-ic-chart .best-report-line"),
            sellerTrace: appDocument.querySelector("#seller-ic-chart .best-report-line")
          };
          var counts = {
            q: renderCount("allocation-chart"),
            pB: renderCount("buyer-payment-chart"),
            pS: renderCount("seller-payment-chart"),
            buyerIc: renderCount("buyer-ic-chart"),
            sellerIc: renderCount("seller-ic-chart"),
            revenue: renderCount("revenue-chart"),
            buyerPayoff: renderCount("buyer-payoff-chart"),
            sellerPayoff: renderCount("seller-payoff-chart"),
            efficiency: renderCount("efficiency-chart")
          };
          firePointer(markupSlider, "pointerup", 0, 0, 7, appWindow);
          await waitForQuality();
          assert(root.dataset.threshold === "0.3" &&
            root.dataset.buyerMarkup === "0.8",
          "The final exact state should contain both rapid gestures.");
          ["allocation-chart", "buyer-payment-chart", "seller-payment-chart"]
            .forEach(function (id) {
              var layer = image(id);
              assert(layer.dataset.rasterSize === "800" &&
                layer.dataset.stateKey === appDocument.getElementById(id).dataset.stateKey &&
                layer.dataset.qualityGeneration === root.dataset.appliedGeneration,
              id + " should contain only the latest full-quality state.");
            });
          diagnosticIds.forEach(function (id) {
            assert(image(id).dataset.rasterSize === "330" &&
              image(id).dataset.stateKey ===
                appDocument.getElementById(id).dataset.stateKey &&
              image(id).dataset.qualityGeneration ===
                root.dataset.appliedGeneration,
            id + " should contain only the latest full-quality state.");
          });
          assert(image("allocation-chart") === nodes.q &&
            image("buyer-payment-chart") === nodes.pB &&
            image("seller-payment-chart") === nodes.pS &&
            image("buyer-ic-chart") === nodes.buyerIc &&
            image("seller-ic-chart") === nodes.sellerIc &&
            image("revenue-chart") === nodes.revenue &&
            image("buyer-payoff-chart") === nodes.buyerPayoff &&
            image("seller-payoff-chart") === nodes.sellerPayoff &&
            image("efficiency-chart") === nodes.efficiency &&
            appDocument.querySelector("#buyer-ic-chart .best-report-line") ===
              nodes.buyerTrace &&
            appDocument.querySelector("#seller-ic-chart .best-report-line") ===
              nodes.sellerTrace,
          "Quality work should update raster attributes without replacing exact overlays.");
          assert(renderCount("allocation-chart") === counts.q &&
            renderCount("buyer-payment-chart") === counts.pB &&
            renderCount("seller-payment-chart") === counts.pS &&
            renderCount("buyer-ic-chart") === counts.buyerIc &&
            renderCount("seller-ic-chart") === counts.sellerIc &&
            renderCount("revenue-chart") === counts.revenue &&
            renderCount("buyer-payoff-chart") === counts.buyerPayoff &&
            renderCount("seller-payoff-chart") === counts.sellerPayoff &&
            renderCount("efficiency-chart") === counts.efficiency,
          "Quality work should not count as another state render.");
          await resetDefaults();
        }
      },
      {
        name: "Pointer and keyboard probes read exact formula values",
        run: async function () {
          await resetDefaults();
          var allocation = appDocument.getElementById("allocation-chart");
          var allocationPoint = clientPoint(allocation, 374, 344);
          firePointer(
            allocation, "pointerdown", allocationPoint.x, allocationPoint.y,
            8, appWindow
          );
          assert(allocation.querySelector(".surface-probe .plot-probe-text")
            .textContent.includes("1.000"),
          "The allocation pointer probe should evaluate q(0.8,0.2)=1 exactly.");

          var seller = appDocument.getElementById("seller-payment-chart");
          seller.focus();
          dispatchKey(seller, "End", appWindow);
          assert(seller.querySelector(".surface-probe .plot-probe-text")
            .textContent.includes("0.500"),
          "The seller-payment keyboard probe should evaluate pS(1,0.5)=0.5.");

          var buyerIc = appDocument.getElementById("buyer-ic-chart");
          buyerIc.focus();
          dispatchKey(buyerIc, "ArrowUp", appWindow, true);
          assert(buyerIc.querySelector(".ic-probe .plot-probe-text")
            .textContent.includes("-0.005"),
          "The buyer-IC keyboard probe should evaluate U B(0.5,0.6) exactly.");
          assert(appDocument.getElementById("formula-probe-status")
            .textContent.includes("buyer interim utility"),
          "Keyboard probe changes should be announced.");

          [
            ["seller-ic-chart", 0.5, 0.4, "-0.005"],
            ["revenue-chart", 0.8, 0.2, "0.400"],
            ["buyer-payoff-chart", 0.8, 0.2, "0.100"],
            ["seller-payoff-chart", 0.8, 0.2, "0.100"],
            ["efficiency-chart", 0.6, 0.55, "-1.000"]
          ].forEach(function (fixture, index) {
            var chart = appDocument.getElementById(fixture[0]);
            var point = clientPoint(
              chart,
              70 + 380 * fixture[1],
              420 - 380 * fixture[2]
            );
            firePointer(chart, "pointerdown", point.x, point.y,
              20 + index, appWindow);
            assert(chart.querySelector(".diagnostic-probe .plot-probe-text")
              .textContent.includes(fixture[3]),
            fixture[0] + " should evaluate its exact formula probe.");
          });

          await setNumbers({
            threshold: 1,
            "buyer-markup": 0.3,
            "seller-discount": 0.2
          });
          var endpointStart = clientPoint(allocation, 260, 230);
          firePointer(
            allocation, "pointerdown", endpointStart.x, endpointStart.y,
            9, appWindow
          );
          allocation.focus();
          dispatchKey(allocation, "End", appWindow);
          for (var step = 0; step < 5; step += 1) {
            dispatchKey(allocation, "ArrowDown", appWindow, true);
          }
          assert(allocation.querySelector(".surface-probe .plot-probe-text")
            .textContent.includes("1.000") &&
            allocation.querySelector("[data-boundary-kind='point']"),
          "The t=1 endpoint probe and vector marker should retain literal point trade.");
          await resetDefaults();
        }
      },
      {
        name: "Charts retain finite geometry, accessible names, focus, and live status",
        run: function () {
          allChartIds.forEach(function (id) {
              var chart = appDocument.getElementById(id);
              assert(!/(NaN|Infinity|undefined)/.test(numericSvgAttributes(chart)),
                id + " should contain finite SVG coordinates.");
              assert(chart.querySelector("title").textContent.trim() &&
                chart.querySelector("desc").textContent.trim() &&
                !chart.querySelector("mjx-container") && chart.tabIndex === 0,
              id + " should be focusable and have an SVG-native accessible name.");
            });
          var chart = appDocument.getElementById("buyer-ic-chart");
          chart.focus();
          assert(appDocument.activeElement === chart,
            "The chart should accept programmatic focus.");
          var focusRule = focusVisibleRule();
          assert(focusRule &&
            focusRule.style.cssText.includes("outline: 3px solid") &&
            parseFloat(focusRule.style.outlineOffset) >= 3,
          "The shared keyboard-focus rule should retain its visible outline.");
          ["threshold", "buyer-markup", "seller-discount"].forEach(function (prefix) {
            assert(appDocument.getElementById(prefix + "-slider").labels.length === 1 &&
              appDocument.getElementById(prefix + "-number")
                .getAttribute("aria-labelledby") === prefix + "-control-label",
            prefix + " controls should have programmatic labels.");
          });
          assert(appDocument.getElementById("diagnostic-live-status")
            .getAttribute("aria-live") === "polite" &&
            appDocument.getElementById("diagnostic-live-status")
              .textContent.includes("Buyer BIC") &&
            appDocument.getElementById("diagnostic-live-status")
              .textContent.includes("Seller BIC"),
          "The exact diagnostic verdicts should have a restrained live status.");
        }
      },
      {
        name: "The layout responds at target widths and a 200-percent equivalent viewport",
        run: async function () {
          async function assertColumns(width, expected, diagnosticExpected) {
            frame.style.width = width + "px";
            await nextAppFrames(appWindow, 2);
            var grid = appDocument.querySelector(".surface-editor-grid");
            var columns = appWindow.getComputedStyle(grid)
              .gridTemplateColumns.split(" ").length;
            var diagnosticGrid = appDocument.querySelector(
              ".diagnostic-panel-grid"
            );
            var diagnosticColumns = appWindow.getComputedStyle(diagnosticGrid)
              .gridTemplateColumns.split(" ").length;
            assert(columns === expected,
              "Expected " + expected + " columns at " + width + " CSS pixels.");
            assert(diagnosticColumns === diagnosticExpected,
              "Expected " + diagnosticExpected +
                " diagnostic columns at " + width + " CSS pixels.");
            assert(appDocument.documentElement.scrollWidth <= appWindow.innerWidth + 1,
              "The page should not overflow horizontally at " + width + " CSS pixels.");
          }
          await assertColumns(1280, 3, 3);
          await assertColumns(768, 2, 3);
          await assertColumns(640, 1, 3);
          await assertColumns(375, 1, 1);
          await assertColumns(320, 1, 1);
          frame.style.width = "1400px";
          await nextAppFrames(appWindow, 2);
        }
      }
    ];

    await window.MechanismTest.run(tests, {
      label: "Bargaining sandbox interface tests",
      title: "Bargaining Mechanism Sandbox interface tests",
      cleanup: function () { window.clearInterval(testKeepAlive); }
    });
  }
}());
