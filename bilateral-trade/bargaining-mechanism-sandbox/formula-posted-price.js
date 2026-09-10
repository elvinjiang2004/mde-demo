(function (global) {
  "use strict";

  var isFiniteNumber = global.NumberUtils.isFiniteNumber;
  var groups = global.BargainingSandboxAnalyticGroups || {};
  var dependencies = dependencyMap([
    ["q", "buyerPrice", "sellerPrice"],
    ["pB", "buyerPrice", "sellerPrice"],
    ["pS", "buyerPrice", "sellerPrice"],
    ["buyerIc", "buyerPrice", "sellerPrice"],
    ["sellerIc", "buyerPrice", "sellerPrice"],
    ["buyerPayoff", "buyerPrice", "sellerPrice"],
    ["sellerPayoff", "buyerPrice", "sellerPrice"],
    ["revenue", "buyerPrice", "sellerPrice"],
    ["efficiency", "buyerPrice", "sellerPrice"]
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

  function createRegion(id, relation, fields) {
    return Object.freeze({
      id: id,
      boundary: Object.freeze({
        polynomial: freezePolynomial([0]),
        relation: relation
      }),
      fields: fields
    });
  }

  function createPostedPriceRule(buyerPrice, sellerPrice) {
    var resolvedBuyerPrice = resolveUnitParameter(
      buyerPrice, 0.5, "posted buyer price"
    );
    var resolvedSellerPrice = resolveUnitParameter(
      sellerPrice, resolvedBuyerPrice, "posted seller price"
    );
    return Object.freeze({
      representation: "formula-regions",
      family: "posted-price",
      preset: "posted-price",
      parameters: Object.freeze({
        buyerPrice: resolvedBuyerPrice,
        sellerPrice: resolvedSellerPrice
      }),
      dependencies: dependencies,
      regions: Object.freeze([
        createRegion(
          "no-trade", "rectangle-complement",
          freezeFields([0], [0], [0])
        ),
        createRegion(
          "trade", "rectangle",
          freezeFields(
            [1], [resolvedBuyerPrice], [resolvedSellerPrice]
          )
        )
      ])
    });
  }

  groups.postedPrice = Object.freeze({
    createPostedPriceRule: createPostedPriceRule
  });
  global.BargainingSandboxAnalyticGroups = groups;
})(window);
