(function (global) {
  "use strict";

  var EPSILON = 1e-12;
  var ROOT_ITERATIONS = 100;
  var PROBABILITY_TOLERANCE = 1e-10;
  var maximumBidCache = null;

  var isFiniteNumber = global.NumberUtils.isFiniteNumber;
  var clamp = global.NumberUtils.clamp;

  function distributions() {
    if (!global.AuctionDistributions) {
      throw new Error(
        "AuctionDistributions must be loaded before the first-price model."
      );
    }
    return global.AuctionDistributions;
  }

  function normalizeDistribution(spec) {
    return distributions().normalizeSpec(spec);
  }

  function isUniformEquivalent(spec) {
    var normalized = normalizeDistribution(spec);
    var kind = normalized.type;

    if (kind === "uniform") {
      return true;
    }

    return kind === "beta" &&
      normalized.alpha === 1 &&
      normalized.beta === 1;
  }

  function auctionKey(n, a, b, spec) {
    var normalized = normalizeDistribution(spec);
    return [
      n,
      a,
      b,
      normalized.type,
      normalized.alpha === undefined ? "" : normalized.alpha,
      normalized.beta === undefined ? "" : normalized.beta
    ].join("|");
  }

  function validateAuction(n, a, b, spec) {
    var errors = [];

    if (!Number.isInteger(n) || n < 2) {
      errors.push("The number of bidders must be an integer of at least 2.");
    }

    if (!isFiniteNumber(a) || !isFiniteNumber(b)) {
      errors.push("The distribution bounds must be finite numbers.");
    } else if (a < 0) {
      errors.push("The lower bound a must be nonnegative.");
    } else if (!(b > a)) {
      errors.push("The upper bound b must be strictly greater than the lower bound a.");
    }

    if (errors.length === 0) {
      try {
        distributions().validate(a, b, spec);
      } catch (error) {
        errors.push(error && error.message ?
          error.message :
          "The distribution specification is invalid.");
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors
    };
  }

  function validateChoice(n, a, b, value, bid, spec) {
    var result = validateAuction(n, a, b, spec);
    var errors = result.errors.slice();

    if (!isFiniteNumber(value) || value < a - EPSILON || value > b + EPSILON) {
      errors.push("Bidder 1's value must lie in [a, b].");
    }

    if (!isFiniteNumber(bid) || bid < a - EPSILON || bid > b + EPSILON) {
      errors.push("Bidder 1's bid must lie in [a, b].");
    }

    return {
      valid: errors.length === 0,
      errors: errors
    };
  }

  function requireValidAuction(n, a, b, spec) {
    var validation = validateAuction(n, a, b, spec);
    if (!validation.valid) {
      throw new RangeError(validation.errors.join(" "));
    }
  }

  function requireValidChoice(n, a, b, value, bid, spec) {
    var validation = validateChoice(n, a, b, value, bid, spec);
    if (!validation.valid) {
      throw new RangeError(validation.errors.join(" "));
    }
  }

  function distributionCdf(value, a, b, spec) {
    return clamp(distributions().cdf(value, a, b, spec), 0, 1);
  }

  function distributionPdf(value, a, b, spec) {
    return distributions().pdf(value, a, b, spec);
  }

  function integrate(integrand, lower, upper) {
    if (upper <= lower) {
      return 0;
    }
    return distributions().integrate(integrand, lower, upper);
  }

  function equilibriumBid(value, n, a, b, spec) {
    requireValidAuction(n, a, b, spec);
    if (!isFiniteNumber(value) || value < a - EPSILON || value > b + EPSILON) {
      throw new RangeError("Value must lie in [a, b].");
    }

    var boundedValue = clamp(value, a, b);
    if (boundedValue === a) {
      return a;
    }

    if (isUniformEquivalent(spec)) {
      return a + ((n - 1) / n) * (boundedValue - a);
    }

    var exponent = n - 1;
    var width = boundedValue - a;
    var position = width / (b - a);
    var percentile = distributionCdf(position, 0, 1, spec);
    if (percentile === 0) {
      return a;
    }

    // Scale both the interval and G by their endpoint values. An absolute
    // quadrature tolerance on a tiny unscaled integral loses tail accuracy.
    var rentFraction = integrate(function (fraction) {
      return Math.pow(distributionCdf(position * fraction, 0, 1, spec) / percentile, exponent);
    }, 0, 1);

    return clamp(a + width * (1 - rentFraction), a, boundedValue);
  }

  function maximumEquilibriumBid(n, a, b, spec) {
    requireValidAuction(n, a, b, spec);
    var key = auctionKey(n, a, b, spec);
    if (maximumBidCache && maximumBidCache.key === key) {
      return maximumBidCache.value;
    }
    var value = equilibriumBid(b, n, a, b, spec);
    maximumBidCache = { key: key, value: value };
    return value;
  }

  function opponentValueCutoff(bid, n, a, b, spec) {
    requireValidAuction(n, a, b, spec);
    if (!isFiniteNumber(bid)) {
      throw new TypeError("Bid must be a finite number.");
    }

    if (bid <= a) {
      return a;
    }

    var highestBid = maximumEquilibriumBid(n, a, b, spec);
    if (bid >= highestBid) {
      return b;
    }

    if (isUniformEquivalent(spec)) {
      return clamp(a + (n / (n - 1)) * (bid - a), a, b);
    }

    var span = b - a, target = (bid - a) / span;
    var lower = 0, upper = 1, lowerProbability = 0, upperProbability = 1;
    var candidate = (bid - a) / (highestBid - a);
    var iteration;

    for (iteration = 0; iteration < ROOT_ITERATIONS; iteration += 1) {
      var value = a + span * candidate;
      var candidateBid = equilibriumBid(candidate, n, 0, 1, spec);
      var difference = candidateBid - target;
      var percentile = distributionCdf(candidate, 0, 1, spec);
      var probability = Math.pow(percentile, n - 1);

      if (difference === 0) { return value; }

      if (difference < 0) {
        lower = candidate; lowerProbability = probability;
      } else {
        upper = candidate; upperProbability = probability;
      }
      // A small bid residual alone is unsafe at singular Beta endpoints.
      // The probability bracket controls the quantity used by the demo.
      if (upperProbability - lowerProbability <= PROBABILITY_TOLERANCE) {
        return a + span * (lower + upper) / 2;
      }

      var density = distributionPdf(candidate, 0, 1, spec);
      var derivative = percentile > 0 ?
        (n - 1) * density / percentile * (candidate - candidateBid) :
        NaN;
      var newtonCandidate = candidate - difference / derivative;

      if (Number.isFinite(newtonCandidate) &&
          newtonCandidate > lower && newtonCandidate < upper) {
        candidate = newtonCandidate;
      } else {
        var middle = 0.5 * (lower + upper);
        if (middle === lower || middle === upper) { return value; }
        candidate = middle;
      }
    }

    return a + span * candidate;
  }

  function winProbability(bid, n, a, b, spec) {
    var cutoff = opponentValueCutoff(bid, n, a, b, spec);
    var percentile = distributionCdf(cutoff, a, b, spec);
    return clamp(Math.pow(percentile, n - 1), 0, 1);
  }

  function generalHighestOpponentBidDensity(bid, n, a, b, spec) {
    var highestBid = maximumEquilibriumBid(n, a, b, spec);
    if (bid < a - EPSILON || bid > highestBid + EPSILON) {
      return 0;
    }

    if (bid > a + EPSILON) {
      var cutoff = opponentValueCutoff(bid, n, a, b, spec);
      var probability = Math.pow(
        distributionCdf(cutoff, a, b, spec),
        n - 1
      );
      var gap = cutoff - bid;

      if (gap > EPSILON * Math.max(1, Math.abs(cutoff), Math.abs(bid))) {
        return probability / gap;
      }
    }

    var supportLength = highestBid - a;
    if (supportLength <= EPSILON) {
      return 0;
    }
    var step = Math.max(supportLength * 1e-6, EPSILON * Math.max(1, b));
    var right = Math.min(highestBid, a + step);
    var slope = winProbability(right, n, a, b, spec) / (right - a);
    return Number.isFinite(slope) && slope >= 0 ? slope : 0;
  }

  function highestOpponentBidDensity(bid, n, a, b, spec) {
    requireValidAuction(n, a, b, spec);
    if (!isFiniteNumber(bid)) {
      throw new TypeError("Bid must be a finite number.");
    }

    var upper = maximumEquilibriumBid(n, a, b, spec);
    if (bid < a - EPSILON || bid > upper + EPSILON) {
      return 0;
    }

    if (isUniformEquivalent(spec)) {
      var supportLength = upper - a;
      if (n === 2) {
        return 1 / supportLength;
      }

      var position = clamp((bid - a) / supportLength, 0, 1);
      return ((n - 1) / supportLength) * Math.pow(position, n - 2);
    }

    return generalHighestOpponentBidDensity(bid, n, a, b, spec);
  }

  function expectedPayoff(value, bid, n, a, b, spec) {
    requireValidChoice(n, a, b, value, bid, spec);
    return (value - bid) * winProbability(bid, n, a, b, spec);
  }

  function outcomes(value, bid, n, a, b, spec) {
    requireValidChoice(n, a, b, value, bid, spec);

    var boundedValue = clamp(value, a, b);
    var boundedBid = clamp(bid, a, b);
    var cutoff = opponentValueCutoff(boundedBid, n, a, b, spec);
    return outcomesAtCutoff(boundedValue, boundedBid, cutoff, n, a, b, spec);
  }

  function outcomesAtCutoff(boundedValue, boundedBid, cutoff, n, a, b, spec) {
    var probability = clamp(Math.pow(
      distributionCdf(cutoff, a, b, spec), n - 1
    ), 0, 1);
    var paymentIfWin = boundedBid;
    var surplusIfWin = boundedValue - boundedBid;

    return {
      n: n,
      a: a,
      b: b,
      distribution: normalizeDistribution(spec),
      value: boundedValue,
      bid: boundedBid,
      winProbability: probability,
      paymentIfWin: paymentIfWin,
      surplusIfWin: surplusIfWin,
      expectedPayment: paymentIfWin * probability,
      expectedPayoff: surplusIfWin * probability,
      opponentValueCutoff: cutoff,
      maximumEquilibriumBid: maximumEquilibriumBid(n, a, b, spec)
    };
  }

  function equilibriumOutcomes(value, n, a, b, spec) {
    var bid = equilibriumBid(value, n, a, b, spec);
    var cutoff = clamp(value, a, b);
    return outcomesAtCutoff(cutoff, bid, cutoff, n, a, b, spec);
  }

  global.FPAModel = Object.freeze({
    EPSILON: EPSILON,
    clamp: clamp,
    validateAuction: validateAuction,
    validateChoice: validateChoice,
    equilibriumBid: equilibriumBid,
    maximumEquilibriumBid: maximumEquilibriumBid,
    opponentValueCutoff: opponentValueCutoff,
    winProbability: winProbability,
    highestOpponentBidDensity: highestOpponentBidDensity,
    expectedPayoff: expectedPayoff,
    outcomes: outcomes,
    equilibriumOutcomes: equilibriumOutcomes
  });
})(window);
