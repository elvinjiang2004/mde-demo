/* Jiang (September 2026, current draft 9), Sections 3-5 and Propositions 4-5.
   Both presets use direct reports and include lying costs in IC diagnostics.
   Analytic best reports and ex-post deviation bounds: see architecture.md. */
(function (global) {
  "use strict";
  var THRESHOLD_FACTOR = 1 - Math.cbrt(0.5);
  function positive(x) { return Math.max(0, x); }
  function validate(value, name) {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
      throw new RangeError(name + " must be a finite number in [0,1].");
    }
  }
  function reportTrace(support, kink, bestReport) {
    var types = [support[0], support[1]];
    if (kink > support[0] && kink < support[1]) { types.splice(1, 0, kink); }
    return Object.freeze(types.map(function (type) {
      return Object.freeze([type, bestReport(type)]);
    }));
  }
  function createRule(parameters, id) {
    // Keep the symmetric API for existing callers; the page uses separate costs.
    var gammaB = parameters.gammaB === undefined ? parameters.gamma : parameters.gammaB;
    var gammaS = parameters.gammaS === undefined ? parameters.gamma : parameters.gammaS;
    var k = parameters.k === undefined ? 0.5 : parameters.k;
    var epsilon = parameters.epsilon;
    validate(gammaB, "gammaB");
    validate(gammaS, "gammaS");
    validate(k, "k");
    validate(epsilon, "epsilon");
    var minimum = id === "minimum-rent";
    var a = 1 - epsilon;
    var b = 2 - epsilon;
    var buyerSupport = Object.freeze([0, 1]);
    var sellerSupport = Object.freeze([a, b]);
    var lengthB = positive(epsilon - gammaB);
    var lengthS = positive(epsilon - gammaS);
    var welfare = Math.pow(epsilon, 3) / 6;
    var buyerUtility = minimum ? Math.pow(lengthB, 3) / 6 : (1 - k) * welfare;
    var sellerUtility = minimum ? Math.pow(lengthS, 3) / 6 : k * welfare;
    // This scalar threshold is only a benchmark on the symmetric slice.
    var threshold = epsilon * THRESHOLD_FACTOR;
    // Factor 1-(1-lowCost)^3 before subtracting the other rent. Adding
    // a tiny positive rent to 1 would otherwise hide a real deficit.
    var lowCost = epsilon === 0 ? 0 : Math.min(1, Math.min(gammaB, gammaS) / epsilon);
    var highRent = epsilon === 0 ? 0 : Math.min(lengthB, lengthS) / epsilon;
    var normalizedBalance = lowCost * (3 - lowCost * (3 - lowCost)) - Math.pow(highRent, 3);
    var implementable = epsilon === 0 || (gammaB === gammaS ? gammaB >= threshold : normalizedBalance >= 0);
    var revenue = minimum ? welfare * normalizedBalance : 0;
    if (minimum && epsilon > 0 && gammaB === gammaS && gammaB < epsilon) {
      // Factor around the symmetric threshold, including literal equality.
      var root = 1 - THRESHOLD_FACTOR, rentRatio = lengthB / epsilon;
      revenue = 2 * welfare * ((gammaB - threshold) / epsilon) *
        (root * root + root * rentRatio + rentRatio * rentRatio);
    }
    var buyerBIC = minimum || gammaB >= k * epsilon;
    var sellerBIC = minimum || gammaS >= (1 - k) * epsilon;
    var buyerDSICThreshold = epsilon === 0 ? 0 : minimum ? 1 : k;
    var sellerDSICThreshold = epsilon === 0 ? 0 : minimum ? 1 : 1 - k;
    function q(v, c) { return v >= c ? 1 : 0; }
    function buyerAllocation(v) { return positive(v - a); }
    function sellerAllocation(c) { return positive(1 - c); }
    // These are truthful interim utilities; only the first preset minimizes them.
    function buyerRent(v) {
      return minimum ? Math.pow(positive(v - a - gammaB), 2) / 2 : (1 - k) * Math.pow(buyerAllocation(v), 2) / 2;
    }
    function sellerRent(c) {
      return minimum ? Math.pow(positive(1 - c - gammaS), 2) / 2 : k * Math.pow(sellerAllocation(c), 2) / 2;
    }
    function pB(v, c) { return minimum ? v * q(v, c) - buyerRent(v) : (k * v + (1 - k) * c) * q(v, c); }
    function pS(v, c) { return minimum ? c * q(v, c) + sellerRent(c) : (k * v + (1 - k) * c) * q(v, c); }
    function buyerPayoff(v, c) { return minimum ? buyerRent(v) : (1 - k) * positive(v - c); }
    function sellerPayoff(v, c) { return minimum ? sellerRent(c) : k * positive(v - c); }
    function buyerPayment(v) { return v * buyerAllocation(v) - buyerRent(v); }
    function sellerPayment(c) { return c * sellerAllocation(c) + sellerRent(c); }
    function buyerDeviation(v, r) {
      return (v - r) * buyerAllocation(r) + buyerRent(r) - gammaB * Math.abs(v - r);
    }
    function sellerDeviation(c, s) {
      return (s - c) * sellerAllocation(s) + sellerRent(s) - gammaS * Math.abs(c - s);
    }
    function buyerExPostDeviation(v, r, c) {
      return (v - r) * q(r, c) + buyerPayoff(r, c) - gammaB * Math.abs(v - r);
    }
    function sellerExPostDeviation(c, s, v) {
      return (s - c) * q(v, s) + sellerPayoff(v, s) - gammaS * Math.abs(c - s);
    }
    function buyerBestReport(v) { return minimum ? v : v - positive(k * (v - a) - gammaB) / (1 + k); }
    function sellerBestReport(c) { return minimum ? c : c + positive((1 - k) * (1 - c) - gammaS) / (2 - k); }
    var totals = Object.freeze({
      tradeProbability: epsilon * epsilon / 2,
      welfare: welfare, buyerUtility: buyerUtility, sellerUtility: sellerUtility,
      buyerPayment: minimum ? epsilon * epsilon / 2 - welfare - buyerUtility :
        epsilon * epsilon / 2 - (2 - k) * welfare,
      sellerPayment: minimum ? epsilon * epsilon / 2 - 2 * welfare + sellerUtility :
        epsilon * epsilon / 2 - (2 - k) * welfare,
      revenue: revenue, threshold: threshold,
      // Allocation implementability is independent of the selected payment rule.
      implementable: implementable,
      implementsEfficientAllocation: buyerBIC && sellerBIC && (!minimum || implementable),
      exAnteBB: !minimum || implementable,
      exPostBB: !minimum || (gammaB >= epsilon && gammaS >= epsilon),
      largestDeficit: minimum ? Math.max(lengthB * lengthB, lengthS * lengthS) / 2 : 0,
      buyerBIC: buyerBIC, sellerBIC: sellerBIC,
      buyerBICThreshold: minimum ? 0 : k * epsilon,
      sellerBICThreshold: minimum ? 0 : (1 - k) * epsilon,
      buyerDSIC: gammaB >= buyerDSICThreshold, sellerDSIC: gammaS >= sellerDSICThreshold,
      buyerDSICThreshold: buyerDSICThreshold, sellerDSICThreshold: sellerDSICThreshold,
      buyerMaximumInterimGain: minimum ? 0 : Math.pow(positive(k * epsilon - gammaB), 2) / (2 * (1 + k)),
      sellerMaximumInterimGain: minimum ? 0 : Math.pow(positive((1 - k) * epsilon - gammaS), 2) / (2 * (2 - k)),
      buyerMaximumExPostGain: minimum ? (1 - gammaB) * epsilon - lengthB * lengthB / 2 : positive(k - gammaB) * epsilon,
      sellerMaximumExPostGain: minimum ? (1 - gammaS) * epsilon - lengthS * lengthS / 2 : positive(1 - k - gammaS) * epsilon,
      buyerInterimIR: true, sellerInterimIR: true,
      buyerExPostIR: true, sellerExPostIR: true,
      expectedEfficiencyLoss: 0, largestEfficiencyLoss: 0
    });
    function field(name, x, y) {
      switch (name) {
        case "q": return q(x, y);
        case "pB": return pB(x, y);
        case "pS": return pS(x, y);
        case "buyerIC": return buyerDeviation(x, y);
        case "sellerIC": return sellerDeviation(x, y);
        case "revenue": return minimum ? (x - y) * q(x, y) - buyerRent(x) - sellerRent(y) : 0;
        case "buyerPayoff": return buyerPayoff(x, y);
        case "sellerPayoff": return sellerPayoff(x, y);
        case "efficiency": return 0;
        default: throw new Error("Unknown field: " + name);
      }
    }
    return Object.freeze({
      id: id, gammaB: gammaB, gammaS: gammaS, k: k, epsilon: epsilon,
      buyerSupport: buyerSupport, sellerSupport: sellerSupport,
      q: q, pB: pB, pS: pS, buyerAllocation: buyerAllocation, sellerAllocation: sellerAllocation,
      buyerRent: buyerRent, sellerRent: sellerRent,
      buyerPayment: buyerPayment, sellerPayment: sellerPayment,
      buyerDeviation: buyerDeviation, sellerDeviation: sellerDeviation,
      buyerExPostDeviation: buyerExPostDeviation, sellerExPostDeviation: sellerExPostDeviation,
      buyerBestReport: buyerBestReport, sellerBestReport: sellerBestReport,
      buyerBestReportTrace: reportTrace(buyerSupport, minimum || k === 0 ? undefined : a + gammaB / k, buyerBestReport),
      sellerBestReportTrace: reportTrace(sellerSupport, minimum || k === 1 ? undefined : 1 - gammaS / (1 - k), sellerBestReport),
      field: field, totals: totals
    });
  }
  var presets = Object.freeze({
    "minimum-rent": Object.freeze({ label: "Minimum-rent efficient mechanism", create: function (parameters) {
      return createRule(parameters, "minimum-rent");
    } }),
    "split-the-difference": Object.freeze({ label: "k-Double-Auction", create: function (parameters) {
      return createRule(parameters, "split-the-difference");
    } })
  });
  global.LyingCostModel = Object.freeze({
    thresholdFactor: THRESHOLD_FACTOR, presets: presets,
    create: function (parameters, preset) {
      var definition = presets[preset || "minimum-rent"];
      if (!definition) { throw new Error("Unknown preset."); }
      return definition.create(parameters);
    }
  });
})(window);
