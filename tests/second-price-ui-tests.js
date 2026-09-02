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
        document.title = "FAIL — SPA interface tests";
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
    var allowed = tolerance === undefined ? 1e-9 : tolerance;
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
    var model = appWindow.SPAModel;
    var distributions = appWindow.AuctionDistributions;

    function reset() {
      appDocument.getElementById("reset-button").click();
    }

    function withReset(callback) {
      reset();
      try {
        callback();
      } finally {
        reset();
      }
    }

    function chooseBeta(alpha, beta) {
      var alphaNumber = appDocument.getElementById("alpha-number");
      var betaNumber = appDocument.getElementById("beta-number");
      alphaNumber.value = String(alpha);
      dispatchChange(alphaNumber, appWindow);
      betaNumber.value = String(beta);
      dispatchChange(betaNumber, appWindow);
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

    var tests = [
      {
        name: "The second-price route loads the shared distribution kernel first",
        run: function () {
          var sources = Array.from(appDocument.querySelectorAll("head > script[defer]"))
            .map(function (script) { return script.getAttribute("src"); });
          assert(JSON.stringify(sources) === JSON.stringify([
            "../../js/components.js",
            "../../js/mathjax-config.js",
            "../../assets/mathjax/tex-svg.js",
            "../../js/mathjax-runtime.js",
            "../../js/distributions.js",
            "../../js/math-utils.js",
            "../../js/svg-utils.js",
            "../../js/auction-controls.js",
            "../../js/auction-chart.js",
            "model.js",
            "app.js"
          ]), "Shared components, local MathJax, and the shared kernel should " +
            "load before module scripts.");
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
          assert(distributions && typeof distributions.quantile === "function",
            "AuctionDistributions should be available to the page.");
          assert(model && typeof model.outcomes === "function",
            "SPAModel should be available to the page.");
          assert(appWindow.FPAModel === undefined,
            "The second-price page should not load the first-price model.");
          assert(appDocument.querySelector(".wordmark").getAttribute("href") ===
            "../../index.html",
          "The wordmark should link back to the root menu.");
          assert(appDocument.querySelector('link[rel="stylesheet"]')
            .getAttribute("href") === "../../styles.css",
          "The module should use the shared root stylesheet.");
        }
      },
      {
        name: "The functional demo adds no extra legend or results card",
        run: function () {
          var introduction = appDocument.querySelector(".introduction");
          assert(introduction && introduction.querySelector("h1"),
            "The introduction should retain its page title.");
          assert(!appDocument.querySelector(".figure-key") &&
            !appDocument.querySelector(".current-results"),
          "The functional demo should not add a legend or results card.");
          assert(appDocument.querySelector(".wordmark").textContent ===
            "Mechanism Design Explorer" &&
            appDocument.title.endsWith("| Mechanism Design Explorer"),
          "The module should use the Mechanism Design Explorer brand.");
        }
      },
      {
        name: "HTML mathematics renders locally while graph SVG labels stay native",
        run: function () {
          var targets = Array.from(appDocument.querySelectorAll(
            ".introduction, .model-specifications, .choice-controls, .derivation, .notes"
          ));
          assert(targets.every(function (target) {
            return !/\\\(|\\\[/.test(target.textContent);
          }), "Typeset HTML regions should not display raw TeX delimiters.");
          assert(appDocument.querySelectorAll("mjx-container").length >= 10,
            "The controls should contain rendered inline mathematics.");
          assert(!appDocument.querySelector("#second-price-chart mjx-container") &&
            appDocument.querySelector("#second-price-chart .panel-caption"),
          "The custom graph should retain its native SVG labels.");
        }
      },
      {
        name: "The page preserves the established typography and desktop layout",
        run: function () {
          var chart = appDocument.getElementById("second-price-chart");
          var parameters = appDocument.querySelector(".model-specifications");
          var choices = appDocument.querySelector(".choice-controls");
          [
            appDocument.body,
            appDocument.getElementById("bidder-count"),
            appDocument.getElementById("value-number"),
            appDocument.getElementById("bid-number"),
            appDocument.querySelector(".text-button"),
            appDocument.querySelector(".panel-caption")
          ].forEach(function (element) {
            assert(/Times New Roman/i.test(
              appWindow.getComputedStyle(element).fontFamily
            ), "Visible page and SVG text should use Times New Roman.");
          });
          assert(parameters.getBoundingClientRect().top <
            chart.getBoundingClientRect().top,
          "Model parameters should remain above the chart.");
          assert(choices.getBoundingClientRect().left >=
            appDocument.querySelector(".chart-column").getBoundingClientRect().right,
          "Bidder controls should sit to the chart's right at desktop width.");
          assert(chart.getAttribute("tabindex") === "0" &&
            chart.getAttribute("role") === "img",
          "The graph should remain keyboard focusable and exposed as an image.");
        }
      },
      {
        name: "The compact spacing, aligned parameters, Notes, and References are present",
        run: function () {
          var parameters = appDocument.querySelector(".model-specifications");
          var parameterItems = Array.from(appDocument.querySelector(
            ".parameter-grid"
          ).children);
          var tops = parameterItems.map(function (item) {
            return item.getBoundingClientRect().top;
          });
          var chart = appDocument.getElementById("second-price-chart");
          var explorable = appDocument.querySelector(".explorable");
          var notes = appDocument.querySelector(".notes");
          var references = appDocument.querySelector(".references");
          var citation = references.querySelector("a");

          assert(Math.max.apply(null, tops) - Math.min.apply(null, tops) < 1,
            "Desktop parameter options should begin on one aligned row.");
          assert(Number.parseFloat(appWindow.getComputedStyle(parameters)
            .marginBottom) <= 24,
          "The model-to-panel gap should remain compact.");
          assert(Number.parseFloat(appWindow.getComputedStyle(explorable)
            .marginBottom) <= 32 && chart.viewBox.baseVal.height === 800,
          "The interactive demo should not retain its former bottom whitespace.");
          assert(notes && appWindow.getComputedStyle(notes).borderTopWidth !== "0px" &&
            notes.querySelector("h2").textContent === "Notes" &&
            notes.querySelectorAll(".notes-list > li").length === 1,
          "Notes should have a faint separator and contain the user-authored list.");
          assert(references.querySelector("h2").textContent === "References" &&
            references.querySelectorAll(".reference-list > li").length === 1 &&
            citation.getAttribute("href") ===
              "https://shop.elsevier.com/books/auction-theory/krishna/978-0-12-374507-1" &&
            references.textContent.includes("Proposition 2.1") &&
            references.textContent.includes("p. 13"),
          "References should contain the requested second-price Krishna citation.");
        }
      },
      {
        name: "Beta parameters are always available with a uniform-equivalent default",
        run: function () {
          withReset(function () {
            var controls = appDocument.getElementById("beta-shape-controls");
            var shapeInputs = Array.from(controls.querySelectorAll("input"));
            assert(!appDocument.getElementById("distribution"),
              "The page should not expose a distribution selector.");
            assert(!appDocument.getElementById("parameter-note"),
              "The value-distribution equation below the parameters should be removed.");
            assert(!controls.hidden,
              "Beta shape controls should always be visible.");
            assert(shapeInputs.every(function (element) { return !element.disabled; }),
              "Beta shape controls should always be enabled.");
            assert(appDocument.getElementById("alpha-number").value === "1" &&
              appDocument.getElementById("beta-number").value === "1",
            "Beta(1,1) should be the uniform-equivalent default.");
          });
        }
      },
      {
        name: "Beta shape number fields and sliders stay synchronized",
        run: function () {
          withReset(function () {
            chooseBeta(2, 2);
            var alphaNumber = appDocument.getElementById("alpha-number");
            var alphaSlider = appDocument.getElementById("alpha-slider");
            var betaNumber = appDocument.getElementById("beta-number");
            var betaSlider = appDocument.getElementById("beta-slider");

            alphaNumber.value = "3.4";
            dispatchChange(alphaNumber, appWindow);
            assertClose(Number(alphaSlider.value), 3.4,
              "Typing alpha should update its slider.");

            betaSlider.value = "4.6";
            dispatchInput(betaSlider, appWindow);
            assertClose(Number(betaNumber.value), 4.6,
              "Moving the beta slider should update its number field.");
          });
        }
      },
      {
        name: "The Beta value PDF preview responds to shapes and support",
        run: function () {
          withReset(function () {
            chooseBeta(2, 2);
            var preview = appDocument.getElementById("value-pdf-preview");
            var previewFigure = appDocument.querySelector(
              ".value-pdf-preview-figure"
            );
            var previewCaption = previewFigure.querySelector("figcaption");
            var curve = preview.querySelector(".value-pdf-curve");
            var originalPath = curve.getAttribute("d");
            var previewRect = preview.getBoundingClientRect();
            var captionRect = previewCaption.getBoundingClientRect();
            assert(Math.abs(captionRect.left -
              (previewRect.left + previewRect.width * 14 / 320)) < 1.5,
            "The PDF of Value caption should align with the plotted PDF area.");
            assert(preview.querySelector("#value-pdf-preview-title")
              .textContent === "PDF of Value" &&
              preview.querySelector("#value-pdf-preview-description")
                .textContent.includes("alpha 2") &&
              preview.getAttribute("aria-labelledby") ===
                "value-pdf-preview-title value-pdf-preview-description",
            "The preview should identify the plotted value density accessibly.");
            assert(appDocument.querySelector(
              ".value-pdf-preview-figure figcaption"
            ).textContent.replace(/\s+/g, " ").trim() === "PDF of Value",
            "The visible preview caption should say PDF of Value.");
            assert(preview.querySelectorAll(".value-pdf-area").length === 1 &&
              preview.querySelectorAll(".value-pdf-curve").length === 1 &&
              preview.querySelectorAll(".value-pdf-endpoint-label").length === 2,
            "The preview should contain one density, its area, and two endpoints.");

            var alphaSlider = appDocument.getElementById("alpha-slider");
            alphaSlider.value = "4";
            dispatchInput(alphaSlider, appWindow);
            assert(preview.querySelector(".value-pdf-curve").getAttribute("d") !==
              originalPath,
            "Changing a shape parameter should redraw the value density.");

            var lower = appDocument.getElementById("lower-bound");
            var upper = appDocument.getElementById("upper-bound");
            lower.value = "10";
            dispatchChange(lower, appWindow);
            upper.value = "20";
            dispatchChange(upper, appWindow);
            var endpoints = Array.from(preview.querySelectorAll(
              ".value-pdf-endpoint-label"
            )).map(function (label) { return label.textContent; });
            assert(endpoints[0] === "a = 10" && endpoints[1] === "b = 20",
              "The preview endpoints should follow the current support.");

            chooseBeta(0.5, 0.5);
            assert(!/(NaN|Infinity|undefined)/.test(numericSvgAttributes(preview)),
              "Endpoint-singular shapes should retain finite preview geometry.");
          });
        }
      },
      {
        name: "Value and bid controls both use the support [a,b]",
        run: function () {
          withReset(function () {
            var lower = appDocument.getElementById("lower-bound");
            var upper = appDocument.getElementById("upper-bound");
            var valueNumber = appDocument.getElementById("value-number");
            var valueSlider = appDocument.getElementById("value-slider");
            var bidNumber = appDocument.getElementById("bid-number");
            var bidSlider = appDocument.getElementById("bid-slider");

            assert(lower.value === "0" && upper.value === "100",
              "The valid defaults should satisfy 0 <= a < b.");
            assert(valueNumber.min === "0" && valueNumber.max === "100" &&
              valueSlider.min === "0" && valueSlider.max === "100",
            "Private-value controls should span exactly [a,b].");
            assert(bidNumber.min === "0" && bidNumber.max === "100" &&
              bidSlider.min === "0" && bidSlider.max === "100",
            "Proposed-bid controls should span exactly [a,b].");
            assert(appDocument.getElementById("value-min-label").dataset.mathSource ===
              "\\(a=0\\)" &&
              appDocument.getElementById("value-max-label").dataset.mathSource ===
              "\\(b=100\\)" &&
              appDocument.getElementById("bid-min-label").dataset.mathSource ===
              "\\(a=0\\)" &&
              appDocument.getElementById("bid-max-label").dataset.mathSource ===
              "\\(b=100\\)",
            "Both controls should identify the endpoints a and b.");
            var bidTicks = Array.from(appDocument.querySelectorAll(
              "text[data-bid-tick]"
            )).map(function (tick) { return Number(tick.dataset.bidTick); });
            assert(bidTicks.includes(0) && bidTicks.includes(100) &&
              bidTicks.every(function (tick) { return tick >= 0 && tick <= 100; }),
            "Every bid-axis tick should lie in [a,b] and include both endpoints.");
          });
        }
      },
      {
        name: "Initial graph geometry agrees with the second-price model",
        run: function () {
          withReset(function () {
            var spec = { type: "beta", alpha: 1, beta: 1 };
            var current = model.outcomes(50, 30, 2, 0, 100, spec);
            var truthful = model.truthfulOutcomes(50, 2, 0, 100, spec);
            var captions = Array.from(appDocument.querySelectorAll(".panel-caption"))
              .map(function (element) { return element.textContent; });
            assert(captions.length === 2 &&
              captions[0] === "PDF of highest opposing bid" &&
              captions[1] === "Expected payoff",
            "The two panels should use the second-price titles.");
            assert(appDocument.querySelectorAll(".panel-metric").length === 0,
              "Dynamic metrics should not appear beside panel titles.");
            assert(appDocument.querySelectorAll(".probability-label").length === 1 &&
              appDocument.querySelector(".probability-label").textContent
                .includes("Probability of winning"),
            "The PDF panel should contain one full winning-probability label.");
            assert(appDocument.querySelectorAll(".expected-payoff-label")
              .length === 1 &&
              appDocument.querySelector(".expected-payoff-label").textContent
                .includes("Expected payoff"),
            "The CDF panel should contain one net expected-payoff label.");
            assert(!appDocument.querySelector(".y-axis-title"),
              "The lower panel should not repeat probability as a y-axis title.");
            var guideLabel = appDocument.querySelector(
              ".winning-probability-guide-label"
            );
            var guideLine = appDocument.querySelector(
              ".winning-probability-guide-line"
            );
            var cdfPanelLeft = Number(appDocument.querySelectorAll(
              ".panel-background"
            )[1].getAttribute("x"));
            assert(guideLabel.textContent.replace(/\s+/g, " ").trim()
              .includes("Probability of winning =") &&
              guideLabel.dataset.placement === "y-axis-right" &&
              guideLabel.getAttribute("text-anchor") === "start" &&
              Number(guideLabel.getAttribute("x")) - cdfPanelLeft === 10 &&
              Number(guideLabel.dataset.guideY) ===
                Number(guideLine.getAttribute("y1")),
            "The dashed guide should carry its full probability label at the y-axis.");

            var winningArea = appDocument.querySelector(".winning-area");
            assertClose(Number(winningArea.dataset.endBid), 30,
              "Winning-area endpoint");
            assertClose(Number(winningArea.dataset.probability),
              current.winProbability, "Winning-area probability");

            var payoffArea = appDocument.querySelector(".spa-payoff-area");
            assert(payoffArea.dataset.state === "underbid",
              "The default bid should be classified as an underbid.");
            assertClose(Number(payoffArea.dataset.expectedPayoff),
              current.expectedPayoff, "Displayed expected payoff");
            assertClose(Number(payoffArea.dataset.truthfulPayoff),
              truthful.expectedPayoff, "Displayed truthful payoff");
            assertClose(Number(payoffArea.dataset.probability),
              current.winProbability, "Displayed winning probability");
            assertClose(Number(appDocument.querySelector(
              ".spa-payoff-area-positive"
            ).dataset.positiveArea), current.expectedPayoff,
            "Positive CDF area");

            assert(appDocument.querySelectorAll(
              ".highest-bid-density-curve"
            ).length === 1, "The PDF curve should be present once.");
            assert(appDocument.querySelectorAll(
              ".highest-bid-cdf-curve"
            ).length === 1, "The CDF curve should be present once.");
            assert(!appDocument.querySelector(".expected-payoff-rectangle"),
              "The second-price page should not reuse the first-price rectangle.");
          });
        }
      },
      {
        name: "Default Beta(1,1) reproduces Uniform second-price metrics",
        run: function () {
          withReset(function () {
            var betaArea = appDocument.querySelector(".spa-payoff-area");
            var uniform = model.outcomes(
              50, 30, 2, 0, 100, { type: "uniform" }
            );
            var uniformTruthful = model.truthfulOutcomes(
              50, 2, 0, 100, { type: "uniform" }
            );
            assertClose(Number(betaArea.dataset.probability),
              uniform.winProbability,
            "Beta(1,1) winning probability should equal Uniform.", 1e-8);
            assertClose(Number(betaArea.dataset.expectedPayoff),
              uniform.expectedPayoff,
              "Beta(1,1) expected payoff should equal Uniform.", 1e-7);
            assertClose(Number(betaArea.dataset.truthfulPayoff),
              uniformTruthful.expectedPayoff,
              "Beta(1,1) truthful payoff should equal Uniform.", 1e-7);
            assert(appDocument.getElementById("value-pdf-preview")
              .dataset.alpha === "1" &&
              appDocument.getElementById("value-pdf-preview")
                .dataset.beta === "1",
            "The default preview should expose alpha and beta equal to one.");
          });
        }
      },
      {
        name: "The second-price graph matches a Beta(2,1) benchmark",
        run: function () {
          withReset(function () {
            chooseBeta(2, 1);
            var value = appDocument.getElementById("value-number");
            value.value = "80";
            dispatchChange(value, appWindow);
            var spec = { type: "beta", alpha: 2, beta: 1 };
            var current = model.outcomes(80, 30, 2, 0, 100, spec);
            var truthful = model.truthfulOutcomes(80, 2, 0, 100, spec);
            var area = appDocument.querySelector(".spa-payoff-area");
            var winningArea = appDocument.querySelector(".winning-area");

            assertClose(current.winProbability, 0.09,
              "Analytical Beta(2,1) winning probability", 2e-7);
            assertClose(current.expectedPayment, 1.8,
              "Analytical Beta(2,1) expected payment", 2e-5);
            assertClose(current.expectedPayoff, 5.4,
              "Analytical Beta(2,1) expected payoff", 2e-5);
            assertClose(truthful.expectedPayoff, 17.0666666667,
              "Analytical Beta(2,1) truthful payoff", 2e-4);
            assertClose(Number(area.dataset.probability), current.winProbability,
              "Displayed Beta winning probability", 2e-7);
            assertClose(Number(area.dataset.expectedPayoff), current.expectedPayoff,
              "Displayed Beta expected payoff", 2e-5);
            assertClose(Number(area.dataset.truthfulPayoff),
              truthful.expectedPayoff,
            "Displayed Beta truthful payoff", 2e-4);
            assertClose(Number(winningArea.dataset.probability),
              current.winProbability,
            "Displayed Beta PDF area", 2e-7);
          });
        }
      },
      {
        name: "The graph uses x one and v one notation",
        run: function () {
          withReset(function () {
            var marker = appDocument.querySelector(".truthful-marker");
            var label = appDocument.querySelector(".truthful-label");
            assertClose(Number(marker.dataset.truthfulBid), 50,
              "Truthful marker bid");
            assert(label.textContent === "βᴵᴵ(v₁) = 50",
              "The truthful marker should report the numerical beta II bid.");
            assert(appDocument.querySelector(".axis-bid-label").textContent
              .startsWith("x₁ =") &&
              appDocument.querySelector(".axis-value-label").textContent
                .startsWith("v₁ =") &&
              !appDocument.getElementById("second-price-chart").textContent
                .includes("ᵢ"),
            "Dynamic graph notation should use bidder 1 rather than bidder i.");

            var bidNumber = appDocument.getElementById("bid-number");
            bidNumber.value = "50";
            dispatchChange(bidNumber, appWindow);
            var payoffArea = appDocument.querySelector(".spa-payoff-area");
            assert(payoffArea.dataset.state === "truthful",
              "Bidding v₁ should enter the truthful state.");
            assertClose(Number(payoffArea.dataset.expectedPayoff),
              Number(payoffArea.dataset.truthfulPayoff),
              "Truthful displayed payoff");
            assert(!appDocument.querySelector(".spa-payoff-area-negative"),
              "Truthful bidding should not add a loss area.");
          });
        }
      },
      {
        name: "Overbidding adds a solid red expected-payoff loss area",
        run: function () {
          withReset(function () {
            var bid = appDocument.getElementById("bid-slider");
            bid.value = "90";
            dispatchInput(bid, appWindow);
            var current = model.outcomes(50, 90, 2, 0, 100);
            var truthful = model.truthfulOutcomes(50, 2, 0, 100);
            var group = appDocument.querySelector(".spa-payoff-area");
            var loss = appDocument.querySelector(".spa-payoff-area-negative");
            assert(group.dataset.state === "overbid" && loss,
              "An overbid should create the red loss region.");
            assertClose(Number(loss.dataset.lossArea),
              truthful.expectedPayoff - current.expectedPayoff,
              "Expected-payoff loss area");
            assert(appWindow.getComputedStyle(loss).strokeDasharray === "none",
              "The red loss boundary should be solid.");
            var label = appDocument.querySelector(".expected-payoff-label");
            var bidLine = appDocument.querySelector(".axis-bid-marker");
            assert(current.expectedPayoff > 0 &&
              label.dataset.payoffSign === "positive" &&
              label.dataset.placement === "bid-marker-left" &&
              label.getAttribute("text-anchor") === "end" &&
              Number(bidLine.getAttribute("x1")) -
                Number(label.getAttribute("x")) === 9,
            "A positive overbid payoff should attach just left of x₁.");
          });
        }
      },
      {
        name: "A substantial overbid displays one net expected payoff",
        run: function () {
          withReset(function () {
            var value = appDocument.getElementById("value-number");
            var bid = appDocument.getElementById("bid-number");
            value.value = "30";
            dispatchChange(value, appWindow);
            bid.value = "92";
            dispatchChange(bid, appWindow);

            var current = model.outcomes(30, 92, 2, 0, 100);
            var truthful = model.truthfulOutcomes(30, 2, 0, 100);
            var expectedLabels = appDocument.querySelectorAll(
              ".expected-payoff-label"
            );
            var probabilityLabels = appDocument.querySelectorAll(
              ".probability-label"
            );
            var expectedLabel = expectedLabels[0];
            var lossArea = appDocument.querySelector(".spa-payoff-area-negative");

            assert(current.expectedPayoff < 0,
              "The substantial overbid should have negative expected payoff.");
            assert(expectedLabels.length === 1 &&
              expectedLabel.classList.contains("negative-metric") &&
              expectedLabel.textContent.includes("Expected payoff") &&
              expectedLabel.textContent.includes("-"),
            "A negative overbid should show one red net expected-payoff number.");
            var bidLine = appDocument.querySelector(".axis-bid-marker");
            assert(expectedLabel.dataset.payoffSign === "negative" &&
              expectedLabel.dataset.placement === "bid-marker-right" &&
              expectedLabel.getAttribute("text-anchor") === "start" &&
              Number(expectedLabel.getAttribute("x")) -
                Number(bidLine.getAttribute("x1")) === 9,
            "A negative overbid payoff should attach just right of x₁.");
            assert(probabilityLabels.length === 1,
              "The winning probability should still have one full label.");
            assert(!appDocument.querySelector(".truthful-area-label") &&
              !appDocument.querySelector(".payoff-loss-label") &&
              !appDocument.getElementById("second-price-chart").textContent
                .includes("Truthful expected payoff") &&
              !appDocument.getElementById("second-price-chart").textContent
                .includes("Payoff loss"),
            "The graph should not display separate truthful-payoff or loss labels.");
            assertClose(Number(lossArea.dataset.lossArea),
              truthful.expectedPayoff - current.expectedPayoff,
              "Retained red loss geometry");
          });
        }
      },
      {
        name: "Probability and expected payoff remain labeled at a zero-area edge",
        run: function () {
          withReset(function () {
            var value = appDocument.getElementById("value-number");
            var bid = appDocument.getElementById("bid-number");
            value.value = "0";
            dispatchChange(value, appWindow);
            bid.value = "0";
            dispatchChange(bid, appWindow);

            var probabilityLabels = appDocument.querySelectorAll(
              ".probability-label"
            );
            var expectedLabels = appDocument.querySelectorAll(
              ".expected-payoff-label"
            );
            assert(probabilityLabels.length === 1 &&
              probabilityLabels[0].dataset.placement === "right-of-highlight" &&
              Number(probabilityLabels[0].getAttribute("x")) >
                Number(appDocument.querySelector(".chosen-marker")
                  .getAttribute("x1")) &&
              probabilityLabels[0].textContent.includes("0%"),
            "Zero winning probability should sit right of its zero-width area.");
            assert(expectedLabels.length === 1 &&
              expectedLabels[0].dataset.placement === "bid-marker-right" &&
              expectedLabels[0].dataset.payoffSign === "zero" &&
              !expectedLabels[0].classList.contains("negative-metric") &&
              Number(expectedLabels[0].getAttribute("x")) >
                Number(appDocument.querySelector(".axis-value-marker")
                  .getAttribute("x1")) &&
              expectedLabels[0].textContent.includes("Expected payoff") &&
              Number(expectedLabels[0].dataset.expectedPayoff) === 0,
            "A zero payoff with no width should move right and remain neutral.");
            var guide = appDocument.querySelector(
              ".winning-probability-guide-label"
            );
            assert(guide && guide.textContent.replace(/\s+/g, " ").trim() ===
              "Probability of winning = 0.0%" &&
              guide.dataset.placement === "y-axis-right" &&
              Number(guide.getAttribute("x")) -
                Number(appDocument.querySelectorAll(".panel-background")[1]
                  .getAttribute("x")) === 10 &&
              Number(guide.dataset.guideY) === Number(appDocument.querySelector(
                ".winning-probability-guide-line"
              ).getAttribute("y1")),
            "The full CDF probability label should remain at the y-axis.");
          });
        }
      },
      {
        name: "A short PDF highlight moves its probability label to the right",
        run: function () {
          withReset(function () {
            chooseBeta(10, 0.2);
            var bid = appDocument.getElementById("bid-number");
            bid.value = "70";
            dispatchChange(bid, appWindow);

            var label = appDocument.querySelector(".probability-label");
            var markerX = Number(appDocument.querySelector(".chosen-marker")
              .getAttribute("x1"));
            assert(Number(label.dataset.probability) > 0 &&
              label.dataset.fitFailure === "height" &&
              label.dataset.placement === "right-of-highlight" &&
              label.getAttribute("text-anchor") === "start" &&
              Number(label.getAttribute("x")) - markerX === 12,
            "A nonzero, wide but short PDF area should place its label right of the area.");
          });
        }
      },
      {
        name: "The payoff label flips while the probability label stays at the y-axis",
        run: function () {
          withReset(function () {
            var value = appDocument.getElementById("value-number");
            var bid = appDocument.getElementById("bid-number");
            value.value = "30";
            dispatchChange(value, appWindow);
            bid.value = "100";
            dispatchChange(bid, appWindow);

            var markerX = Number(appDocument.querySelector(
              ".selected-cdf-point"
            ).getAttribute("cx"));
            var payoffLabel = appDocument.querySelector(
              ".expected-payoff-label"
            );
            var guideLabel = appDocument.querySelector(
              ".winning-probability-guide-label"
            );
            assert(payoffLabel.dataset.payoffSign === "negative" &&
              payoffLabel.dataset.placement === "bid-marker-left" &&
              markerX - Number(payoffLabel.getAttribute("x")) === 9,
            "A negative payoff label should flip left while staying beside x₁ at b.");
            assert(guideLabel.dataset.placement === "y-axis-right" &&
              Number(guideLabel.getAttribute("x")) -
                Number(appDocument.querySelectorAll(".panel-background")[1]
                  .getAttribute("x")) === 10 &&
              Number(guideLabel.getAttribute("x")) < markerX,
            "The full CDF probability label should stay fixed at the y-axis.");

            chooseBeta(0.2, 10);
            var pdfLabel = appDocument.querySelector(".probability-label");
            assert(pdfLabel.dataset.placement === "left-of-marker" &&
              markerX - Number(pdfLabel.getAttribute("x")) === 12,
            "A PDF label without right-side room should stay beside x₁ on its left.");
          });
        }
      },
      {
        name: "A short but wide payoff highlight keeps its label inside",
        run: function () {
          withReset(function () {
            var count = appDocument.getElementById("bidder-count");
            var value = appDocument.getElementById("value-number");
            var bid = appDocument.getElementById("bid-number");
            count.value = "10";
            dispatchChange(count, appWindow);
            value.value = "100";
            dispatchChange(value, appWindow);
            bid.value = "50";
            dispatchChange(bid, appWindow);

            var label = appDocument.querySelector(".expected-payoff-label");
            assert(label.dataset.widthFit === "true" &&
              label.dataset.heightFit === "false" &&
              label.dataset.placement === "inside",
            "Payoff placement should ignore insufficient height when width fits.");
          });
        }
      },
      {
        name: "Typed choices, sliders, and keyboard bidding stay synchronized",
        run: function () {
          withReset(function () {
            var valueNumber = appDocument.getElementById("value-number");
            var valueSlider = appDocument.getElementById("value-slider");
            var bidNumber = appDocument.getElementById("bid-number");
            var bidSlider = appDocument.getElementById("bid-slider");
            var chart = appDocument.getElementById("second-price-chart");

            assert(valueSlider.step === "0.2" && bidSlider.step === "0.2",
              "Sliders should be quantized to 1/500 of the [a, b] span, " +
                "matching the chart's own keyboard-nudge step.");

            var QUANTIZATION_TOLERANCE = 0.1;

            valueNumber.value = "65.26";
            dispatchChange(valueNumber, appWindow);
            assert(valueNumber.value === "65.3",
              "The displayed private value should round to one decimal place.");
            assertClose(Number(valueSlider.value), 65.26,
              "Typed value should update its slider.", QUANTIZATION_TOLERANCE);
            assertClose(Number(appDocument.querySelector(
              ".truthful-marker"
            ).dataset.truthfulBid), 65.26,
            "Typed value should move the truthful marker.");
            assert(appDocument.querySelector(".truthful-label").textContent ===
              "βᴵᴵ(v₁) = 65.3",
            "The truthful label should show the rounded bid without a trailing zero.");

            valueNumber.value = "65.04";
            dispatchChange(valueNumber, appWindow);
            assert(valueNumber.value === "65",
              "A typed value that rounds to a whole number should omit the decimal.");
            assertClose(Number(valueSlider.value), 65.04,
              "Rounding to a whole displayed value should still land the " +
                "quantized slider within one step of the exact typed choice.",
              QUANTIZATION_TOLERANCE);

            valueSlider.value = "70";
            dispatchInput(valueSlider, appWindow);
            assert(valueNumber.value === "70",
              "A whole displayed private value should omit the trailing zero.");

            bidNumber.value = "95.7";
            dispatchChange(bidNumber, appWindow);
            assert(bidNumber.value === "95.7",
              "The bid field should retain one necessary decimal place.");
            assertClose(Number(bidSlider.value), 95.7,
              "Typed bid should update its slider.", QUANTIZATION_TOLERANCE);
            assertClose(Number(appDocument.querySelector(
              ".winning-probability-guide-line"
            ).dataset.probability), 0.957,
            "A typed bid should update winning probability within [a,b].");

            bidSlider.value = "90";
            dispatchInput(bidSlider, appWindow);
            assert(bidNumber.value === "90",
              "A whole-number slider bid should omit a trailing zero.");

            chart.dispatchEvent(new appWindow.KeyboardEvent("keydown", {
              key: "End",
              bubbles: true,
              cancelable: true
            }));
            assertClose(Number(bidNumber.value), 100,
              "End should choose the upper endpoint b.");
            chart.dispatchEvent(new appWindow.KeyboardEvent("keydown", {
              key: "Home",
              bubbles: true,
              cancelable: true
            }));
            assertClose(Number(bidNumber.value), 0,
              "Home should choose the lower support endpoint a.");

            bidNumber.value = "140";
            dispatchChange(bidNumber, appWindow);
            assertClose(Number(bidNumber.value), 100,
              "Typed bids above the control domain should clamp to b.");
            bidNumber.value = "";
            dispatchChange(bidNumber, appWindow);
            assertClose(Number(bidNumber.value), 100,
              "An empty bid should restore the last valid choice.");
          });
        }
      },
      {
        name: "A random draw uses the current support and preserves the bid",
        run: function () {
          withReset(function () {
            var lower = appDocument.getElementById("lower-bound");
            var upper = appDocument.getElementById("upper-bound");
            lower.value = "10";
            upper.value = "20";
            dispatchChange(upper, appWindow);

            var bidBefore = Number(appDocument.getElementById("bid-slider").value);
            var originalRandom = appWindow.Math.random;
            appWindow.Math.random = function () { return 0.25; };
            try {
              appDocument.getElementById("random-value-button").click();
            } finally {
              appWindow.Math.random = originalRandom;
            }
            assertClose(Number(appDocument.getElementById("value-slider").value),
              12.5, "Random value");
            assertClose(Number(appDocument.getElementById("value-number").value),
              12.5, "Typed random value");
            assertClose(Number(appDocument.getElementById("bid-slider").value),
              bidBefore, "Bid preserved after draw");
            assert(appDocument.getElementById("value-number").min === "10" &&
              appDocument.getElementById("value-number").max === "20" &&
              appDocument.getElementById("bid-number").min === "10" &&
              appDocument.getElementById("bid-number").max === "20" &&
              appDocument.getElementById("bid-slider").max === "20",
            "Shifted value and bid controls should both retain [a,b].");
          });
        }
      },
      {
        name: "A random draw uses the current Beta quantile",
        run: function () {
          withReset(function () {
            var lower = appDocument.getElementById("lower-bound");
            var upper = appDocument.getElementById("upper-bound");
            lower.value = "10";
            upper.value = "20";
            dispatchChange(upper, appWindow);
            chooseBeta(2, 1);

            var bidBefore = Number(appDocument.getElementById("bid-slider").value);
            var expected = distributions.quantile(
              0.25, 10, 20, { type: "beta", alpha: 2, beta: 1 }
            );
            var originalRandom = appWindow.Math.random;
            appWindow.Math.random = function () { return 0.25; };
            try {
              appDocument.getElementById("random-value-button").click();
            } finally {
              appWindow.Math.random = originalRandom;
            }

            assertClose(Number(appDocument.getElementById("value-slider").value),
              expected, "The random value should use the current Beta quantile.",
              2e-7);
            assertClose(Number(appDocument.getElementById("bid-slider").value),
              bidBefore, "Drawing a Beta value should preserve the proposed bid.");
          });
        }
      },
      {
        name: "Endpoint-singular Beta shapes keep every SVG coordinate finite",
        run: function () {
          withReset(function () {
            chooseBeta(0.5, 0.5);
            assert(!/(NaN|Infinity|undefined)/.test(numericSvgAttributes(
              appDocument.getElementById("second-price-chart")
            )), "Beta(0.5,0.5) should not put non-finite values in the SVG.");
          });
        }
      },
      {
        name: "Invalid bounds revert and never replace the valid auction state",
        run: function () {
          withReset(function () {
            var lower = appDocument.getElementById("lower-bound");
            var upper = appDocument.getElementById("upper-bound");
            var valueBefore = Number(appDocument.getElementById("value-slider").value);
            var bidBefore = Number(appDocument.getElementById("bid-slider").value);

            assert(lower.value === "0" && upper.value === "100",
              "A zero lower bound should be valid.");

            lower.value = "-1";
            dispatchChange(lower, appWindow);
            assert(!appDocument.getElementById("input-error").hidden,
              "A negative lower bound should expose an error.");
            assert(lower.value === "0" && upper.value === "100",
              "A negative lower bound should revert both inputs.");

            upper.value = "0";
            dispatchChange(upper, appWindow);
            assert(lower.value === "0" && upper.value === "100",
              "An upper bound equal to a should revert both inputs.");

            lower.value = "101";
            dispatchChange(lower, appWindow);
            assert(lower.value === "0" && upper.value === "100",
              "A lower bound above b should revert both inputs.");
            assertClose(Number(appDocument.getElementById("value-slider").value),
              valueBefore, "Value after invalid bounds");
            assertClose(Number(appDocument.getElementById("bid-slider").value),
              bidBefore, "Bid after invalid bounds");
            assert(appDocument.getElementById("value-slider").min === "0" &&
              appDocument.getElementById("value-slider").max === "100" &&
              appDocument.getElementById("bid-slider").min === "0" &&
              appDocument.getElementById("bid-slider").max === "100",
            "Invalid bounds should not change either control domain.");
          });
        }
      },
      {
        name: "An active graph drag clamps exactly to both bid endpoints",
        run: function () {
          withReset(function () {
            var chart = appDocument.getElementById("second-price-chart");
            var bidNumber = appDocument.getElementById("bid-number");
            var rectangle = chart.getBoundingClientRect();
            var viewWidth = chart.viewBox.baseVal.width;
            var panel = appDocument.querySelector(".panel-background");
            var plotLeft = Number(panel.getAttribute("x"));
            var plotRight = plotLeft + Number(panel.getAttribute("width"));
            var insideClientX = rectangle.left +
              ((plotLeft + plotRight) / 2 / viewWidth) * rectangle.width;

            chart.dispatchEvent(new appWindow.PointerEvent("pointerdown", {
              bubbles: true,
              clientX: insideClientX,
              clientY: rectangle.top + 100,
              pointerId: 81
            }));
            chart.dispatchEvent(new appWindow.PointerEvent("pointermove", {
              bubbles: true,
              clientX: rectangle.right + 80,
              clientY: rectangle.top + 100,
              pointerId: 81
            }));
            chart.dispatchEvent(new appWindow.PointerEvent("pointerup", {
              bubbles: true,
              clientX: rectangle.right + 80,
              clientY: rectangle.top + 100,
              pointerId: 81
            }));
            assertClose(Number(bidNumber.value), 100,
              "Dragging beyond the right side should finish exactly at b.");

            chart.dispatchEvent(new appWindow.PointerEvent("pointerdown", {
              bubbles: true,
              clientX: insideClientX,
              clientY: rectangle.top + 100,
              pointerId: 82
            }));
            chart.dispatchEvent(new appWindow.PointerEvent("pointermove", {
              bubbles: true,
              clientX: rectangle.left - 80,
              clientY: rectangle.top + 100,
              pointerId: 82
            }));
            chart.dispatchEvent(new appWindow.PointerEvent("pointerup", {
              bubbles: true,
              clientX: rectangle.left - 80,
              clientY: rectangle.top + 100,
              pointerId: 82
            }));
            assertClose(Number(bidNumber.value), 0,
              "Dragging beyond the left side should finish exactly at a.");
          });
        }
      },
      {
        name: "Endpoint annotations remain distinct and off-plot clicks do not change the bid",
        run: function () {
          withReset(function () {
            var chart = appDocument.getElementById("second-price-chart");
            var bidNumber = appDocument.getElementById("bid-number");
            var rectangle = chart.getBoundingClientRect();
            chart.dispatchEvent(new appWindow.PointerEvent("pointerdown", {
              bubbles: true,
              clientX: rectangle.left - 20,
              clientY: rectangle.top + 100,
              pointerId: 71
            }));
            assertClose(Number(bidNumber.value), 30,
              "A click outside the plot should preserve the bid.");

            var valueNumber = appDocument.getElementById("value-number");
            valueNumber.value = "0";
            dispatchChange(valueNumber, appWindow);
            bidNumber.value = "0";
            dispatchChange(bidNumber, appWindow);

            var truthfulLabel = appDocument.querySelector(".truthful-label");
            var probabilityLabel = appDocument.querySelector(
              ".winning-probability-guide-label"
            );
            assert(Math.abs(Number(truthfulLabel.getAttribute("y")) -
              Number(probabilityLabel.getAttribute("y"))) >= 20,
            "The lower-end truthful and probability labels should not overlap.");
            assert(appDocument.querySelector(".coincident-choice-point"),
              "Coincident selected and truthful bids should retain bidder 1's marker.");
            assert(chart.getAttribute("aria-keyshortcuts").includes("ArrowUp") &&
              chart.getAttribute("aria-keyshortcuts").includes("ArrowDown"),
            "Declared keyboard shortcuts should match the implemented arrows.");
          });
        }
      },
      {
        name: "Accessible result text and SVG coordinates stay valid",
        run: function () {
          withReset(function () {
            var chart = appDocument.getElementById("second-price-chart");
            var description = appDocument.getElementById("chart-description");
            var summary = appDocument.getElementById("live-summary");
            assert(chart.getAttribute("aria-labelledby") ===
              "chart-title chart-description",
            "The chart should retain its accessible title and description.");
            assert(description.textContent.includes("highest opposing bid") &&
              description.textContent.includes("expected payment conditional") &&
              description.textContent.includes("truthful bid"),
            "The dynamic chart description should identify its economic objects.");
            assert(summary.getAttribute("aria-live") === "polite" &&
              summary.textContent.includes("probability of winning") &&
              summary.textContent.includes("expected payoff"),
            "The live summary should report changing results.");

            var numericAttributes = [
              "x", "x1", "x2", "y", "y1", "y2", "cx", "cy",
              "width", "height", "r", "d", "points", "transform"
            ];
            var serialized = Array.from(chart.querySelectorAll("*"))
              .map(function (element) {
                return numericAttributes.map(function (attribute) {
                  return element.getAttribute(attribute) || "";
                }).join(" ");
              }).join(" ");
            assert(!/(NaN|Infinity|undefined)/.test(serialized),
              "The SVG should contain only finite coordinates.");
            assert(chart.lastElementChild.classList.contains(
              "winning-probability-guide-label"
            ) && chart.lastElementChild.dataset.foreground === "true",
            "The selected probability should remain in the foreground.");
          });
        }
      },
      {
        name: "Dynamic HTML mathematics is replaced and re-typeset without accumulating output",
        run: async function () {
          reset();
          try {
            var alpha = appDocument.getElementById("alpha-number");
            var beta = appDocument.getElementById("beta-number");
            var lower = appDocument.getElementById("lower-bound");
            var upper = appDocument.getElementById("upper-bound");
            alpha.value = "3.4";
            dispatchChange(alpha, appWindow);
            beta.value = "4.6";
            dispatchChange(beta, appWindow);
            lower.value = "10";
            dispatchChange(lower, appWindow);
            upper.value = "90";
            dispatchChange(upper, appWindow);
            await appWindow.mechanismMathReady;

            ["value-min-label", "value-max-label", "bid-min-label", "bid-max-label"]
              .forEach(function (id) {
                var label = appDocument.getElementById(id);
                assert(label.dataset.mathSource &&
                  label.querySelectorAll('mjx-container[jax="SVG"]').length === 1,
                "Each dynamic endpoint should contain one current MathJax rendering.");
              });
            assert(appDocument.getElementById("value-min-label").dataset.mathSource ===
              "\\(a=10\\)" &&
              appDocument.getElementById("bid-max-label").dataset.mathSource ===
                "\\(b=90\\)",
            "Dynamic endpoint sources should follow the selected support.");
          } finally {
            reset();
            await appWindow.mechanismMathReady;
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
      " second-price interface tests passed.";
    summary.className = failures ? "fail" : "pass";
    document.body.dataset.status = failures ? "failed" : "passed";
    document.title = (failures ? "FAIL" : "PASS") +
      " — SPA interface tests";
    window.clearInterval(testKeepAlive);
  }
}());
