(function (global) {
  "use strict";

  var RANKINGS = Object.freeze(["ABC", "ACB", "BAC", "BCA", "CAB", "CBA"]);
  var cache = Object.create(null);

  function ranking(value) {
    if (RANKINGS.indexOf(value) < 0) { throw new Error("Choose a strict ranking of A, B, and C."); }
    return value;
  }

  function candidate(value) {
    if (["A", "B", "C"].indexOf(value) < 0) { throw new Error("Unknown candidate."); }
    return value;
  }

  function utility(type, result) {
    return 2 - ranking(type).indexOf(candidate(result));
  }

  function preferred(type, first, second) {
    ranking(type);
    candidate(first);
    candidate(second);
    return type.indexOf(first) < type.indexOf(second) ? first : second;
  }

  function majority(ballots) {
    if (!Array.isArray(ballots) || ballots.length !== 3) {
      throw new Error("A ballot is required from each of three voters.");
    }
    ballots.forEach(candidate);
    if (ballots[0] === ballots[1] || ballots[0] === ballots[2]) { return ballots[0]; }
    if (ballots[1] === ballots[2]) { return ballots[1]; }
    throw new Error("A round must compare only two candidates.");
  }

  function finalBallots(types, survivor) {
    return types.map(function (type) { return preferred(type, survivor, "C"); });
  }

  function outcome(types, first) {
    return majority(finalBallots(types, majority(first)));
  }

  function opposite(vote) { return vote === "A" ? "B" : "A"; }

  function isEquilibrium(publicTypes, first) {
    var totals = [0, 0];
    var deviatingTotals = [0, 0];
    var index;
    for (index = 0; index < RANKINGS.length; index += 1) {
      var type = RANKINGS[index];
      var types = [type].concat(publicTypes);
      var ballots = [first.voter1[index], first.voter2, first.voter3];
      var winner = outcome(types, ballots);
      if (utility(type, outcome(types, [opposite(ballots[0]), ballots[1], ballots[2]])) >
          utility(type, winner)) { return false; }
      [1, 2].forEach(function (voter) {
        var deviation = ballots.slice();
        deviation[voter] = opposite(deviation[voter]);
        totals[voter - 1] += utility(types[voter], winner);
        deviatingTotals[voter - 1] += utility(types[voter], outcome(types, deviation));
      });
    }
    return totals.every(function (total, voter) { return total >= deviatingTotals[voter]; });
  }

  function compareProfiles(left, right) {
    if (left.welfareSum !== right.welfareSum) { return right.welfareSum - left.welfareSum; }
    return left.key < right.key ? -1 : (left.key > right.key ? 1 : 0);
  }

  function solve(voter2, voter3) {
    var publicTypes = Object.freeze([ranking(voter2), ranking(voter3)]);
    var publicKey = publicTypes.join("/");
    if (cache[publicKey]) { return cache[publicKey]; }
    var profiles = [];
    ["A", "B"].forEach(function (second) {
      ["A", "B"].forEach(function (third) {
        var mask;
        for (mask = 0; mask < 64; mask += 1) {
          var first = {
            voter1: RANKINGS.map(function (_, index) { return (mask & (1 << index)) ? "B" : "A"; }),
            voter2: second,
            voter3: third
          };
          if (!isEquilibrium(publicTypes, first)) { continue; }
          var key = second + third + first.voter1.join("");
          var outcomes = RANKINGS.map(function (type, index) {
            return outcome([type].concat(publicTypes), [first.voter1[index], second, third]);
          });
          // Six equally likely types: keep six times expected welfare exact.
          var welfareSum = outcomes.reduce(function (sum, winner, index) {
            return sum + utility(RANKINGS[index], winner) +
              utility(publicTypes[0], winner) + utility(publicTypes[1], winner);
          }, 0);
          Object.freeze(first.voter1);
          profiles.push(Object.freeze({
            id: publicKey + ":" + key,
            key: key,
            publicRankings: publicTypes,
            first: Object.freeze(first),
            outcomes: Object.freeze(outcomes),
            welfareSum: welfareSum
          }));
        }
      });
    });
    profiles.sort(compareProfiles);
    if (!profiles.length) { throw new Error("No equilibrium found for this public configuration."); }
    var maps = Object.create(null);
    profiles.forEach(function (profile) { maps[profile.outcomes.join("")] = true; });
    cache[publicKey] = Object.freeze({
      publicRankings: publicTypes,
      profiles: Object.freeze(profiles),
      selected: profiles[0],
      outcomeMapCount: Object.keys(maps).length
    });
    return cache[publicKey];
  }

  // A report supplies the simulated type, never the utility used to assess it.
  // Optional own ballots let indirect play depart from the selected plan.
  function simulate(profile, type, ownVotes) {
    var typeIndex = RANKINGS.indexOf(ranking(type));
    var types = [type].concat(profile.publicRankings);
    var overrides = ownVotes || {};
    var firstVote = overrides.first === undefined ? profile.first.voter1[typeIndex] : overrides.first;
    if (firstVote !== "A" && firstVote !== "B") { throw new Error("Round one requires A or B."); }
    var first = [firstVote, profile.first.voter2, profile.first.voter3];
    var survivor = majority(first);
    var final = finalBallots(types, survivor);
    if (overrides.final !== undefined) {
      if (overrides.final !== survivor && overrides.final !== "C") {
        throw new Error("Vote for one of the finalists.");
      }
      final[0] = overrides.final;
    }
    return Object.freeze({
      first: Object.freeze({ ballots: Object.freeze(first), winner: survivor }),
      final: Object.freeze({ ballots: Object.freeze(final), winner: majority(final) })
    });
  }

  global.RevelationPrincipleModel = Object.freeze({
    rankings: RANKINGS,
    utility: utility,
    preferred: preferred,
    majority: majority,
    solve: solve,
    simulate: simulate
  });
})(window);
