(function () {
  "use strict";
  var M = window.RevelationPrincipleModel;
  var assert = MechanismTest.assert;
  var types = ["ABC", "ACB", "BAC", "BCA", "CAB", "CBA"];
  var plans = [];
  ["A", "B"].forEach(function (first) {
    ["A", "C"].forEach(function (afterA) {
      ["B", "C"].forEach(function (afterB) {
        plans.push({ first: first, A: afterA, B: afterB });
      });
    });
  });

  // Independent oracle: count each candidate's votes, without production helpers.
  function winner(votes) {
    return ["A", "B", "C"].filter(function (x) {
      return votes.filter(function (vote) { return vote === x; }).length >= 2;
    })[0];
  }
  function payoff(type, x) { return { 0: 2, 1: 1, 2: 0 }[type.indexOf(x)]; }
  function finalVote(type, survivor) {
    return type.split("").filter(function (x) { return x === survivor || x === "C"; })[0];
  }
  function run(profile, type, player, plan) {
    var allTypes = [type].concat(profile.publicRankings);
    var first = [profile.first.voter1[types.indexOf(type)], profile.first.voter2, profile.first.voter3];
    if (plan) { first[player] = plan.first; }
    var survivor = winner(first);
    var final = allTypes.map(function (t) { return finalVote(t, survivor); });
    if (plan) { final[player] = plan[survivor]; }
    return winner(final);
  }
  function noGain(profile) {
    return plans.every(function (plan) {
      return types.every(function (type) {
        return payoff(type, run(profile, type, 0, plan)) <= payoff(type, run(profile, type));
      }) && [1, 2].every(function (player) {
        var publicType = profile.publicRankings[player - 1];
        return types.reduce(function (sum, type) {
          return sum + payoff(publicType, run(profile, type, player, plan)) -
            payoff(publicType, run(profile, type));
        }, 0) <= 0;
      });
    });
  }

  function welfare(profile) {
    return types.reduce(function (sum, type) {
      var elected = run(profile, type);
      return sum + [type].concat(profile.publicRankings).reduce(function (total, voterType) {
        return total + payoff(voterType, elected);
      }, 0);
    }, 0);
  }

  MechanismTest.run([
    { name: "Known multiplicities and selected default outcome", run: function () {
      [["BCA", "CAB", 24, 2], ["BCA", "ACB", 12, 3], ["ABC", "ABC", 65, 2],
        ["CAB", "CBA", 256, 1]].forEach(function (fixture) {
        var result = M.solve(fixture[0], fixture[1]);
        assert(result.profiles.length === fixture[2] && result.outcomeMapCount === fixture[3], fixture.join("/"));
      });
      var selected = M.solve("BCA", "CAB").selected;
      assert(selected.key === "BABABBAA" && selected.welfareSum === 25, "Welfare-maximizing default with alphabetical tiebreak");
      assert(selected.outcomes.join("") === "BCBBCC", "Default direct outcome map");
      var allA = M.solve("BCA", "CAB").profiles.filter(function (p) { return p.key === "AAAAAAAA"; })[0];
      assert(allA.welfareSum === 24 && selected.welfareSum > allA.welfareSum, "Welfare takes priority over alphabetical order");
      assert(M.solve("BCA", "ACB").selected.outcomes.join("") === "AABBCC", "All three candidates remain attainable");
    } },
    { name: "All 36 configurations: exhaustive membership and full contingent unilateral deviations", run: function () {
      types.forEach(function (second) {
        types.forEach(function (third) {
          var solution = M.solve(second, third);
          var keys = solution.profiles.map(function (profile) { return profile.key; });
          assert(keys.length > 0 && new Set(keys).size === keys.length, "Existence and unique profiles");
          ["A", "B"].forEach(function (a2) {
            ["A", "B"].forEach(function (a3) {
              var mask;
              for (mask = 0; mask < 64; mask += 1) {
                var mapping = types.map(function (_, index) { return Math.floor(mask / Math.pow(2, index)) % 2 ? "B" : "A"; });
                var profile = { publicRankings: [second, third], first: { voter1: mapping, voter2: a2, voter3: a3 } };
                var key = a2 + a3 + mapping.join("");
                assert(noGain(profile) === (keys.indexOf(key) >= 0), "Equilibrium membership " + second + third + key);
              }
            });
          });
        });
      });
    } },
    { name: "Every retained equilibrium: every true type and report obeys truthful incentive constraints", run: function () {
      types.forEach(function (second) {
        types.forEach(function (third) {
          M.solve(second, third).profiles.forEach(function (profile) {
            types.forEach(function (truth, index) {
              var truthful = M.simulate(profile, truth).final.winner;
              assert(truthful === run(profile, truth) && truthful === profile.outcomes[index], "Truth reproduces indirect equilibrium");
              types.forEach(function (report) {
                var direct = M.simulate(profile, report).final.winner;
                assert(direct === run(profile, report), "Report executes the full contingent plan");
                assert(payoff(truth, truthful) >= payoff(truth, direct), "No profitable report");
              });
            });
          });
        });
      });
    } },
    { name: "Sincere continuation is optimal at either final, including every off-path ballot pair", run: function () {
      types.forEach(function (type) {
        ["A", "B"].forEach(function (survivor) {
          [survivor, "C"].forEach(function (other2) {
            [survivor, "C"].forEach(function (other3) {
              var sincere = M.preferred(type, survivor, "C");
              [survivor, "C"].forEach(function (vote) {
                assert(payoff(type, winner([sincere, other2, other3])) >=
                  payoff(type, winner([vote, other2, other3])), "Final weak dominance");
              });
            });
          });
        });
      });
    } },
    { name: "All 36 configurations maximize expected total welfare and break ties alphabetically", run: function () {
      types.forEach(function (second) {
        types.forEach(function (third) {
          var solution = M.solve(second, third);
          var scores = solution.profiles.map(function (profile) {
            var score = welfare(profile);
            assert(profile.welfareSum === score && Number.isInteger(profile.welfareSum), "Exact welfare agrees with independent outcome and utility oracle");
            return score;
          });
          var maximum = Math.max.apply(null, scores);
          var tiedKeys = solution.profiles.filter(function (profile) { return welfare(profile) === maximum; })
            .map(function (profile) { return profile.key; }).reverse().sort();
          var expected = solution.selected;
          assert(welfare(expected) === maximum && expected.key === tiedKeys[0], "Maximum welfare, then the alphabetical minimum among tied equilibria");
          solution.profiles.forEach(function (profile, index) {
            if (!index) { return; }
            var previous = solution.profiles[index - 1];
            assert(previous.welfareSum > profile.welfareSum ||
              (previous.welfareSum === profile.welfareSum && previous.key < profile.key), "Full ordering follows welfare then alphabetical key");
          });
          assert(M.solve(second, third) === solution, "Stable deterministic choice");
          assert(Object.isFrozen(solution.selected.first.voter1) && Object.isFrozen(solution.profiles), "Immutable cached strategies");
          types.forEach(function (type) { M.simulate(solution.selected, type); });
          assert(M.solve(second, third).selected === expected, "Reports leave selected equilibrium unchanged");
        });
      });
    } },
    { name: "Equal welfare uses the alphabetical tiebreak even when all equilibrium outcomes coincide", run: function () {
      var solution = M.solve("CAB", "CBA");
      assert(solution.profiles.length === 256 && solution.profiles.every(function (p) { return p.welfareSum === 30; }), "All profiles give expected welfare 5");
      assert(solution.selected.key === "AAAAAAAA", "Alphabetical first among all 256 welfare ties");
    } },
    { name: "Invalid rankings, candidates, and impossible round ballots are rejected", run: function () {
      var p = M.solve("BCA", "CAB").selected;
      [function () { M.solve("AAC", "CAB"); }, function () { M.utility("ABC", "D"); },
        function () { M.majority(["A", "B", "C"]); }, function () { M.simulate(p, "ABC", { first: "C" }); },
        function () { M.simulate(p, "ABC", { first: "A", final: "B" }); }].forEach(function (call) {
        var threw = false;
        try { call(); } catch (_) { threw = true; }
        assert(threw, "Invalid input must throw");
      });
    } }
  ]);
})();
