(function (global) {
  "use strict";

  var distributions = global.AuctionDistributions;
  var EPSILON = 1e-12;

  if (!distributions) {
    throw new Error(
      "AuctionDistributions must be loaded before the second-price model."
    );
  }

  var isFiniteNumber = global.NumberUtils.isFiniteNumber;
  var clamp = global.NumberUtils.clamp;

  function isUniformEquivalent(normalized) {
    return normalized.type === "uniform" ||
      (normalized.type === "beta" &&
        normalized.alpha === 1 && normalized.beta === 1);
  }

  function distributionValidation(a, b, spec) {
    var normalized;

    try {
      normalized = distributions.validate(a, b, spec);
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
    if (isUniformEquivalent(normalized)) {
      var z = (boundedUpper - a) / (b - a);
      return (b - a) * Math.pow(z, n) / n;
    }
    return distributions.integrate(function (point) {
      return Math.pow(
        distributions.cdf(point, a, b, normalized),
        n - 1
      );
    }, a, boundedUpper);
  }

  function conditionalExpectedPayment(
    boundedBid,
    n,
    a,
    b,
    normalized,
    focalCdf,
    probability
  ) {
    if (probability === 0) {
      return null;
    }
    if (isUniformEquivalent(normalized)) {
      return a + ((n - 1) / n) * (boundedBid - a);
    }

    // Conditional quantiles avoid cancellation in xG(x) - integral G when
    // the winning probability is positive but extremely small.
    return distributions.integrate(function (rank) {
      var opponentRank = focalCdf * Math.pow(rank, 1 / (n - 1));
      return distributions.quantile(opponentRank, a, b, normalized);
    }, 0, 1);
  }

  function expectedPaymentIfWin(bid, n, a, b, spec) {
    var normalized = requireValidAuction(n, a, b, spec);
    if (!isFiniteNumber(bid) || bid < a - EPSILON || bid > b + EPSILON) {
      throw new RangeError("Bid must lie in [a, b].");
    }

    var boundedBid = clamp(bid, a, b);
    var focalCdf = distributions.cdf(boundedBid, a, b, normalized);
    return conditionalExpectedPayment(
      boundedBid,
      n,
      a,
      b,
      normalized,
      focalCdf,
      Math.pow(focalCdf, n - 1)
    );
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
    var focalCdf = distributions.cdf(boundedBid, a, b, normalized);
    var probability = Math.pow(focalCdf, n - 1);
    var bidIntegral = cdfIntegral(boundedBid, n, a, b, normalized);
    var payment = boundedBid * probability - bidIntegral;
    var conditionalPayment = conditionalExpectedPayment(
      boundedBid,
      n,
      a,
      b,
      normalized,
      focalCdf,
      probability
    );
    var payoff = (boundedValue - boundedBid) * probability + bidIntegral;
    var truthfulPayoff = boundedValue === boundedBid ?
      bidIntegral :
      cdfIntegral(boundedValue, n, a, b, normalized);

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
      truthfulBid: boundedValue,
      truthfulExpectedPayoff: truthfulPayoff
    };
  }

  function truthfulOutcomes(value, n, a, b, spec) {
    return outcomes(value, value, n, a, b, spec);
  }

  global.SPAModel = Object.freeze({
    EPSILON: EPSILON,
    clamp: clamp,
    validateAuction: validateAuction,
    validateChoice: validateChoice,
    highestOpponentBidCdf: highestOpponentBidCdf,
    highestOpponentBidDensity: highestOpponentBidDensity,
    winProbability: winProbability,
    expectedPaymentIfWin: expectedPaymentIfWin,
    expectedPayoff: expectedPayoff,
    truthfulExpectedPayoff: truthfulExpectedPayoff,
    outcomes: outcomes,
    truthfulOutcomes: truthfulOutcomes
  });
})(window);
