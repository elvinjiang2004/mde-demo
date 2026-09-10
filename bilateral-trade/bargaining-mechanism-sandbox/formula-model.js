(function (global) {
  "use strict";

  var VERDICT_TOLERANCE = 1e-7;
  var ALGEBRA_TOLERANCE = 1e-12;
  var POLYNOMIAL_LENGTH = 6;
  var clamp = global.NumberUtils.clamp;
  var isFiniteNumber = global.NumberUtils.isFiniteNumber;
  var analyticGroups = Object.freeze(global.BargainingSandboxAnalyticGroups);
  var diagonalGroup = analyticGroups.diagonalAffine;
  var postedPriceGroup = analyticGroups.postedPrice;
  var balancedAgvGroup = analyticGroups.balancedAgv;
  var FIELD_DEPENDENCIES = diagonalGroup.revenueDependencies;
  var createVcgRule = diagonalGroup.createVcgRule;
  var createPostedPriceRule = postedPriceGroup.createPostedPriceRule;
  var createAgvRule = balancedAgvGroup.createAgvRule;
  var createSplitDifferenceRule = diagonalGroup.createSplitDifferenceRule;
  var createChatterjeeSamuelsonRule =
    diagonalGroup.createChatterjeeSamuelsonRule;
  var createRevenueThresholdRule = diagonalGroup.createRevenueThresholdRule;

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

  function validateUnitValue(value, label) {
    return resolveUnitParameter(value, undefined, label);
  }

  function resolveFiniteParameter(value, defaultValue, label) {
    var resolved = value === undefined ? defaultValue : value;
    if (!isFiniteNumber(resolved)) {
      throw new TypeError("The " + label + " must be finite.");
    }
    if (Math.abs(resolved) > 1e140) {
      throw new RangeError(
        "The " + label + " must lie within the numerical diagnostic range."
      );
    }
    return resolved;
  }

  function validateRule(rule) {
    var families = [
      "revenue-threshold", "diagonal-affine", "posted-price", "balanced-agv"
    ];
    if (!rule || rule.representation !== "formula-regions" ||
        families.indexOf(rule.family) < 0 || !rule.parameters ||
        !rule.dependencies || !Array.isArray(rule.regions) ||
        rule.regions.length !== 2) {
      throw new TypeError("Expected a supported formula-region rule.");
    }
    if (rule.family === "revenue-threshold") {
      resolveUnitParameter(
        rule.parameters.threshold, undefined, "trading threshold"
      );
      resolveUnitParameter(
        rule.parameters.buyerMarkup, undefined, "buyer markup"
      );
      resolveUnitParameter(
        rule.parameters.sellerDiscount, undefined, "seller discount"
      );
    } else if (rule.family === "diagonal-affine") {
      resolveUnitParameter(
        rule.parameters.threshold, undefined, "trading threshold"
      );
      if (rule.parameters.sellerShare !== undefined) {
        resolveUnitParameter(
          rule.parameters.sellerShare, undefined, "seller share"
        );
      }
    } else if (rule.family === "posted-price") {
      resolveUnitParameter(
        rule.parameters.buyerPrice, undefined, "posted buyer price"
      );
      resolveUnitParameter(
        rule.parameters.sellerPrice, undefined, "posted seller price"
      );
    } else {
      resolveFiniteParameter(rule.parameters.constant, undefined, "AGV constant");
    }
    return rule;
  }

  function evaluatePolynomial(coefficients, v, c) {
    return (coefficients[0] || 0) +
      (coefficients[1] || 0) * v +
      (coefficients[2] || 0) * c +
      (coefficients[3] || 0) * v * v +
      (coefficients[4] || 0) * v * c +
      (coefficients[5] || 0) * c * c;
  }

  function tradesAt(threshold, v, c) {
    if (threshold === 1) {
      return v === 1 && c === 0;
    }
    return v >= c + threshold;
  }

  function regionAt(rule, v, c) {
    validateRule(rule);
    var boundedV = validateUnitValue(v, "buyer value");
    var boundedC = validateUnitValue(c, "seller value");
    return rule.regions[tradeAt(rule, boundedV, boundedC) ? 1 : 0];
  }

  function tradeAt(rule, v, c) {
    if (rule.family === "posted-price") {
      return v >= rule.parameters.buyerPrice &&
        c <= rule.parameters.sellerPrice;
    }
    if (rule.family === "balanced-agv") {
      return v >= c;
    }
    return tradesAt(rule.parameters.threshold, v, c);
  }

  function fieldValueAt(rule, field, v, c) {
    if (field !== "q" && field !== "pB" && field !== "pS") {
      throw new RangeError("The field must be q, pB, or pS.");
    }
    var region = regionAt(rule, v, c);
    return evaluatePolynomial(region.fields[field], v, c);
  }

  function fieldEvaluator(rule, field) {
    validateRule(rule);
    if (field !== "q" && field !== "pB" && field !== "pS") {
      throw new RangeError("The field must be q, pB, or pS.");
    }
    var noTradePolynomial = rule.regions[0].fields[field];
    var tradePolynomial = rule.regions[1].fields[field];
    var family = rule.family;
    var threshold = rule.parameters.threshold;
    var buyerPrice = rule.parameters.buyerPrice;
    var sellerPrice = rule.parameters.sellerPrice;
    return function (v, c) {
      var trades = family === "posted-price" ?
        v >= buyerPrice && c <= sellerPrice :
        (family === "balanced-agv" ? v >= c : tradesAt(threshold, v, c));
      return evaluatePolynomial(
        trades ? tradePolynomial : noTradePolynomial,
        v,
        c
      );
    };
  }

  function ruleValuesAt(rule, v, c) {
    var region = regionAt(rule, v, c);
    return {
      v: v,
      c: c,
      region: region.id,
      q: evaluatePolynomial(region.fields.q, v, c),
      pB: evaluatePolynomial(region.fields.pB, v, c),
      pS: evaluatePolynomial(region.fields.pS, v, c)
    };
  }

  function rangeFromValues(values) {
    return {
      min: Math.min.apply(Math, values),
      max: Math.max.apply(Math, values)
    };
  }

  function diagonalTradeVertices(threshold) {
    return [
      { v: threshold, c: 0 },
      { v: 1, c: 0 },
      { v: 1, c: 1 - threshold }
    ];
  }

  function polynomialValuesAtPoints(coefficients, points) {
    return points.map(function (point) {
      return evaluatePolynomial(coefficients, point.v, point.c);
    });
  }

  function diagonalPolynomialRange(rule, coefficients, includeZero) {
    var values = polynomialValuesAtPoints(
      coefficients, diagonalTradeVertices(rule.parameters.threshold)
    );
    if (includeZero) {
      values.push(0);
    }
    return rangeFromValues(values);
  }

  function buyerPayoffPolynomial(region) {
    var result = region.fields.pB.map(function (value) {
      return -value;
    });
    result[1] += region.fields.q[0] || 0;
    return result;
  }

  function sellerPayoffPolynomial(region) {
    var result = region.fields.pS.slice();
    result[2] -= region.fields.q[0] || 0;
    return result;
  }

  function revenuePolynomial(region) {
    return region.fields.pB.map(function (value, index) {
      return value - region.fields.pS[index];
    });
  }

  function fieldRange(rule, field) {
    validateRule(rule);
    if (rule.family !== "revenue-threshold") {
      if (field !== "q" && field !== "pB" && field !== "pS") {
        throw new RangeError("The field must be q, pB, or pS.");
      }
      if (rule.family === "diagonal-affine") {
        if (field === "q") {
          return { min: 0, max: 1 };
        }
        return diagonalPolynomialRange(
          rule, rule.regions[1].fields[field], true
        );
      }
      if (rule.family === "posted-price") {
        var buyerPrice = rule.parameters.buyerPrice;
        var sellerPrice = rule.parameters.sellerPrice;
        var fullTrade = buyerPrice === 0 && sellerPrice === 1;
        if (field === "q") {
          return { min: fullTrade ? 1 : 0, max: 1 };
        }
        var payment = field === "pB" ? buyerPrice : sellerPrice;
        return {
          min: fullTrade ? payment : Math.min(0, payment),
          max: fullTrade ? payment : Math.max(0, payment)
        };
      }
      if (field === "q") {
        return { min: 0, max: 1 };
      }
      return {
        min: rule.parameters.constant - 0.5,
        max: rule.parameters.constant + 0.5
      };
    }
    var threshold = rule.parameters.threshold;
    var buyerMarkup = rule.parameters.buyerMarkup;
    var sellerDiscount = rule.parameters.sellerDiscount;
    if (field === "q") {
      return { min: 0, max: 1 };
    }
    if (field === "pB") {
      return { min: 0, max: buyerMarkup + 1 - threshold };
    }
    if (field === "pS") {
      return {
        min: Math.min(0, threshold - sellerDiscount),
        max: Math.max(0, 1 - sellerDiscount)
      };
    }
    throw new RangeError("The field must be q, pB, or pS.");
  }

  function truthfulPayoffValuesAt(rule, v, c) {
    var values = ruleValuesAt(rule, v, c);
    return {
      buyerPayoff: values.v * values.q - values.pB,
      sellerPayoff: values.pS - values.c * values.q,
      revenue: values.pB - values.pS
    };
  }

  function allocationErrorAt(rule, v, c) {
    var values = ruleValuesAt(rule, v, c);
    var efficient = values.v >= values.c ? 1 : 0;
    return {
      q: values.q,
      efficient: efficient,
      over: Math.max(0, values.q - efficient),
      under: Math.max(0, efficient - values.q)
    };
  }

  function truthfulPayoffRange(rule, agent) {
    validateRule(rule);
    if (agent !== "buyer" && agent !== "seller") {
      throw new RangeError("The payoff agent must be buyer or seller.");
    }
    if (rule.family === "revenue-threshold") {
      var transferParameter = agent === "buyer" ?
        rule.parameters.buyerMarkup : rule.parameters.sellerDiscount;
      return {
        min: Math.min(0, rule.parameters.threshold - transferParameter),
        max: Math.max(0, 1 - transferParameter)
      };
    }
    if (rule.family === "diagonal-affine") {
      return diagonalPolynomialRange(
        rule,
        agent === "buyer" ?
          buyerPayoffPolynomial(rule.regions[1]) :
          sellerPayoffPolynomial(rule.regions[1]),
        true
      );
    }
    if (rule.family === "posted-price") {
      var maximum = agent === "buyer" ?
        1 - rule.parameters.buyerPrice : rule.parameters.sellerPrice;
      return { min: 0, max: maximum };
    }
    if (agent === "buyer") {
      return {
        min: -rule.parameters.constant,
        max: 1 - rule.parameters.constant
      };
    }
    return {
      min: rule.parameters.constant - 1,
      max: rule.parameters.constant + 0.5
    };
  }

  function revenueRange(rule) {
    validateRule(rule);
    if (rule.family === "diagonal-affine") {
      return diagonalPolynomialRange(
        rule, revenuePolynomial(rule.regions[1]), true
      );
    }
    if (rule.family === "posted-price") {
      var revenue = rule.parameters.buyerPrice -
        rule.parameters.sellerPrice;
      if (rule.parameters.buyerPrice === 0 &&
          rule.parameters.sellerPrice === 1) {
        return { min: revenue, max: revenue };
      }
      return {
        min: Math.min(0, revenue),
        max: Math.max(0, revenue)
      };
    }
    if (rule.family === "balanced-agv") {
      return { min: 0, max: 0 };
    }
    var sum = rule.parameters.buyerMarkup +
      rule.parameters.sellerDiscount;
    return {
      min: Math.min(0, sum - 1),
      max: Math.max(0, sum - rule.parameters.threshold)
    };
  }

  function interimTruthfulPayoffRange(rule, agent) {
    validateRule(rule);
    if (agent !== "buyer" && agent !== "seller") {
      throw new RangeError("The interim-payoff agent must be buyer or seller.");
    }
    var interim = agent === "buyer" ?
      buyerInterimRule(rule) : sellerInterimRule(rule);
    var values = [];
    interim.pieces.forEach(function (piece) {
      var allocation = piece.allocation;
      var payment = piece.payment;
      var truthful = agent === "buyer" ? [
        -(payment[0] || 0),
        (allocation[0] || 0) - (payment[1] || 0),
        (allocation[1] || 0) - (payment[2] || 0)
      ] : [
        payment[0] || 0,
        (payment[1] || 0) - (allocation[0] || 0),
        (payment[2] || 0) - (allocation[1] || 0)
      ];
      var range = polynomialRangeOnInterval(
        truthful, piece.lower, piece.upper
      );
      values.push(range.min, range.max);
    });
    return rangeFromValues(values);
  }

  function freezeInterimPiece(lower, upper, lowerClosed, upperClosed,
      allocation, payment) {
    return Object.freeze({
      lower: lower,
      upper: upper,
      lowerClosed: lowerClosed,
      upperClosed: upperClosed,
      allocation: Object.freeze(allocation),
      payment: Object.freeze(payment)
    });
  }

  function freezeInterimRule(breakpoint, firstName, first, secondName, second) {
    var result = {
      breakpoint: breakpoint,
      pieces: Object.freeze([first, second])
    };
    result[firstName] = first;
    result[secondName] = second;
    return Object.freeze(result);
  }

  function diagonalBuyerInterimRule(rule) {
    var threshold = rule.parameters.threshold;
    var payment = rule.regions[1].fields.pB;
    var a = payment[0];
    var b = payment[1];
    var d = payment[2];
    var noTrade = freezeInterimPiece(
      0, threshold, true, false, [0], [0]
    );
    var trade = freezeInterimPiece(
      threshold, 1, true, true,
      [-threshold, 1],
      [
        -a * threshold + 0.5 * d * threshold * threshold,
        a - b * threshold - d * threshold,
        b + 0.5 * d
      ]
    );
    return freezeInterimRule(
      threshold, "noTrade", noTrade, "trade", trade
    );
  }

  function diagonalSellerInterimRule(rule) {
    var threshold = rule.parameters.threshold;
    var breakpoint = 1 - threshold;
    var payment = rule.regions[1].fields.pS;
    var a = payment[0];
    var b = payment[1];
    var d = payment[2];
    var leading = a + d * breakpoint + b;
    var quadratic = -(d + 0.5 * b);
    var trade = freezeInterimPiece(
      0, breakpoint, true, true,
      [breakpoint, -1],
      [
        leading * breakpoint + quadratic * breakpoint * breakpoint,
        -leading - 2 * quadratic * breakpoint,
        quadratic
      ]
    );
    var noTrade = freezeInterimPiece(
      breakpoint, 1, false, true, [0], [0]
    );
    return freezeInterimRule(
      breakpoint, "trade", trade, "noTrade", noTrade
    );
  }

  function buyerInterimRule(rule) {
    validateRule(rule);
    if (rule.family === "revenue-threshold" ||
        rule.family === "diagonal-affine") {
      return diagonalBuyerInterimRule(rule);
    }
    if (rule.family === "posted-price") {
      var buyerPrice = rule.parameters.buyerPrice;
      var sellerPrice = rule.parameters.sellerPrice;
      var noTrade = freezeInterimPiece(
        0, buyerPrice, true, false, [0], [0]
      );
      var trade = freezeInterimPiece(
        buyerPrice, 1, true, true,
        [sellerPrice], [buyerPrice * sellerPrice]
      );
      return freezeInterimRule(
        buyerPrice, "noTrade", noTrade, "trade", trade
      );
    }
    var piece = freezeInterimPiece(
      0, 1, true, true,
      [0, 1], [rule.parameters.constant - 1 / 6, 0, 0.5]
    );
    return Object.freeze({
      breakpoint: null,
      pieces: Object.freeze([piece]),
      trade: piece
    });
  }

  function sellerInterimRule(rule) {
    validateRule(rule);
    if (rule.family === "revenue-threshold" ||
        rule.family === "diagonal-affine") {
      return diagonalSellerInterimRule(rule);
    }
    if (rule.family === "posted-price") {
      var buyerPrice = rule.parameters.buyerPrice;
      var sellerPrice = rule.parameters.sellerPrice;
      var trade = freezeInterimPiece(
        0, sellerPrice, true, true,
        [1 - buyerPrice], [sellerPrice * (1 - buyerPrice)]
      );
      var noTrade = freezeInterimPiece(
        sellerPrice, 1, false, true, [0], [0]
      );
      return freezeInterimRule(
        sellerPrice, "trade", trade, "noTrade", noTrade
      );
    }
    var piece = freezeInterimPiece(
      0, 1, true, true,
      [1, -1], [rule.parameters.constant + 1 / 6, 0, -0.5]
    );
    return Object.freeze({
      breakpoint: null,
      pieces: Object.freeze([piece]),
      trade: piece
    });
  }

  function polynomialRangeOnInterval(coefficients, lower, upper) {
    var values = [
      evaluateInterimPolynomial(coefficients, lower),
      evaluateInterimPolynomial(coefficients, upper)
    ];
    var quadratic = coefficients[2] || 0;
    if (quadratic !== 0) {
      var stationary = -(coefficients[1] || 0) / (2 * quadratic);
      if (stationary > lower && stationary < upper) {
        values.push(evaluateInterimPolynomial(coefficients, stationary));
      }
    }
    return rangeFromValues(values);
  }

  function evaluateInterimPolynomial(coefficients, value) {
    var result = 0;
    var index;
    for (index = coefficients.length - 1; index >= 0; index -= 1) {
      result = result * value + coefficients[index];
    }
    return result;
  }

  function validateInterimPolynomial(coefficients, maximumLength, label) {
    if (!Array.isArray(coefficients) || coefficients.length === 0 ||
        coefficients.length > maximumLength ||
        !coefficients.every(isFiniteNumber)) {
      throw new TypeError(label + " must be a finite supported polynomial.");
    }
  }

  function validateBuyerInterimPieces(pieces) {
    if (!Array.isArray(pieces) || pieces.length === 0) {
      throw new TypeError("Buyer interim pieces must be a nonempty array.");
    }
    pieces.forEach(function (piece, index) {
      if (!piece || !isFiniteNumber(piece.lower) ||
          !isFiniteNumber(piece.upper)) {
        throw new TypeError("Every buyer interim piece needs finite bounds.");
      }
      if (piece.lower < 0 || piece.upper > 1 || piece.lower > piece.upper) {
        throw new RangeError("Buyer interim piece bounds must be ordered in [0, 1].");
      }
      if (piece.lowerClosed !== undefined &&
          typeof piece.lowerClosed !== "boolean" ||
          piece.upperClosed !== undefined &&
          typeof piece.upperClosed !== "boolean") {
        throw new TypeError("Buyer interim endpoint flags must be Boolean.");
      }
      if (index === 0 && piece.lower !== 0 ||
          index > 0 && piece.lower !== pieces[index - 1].upper) {
        throw new RangeError("Buyer interim pieces must be contiguous from zero.");
      }
      validateInterimPolynomial(
        piece.allocation, 2, "Buyer interim allocation"
      );
      validateInterimPolynomial(
        piece.payment, 3, "Buyer interim payment"
      );
    });
    if (pieces[pieces.length - 1].upper !== 1) {
      throw new RangeError("Buyer interim pieces must end at one.");
    }
    var boundaries = [0];
    pieces.forEach(function (piece) {
      if (boundaries.indexOf(piece.upper) === -1) {
        boundaries.push(piece.upper);
      }
    });
    boundaries.forEach(function (boundary) {
      var owners = pieces.filter(function (piece) {
        return interimPieceContains(piece, boundary);
      }).length;
      if (owners !== 1) {
        throw new RangeError(
          "Every buyer report must have exactly one interim-piece owner."
        );
      }
    });
    return pieces;
  }

  function antiderivativeInterimPolynomial(coefficients) {
    var result = [0];
    coefficients.forEach(function (coefficient, index) {
      result[index + 1] = coefficient / (index + 1);
    });
    return result;
  }

  function buyerEnvelopeResidualPiece(piece, cumulativeIntegral) {
    var primitive = antiderivativeInterimPolynomial(piece.allocation);
    var integral = primitive.slice();
    var reportAllocation = [0].concat(piece.allocation);
    var length = Math.max(
      piece.payment.length, integral.length, reportAllocation.length
    );
    var coefficients = new Array(length);
    var index;
    integral[0] += cumulativeIntegral -
      evaluateInterimPolynomial(primitive, piece.lower);
    for (index = 0; index < length; index += 1) {
      coefficients[index] = (piece.payment[index] || 0) -
        (reportAllocation[index] || 0) + (integral[index] || 0);
    }
    return {
      piece: Object.freeze({
        lower: piece.lower,
        upper: piece.upper,
        lowerClosed: piece.lowerClosed !== false,
        upperClosed: piece.upperClosed !== false,
        coefficients: Object.freeze(coefficients)
      }),
      cumulativeIntegral: cumulativeIntegral +
        evaluateInterimPolynomial(primitive, piece.upper) -
        evaluateInterimPolynomial(primitive, piece.lower)
    };
  }

  function interimPieceHasReports(piece) {
    return piece.upper > piece.lower ||
      piece.lowerClosed && piece.upperClosed;
  }

  function interimPieceContains(piece, value) {
    if (value < piece.lower || value > piece.upper ||
        value === piece.lower && piece.lowerClosed === false ||
        value === piece.upper && piece.upperClosed === false) {
      return false;
    }
    return true;
  }

  function residualRangeOnPiece(piece) {
    var candidates = [piece.lower, piece.upper];
    var linear = piece.coefficients[1] || 0;
    var quadratic = piece.coefficients[2] || 0;
    if (quadratic !== 0) {
      var stationary = -linear / (2 * quadratic);
      if (stationary > piece.lower && stationary < piece.upper) {
        candidates.push(stationary);
      }
    }
    var minimum = Infinity;
    var maximum = -Infinity;
    candidates.forEach(function (candidate) {
      var value = evaluateInterimPolynomial(piece.coefficients, candidate);
      minimum = Math.min(minimum, value);
      maximum = Math.max(maximum, value);
    });
    return { min: minimum, max: maximum };
  }

  function checkBuyerEnvelopeResidual(interimPieces, verdictTolerance) {
    var pieces = validateBuyerInterimPieces(interimPieces);
    var tolerance = resolveVerdictTolerance(verdictTolerance);
    var cumulativeIntegral = 0;
    var residualPieces = [];
    pieces.forEach(function (piece) {
      var result = buyerEnvelopeResidualPiece(piece, cumulativeIntegral);
      residualPieces.push(result.piece);
      cumulativeIntegral = result.cumulativeIntegral;
    });
    var referenceResidual = null;
    residualPieces.some(function (piece) {
      if (!interimPieceHasReports(piece)) {
        return false;
      }
      referenceResidual = evaluateInterimPolynomial(
        piece.coefficients, piece.lower
      );
      return true;
    });
    if (referenceResidual === null) {
      throw new RangeError("Buyer interim pieces must contain at least one report.");
    }
    var minimum = Infinity;
    var maximum = -Infinity;
    var maxViolation = 0;
    var intervalViolations = residualPieces.map(function (piece) {
      if (!interimPieceHasReports(piece)) {
        return false;
      }
      var range = residualRangeOnPiece(piece);
      var violation = Math.max(
        Math.abs(range.min - referenceResidual),
        Math.abs(range.max - referenceResidual)
      );
      minimum = Math.min(minimum, range.min);
      maximum = Math.max(maximum, range.max);
      maxViolation = Math.max(maxViolation, violation);
      return violation > tolerance;
    });
    return Object.freeze({
      holds: maxViolation <= tolerance,
      referenceResidual: referenceResidual,
      maxViolation: maxViolation,
      bounds: Object.freeze({ infimum: minimum, supremum: maximum }),
      intervalViolations: Object.freeze(intervalViolations),
      violationCount: intervalViolations.filter(function (value) {
        return value;
      }).length,
      residualPieces: Object.freeze(residualPieces)
    });
  }

  function buyerInterimAllocation(rule, report) {
    validateRule(rule);
    var boundedReport = validateUnitValue(report, "buyer report");
    var piece = interimPieceAt(buyerInterimRule(rule), boundedReport);
    return evaluateInterimPolynomial(piece.allocation, boundedReport);
  }

  function buyerInterimPayment(rule, report) {
    validateRule(rule);
    var boundedReport = validateUnitValue(report, "buyer report");
    var piece = interimPieceAt(buyerInterimRule(rule), boundedReport);
    return evaluateInterimPolynomial(piece.payment, boundedReport);
  }

  function buyerInterimDeviationUtility(rule, trueValue, report) {
    var boundedType = validateUnitValue(trueValue, "true buyer value");
    var boundedReport = validateUnitValue(report, "buyer report");
    var interim = buyerInterimRule(rule);
    var piece = interimPieceAt(interim, boundedReport);
    return boundedType * evaluateInterimPolynomial(
      piece.allocation, boundedReport
    ) - evaluateInterimPolynomial(piece.payment, boundedReport);
  }

  function sellerInterimAllocation(rule, report) {
    validateRule(rule);
    var boundedReport = validateUnitValue(report, "seller report");
    var piece = interimPieceAt(sellerInterimRule(rule), boundedReport);
    return evaluateInterimPolynomial(piece.allocation, boundedReport);
  }

  function sellerInterimPayment(rule, report) {
    validateRule(rule);
    var boundedReport = validateUnitValue(report, "seller report");
    var piece = interimPieceAt(sellerInterimRule(rule), boundedReport);
    return evaluateInterimPolynomial(piece.payment, boundedReport);
  }

  function sellerInterimDeviationUtility(rule, trueCost, report) {
    var boundedCost = validateUnitValue(trueCost, "true seller cost");
    var boundedReport = validateUnitValue(report, "seller report");
    var interim = sellerInterimRule(rule);
    var piece = interimPieceAt(interim, boundedReport);
    return evaluateInterimPolynomial(piece.payment, boundedReport) -
      boundedCost * evaluateInterimPolynomial(
        piece.allocation, boundedReport
      );
  }

  function interimPieceAt(interim, report) {
    var found = interim.pieces.find(function (piece) {
      var aboveLower = report > piece.lower ||
        report === piece.lower && piece.lowerClosed !== false;
      var belowUpper = report < piece.upper ||
        report === piece.upper && piece.upperClosed !== false;
      return aboveLower && belowUpper;
    });
    if (!found) {
      throw new RangeError("The interim rule does not own this report.");
    }
    return found;
  }

  function buyerDeviationEvaluator(rule) {
    validateRule(rule);
    if (rule.family === "revenue-threshold") {
      var threshold = rule.parameters.threshold;
      var buyerMarkup = rule.parameters.buyerMarkup;
      return function (trueValue, report) {
        var allocation = report < threshold ? 0 : report - threshold;
        return (trueValue - buyerMarkup) * allocation -
          0.5 * allocation * allocation;
      };
    }
    if (rule.family === "diagonal-affine") {
      var profile = diagonalBuyerProfile(rule);
      return function (trueValue, report) {
        return profileUtility(profile, trueValue, report);
      };
    }
    var interim = buyerInterimRule(rule);
    var pieces = interim.pieces;
    var first = pieces[0];
    var second = pieces[1];
    return function (trueValue, report) {
      var piece = second === undefined || report < first.upper ||
        report === first.upper && first.upperClosed !== false ? first : second;
      var allocation = (piece.allocation[0] || 0) +
        (piece.allocation[1] || 0) * report;
      var payment = (piece.payment[0] || 0) +
        (piece.payment[1] || 0) * report +
        (piece.payment[2] || 0) * report * report;
      return trueValue * allocation - payment;
    };
  }

  function sellerDeviationEvaluator(rule) {
    validateRule(rule);
    if (rule.family === "revenue-threshold") {
      var threshold = rule.parameters.threshold;
      var sellerDiscount = rule.parameters.sellerDiscount;
      return function (trueCost, report) {
        var allocation = report > 1 - threshold ?
          0 : 1 - threshold - report;
        return (1 - sellerDiscount - trueCost) * allocation -
          0.5 * allocation * allocation;
      };
    }
    if (rule.family === "diagonal-affine") {
      var profile = diagonalSellerMirrorProfile(rule);
      return function (trueCost, report) {
        return profileUtility(profile, 1 - trueCost, 1 - report);
      };
    }
    var interim = sellerInterimRule(rule);
    var pieces = interim.pieces;
    var first = pieces[0];
    var second = pieces[1];
    return function (trueCost, report) {
      var piece = second === undefined || report < first.upper ||
        report === first.upper && first.upperClosed !== false ? first : second;
      var allocation = (piece.allocation[0] || 0) +
        (piece.allocation[1] || 0) * report;
      var payment = (piece.payment[0] || 0) +
        (piece.payment[1] || 0) * report +
        (piece.payment[2] || 0) * report * report;
      return payment - trueCost * allocation;
    };
  }

  function diagonalBuyerProfile(rule) {
    var threshold = rule.parameters.threshold;
    var payment = rule.regions[1].fields.pB;
    return {
      threshold: threshold,
      length: 1 - threshold,
      linearCharge: payment[0] + payment[1] * threshold,
      quadraticCharge: payment[1] + 0.5 * payment[2]
    };
  }

  function diagonalSellerMirrorProfile(rule) {
    var threshold = rule.parameters.threshold;
    var length = 1 - threshold;
    var payment = rule.regions[1].fields.pS;
    var leadingReceipt = payment[0] + payment[2] * length + payment[1];
    return {
      threshold: threshold,
      length: length,
      linearCharge: 1 - leadingReceipt,
      quadraticCharge: payment[2] + 0.5 * payment[1]
    };
  }

  function profileUtility(profile, trueValue, report) {
    var quantity = report < profile.threshold ?
      0 : report - profile.threshold;
    return (trueValue - profile.linearCharge) * quantity -
      profile.quadraticCharge * quantity * quantity;
  }

  function profileBestRegime(profile, trueValue) {
    if (trueValue <= profile.linearCharge) {
      return "no-trade";
    }
    if (trueValue >= profile.linearCharge +
        2 * profile.quadraticCharge * profile.length) {
      return "cap";
    }
    return "stationary";
  }

  function profileBestReportValue(profile, trueValue, regime) {
    if (regime === "no-trade") {
      return profile.threshold;
    }
    if (regime === "cap") {
      return 1;
    }
    return profile.threshold +
      (trueValue - profile.linearCharge) /
        (2 * profile.quadraticCharge);
  }

  function profileBestUtilityPolynomial(profile, regime) {
    var a = profile.linearCharge;
    var b = profile.quadraticCharge;
    var length = profile.length;
    if (regime === "no-trade") {
      return [0, 0, 0];
    }
    if (regime === "cap") {
      return [-a * length - b * length * length, length, 0];
    }
    return [a * a / (4 * b), -a / (2 * b), 1 / (4 * b)];
  }

  function profileTruthUtilityPolynomial(profile, tradesTruthfully) {
    if (!tradesTruthfully) {
      return [0, 0, 0];
    }
    var a = profile.linearCharge;
    var b = profile.quadraticCharge;
    var threshold = profile.threshold;
    return [
      a * threshold - b * threshold * threshold,
      -(a + threshold) + 2 * b * threshold,
      1 - b
    ];
  }

  function subtractPolynomials(left, right) {
    return [
      (left[0] || 0) - (right[0] || 0),
      (left[1] || 0) - (right[1] || 0),
      (left[2] || 0) - (right[2] || 0)
    ];
  }

  function uniqueSortedUnitValues(values) {
    var result = [];
    values.map(function (value) {
      return clamp(value, 0, 1);
    }).sort(function (left, right) {
      return left - right;
    }).forEach(function (value) {
      if (result.length === 0 ||
          Math.abs(value - result[result.length - 1]) > ALGEBRA_TOLERANCE) {
        result.push(value);
      }
    });
    return result;
  }

  function polynomialRootsInInterval(coefficients, target, lower, upper) {
    var constant = (coefficients[0] || 0) - target;
    var linear = coefficients[1] || 0;
    var quadratic = coefficients[2] || 0;
    var roots = [];
    if (quadratic === 0) {
      if (linear !== 0) {
        roots.push(-constant / linear);
      }
    } else {
      var discriminant = linear * linear - 4 * quadratic * constant;
      if (discriminant >= -ALGEBRA_TOLERANCE) {
        var root = Math.sqrt(Math.max(0, discriminant));
        roots.push((-linear - root) / (2 * quadratic));
        roots.push((-linear + root) / (2 * quadratic));
      }
    }
    return roots.filter(function (value) {
      return value > lower + ALGEBRA_TOLERANCE &&
        value < upper - ALGEBRA_TOLERANCE;
    });
  }

  function profileBaseIntervals(profile) {
    var breaks = uniqueSortedUnitValues([
      0,
      1,
      profile.threshold,
      profile.linearCharge,
      profile.linearCharge +
        2 * profile.quadraticCharge * profile.length
    ]);
    var intervals = [];
    breaks.slice(0, -1).forEach(function (lower, index) {
      var upper = breaks[index + 1];
      if (upper <= lower) {
        return;
      }
      var midpoint = (lower + upper) / 2;
      var regime = profileBestRegime(profile, midpoint);
      var gain = subtractPolynomials(
        profileBestUtilityPolynomial(profile, regime),
        profileTruthUtilityPolynomial(
          profile, midpoint >= profile.threshold
        )
      );
      intervals.push({
        lower: lower,
        upper: upper,
        regime: regime,
        gain: gain
      });
    });
    return intervals;
  }

  function profileMaximumGainDetails(profile) {
    var maximumGain = 0;
    var worstType = 0;
    profileBaseIntervals(profile).forEach(function (interval) {
      var candidates = [interval.lower, interval.upper];
      var quadratic = interval.gain[2] || 0;
      if (quadratic < 0) {
        var stationary = -(interval.gain[1] || 0) / (2 * quadratic);
        if (stationary > interval.lower && stationary < interval.upper) {
          candidates.push(stationary);
        }
      }
      candidates.forEach(function (trueValue) {
        var gain = evaluateInterimPolynomial(interval.gain, trueValue);
        if (gain > maximumGain) {
          maximumGain = gain;
          worstType = trueValue;
        }
      });
    });
    return {
      maximumGain: Math.max(0, maximumGain),
      worstType: worstType
    };
  }

  function profileBestReport(profile, trueValue, verdictTolerance) {
    var tolerance = resolveVerdictTolerance(verdictTolerance);
    var regime = profileBestRegime(profile, trueValue);
    var report = profileBestReportValue(profile, trueValue, regime);
    var maximumUtility = profileUtility(profile, trueValue, report);
    var truthfulUtility = profileUtility(profile, trueValue, trueValue);
    var maximumGain = Math.max(0, maximumUtility - truthfulUtility);
    var truthfulTie = maximumGain <= tolerance;
    return {
      report: truthfulTie ? trueValue : report,
      utility: truthfulTie ? truthfulUtility : maximumUtility,
      truthfulUtility: truthfulUtility,
      maximumUtility: maximumUtility,
      maximumGain: maximumGain,
      truthfulTie: truthfulTie
    };
  }

  function profileBestReportTrace(profile, verdictTolerance) {
    var tolerance = resolveVerdictTolerance(verdictTolerance);
    var raw = [];
    profileBaseIntervals(profile).forEach(function (interval) {
      var breaks = uniqueSortedUnitValues([
        interval.lower,
        interval.upper
      ].concat(polynomialRootsInInterval(
        interval.gain, tolerance, interval.lower, interval.upper
      )));
      breaks.slice(0, -1).forEach(function (lower, index) {
        var upper = breaks[index + 1];
        var midpoint = (lower + upper) / 2;
        var truthful = evaluateInterimPolynomial(
          interval.gain, midpoint
        ) <= tolerance;
        var kind = truthful ? "truthful" : interval.regime;
        var intercept;
        var slope;
        if (truthful) {
          intercept = 0;
          slope = 1;
        } else if (kind === "stationary") {
          intercept = profile.threshold - profile.linearCharge /
            (2 * profile.quadraticCharge);
          slope = 1 / (2 * profile.quadraticCharge);
        } else {
          intercept = kind === "cap" ? 1 : profile.threshold;
          slope = 0;
        }
        var previous = raw[raw.length - 1];
        if (previous && previous.kind === kind &&
            previous.intercept === intercept && previous.slope === slope &&
            previous.upper === lower) {
          previous.upper = upper;
        } else {
          raw.push({
            kind: kind,
            lower: lower,
            upper: upper,
            intercept: intercept,
            slope: slope
          });
        }
      });
    });
    if (raw.length === 0) {
      return Object.freeze([
        traceSegment("truthful", 0, 1, 0, 1, true, true)
      ]);
    }
    return Object.freeze(raw.map(function (segment, index) {
      var previous = raw[index - 1];
      var next = raw[index + 1];
      var startClosed = segment.lower === 0 || segment.kind === "truthful" ||
        previous && previous.kind !== "truthful";
      var endClosed = segment.upper === 1 || segment.kind === "truthful" ||
        next && next.kind !== "truthful";
      return traceSegment(
        segment.kind,
        segment.lower,
        segment.upper,
        segment.intercept + segment.slope * segment.lower,
        segment.intercept + segment.slope * segment.upper,
        Boolean(startClosed),
        Boolean(endClosed)
      );
    }));
  }

  function truthfulBestReport(rule, trueValue, agent) {
    var utility = agent === "buyer" ?
      buyerInterimDeviationUtility(rule, trueValue, trueValue) :
      sellerInterimDeviationUtility(rule, trueValue, trueValue);
    return {
      report: trueValue,
      utility: utility,
      truthfulUtility: utility,
      maximumUtility: utility,
      maximumGain: 0,
      truthfulTie: true
    };
  }

  function candidateUtility(rule, trueValue, candidate) {
    if (candidate.side === "left" &&
        candidate.report === rule.parameters.threshold) {
      return 0;
    }
    return buyerInterimDeviationUtility(rule, trueValue, candidate.report);
  }

  function resolveVerdictTolerance(verdictTolerance) {
    var tolerance = verdictTolerance === undefined ?
      VERDICT_TOLERANCE : verdictTolerance;
    if (!isFiniteNumber(tolerance) || tolerance < 0) {
      throw new RangeError("The verdict tolerance must be finite and nonnegative.");
    }
    return tolerance;
  }

  function buyerBestReport(rule, trueValue, verdictTolerance) {
    validateRule(rule);
    var boundedType = validateUnitValue(trueValue, "true buyer value");
    if (rule.family === "diagonal-affine") {
      return profileBestReport(
        diagonalBuyerProfile(rule), boundedType, verdictTolerance
      );
    }
    if (rule.family !== "revenue-threshold") {
      resolveVerdictTolerance(verdictTolerance);
      return truthfulBestReport(rule, boundedType, "buyer");
    }
    var tolerance = resolveVerdictTolerance(verdictTolerance);
    var threshold = rule.parameters.threshold;
    if (rule.parameters.buyerMarkup === threshold) {
      var exactTruthfulUtility = buyerInterimDeviationUtility(
        rule, boundedType, boundedType
      );
      return {
        report: boundedType,
        utility: exactTruthfulUtility,
        truthfulUtility: exactTruthfulUtility,
        maximumUtility: exactTruthfulUtility,
        maximumGain: 0,
        truthfulTie: true
      };
    }
    var stationary = threshold + boundedType - rule.parameters.buyerMarkup;
    var candidates = [
      { report: boundedType, side: "point" },
      { report: 0, side: "point" },
      { report: threshold, side: "left" },
      { report: threshold, side: "right" },
      { report: 1, side: "point" }
    ];
    if (stationary >= threshold - ALGEBRA_TOLERANCE &&
        stationary <= 1 + ALGEBRA_TOLERANCE) {
      candidates.push({
        report: clamp(stationary, threshold, 1),
        side: "stationary"
      });
    }
    var best = candidates[0];
    var bestUtility = candidateUtility(rule, boundedType, best);
    candidates.slice(1).forEach(function (candidate) {
      var utility = candidateUtility(rule, boundedType, candidate);
      var isHigher = utility > bestUtility;
      var isCloserTie = utility === bestUtility &&
        Math.abs(candidate.report - boundedType) <
          Math.abs(best.report - boundedType);
      if (isHigher || isCloserTie) {
        best = candidate;
        bestUtility = utility;
      }
    });
    var truthfulUtility = buyerInterimDeviationUtility(
      rule, boundedType, boundedType
    );
    var maximumGain = Math.max(0, bestUtility - truthfulUtility);
    var truthfulTie = truthfulUtility >= bestUtility - tolerance;
    if (truthfulTie) {
      best = { report: boundedType, side: "truthful-tie" };
    }
    return {
      report: best.report,
      utility: truthfulTie ? truthfulUtility : bestUtility,
      truthfulUtility: truthfulUtility,
      maximumUtility: bestUtility,
      maximumGain: maximumGain,
      truthfulTie: truthfulTie
    };
  }

  function buyerDeviationUtilityRange(rule) {
    validateRule(rule);
    if (rule.family !== "revenue-threshold") {
      var values = [];
      buyerInterimRule(rule).pieces.forEach(function (piece) {
        [0, 1].forEach(function (trueValue) {
          var utility = [
            trueValue * (piece.allocation[0] || 0) -
              (piece.payment[0] || 0),
            trueValue * (piece.allocation[1] || 0) -
              (piece.payment[1] || 0),
            -(piece.payment[2] || 0)
          ];
          var range = polynomialRangeOnInterval(
            utility, piece.lower, piece.upper
          );
          values.push(range.min, range.max);
        });
      });
      return rangeFromValues(values);
    }
    var length = 1 - rule.parameters.threshold;
    var buyerMarkup = rule.parameters.buyerMarkup;
    var maximizingQuantity = Math.min(length, 1 - buyerMarkup);
    return {
      min: -buyerMarkup * length - 0.5 * length * length,
      max: (1 - buyerMarkup) * maximizingQuantity -
        0.5 * maximizingQuantity * maximizingQuantity
    };
  }

  function buyerMaximumDeviationGain(rule) {
    validateRule(rule);
    if (rule.family === "diagonal-affine") {
      return profileMaximumGainDetails(
        diagonalBuyerProfile(rule)
      ).maximumGain;
    }
    if (rule.family !== "revenue-threshold") {
      return 0;
    }
    var length = 1 - rule.parameters.threshold;
    var displacement = Math.abs(
      rule.parameters.buyerMarkup - rule.parameters.threshold
    );
    var movedQuantity = Math.min(length, displacement);
    return displacement * movedQuantity -
      0.5 * movedQuantity * movedQuantity;
  }

  function buyerWorstType(rule) {
    if (rule.family === "diagonal-affine") {
      return profileMaximumGainDetails(
        diagonalBuyerProfile(rule)
      ).worstType;
    }
    if (rule.family !== "revenue-threshold") {
      return 0;
    }
    var maximumGain = buyerMaximumDeviationGain(rule);
    if (maximumGain <= ALGEBRA_TOLERANCE) {
      return 0;
    }
    return rule.parameters.buyerMarkup < rule.parameters.threshold ?
      rule.parameters.threshold : rule.parameters.buyerMarkup;
  }

  function tracePoint(trueValue, report) {
    return Object.freeze({
      trueValue: clamp(trueValue, 0, 1),
      report: clamp(report, 0, 1)
    });
  }

  function traceSegment(kind, start, end, startReport, endReport,
      startClosed, endClosed) {
    return Object.freeze({
      kind: kind,
      startClosed: startClosed,
      endClosed: endClosed,
      points: Object.freeze([
        tracePoint(start, startReport),
        tracePoint(end, endReport)
      ])
    });
  }

  function pushTraceSegment(segments, kind, start, end, startReport,
      endReport, startClosed, endClosed) {
    if (end > start) {
      segments.push(traceSegment(
        kind, start, end, startReport, endReport, startClosed, endClosed
      ));
    }
  }

  function buyerBestReportTrace(rule, verdictTolerance) {
    validateRule(rule);
    if (rule.family === "diagonal-affine") {
      return profileBestReportTrace(
        diagonalBuyerProfile(rule), verdictTolerance
      );
    }
    if (rule.family !== "revenue-threshold") {
      resolveVerdictTolerance(verdictTolerance);
      return Object.freeze([
        traceSegment("truthful", 0, 1, 0, 1, true, true)
      ]);
    }
    var tolerance = resolveVerdictTolerance(verdictTolerance);
    var threshold = rule.parameters.threshold;
    var buyerMarkup = rule.parameters.buyerMarkup;
    var maximumGain = buyerMaximumDeviationGain(rule);
    if (maximumGain <= tolerance) {
      return Object.freeze([
        traceSegment("truthful", 0, 1, 0, 1, true, true)
      ]);
    }
    var segments = [];
    var displacement = Math.abs(buyerMarkup - threshold);
    var root = Math.sqrt(Math.max(
      0, displacement * displacement - 2 * tolerance
    ));
    if (buyerMarkup > threshold) {
      var lowerSwitch = clamp(buyerMarkup - root, 0, 1);
      pushTraceSegment(
        segments, "truthful", 0, lowerSwitch, 0, lowerSwitch, true, true
      );
      pushTraceSegment(
        segments, "no-trade", lowerSwitch, buyerMarkup,
        threshold, threshold, false, true
      );
      pushTraceSegment(
        segments, "stationary", buyerMarkup, 1,
        threshold, 1 - displacement, true, true
      );
      return Object.freeze(segments);
    }
    var length = 1 - threshold;
    var lowerGainAtCap = 0.5 * length * length;
    var lowerQuantity = tolerance <= lowerGainAtCap ?
      Math.sqrt(2 * tolerance) : tolerance / length + 0.5 * length;
    var lowerSwitch = clamp(buyerMarkup + lowerQuantity, 0, 1);
    var capSwitch = buyerMarkup + length;
    var upperSwitch = clamp(1 - displacement + root, 0, 1);
    pushTraceSegment(
      segments, "truthful", 0, lowerSwitch, 0, lowerSwitch, true, true
    );
    var stationaryEnd = Math.min(capSwitch, upperSwitch);
    pushTraceSegment(
      segments, "stationary", lowerSwitch, stationaryEnd,
      threshold + lowerSwitch - buyerMarkup,
      threshold + stationaryEnd - buyerMarkup,
      false, true
    );
    var capStart = Math.max(lowerSwitch, capSwitch);
    pushTraceSegment(
      segments, "cap", capStart, upperSwitch, 1, 1,
      capStart > lowerSwitch,
      upperSwitch === 1
    );
    pushTraceSegment(
      segments, "truthful", upperSwitch, 1,
      upperSwitch, 1, true, true
    );
    return Object.freeze(segments);
  }

  function buyerIcDiagnostics(rule) {
    validateRule(rule);
    var maximumGain = buyerMaximumDeviationGain(rule);
    var maximumExPostGain = maximumExPostDeviationGain(rule, "buyer");
    var interim = buyerInterimRule(rule);
    return {
      holds: maximumGain <= VERDICT_TOLERANCE,
      dsicHolds: maximumExPostGain <= VERDICT_TOLERANCE,
      maximumGain: maximumGain,
      maximumExPostGain: maximumExPostGain,
      worstTrueValue: buyerWorstType(rule),
      range: buyerDeviationUtilityRange(rule),
      bestReportTrace: buyerBestReportTrace(rule),
      envelopeResidual: checkBuyerEnvelopeResidual(interim.pieces)
    };
  }

  function maximumExPostDeviationGain(rule, agent) {
    validateRule(rule);
    if (rule.family === "posted-price") {
      return 0;
    }
    if (rule.family === "balanced-agv") {
      return 1;
    }
    var threshold = rule.parameters.threshold;
    var length = 1 - threshold;
    var region = rule.regions[1];
    var payment = agent === "buyer" ?
      region.fields.pB : region.fields.pS;
    var payoff = agent === "buyer" ?
      buyerPayoffPolynomial(region) : sellerPayoffPolynomial(region);
    var vertices = diagonalTradeVertices(threshold);
    var boundary = [vertices[0], vertices[2]];
    var ownReportCoefficient = agent === "buyer" ?
      payment[1] : payment[2];
    var values = [0, ownReportCoefficient * length];
    polynomialValuesAtPoints(payoff, vertices).forEach(function (value) {
      values.push(-value);
    });
    polynomialValuesAtPoints(payoff, boundary).forEach(function (value) {
      values.push(value);
    });
    return Math.max.apply(Math, values);
  }

  function sellerMirrorRule(rule) {
    validateRule(rule);
    return createRevenueThresholdRule(
      rule.parameters.threshold,
      rule.parameters.sellerDiscount,
      rule.parameters.sellerDiscount
    );
  }

  function sellerBestReport(rule, trueCost, verdictTolerance) {
    var boundedCost = validateUnitValue(trueCost, "true seller cost");
    if (rule.family === "diagonal-affine") {
      var diagonalResponse = profileBestReport(
        diagonalSellerMirrorProfile(rule),
        1 - boundedCost,
        verdictTolerance
      );
      return {
        report: 1 - diagonalResponse.report,
        utility: diagonalResponse.utility,
        truthfulUtility: diagonalResponse.truthfulUtility,
        maximumUtility: diagonalResponse.maximumUtility,
        maximumGain: diagonalResponse.maximumGain,
        truthfulTie: diagonalResponse.truthfulTie
      };
    }
    if (rule.family !== "revenue-threshold") {
      resolveVerdictTolerance(verdictTolerance);
      return truthfulBestReport(rule, boundedCost, "seller");
    }
    var response = buyerBestReport(
      sellerMirrorRule(rule), 1 - boundedCost, verdictTolerance
    );
    return {
      report: 1 - response.report,
      utility: response.utility,
      truthfulUtility: response.truthfulUtility,
      maximumUtility: response.maximumUtility,
      maximumGain: response.maximumGain,
      truthfulTie: response.truthfulTie
    };
  }

  function mirrorBestReportTrace(segments) {
    return Object.freeze(segments.slice().reverse().map(function (segment) {
      var first = segment.points[0];
      var second = segment.points[1];
      return traceSegment(
        segment.kind,
        1 - second.trueValue,
        1 - first.trueValue,
        1 - second.report,
        1 - first.report,
        segment.endClosed,
        segment.startClosed
      );
    }));
  }

  function sellerBestReportTrace(rule, verdictTolerance) {
    if (rule.family === "diagonal-affine") {
      return mirrorBestReportTrace(profileBestReportTrace(
        diagonalSellerMirrorProfile(rule), verdictTolerance
      ));
    }
    if (rule.family !== "revenue-threshold") {
      resolveVerdictTolerance(verdictTolerance);
      return Object.freeze([
        traceSegment("truthful", 0, 1, 0, 1, true, true)
      ]);
    }
    return mirrorBestReportTrace(
      buyerBestReportTrace(sellerMirrorRule(rule), verdictTolerance)
    );
  }

  function sellerDeviationUtilityRange(rule) {
    if (rule.family === "revenue-threshold") {
      return buyerDeviationUtilityRange(sellerMirrorRule(rule));
    }
    validateRule(rule);
    var values = [];
    sellerInterimRule(rule).pieces.forEach(function (piece) {
      [0, 1].forEach(function (trueCost) {
        var utility = [
          (piece.payment[0] || 0) -
            trueCost * (piece.allocation[0] || 0),
          (piece.payment[1] || 0) -
            trueCost * (piece.allocation[1] || 0),
          piece.payment[2] || 0
        ];
        var range = polynomialRangeOnInterval(
          utility, piece.lower, piece.upper
        );
        values.push(range.min, range.max);
      });
    });
    return rangeFromValues(values);
  }

  function sellerMaximumDeviationGain(rule) {
    if (rule.family === "diagonal-affine") {
      return profileMaximumGainDetails(
        diagonalSellerMirrorProfile(rule)
      ).maximumGain;
    }
    if (rule.family !== "revenue-threshold") {
      validateRule(rule);
      return 0;
    }
    return buyerMaximumDeviationGain(sellerMirrorRule(rule));
  }

  function sellerWorstType(rule) {
    if (rule.family === "diagonal-affine") {
      return 1 - profileMaximumGainDetails(
        diagonalSellerMirrorProfile(rule)
      ).worstType;
    }
    if (rule.family !== "revenue-threshold") {
      validateRule(rule);
      return 0;
    }
    return 1 - buyerWorstType(sellerMirrorRule(rule));
  }

  function substituteOneMinus(coefficients) {
    return trimInterimPolynomial([
      (coefficients[0] || 0) + (coefficients[1] || 0) +
        (coefficients[2] || 0),
      -(coefficients[1] || 0) - 2 * (coefficients[2] || 0),
      coefficients[2] || 0
    ]);
  }

  function trimInterimPolynomial(coefficients) {
    while (coefficients.length > 1 &&
        coefficients[coefficients.length - 1] === 0) {
      coefficients.pop();
    }
    return coefficients;
  }

  function sellerMirrorInterimPieces(rule) {
    return sellerInterimRule(rule).pieces.slice().reverse().map(function (piece) {
      var allocation = substituteOneMinus(piece.allocation);
      var receipt = substituteOneMinus(piece.payment);
      var payment = trimInterimPolynomial([0, 1, 2].map(function (index) {
        return (allocation[index] || 0) - (receipt[index] || 0);
      }));
      return freezeInterimPiece(
        1 - piece.upper,
        1 - piece.lower,
        piece.upperClosed !== false,
        piece.lowerClosed !== false,
        allocation,
        payment
      );
    });
  }

  function sellerEnvelopeResidual(rule, verdictTolerance) {
    if (rule.family !== "revenue-threshold") {
      validateRule(rule);
      return checkBuyerEnvelopeResidual(
        sellerMirrorInterimPieces(rule), verdictTolerance
      );
    }
    var mirror = sellerMirrorRule(rule);
    var interim = buyerInterimRule(mirror);
    return checkBuyerEnvelopeResidual(
      [interim.noTrade, interim.trade], verdictTolerance
    );
  }

  function sellerIcDiagnostics(rule) {
    validateRule(rule);
    var maximumGain = sellerMaximumDeviationGain(rule);
    var maximumExPostGain = maximumExPostDeviationGain(rule, "seller");
    return {
      holds: maximumGain <= VERDICT_TOLERANCE,
      dsicHolds: maximumExPostGain <= VERDICT_TOLERANCE,
      maximumGain: maximumGain,
      maximumExPostGain: maximumExPostGain,
      worstTrueCost: sellerWorstType(rule),
      range: sellerDeviationUtilityRange(rule),
      bestReportTrace: sellerBestReportTrace(rule),
      envelopeResidual: sellerEnvelopeResidual(rule)
    };
  }

  function diagnosticRange(rule, field) {
    if (field === "buyerIc") {
      return buyerDeviationUtilityRange(rule);
    }
    if (field === "sellerIc") {
      return sellerDeviationUtilityRange(rule);
    }
    if (field === "buyerPayoff") {
      return truthfulPayoffRange(rule, "buyer");
    }
    if (field === "sellerPayoff") {
      return truthfulPayoffRange(rule, "seller");
    }
    if (field === "revenue") {
      return revenueRange(rule);
    }
    if (field === "efficiency") {
      validateRule(rule);
      var exactEfficient = rule.family === "balanced-agv" ||
        (rule.family === "diagonal-affine" &&
          rule.parameters.threshold === 0) ||
        (rule.family === "revenue-threshold" &&
          rule.parameters.threshold === 0);
      return { min: 0, max: exactEfficient ? 0 : 1 };
    }
    throw new RangeError("Unknown formula diagnostic field.");
  }

  function diagnosticEvaluator(rule, field) {
    validateRule(rule);
    if (field === "buyerIc") {
      return buyerDeviationEvaluator(rule);
    }
    if (field === "sellerIc") {
      return sellerDeviationEvaluator(rule);
    }
    if (field !== "buyerPayoff" && field !== "sellerPayoff" &&
        field !== "revenue" && field !== "efficiency") {
      throw new RangeError("Unknown formula diagnostic field.");
    }
    if (rule.family === "revenue-threshold") {
      var revenueThreshold = rule.parameters.threshold;
      var buyerMarkup = rule.parameters.buyerMarkup;
      var sellerDiscount = rule.parameters.sellerDiscount;
      return function (v, c) {
        var allocation = tradesAt(revenueThreshold, v, c) ? 1 : 0;
        if (field === "buyerPayoff") {
          return allocation ? v - c - buyerMarkup : 0;
        }
        if (field === "sellerPayoff") {
          return allocation ? v - c - sellerDiscount : 0;
        }
        if (field === "revenue") {
          return allocation ? buyerMarkup + sellerDiscount - (v - c) : 0;
        }
        var efficientAllocation = v >= c ? 1 : 0;
        return {
          q: allocation,
          efficient: efficientAllocation,
          over: Math.max(0, allocation - efficientAllocation),
          under: Math.max(0, efficientAllocation - allocation)
        };
      };
    }
    var family = rule.family;
    var threshold = rule.parameters.threshold;
    var buyerPrice = rule.parameters.buyerPrice;
    var sellerPrice = rule.parameters.sellerPrice;
    var noTradePolynomial;
    var tradePolynomial;
    if (field === "buyerPayoff") {
      noTradePolynomial = buyerPayoffPolynomial(rule.regions[0]);
      tradePolynomial = buyerPayoffPolynomial(rule.regions[1]);
    } else if (field === "sellerPayoff") {
      noTradePolynomial = sellerPayoffPolynomial(rule.regions[0]);
      tradePolynomial = sellerPayoffPolynomial(rule.regions[1]);
    } else if (field === "revenue") {
      noTradePolynomial = revenuePolynomial(rule.regions[0]);
      tradePolynomial = revenuePolynomial(rule.regions[1]);
    }
    return function (v, c) {
      var trades = family === "posted-price" ?
        v >= buyerPrice && c <= sellerPrice :
        (family === "balanced-agv" ? v >= c : tradesAt(threshold, v, c));
      if (field !== "efficiency") {
        return evaluatePolynomial(
          trades ? tradePolynomial : noTradePolynomial, v, c
        );
      }
      var allocation = trades ? 1 : 0;
      var efficient = v >= c ? 1 : 0;
      return {
        q: allocation,
        efficient: efficient,
        over: Math.max(0, allocation - efficient),
        under: Math.max(0, efficient - allocation)
      };
    };
  }

  function diagnosticValueAt(rule, field, x, y) {
    var boundedX = validateUnitValue(x, "diagnostic horizontal value");
    var boundedY = validateUnitValue(y, "diagnostic vertical value");
    return diagnosticEvaluator(rule, field)(boundedX, boundedY);
  }

  function exAnteIntegrals(rule) {
    validateRule(rule);
    if (rule.family === "posted-price") {
      var buyerPrice = rule.parameters.buyerPrice;
      var sellerPrice = rule.parameters.sellerPrice;
      var postedTrade = (1 - buyerPrice) * sellerPrice;
      var postedBuyerValue = 0.5 * sellerPrice *
        (1 - buyerPrice * buyerPrice);
      var postedSellerCost = 0.5 * (1 - buyerPrice) *
        sellerPrice * sellerPrice;
      var postedBuyerPayment = buyerPrice * postedTrade;
      var postedSellerPayment = sellerPrice * postedTrade;
      return {
        tradeProbability: postedTrade,
        welfare: postedBuyerValue - postedSellerCost,
        buyerPayment: postedBuyerPayment,
        sellerPayment: postedSellerPayment,
        buyerUtility: postedBuyerValue - postedBuyerPayment,
        sellerUtility: postedSellerPayment - postedSellerCost,
        revenue: postedBuyerPayment - postedSellerPayment
      };
    }
    if (rule.family === "balanced-agv") {
      return {
        tradeProbability: 0.5,
        welfare: 1 / 6,
        buyerPayment: rule.parameters.constant,
        sellerPayment: rule.parameters.constant,
        buyerUtility: 1 / 3 - rule.parameters.constant,
        sellerUtility: rule.parameters.constant - 1 / 6,
        revenue: 0
      };
    }
    var threshold = rule.parameters.threshold;
    var length = 1 - threshold;
    var tradeProbability = 0.5 * length * length;
    var welfare = 1 / 6 - 0.5 * threshold * threshold +
      threshold * threshold * threshold / 3;
    if (rule.family === "diagonal-affine") {
      var buyerValue = 1 / 3 - threshold / 2 +
        threshold * threshold * threshold / 6;
      var sellerCost = length * length * length / 6;
      var integrateTradePayment = function (payment) {
        return payment[0] * tradeProbability +
          payment[1] * buyerValue + payment[2] * sellerCost;
      };
      var diagonalBuyerPayment = integrateTradePayment(
        rule.regions[1].fields.pB
      );
      var diagonalSellerPayment = integrateTradePayment(
        rule.regions[1].fields.pS
      );
      return {
        tradeProbability: tradeProbability,
        welfare: welfare,
        buyerPayment: diagonalBuyerPayment,
        sellerPayment: diagonalSellerPayment,
        buyerUtility: buyerValue - diagonalBuyerPayment,
        sellerUtility: diagonalSellerPayment - sellerCost,
        revenue: diagonalBuyerPayment - diagonalSellerPayment
      };
    }
    var expectedBuyerPayment = length * length * length / 6 +
      rule.parameters.buyerMarkup * tradeProbability;
    var expectedSellerPayment = (threshold - rule.parameters.sellerDiscount) *
      tradeProbability + length * length * length / 3;
    return {
      tradeProbability: tradeProbability,
      welfare: welfare,
      buyerPayment: expectedBuyerPayment,
      sellerPayment: expectedSellerPayment,
      buyerUtility: welfare -
        rule.parameters.buyerMarkup * tradeProbability,
      sellerUtility: welfare -
        rule.parameters.sellerDiscount * tradeProbability,
      revenue: expectedBuyerPayment - expectedSellerPayment
    };
  }

  function dependencyKey(rule, field) {
    validateRule(rule);
    var dependencies = rule.dependencies[field];
    if (!dependencies) {
      throw new RangeError("Unknown formula field dependency.");
    }
    return field + ":" + rule.preset + ":" + dependencies.map(function (parameter) {
      return rule.parameters[parameter].toPrecision(12);
    }).join(":");
  }

  function fieldDependencies(rule, field) {
    validateRule(rule);
    if (!rule.dependencies[field]) {
      throw new RangeError("Unknown formula field dependency.");
    }
    return rule.dependencies[field];
  }

  function maximumEfficiencyLoss(rule) {
    if (rule.family === "balanced-agv" ||
        (rule.family !== "posted-price" && rule.parameters.threshold === 0)) {
      return { loss: 0, v: 0, c: 0, attained: true, approachFrom: null };
    }
    if (rule.family !== "posted-price") {
      var threshold = rule.parameters.threshold;
      // Weak trade inequalities leave the worst missing-trade loss as a limit.
      return {
        loss: threshold, v: threshold, c: 0, attained: false,
        approachFrom: { v: threshold / 2, c: 0 }
      };
    }
    var buyerPrice = rule.parameters.buyerPrice;
    var sellerPrice = rule.parameters.sellerPrice;
    var best = {
      loss: Math.max(0, sellerPrice - buyerPrice),
      v: buyerPrice, c: sellerPrice, attained: true, approachFrom: null
    };
    // The two open no-trade strips and the closed trade rectangle exhaust
    // the possible extrema. Keep the attained point if largest losses tie.
    if (buyerPrice > best.loss) {
      best = {
        loss: buyerPrice, v: buyerPrice, c: 0, attained: false,
        approachFrom: { v: buyerPrice / 2, c: 0 }
      };
    }
    if (1 - sellerPrice > best.loss) {
      best = {
        loss: 1 - sellerPrice, v: 1, c: sellerPrice, attained: false,
        approachFrom: { v: 1, c: (1 + sellerPrice) / 2 }
      };
    }
    return best;
  }

  function summarize(rule) {
    validateRule(rule);
    var buyerIc = buyerIcDiagnostics(rule);
    var sellerIc = sellerIcDiagnostics(rule);
    var exAnte = exAnteIntegrals(rule);
    var buyerPayoff = truthfulPayoffRange(rule, "buyer");
    var sellerPayoff = truthfulPayoffRange(rule, "seller");
    var buyerInterimPayoff = interimTruthfulPayoffRange(rule, "buyer");
    var sellerInterimPayoff = interimTruthfulPayoffRange(rule, "seller");
    var revenue = revenueRange(rule);
    var firstBestWelfare = 1 / 6;
    return {
      rule: rule,
      ranges: {
        q: fieldRange(rule, "q"),
        pB: fieldRange(rule, "pB"),
        pS: fieldRange(rule, "pS"),
        buyerIc: buyerIc.range,
        sellerIc: sellerIc.range,
        buyerPayoff: buyerPayoff,
        sellerPayoff: sellerPayoff,
        revenue: revenue,
        efficiency: diagnosticRange(rule, "efficiency")
      },
      buyerInterim: buyerInterimRule(rule),
      sellerInterim: sellerInterimRule(rule),
      buyerIc: buyerIc,
      sellerIc: sellerIc,
      interimPayoffRanges: {
        buyer: buyerInterimPayoff,
        seller: sellerInterimPayoff
      },
      exAnte: exAnte,
      exPostEfficiency: maximumEfficiencyLoss(rule),
      verdicts: {
        buyerBic: buyerIc.holds,
        sellerBic: sellerIc.holds,
        buyerDsic: buyerIc.dsicHolds,
        sellerDsic: sellerIc.dsicHolds,
        exAnteBuyerIr: exAnte.buyerUtility >= -VERDICT_TOLERANCE,
        interimBuyerIr: buyerInterimPayoff.min >= -VERDICT_TOLERANCE,
        exPostBuyerIr: buyerPayoff.min >= -VERDICT_TOLERANCE,
        exAnteSellerIr: exAnte.sellerUtility >= -VERDICT_TOLERANCE,
        interimSellerIr: sellerInterimPayoff.min >= -VERDICT_TOLERANCE,
        exPostSellerIr: sellerPayoff.min >= -VERDICT_TOLERANCE,
        exPostBudgetBalanced:
          Math.abs(revenue.min) <= VERDICT_TOLERANCE &&
          Math.abs(revenue.max) <= VERDICT_TOLERANCE,
        exPostNoDeficit: revenue.min >= -VERDICT_TOLERANCE,
        expectedBudgetBalanced:
          Math.abs(exAnte.revenue) <= VERDICT_TOLERANCE,
        expectedNoDeficit: exAnte.revenue >= -VERDICT_TOLERANCE,
        expectedRevenue: exAnte.revenue,
        tradeProbability: exAnte.tradeProbability,
        welfare: exAnte.welfare,
        firstBestWelfare: firstBestWelfare,
        efficiencyLoss: firstBestWelfare - exAnte.welfare
      }
    };
  }

  global.BargainingSandboxFormulaModel = Object.freeze({
    VERDICT_TOLERANCE: VERDICT_TOLERANCE,
    ALGEBRA_TOLERANCE: ALGEBRA_TOLERANCE,
    FIELD_DEPENDENCIES: FIELD_DEPENDENCIES,
    createVcgRule: createVcgRule,
    createPostedPriceRule: createPostedPriceRule,
    createAgvRule: createAgvRule,
    createSplitDifferenceRule: createSplitDifferenceRule,
    createChatterjeeSamuelsonRule: createChatterjeeSamuelsonRule,
    createRevenueThresholdRule: createRevenueThresholdRule,
    evaluatePolynomial: evaluatePolynomial,
    regionAt: regionAt,
    fieldValueAt: fieldValueAt,
    fieldEvaluator: fieldEvaluator,
    ruleValuesAt: ruleValuesAt,
    fieldRange: fieldRange,
    truthfulPayoffValuesAt: truthfulPayoffValuesAt,
    allocationErrorAt: allocationErrorAt,
    truthfulPayoffRange: truthfulPayoffRange,
    revenueRange: revenueRange,
    interimTruthfulPayoffRange: interimTruthfulPayoffRange,
    buyerInterimRule: buyerInterimRule,
    sellerInterimRule: sellerInterimRule,
    checkBuyerEnvelopeResidual: checkBuyerEnvelopeResidual,
    buyerInterimAllocation: buyerInterimAllocation,
    buyerInterimPayment: buyerInterimPayment,
    buyerInterimDeviationUtility: buyerInterimDeviationUtility,
    buyerDeviationEvaluator: buyerDeviationEvaluator,
    buyerBestReport: buyerBestReport,
    buyerBestReportTrace: buyerBestReportTrace,
    buyerDeviationUtilityRange: buyerDeviationUtilityRange,
    buyerMaximumDeviationGain: buyerMaximumDeviationGain,
    buyerIcDiagnostics: buyerIcDiagnostics,
    sellerInterimAllocation: sellerInterimAllocation,
    sellerInterimPayment: sellerInterimPayment,
    sellerInterimDeviationUtility: sellerInterimDeviationUtility,
    sellerDeviationEvaluator: sellerDeviationEvaluator,
    sellerBestReport: sellerBestReport,
    sellerBestReportTrace: sellerBestReportTrace,
    sellerDeviationUtilityRange: sellerDeviationUtilityRange,
    sellerMaximumDeviationGain: sellerMaximumDeviationGain,
    sellerEnvelopeResidual: sellerEnvelopeResidual,
    sellerIcDiagnostics: sellerIcDiagnostics,
    diagnosticRange: diagnosticRange,
    diagnosticEvaluator: diagnosticEvaluator,
    diagnosticValueAt: diagnosticValueAt,
    exAnteIntegrals: exAnteIntegrals,
    fieldDependencies: fieldDependencies,
    dependencyKey: dependencyKey,
    summarize: summarize
  });
})(window);
