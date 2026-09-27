(function () {
  "use strict";
  var T = MechanismTest, assert = T.assert;
  var frame = document.getElementById("app-frame");
  var doc, win, app;
  var serial = 0;
  function el(id) { return doc.getElementById(id); }
  function token(id, i) { return el(id).querySelectorAll("button")[i]; }
  function swap(id, first, second) { token(id, first).click(); token(id, second).click(); }
  function setRanking(id, value) {
    value.split("").forEach(function (candidate, index) {
      var position = Array.from(el(id).querySelectorAll("button")).findIndex(function (b) { return b.textContent === candidate; });
      if (position !== index) { swap(id, index, position); }
    });
  }
  function snapshot() { return app.snapshot(); }
  function vote(value) { doc.querySelector('[data-first="' + value + '"]').click(); }
  function direct() { el("direct-mode").click(); }
  async function fresh() {
    frame.style.width = "1280px";
    frame.src = "../general-topics/revelation-principle/index.html?test=" + (++serial);
    await new Promise(function (resolve) { frame.onload = resolve; });
    win = frame.contentWindow;
    doc = frame.contentDocument;
    await T.waitFor(function () { return doc.body.dataset.ready === "true"; }, 6000, "Demo initialization");
    app = win.RevelationPrincipleApp;
  }
  function point(button) {
    var box = button.getBoundingClientRect();
    return { clientX: box.left + box.width / 2, clientY: box.top + box.height / 2 };
  }
  function pointer(button, type, position) {
    T.dispatch(button, type, win, Object.assign({ pointerId: 7, isPrimary: true, button: 0, buttons: type === "pointerup" ? 0 : 1 }, position));
  }
  function drag(id, from, to, cancel) {
    var source = token(id, from);
    pointer(source, "pointerdown", point(source));
    pointer(source, "pointermove", to);
    if (cancel === "escape") { T.dispatch(source, "keydown", win, { key: "Escape" }); }
    pointer(source, cancel === "pointer" ? "pointercancel" : "pointerup", to);
  }
  function test(name, run) { return { name: name, run: async function () { await fresh(); await run(); } }; }

  T.run([
    test("Initial state has four stages, a read-only true ranking, and hidden simultaneous ballots", function () {
      assert(snapshot().trueRanking === "ABC" && snapshot().publicRankings.join("/") === "BCA/CAB", "Default rankings");
      assert(!snapshot().direct && !el("report-stage").hidden, "Indirect default keeps the left stage");
      assert(Array.from(el("ranking-report").querySelectorAll("button")).every(function (b) { return b.disabled; }), "True ranking display is read-only");
      assert(el("ranking-report").textContent === el("ranking-1").textContent && !el("use-truth"), "Left stage shows true preferences without the removed reset button");
      assert(el("vote-c").disabled && el("vote-survivor").disabled, "Final round disabled");
      assert(Array.from(doc.querySelectorAll(".ballot-list dd")).every(function (node) { return node.textContent === "—"; }), "No early ballot reveal");
      T.assertScriptOrder(doc, ["../../js/components.js", "../../js/math-utils.js", "model.js", "ranking-control.js", "app.js"]);
    }),
    test("Indirect round choices reveal ballots together, complete a result, and invalidate later history", function () {
      swap("ranking-2", 1, 2);
      vote("A");
      assert(el("first-winner").textContent === "A", "A advances");
      assert(Array.from(el("first-ballots").querySelectorAll("dd")).map(function (x) { return x.textContent; }).join("") === "ABA", "Joint ballot reveal");
      assert(el("final-ballots").textContent.indexOf("—") >= 0 && el("outcome-candidate").textContent === "—", "Final still unrevealed");
      el("vote-survivor").click();
      assert(el("outcome-candidate").textContent === "A" && el("own-payoff").textContent === "2", "Sincere final vote elects A");
      assert(el("benchmark-candidate").textContent === "A" && el("benchmark-payoff").textContent === "2" && win.getComputedStyle(el("benchmark")).visibility === "visible", "Indirect equilibrium benchmark retained");
      vote("A");
      assert(snapshot().final === "A", "Same first ballot preserves completed history");
      vote("B");
      assert(snapshot().final === null && win.getComputedStyle(el("benchmark")).visibility === "hidden" && el("outcome-candidate").textContent === "—", "New root invalidates continuation");
      el("vote-survivor").click();
      assert(el("first-winner").textContent === "B" && el("outcome-candidate").textContent === "B" && el("own-payoff").textContent === "1", "Revised first ballot changes the final contest and payoff");
      el("vote-c").click();
      assert(el("outcome-candidate").textContent === "C", "Final ballot can be revised");
    }),
    test("Direct reports simulate complete plans and use the true ranking for utility", function () {
      swap("ranking-2", 1, 2);
      var id = snapshot().selectedId;
      direct();
      assert(snapshot().report === "ABC" && el("outcome-candidate").textContent === "A", "Truth initialized");
      assert(el("report-title").textContent === "Voter 1's true preferences" && !/\b(you|your)\b/i.test(el("voting-demo").textContent), "Requested heading and Voter 1 terminology");
      assert(!el("first-actions").hidden && !el("final-actions").hidden, "Direct ballots stay visible");
      assert(Array.from(doc.querySelectorAll(".vote")).every(function (b) { return b.disabled; }), "Direct ballots are read-only");
      function selectedBallot(actions) { return el(actions).querySelector('[aria-pressed="true"]').textContent; }
      assert(selectedBallot("first-actions") === el("first-ballots").querySelector("dd").textContent, "Selected simulated first vote");
      assert(selectedBallot("final-actions") === el("final-ballots").querySelector("dd").textContent, "Selected simulated final vote");
      var before = JSON.stringify(snapshot());
      vote("A"); el("vote-c").click();
      T.dispatch(doc.querySelector('[data-first="A"]'), "click", win);
      T.dispatch(el("vote-c"), "click", win);
      assert(JSON.stringify(snapshot()) === before, "Read-only votes cannot mutate direct play");
      swap("ranking-report", 0, 2);
      assert(snapshot().report === "CBA" && snapshot().trueRanking === "ABC", "Report separate from truth");
      assert(el("outcome-candidate").textContent === "C" && el("own-payoff").textContent === "0", "True payoff, not reported payoff");
      assert(selectedBallot("first-actions") === el("first-ballots").querySelector("dd").textContent && selectedBallot("final-actions") === el("final-ballots").querySelector("dd").textContent, "Selected votes follow report edits");
      assert(snapshot().selectedId === id, "Report leaves selected equilibrium frozen");
      assert(win.getComputedStyle(el("benchmark")).visibility === "hidden" && el("game-status").textContent.indexOf("Benchmark:") === -1, "No second direct-mode payoff, visually or in the announcement");
      el("new-election").click();
      assert(snapshot().report === "ABC" && el("outcome-candidate").textContent === "A", "New election restores truthful report");
      direct();
      assert(snapshot().first === null && snapshot().final === null && el("first-winner").textContent === "—", "Switch back begins fresh election");
      assert(!doc.querySelector('.vote[aria-pressed="true"]') && !doc.querySelector("[data-first]").disabled, "Manual ballots reenable without stale selections");
    }),
    test("Indirect true-preference display follows private edits and rejects click, keyboard, and drag input", function () {
      swap("ranking-1", 0, 2);
      assert(el("ranking-report").textContent === el("ranking-1").textContent && snapshot().report === "CBA", "True preferences synchronized");
      var before = JSON.stringify(snapshot());
      swap("ranking-report", 0, 1);
      T.dispatch(token("ranking-report", 0), "click", win);
      T.dispatch(token("ranking-report", 1), "click", win);
      T.dispatch(token("ranking-report", 0), "keydown", win, { key: "ArrowRight" });
      drag("ranking-report", 0, point(token("ranking-report", 2)));
      assert(JSON.stringify(snapshot()) === before && !doc.querySelector(".ranking-ghost"), "Read-only ranking rejects every input path");
      assert(!el("ranking-report").querySelector('[aria-pressed="true"]') && doc.activeElement !== token("ranking-report", 1), "No selection or keyboard focus on disabled squares");
      direct();
      assert(!token("ranking-report", 0).disabled, "Direct report becomes editable");
      assert(token("ranking-report", 0).getAttribute("aria-label").indexOf("reported ranking") >= 0, "Report has the correct accessible label");
      swap("ranking-report", 0, 1);
      assert(snapshot().report === "BCA" && snapshot().trueRanking === "CBA", "Report edits remain separate from truth");
      direct();
      assert(el("ranking-report").textContent === el("ranking-1").textContent && token("ranking-report", 0).disabled, "Indirect restores true display");
      assert(token("ranking-report", 0).getAttribute("aria-label").indexOf("true ranking") >= 0, "True display has the correct accessible label");
    }),
    test("Mode changes cancel report selection and active dragging before the display becomes read-only", function () {
      direct();
      token("ranking-report", 0).click();
      direct();
      assert(!el("ranking-report").querySelector('[aria-pressed="true"]'), "Mode change clears pending selection");
      direct();
      var source = token("ranking-report", 0);
      pointer(source, "pointerdown", point(source));
      pointer(source, "pointermove", point(token("ranking-report", 2)));
      assert(doc.querySelector(".ranking-ghost"), "Report drag starts");
      direct();
      pointer(source, "pointerup", point(token("ranking-report", 2)));
      assert(!doc.querySelector(".ranking-ghost") && snapshot().report === snapshot().trueRanking, "Mode change cancels drag without a late swap");
      direct();
      swap("ranking-report", 0, 1);
      assert(snapshot().report === "BAC", "Editing works after the canceled drag");
    }),
    test("True ranking edits preserve equilibrium; public edits rebuild and reset the game", function () {
      var id = snapshot().selectedId;
      vote("B"); el("vote-c").click();
      swap("ranking-1", 0, 2);
      assert(snapshot().trueRanking === "CBA" && snapshot().first === null && snapshot().selectedId === id, "Private change resets without reselection");
      direct(); swap("ranking-report", 0, 1);
      swap("ranking-3", 0, 1);
      assert(snapshot().publicRankings[1] === "ACB" && snapshot().selectedId !== id, "Public selection changes");
      assert(snapshot().report === "CBA" && el("outcome-candidate").textContent === "C", "Direct resets to truthful report");
      swap("ranking-report", 0, 2); el("new-election").click();
      assert(snapshot().report === snapshot().trueRanking, "New election resets report");
    }),
    test("Select-two swaps preserve the third candidate, arrows move focus, Escape cancels", function () {
      token("ranking-1", 0).focus(); token("ranking-1", 0).click();
      T.dispatch(token("ranking-1", 0), "keydown", win, { key: "ArrowRight" });
      assert(doc.activeElement === token("ranking-1", 1), "Arrow focus");
      doc.activeElement.click();
      assert(snapshot().trueRanking === "BAC", "Exact transposition");
      token("ranking-1", 0).click();
      T.dispatch(token("ranking-1", 0), "keydown", win, { key: "Escape" });
      assert(token("ranking-1", 0).getAttribute("aria-pressed") === "false", "Escape clears selection");
      token("ranking-1", 2).click(); token("ranking-1", 2).click();
      assert(snapshot().trueRanking === "BAC", "Same-square cancellation");
      assert(Array.from(doc.querySelectorAll(".ranking-token")).every(function (b) { return b.getAttribute("aria-label"); }), "Labeled buttons");
    }),
    test("Pointer drag commits only on drop and rejects cross-editor, outside, and canceled drops", async function () {
      var source = token("ranking-1", 0);
      pointer(source, "pointerdown", point(source));
      pointer(source, "pointermove", point(token("ranking-1", 2)));
      assert(snapshot().trueRanking === "ABC", "Drag preview cannot mutate ranking");
      pointer(source, "pointerup", point(token("ranking-1", 2)));
      assert(snapshot().trueRanking === "CBA", "Drop swaps endpoints");
      await new Promise(function (resolve) { win.setTimeout(resolve, 10); });
      drag("ranking-1", 0, point(token("ranking-2", 1)));
      assert(snapshot().trueRanking === "CBA" && snapshot().publicRankings[0] === "BCA", "Cross-editor rejected");
      drag("ranking-1", 0, { clientX: 1, clientY: 1 });
      drag("ranking-1", 0, point(token("ranking-1", 1)), "escape");
      drag("ranking-1", 0, point(token("ranking-1", 1)), "pointer");
      assert(snapshot().trueRanking === "CBA" && !doc.querySelector(".ranking-ghost"), "Cancellation leaves no mutations or ghosts");
    }),
    test("All public controls can reach every ranking without breaking the selected profile", function () {
      // A connected sequence of transpositions visits all six rankings.
      var seen = new Set();
      [[0, 1], [1, 2], [0, 1], [1, 2], [0, 1], [1, 2]].forEach(function (pair) {
        swap("ranking-2", pair[0], pair[1]);
        seen.add(snapshot().publicRankings[0]);
        assert(snapshot().selectedId.indexOf(snapshot().publicRankings.join("/")) === 0, "Profile matches controls");
      });
      assert(seen.size === 6, "All six permutations reachable");
      el("strategy-details").open = true;
      assert(el("direct-rule").children.length === 6 && el("strategy-details").querySelectorAll("table").length === 1 && !el("strategy-details").querySelector("details, dl"), "Only the six-report direct rule is disclosed");
    }),
    test("Every public configuration shows all six report paths and matches the direct simulation", function () {
      var M = win.RevelationPrincipleModel;
      el("strategy-details").open = true;
      direct();
      M.rankings.forEach(function (second) {
        setRanking("ranking-2", second);
        M.rankings.forEach(function (third) {
          setRanking("ranking-3", third);
          var profile = M.solve(second, third).selected;
          var table = el("direct-rule").innerHTML;
          M.rankings.forEach(function (report, index) {
            var trace = M.simulate(profile, report);
            var cells = Array.from(el("direct-rule").children[index].children).map(function (cell) { return cell.textContent; });
            var expected = [report.split("").join(" ≻ "), trace.first.ballots[0], trace.first.winner + " vs C", trace.final.ballots[0], trace.final.winner];
            assert(cells.join("/") === expected.join("/"), "Report path " + second + "/" + third + "/" + report);
            setRanking("ranking-report", report);
            assert(el("first-ballots").querySelector("dd").textContent === cells[1] && el("final-contest").textContent === cells[2] && el("final-ballots").querySelector("dd").textContent === cells[3] && el("outcome-candidate").textContent === cells[4], "Live direct trace matches table");
            assert(el("direct-rule").innerHTML === table && snapshot().selectedId === profile.id, "Reports do not change the rule");
          });
        });
      });
      var before = el("direct-rule").innerHTML;
      swap("ranking-1", 0, 2);
      direct();
      assert(el("direct-rule").innerHTML === before, "True preferences and mode do not change the mechanism rule");
    }),
    test("Each random-preferences button samples all six rankings and updates only its voter in both modes", function () {
      var random = win.Math.random;
      var M = win.RevelationPrincipleModel;
      try {
        for (var mode = 0; mode < 2; mode += 1) {
          if (mode) { direct(); }
          [0, 1, 2].forEach(function (voter) {
            M.rankings.forEach(function (ranking, draw) {
              win.Math.random = function () { return (draw + 0.5) / M.rankings.length; };
              if (mode) { swap("ranking-report", 0, 1); }
              else { vote("A"); el("vote-survivor").click(); }
              var before = snapshot();
              var tableBefore = el("direct-rule").innerHTML;
              token("ranking-" + (voter + 1), 0).click();
              el("random-preferences-" + (voter + 1)).click();
              var after = snapshot();
              var expected = [before.trueRanking].concat(before.publicRankings);
              expected[voter] = ranking;
              assert([after.trueRanking].concat(after.publicRankings).join("/") === expected.join("/"), "Only the chosen voter changes");
              expected.forEach(function (value, index) {
                assert(Array.from(el("ranking-" + (index + 1)).querySelectorAll("button")).map(function (b) { return b.textContent; }).join("") === value, "Visible preference ranking stays synchronized");
              });
              assert(after.first === null && after.final === null && after.report === after.trueRanking, "Random preferences start a fresh election");
              assert(!doc.querySelector('.ranking-token[aria-pressed="true"]'), "Random draw clears pending swaps");
              if (voter === 0) {
                assert(after.selectedId === before.selectedId && el("direct-rule").innerHTML === tableBefore, "Private randomization preserves the selected mechanism");
              } else {
                assert(after.selectedId === M.solve(after.publicRankings[0], after.publicRankings[1]).selected.id, "Public randomization selects the new equilibrium");
              }
              var solution = M.solve(after.publicRankings[0], after.publicRankings[1]);
              var shownOutcomes = Array.from(el("direct-rule").children).map(function (row) { return row.lastElementChild.textContent; }).join("");
              assert(shownOutcomes === solution.selected.outcomes.join(""), "Direct-rule table follows randomized public preferences");
              assert(el("outcome-candidate").textContent === (mode ? M.simulate(solution.selected, after.trueRanking).final.winner : "—"), "Mode-specific outcome follows new preferences");
            });
          });
        }
      } finally { win.Math.random = random; }
    }),
    test("Both modes keep identical geometry at mobile, tablet, and desktop widths with usable squares", async function () {
      el("strategy-details").open = true;
      var layouts = {};
      for (var mode = 0; mode < 2; mode += 1) {
        if (mode) { direct(); }
        for (var width of [320, 375, 640, 680, 681, 768, 1000, 1001, 1280]) {
          frame.style.width = width + "px";
          await new Promise(function (resolve) { win.setTimeout(resolve, 40); });
          assert(doc.documentElement.scrollWidth <= doc.documentElement.clientWidth + 1, "No page overflow at " + width + " mode " + mode);
          Array.from(doc.querySelectorAll('[id^="random-preferences-"]')).forEach(function (button) {
            assert(button.getBoundingClientRect().height >= 44 && button.getAttribute("aria-label"), "Accessible random-preferences button");
          });
          Array.from(doc.querySelectorAll(".ranking-token")).filter(function (b) { return b.getClientRects().length; }).forEach(function (b) {
            var rect = b.getBoundingClientRect();
            assert(rect.width >= 44 && rect.height >= 44, "Usable touch target");
          });
          var stages = Array.from(doc.querySelectorAll(".game-stage")).filter(function (s) { return !s.hidden; });
          assert(stages.length === 4, "Four visible stages in both modes");
          if (width <= 680) { assert(stages[1].getBoundingClientRect().top > stages[0].getBoundingClientRect().bottom, "Vertical stages"); }
          if (width > 680 && width <= 1000) { assert(Math.abs(stages[1].getBoundingClientRect().top - stages[0].getBoundingClientRect().top) < 1 && stages[2].getBoundingClientRect().top > stages[0].getBoundingClientRect().bottom, "Two-column tablet layout"); }
          if (width > 1000) { assert(stages.every(function (s) { return Math.abs(s.getBoundingClientRect().top - stages[0].getBoundingClientRect().top) < 1; }), "Four desktop columns"); }
          var geometry = Array.from(doc.querySelectorAll(".game-stage, .game-stage h2, .game-stage .candidate, .vote-actions, .ballot-list, .stage-result, #strategy-details")).map(function (node) {
            var rect = node.getBoundingClientRect();
            return [rect.x, rect.y, rect.width, rect.height];
          });
          if (!mode) { layouts[width] = geometry; }
          else {
            geometry.forEach(function (rect, index) {
              rect.forEach(function (value, coordinate) { T.assertClose(value, layouts[width][index][coordinate], 1, "Stable mode geometry at " + width); });
            });
          }
        }
      }
    })
  ]);
})();
