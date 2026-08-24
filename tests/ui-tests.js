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
        document.title = "FAIL — FPA interface tests";
        window.clearInterval(testKeepAlive);
      }
    );
  });

  function assert(condition, message) {
    if (!condition) {
      throw new Error(message);
    }
  }

  function assertClose(actual, expected, tolerance, message) {
    if (Math.abs(actual - expected) > tolerance) {
      throw new Error(message + " Expected " + expected + ", received " + actual + ".");
    }
  }

  function change(element) {
    element.dispatchEvent(new frame.contentWindow.Event("change", { bubbles: true }));
  }

  function input(element) {
    element.dispatchEvent(new frame.contentWindow.Event("input", { bubbles: true }));
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
    var model = appWindow.FPAModel;
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
      change(alphaNumber);
      betaNumber.value = String(beta);
      change(betaNumber);
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
        name: "The first-price route loads the shared distribution kernel first",
        run: function () {
          var sources = Array.from(appDocument.querySelectorAll("head > script[defer]"))
            .map(function (script) { return script.getAttribute("src"); });
          assert(JSON.stringify(sources) === JSON.stringify([
            "../../js/components.js",
            "../../js/mathjax-config.js",
            "../../assets/mathjax/tex-svg.js",
            "../../js/distributions.js",
            "model.js",
            "app.js"
          ]), "The shared page-scaffolding components must load before MathJax, " +
            "the shared kernel, model, and app.");
          assert(sources.every(function (source) {
            return source && !/^https?:/i.test(source);
          }), "Every script should remain local for offline file use.");
          assert(appWindow.MathJax && /^4\./.test(appWindow.MathJax.version) &&
            typeof appWindow.MathJax.typesetPromise === "function",
          "The local MathJax 4 SVG renderer should be available.");
          assert(distributions && typeof distributions.quantile === "function",
            "AuctionDistributions should be available to the page.");
          assert(model && typeof model.outcomes === "function",
            "FPAModel should be available to the page.");
        }
      },
      {
        name: "The general first-price equilibrium notation is stated at the top",
        run: function () {
          var introduction = appDocument.querySelector(".introduction");
          var equation = introduction.querySelector(".equation-display");
          assert(equation.querySelector('mjx-container[jax="SVG"]'),
            "The equilibrium equation should be rendered from TeX by MathJax.");
          assert(equation.getAttribute("aria-label").includes("beta superscript I") &&
            equation.getAttribute("aria-label").includes("conditional") &&
            equation.getAttribute("aria-label").includes("greater than") &&
            !equation.getAttribute("aria-label").includes("or equal") &&
            equation.querySelector('[data-mml-node="math"][data-latex*="v_i > Y_1"]'),
          "The rendered equilibrium equation should retain its accessible meaning.");
          var definition = introduction.querySelector(".highest-value-definition");
          assert(definition && definition.querySelector('mjx-container[jax="SVG"]') &&
            definition.getAttribute("aria-label").includes("maximum") &&
            definition.getAttribute("aria-label").includes("X subscript 1") &&
            definition.getAttribute("aria-label").includes("n minus 1") &&
            introduction.querySelector(
              '[data-mml-node="math"][data-latex*="X_1"][data-latex*="X_{n-1}"]'
            ),
            "The introduction should define Y_1 using n-1 auxiliary opponent draws.");
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
          assert(appDocument.querySelectorAll("mjx-container").length > 10,
            "The page should contain rendered inline and display mathematics.");
          assert(!appDocument.querySelector(
            'mjx-merror, [data-mml-node="merror"], .MathJax_Error'
          ),
            "Every TeX expression should render without a MathJax error.");
          assert(Array.from(appDocument.querySelectorAll(".equation-chain-steps"))
            .every(function (chain) {
              return appWindow.getComputedStyle(chain).overflowX === "auto";
            }),
          "Display formulas should contain long MathJax output at compact widths.");
          assert(!appDocument.querySelector("#tradeoff-chart mjx-container") &&
            appDocument.querySelector("#tradeoff-chart .panel-caption"),
          "The custom graph should retain its native SVG labels.");
        }
      },
      {
        name: "The page, controls, and SVG labels use Times New Roman",
        run: function () {
          [
            appDocument.body,
            appDocument.getElementById("bidder-count"),
            appDocument.getElementById("value-number"),
            appDocument.getElementById("bid-number"),
            appDocument.querySelector(".text-button"),
            appDocument.querySelector(".panel-caption")
          ].forEach(function (element) {
            var family = appWindow.getComputedStyle(element).fontFamily;
            assert(/Times New Roman/i.test(family),
              "Expected Times New Roman, received " + family + ".");
          });
        }
      },
      {
        name: "The module page links back to the root menu",
        run: function () {
          var wordmark = appDocument.querySelector(".wordmark");
          assert(wordmark && wordmark.getAttribute("href") === "../../index.html" &&
            wordmark.textContent === "Mechanism Design Explorer" &&
            appDocument.title.endsWith("| Mechanism Design Explorer"),
          "The Explorer wordmark should link to the root menu.");
        }
      },
      {
        name: "Model parameters remain above a chart with right-hand sliders",
        run: function () {
          var parameters = appDocument.querySelector(".model-specifications");
          var chart = appDocument.getElementById("tradeoff-chart");
          var choices = appDocument.querySelector(".choice-controls");
          assert(parameters.compareDocumentPosition(chart) & Node.DOCUMENT_POSITION_FOLLOWING,
            "The chart must follow model parameters in source order.");
          assert(chart.compareDocumentPosition(choices) & Node.DOCUMENT_POSITION_FOLLOWING,
            "The sliders must follow the chart in source order.");
          var chartRect = appDocument.querySelector(".chart-column").getBoundingClientRect();
          var choicesRect = choices.getBoundingClientRect();
          assert(choicesRect.left >= chartRect.right,
            "At desktop width, the sliders must be to the right of the graph.");
          assert(Math.abs(choicesRect.top - chartRect.top) < 5,
            "The graph and slider column should begin on the same row.");
        }
      },
      {
        name: "Requested section boundaries remain and slider numbers are black",
        run: function () {
          var borderWidth = function (element, side) {
            return Number.parseFloat(
              appWindow.getComputedStyle(element)["border" + side + "Width"]
            );
          };
          var parameters = appDocument.querySelector(".model-specifications");
          var derivation = appDocument.querySelector(".derivation");
          var notes = appDocument.querySelector(".notes");
          assert(borderWidth(parameters, "Top") > 0 &&
            borderWidth(parameters, "Bottom") === 0,
            "Only the introduction-to-demo boundary should remain above the demo.");
          assert(borderWidth(derivation, "Top") > 0,
            "The demo-to-derivation boundary should remain.");
          assert(notes && borderWidth(notes, "Top") > 0,
            "The Notes section should have its requested faint separator.");
          assert(borderWidth(appDocument.querySelector(".site-header"), "Bottom") === 0 &&
            borderWidth(appDocument.querySelector(".chart-frame"), "Top") === 0 &&
            borderWidth(appDocument.querySelector(".chart-frame"), "Bottom") === 0 &&
            borderWidth(appDocument.querySelector(".choice-controls"), "Left") === 0 &&
            borderWidth(appDocument.querySelector(".site-footer"), "Top") === 0,
            "Decorative page and chart-frame rules should be removed.");
          assert(!appDocument.querySelector(".chart-instruction"),
            "The proposed-bid drag instruction paragraph should be removed.");
          [
            appDocument.getElementById("value-number"),
            appDocument.getElementById("bid-number"),
            appDocument.getElementById("value-min-label"),
            appDocument.getElementById("value-max-label"),
            appDocument.getElementById("bid-min-label"),
            appDocument.getElementById("bid-max-label")
          ].forEach(function (element) {
            assert(appWindow.getComputedStyle(element).color === "rgb(0, 0, 0)",
              "Slider numbers should be black.");
          });
        }
      },
      {
        name: "The revised spacing, parameter alignment, Notes, and References are present",
        run: function () {
          var parameters = appDocument.querySelector(".model-specifications");
          var parameterItems = Array.from(appDocument.querySelector(
            ".parameter-grid"
          ).children);
          var tops = parameterItems.map(function (item) {
            return item.getBoundingClientRect().top;
          });
          var chart = appDocument.getElementById("tradeoff-chart");
          var explorable = appDocument.querySelector(".explorable");
          var equation = appDocument.querySelector(".equation-display");
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
          assertClose(Number.parseFloat(appWindow.getComputedStyle(equation).fontSize),
            Number.parseFloat(appWindow.getComputedStyle(appDocument.body).fontSize),
            0.01, "The equilibrium equation should use body-text size");
          assert(notes.querySelector("h2").textContent === "Notes" &&
            notes.querySelectorAll(".notes-list > li").length === 2,
          "Notes should contain the user-authored bullet list.");
          assert(references.querySelector("h2").textContent === "References" &&
            references.querySelectorAll(".reference-list > li").length === 1 &&
            citation.getAttribute("href") ===
              "https://shop.elsevier.com/books/auction-theory/krishna/978-0-12-374507-1" &&
            references.textContent.includes("Proposition 2.2") &&
            references.textContent.includes("pp. 14–16"),
          "References should contain the requested first-price Krishna citation.");
        }
      },
      {
        name: "Beta controls default to the uniform shape and the general proof remains visible",
        run: function () {
          withReset(function () {
            var controls = appDocument.getElementById("beta-shape-controls");
            var shapeInputs = Array.from(controls.querySelectorAll("input"));
            var derivation = appDocument.querySelector(".derivation");

            assert(!appDocument.getElementById("distribution"),
              "The distribution selector should be removed.");
            assert(!appDocument.getElementById("parameter-note"),
              "The value-distribution equation below the parameters should be removed.");
            assert(!controls.hidden,
              "Beta shape controls should always be displayed.");
            assert(shapeInputs.every(function (element) { return !element.disabled; }),
              "Always-visible Beta shape controls should remain enabled.");
            assert(appDocument.getElementById("alpha-number").value === "1" &&
              appDocument.getElementById("beta-number").value === "1",
            "Alpha and beta should both default to one.");
            assert(derivation && !derivation.hidden &&
              !derivation.hasAttribute("data-distribution-specific") &&
              derivation.querySelector("h2").textContent ===
                "Optimal bid for bidder 1" &&
              derivation.querySelectorAll(
                "#expected-utility-proof .equation-step-rhs:not(.equation-step-extra)"
              ).length === 6 &&
              derivation.querySelectorAll(
                "#optimality-gap-proof .equation-step-rhs:not(.equation-step-extra)"
              ).length === 2,
            "The general optimal-bid proof should be visible for Beta(1,1).");
            var expectedUtilitySource = Array.from(derivation.querySelectorAll(
              '#expected-utility-proof [data-mml-node="math"]'
            )).map(function (node) { return node.dataset.latex; }).join(" ");
            var optimalityGapSource = Array.from(derivation.querySelectorAll(
              '#optimality-gap-proof [data-mml-node="math"]'
            )).map(function (node) { return node.dataset.latex; }).join(" ");
            assert(derivation.querySelector(
              '[data-mml-node="math"][data-latex="G(y)=F(y)^{n-1}"]'
            ) &&
              expectedUtilitySource.includes("\\beta^{\\mathrm{I}}(z)") &&
              expectedUtilitySource.includes("\\int_a^z y g(y)") &&
              !expectedUtilitySource.includes("\\int_0^z") &&
              optimalityGapSource.includes(
                "G(z)(z-v_1)+\\int_z^{v_1}G(y)"
              ) &&
              !/z\(x_1\)|h_\{B_1\}/.test(
                expectedUtilitySource + optimalityGapSource
              ),
            "The proof should use the support lower bound a and the stated payoff difference.");

            chooseBeta(2, 1);
            assert(!derivation.hidden,
              "The general optimal-bid proof should remain visible for other Beta shapes.");
            assert(controls.contains(appDocument.getElementById("value-pdf-preview")),
              "The Beta value-PDF preview should be part of the shape controls.");
            assert(appDocument.querySelector(".value-pdf-preview-figure figcaption")
              .textContent.replace(/\s+/g, " ").trim() === "PDF of Value",
            "The small distribution figure should be labeled PDF of Value.");

            chooseBeta(1, 1);
            assert(!controls.hidden && !derivation.hidden,
              "Returning both shapes to one should preserve the controls and proof.");
          });
        }
      },
      {
        name: "Equation-chain dividers reveal only the authored extra steps",
        run: function () {
          var toggles = Array.from(appDocument.querySelectorAll(
            ".equation-chain-divider-toggle"
          ));
          assert(toggles.length === 6,
            "The expected-utility chain's 5 internal gaps and the " +
              "optimality-gap chain's 1 internal gap should each expose " +
              "their own divider.");
          var activeToggles = toggles.filter(function (toggle) {
            return !toggle.hidden;
          });
          assert(activeToggles.length === 2 &&
            toggles.filter(function (toggle) { return toggle.hidden; }).length === 4,
          "Only the two gaps with authored extra rows should expose a control.");
          assert(toggles.every(function (toggle) {
            return toggle.getAttribute("aria-expanded") === "false";
          }), "Every divider should start collapsed.");
          assert(appDocument.querySelectorAll(
            ".equation-step-rhs.equation-step-extra"
          ).length === 5,
          "The two expanded derivations should contain the five authored extra equations.");
          var rules = appDocument.querySelectorAll(".equation-chain-divider-rule");
          assert(rules.length === 2 && Array.from(rules).every(function (rule) {
            return rule.hidden;
          }), "Each authored block should have one initially hidden closing rule.");

          var toggle = activeToggles[0];
          var rows = [];
          var node = toggle.nextElementSibling;
          while (node && node.classList.contains("equation-step-extra")) {
            rows.push(node);
            node = node.nextElementSibling;
          }
          var ordinaryRhs = appDocument.querySelector(
            "#expected-utility-proof .equation-step-rhs:not(.equation-step-extra)"
          );
          var extraRhs = rows.filter(function (row) {
            return row.classList.contains("equation-step-rhs");
          })[0];
          try {
            var ordinaryStyle = appWindow.getComputedStyle(ordinaryRhs);
            var extraStyle = appWindow.getComputedStyle(extraRhs);
            ["gridColumnStart", "border", "backgroundColor", "padding",
              "fontFamily", "fontSize"].forEach(function (property) {
              assert(extraStyle[property] === ordinaryStyle[property],
                "An extra step's " + property + " should match an ordinary " +
                  "step's exactly, so it renders seamlessly inline.");
            });

            var toggleStyle = appWindow.getComputedStyle(toggle);
            assert(toggleStyle.gridColumnStart === "1" &&
              toggleStyle.gridColumnEnd === "-1",
            "A divider toggle should span the full chain width, not one column.");

            toggle.click();
            assert(toggle.getAttribute("aria-expanded") === "true" &&
              rows.every(function (row) { return !row.hidden; }) &&
              node.classList.contains("equation-chain-divider-rule") && !node.hidden,
            "Clicking the divider should reveal its authored rows and closing rule.");
          } finally {
            if (toggle.getAttribute("aria-expanded") === "true") {
              toggle.click();
            }
          }
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
            change(alphaNumber);
            assertClose(Number(alphaSlider.value), 3.4, 1e-9,
              "Typing alpha should update its slider.");

            betaSlider.value = "4.6";
            input(betaSlider);
            assertClose(Number(betaNumber.value), 4.6, 1e-9,
              "Moving the beta slider should update its number field.");
          });
        }
      },
      {
        name: "The Beta value-PDF preview follows shapes and support bounds",
        run: function () {
          withReset(function () {
            chooseBeta(2, 2);
            var preview = appDocument.getElementById("value-pdf-preview");
            var previewFigure = appDocument.querySelector(
              ".value-pdf-preview-figure"
            );
            var previewCaption = previewFigure.querySelector("figcaption");
            var initialCurve = preview.querySelector(".value-pdf-curve");
            var initialPath = initialCurve.getAttribute("d");

            var previewRect = preview.getBoundingClientRect();
            var captionRect = previewCaption.getBoundingClientRect();
            assert(Math.abs(captionRect.left -
              (previewRect.left + previewRect.width * 14 / 320)) < 1.5,
            "The PDF of Value caption should align with the plotted PDF area.");

            assert(preview.querySelector("title").textContent === "PDF of Value",
              "The preview should have the requested accessible title.");
            assert(preview.querySelector("desc").textContent.includes("alpha 2") &&
              preview.querySelector("desc").textContent.includes("beta 2"),
            "The preview description should identify the selected shapes.");
            assert(preview.querySelectorAll(".value-pdf-endpoint-label").length === 2,
              "The preview should directly label both support endpoints.");
            assert(!/(NaN|Infinity|undefined)/.test(numericSvgAttributes(preview)),
              "The initial value-PDF preview should use finite SVG geometry.");

            var alphaNumber = appDocument.getElementById("alpha-number");
            alphaNumber.value = "4";
            change(alphaNumber);
            var shapedCurve = preview.querySelector(".value-pdf-curve");
            assert(shapedCurve.getAttribute("d") !== initialPath,
              "Changing alpha should redraw the value-PDF curve.");
            assert(shapedCurve.dataset.alpha === "4" &&
              shapedCurve.dataset.beta === "2",
            "The preview curve should record the current shapes.");

            var lower = appDocument.getElementById("lower-bound");
            var upper = appDocument.getElementById("upper-bound");
            lower.value = "10";
            change(lower);
            upper.value = "20";
            change(upper);
            var endpointLabels = Array.from(preview.querySelectorAll(
              ".value-pdf-endpoint-label"
            )).map(function (label) { return label.textContent; });
            assert(JSON.stringify(endpointLabels) ===
              JSON.stringify(["a = 10", "b = 20"]),
              "Changing a and b should update the preview endpoint labels.");
            assert(preview.querySelector(".value-pdf-curve")
              .dataset.lowerBound === "10" &&
              preview.querySelector(".value-pdf-curve")
                .dataset.upperBound === "20",
            "The preview should record the current transformed support.");
          });
        }
      },
      {
        name: "Requested SVG geometry is displayed on initialization",
        run: function () {
          var captions = Array.from(appDocument.querySelectorAll(".panel-caption"))
            .slice(0, 2)
            .map(function (caption) { return caption.textContent; });
          assert(JSON.stringify(captions) === JSON.stringify([
            "PDF of highest opposing bid",
            "Expected payoff"
          ]), "The two panel titles do not match the requested wording.");
          var panelBackgrounds = appDocument.querySelectorAll(".panel-background");
          assert(panelBackgrounds.length === 2,
            "The chart should contain exactly two plot panels.");
          assertClose(Number.parseFloat(panelBackgrounds[0].getAttribute("height")), 170, 1e-9,
            "The PDF panel should retain its original height.");
          assert(Number.parseFloat(panelBackgrounds[1].getAttribute("height")) >= 340,
            "The CDF panel should occupy approximately two former panel heights.");
          assert(appDocument.querySelectorAll(".panel-subtitle").length === 0,
            "Panel subheaders should not be rendered.");
          assert(!appDocument.querySelector(".figure-heading"),
            "The Outcomes heading and subheading should be removed.");
          assert(!appDocument.querySelector(".figure-key"),
            "The chart legend should be removed.");
          assert(!appDocument.getElementById("choices-title"),
            "The visible Focal Bidder heading should be removed.");
          assert(appDocument.querySelectorAll(".equilibrium-marker").length === 2,
            "Expected the equilibrium bid to be marked in both panels.");
          assert(appDocument.querySelectorAll(".density-equilibrium-marker")
            .length === 1,
          "Expected one dedicated equilibrium marker in the PDF panel.");
          assert(appDocument.querySelectorAll(".equilibrium-point").length === 1,
            "Expected one equilibrium point in the expected-payoff panel.");
          assert(appDocument.querySelectorAll(".highest-bid-density-curve").length === 1,
            "Expected a highest-opponent-bid density curve.");
          assert(appDocument.querySelectorAll(".winning-area").length === 1,
            "Expected a shaded winning-probability area.");
          assert(appDocument.querySelectorAll(".payment-curve").length === 0,
            "The separate payment curve should be removed.");
          assert(appDocument.querySelectorAll(".payoff-if-win-gap").length === 0,
            "The separate vertical payoff gap should be removed.");
          assert(appDocument.querySelectorAll(".highest-bid-cdf-curve").length === 1,
            "Expected a CDF of the highest opposing bid.");
          assert(appDocument.querySelectorAll(".expected-payoff-rectangle").length === 1,
            "Expected an expected-payoff rectangle.");
          assert(appDocument.querySelectorAll(".cdf-zero-axis").length === 1,
            "Expected the CDF graph's bid axis at probability zero.");
          assert(appDocument.querySelectorAll(".maximum-label").length === 2,
            "Expected the equilibrium bid to be labeled in both panels.");
          assert(!appDocument.querySelector(".current-results"),
            "The separate results section should be removed.");
          assert(appDocument.querySelectorAll(".panel-metric").length === 0,
            "No metric should remain to the right of a graph title.");
          assert(appDocument.querySelectorAll(".area-label").length === 1 &&
            appDocument.querySelectorAll(".expected-payoff-label").length === 1,
          "Probability and expected payoff should each have one in-graph label.");
          var svgText = appDocument.getElementById("tradeoff-chart").textContent;
          ["Probability of winning =", "Payoff if you win: v₁ − x₁ =",
            "Expected payoff =", "Probability of winning",
            "x₁ = 30", "v₁ = 50"]
            .forEach(function (label) {
              assert(svgText.includes(label), "Missing SVG metric label: " + label);
            });
          assert(!svgText.includes("Expected payoff at"),
            "The expected-payoff metric should not begin with At x.");
          assert(!svgText.includes("Shaded area"),
            "The probability metric should not say shaded area.");
          assert(!svgText.includes("Bid, x₁"),
            "The second panel should not have a bid-axis title.");
          var chartDescription = appDocument.getElementById("chart-description").textContent;
          assert(chartDescription.includes(
            "probability of winning against bid x subscript 1") &&
            chartDescription.includes("dashed horizontal guide") &&
            !chartDescription.includes("all opposing bids"),
            "The SVG description should explain the probability axis and guide.");
          var probabilityLabel = appDocument.querySelector(".area-label");
          assert(probabilityLabel && probabilityLabel.textContent.includes("60.0%"),
            "The default shaded region should include the 60.0% probability.");
          assert(!appDocument.querySelector(".y-axis-title"),
            "The second panel should not have a vertical-axis title.");
          var paymentLabel = appDocument.querySelector(".axis-payment-label");
          assert(paymentLabel && paymentLabel.textContent === "x₁ = 30" &&
            !paymentLabel.textContent.includes("payment"),
            "The selected-bid coordinate should not include a payment parenthetical.");
          var payoffBracket = appDocument.querySelector(".payoff-if-win-bracket");
          assert(payoffBracket && payoffBracket.textContent.startsWith("Payoff if you win"),
            "Payoff upon winning should be embedded as an x-axis interval.");
          assertClose(Number.parseFloat(payoffBracket.dataset.signedWidth), 20, 1e-9,
            "The x-axis payoff interval should equal v_1 minus x_1.");
          var maximumLabel = appDocument.querySelector(
            ".maximum-label:not(.density-equilibrium-label)"
          );
          assert(maximumLabel && maximumLabel.textContent === "βᴵ(v₁) = 25",
            "The equilibrium annotation should include the numerical equilibrium bid.");
          var densityEquilibriumLabel = appDocument.querySelector(
            ".density-equilibrium-label"
          );
          var densityEquilibriumMarker = appDocument.querySelector(
            ".density-equilibrium-marker"
          );
          assert(densityEquilibriumLabel && densityEquilibriumMarker &&
            densityEquilibriumLabel.textContent === "βᴵ(v₁) = 25" &&
            densityEquilibriumLabel.dataset.panel === "pdf" &&
            Number(densityEquilibriumLabel.dataset.equilibriumBid) === 25 &&
            Number(densityEquilibriumMarker.dataset.equilibriumBid) === 25,
          "The PDF panel should directly label the numerical equilibrium bid.");
          assert(svgText.includes("βᴵ(b) ="),
            "The density-support label should use beta superscript I.");
          assert(!svgText.includes("β("),
            "Every beta in the SVG should carry the superscript I.");
          var zeroAxis = appDocument.querySelector(".cdf-zero-axis");
          var matchingZeroLine = Array.from(appDocument.querySelectorAll(".zero-line"))
            .some(function (line) { return line.getAttribute("y1") === zeroAxis.getAttribute("y1"); });
          assert(matchingZeroLine, "The CDF bid axis must coincide with probability zero.");
          var areaEnd = Number.parseFloat(appDocument.querySelector(".winning-area").dataset.endBid);
          var supportEnd = Number.parseFloat(appDocument.querySelector(".support-guide").dataset.supportBid);
          assert(areaEnd <= supportEnd, "The shaded area extends past the density support.");
          var rectangle = appDocument.querySelector(".expected-payoff-rectangle");
          assertClose(Number.parseFloat(rectangle.dataset.probability), 0.6, 1e-9,
            "The rectangle height should equal the default winning probability.");
          assertClose(Number.parseFloat(rectangle.dataset.signedWidth), 20, 1e-9,
            "The rectangle's signed width should equal value minus bid.");
          assertClose(Number.parseFloat(rectangle.dataset.signedPayoff), 12, 1e-9,
            "The rectangle's signed area should equal expected payoff.");
          assert(rectangle.dataset.state === "positive",
            "The default rectangle should represent positive expected payoff.");
          var probabilityGuide = appDocument.querySelector(
            ".winning-probability-guide-line"
          );
          var probabilityGuideLabel = appDocument.querySelector(
            ".winning-probability-guide-label"
          );
          var selectedPoints = appDocument.querySelectorAll(".chosen-point");
          var selectedCdfPoint = selectedPoints[selectedPoints.length - 1];
          assert(probabilityGuide && probabilityGuideLabel,
            "The selected winning probability should have a guide and label.");
          assertClose(Number.parseFloat(probabilityGuide.dataset.probability), 0.6, 1e-9,
            "The guide should store the selected winning probability.");
          assertClose(Number.parseFloat(probabilityGuide.getAttribute("y1")),
            Number.parseFloat(selectedCdfPoint.getAttribute("cy")), 1e-9,
            "The probability guide should share the selected CDF point's height.");
          assertClose(Number.parseFloat(probabilityGuide.getAttribute("x2")),
            Number.parseFloat(selectedCdfPoint.getAttribute("cx")), 1e-9,
            "The probability guide should end at the selected CDF point.");
          assert(probabilityGuideLabel.textContent ===
            "Probability of winning = 60.0%" &&
            probabilityGuideLabel.classList.contains("annotation-halo") &&
            probabilityGuideLabel.dataset.foreground === "true",
            "The foreground guide label should state the selected probability.");
          var cdfBackground = panelBackgrounds[1];
          assertClose(Number(probabilityGuideLabel.getAttribute("x")),
            Number(cdfBackground.getAttribute("x")) + 8, 1e-9,
            "The guide label should sit just inside the probability axis.");
          assert(probabilityGuideLabel.dataset.placement === "axis-right" &&
            probabilityGuideLabel.getAttribute("text-anchor") === "start",
            "The guide label should extend rightward from the probability axis.");
          assertClose(Number(probabilityGuideLabel.dataset.guideY),
            Number(probabilityGuide.getAttribute("y1")), 1e-9,
            "The axis label should identify the dashed guide''s probability level.");
          assert(appDocument.getElementById("tradeoff-chart").lastElementChild ===
            probabilityGuideLabel,
            "The selected probability number should be the foreground SVG element.");
          assert(appDocument.querySelector(
            'label[for="value-slider"] [data-mml-node="math"][data-latex="v_1"]'
          ),
            "The value slider should use v_1 notation.");
          assert(appDocument.querySelector(
            'label[for="bid-slider"] [data-mml-node="math"][data-latex="x_1"]'
          ),
            "The bid slider should use x_1 notation.");
        }
      },
      {
        name: "Typed value and bid controls stay synchronized with the sliders",
        run: function () {
          var valueNumber = appDocument.getElementById("value-number");
          var bidNumber = appDocument.getElementById("bid-number");
          var valueSlider = appDocument.getElementById("value-slider");
          var bidSlider = appDocument.getElementById("bid-slider");

          assert(valueNumber.type === "number" && bidNumber.type === "number",
            "The value and bid readouts should be editable numeric fields.");
          assert(valueNumber.min === "0" && valueNumber.max === "100" &&
            bidNumber.min === "0" && bidNumber.max === "100",
            "Typed controls should use the current value support.");
          assert(bidNumber.value === "30",
            "The proposed-bid field should omit a trailing zero.");

          valueNumber.value = "65";
          change(valueNumber);
          assertClose(Number.parseFloat(valueSlider.value), 65, 1e-9,
            "Typing a private value should update its slider.");
          assertClose(Number.parseFloat(
            appDocument.querySelector(".cdf-value-guide").dataset.value
          ), 65, 1e-9, "Typing a private value should update the graph.");

          bidNumber.value = "45";
          change(bidNumber);
          assertClose(Number.parseFloat(bidSlider.value), 45, 1e-9,
            "Typing a proposed bid should update its slider.");
          assert(bidNumber.value === "45",
            "A whole proposed bid should omit its trailing zero.");
          assert(appDocument.querySelector(".axis-payment-label").textContent === "x₁ = 45",
            "Typing a proposed bid should update the graph coordinate.");
          assertClose(Number.parseFloat(
            appDocument.querySelector(".winning-probability-guide-line")
              .dataset.probability
          ), 0.9, 1e-9, "Typing a proposed bid should update winning probability.");

          bidNumber.value = "45.66";
          change(bidNumber);
          assert(bidNumber.value === "45.7",
            "The proposed-bid field should round to the nearest tenth.");

          bidSlider.value = "25";
          input(bidSlider);
          assertClose(Number.parseFloat(bidNumber.value), 25, 1e-9,
            "Moving the bid slider should update the typed field.");
          assert(bidNumber.value === "25",
            "Whole-number slider updates should omit a trailing zero.");
          valueSlider.value = "70";
          input(valueSlider);
          assertClose(Number.parseFloat(valueNumber.value), 70, 1e-9,
            "Moving the value slider should update the typed field.");

          bidNumber.value = "120";
          change(bidNumber);
          assertClose(Number.parseFloat(bidNumber.value), 100, 1e-9,
            "An out-of-support typed bid should clamp to the upper endpoint.");
          assert(bidNumber.value === "100",
            "A whole-number clamped bid should omit a trailing zero.");
          assertClose(Number.parseFloat(bidSlider.value), 100, 1e-9,
            "A clamped typed bid should remain synchronized with its slider.");

          valueNumber.value = "";
          change(valueNumber);
          assertClose(Number.parseFloat(valueNumber.value), 70, 1e-9,
            "An empty typed value should restore the last valid value.");

          appDocument.getElementById("reset-button").click();
        }
      },
      {
        name: "Dynamic in-graph labels wrap before they are suppressed",
        run: function () {
          var value = appDocument.getElementById("value-slider");
          var bid = appDocument.getElementById("bid-slider");
          value.value = "34";
          input(value);
          bid.value = "20";
          input(bid);

          var probabilityLabel = appDocument.querySelector(".area-label");
          var payoffLabel = appDocument.querySelector(".expected-payoff-label");
          assert(probabilityLabel && probabilityLabel.dataset.layout === "wrapped" &&
            probabilityLabel.querySelectorAll("tspan").length > 1,
            "The probability label should wrap inside a narrower shaded area.");
          assert(payoffLabel && payoffLabel.dataset.layout === "wrapped" &&
            payoffLabel.querySelectorAll("tspan").length > 1,
            "The expected-payoff label should wrap inside a narrower rectangle.");
          assert(probabilityLabel.textContent.replace(/\s+/g, " ").trim()
            .startsWith("Probability of winning ="),
            "Wrapping should preserve the probability label wording.");
          assert(payoffLabel.textContent.replace(/\s+/g, " ").trim()
            .startsWith("Expected payoff ="),
            "Wrapping should preserve the expected-payoff label wording.");

          appDocument.getElementById("reset-button").click();
        }
      },
      {
        name: "The payoff rectangle handles zero and negative bids correctly",
        run: function () {
          var value = appDocument.getElementById("value-slider");
          var bid = appDocument.getElementById("bid-slider");

          value.value = "80";
          input(value);

          bid.value = "90";
          input(bid);
          var negativeRectangle = appDocument.querySelector(".expected-payoff-rectangle");
          assert(negativeRectangle.dataset.state === "negative",
            "A bid above value should produce a negative rectangle state.");
          assertClose(Number.parseFloat(negativeRectangle.dataset.probability), 1, 1e-9,
            "A bid above the opposing-bid support should win with probability one.");
          assertClose(Number.parseFloat(negativeRectangle.dataset.signedWidth), -10, 1e-9,
            "The overbid rectangle should have signed width -10.");
          assertClose(Number.parseFloat(negativeRectangle.dataset.signedPayoff), -10, 1e-9,
            "The overbid rectangle should have signed payoff -10.");
          assert(negativeRectangle.classList.contains("expected-payoff-negative"),
            "A negative-payoff rectangle should have a distinct loss style.");
          assert(appWindow.getComputedStyle(negativeRectangle).strokeDasharray === "none",
            "The negative expected-payoff rectangle should use a solid red outline.");
          var negativeLabel = appDocument.querySelector(".expected-payoff-label");
          assert(negativeLabel &&
            negativeLabel.textContent.replace(/\s+/g, " ").trim() ===
              "Expected payoff = -10",
            "The red loss label should use the ordinary Expected payoff wording.");
          assert(negativeLabel.classList.contains("negative-metric"),
            "The ordinary expected-payoff wording should remain red for a loss.");
          assert(!negativeLabel.textContent.includes("Negative expected payoff"),
            "The loss label should not prefix expected payoff with Negative.");
          var negativeBracket = appDocument.querySelector(".payoff-if-win-bracket");
          assert(negativeBracket.dataset.state === "negative",
            "An overbid should produce a negative x-axis payoff interval.");
          assertClose(Number.parseFloat(negativeBracket.dataset.signedWidth), -10, 1e-9,
            "The overbid x-axis interval should have signed width -10.");
          assert(appWindow.getComputedStyle(
            negativeBracket.querySelector(".payoff-bracket-line")
          ).strokeDasharray === "none",
          "The negative payoff bracket should use a solid red line.");
          var guideAtOne = appDocument.querySelector(".winning-probability-guide-label");
          assert(guideAtOne && guideAtOne.textContent ===
            "Probability of winning = 100.0%" &&
            appDocument.getElementById("tradeoff-chart").lastElementChild === guideAtOne,
            "The probability number should remain in the foreground at probability one.");
          var cdfBackground = appDocument.querySelectorAll(".panel-background")[1];
          assert(guideAtOne.dataset.placement === "axis-right" &&
            guideAtOne.getAttribute("text-anchor") === "start",
          "At the right boundary, the guide label should remain on the probability axis.");
          assertClose(Number(guideAtOne.getAttribute("x")),
            Number(cdfBackground.getAttribute("x")) + 8, 1e-9,
            "The boundary guide label should stay just inside the probability axis.");

          bid.value = "80";
          input(bid);
          var zeroRectangle = appDocument.querySelector(".expected-payoff-rectangle");
          assert(zeroRectangle.dataset.state === "zero",
            "Bidding exactly value should collapse the expected-payoff rectangle.");
          assert(appDocument.querySelector(".zero-expected-payoff"),
            "A collapsed expected-payoff rectangle should retain a visible marker.");
          var zeroLabel = appDocument.querySelector(".expected-payoff-label");
          assert(zeroLabel &&
            zeroLabel.textContent.replace(/\s+/g, " ").trim() ===
              "Expected payoff = 0",
            "A zero-area rectangle should still display expected payoff zero.");
          assert(appDocument.querySelector(".payoff-if-win-bracket").dataset.state === "zero",
            "Coincident x_1 and v_1 should produce a zero payoff interval.");
          assert(!appDocument.querySelector(".axis-payment-label").textContent
            .includes("payment"),
            "The coincident x_1 and v_1 label should omit the payment parenthetical.");

          appDocument.getElementById("reset-button").click();
        }
      },
      {
        name: "Metric labels remain visible when highlighted areas cannot contain them",
        run: function () {
          withReset(function () {
            var value = appDocument.getElementById("value-slider");
            var bid = appDocument.getElementById("bid-slider");

            value.value = "80";
            input(value);

            bid.value = "0";
            input(bid);
            var probabilityAtZero = appDocument.querySelector(".area-label");
            var payoffAtZero = appDocument.querySelector(
              ".expected-payoff-label"
            );
            assert(probabilityAtZero &&
              probabilityAtZero.textContent.replace(/\s+/g, " ").trim() ===
                "Probability of winning = 0.0%",
            "Probability zero should remain explicitly displayed.");
            assert(probabilityAtZero.dataset.placement !== "inside-area",
              "A zero-area probability label should use an outside fallback.");
            assert(payoffAtZero &&
              payoffAtZero.textContent.replace(/\s+/g, " ").trim() ===
                "Expected payoff = 0",
            "Expected payoff zero should remain explicitly displayed.");
            assert(payoffAtZero.dataset.placement === "inside-area" &&
              payoffAtZero.dataset.horizontalFit === "true",
            "A wide zero-height payoff area should keep its centered label.");

            bid.value = "100";
            input(bid);
            var probabilityAtOne = appDocument.querySelector(".area-label");
            var negativePayoff = appDocument.querySelector(
              ".expected-payoff-label"
            );
            assert(probabilityAtOne &&
              probabilityAtOne.textContent.replace(/\s+/g, " ").trim() ===
                "Probability of winning = 100.0%",
            "Probability one should remain explicitly displayed.");
            assert(negativePayoff &&
              negativePayoff.textContent.replace(/\s+/g, " ").trim() ===
                "Expected payoff = -20" &&
              negativePayoff.classList.contains("negative-metric"),
            "A negative expected payoff should remain displayed in red.");
            assert(appDocument.querySelectorAll(".area-label").length === 1 &&
              appDocument.querySelectorAll(".expected-payoff-label").length === 1,
            "Edge cases should not duplicate either in-graph metric label.");
          });
        }
      },
      {
        name: "Outside probability labels remain attached to the selected bid marker",
        run: function () {
          withReset(function () {
            var bid = appDocument.getElementById("bid-slider");

            bid.value = "5";
            input(bid);
            var narrowLabel = appDocument.querySelector(".area-label");
            var narrowMarker = appDocument.querySelector(".chosen-marker");
            assert(narrowLabel.dataset.placement === "marker-right",
              "A width-constrained probability label should move right.");
            assertClose(Number(narrowLabel.getAttribute("x")),
              Number(narrowMarker.getAttribute("x1")) + 8, 1e-9,
            "The width-constrained label should begin just right of the bid marker.");
            assert(narrowLabel.getAttribute("text-anchor") === "start",
              "The adjacent probability label should extend rightward.");
            var densityPanel = appDocument.querySelector(".panel-background");
            assert(narrowLabel.dataset.verticalPlacement === "panel-floor",
              "A width-constrained probability label should stay on the PDF floor.");
            assertClose(
              Number(narrowLabel.getAttribute("y")) +
                (Number(narrowLabel.dataset.lineCount) - 1) * 13,
              Number(densityPanel.getAttribute("y")) +
                Number(densityPanel.getAttribute("height")) - 10,
              1e-9,
              "The last probability-label line should sit above the PDF baseline."
            );

            chooseBeta(2, 0.5);
            bid.value = "45";
            input(bid);
            var shortLabel = appDocument.querySelector(".area-label");
            var shortMarker = appDocument.querySelector(".chosen-marker");
            densityPanel = appDocument.querySelector(".panel-background");
            var highlightedWidth = Number(shortMarker.getAttribute("x1")) -
              Number(densityPanel.getAttribute("x"));
            assert(highlightedWidth > shortLabel.getBBox().width + 24,
              "The selected Beta case should have enough horizontal label room.");
            assert(shortLabel.dataset.placement === "marker-right",
              "A height-constrained probability label should move right.");
            assert(shortLabel.dataset.heightCheck === "sampled-width" &&
              Number(shortLabel.dataset.heightSamples) === 9,
            "Probability height should be checked across the full label width.");
            assertClose(Number(shortLabel.getAttribute("x")),
              Number(shortMarker.getAttribute("x1")) + 8, 1e-9,
            "The height-constrained label should begin just right of the bid marker.");
            assert(shortLabel.dataset.verticalPlacement === "panel-floor",
              "A height-constrained probability label should stay on the PDF floor.");
            assertClose(
              Number(shortLabel.getAttribute("y")) +
                (Number(shortLabel.dataset.lineCount) - 1) * 13,
              Number(densityPanel.getAttribute("y")) +
                Number(densityPanel.getAttribute("height")) - 10,
              1e-9,
              "The height-constrained label should not jump to the panel middle."
            );
          });
        }
      },
      {
        name: "Expected payoff moves right only when rectangle width is insufficient",
        run: function () {
          withReset(function () {
            var value = appDocument.getElementById("value-slider");
            var bid = appDocument.getElementById("bid-slider");

            bid.value = "0";
            input(bid);
            var shortRectangle = appDocument.querySelector(
              ".expected-payoff-rectangle"
            );
            var shortLabel = appDocument.querySelector(
              ".expected-payoff-label"
            );
            var rectangleCenter = Number(shortRectangle.getAttribute("x")) +
              Number(shortRectangle.getAttribute("width")) / 2;
            assert(Number(shortRectangle.getAttribute("height")) < 1,
              "The zero-probability benchmark should have negligible height.");
            assert(shortLabel.dataset.horizontalFit === "true" &&
              shortLabel.dataset.placement === "inside-area",
            "A wide but short payoff rectangle should retain its label placement.");
            assertClose(Number(shortLabel.getAttribute("x")), rectangleCenter, 1e-9,
              "A short-height label should remain centered on its rectangle.");
            assertClose(Number(shortLabel.getAttribute("y")),
              Number(shortRectangle.getAttribute("y")) +
                Number(shortRectangle.getAttribute("height")) / 2 + 4,
              1e-9,
            "A short-height label should retain the rectangle-center y position.");

            value.value = "50";
            input(value);
            bid.value = "49";
            input(bid);
            var narrowLabel = appDocument.querySelector(
              ".expected-payoff-label"
            );
            var selectedMarker = appDocument.querySelectorAll(".chosen-marker");
            selectedMarker = selectedMarker[selectedMarker.length - 1];
            assert(narrowLabel.dataset.horizontalFit === "false" &&
              narrowLabel.dataset.placement === "marker-right",
            "A narrow payoff rectangle should move its label to the right.");
            assertClose(Number(narrowLabel.getAttribute("x")),
              Number(selectedMarker.getAttribute("x1")) + 8, 1e-9,
            "The narrow-rectangle label should stay beside the bid marker.");
            assert(narrowLabel.getAttribute("text-anchor") === "start",
              "The adjacent payoff label should extend rightward.");

            value.value = "100";
            input(value);
            bid.value = "99";
            input(bid);
            var boundaryLabel = appDocument.querySelector(
              ".expected-payoff-label"
            );
            selectedMarker = appDocument.querySelectorAll(".chosen-marker");
            selectedMarker = selectedMarker[selectedMarker.length - 1];
            assert(boundaryLabel.dataset.horizontalFit === "false" &&
              boundaryLabel.dataset.placement === "marker-left" &&
              boundaryLabel.getAttribute("text-anchor") === "end",
            "A narrow payoff label at the right boundary should flip left.");
            assertClose(Number(boundaryLabel.getAttribute("x")),
              Number(selectedMarker.getAttribute("x1")) - 8, 1e-9,
            "The flipped payoff label should remain beside the bid marker.");
          });
        }
      },
      {
        name: "Beta(1,1) reproduces the Uniform first-price graph metrics",
        run: function () {
          withReset(function () {
            var uniformOutcome = model.outcomes(
              50, 30, 2, 0, 100, { type: "uniform" }
            );
            var uniformEquilibrium = model.equilibriumOutcomes(
              50, 2, 0, 100, { type: "uniform" }
            );
            var betaRectangle = appDocument.querySelector(
              ".expected-payoff-rectangle"
            );
            var betaEquilibriumLabel = appDocument.querySelector(
              ".maximum-label:not(.density-equilibrium-label)"
            );
            assertClose(Number(betaRectangle.dataset.probability),
              uniformOutcome.winProbability, 1e-8,
            "Beta(1,1) winning probability should equal Uniform.");
            assertClose(Number(betaRectangle.dataset.signedPayoff),
              uniformOutcome.expectedPayoff, 1e-7,
            "Beta(1,1) expected payoff should equal Uniform.");
            assertClose(Number(betaEquilibriumLabel.dataset.equilibriumBid),
              uniformEquilibrium.bid, 1e-5,
            "Beta(1,1) equilibrium bid should equal Uniform.");
          });
        }
      },
      {
        name: "The first-price graph matches a Beta(2,1) benchmark",
        run: function () {
          withReset(function () {
            chooseBeta(2, 1);
            var value = appDocument.getElementById("value-number");
            value.value = "80";
            change(value);
            var spec = { type: "beta", alpha: 2, beta: 1 };
            var expected = model.outcomes(80, 30, 2, 0, 100, spec);
            var rectangle = appDocument.querySelector(
              ".expected-payoff-rectangle"
            );
            var winningArea = appDocument.querySelector(".winning-area");

            assertClose(expected.winProbability, 0.2025, 2e-6,
              "Analytical Beta(2,1) winning probability");
            assertClose(expected.expectedPayoff, 10.125, 2e-4,
              "Analytical Beta(2,1) expected payoff");
            assertClose(Number(rectangle.dataset.probability),
              expected.winProbability, 2e-6,
            "Displayed Beta winning probability");
            assertClose(Number(rectangle.dataset.signedPayoff),
              expected.expectedPayoff, 2e-4,
            "Displayed Beta expected payoff");
            assertClose(Number(winningArea.dataset.probability),
              expected.winProbability, 2e-6,
            "Displayed Beta PDF area");
          });
        }
      },
      {
        name: "A Beta random draw uses the selected distribution quantile",
        run: function () {
          withReset(function () {
            var lower = appDocument.getElementById("lower-bound");
            var upper = appDocument.getElementById("upper-bound");
            lower.value = "10";
            change(lower);
            upper.value = "20";
            change(upper);
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
              expected, 2e-7,
            "The random value should be the selected Beta quantile.");
            assertClose(Number(appDocument.getElementById("bid-slider").value),
              bidBefore, 1e-9,
            "Drawing a Beta value should preserve the proposed bid.");
          });
        }
      },
      {
        name: "Endpoint-singular Beta shapes keep every SVG coordinate finite",
        run: function () {
          withReset(function () {
            chooseBeta(0.5, 0.5);
            assert(!/(NaN|Infinity|undefined)/.test(numericSvgAttributes(
              appDocument.getElementById("tradeoff-chart")
            )), "Beta(0.5,0.5) should not put non-finite values in the SVG.");
            var preview = appDocument.getElementById("value-pdf-preview");
            assert(preview.querySelector(".value-pdf-curve"),
              "The endpoint-singular Beta should retain its value-PDF curve.");
            assert(!/(NaN|Infinity|undefined)/.test(numericSvgAttributes(preview)),
              "The endpoint-singular value-PDF preview should stay finite.");
          });
        }
      },
      {
        name: "A random draw uses the current support and preserves the bid",
        run: function () {
          var originalRandom = appWindow.Math.random;
          var bid = appDocument.getElementById("bid-slider");
          var originalBid = Number.parseFloat(bid.value);
          appWindow.Math.random = function () { return 0.25; };
          appDocument.getElementById("random-value-button").click();
          appWindow.Math.random = originalRandom;
          assertClose(Number.parseFloat(appDocument.getElementById("value-slider").value), 25, 1e-9,
            "The draw on [0,100] should equal 25.");
          assertClose(Number.parseFloat(appDocument.getElementById("value-number").value), 25, 1e-9,
            "The random draw should update the typed value field.");
          assertClose(Number.parseFloat(bid.value), originalBid, 1e-9,
            "Drawing a value should not change the proposed bid.");
        }
      },
      {
        name: "A random draw respects shifted bounds",
        run: function () {
          appDocument.getElementById("reset-button").click();
          var lower = appDocument.getElementById("lower-bound");
          var upper = appDocument.getElementById("upper-bound");
          lower.value = "10";
          change(lower);
          upper.value = "20";
          change(upper);
          var bidBefore = Number.parseFloat(appDocument.getElementById("bid-slider").value);
          var originalRandom = appWindow.Math.random;
          appWindow.Math.random = function () { return 0.25; };
          appDocument.getElementById("random-value-button").click();
          appWindow.Math.random = originalRandom;
          assertClose(Number.parseFloat(appDocument.getElementById("value-slider").value), 12.5, 1e-9,
            "The draw on [10,20] should equal 12.5.");
          assert(appDocument.getElementById("value-number").min === "10" &&
            appDocument.getElementById("value-number").max === "20" &&
            appDocument.getElementById("bid-number").min === "10" &&
            appDocument.getElementById("bid-number").max === "20",
            "Support changes should update the typed-control bounds.");
          assertClose(Number.parseFloat(appDocument.getElementById("value-number").value), 12.5, 1e-9,
            "A shifted-support draw should update the typed value field.");
          assertClose(Number.parseFloat(appDocument.getElementById("bid-slider").value), bidBefore, 1e-9,
            "The shifted-support draw should preserve the proposed bid.");
        }
      },
      {
        name: "Equal support endpoints revert without changing the auction state",
        run: function () {
          withReset(function () {
            var lower = appDocument.getElementById("lower-bound");
            var upper = appDocument.getElementById("upper-bound");
            var valueBefore = Number.parseFloat(
              appDocument.getElementById("value-slider").value
            );
            var bidBefore = Number.parseFloat(
              appDocument.getElementById("bid-slider").value
            );
            lower.value = "10";
            upper.value = "20";
            change(upper);
            valueBefore = Number.parseFloat(
              appDocument.getElementById("value-slider").value
            );
            bidBefore = Number.parseFloat(
              appDocument.getElementById("bid-slider").value
            );

            upper.value = "10";
            change(upper);
            assert(!appDocument.getElementById("input-error").hidden,
              "Equal endpoints should expose an input error.");
            assert(lower.value === "10" && upper.value === "20",
              "Equal endpoints should revert to the last valid support.");
            assertClose(Number.parseFloat(
              appDocument.getElementById("value-slider").value
            ), valueBefore, 1e-9,
            "Invalid endpoints should preserve the private value.");
            assertClose(Number.parseFloat(
              appDocument.getElementById("bid-slider").value
            ), bidBefore, 1e-9,
            "Invalid endpoints should preserve the proposed bid.");
          });
        }
      },
      {
        name: "The lower endpoint may be zero but a negative endpoint reverts",
        run: function () {
          withReset(function () {
            var lower = appDocument.getElementById("lower-bound");
            var upper = appDocument.getElementById("upper-bound");
            assert(lower.value === "0" && upper.value === "100",
              "The default support should include a = 0.");
            lower.value = "-1";
            change(lower);
            assert(lower.value === "0" && upper.value === "100",
              "A negative lower endpoint should revert to the last valid support.");
            assert(!appDocument.getElementById("input-error").hidden,
              "A negative lower endpoint should expose an input error.");
            assert(appDocument.getElementById("value-slider").min === "0" &&
              appDocument.getElementById("value-slider").max === "100" &&
              appDocument.getElementById("bid-slider").min === "0" &&
              appDocument.getElementById("bid-slider").max === "100",
            "Invalid bounds should not change either [a,b] control domain.");

            lower.value = "0";
            change(lower);
            assert(appDocument.getElementById("input-error").hidden,
              "The valid lower endpoint zero should clear the error.");
          });
        }
      },
      {
        name: "Active graph drags clamp exactly to either support endpoint",
        run: function () {
          withReset(function () {
            var chart = appDocument.getElementById("tradeoff-chart");
            var bid = appDocument.getElementById("bid-slider");
            var panel = appDocument.querySelector(".panel-background");
            var chartRect = chart.getBoundingClientRect();
            var viewBox = chart.viewBox.baseVal;
            var plotLeft = Number(panel.getAttribute("x"));
            var plotRight = plotLeft + Number(panel.getAttribute("width"));
            var clientX = function (svgX) {
              return chartRect.left + svgX / viewBox.width * chartRect.width;
            };
            var makePointer = function (type, x, buttons) {
              return new appWindow.PointerEvent(type, {
                bubbles: true,
                clientX: x,
                clientY: chartRect.top + 50,
                pointerId: 41,
                pointerType: "mouse",
                buttons: buttons
              });
            };
            var originalCapture = chart.setPointerCapture;

            chart.setPointerCapture = function () {};
            try {
              var initialBid = Number(bid.value);
              chart.dispatchEvent(makePointer(
                "pointerdown", clientX(plotLeft) - 25, 1
              ));
              chart.dispatchEvent(makePointer(
                "pointermove", clientX(plotRight) + 25, 1
              ));
              assertClose(Number(bid.value), initialBid, 1e-9,
                "Starting outside the plot should not change or activate the bid.");

              chart.dispatchEvent(makePointer(
                "pointerdown", clientX((plotLeft + plotRight) / 2), 1
              ));
              chart.dispatchEvent(makePointer(
                "pointermove", clientX(plotRight) + 25, 1
              ));
              assertClose(Number(bid.value), 100, 1e-9,
                "An active drag past the right edge should end exactly at b.");

              chart.dispatchEvent(makePointer(
                "pointermove", clientX(plotLeft) - 25, 1
              ));
              assertClose(Number(bid.value), 0, 1e-9,
                "An active drag past the left edge should end exactly at a.");
              chart.dispatchEvent(makePointer(
                "pointerup", clientX(plotLeft) - 25, 0
              ));
            } finally {
              chart.setPointerCapture = originalCapture;
            }
          });
        }
      },
      {
        name: "Rendered SVG contains only finite coordinates",
        run: function () {
          var attributes = Array.from(appDocument.querySelectorAll("#tradeoff-chart *"))
            .flatMap(function (node) { return Array.from(node.attributes); })
            .map(function (attribute) { return attribute.value; })
            .join(" ");
          assert(!/(NaN|Infinity)/.test(attributes), "The SVG contains a non-finite value.");
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
            change(alpha);
            beta.value = "4.6";
            change(beta);
            lower.value = "10";
            change(lower);
            upper.value = "90";
            change(upper);
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
    summary.textContent = passed + " of " + tests.length + " interface tests passed.";
    summary.className = failures ? "fail" : "pass";
    document.body.dataset.status = failures ? "failed" : "passed";
    document.title = (failures ? "FAIL" : "PASS") + " — FPA interface tests";
    window.clearInterval(testKeepAlive);
  }
}());
