(function () {
  "use strict";

  var frame = document.getElementById("app-frame");
  var testKeepAlive = window.setInterval(function () {}, 50);
  var testsStarted = false;

  function startTests() {
    if (testsStarted) {
      return;
    }
    testsStarted = true;
    Promise.resolve(frame.contentWindow.mechanismMathReady).then(runTests).catch(
      function (error) {
        addResult("MathJax initializes before the interface tests", error);
        finish(0, 1);
      }
    );
  }

  frame.addEventListener("load", startTests);
  if (frame.contentDocument && frame.contentDocument.readyState === "complete" &&
      frame.contentWindow.location.href !== "about:blank") {
    startTests();
  }

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

  function addResult(name, error) {
    var item = document.createElement("li");
    item.className = error ? "fail" : "pass";
    item.textContent = (error ? "FAIL — " : "PASS — ") + name +
      (error ? ": " + error.message : "");
    document.getElementById("results").appendChild(item);
  }

  function finish(passed, total) {
    var failures = total - passed;
    var summary = document.getElementById("summary");
    summary.textContent = passed + " of " + total +
      " envelope-theorem interface tests passed.";
    summary.className = failures ? "fail" : "pass";
    document.body.dataset.status = failures ? "failed" : "passed";
    document.title = (failures ? "FAIL" : "PASS") +
      " — Envelope-theorem interface tests";
    window.clearInterval(testKeepAlive);
  }

  function nextFrames(appWindow, count) {
    return new Promise(function (resolve) {
      function advance(remaining) {
        appWindow.requestAnimationFrame(function () {
          if (remaining <= 1) {
            resolve();
          } else {
            advance(remaining - 1);
          }
        });
      }
      advance(count || 1);
    });
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

  async function runTests() {
    var appDocument = frame.contentDocument;
    var appWindow = frame.contentWindow;

    function fireKey(chart, key, shiftKey) {
      chart.dispatchEvent(new appWindow.KeyboardEvent("keydown", {
        key: key,
        shiftKey: Boolean(shiftKey),
        bubbles: true,
        cancelable: true
      }));
    }

    function firePointer(chart, type, viewX, viewY, pointerId, options) {
      var rect = chart.getBoundingClientRect();
      chart.setPointerCapture = function () {};
      chart.hasPointerCapture = function () { return false; };
      chart.releasePointerCapture = function () {};
      chart.dispatchEvent(new appWindow.PointerEvent(type, Object.assign({
        bubbles: true,
        clientX: rect.left + (viewX / 660) * rect.width,
        clientY: rect.top + (viewY / 450) * rect.height,
        pointerId: pointerId,
        isPrimary: true
      }, options)));
    }

    var tests = [
      {
        name: "The simplified interface contains exactly the two requested plots and no coordinate controls",
        run: function () {
          var explorable = appDocument.querySelector(".explorable");
          var charts = Array.from(explorable.querySelectorAll(
            ":scope #main-chart, :scope #slope-chart"
          ));
          assert(charts.length === 2 && charts[0].id === "main-chart" &&
            charts[1].id === "slope-chart",
          "Only the envelope and active-slope plots should remain.");
          assert(!appDocument.getElementById("bound-chart"),
            "The former bound chart should be absent.");
          assert(explorable.querySelectorAll('input[type="range"], input[type="number"]').length === 0,
            "The explorable should not retain coordinate sliders or number fields.");
          assert(appDocument.getElementById("add-line") &&
            appDocument.getElementById("remove-line"),
          "The line-family add/remove actions should remain available.");
        }
      },
      {
        name: "Local MathJax renders every plot title and axis label outside the graph SVGs",
        run: function () {
          window.MechanismTest.assertScriptOrder(appDocument, [
            "../../js/components.js",
            "../../js/mathjax-config.js",
            "../../assets/mathjax/tex-svg.js",
            "../../js/mathjax-runtime.js",
            "../../js/math-utils.js",
            "../../js/svg-utils.js",
            "../../js/equation-chain.js",
            "model.js",
            "app.js"
          ]);
          assert(appWindow.MechanismMath &&
            typeof appWindow.MechanismMath.typesetInitial === "function" &&
            typeof appWindow.MechanismMath.setText === "function" &&
            appWindow.mechanismMathReady &&
            typeof appWindow.mechanismMathReady.then === "function",
          "The shared MathJax lifecycle and readiness promise should be available.");
          assert(appDocument.querySelectorAll('.introduction mjx-container[jax="SVG"]').length > 0,
            "The introduction should contain rendered mathematics.");
          assert(!/\\\(|\\\[/.test(appDocument.querySelector(".introduction").textContent),
            "No raw opening TeX delimiters should remain visible.");
          assert(appDocument.querySelectorAll("mjx-merror").length === 0,
            "MathJax should not report an expression error.");
          var labels = Array.from(appDocument.querySelectorAll(
            ".envelope-chart-figure > figcaption, .envelope-chart-axis-label"
          ));
          assert(labels.length === 4,
            "Both plots should have one HTML title and one HTML x-axis label.");
          labels.forEach(function (label) {
            assert(label.firstChild && label.firstChild.nodeType === 3 &&
              /, $/.test(label.firstChild.nodeValue),
            "Each label's plain text should end with a comma and a space.");
            assert(label.querySelector('mjx-container[jax="SVG"]'),
              "Each plot label should contain MathJax-rendered notation.");
            assert(!/\\\(/.test(label.textContent),
              "No plot label should retain a raw TeX delimiter.");
          });
          assert(appDocument.querySelectorAll(".explorable svg mjx-container").length === 0,
            "MathJax output should remain outside the graph SVGs.");
          assert(appDocument.querySelectorAll(
            'svg[role="img"] .panel-caption, svg[role="img"] .axis-title'
          ).length === 0,
          "The old plain-text SVG captions and axis titles should be absent.");
          assert(appDocument.getElementById("main-chart-title").textContent ===
            "Envelope, V(t)" &&
            appDocument.getElementById("slope-chart-title").textContent ===
              "Active slope, f_t(x*(t),t)",
          "The plain-text accessible SVG titles should mirror the comma-space convention.");
        }
      },
      {
        name: "Myerson's Lemma links scroll forward once and keep the rendered theorem visible",
        run: async function () {
          var arrival = document.createElement("iframe");
          arrival.title = "Myerson's Lemma link destination";
          arrival.style.height = "900px";
          document.body.appendChild(arrival);
          try {
            for (var width of [375, 1280]) {
              arrival.style.width = width + "px";
              var positions = [];
              await new Promise(function (resolve) {
                arrival.onload = function () {
                  var win = arrival.contentWindow;
                  positions.push(win.scrollY);
                  win.addEventListener("scroll", function () {
                    positions.push(win.scrollY);
                  });
                  resolve();
                };
                arrival.src = "../general-topics/envelope-theorem/index.html?arrival=" + width + "#myerson-lemma";
              });
              await arrival.contentWindow.mechanismMathReady;
              positions.push(arrival.contentWindow.scrollY);
              await window.MechanismTest.waitFor(function () {
                var target = arrival.contentDocument.getElementById("myerson-lemma");
                return target && Math.abs(target.getBoundingClientRect().top) <= 2;
              }, 3000, "The lemma link must reach its rendered destination.");
              await nextFrames(arrival.contentWindow, 3);
              positions.push(arrival.contentWindow.scrollY);
              assert(positions.every(function (position, index) {
                return index === 0 || position >= positions[index - 1] - 2;
              }), "The arrival scroll must not reverse during math rendering at " + width + "px.");
              var doc = arrival.contentDocument;
              var lemma = doc.getElementById("myerson-lemma");
              var heading = doc.getElementById("derivation-title").getBoundingClientRect();
              var statement = lemma.querySelector("strong").getBoundingClientRect();
              assert(Math.abs(lemma.getBoundingClientRect().top) <= 2 && heading.top >= 0 &&
                statement.top >= 0 && statement.bottom <= arrival.contentWindow.innerHeight,
              "The heading and theorem statement must remain visible after navigation at " + width + "px.");
            }
          } finally {
            arrival.remove();
          }
        }
      },
      {
        name: "Myerson's Lemma contains the BIC proof and its disclosure stays usable at narrow widths",
        run: async function () {
          var lemma = appDocument.getElementById("myerson-lemma");
          var proof = appDocument.getElementById("myerson-bic-proof");
          assert(lemma && lemma.contains(proof) && proof.querySelector("p em").textContent === "Proof (BIC version):",
            "The moved proof must follow the lemma and identify its BIC scope.");
          var tex = Array.from(proof.querySelectorAll('[data-mml-node="math"]')).map(function (node) {
            return node.getAttribute("data-latex") || "";
          }).join(" ");
          assert(tex.includes("Q_i") && tex.includes("P_i") && tex.includes("U_i") &&
            tex.includes("\\underline{v}_i") && !/Q_B|P_B|U_B|Q_S|P_S|U_S/.test(tex),
          "The proof must use the auction's indexed interim quantities and general lower support.");
          assert(tex.includes("p_i(v_i,v_{-i})=P_i(v_i)") && tex.includes("Q_i(t)-Q_i(v_i')"),
            "Sufficiency must construct payments and compare truthful utility against every report.");
          var chain = appDocument.getElementById("myerson-bic-monotonicity-proof");
          var toggle = chain.querySelector(".equation-chain-divider-toggle");
          var extras = Array.from(chain.querySelectorAll(".equation-step-extra"));
          assert(!toggle.hidden && extras.length > 0 && extras.every(function (node) { return node.hidden; }),
            "The moved intermediate algebra should initially be collapsed.");
          toggle.click();
          assert(toggle.getAttribute("aria-expanded") === "true" && extras.every(function (node) { return !node.hidden; }),
            "The moved disclosure must reveal its intermediate steps.");
          var priorWidth = frame.style.width;
          try {
            for (var width of [320, 375, 640, 768, 1280]) {
              frame.style.width = width + "px";
              await nextFrames(appWindow, 2);
              assert(appDocument.documentElement.scrollWidth <= appDocument.documentElement.clientWidth + 1,
                "The moved proof must not widen the page at " + width + "px.");
              chain.scrollLeft = chain.scrollWidth;
              await nextFrames(appWindow, 1);
              var button = toggle.getBoundingClientRect(), bounds = chain.getBoundingClientRect();
              assert(button.right > bounds.left && button.left < bounds.right,
                "The disclosure must remain reachable while the equation chain scrolls.");
              chain.scrollLeft = 0;
            }
          } finally {
            frame.style.width = priorWidth;
            toggle.click();
            await nextFrames(appWindow, 2);
          }
        }
      },
      {
        name: "Authored Insights remains in its template and renders when selected",
        run: async function () {
          var host = appDocument.querySelector("learning-sidebar");
          var template = host.querySelector("template[data-insights]");
          assert(template && template.content.querySelectorAll("p").length > 0 &&
            !host.querySelector(".learning-sidebar-insights mjx-container"),
          "Authored Insights should remain inert until its tab is selected.");
          host.querySelector(".learning-sidebar-toggle").click();
          host.querySelectorAll('[role="tab"]')[2].click();
          var panel = host.querySelector(".learning-sidebar-insights");
          await window.MechanismTest.waitFor(function () {
            return !panel.hasAttribute("aria-busy") && panel.querySelector("mjx-container");
          }, 15000);
          assert(panel.querySelectorAll("p").length === template.content.querySelectorAll("p").length &&
            !panel.querySelector("mjx-merror, merror") && !/\\\(|\\\[/.test(panel.textContent),
            "The complete authored Insights should display rendered mathematics.");
          host.querySelector(".learning-sidebar-close").click();
        }
      },
      {
        name: "The two desktop plots have equal 660-by-450 geometry and fill the demo width",
        run: function () {
          var layout = appDocument.querySelector(".two-panel-layout");
          var main = appDocument.getElementById("main-chart");
          var slope = appDocument.getElementById("slope-chart");
          var mainRect = main.getBoundingClientRect();
          var slopeRect = slope.getBoundingClientRect();
          var layoutRect = layout.getBoundingClientRect();
          assert(main.getAttribute("viewBox") === "0 0 660 450" &&
            slope.getAttribute("viewBox") === "0 0 660 450",
          "Both SVGs should use the same intrinsic geometry.");
          assertClose(mainRect.width, slopeRect.width,
            "Both desktop plots should render at the same width.", 1);
          assertClose(mainRect.height, slopeRect.height,
            "Both desktop plots should render at the same height.", 1);
          assertClose(mainRect.top, slopeRect.top,
            "Both desktop plots should align at the top.", 1);
          assert(mainRect.width >= 650,
            "At the 1400px test viewport each plot should reach approximately 660px.");
          assert(slopeRect.right - mainRect.left >= layoutRect.width * 0.99,
            "The two plots together should use essentially the full demo width.");
        }
      },
      {
        name: "Endpoint dragging ignores other pointers and stops when capture is lost",
        run: async function () {
          var main = appDocument.getElementById("main-chart");
          function endpointY() {
            return Number(main.querySelector(
              '.family-line[stroke="var(--envelope-line-a)"]'
            ).getAttribute("y2"));
          }
          var initial = endpointY();
          for (var options of [{ button: 2 }, { isPrimary: false }]) {
            firePointer(main, "pointerdown", 630, initial, 45, options);
            firePointer(main, "pointermove", 630, 138.8, 45);
            firePointer(main, "pointerup", 630, 138.8, 45);
            await nextFrames(appWindow, 2);
            assertClose(endpointY(), initial,
              "Secondary buttons and non-primary contacts must leave endpoints unchanged.");
          }
          firePointer(main, "pointerdown", 630, initial, 46);
          firePointer(main, "pointerdown", 630, initial, 47);
          firePointer(main, "pointermove", 630, 174.4, 47);
          firePointer(main, "pointerup", 630, 174.4, 47);
          await nextFrames(appWindow, 2);
          assertClose(endpointY(), initial,
            "A different pointer must neither replace nor move the active drag.");
          firePointer(main, "pointermove", 630, 138.8, 46);
          await nextFrames(appWindow, 2);
          assertClose(endpointY(), 138.8,
            "The original pointer must continue after another pointer releases.");
          firePointer(main, "lostpointercapture", 630, 138.8, 46);
          firePointer(main, "pointermove", 630, 174.4, 46);
          await nextFrames(appWindow, 2);
          assertClose(endpointY(), 138.8,
            "Capture loss must stop endpoint movement before the next pointer event.");
          firePointer(main, "pointerdown", 630, 138.8, 48);
          firePointer(main, "pointermove", 630, initial, 48);
          firePointer(main, "pointerup", 630, initial, 48);
          await nextFrames(appWindow, 2);
        }
      },
      {
        name: "Dragging an endpoint directly updates both the line family and active-slope plot",
        run: async function () {
          var main = appDocument.getElementById("main-chart");
          var slope = appDocument.getElementById("slope-chart");
          await nextFrames(appWindow, 4);
          var originalTop = main.getBoundingClientRect().top;
          var originalSlopeTop = slope.getBoundingClientRect().top;
          var oldSlope = slope.innerHTML;
          firePointer(main, "pointerdown", 60, 316.8, 41);
          firePointer(main, "pointermove", 231, 49.8, 41);
          firePointer(main, "pointerup", 231, 49.8, 41);
          await nextFrames(appWindow, 4);

          assertClose(main.getBoundingClientRect().top, originalTop,
            "Reaching the top edge must not shift the plot under the pointer.", 0.1);
          assertClose(slope.getBoundingClientRect().top, originalSlopeTop,
            "The linked plot must remain aligned during dragging.", 0.1);

          var selected = main.querySelector(".line-endpoint-selected");
          var lineA = main.querySelector(
            '.family-line[stroke="var(--envelope-line-a)"]'
          );
          assertClose(Number(selected.getAttribute("cx")), 231,
            "The selected endpoint should move to t = 0.30.");
          assertClose(Number(selected.getAttribute("cy")), 32,
            "The endpoint should project exactly onto the top edge.");
          assertClose(Number(lineA.getAttribute("x1")), 231,
            "Line A should begin at the dragged endpoint.");
          assertClose(Number(lineA.getAttribute("y1")), 32,
            "Line A should use the projected endpoint value.");
          assert(main.querySelector("desc").textContent.includes("t = 0.30, value 1.00"),
            "The accessible description should report the moved point.");
          assert(slope.innerHTML !== oldSlope,
            "The linked active-slope plot should update after the drag.");
        }
      },
      {
        name: "The focused graph keeps direct keyboard selection and movement after control removal",
        run: function () {
          var main = appDocument.getElementById("main-chart");
          fireKey(main, "Home");
          fireKey(main, "ArrowRight", true);
          var selected = main.querySelector(".line-endpoint-selected");
          assertClose(Number(selected.getAttribute("cx")), 242.4,
            "Shift+ArrowRight should move the top-edge point from t = 0.30 to 0.32.");

          fireKey(main, "ArrowRight");
          assert(appDocument.getElementById("point-control-label").textContent ===
            "Line A, point 2",
          "ArrowRight should still select the next endpoint.");
          fireKey(main, "ArrowDown");
          selected = main.querySelector(".line-endpoint-selected");
          assertClose(Number(selected.getAttribute("cx")), 630,
            "The second endpoint should remain on the right edge.");
          assertClose(Number(selected.getAttribute("cy")), 110.32,
            "ArrowDown should move its value from 0.80 to 0.78.", 1e-5);
          assert(main.getAttribute("aria-keyshortcuts").includes("Shift+ArrowRight"),
            "The horizontal movement shortcut should be exposed accessibly.");
        }
      },
      {
        name: "Adding and removing a line still updates the two linked plots",
        run: function () {
          var main = appDocument.getElementById("main-chart");
          appDocument.getElementById("add-line").click();
          assert(main.querySelectorAll(".family-line").length === 4 &&
            main.querySelectorAll(".line-endpoint").length === 8,
          "Adding should produce four lines and eight endpoints.");
          assert(appDocument.getElementById("point-control-label").textContent ===
            "Line D, point 1",
          "The new line's first endpoint should become selected.");
          appDocument.getElementById("remove-line").click();
          assert(main.querySelectorAll(".family-line").length === 3 &&
            main.querySelectorAll(".line-endpoint").length === 6,
          "Removing the selected new line should restore the three-line family.");
        }
      },
      {
        name: "Both SVGs retain finite geometry and accessible descriptions",
        run: function () {
          ["main-chart", "slope-chart"].forEach(function (id) {
            var chart = appDocument.getElementById(id);
            assert(!/(NaN|Infinity|undefined)/.test(numericSvgAttributes(chart)),
              "Chart " + id + " should contain only finite coordinates.");
            assert(chart.querySelector("title") && chart.querySelector("desc"),
              "Chart " + id + " should expose a title and description.");
          });
          assert(appDocument.getElementById("live-summary").getAttribute("aria-live") === "polite",
            "The linked state summary should remain politely announced.");
        }
      },
      {
        name: "The equal plots stack responsively without horizontal overflow",
        run: async function () {
          frame.style.width = "800px";
          await nextFrames(appWindow, 2);
          var mainRect = appDocument.getElementById("main-chart").getBoundingClientRect();
          var slopeRect = appDocument.getElementById("slope-chart").getBoundingClientRect();
          assertClose(mainRect.width, slopeRect.width,
            "Stacked plots should remain equally wide.", 1);
          assertClose(mainRect.height, slopeRect.height,
            "Stacked plots should remain equally tall.", 1);
          assert(slopeRect.top > mainRect.bottom,
            "At 800px the active-slope plot should stack below the main plot.");

          frame.style.width = "360px";
          await nextFrames(appWindow, 2);
          mainRect = appDocument.getElementById("main-chart").getBoundingClientRect();
          slopeRect = appDocument.getElementById("slope-chart").getBoundingClientRect();
          assertClose(mainRect.width, slopeRect.width,
            "Narrow plots should remain equally wide.", 1);
          assert(appDocument.documentElement.scrollWidth <=
            appDocument.documentElement.clientWidth + 1,
          "The page should not overflow horizontally at 360px.");
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
    finish(tests.length - failures, tests.length);
  }
}());
