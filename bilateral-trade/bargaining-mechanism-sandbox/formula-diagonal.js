(function (global) {
  "use strict";

  var isFiniteNumber = global.NumberUtils.isFiniteNumber;
  var groups = global.BargainingSandboxAnalyticGroups || {};
  var emptyDependencies = dependencyMap([
    ["q"], ["pB"], ["pS"], ["buyerIc"], ["sellerIc"],
    ["buyerPayoff"], ["sellerPayoff"], ["revenue"], ["efficiency"]
  ]);
  var revenueDependencies = dependencyMap([
    ["q", "threshold"],
    ["pB", "threshold", "buyerMarkup"],
    ["pS", "threshold", "sellerDiscount"],
    ["buyerIc", "threshold", "buyerMarkup"],
    ["sellerIc", "threshold", "sellerDiscount"],
    ["buyerPayoff", "threshold", "buyerMarkup"],
    ["sellerPayoff", "threshold", "sellerDiscount"],
    ["revenue", "threshold", "buyerMarkup", "sellerDiscount"],
    ["efficiency", "threshold"]
  ]);
  var splitDependencies = dependencyMap([
    ["q", "threshold"],
    ["pB", "threshold", "sellerShare"],
    ["pS", "threshold", "sellerShare"],
    ["buyerIc", "threshold", "sellerShare"],
    ["sellerIc", "threshold", "sellerShare"],
    ["buyerPayoff", "threshold", "sellerShare"],
    ["sellerPayoff", "threshold", "sellerShare"],
    ["revenue"],
    ["efficiency", "threshold"]
  ]);

  function dependencyMap(rows) {
    var result = {};
    rows.forEach(function (row) {
      result[row[0]] = Object.freeze(row.slice(1));
    });
    return Object.freeze(result);
  }

  function resolveUnitParameter(value, defaultValue, label) {
    var resolved = value === undefined ? defaultValue : value;
    if (!isFiniteNumber(resolved)) {
      throw new TypeError("The " + label + " must be finite.");
    }
    if (resolved < 0 || resolved > 1) {
      throw new RangeError("The " + label + " must lie in [0, 1].");
    }
    return resolved;
  }

  function freezePolynomial(coefficients) {
    var result = new Array(6);
    var index;
    for (index = 0; index < 6; index += 1) {
      result[index] = coefficients[index] || 0;
    }
    return Object.freeze(result);
  }

  function freezeFields(q, pB, pS) {
    return Object.freeze({
      q: freezePolynomial(q),
      pB: freezePolynomial(pB),
      pS: freezePolynomial(pS)
    });
  }

  function createRegion(id, relation, boundary, fields) {
    return Object.freeze({
      id: id,
      boundary: Object.freeze({
        polynomial: boundary,
        relation: relation
      }),
      fields: fields
    });
  }

  function createDiagonalAffineRule(preset, threshold, buyerPayment,
      sellerPayment, parameters, dependencies, family) {
    var boundary = freezePolynomial([-threshold, 1, -1]);
    return Object.freeze({
      representation: "formula-regions",
      family: family || "diagonal-affine",
      preset: preset,
      parameters: Object.freeze(parameters),
      dependencies: dependencies,
      regions: Object.freeze([
        createRegion(
          "no-trade", "<", boundary,
          freezeFields([0], [0], [0])
        ),
        createRegion(
          "trade", ">=", boundary,
          freezeFields([1], buyerPayment, sellerPayment)
        )
      ])
    });
  }

  function createVcgRule() {
    return createDiagonalAffineRule(
      "vcg", 0, [0, 0, 1], [0, 1, 0],
      { threshold: 0 }, emptyDependencies
    );
  }

  function createSplitDifferenceRule(sellerShare, threshold) {
    var resolvedShare = resolveUnitParameter(
      sellerShare, 0.5, "seller share"
    );
    var resolvedThreshold = resolveUnitParameter(
      threshold, 0, "trading threshold"
    );
    var payment = [0, resolvedShare, 1 - resolvedShare];
    return createDiagonalAffineRule(
      "split-the-difference", resolvedThreshold, payment, payment,
      { threshold: resolvedThreshold, sellerShare: resolvedShare },
      splitDependencies
    );
  }

  function createChatterjeeSamuelsonRule() {
    return createDiagonalAffineRule(
      "chatterjee-samuelson", 0.25,
      [1 / 6, 1 / 3, 1 / 3], [1 / 6, 1 / 3, 1 / 3],
      { threshold: 0.25 }, emptyDependencies
    );
  }

  function createRevenueThresholdRule(threshold, buyerMarkup, sellerDiscount) {
    var resolvedThreshold = resolveUnitParameter(
      threshold, 0.5, "trading threshold"
    );
    var resolvedBuyerMarkup = resolveUnitParameter(
      buyerMarkup, 0.5, "buyer markup"
    );
    var resolvedSellerDiscount = resolveUnitParameter(
      sellerDiscount, 0.5, "seller discount"
    );
    return createDiagonalAffineRule(
      "revenue-threshold", resolvedThreshold,
      [resolvedBuyerMarkup, 0, 1], [-resolvedSellerDiscount, 1],
      {
        threshold: resolvedThreshold,
        buyerMarkup: resolvedBuyerMarkup,
        sellerDiscount: resolvedSellerDiscount
      },
      revenueDependencies,
      "revenue-threshold"
    );
  }

  groups.diagonalAffine = Object.freeze({
    revenueDependencies: revenueDependencies,
    createVcgRule: createVcgRule,
    createSplitDifferenceRule: createSplitDifferenceRule,
    createChatterjeeSamuelsonRule: createChatterjeeSamuelsonRule,
    createRevenueThresholdRule: createRevenueThresholdRule
  });
  global.BargainingSandboxAnalyticGroups = groups;
})(window);
