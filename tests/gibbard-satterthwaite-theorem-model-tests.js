(function () {
  "use strict";
  var T = window.MechanismTest;
  var M = window.GibbardSatterthwaiteTheoremModel;
  var assert = T.assert;
  var tests = [];
  var preferenceStrings = ["ABC", "ACB", "BAC", "BCA", "CAB", "CBA"];
  var presetNames = ["plurality", "borda", "dictator-1", "dictator-2",
    "constant-a", "constant-b", "constant-c"];

  function test(name, run) { tests.push({ name: name, run: run }); }
  function equal(first, second, message) {
    assert(JSON.stringify(first) === JSON.stringify(second), message);
  }
  function throws(run, message) {
    var thrown = false;
    try { run(); } catch (error) { thrown = error instanceof Error; }
    assert(thrown, message);
  }
  function witnessKey(witness) {
    return witness.from + ":" + witness.to + ":" + witness.voter;
  }

  // Independent oracle considers every ordered pair of cells, retaining pairs
  // with exactly one changed coordinate. It does not use the model's audit,
  // ranking constants, report enumeration, or ordinal gain calculation.
  function oracle(rule) {
    var witnesses = [];
    var checked = 0;
    for (var source = 0; source < 36; source += 1) {
      for (var target = 0; target < 36; target += 1) {
        if (source === target) { continue; }
        var oldRow = Math.floor(source / 6), oldColumn = source % 6;
        var newRow = Math.floor(target / 6), newColumn = target % 6;
        if ((oldRow === newRow) === (oldColumn === newColumn)) { continue; }
        checked += 1;
        var voter = oldRow === newRow ? 1 : 0;
        var preference = preferenceStrings[voter === 0 ? oldRow : oldColumn];
        var preferred = false;
        for (var position = 0; position < preference.length; position += 1) {
          if (preference[position] === rule[target]) {
            preferred = rule[target] !== rule[source];
            break;
          }
          if (preference[position] === rule[source]) { break; }
        }
        if (preferred) { witnesses.push({ from: source, to: target, voter: voter }); }
      }
    }
    return { checked: checked, witnesses: witnesses };
  }

  test("The model exposes exactly the unrestricted six strict rankings and immutable constants", function () {
    equal(M.CANDIDATES, ["A", "B", "C"], "Candidate domain.");
    equal(M.RANKINGS.map(function (ranking) { return ranking.join(""); }), preferenceStrings,
      "Every strict ranking appears once in the agreed order.");
    assert(Object.isFrozen(M) && Object.isFrozen(M.CANDIDATES) && Object.isFrozen(M.RANKINGS) &&
      M.RANKINGS.every(Object.isFrozen), "Exported constants and nested rankings are frozen.");
  });

  test("Each dictatorship is onto and strategy-proof for the same fixed voter at all profiles", function () {
    [0, 1].forEach(function (voter) {
      var rule = M.createRule("dictator-" + (voter + 1));
      var audit = M.audit(rule);
      assert(audit.onto && audit.strategyProof && audit.manipulations.length === 0,
        "A dictatorship is onto and admits no profitable report.");
      equal(audit.dictators, [voter], "The dictator is global, fixed and correctly indexed.");
      assert(audit.checkedDeviations === 360 && audit.manipulableProfiles.length === 0,
        "The audit covers every nontruthful report.");
      rule.forEach(function (winner, profile) {
        var ranking = preferenceStrings[voter === 0 ? Math.floor(profile / 6) : profile % 6];
        assert(winner === ranking[0], "The dictator receives her reported top choice.");
      });
    });
  });

  test("Each constant outcome is strategy-proof but excludes the other two candidates", function () {
    ["A", "B", "C"].forEach(function (candidate) {
      var audit = M.audit(M.createRule("constant-" + candidate.toLowerCase()));
      assert(!audit.onto && audit.strategyProof && audit.dictators.length === 0,
        "Constant rules have no dictator and cannot be onto.");
      equal(audit.missingCandidates, ["A", "B", "C"].filter(function (other) { return other !== candidate; }),
        "Exactly the unselected candidates are missing.");
    });
  });

  test("Plurality and Borda use their scoring definitions and the explicit A/B/C tie priority", function () {
    ["plurality", "borda"].forEach(function (preset) {
      var rule = M.createRule(preset);
      var audit = M.audit(rule);
      assert(audit.onto && !audit.strategyProof && audit.dictators.length === 0,
        "Familiar voting rules are onto, non-dictatorial and manipulable.");
      for (var row = 0; row < 6; row += 1) {
        for (var column = 0; column < 6; column += 1) {
          var scores = {};
          ["A", "B", "C"].forEach(function (candidate) {
            scores[candidate] = [preferenceStrings[row], preferenceStrings[column]].reduce(function (sum, ranking) {
              var place = ranking.indexOf(candidate);
              return sum + (preset === "borda" ? 2 - place : (place === 0 ? 1 : 0));
            }, 0);
          });
          var expected = ["A", "B", "C"].filter(function (candidate) {
            return scores[candidate] === Math.max(scores.A, scores.B, scores.C);
          })[0];
          assert(rule[6 * row + column] === expected, "Scoring and tie priority at every profile.");
        }
      }
    });
  });

  test("A known plurality manipulation holds the other report fixed and improves the true ranking", function () {
    var rule = M.createRule("plurality");
    var witness = M.audit(rule).manipulations.find(function (item) {
      return item.from === 22 && item.to === 19 && item.voter === 1;
    });
    assert(witness && witness.truthfulWinner === "B" && witness.reportedWinner === "A",
      "At (BCA,CAB), Voter 2 can report ACB and get A rather than B.");
    assert(witness.trueRankingIndex === 4 && witness.reportRankingIndex === 1 && witness.gain === 1,
      "The improvement uses CAB, the original true ranking.");
  });

  test("Reported preferences never replace true preferences when judging a gain", function () {
    var rule = M.createRule("constant-c");
    rule[6] = "B";
    var audit = M.audit(rule);
    var forward = audit.manipulations.find(function (item) { return item.from === 0 && item.to === 6; });
    var backward = audit.manipulations.find(function (item) { return item.from === 6 && item.to === 0; });
    assert(forward && forward.voter === 0 && forward.gain === 1,
      "True ABC prefers B to C even though the ACB report ranks C above B.");
    assert(backward && backward.gain === 1,
      "True ACB prefers C to B when the same edge is traversed in reverse.");
  });

  test("Removing onto also permits nonconstant strategy-proof rules without a dictator", function () {
    var binaryRule = [];
    preferenceStrings.forEach(function (first) {
      preferenceStrings.forEach(function (second) {
        binaryRule.push(first.indexOf("B") < first.indexOf("A") &&
          second.indexOf("B") < second.indexOf("A") ? "B" : "A");
      });
    });
    var audit = M.audit(binaryRule);
    assert(audit.strategyProof && !audit.onto && audit.dictators.length === 0,
      "Binary unanimity with disagreement selecting A is strategy-proof.");
    equal(audit.missingCandidates, ["C"], "Only C is excluded.");
  });

  test("A cell edit is immutable and permits every candidate independently at all 36 profiles", function () {
    var rule = Object.freeze(M.createRule("plurality"));
    var baseline = JSON.stringify(rule);
    for (var profile = 0; profile < 36; profile += 1) {
      ["A", "B", "C"].forEach(function (candidate) {
        var edited = M.replaceOutcome(rule, profile, candidate);
        assert(edited !== rule && edited[profile] === candidate, "Fresh output with the requested candidate.");
        edited.forEach(function (winner, index) {
          assert(index === profile || winner === rule[index], "Other 35 outcomes remain fixed.");
        });
      });
    }
    M.audit(rule);
    assert(JSON.stringify(rule) === baseline, "Editing and auditing never mutate an input rule.");
    var fresh = M.createRule("plurality");
    fresh[0] = "C";
    assert(M.createRule("plurality")[0] === "A", "Preset outputs do not share mutable state.");
  });

  test("Malformed, sparse, inherited, noncandidate and out-of-domain edits fail explicitly", function () {
    var inherited = new Array(36);
    var inheritedPrototype = Object.create(Array.prototype);
    for (var index = 0; index < 36; index += 1) { inheritedPrototype[index] = "A"; }
    Object.setPrototypeOf(inherited, inheritedPrototype);
    var malformed = [null, {}, "A".repeat(36), [], new Array(36), new Array(35).fill("A"),
      new Array(37).fill("A"), inherited];
    [undefined, null, "D", "a", 0, NaN, {}, ["A"]].forEach(function (invalid) {
      var rule = M.createRule("constant-a");
      rule[17] = invalid;
      malformed.push(rule);
    });
    malformed.forEach(function (rule) {
      throws(function () { M.audit(rule); }, "Invalid rules cannot be audited.");
      throws(function () { M.replaceOutcome(rule, 0, "A"); }, "Invalid source rules cannot be edited.");
    });
    var valid = M.createRule("plurality");
    [-1, 36, 0.5, "0", null, NaN, Infinity].forEach(function (index) {
      throws(function () { M.replaceOutcome(valid, index, "A"); }, "Invalid profile index.");
    });
    ["D", "a", undefined, 0, null].forEach(function (candidate) {
      throws(function () { M.replaceOutcome(valid, 0, candidate); }, "Invalid elected candidate.");
    });
    ["unknown", "", undefined, null, 1, "toString"].forEach(function (name) {
      throws(function () { M.createRule(name); }, "Unknown presets fail.");
    });
  });

  test("Every profitable deviation agrees with an independent ordered-cell-pair oracle", function () {
    var rules = presetNames.map(M.createRule);
    var seed = 20261108;
    for (var sample = 0; sample < 80; sample += 1) {
      var arbitrary = [];
      for (var index = 0; index < 36; index += 1) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        arbitrary.push(["A", "B", "C"][seed % 3]);
      }
      rules.push(arbitrary);
    }
    rules.forEach(function (rule) {
      var expected = oracle(rule);
      var actual = M.audit(Object.freeze(rule.slice()));
      assert(expected.checked === 360 && actual.checkedDeviations === expected.checked,
        "All 360 alternatives are compared once.");
      equal(actual.manipulations.map(witnessKey).sort(), expected.witnesses.map(witnessKey).sort(),
        "All and only profitable unilateral deviations are returned, for both voters.");
      var sources = expected.witnesses.map(function (witness) { return witness.from; });
      var expectedProfiles = sources.filter(function (value, index) { return sources.indexOf(value) === index; })
        .sort(function (first, second) { return first - second; });
      equal(actual.manipulableProfiles, expectedProfiles, "Each manipulable true profile is counted once.");
      assert(actual.strategyProof === (expected.witnesses.length === 0), "Global strategy-proofness verdict.");
      actual.manipulations.forEach(function (witness) {
        var trueIndex = witness.voter === 0 ? Math.floor(witness.from / 6) : witness.from % 6;
        var reportIndex = witness.voter === 0 ? Math.floor(witness.to / 6) : witness.to % 6;
        assert(witness.trueRankingIndex === trueIndex && witness.reportRankingIndex === reportIndex &&
          witness.truthfulWinner === rule[witness.from] && witness.reportedWinner === rule[witness.to],
        "Witness metadata describes actual cells and rankings.");
        assert(witness.gain === preferenceStrings[trueIndex].indexOf(rule[witness.from]) -
          preferenceStrings[trueIndex].indexOf(rule[witness.to]) && witness.gain > 0,
        "Reported gains are positive ordinal improvements under the original true preference.");
      });
    });
  });

  T.run(tests, { title: "Gibbard-Satterthwaite model" });
})();
