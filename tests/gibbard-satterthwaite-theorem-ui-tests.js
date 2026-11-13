(function () {
  "use strict";
  var T = window.MechanismTest, assert = T.assert;
  var frame = document.getElementById("app-frame");
  var keepAlive = window.setInterval(function () {}, 50);
  var doc, win, model;
  var tests = [];
  function test(name, run) { tests.push({ name: name, run: run }); }
  function element(id) { return doc.getElementById(id); }
  function cell(index) { return doc.querySelector('.rule-cell[data-index="' + index + '"]'); }
  function readRule() { return Array.from(doc.querySelectorAll(".rule-cell")).map(function (button) { return button.dataset.winner; }); }
  function brushButton(candidate) { return doc.querySelector('.winner-choice[data-candidate="' + candidate + '"]'); }
  function choose(candidate) { brushButton(candidate).click(); }
  function change(index, candidate) { choose(candidate); cell(index).click(); }
  function paintRule(rule) { rule.forEach(function (candidate, index) { change(index, candidate); }); }
  function key(index, value) { T.dispatch(cell(index), "keydown", win, { key: value }); }
  function independentFlags(rule) {
    return rule.map(function (winner, index) {
      var row = Math.floor(index / 6), column = index % 6;
      return [0, 1].map(function (voter) {
        var preference = model.RANKINGS[voter === 0 ? row : column];
        for (var report = 0; report < 6; report += 1) {
          var target = voter === 0 ? report * 6 + column : row * 6 + report;
          if (preference.indexOf(rule[target]) < preference.indexOf(winner)) { return true; }
        }
        return false;
      });
    });
  }
  function checkAudit() {
    var rule = readRule(), audit = model.audit(rule), flags = independentFlags(rule);
    assert(element("onto-verdict").dataset.satisfied === String(audit.onto), "Onto must match all outcomes.");
    assert(element("dictator-verdict").dataset.satisfied === String(audit.dictators.length === 0), "Dictatorship must test a fixed voter at every profile.");
    assert(element("strategy-verdict").dataset.satisfied === String(audit.strategyProof), "Strategy-proofness must use the complete audit.");
    flags.forEach(function (pair, index) {
      var td = cell(index).parentElement;
      pair.forEach(function (canManipulate, voter) {
        assert(td.classList.contains("has-voter-" + (voter + 1) + "-manipulation") === canManipulate,
          "Marker must reflect an outgoing profitable deviation under the original ranking: profile " + index + ", voter " + (voter + 1));
        assert(td.dataset["voter" + (voter + 1) + "Manipulable"] === String(canManipulate), "Marker state must be inspectable without color.");
        if (canManipulate) {
          assert(cell(index).getAttribute("aria-label").indexOf("Voter " + (voter + 1), cell(index).getAttribute("aria-label").indexOf("profitable misreport")) >= 0,
            "Screen readers must identify each voter who can manipulate.");
        }
      });
    });
    return flags;
  }
  function pointer(target, type, overrides) {
    var box = target.getBoundingClientRect();
    T.dispatch(target, type, win, Object.assign({ pointerId: 17, pointerType: "mouse", isPrimary: true,
      button: 0, buttons: 1, clientX: box.left + box.width / 2, clientY: box.top + box.height / 2 }, overrides || {}));
  }
  function withCaptureStub(run) {
    var table = element("rule-table"), capture = null;
    var original = [table.setPointerCapture, table.hasPointerCapture, table.releasePointerCapture];
    table.setPointerCapture = function (id) { capture = id; };
    table.hasPointerCapture = function (id) { return capture === id; };
    table.releasePointerCapture = function () { capture = null; };
    try { run(function () { return capture; }); }
    finally {
      pointer(table, "pointercancel");
      table.setPointerCapture = original[0]; table.hasPointerCapture = original[1]; table.releasePointerCapture = original[2];
    }
  }

  test("The lesson starts with the complete plurality rule and no starting-rule selector", function () {
    assert(doc.querySelectorAll(".rule-cell").length === 36 && doc.querySelectorAll('#rule-head th[scope="col"]').length === 6 && doc.querySelectorAll('#rule-body th[scope="row"]').length === 6, "Every strict-ranking profile must remain editable.");
    assert(readRule().join("") === model.createRule("plurality").join(""), "Initial outcomes must equal plurality with unchanged tie-breaking.");
    assert(Array.from(doc.querySelectorAll(".audit-properties dt")).map(function (term) { return term.textContent; }).join("|") === "Onto:|Not dictatorial:|Strategy-proof:" && !doc.querySelector(".rule-diagnostics h3"), "Diagnostics must use the requested labels without a Rule check heading.");
    assert(!element("rule-preset") && !element("load-rule") && !element("show-manipulation") && !element("witness-arrow"), "The brush and corner markers replace the preset and witness controls.");
    assert(doc.querySelector('.winner-brush-controls').textContent.indexOf("Winner brush") >= 0 && brushButton("A").getAttribute("aria-pressed") === "true", "The brush must have its requested label and an initial candidate.");
    T.assertScriptOrder(doc, ["../../js/components.js", "../../js/bibliography.js", "../../js/references.js", "../../js/mathjax-config.js", "../../assets/mathjax/tex-svg.js", "../../js/mathjax-runtime.js", "../../js/notation-catalog.js", "../../js/learning-sidebar.js", "model.js", "app.js"]);
    checkAudit();
  });
  test("The diagonal corner places Voter 1 below left and Voter 2 above right", function () {
    var corner = doc.querySelector(".table-corner"), line = corner.querySelector("svg line");
    var first = corner.querySelector(".corner-voter-1"), second = corner.querySelector(".corner-voter-2");
    assert(line && line.getAttribute("x1") === "0" && line.getAttribute("y1") === "0" && line.getAttribute("x2") === "100" && line.getAttribute("y2") === "100", "The diagonal must split the rectangular header from top left to bottom right.");
    assert(first.textContent === "Voter 1" && second.textContent === "Voter 2" && first.getBoundingClientRect().left < second.getBoundingClientRect().left && first.getBoundingClientRect().top > second.getBoundingClientRect().top, "Voter labels must occupy the requested triangles.");
  });
  test("Choosing a winner brush does not edit a profile until it is painted", function () {
    var before = readRule().join("");
    ["B", "C", "A"].forEach(function (candidate) {
      choose(candidate);
      assert(readRule().join("") === before, "Changing the brush must preserve all 36 outcomes.");
      assert(doc.querySelectorAll('.winner-choice[aria-pressed="true"]').length === 1 && brushButton(candidate).getAttribute("aria-pressed") === "true", "Only the chosen brush may be active.");
    });
    choose("C"); cell(0).click();
    assert(cell(0).dataset.winner === "C" && brushButton("C").getAttribute("aria-pressed") === "true", "Clicking a cell applies the brush rather than sampling its winner.");
  });
  test("Every outcome can be painted independently while preserving the other 35", function () {
    for (var index = 0; index < 36; index += 1) {
      var before = readRule(), candidate = model.CANDIDATES[(model.CANDIDATES.indexOf(before[index]) + 1) % 3];
      change(index, candidate);
      readRule().forEach(function (winner, other) { assert(winner === (other === index ? candidate : before[other]), "Paint must change only the visited profile."); });
      checkAudit();
    }
  });
  test("Both voters' markers agree with independent deviations for all seven model fixtures", function () {
    var passingOnto = "Passes (Every candidate can win)";
    var passingNonDictatorship = "Passes (No voter is a dictator)";
    var passingStrategyProof = "Passes (No profitable misreports)";
    var failingStrategyProof = "Fails (Profitable misreporting profiles marked with a red triangle in the bottom left/upper right for Voter 1/Voter 2)";
    var expected = {
      "plurality": [passingOnto, passingNonDictatorship, failingStrategyProof],
      "borda": [passingOnto, passingNonDictatorship, failingStrategyProof],
      "dictator-1": [passingOnto, "Fails (Voter 1 is a dictator)", passingStrategyProof],
      "dictator-2": [passingOnto, "Fails (Voter 2 is a dictator)", passingStrategyProof],
      "constant-a": ["Fails (Candidates B and C cannot win)", passingNonDictatorship, passingStrategyProof],
      "constant-b": ["Fails (Candidates A and C cannot win)", passingNonDictatorship, passingStrategyProof],
      "constant-c": ["Fails (Candidates A and B cannot win)", passingNonDictatorship, passingStrategyProof]
    };
    ["plurality", "borda", "dictator-1", "dictator-2", "constant-a", "constant-b", "constant-c"].forEach(function (id) {
      paintRule(model.createRule(id));
      checkAudit();
      ["onto-verdict", "dictator-verdict", "strategy-verdict"].forEach(function (verdictId, index) {
        assert(element(verdictId).textContent === expected[id][index], "Pass/fail explanations must match the known fixture " + id + ".");
      });
      if (id.indexOf("dictator-") === 0 || id.indexOf("constant-") === 0) {
        assert(!doc.querySelector(".has-voter-1-manipulation, .has-voter-2-manipulation"), "Strategy-proof rules must have no red corner flags.");
      }
    });
    paintRule(model.createRule("plurality").map(function (winner) { return winner === "C" ? "B" : winner; }));
    assert(element("onto-verdict").textContent === "Fails (Candidate C cannot win)", "A single missing candidate needs the singular explanation.");
    checkAudit();
  });
  test("A profile can show bottom-left and upper-right red triangles without hiding its winner", function () {
    paintRule(Array.from({ length: 36 }, function (_, index) { return model.CANDIDATES[(index + Math.floor(index / 6)) % 3]; }));
    var flags = checkAudit(), index = flags.findIndex(function (pair) { return pair[0] && pair[1]; });
    assert(index >= 0, "The fixture must contain a profile manipulable by both voters.");
    var td = cell(index).parentElement, left = win.getComputedStyle(td, "::before"), right = win.getComputedStyle(td, "::after");
    assert(left.content !== "none" && right.content !== "none" && left.left === "2px" && left.bottom === "2px" && right.right === "2px" && right.top === "2px", "Voter 1's marker belongs below left and Voter 2's belongs above right.");
    assert(parseFloat(left.borderBottomWidth) === 14 && parseFloat(left.borderRightWidth) === 14 && parseFloat(right.borderTopWidth) === 14 && parseFloat(right.borderLeftWidth) === 14 && left.borderBottomColor === right.borderTopColor && left.borderBottomColor !== "rgba(0, 0, 0, 0)", "Triangles must use solid red bases and transparent inward edges.");
    assert(cell(index).textContent === readRule()[index] && cell(index).getBoundingClientRect().height >= 44, "The elected candidate must remain readable and actionable.");
  });
  test("Painting one outcome refreshes other profiles' manipulation flags too", function () {
    var rule = model.createRule("plurality"), before = independentFlags(rule), edit;
    for (var index = 0; index < 36 && !edit; index += 1) {
      model.CANDIDATES.forEach(function (candidate) {
        var changed = model.replaceOutcome(rule, index, candidate), after = independentFlags(changed);
        if (!edit && after.some(function (pair, other) { return other !== index && pair.join("") !== before[other].join(""); })) { edit = { index: index, candidate: candidate }; }
      });
    }
    assert(edit, "The fixture must exercise an incentive change at another source profile.");
    paintRule(rule); change(edit.index, edit.candidate); checkAudit();
  });
  test("A primary pointer stroke paints multiple profiles and releases capture", function () {
    paintRule(model.createRule("constant-a")); choose("C");
    withCaptureStub(function (capture) {
      pointer(cell(0), "pointerdown"); pointer(cell(1), "pointermove"); pointer(cell(7), "pointermove");
      pointer(cell(7), "pointerup", { buttons: 0 });
      assert(cell(0).dataset.winner === "C" && cell(1).dataset.winner === "C" && cell(7).dataset.winner === "C" && capture() === null, "A stroke must paint every visited cell and end cleanly.");
      cell(0).dispatchEvent(new win.MouseEvent("click", { bubbles: true, detail: 1 }));
      assert(doc.activeElement === cell(7), "The compatibility click must not move selection back to the stroke's start.");
      pointer(cell(8), "pointermove"); assert(cell(8).dataset.winner === "A", "Moving after release must not paint.");
    });
    checkAudit();
  });
  test("Secondary contacts and right buttons cannot start or take over painting", function () {
    paintRule(model.createRule("constant-a")); choose("B");
    withCaptureStub(function () {
      pointer(cell(0), "pointerdown", { isPrimary: false }); pointer(cell(1), "pointerdown", { button: 2 });
      assert(cell(0).dataset.winner === "A" && cell(1).dataset.winner === "A", "Only a primary main-button press may start painting.");
      pointer(cell(0), "pointerdown");
      pointer(cell(1), "pointermove", { pointerId: 19, isPrimary: false });
      pointer(cell(2), "pointerdown", { pointerId: 19 });
      assert(cell(1).dataset.winner === "A" && cell(2).dataset.winner === "A", "Only the owning pointer may paint during an active stroke.");
      pointer(cell(0), "pointerup", { buttons: 0 });
    });
  });
  test("Cancellation, capture loss and released buttons stop a stroke", function () {
    ["pointercancel", "lostpointercapture", "released-buttons"].forEach(function (ending) {
      paintRule(model.createRule("constant-a")); choose("B");
      withCaptureStub(function () {
        pointer(cell(0), "pointerdown");
        if (ending === "released-buttons") { pointer(cell(1), "pointermove", { buttons: 0 }); }
        else { pointer(element("rule-table"), ending); }
        pointer(cell(2), "pointermove");
        assert(cell(0).dataset.winner === "B" && cell(1).dataset.winner === "A" && cell(2).dataset.winner === "A", "Ending a stroke retains visited outcomes and prevents later painting.");
      });
    });
  });
  test("Keyboard navigation and Enter, Space and candidate keys apply the brush", function () {
    paintRule(model.createRule("constant-a")); choose("B");
    cell(0).focus({ preventScroll: true }); key(0, "ArrowRight"); key(1, "ArrowDown");
    assert(doc.activeElement === cell(7) && cell(7).dataset.winner === "A", "Navigation alone must not paint.");
    key(7, "Enter"); assert(cell(7).dataset.winner === "B", "Enter applies the chosen brush.");
    key(7, "ArrowRight"); key(8, " "); assert(cell(8).dataset.winner === "B", "Space applies the same brush at another profile.");
    key(8, "c"); assert(cell(8).dataset.winner === "C" && brushButton("C").getAttribute("aria-pressed") === "true" && doc.activeElement === cell(8), "Candidate keys must change the brush and paint without losing focus.");
    key(8, "End"); assert(doc.activeElement === cell(11), "End reaches the last column.");
    key(11, "Home"); key(6, "ArrowLeft"); assert(doc.activeElement === cell(6), "Home and boundary navigation remain available.");
    checkAudit();
  });
  test("Brush focus, accessible flags, Notes, references and local math remain available", function () {
    var before = readRule().join(""); brushButton("A").focus({ preventScroll: true }); choose("A");
    assert(doc.activeElement === brushButton("A") && readRule().join("") === before && element("live-summary").textContent.indexOf("Winner brush A") >= 0, "Changing the brush preserves focus and announces its value without editing a profile.");
    assert(element("notes") && !element("notes").hidden && doc.querySelector('learning-sidebar[page="gibbard-satterthwaite-theorem"] template[data-insights]'), "Authored Notes and Insights slots remain intact.");
    assert(doc.querySelectorAll(".reference-list a").length === 3 && doc.querySelector(".rule-heading mjx-container") && !doc.querySelector("mjx-merror, merror, [data-render-error]"), "Bibliography and local mathematics must render without errors.");
  });
  test("Responsive tables retain the brush, diagonal and all profiles without page overflow", async function () {
    for (var index = 0; index < 4; index += 1) {
      var width = [320, 375, 768, 1280][index]; frame.style.width = width + "px";
      await T.waitFor(function () { return win.innerWidth === width; }, 5000, "Frame resize must reach the requested width.");
      await T.nextAnimationFrames(win, 2);
      assert(doc.documentElement.scrollWidth <= win.innerWidth + 1 && doc.querySelectorAll(".rule-cell").length === 36, "No page overflow or missing profiles at " + width + "px.");
      var scroller = element("rule-scroll"), tableBounds = element("rule-table").getBoundingClientRect();
      assert(width >= 768 || scroller.scrollWidth > scroller.clientWidth, "Narrow tables need their own scroll region.");
      Array.from(doc.querySelectorAll(".rule-cell, .winner-choice")).forEach(function (button) { assert(button.getBoundingClientRect().height >= 44, "Brush and profile targets must remain touch-sized."); });
      choose("B"); cell(35).click(); key(35, "ArrowLeft");
      assert(doc.activeElement === cell(34) && cell(34).getBoundingClientRect().right <= scroller.getBoundingClientRect().right + 1, "Keyboard movement reveals offscreen cells.");
      assert(Math.abs(element("rule-table").getBoundingClientRect().height - tableBounds.height) < 1, "Painting and marker updates must not change table geometry.");
    }
  });

  T.loadFrame(frame, "../voting/gibbard-satterthwaite-theorem/index.html", {
    ready: function (documentNode, frameWindow) { return frameWindow.GibbardSatterthwaiteTheoremModel && documentNode.querySelector('#voting-demo[data-ready="true"]'); },
    math: ".introduction, .rule-heading", timeout: 30000
  }).then(function (loaded) {
    doc = loaded.document; win = loaded.window; model = win.GibbardSatterthwaiteTheoremModel;
    return T.run(tests, { title: "Gibbard-Satterthwaite interface tests", cleanup: function () { window.clearInterval(keepAlive); } });
  }).catch(function (error) {
    T.addResult("The voting lesson initializes", error);
    T.finish(1, 1, { title: "Gibbard-Satterthwaite interface tests", cleanup: function () { window.clearInterval(keepAlive); } });
  });
})();
