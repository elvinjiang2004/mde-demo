(function () {
  "use strict";

  var CANDIDATES = Object.freeze(["A", "B", "C"]);
  var RANKINGS = Object.freeze(["ABC", "ACB", "BAC", "BCA", "CAB", "CBA"].map(function (text) {
    return Object.freeze(text.split(""));
  }));
  var PROFILE_COUNT = 36;

  function isCandidate(candidate) {
    return CANDIDATES.indexOf(candidate) !== -1;
  }

  function validateRule(rule) {
    if (!Array.isArray(rule) || rule.length !== PROFILE_COUNT) {
      throw new TypeError("A voting rule must contain exactly 36 candidate outcomes.");
    }
    for (var index = 0; index < PROFILE_COUNT; index += 1) {
      if (!Object.prototype.hasOwnProperty.call(rule, index) || !isCandidate(rule[index])) {
        throw new TypeError("Every voting rule outcome must be A, B or C.");
      }
    }
  }

  function scoreWinner(first, second, secondPlaceScore) {
    var scores = [0, 0, 0];
    [first, second].forEach(function (ranking) {
      scores[CANDIDATES.indexOf(ranking[0])] += 2;
      scores[CANDIDATES.indexOf(ranking[1])] += secondPlaceScore;
    });
    var best = 0;
    for (var index = 1; index < CANDIDATES.length; index += 1) {
      // Strict comparison retains the fixed A, then B, then C tie priority.
      if (scores[index] > scores[best]) { best = index; }
    }
    return CANDIDATES[best];
  }

  function createRule(preset) {
    var allowed = ["plurality", "borda", "dictator-1", "dictator-2",
      "constant-a", "constant-b", "constant-c"];
    if (allowed.indexOf(preset) === -1) {
      throw new RangeError("Unknown voting rule preset: " + preset);
    }
    var rule = [];
    RANKINGS.forEach(function (first) {
      RANKINGS.forEach(function (second) {
        var winner;
        if (preset === "dictator-1") { winner = first[0]; }
        else if (preset === "dictator-2") { winner = second[0]; }
        else if (preset.indexOf("constant-") === 0) { winner = preset.slice(-1).toUpperCase(); }
        else { winner = scoreWinner(first, second, preset === "borda" ? 1 : 0); }
        rule.push(winner);
      });
    });
    return rule;
  }

  function replaceOutcome(rule, index, candidate) {
    validateRule(rule);
    if (!Number.isInteger(index) || index < 0 || index >= PROFILE_COUNT) {
      throw new RangeError("A profile index must be an integer from 0 to 35.");
    }
    if (!isCandidate(candidate)) {
      throw new TypeError("An elected candidate must be A, B or C.");
    }
    var edited = rule.slice();
    edited[index] = candidate;
    return edited;
  }

  function audit(rule) {
    validateRule(rule);
    var missingCandidates = CANDIDATES.filter(function (candidate) {
      return rule.indexOf(candidate) === -1;
    });
    var dictators = [0, 1].filter(function (voter) {
      return rule.every(function (winner, index) {
        var rankingIndex = voter === 0 ? Math.floor(index / 6) : index % 6;
        return winner === RANKINGS[rankingIndex][0];
      });
    });
    var manipulations = [];
    var manipulableProfiles = [];
    var checkedDeviations = 0;

    rule.forEach(function (truthfulWinner, from) {
      var row = Math.floor(from / 6);
      var column = from % 6;
      var canManipulate = false;
      [0, 1].forEach(function (voter) {
        var trueRankingIndex = voter === 0 ? row : column;
        var trueRanking = RANKINGS[trueRankingIndex];
        RANKINGS.forEach(function (report, reportRankingIndex) {
          if (reportRankingIndex === trueRankingIndex) { return; }
          checkedDeviations += 1;
          var to = voter === 0 ? 6 * reportRankingIndex + column : 6 * row + reportRankingIndex;
          var reportedWinner = rule[to];
          var gain = trueRanking.indexOf(truthfulWinner) - trueRanking.indexOf(reportedWinner);
          if (gain > 0) {
            canManipulate = true;
            manipulations.push({
              voter: voter,
              from: from,
              to: to,
              trueRankingIndex: trueRankingIndex,
              reportRankingIndex: reportRankingIndex,
              truthfulWinner: truthfulWinner,
              reportedWinner: reportedWinner,
              gain: gain
            });
          }
        });
      });
      if (canManipulate) { manipulableProfiles.push(from); }
    });

    return {
      onto: missingCandidates.length === 0,
      missingCandidates: missingCandidates,
      dictators: dictators,
      strategyProof: manipulations.length === 0,
      manipulableProfiles: manipulableProfiles,
      checkedDeviations: checkedDeviations,
      manipulations: manipulations
    };
  }

  window.GibbardSatterthwaiteTheoremModel = Object.freeze({
    CANDIDATES: CANDIDATES,
    RANKINGS: RANKINGS,
    createRule: createRule,
    replaceOutcome: replaceOutcome,
    audit: audit
  });
})();
