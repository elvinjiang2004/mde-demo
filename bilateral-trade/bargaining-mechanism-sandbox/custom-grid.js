(function (global) {
  "use strict";

  var shared = global.BilateralTradeEnvelope;
  var numbers = global.NumberUtils;
  var isFiniteNumber = numbers.isFiniteNumber;
  var clamp = numbers.clamp;
  var RESOLUTION = 20;
  var CELL_SIZE = 1 / RESOLUTION;
  var PATCH_LENGTH = 6;
  var VERDICT_TOLERANCE = 1e-7;
  var ALGEBRA_TOLERANCE = 1e-12;
  var MAX_PAYMENT_COEFFICIENT = 1e140;
  var TRACE_SAMPLES = 61;
  var EMPTY_POINTS = Object.freeze([]);
  var FIELD_DEPENDENCIES = Object.freeze({
    q: Object.freeze(["q"]),
    pB: Object.freeze(["pB"]),
    pS: Object.freeze(["pS"]),
    buyerIc: Object.freeze(["q", "pB"]),
    sellerIc: Object.freeze(["q", "pS"]),
    buyerPayoff: Object.freeze(["q", "pB"]),
    sellerPayoff: Object.freeze(["q", "pS"]),
    revenue: Object.freeze(["pB", "pS"]),
    efficiency: Object.freeze(["q"])
  });
  var interimCache = new WeakMap();
  var analysisCache = new WeakMap();

  function createScalarGrid(value) {
    var fill = value === undefined ? 0 : value;
    if (!isFiniteNumber(fill) || fill < 0 || fill > 1) {
      throw new RangeError("The allocation fill must lie in [0, 1].");
    }
    return shared.constantGrid(RESOLUTION, fill);
  }

  function createEfficientGrid() {
    return shared.efficientGrid(RESOLUTION);
  }

  function constantPatch(value) {
    if (!isFiniteNumber(value) || Math.abs(value) > MAX_PAYMENT_COEFFICIENT) {
      throw new RangeError("The payment fill must lie in the numerical domain.");
    }
    return [value, 0, 0, 0, 0, 0];
  }

  function createPatchGrid(value) {
    var fill = value === undefined ? 0 : value;
    return shared.createGrid(
      RESOLUTION,
      function () { return constantPatch(fill); },
      function () { return constantPatch(fill); }
    );
  }

  function validateScalarGrid(grid) {
    var i;
    var j;
    if (!grid || !Array.isArray(grid.lower) || !Array.isArray(grid.upper) ||
        grid.lower.length !== RESOLUTION || grid.upper.length !== RESOLUTION) {
      throw new TypeError("A Custom allocation must contain two 20 by 20 arrays.");
    }
    for (i = 0; i < RESOLUTION; i += 1) {
      if (!Array.isArray(grid.lower[i]) || !Array.isArray(grid.upper[i]) ||
          grid.lower[i].length !== RESOLUTION ||
          grid.upper[i].length !== RESOLUTION) {
        throw new TypeError("A Custom allocation must contain two 20 by 20 arrays.");
      }
      for (j = 0; j < RESOLUTION; j += 1) {
        if (!isFiniteNumber(grid.lower[i][j]) ||
            !isFiniteNumber(grid.upper[i][j]) ||
            grid.lower[i][j] < 0 || grid.lower[i][j] > 1 ||
            grid.upper[i][j] < 0 || grid.upper[i][j] > 1) {
          throw new RangeError("Every Custom allocation value must lie in [0, 1].");
        }
      }
    }
    return grid;
  }

  function validatePatchGrid(grid) {
    var i;
    var j;
    var k;
    if (!grid || !Array.isArray(grid.lower) || !Array.isArray(grid.upper) ||
        grid.lower.length !== RESOLUTION || grid.upper.length !== RESOLUTION) {
      throw new TypeError("A Custom payment must contain two 20 by 20 arrays.");
    }
    for (i = 0; i < RESOLUTION; i += 1) {
      if (!Array.isArray(grid.lower[i]) || !Array.isArray(grid.upper[i]) ||
          grid.lower[i].length !== RESOLUTION ||
          grid.upper[i].length !== RESOLUTION) {
        throw new TypeError("A Custom payment must contain two 20 by 20 arrays.");
      }
      for (j = 0; j < RESOLUTION; j += 1) {
        [grid.lower[i][j], grid.upper[i][j]].forEach(function (patch) {
          if (!Array.isArray(patch) || patch.length !== PATCH_LENGTH) {
            throw new TypeError("Every Custom payment patch needs six coefficients.");
          }
          for (k = 0; k < PATCH_LENGTH; k += 1) {
            if (!isFiniteNumber(patch[k]) ||
                Math.abs(patch[k]) > MAX_PAYMENT_COEFFICIENT) {
              throw new RangeError(
                "Every Custom payment coefficient must lie in the numerical domain."
              );
            }
          }
          if (patch[3] !== 0 || patch[4] !== 0 || patch[5] !== 0) {
            throw new RangeError("Custom payment patches must be affine.");
          }
        });
      }
    }
    return grid;
  }

  function resolvedRevision(value) {
    return isFiniteNumber(value) ? value : 0;
  }

  function createRule(q, pB, pS, revisions) {
    validateScalarGrid(q);
    validatePatchGrid(pB);
    validatePatchGrid(pS);
    var source = revisions || {};
    return Object.freeze({
      representation: "triangle-grid",
      family: "custom-grid",
      preset: "custom",
      q: q,
      pB: pB,
      pS: pS,
      revisions: Object.freeze({
        q: resolvedRevision(source.q),
        pB: resolvedRevision(source.pB),
        pS: resolvedRevision(source.pS),
        paymentMode: source.paymentMode === "fixed" ? "fixed" : "manual"
      })
    });
  }

  function validateRule(rule) {
    if (!rule || rule.representation !== "triangle-grid" ||
        rule.family !== "custom-grid" || !rule.q || !rule.pB || !rule.pS ||
        !rule.revisions || rule.q.lower.length !== RESOLUTION ||
        rule.q.upper.length !== RESOLUTION) {
      throw new TypeError("Expected a supported 20 by 20 Custom rule.");
    }
    return rule;
  }

  function validateUnitValue(value, label) {
    if (!isFiniteNumber(value)) {
      throw new TypeError("The " + label + " must be finite.");
    }
    if (value < 0 || value > 1) {
      throw new RangeError("The " + label + " must lie in [0, 1].");
    }
    return value;
  }

  function zeroBoundaryPayments(q) {
    validateScalarGrid(q);
    return shared.zeroBoundaryPayments(q);
  }

  function fieldGrid(rule, field) {
    if (field === "q") {
      return rule.q;
    }
    if (field === "pB") {
      return rule.pB;
    }
    if (field === "pS") {
      return rule.pS;
    }
    throw new RangeError("Unknown Custom rule field.");
  }

  function fieldEvaluator(rule, field) {
    validateRule(rule);
    var grid = fieldGrid(rule, field);
    return field === "q" ?
      function (v, c) { return shared.scalarGridValueAt(grid, v, c); } :
      function (v, c) { return shared.patchGridValueAt(grid, v, c); };
  }

  function fieldValueAt(rule, field, v, c) {
    validateUnitValue(v, "buyer value");
    validateUnitValue(c, "seller value");
    return fieldEvaluator(rule, field)(v, c);
  }

  function ruleValuesAt(rule, v, c) {
    validateRule(rule);
    validateUnitValue(v, "buyer value");
    validateUnitValue(c, "seller value");
    return {
      q: shared.scalarGridValueAt(rule.q, v, c),
      pB: shared.patchGridValueAt(rule.pB, v, c),
      pS: shared.patchGridValueAt(rule.pS, v, c)
    };
  }

  function scalarGridRange(grid) {
    var minimum = Infinity;
    var maximum = -Infinity;
    var i;
    var j;
    for (i = 0; i < RESOLUTION; i += 1) {
      for (j = 0; j < RESOLUTION; j += 1) {
        minimum = Math.min(minimum, grid.lower[i][j], grid.upper[i][j]);
        maximum = Math.max(maximum, grid.lower[i][j], grid.upper[i][j]);
      }
    }
    return { min: minimum, max: maximum };
  }

  function fieldRange(rule, field) {
    validateRule(rule);
    return field === "q" ? scalarGridRange(rule.q) :
      shared.affinePatchGridRange(fieldGrid(rule, field));
  }

  function interimData(rule) {
    validateRule(rule);
    var cached = interimCache.get(rule);
    if (!cached) {
      cached = shared.interimRulePolynomials(rule);
      interimCache.set(rule, cached);
    }
    return cached;
  }

  function intervalIndex(value) {
    return Math.min(RESOLUTION - 1, Math.floor(clamp(value, 0, 1) / CELL_SIZE));
  }

  function evaluateInterim(polynomials, value) {
    return shared.evaluatePolynomial(polynomials[intervalIndex(value)], value);
  }

  function interimPieces(allocation, payment) {
    return allocation.map(function (polynomial, index) {
      return Object.freeze({
        lower: index * CELL_SIZE,
        upper: (index + 1) * CELL_SIZE,
        lowerClosed: true,
        upperClosed: index === RESOLUTION - 1,
        allocation: Object.freeze(polynomial.slice()),
        payment: Object.freeze(payment[index].slice())
      });
    });
  }

  function buyerInterimRule(rule) {
    var interim = interimData(rule);
    return Object.freeze({
      breakpoint: null,
      pieces: Object.freeze(interimPieces(
        interim.buyerAllocation, interim.buyerPayment
      ))
    });
  }

  function sellerInterimRule(rule) {
    var interim = interimData(rule);
    return Object.freeze({
      breakpoint: null,
      pieces: Object.freeze(interimPieces(
        interim.sellerAllocation, interim.sellerPayment
      ))
    });
  }

  function buyerInterimAllocation(rule, report) {
    return evaluateInterim(
      interimData(rule).buyerAllocation,
      validateUnitValue(report, "buyer report")
    );
  }

  function buyerInterimPayment(rule, report) {
    return evaluateInterim(
      interimData(rule).buyerPayment,
      validateUnitValue(report, "buyer report")
    );
  }

  function sellerInterimAllocation(rule, report) {
    return evaluateInterim(
      interimData(rule).sellerAllocation,
      validateUnitValue(report, "seller report")
    );
  }

  function sellerInterimPayment(rule, report) {
    return evaluateInterim(
      interimData(rule).sellerPayment,
      validateUnitValue(report, "seller report")
    );
  }

  function buyerInterimDeviationUtility(rule, trueValue, report) {
    validateUnitValue(trueValue, "true buyer value");
    validateUnitValue(report, "buyer report");
    return shared.buyerInterimDeviationUtility(
      interimData(rule), trueValue, report
    );
  }

  function sellerInterimDeviationUtility(rule, trueCost, report) {
    validateUnitValue(trueCost, "true seller cost");
    validateUnitValue(report, "seller report");
    return shared.sellerInterimDeviationUtility(
      interimData(rule), trueCost, report
    );
  }

  function bestReport(rule, agent, trueType, verdictTolerance) {
    var boundedType = validateUnitValue(trueType, "true type");
    var tolerance = verdictTolerance === undefined ?
      VERDICT_TOLERANCE : verdictTolerance;
    if (!isFiniteNumber(tolerance) || tolerance < 0) {
      throw new RangeError("The verdict tolerance must be finite and nonnegative.");
    }
    var result = agent === "buyer" ?
      shared.buyerBestInterimReport(interimData(rule), boundedType, {
        algebraTolerance: ALGEBRA_TOLERANCE,
        verdictTolerance: tolerance
      }) :
      shared.sellerBestInterimReport(interimData(rule), boundedType, {
        algebraTolerance: ALGEBRA_TOLERANCE,
        verdictTolerance: tolerance
      });
    return {
      report: result.report,
      utility: result.utility,
      truthfulUtility: result.truthfulUtility,
      maximumUtility: result.utility,
      maximumGain: result.gain,
      truthfulTie: result.gain <= tolerance
    };
  }

  function buyerBestReport(rule, trueValue, verdictTolerance) {
    return bestReport(rule, "buyer", trueValue, verdictTolerance);
  }

  function sellerBestReport(rule, trueCost, verdictTolerance) {
    return bestReport(rule, "seller", trueCost, verdictTolerance);
  }

  function antiderivativePolynomial(poly) {
    var result = new Array(poly.length + 1).fill(0);
    var i;
    for (i = 0; i < poly.length; i += 1) {
      result[i + 1] = poly[i] / (i + 1);
    }
    return result;
  }

  function integratePolynomial(poly, lower, upper) {
    var primitive = antiderivativePolynomial(poly);
    return shared.evaluatePolynomial(primitive, upper) -
      shared.evaluatePolynomial(primitive, lower);
  }

  function composeAffine(poly, intercept, slope) {
    var affine = [intercept, slope];
    var power = [1];
    var result = [0];
    var i;
    for (i = 0; i < poly.length; i += 1) {
      result = shared.addPolynomials(
        result, shared.scalePolynomial(power, poly[i])
      );
      power = shared.multiplyPolynomials(power, affine);
    }
    return result;
  }

  function buyerEnvelopePaymentPolynomials(allocation) {
    var result = new Array(RESOLUTION);
    var cumulative = 0;
    var x = [0, 1];
    var i;
    for (i = 0; i < RESOLUTION; i += 1) {
      var start = i * CELL_SIZE;
      var end = (i + 1) * CELL_SIZE;
      var primitive = antiderivativePolynomial(allocation[i]);
      var localIntegral = primitive.slice();
      localIntegral[0] = (localIntegral[0] || 0) + cumulative -
        shared.evaluatePolynomial(primitive, start);
      result[i] = shared.subtractPolynomials(
        shared.multiplyPolynomials(x, allocation[i]), localIntegral
      );
      cumulative += integratePolynomial(allocation[i], start, end);
    }
    return result;
  }

  function sellerEnvelopePaymentPolynomials(allocation) {
    var result = new Array(RESOLUTION);
    var tail = 0;
    var x = [0, 1];
    var i;
    for (i = RESOLUTION - 1; i >= 0; i -= 1) {
      var start = i * CELL_SIZE;
      var end = (i + 1) * CELL_SIZE;
      var primitive = antiderivativePolynomial(allocation[i]);
      var tailIntegral = shared.scalePolynomial(primitive, -1);
      tailIntegral[0] = (tailIntegral[0] || 0) + tail +
        shared.evaluatePolynomial(primitive, end);
      result[i] = shared.addPolynomials(
        shared.multiplyPolynomials(x, allocation[i]), tailIntegral
      );
      tail += integratePolynomial(allocation[i], start, end);
    }
    return result;
  }

  function checkPiecewiseConstantOffset(actual, envelope) {
    var intervalViolations = new Array(RESOLUTION).fill(false);
    var reference = null;
    var maxViolation = 0;
    var i;
    for (i = 0; i < RESOLUTION; i += 1) {
      var difference = shared.subtractPolynomials(actual[i], envelope[i]);
      var local = composeAffine(difference, i * CELL_SIZE, CELL_SIZE);
      var k;
      if (reference === null) {
        reference = local[0] || 0;
      }
      for (k = 1; k < local.length; k += 1) {
        if (Math.abs(local[k]) > VERDICT_TOLERANCE) {
          intervalViolations[i] = true;
          maxViolation = Math.max(maxViolation, Math.abs(local[k]));
        }
      }
      if (Math.abs((local[0] || 0) - reference) > VERDICT_TOLERANCE) {
        intervalViolations[i] = true;
        maxViolation = Math.max(
          maxViolation, Math.abs((local[0] || 0) - reference)
        );
      }
    }
    return {
      holds: intervalViolations.every(function (value) { return !value; }),
      intervalViolations: intervalViolations,
      violationCount: intervalViolations.filter(function (value) {
        return value;
      }).length,
      maxViolation: maxViolation
    };
  }

  function bicImplementability(interim) {
    var buyer = shared.checkPiecewiseMonotonicity(
      interim.buyerAllocation, true, VERDICT_TOLERANCE
    );
    var seller = shared.checkPiecewiseMonotonicity(
      interim.sellerAllocation, false, VERDICT_TOLERANCE
    );
    return { buyer: buyer, seller: seller };
  }

  function checkBic(rule, interim) {
    var implementability = bicImplementability(interim);
    var buyerPayment = checkPiecewiseConstantOffset(
      interim.buyerPayment,
      buyerEnvelopePaymentPolynomials(interim.buyerAllocation)
    );
    var sellerPayment = checkPiecewiseConstantOffset(
      interim.sellerPayment,
      sellerEnvelopePaymentPolynomials(interim.sellerAllocation)
    );
    return {
      holds: implementability.buyer.holds && implementability.seller.holds &&
        buyerPayment.holds && sellerPayment.holds,
      buyer: {
        holds: implementability.buyer.holds && buyerPayment.holds,
        allocation: implementability.buyer,
        payment: buyerPayment
      },
      seller: {
        holds: implementability.seller.holds && sellerPayment.holds,
        allocation: implementability.seller,
        payment: sellerPayment
      }
    };
  }

  function checkBuyerDsicPayment(actual, envelope) {
    return shared.checkDsicPaymentOffsets(
      actual, envelope, "buyer", VERDICT_TOLERANCE
    );
  }

  function checkSellerDsicPayment(actual, envelope) {
    return shared.checkDsicPaymentOffsets(
      actual, envelope, "seller", VERDICT_TOLERANCE
    );
  }
  function checkDsic(rule) {
    var allocation = shared.checkDsicAllocation(rule.q, VERDICT_TOLERANCE);
    var envelope = shared.zeroBoundaryPayments(rule.q);
    var buyerPayment = checkBuyerDsicPayment(rule.pB, envelope.pB);
    var sellerPayment = checkSellerDsicPayment(rule.pS, envelope.pS);
    return {
      holds: allocation.holds && buyerPayment.holds && sellerPayment.holds,
      buyer: {
        holds: allocation.buyer.holds && buyerPayment.holds,
        allocation: allocation.buyer,
        payment: buyerPayment
      },
      seller: {
        holds: allocation.seller.holds && sellerPayment.holds,
        allocation: allocation.seller,
        payment: sellerPayment
      }
    };
  }

  function utilityPolynomials(interim) {
    var x = [0, 1];
    var buyer = new Array(RESOLUTION);
    var seller = new Array(RESOLUTION);
    var i;
    for (i = 0; i < RESOLUTION; i += 1) {
      buyer[i] = shared.subtractPolynomials(
        shared.multiplyPolynomials(x, interim.buyerAllocation[i]),
        interim.buyerPayment[i]
      );
      seller[i] = shared.subtractPolynomials(
        interim.sellerPayment[i],
        shared.multiplyPolynomials(x, interim.sellerAllocation[i])
      );
    }
    return { buyer: buyer, seller: seller };
  }

  function integratePatchOnTriangle(patch, i, j, isLower) {
    var diagonalIntercept = (j - i) * CELL_SIZE;
    var polynomial = isLower ?
      shared.subtractPolynomials(
        shared.verticalPrimitiveAt(patch, diagonalIntercept, 1),
        shared.verticalPrimitiveAt(patch, j * CELL_SIZE, 0)
      ) :
      shared.subtractPolynomials(
        shared.verticalPrimitiveAt(patch, (j + 1) * CELL_SIZE, 0),
        shared.verticalPrimitiveAt(patch, diagonalIntercept, 1)
      );
    return integratePolynomial(
      polynomial, i * CELL_SIZE, (i + 1) * CELL_SIZE
    );
  }

  function integratePatchGrid(grid) {
    var total = 0;
    var i;
    var j;
    for (i = 0; i < RESOLUTION; i += 1) {
      for (j = 0; j < RESOLUTION; j += 1) {
        total += integratePatchOnTriangle(grid.lower[i][j], i, j, true);
        total += integratePatchOnTriangle(grid.upper[i][j], i, j, false);
      }
    }
    return total;
  }

  function efficiencyRange(q) {
    var efficient = shared.efficientGrid(RESOLUTION);
    var maximum = 0;
    var i;
    var j;
    for (i = 0; i < RESOLUTION; i += 1) {
      for (j = 0; j < RESOLUTION; j += 1) {
        maximum = Math.max(
          maximum,
          Math.abs(q.lower[i][j] - efficient.lower[i][j]),
          Math.abs(q.upper[i][j] - efficient.upper[i][j])
        );
      }
    }
    return { min: 0, max: maximum };
  }

  // Exact affine slice-endpoint maximization; see architecture.md, custom-grid.js.
  function maximumExPostDeviationGain(rule, agent) {
    var buyer = agent === "buyer";
    var payments = buyer ? rule.pB : rule.pS;
    var sign = buyer ? 1 : -1;
    var maximum = 0;
    var strip;
    var ownCell;
    for (strip = 0; strip < RESOLUTION; strip += 1) {
      var slices = [[], []];
      for (ownCell = 0; ownCell < RESOLUTION; ownCell += 1) {
        var i = buyer ? ownCell : strip;
        var j = buyer ? strip : ownCell;
        [true, false].forEach(function (isLower) {
          var side = isLower ? "lower" : "upper";
          var patch = payments[side][i][j];
          shared.triangleVertices(i, j, isLower, RESOLUTION).forEach(function (point) {
            var otherType = buyer ? point.c : point.v;
            var endpoint = otherType === strip * CELL_SIZE ? 0 : 1;
            slices[endpoint].push({
              type: buyer ? point.v : point.c,
              q: rule.q[side][i][j],
              constant: patch[0],
              ownSlope: patch[buyer ? 1 : 2],
              otherSlope: patch[buyer ? 2 : 1]
            });
          });
        });
      }
      slices.forEach(function (candidates, endpoint) {
        var otherType = (strip + endpoint) * CELL_SIZE;
        candidates.forEach(function (truth) {
          candidates.forEach(function (report) {
            // Subtract common transfer coefficients before adding utility terms.
            var gain = sign * (
              (truth.constant - report.constant) +
              (truth.otherSlope - report.otherSlope) * otherType +
              truth.type * (report.q - truth.q + truth.ownSlope) -
              report.type * report.ownSlope
            );
            maximum = Math.max(maximum, gain);
          });
        });
      });
    }
    return maximum;
  }

  function analysis(rule) {
    validateRule(rule);
    var cached = analysisCache.get(rule);
    if (cached) {
      return cached;
    }
    var interim = interimData(rule);
    var bic = checkBic(rule, interim);
    var dsic = checkDsic(rule);
    var payoff = shared.truthfulPayoffPatches(rule);
    var revenue = shared.revenuePatches(rule);
    var utility = utilityPolynomials(interim);
    var deviation = shared.interimDeviationDiagnostics(interim, {
      traceSamples: TRACE_SAMPLES,
      algebraTolerance: ALGEBRA_TOLERANCE,
      verdictTolerance: VERDICT_TOLERANCE
    });
    var buyerPayoffRange = shared.affinePatchGridRange(payoff.buyer);
    var sellerPayoffRange = shared.affinePatchGridRange(payoff.seller);
    var revenueRange = shared.affinePatchGridRange(revenue);
    var buyerInterimRange = shared.piecewisePolynomialRange(
      utility.buyer, ALGEBRA_TOLERANCE
    );
    var sellerInterimRange = shared.piecewisePolynomialRange(
      utility.seller, ALGEBRA_TOLERANCE
    );
    var buyerPayment = integratePatchGrid(rule.pB);
    var sellerPayment = integratePatchGrid(rule.pS);
    var buyerUtility = integratePatchGrid(payoff.buyer);
    var sellerUtility = integratePatchGrid(payoff.seller);
    var welfare = shared.welfare(rule.q);
    cached = {
      interim: interim,
      bic: bic,
      dsic: dsic,
      exPostEfficiency: shared.maximumEfficiencyLoss(rule.q),
      maximumExPostGain: {
        buyer: maximumExPostDeviationGain(rule, "buyer"),
        seller: maximumExPostDeviationGain(rule, "seller")
      },
      payoff: payoff,
      revenuePatches: revenue,
      utility: utility,
      deviation: deviation,
      ranges: {
        q: scalarGridRange(rule.q),
        pB: shared.affinePatchGridRange(rule.pB),
        pS: shared.affinePatchGridRange(rule.pS),
        buyerIc: deviation.buyer.range,
        sellerIc: deviation.seller.range,
        buyerPayoff: buyerPayoffRange,
        sellerPayoff: sellerPayoffRange,
        revenue: revenueRange,
        efficiency: efficiencyRange(rule.q)
      },
      interimPayoffRanges: {
        buyer: buyerInterimRange,
        seller: sellerInterimRange
      },
      exAnte: {
        tradeProbability: shared.expectedTradeProbability(rule.q),
        welfare: welfare,
        buyerPayment: buyerPayment,
        sellerPayment: sellerPayment,
        buyerUtility: buyerUtility,
        sellerUtility: sellerUtility,
        revenue: buyerPayment - sellerPayment
      }
    };
    analysisCache.set(rule, cached);
    return cached;
  }

  function responsePoints(responses) {
    return Object.freeze(responses.map(function (response) {
      return Object.freeze({
        trueValue: response.trueType,
        report: response.report
      });
    }));
  }

  function icDiagnostic(rule, agent) {
    var data = analysis(rule);
    var buyer = agent === "buyer";
    var bic = buyer ? data.bic.buyer : data.bic.seller;
    var dsic = buyer ? data.dsic.buyer : data.dsic.seller;
    var deviation = buyer ? data.deviation.buyer : data.deviation.seller;
    return {
      holds: bic.holds,
      dsicHolds: dsic.holds,
      maximumGain: null,
      maximumExPostGain: data.maximumExPostGain[agent],
      range: deviation.range,
      bestReportTrace: EMPTY_POINTS,
      bestReportPoints: responsePoints(deviation.bestResponses),
      envelopeResidual: bic.payment
    };
  }

  function buyerIcDiagnostics(rule) {
    return icDiagnostic(rule, "buyer");
  }

  function sellerIcDiagnostics(rule) {
    return icDiagnostic(rule, "seller");
  }

  function buyerDeviationEvaluator(rule) {
    var interim = interimData(rule);
    return function (trueValue, report) {
      return shared.buyerInterimDeviationUtility(interim, trueValue, report);
    };
  }

  function sellerDeviationEvaluator(rule) {
    var interim = interimData(rule);
    return function (trueCost, report) {
      return shared.sellerInterimDeviationUtility(interim, trueCost, report);
    };
  }

  function truthfulPayoffValuesAt(rule, v, c) {
    var values = ruleValuesAt(rule, v, c);
    return {
      buyerPayoff: v * values.q - values.pB,
      sellerPayoff: values.pS - c * values.q,
      revenue: values.pB - values.pS
    };
  }

  function allocationErrorAt(rule, v, c) {
    validateRule(rule);
    return shared.allocationErrorAt(rule.q, v, c);
  }

  function diagnosticEvaluator(rule, field) {
    var data = analysis(rule);
    if (field === "buyerIc") {
      return buyerDeviationEvaluator(rule);
    }
    if (field === "sellerIc") {
      return sellerDeviationEvaluator(rule);
    }
    if (field === "efficiency") {
      return function (v, c) {
        return shared.allocationErrorAt(rule.q, v, c);
      };
    }
    var patches = field === "buyerPayoff" ? data.payoff.buyer :
      (field === "sellerPayoff" ? data.payoff.seller :
        (field === "revenue" ? data.revenuePatches : null));
    if (!patches) {
      throw new RangeError("Unknown Custom diagnostic field.");
    }
    return function (v, c) {
      return shared.patchGridValueAt(patches, v, c);
    };
  }

  function diagnosticValueAt(rule, field, x, y) {
    validateUnitValue(x, "diagnostic horizontal value");
    validateUnitValue(y, "diagnostic vertical value");
    return diagnosticEvaluator(rule, field)(x, y);
  }

  function diagnosticRange(rule, field) {
    var ranges = analysis(rule).ranges;
    if (!ranges[field]) {
      throw new RangeError("Unknown Custom diagnostic field.");
    }
    return ranges[field];
  }

  function dependencyToken(rule, field) {
    var revisions = rule.revisions;
    var buyerPayment = revisions.paymentMode === "fixed" ?
      "fixed:" + revisions.q : "manual:" + revisions.pB;
    var sellerPayment = revisions.paymentMode === "fixed" ?
      "fixed:" + revisions.q : "manual:" + revisions.pS;
    if (field === "q" || field === "efficiency") {
      return "q:" + revisions.q;
    }
    if (field === "pB") {
      return "pB:" + buyerPayment;
    }
    if (field === "pS") {
      return "pS:" + sellerPayment;
    }
    if (field === "buyerIc" || field === "buyerPayoff") {
      return "q:" + revisions.q + ":pB:" + buyerPayment;
    }
    if (field === "sellerIc" || field === "sellerPayoff") {
      return "q:" + revisions.q + ":pS:" + sellerPayment;
    }
    if (field === "revenue") {
      return "pB:" + buyerPayment + ":pS:" + sellerPayment;
    }
    throw new RangeError("Unknown Custom field dependency.");
  }

  function dependencyKey(rule, field) {
    validateRule(rule);
    return field + ":custom:" + dependencyToken(rule, field);
  }

  function fieldDependencies(rule, field) {
    validateRule(rule);
    if (!FIELD_DEPENDENCIES[field]) {
      throw new RangeError("Unknown Custom field dependency.");
    }
    return FIELD_DEPENDENCIES[field];
  }

  function summarize(rule) {
    var data = analysis(rule);
    var buyerIc = buyerIcDiagnostics(rule);
    var sellerIc = sellerIcDiagnostics(rule);
    var firstBest = shared.efficientWelfare(RESOLUTION);
    return {
      rule: rule,
      ranges: data.ranges,
      patches: {
        buyerPayoff: data.payoff.buyer,
        sellerPayoff: data.payoff.seller,
        revenue: data.revenuePatches
      },
      buyerInterim: buyerInterimRule(rule),
      sellerInterim: sellerInterimRule(rule),
      buyerIc: buyerIc,
      sellerIc: sellerIc,
      interimPayoffRanges: data.interimPayoffRanges,
      exAnte: data.exAnte,
      exPostEfficiency: data.exPostEfficiency,
      verdicts: {
        buyerBic: buyerIc.holds,
        sellerBic: sellerIc.holds,
        buyerDsic: buyerIc.dsicHolds,
        sellerDsic: sellerIc.dsicHolds,
        exAnteBuyerIr: data.exAnte.buyerUtility >= -VERDICT_TOLERANCE,
        interimBuyerIr:
          data.interimPayoffRanges.buyer.min >= -VERDICT_TOLERANCE,
        exPostBuyerIr: data.ranges.buyerPayoff.min >= -VERDICT_TOLERANCE,
        exAnteSellerIr: data.exAnte.sellerUtility >= -VERDICT_TOLERANCE,
        interimSellerIr:
          data.interimPayoffRanges.seller.min >= -VERDICT_TOLERANCE,
        exPostSellerIr: data.ranges.sellerPayoff.min >= -VERDICT_TOLERANCE,
        exPostBudgetBalanced:
          Math.abs(data.ranges.revenue.min) <= VERDICT_TOLERANCE &&
          Math.abs(data.ranges.revenue.max) <= VERDICT_TOLERANCE,
        exPostNoDeficit: data.ranges.revenue.min >= -VERDICT_TOLERANCE,
        expectedBudgetBalanced:
          Math.abs(data.exAnte.revenue) <= VERDICT_TOLERANCE,
        expectedNoDeficit: data.exAnte.revenue >= -VERDICT_TOLERANCE,
        expectedRevenue: data.exAnte.revenue,
        tradeProbability: data.exAnte.tradeProbability,
        welfare: data.exAnte.welfare,
        firstBestWelfare: firstBest,
        efficiencyLoss: firstBest - data.exAnte.welfare
      }
    };
  }

  function triangleCentroid(i, j, isLower) {
    return shared.triangleCentroid(i, j, isLower, RESOLUTION);
  }

  global.BargainingSandboxCustomGrid = Object.freeze({
    RESOLUTION: RESOLUTION,
    createScalarGrid: createScalarGrid,
    createEfficientGrid: createEfficientGrid,
    createPatchGrid: createPatchGrid,
    constantPatch: constantPatch,
    triangleCentroid: triangleCentroid,
    createRule: createRule,
    validateRule: validateRule,
    validateScalarGrid: validateScalarGrid,
    validatePatchGrid: validatePatchGrid,
    zeroBoundaryPayments: zeroBoundaryPayments,
    fieldValueAt: fieldValueAt,
    fieldEvaluator: fieldEvaluator,
    ruleValuesAt: ruleValuesAt,
    fieldRange: fieldRange,
    truthfulPayoffValuesAt: truthfulPayoffValuesAt,
    allocationErrorAt: allocationErrorAt,
    buyerInterimRule: buyerInterimRule,
    sellerInterimRule: sellerInterimRule,
    buyerInterimAllocation: buyerInterimAllocation,
    buyerInterimPayment: buyerInterimPayment,
    buyerInterimDeviationUtility: buyerInterimDeviationUtility,
    buyerDeviationEvaluator: buyerDeviationEvaluator,
    buyerBestReport: buyerBestReport,
    buyerIcDiagnostics: buyerIcDiagnostics,
    sellerInterimAllocation: sellerInterimAllocation,
    sellerInterimPayment: sellerInterimPayment,
    sellerInterimDeviationUtility: sellerInterimDeviationUtility,
    sellerDeviationEvaluator: sellerDeviationEvaluator,
    sellerBestReport: sellerBestReport,
    sellerIcDiagnostics: sellerIcDiagnostics,
    diagnosticRange: diagnosticRange,
    diagnosticEvaluator: diagnosticEvaluator,
    diagnosticValueAt: diagnosticValueAt,
    fieldDependencies: fieldDependencies,
    dependencyKey: dependencyKey,
    summarize: summarize
  });
})(window);
