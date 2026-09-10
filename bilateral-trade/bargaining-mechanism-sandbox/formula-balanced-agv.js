(function (global) {
  "use strict";

  var isFiniteNumber = global.NumberUtils.isFiniteNumber;
  var groups = global.BargainingSandboxAnalyticGroups || {};
  var dependencies = dependencyMap([
    ["q"], ["pB", "constant"], ["pS", "constant"],
    ["buyerIc", "constant"], ["sellerIc", "constant"],
    ["buyerPayoff", "constant"], ["sellerPayoff", "constant"],
    ["revenue"], ["efficiency"]
  ]);

  function dependencyMap(rows) {
    var result = {};
    rows.forEach(function (row) {
      result[row[0]] = Object.freeze(row.slice(1));
    });
    return Object.freeze(result);
  }

  function resolveConstant(value) {
    var resolved = value === undefined ? 0.25 : value;
    if (!isFiniteNumber(resolved)) {
      throw new TypeError("The AGV constant must be finite.");
    }
    if (Math.abs(resolved) > 1e140) {
      throw new RangeError(
        "The AGV constant must lie within the numerical diagnostic range."
      );
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

  function createAgvRule(constant) {
    var resolvedConstant = resolveConstant(constant);
    var payment = freezePolynomial([
      resolvedConstant, 0, 0, 0.5, 0, -0.5
    ]);
    var boundary = freezePolynomial([0, 1, -1]);
    return Object.freeze({
      representation: "formula-regions",
      family: "balanced-agv",
      preset: "agv",
      parameters: Object.freeze({ constant: resolvedConstant }),
      dependencies: dependencies,
      regions: Object.freeze([
        createRegion(
          "no-trade", "<", boundary,
          freezeFields([0], payment, payment)
        ),
        createRegion(
          "trade", ">=", boundary,
          freezeFields([1], payment, payment)
        )
      ])
    });
  }

  groups.balancedAgv = Object.freeze({
    createAgvRule: createAgvRule
  });
  global.BargainingSandboxAnalyticGroups = groups;
})(window);
