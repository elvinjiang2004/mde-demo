(function () {
  "use strict";

  var DEFAULT_BETA_SHAPE = 1;
  var MIN_BETA_SHAPE = 0.2;
  var MAX_BETA_SHAPE = 10;
  var DEFAULT_INTEGRATION_TOLERANCE = 1e-8;

  var LANCZOS_COEFFICIENTS = [
    0.99999999999980993,
    676.5203681218851,
    -1259.1392167224028,
    771.32342877765313,
    -176.61502916214059,
    12.507343278686905,
    -0.13857109526572012,
    9.9843695780195716e-6,
    1.5056327351493116e-7
  ];

  var KRONROD_NODES = [
    0.9914553711208126,
    0.9491079123427585,
    0.8648644233597691,
    0.7415311855993945,
    0.5860872354676911,
    0.4058451513773972,
    0.2077849550078985,
    0
  ];

  var KRONROD_WEIGHTS = [
    0.02293532201052922,
    0.06309209262997855,
    0.10479001032225018,
    0.14065325971552592,
    0.1690047266392679,
    0.19035057806478542,
    0.20443294007529889,
    0.20948214108472783
  ];

  var GAUSS_WEIGHTS = [
    0.1294849661688697,
    0.27970539148927664,
    0.38183005050511894,
    0.4179591836734694
  ];

  function normalizeSpec(spec) {
    if (spec === undefined || spec === null) {
      return { type: "uniform" };
    }

    var type;
    if (typeof spec === "string") {
      type = spec;
      spec = {};
    } else if (typeof spec === "object" && !Array.isArray(spec)) {
      type = spec.type === undefined ? "uniform" : spec.type;
    } else {
      throw new TypeError("Distribution specification must be a string or object.");
    }

    if (typeof type !== "string") {
      throw new TypeError("Distribution type must be a string.");
    }
    type = type.trim().toLowerCase();

    if (type === "uniform") {
      return { type: "uniform" };
    }
    if (type === "beta") {
      return {
        type: "beta",
        alpha: spec.alpha === undefined ? DEFAULT_BETA_SHAPE : spec.alpha,
        beta: spec.beta === undefined ? DEFAULT_BETA_SHAPE : spec.beta
      };
    }
    throw new RangeError("Unsupported distribution type: " + type + ".");
  }

  function validate(a, b, spec) {
    if (typeof a !== "number" || typeof b !== "number" ||
        !Number.isFinite(a) || !Number.isFinite(b)) {
      throw new TypeError("Distribution bounds must be finite numbers.");
    }
    if (a < 0 || b <= a) {
      throw new RangeError("Distribution bounds must satisfy 0 <= a < b.");
    }

    var normalized = normalizeSpec(spec);
    if (normalized.type === "beta") {
      validateShape("alpha", normalized.alpha);
      validateShape("beta", normalized.beta);
    }
    return normalized;
  }

  function validateShape(name, value) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new TypeError(name + " must be a finite number.");
    }
    if (value < MIN_BETA_SHAPE || value > MAX_BETA_SHAPE) {
      throw new RangeError(
        name + " must be between " + MIN_BETA_SHAPE + " and " +
        MAX_BETA_SHAPE + "."
      );
    }
  }

  function cdf(x, a, b, spec) {
    var normalized = validate(a, b, spec);
    requireNumericArgument(x, "x");
    if (x <= a) {
      return 0;
    }
    if (x >= b) {
      return 1;
    }

    var z = (x - a) / (b - a);
    if (normalized.type === "uniform") {
      return z;
    }
    return regularizedIncompleteBeta(z, normalized.alpha, normalized.beta);
  }

  function pdf(x, a, b, spec) {
    var normalized = validate(a, b, spec);
    requireNumericArgument(x, "x");
    if (x < a || x > b) {
      return 0;
    }

    var width = b - a;
    if (normalized.type === "uniform") {
      return 1 / width;
    }

    var z = (x - a) / width;
    return betaDensityUnit(
      z,
      normalized.alpha,
      normalized.beta
    ) / width;
  }

  function quantile(p, a, b, spec) {
    var normalized = validate(a, b, spec);
    if (typeof p !== "number" || !Number.isFinite(p)) {
      throw new TypeError("p must be a finite number.");
    }
    if (p < 0 || p > 1) {
      throw new RangeError("p must lie between 0 and 1.");
    }
    if (p === 0) {
      return a;
    }
    if (p === 1) {
      return b;
    }
    if (normalized.type === "uniform") {
      return a + (b - a) * p;
    }

    var lower = 0;
    var upper = 1;
    var midpoint = 0.5;
    var iteration;
    for (iteration = 0; iteration < 160; iteration += 1) {
      midpoint = 0.5 * (lower + upper);
      var probability = regularizedIncompleteBeta(
        midpoint,
        normalized.alpha,
        normalized.beta
      );
      if (probability < p) {
        if (midpoint === lower) {
          break;
        }
        lower = midpoint;
      } else {
        if (midpoint === upper) {
          break;
        }
        upper = midpoint;
      }
    }
    return a + (b - a) * 0.5 * (lower + upper);
  }

  function integrate(fn, lo, hi, tolerance) {
    if (typeof fn !== "function") {
      throw new TypeError("The integrand must be a function.");
    }
    if (typeof lo !== "number" || typeof hi !== "number" ||
        !Number.isFinite(lo) || !Number.isFinite(hi)) {
      throw new TypeError("Integration bounds must be finite numbers.");
    }
    if (lo === hi) {
      return 0;
    }

    var allowedError = tolerance === undefined ?
      DEFAULT_INTEGRATION_TOLERANCE : tolerance;
    if (typeof allowedError !== "number" ||
        !Number.isFinite(allowedError) || allowedError <= 0) {
      throw new RangeError("Integration tolerance must be positive and finite.");
    }

    var sign = hi > lo ? 1 : -1;
    var lower = sign > 0 ? lo : hi;
    var upper = sign > 0 ? hi : lo;
    var halfWidth = 0.5 * (upper - lower);
    var lowerEndpointIsSingular;
    var upperEndpointIsSingular;

    function endpointRegularizedIntegrand(t) {
      var t2 = t * t;
      var t4 = t2 * t2;
      var t5 = t4 * t;
      var jacobian = 5 * halfWidth * t4;
      return regularizedSide(lower + halfWidth * t5, lower, true, t, jacobian) +
        regularizedSide(upper - halfWidth * t5, upper, false, t, jacobian);
    }

    function regularizedSide(x, endpoint, fromLower, t, jacobian) {
      var baseT = 0.02;
      if (t < baseT && endpointIsSingular(fromLower)) {
        return extrapolateRegularizedSide(t, fromLower, baseT);
      }
      var value = fn(x);
      if (Number.isFinite(value)) {
        return value * jacobian;
      }
      if (x !== endpoint) {
        throw new RangeError("Integrand must be finite inside the interval.");
      }

      return extrapolateRegularizedSide(t, fromLower, baseT);
    }

    function endpointIsSingular(fromLower) {
      var cached = fromLower ?
        lowerEndpointIsSingular : upperEndpointIsSingular;
      if (cached !== undefined) {
        return cached;
      }
      var endpoint = fromLower ? lower : upper;
      var singular;
      try {
        singular = !Number.isFinite(fn(endpoint));
      } catch (error) {
        singular = true;
      }
      if (fromLower) {
        lowerEndpointIsSingular = singular;
      } else {
        upperEndpointIsSingular = singular;
      }
      return singular;
    }

    function extrapolateRegularizedSide(t, fromLower, baseT) {
      var secondT = 2 * baseT;
      var baseValue = evaluateRegularizedSide(baseT, fromLower);
      var secondValue = evaluateRegularizedSide(secondT, fromLower);
      if (baseValue === 0) {
        return 0;
      }
      if (Number.isFinite(baseValue) && Number.isFinite(secondValue) &&
          secondValue !== 0 && Math.sign(baseValue) === Math.sign(secondValue)) {
        var exponent = Math.log(Math.abs(secondValue / baseValue)) / Math.log(2);
        if (Number.isFinite(exponent) && exponent > -1) {
          return baseValue * Math.pow(t / baseT, exponent);
        }
      }
      throw new RangeError("Integrand must be finite inside the interval.");
    }

    function evaluateRegularizedSide(t, fromLower) {
      var t2 = t * t;
      var t4 = t2 * t2;
      var t5 = t4 * t;
      var x = fromLower ?
        lower + halfWidth * t5 :
        upper - halfWidth * t5;
      return fn(x) * 5 * halfWidth * t4;
    }

    var result = adaptiveGaussKronrod(
      endpointRegularizedIntegrand,
      0,
      1,
      allowedError,
      18
    );
    return sign * result;
  }

  function adaptiveGaussKronrod(fn, lo, hi, tolerance, remainingDepth) {
    var estimate = gaussKronrodEstimate(fn, lo, hi);
    if (estimate.error <= tolerance || remainingDepth === 0) {
      return estimate.value;
    }
    var midpoint = 0.5 * (lo + hi);
    return adaptiveGaussKronrod(
      fn,
      lo,
      midpoint,
      tolerance / 2,
      remainingDepth - 1
    ) + adaptiveGaussKronrod(
      fn,
      midpoint,
      hi,
      tolerance / 2,
      remainingDepth - 1
    );
  }

  function gaussKronrodEstimate(fn, lo, hi) {
    var center = 0.5 * (lo + hi);
    var halfWidth = 0.5 * (hi - lo);
    var centerValue = fn(center);
    var kronrod = KRONROD_WEIGHTS[7] * centerValue;
    var gauss = GAUSS_WEIGHTS[3] * centerValue;
    var index;

    for (index = 0; index < 7; index += 1) {
      var offset = halfWidth * KRONROD_NODES[index];
      var pair = fn(center - offset) + fn(center + offset);
      kronrod += KRONROD_WEIGHTS[index] * pair;
      if (index === 1) {
        gauss += GAUSS_WEIGHTS[0] * pair;
      } else if (index === 3) {
        gauss += GAUSS_WEIGHTS[1] * pair;
      } else if (index === 5) {
        gauss += GAUSS_WEIGHTS[2] * pair;
      }
    }

    kronrod *= halfWidth;
    gauss *= halfWidth;
    return {
      value: kronrod,
      error: Math.abs(kronrod - gauss)
    };
  }

  function regularizedIncompleteBeta(x, alpha, beta) {
    if (x <= 0) {
      return 0;
    }
    if (x >= 1) {
      return 1;
    }

    var logFactor = logGamma(alpha + beta) - logGamma(alpha) -
      logGamma(beta) + alpha * Math.log(x) + beta * Math.log1p(-x);
    var factor = Math.exp(logFactor);
    var result;

    if (x < (alpha + 1) / (alpha + beta + 2)) {
      result = factor * betaContinuedFraction(alpha, beta, x) / alpha;
    } else {
      result = 1 - factor *
        betaContinuedFraction(beta, alpha, 1 - x) / beta;
    }
    return clampProbability(result);
  }

  function betaContinuedFraction(alpha, beta, x) {
    var maxIterations = 300;
    var epsilon = 3e-14;
    var minimum = 1e-300;
    var qab = alpha + beta;
    var qap = alpha + 1;
    var qam = alpha - 1;
    var c = 1;
    var d = 1 - qab * x / qap;
    if (Math.abs(d) < minimum) {
      d = minimum;
    }
    d = 1 / d;
    var fraction = d;
    var iteration;

    for (iteration = 1; iteration <= maxIterations; iteration += 1) {
      var even = 2 * iteration;
      var coefficient = iteration * (beta - iteration) * x /
        ((qam + even) * (alpha + even));
      d = 1 + coefficient * d;
      if (Math.abs(d) < minimum) {
        d = minimum;
      }
      c = 1 + coefficient / c;
      if (Math.abs(c) < minimum) {
        c = minimum;
      }
      d = 1 / d;
      fraction *= d * c;

      coefficient = -(alpha + iteration) * (qab + iteration) * x /
        ((alpha + even) * (qap + even));
      d = 1 + coefficient * d;
      if (Math.abs(d) < minimum) {
        d = minimum;
      }
      c = 1 + coefficient / c;
      if (Math.abs(c) < minimum) {
        c = minimum;
      }
      d = 1 / d;
      var change = d * c;
      fraction *= change;
      if (Math.abs(change - 1) < epsilon) {
        return fraction;
      }
    }
    throw new Error("Incomplete beta continued fraction did not converge.");
  }

  function betaDensityUnit(x, alpha, beta) {
    if (x === 0) {
      if (alpha < 1) {
        return Infinity;
      }
      if (alpha === 1) {
        return beta;
      }
      return 0;
    }
    if (x === 1) {
      if (beta < 1) {
        return Infinity;
      }
      if (beta === 1) {
        return alpha;
      }
      return 0;
    }
    return Math.exp(
      (alpha - 1) * Math.log(x) +
      (beta - 1) * Math.log1p(-x) -
      logBeta(alpha, beta)
    );
  }

  function logBeta(alpha, beta) {
    return logGamma(alpha) + logGamma(beta) - logGamma(alpha + beta);
  }

  function logGamma(value) {
    if (value < 0.5) {
      return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * value)) -
        logGamma(1 - value);
    }

    var shifted = value - 1;
    var sum = LANCZOS_COEFFICIENTS[0];
    var index;
    for (index = 1; index < LANCZOS_COEFFICIENTS.length; index += 1) {
      sum += LANCZOS_COEFFICIENTS[index] / (shifted + index);
    }
    var t = shifted + 7.5;
    return 0.5 * Math.log(2 * Math.PI) +
      (shifted + 0.5) * Math.log(t) - t + Math.log(sum);
  }

  function requireNumericArgument(value, name) {
    if (typeof value !== "number" || Number.isNaN(value)) {
      throw new TypeError(name + " must be a number.");
    }
  }

  function clampProbability(value) {
    return Math.max(0, Math.min(1, value));
  }

  window.AuctionDistributions = Object.freeze({
    normalizeSpec: normalizeSpec,
    validate: validate,
    cdf: cdf,
    pdf: pdf,
    quantile: quantile,
    integrate: integrate
  });
})();
