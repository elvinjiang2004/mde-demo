(function (global) {
  "use strict";

  var distributions = global.AuctionDistributions;
  var EPSILON = 1e-12;

  if (!distributions) {
    throw new Error(
      "AuctionDistributions must be loaded before the second-price model."
    );
  }

  function isFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
  }

  function clamp(value, lower, upper) {
    return Math.min(upper, Math.max(lower, value));
  }

  function normalizeDistribution(spec) {
    return distributions.normalizeSpec(spec);
  }

  function distributionValidation(a, b, spec) {
    var normalized;

    try {
      normalized = normalizeDistribution(spec);
      normalized = distributions.validate(a, b, normalized);
    } catch (error) {
      return {
        valid: false,
        errors: [error.message || "The distribution specification is invalid."],
        spec: null
      };
    }
    return {
      valid: true,
      errors: [],
      spec: normalized
    };
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
    } else if (!Number.isFinite(b - a)) {
      errors.push("The distance between a and b must be finite.");
    }

    var distribution = distributionValidation(a, b, spec);
    if (!distribution.valid) {
      errors = errors.concat(distribution.errors);
    }

    return {
      valid: errors.length === 0,
      errors: errors,
      distribution: distribution.spec
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
      errors: errors,
      distribution: result.distribution
    };
  }

  function requireValidAuction(n, a, b, spec) {
    var validation = validateAuction(n, a, b, spec);
    if (!validation.valid) {
      throw new RangeError(validation.errors.join(" "));
    }
    return validation.distribution;
  }

  function requireValidChoice(n, a, b, value, bid, spec) {
    var validation = validateChoice(n, a, b, value, bid, spec);
    if (!validation.valid) {
      throw new RangeError(validation.errors.join(" "));
    }
    return validation.distribution;
  }

  function truthfulBid(value, n, a, b, spec) {
    requireValidAuction(n, a, b, spec);
    if (!isFiniteNumber(value) || value < a - EPSILON || value > b + EPSILON) {
      throw new RangeError("Value must lie in [a, b].");
    }
    return clamp(value, a, b);
  }

  function highestOpponentBidCdf(bid, n, a, b, spec) {
    var normalized = requireValidAuction(n, a, b, spec);
    if (!isFiniteNumber(bid)) {
      throw new TypeError("Bid must be a finite number.");
    }
    return Math.pow(distributions.cdf(bid, a, b, normalized), n - 1);
  }

  function highestOpponentBidDensity(bid, n, a, b, spec) {
    var normalized = requireValidAuction(n, a, b, spec);
    if (!isFiniteNumber(bid)) {
      throw new TypeError("Bid must be a finite number.");
    }
    if (bid < a || bid > b) {
      return 0;
    }

    var probability = distributions.cdf(bid, a, b, normalized);
    var density = distributions.pdf(bid, a, b, normalized);
    var result = (n - 1) * Math.pow(probability, n - 2) * density;

    // A singular beta density can otherwise produce 0 * Infinity at a.
    // Use a one-sided value so graph sampling never receives NaN.
    if (Number.isNaN(result) && bid === a) {
      var interior = a + (b - a) * 1e-9;
      probability = distributions.cdf(interior, a, b, normalized);
      density = distributions.pdf(interior, a, b, normalized);
      result = (n - 1) * Math.pow(probability, n - 2) * density;
    }

    return result;
  }

  function winProbability(bid, n, a, b, spec) {
    return highestOpponentBidCdf(bid, n, a, b, spec);
  }

  function cdfIntegral(upper, n, a, b, normalized) {
    var boundedUpper = clamp(upper, a, b);
    if (boundedUpper <= a) {
      return 0;
    }
    return distributions.integrate(function (point) {
      return Math.pow(
        distributions.cdf(point, a, b, normalized),
        n - 1
      );
    }, a, boundedUpper);
  }

  function expectedPayment(bid, n, a, b, spec) {
    var normalized = requireValidAuction(n, a, b, spec);
    if (!isFiniteNumber(bid) || bid < a - EPSILON || bid > b + EPSILON) {
      throw new RangeError("Bid must lie in [a, b].");
    }

    var boundedBid = clamp(bid, a, b);
    var probability = Math.pow(
      distributions.cdf(boundedBid, a, b, normalized),
      n - 1
    );
    return boundedBid * probability -
      cdfIntegral(boundedBid, n, a, b, normalized);
  }

  function expectedPaymentIfWin(bid, n, a, b, spec) {
    var normalized = requireValidAuction(n, a, b, spec);
    if (!isFiniteNumber(bid) || bid < a - EPSILON || bid > b + EPSILON) {
      throw new RangeError("Bid must lie in [a, b].");
    }

    var boundedBid = clamp(bid, a, b);
    var focalCdf = distributions.cdf(boundedBid, a, b, normalized);
    var probability = Math.pow(focalCdf, n - 1);
    if (probability === 0) {
      return null;
    }

    // Conditional quantiles avoid cancellation in xG(x) - integral G when
    // the winning probability is positive but extremely small.
    return distributions.integrate(function (rank) {
      var opponentRank = focalCdf * Math.pow(rank, 1 / (n - 1));
      return distributions.quantile(opponentRank, a, b, normalized);
    }, 0, 1);
  }

  function expectedPayoff(value, bid, n, a, b, spec) {
    var normalized = requireValidChoice(n, a, b, value, bid, spec);
    var boundedBid = clamp(bid, a, b);
    var probability = Math.pow(
      distributions.cdf(boundedBid, a, b, normalized),
      n - 1
    );

    return (value - boundedBid) * probability +
      cdfIntegral(boundedBid, n, a, b, normalized);
  }

  function expectedPayoffIfWin(value, bid, n, a, b, spec) {
    requireValidChoice(n, a, b, value, bid, spec);
    var payment = expectedPaymentIfWin(bid, n, a, b, spec);
    return payment === null ? null : value - payment;
  }

  function payoffContributionDensity(value, opponentBid, n, a, b, spec) {
    requireValidAuction(n, a, b, spec);
    if (!isFiniteNumber(value) || value < a - EPSILON || value > b + EPSILON) {
      throw new RangeError("Value must lie in [a, b].");
    }
    var difference = value - opponentBid;
    var density = highestOpponentBidDensity(opponentBid, n, a, b, spec);
    if (difference === 0 && !Number.isFinite(density)) {
      return 0;
    }
    return difference * density;
  }

  function truthfulExpectedPayoff(value, n, a, b, spec) {
    var normalized = requireValidAuction(n, a, b, spec);
    if (!isFiniteNumber(value) || value < a - EPSILON || value > b + EPSILON) {
      throw new RangeError("Value must lie in [a, b].");
    }
    return cdfIntegral(clamp(value, a, b), n, a, b, normalized);
  }

  function outcomes(value, bid, n, a, b, spec) {
    var normalized = requireValidChoice(n, a, b, value, bid, spec);
    var boundedValue = clamp(value, a, b);
    var boundedBid = clamp(bid, a, b);
    var probability = winProbability(boundedBid, n, a, b, normalized);
    var payment = expectedPayment(boundedBid, n, a, b, normalized);
    var conditionalPayment = expectedPaymentIfWin(
      boundedBid,
      n,
      a,
      b,
      normalized
    );
    var payoff = expectedPayoff(
      boundedValue,
      boundedBid,
      n,
      a,
      b,
      normalized
    );

    return {
      n: n,
      a: a,
      b: b,
      distribution: normalized,
      value: boundedValue,
      bid: boundedBid,
      winProbability: probability,
      expectedPayment: payment,
      expectedPaymentIfWin: conditionalPayment,
      expectedPayoff: payoff,
      expectedPayoffIfWin: conditionalPayment === null ?
        null : boundedValue - conditionalPayment,
      truthfulBid: truthfulBid(boundedValue, n, a, b, normalized),
      truthfulExpectedPayoff: truthfulExpectedPayoff(
        boundedValue,
        n,
        a,
        b,
        normalized
      )
    };
  }

  function truthfulOutcomes(value, n, a, b, spec) {
    return outcomes(
      value,
      truthfulBid(value, n, a, b, spec),
      n,
      a,
      b,
      spec
    );
  }

  global.SPAModel = Object.freeze({
    EPSILON: EPSILON,
    clamp: clamp,
    validateAuction: validateAuction,
    validateChoice: validateChoice,
    truthfulBid: truthfulBid,
    highestOpponentBidCdf: highestOpponentBidCdf,
    highestOpponentBidDensity: highestOpponentBidDensity,
    winProbability: winProbability,
    expectedPayment: expectedPayment,
    expectedPaymentIfWin: expectedPaymentIfWin,
    expectedPayoff: expectedPayoff,
    expectedPayoffIfWin: expectedPayoffIfWin,
    payoffContributionDensity: payoffContributionDensity,
    truthfulExpectedPayoff: truthfulExpectedPayoff,
    outcomes: outcomes,
    truthfulOutcomes: truthfulOutcomes
  });
})(window);
