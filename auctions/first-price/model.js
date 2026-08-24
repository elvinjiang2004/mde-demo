(function (global) {
  "use strict";

  var EPSILON = 1e-12;
  var ROOT_ITERATIONS = 20;
  var maximumBidCache = null;
  var inverseCache = null;

  function isFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
  }

  function clamp(value, lower, upper) {
    return Math.min(upper, Math.max(lower, value));
  }

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
      errors.push("The focal bidder's value must lie in [a, b].");
    }

    if (!isFiniteNumber(bid) || bid < a - EPSILON || bid > b + EPSILON) {
      errors.push("The focal bidder's bid must lie in [a, b].");
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
    if (boundedValue <= a + EPSILON) {
      return a;
    }

    if (isUniformEquivalent(spec)) {
      return a + ((n - 1) / n) * (boundedValue - a);
    }

    var exponent = n - 1;
    var probability = Math.pow(
      distributionCdf(boundedValue, a, b, spec),
      exponent
    );

    if (probability <= Number.MIN_VALUE) {
      return a;
    }

    var informationRent = integrate(function (candidate) {
      return Math.pow(
        distributionCdf(candidate, a, b, spec),
        exponent
      );
    }, a, boundedValue);

    return clamp(boundedValue - informationRent / probability, a, boundedValue);
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

    if (bid <= a + EPSILON) {
      return a;
    }

    var highestBid = maximumEquilibriumBid(n, a, b, spec);
    if (bid >= highestBid - EPSILON) {
      return b;
    }

    if (isUniformEquivalent(spec)) {
      return clamp(a + (n / (n - 1)) * (bid - a), a, b);
    }

    var lower = a;
    var upper = b;
    var key = auctionKey(n, a, b, spec);
    var candidate = 0.5 * (lower + upper);

    if (inverseCache && inverseCache.key === key) {
      if (bid > inverseCache.bid && inverseCache.bid < highestBid) {
        candidate = inverseCache.value + (b - inverseCache.value) *
          (bid - inverseCache.bid) / (highestBid - inverseCache.bid);
      } else if (bid < inverseCache.bid && inverseCache.bid > a) {
        candidate = a + (inverseCache.value - a) *
          (bid - a) / (inverseCache.bid - a);
      } else if (bid === inverseCache.bid) {
        return inverseCache.value;
      }
    }

    candidate = clamp(candidate, lower, upper);
    if (candidate <= lower || candidate >= upper) {
      candidate = 0.5 * (lower + upper);
    }
    /* The shared quadrature has 1e-8 default accuracy, so a tighter root
       residual would only repeat noisy integral evaluations. */
    var bidTolerance = 1e-8 * Math.max(1, b - a);
    var iteration;

    for (iteration = 0; iteration < ROOT_ITERATIONS; iteration += 1) {
      var candidateBid = equilibriumBid(candidate, n, a, b, spec);
      var difference = candidateBid - bid;

      if (Math.abs(difference) <= bidTolerance) {
        inverseCache = { key: key, bid: bid, value: candidate };
        return candidate;
      }

      if (difference < 0) {
        lower = candidate;
      } else {
        upper = candidate;
      }

      var percentile = distributionCdf(candidate, a, b, spec);
      var density = distributionPdf(candidate, a, b, spec);
      var derivative = percentile > 0 ?
        (n - 1) * density / percentile * (candidate - candidateBid) :
        NaN;
      var newtonCandidate = candidate - difference / derivative;

      if (Number.isFinite(newtonCandidate) &&
          newtonCandidate > lower && newtonCandidate < upper) {
        candidate = newtonCandidate;
      } else {
        candidate = 0.5 * (lower + upper);
      }
    }

    inverseCache = { key: key, bid: bid, value: candidate };
    return candidate;
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

    /*
     * If H(x)=F(beta^{-1}(x))^(n-1), the equilibrium ODE implies
     * H'(x)=H(x)/(beta^{-1}(x)-x). This avoids differentiating a
     * numerically inverted strategy in the interior of its support.
     */
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

    /* A finite forward average is used at a potentially singular endpoint. */
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
    return outcomes(value, bid, n, a, b, spec);
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
