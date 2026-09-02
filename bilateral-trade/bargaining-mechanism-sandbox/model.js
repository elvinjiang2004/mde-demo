(function (global) {
  "use strict";

  var CELL_RESOLUTION = 100;
  var CELL_SIZE = 1 / CELL_RESOLUTION;
  var VERDICT_TOLERANCE = 1e-7;
  var ALGEBRA_TOLERANCE = 1e-12;
  var PATCH_LENGTH = 6;
  var MAX_PAYMENT_COEFFICIENT = 1e140;
  var DEVIATION_TRACE_SAMPLES = 61;
  var clamp = global.NumberUtils.clamp;
  var isFiniteNumber = global.NumberUtils.isFiniteNumber;
  var sharedEnvelope = global.BilateralTradeEnvelope;
  var addPolynomials = sharedEnvelope.addPolynomials;
  var subtractPolynomials = sharedEnvelope.subtractPolynomials;
  var scalePolynomial = sharedEnvelope.scalePolynomial;
  var multiplyPolynomials = sharedEnvelope.multiplyPolynomials;
  var evaluatePolynomial = sharedEnvelope.evaluatePolynomial;
  var verticalPrimitiveAt = sharedEnvelope.verticalPrimitiveAt;
  var countTrue = sharedEnvelope.countTrueGrid;

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

  function resolveGridParameter(value, defaultValue, label) {
    var resolved = resolveUnitParameter(value, defaultValue, label);
    return Math.round(resolved * CELL_RESOLUTION) / CELL_RESOLUTION;
  }

  function resolveTradingThreshold(value, defaultValue) {
    return resolveGridParameter(
      value, defaultValue === undefined ? 0.25 : defaultValue,
      "trading threshold"
    );
  }

  function createScalarGrid(fillLower, fillUpper) {
    return sharedEnvelope.createGrid(
      CELL_RESOLUTION, fillLower, fillUpper
    );
  }

  function copyPatch(patch) {
    return patch.slice(0, PATCH_LENGTH);
  }

  function constantPatch(value) {
    return [value, 0, 0, 0, 0, 0];
  }

  function createPatchGrid(fillLower, fillUpper) {
    var lower = new Array(CELL_RESOLUTION);
    var upper = new Array(CELL_RESOLUTION);
    var i;
    var j;
    for (i = 0; i < CELL_RESOLUTION; i += 1) {
      lower[i] = new Array(CELL_RESOLUTION);
      upper[i] = new Array(CELL_RESOLUTION);
      for (j = 0; j < CELL_RESOLUTION; j += 1) {
        lower[i][j] = copyPatch(fillLower(i, j));
        upper[i][j] = copyPatch(fillUpper(i, j));
      }
    }
    return { lower: lower, upper: upper };
  }

  function constantScalarGrid(value) {
    return sharedEnvelope.constantGrid(CELL_RESOLUTION, value);
  }

  function constantPatchGrid(value) {
    return createPatchGrid(
      function () { return constantPatch(value); },
      function () { return constantPatch(value); }
    );
  }

  function efficientGrid() {
    return sharedEnvelope.efficientGrid(CELL_RESOLUTION);
  }

  function chatterjeeSamuelsonGrid(threshold) {
    return sharedEnvelope.chatterjeeSamuelsonGrid(
      CELL_RESOLUTION, resolveTradingThreshold(threshold)
    );
  }

  function validateScalarGrid(grid, requireProbability) {
    var i;
    var j;
    if (!grid || !Array.isArray(grid.lower) || !Array.isArray(grid.upper) ||
        grid.lower.length !== CELL_RESOLUTION || grid.upper.length !== CELL_RESOLUTION) {
      throw new TypeError("A scalar grid must contain two 100 by 100 arrays.");
    }
    for (i = 0; i < CELL_RESOLUTION; i += 1) {
      if (!Array.isArray(grid.lower[i]) || !Array.isArray(grid.upper[i]) ||
          grid.lower[i].length !== CELL_RESOLUTION ||
          grid.upper[i].length !== CELL_RESOLUTION) {
        throw new TypeError("A scalar grid must contain two 100 by 100 arrays.");
      }
      for (j = 0; j < CELL_RESOLUTION; j += 1) {
        if (!isFiniteNumber(grid.lower[i][j]) || !isFiniteNumber(grid.upper[i][j])) {
          throw new TypeError("Every scalar-grid value must be finite.");
        }
        if (requireProbability &&
            (grid.lower[i][j] < 0 || grid.lower[i][j] > 1 ||
             grid.upper[i][j] < 0 || grid.upper[i][j] > 1)) {
          throw new RangeError("Every allocation probability must lie in [0,1].");
        }
      }
    }
    return true;
  }

  function validatePatchGrid(grid) {
    var i;
    var j;
    var k;
    if (!grid || !Array.isArray(grid.lower) || !Array.isArray(grid.upper) ||
        grid.lower.length !== CELL_RESOLUTION || grid.upper.length !== CELL_RESOLUTION) {
      throw new TypeError("A patch grid must contain two 100 by 100 arrays.");
    }
    for (i = 0; i < CELL_RESOLUTION; i += 1) {
      if (!Array.isArray(grid.lower[i]) || !Array.isArray(grid.upper[i]) ||
          grid.lower[i].length !== CELL_RESOLUTION ||
          grid.upper[i].length !== CELL_RESOLUTION) {
        throw new TypeError("A patch grid must contain two 100 by 100 arrays.");
      }
      for (j = 0; j < CELL_RESOLUTION; j += 1) {
        [grid.lower[i][j], grid.upper[i][j]].forEach(function (patch) {
          if (!Array.isArray(patch) || patch.length !== PATCH_LENGTH) {
            throw new TypeError("Every payment patch must have six coefficients.");
          }
          for (k = 0; k < PATCH_LENGTH; k += 1) {
            if (!isFiniteNumber(patch[k])) {
              throw new TypeError("Every payment coefficient must be finite.");
            }
            if (Math.abs(patch[k]) > MAX_PAYMENT_COEFFICIENT) {
              throw new RangeError(
                "Every payment coefficient must lie within the numerical diagnostic range."
              );
            }
          }
        });
      }
    }
    return true;
  }

  function validateRule(rule) {
    if (!rule) {
      throw new TypeError("A bargaining rule is required.");
    }
    validateScalarGrid(rule.q, true);
    validatePatchGrid(rule.pB);
    validatePatchGrid(rule.pS);
    return true;
  }

  function triangleCentroid(i, j, isLower) {
    return sharedEnvelope.triangleCentroid(
      i, j, isLower, CELL_RESOLUTION
    );
  }

  function evaluatePatch(patch, v, c) {
    return sharedEnvelope.evaluatePatch(patch, v, c);
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
    return evaluatePolynomial(primitive, upper) - evaluatePolynomial(primitive, lower);
  }

  function composeAffine(poly, intercept, slope) {
    var affine = [intercept, slope];
    var power = [1];
    var result = [0];
    var i;
    for (i = 0; i < poly.length; i += 1) {
      result = addPolynomials(result, scalePolynomial(power, poly[i]));
      power = multiplyPolynomials(power, affine);
    }
    return result;
  }

  function interimBuyerAllocationPolynomials(q) {
    validateScalarGrid(q, true);
    return sharedEnvelope.interimBuyerAllocationPolynomials(q);
  }

  function interimSellerAllocationPolynomials(q) {
    validateScalarGrid(q, true);
    return sharedEnvelope.interimSellerAllocationPolynomials(q);
  }

  function interimBuyerPaymentPolynomials(pB) {
    validatePatchGrid(pB);
    return sharedEnvelope.interimBuyerPaymentPolynomials(pB);
  }

  function interimSellerPaymentPolynomials(pS) {
    validatePatchGrid(pS);
    return sharedEnvelope.interimSellerPaymentPolynomials(pS);
  }

  function piecewisePolynomialRange(polynomials) {
    return sharedEnvelope.piecewisePolynomialRange(
      polynomials, ALGEBRA_TOLERANCE
    );
  }

  function interimIntervalIndex(report) {
    return Math.min(CELL_RESOLUTION - 1, Math.floor(clamp(report, 0, 1) / CELL_SIZE));
  }

  function validateDeviationArguments(trueType, report) {
    if (!isFiniteNumber(trueType) || !isFiniteNumber(report)) {
      throw new TypeError("True types and alternate reports must be finite.");
    }
  }

  function buyerInterimDeviationUtility(interim, trueValue, report) {
    return sharedEnvelope.buyerInterimDeviationUtility(
      interim, trueValue, report
    );
  }

  function sellerInterimDeviationUtility(interim, trueCost, report) {
    return sharedEnvelope.sellerInterimDeviationUtility(
      interim, trueCost, report
    );
  }

  function bestInterimReport(interim, agent, trueType) {
    return agent === "buyer" ?
      sharedEnvelope.buyerBestInterimReport(interim, trueType, {
        algebraTolerance: ALGEBRA_TOLERANCE,
        verdictTolerance: VERDICT_TOLERANCE
      }) :
      sharedEnvelope.sellerBestInterimReport(interim, trueType, {
        algebraTolerance: ALGEBRA_TOLERANCE,
        verdictTolerance: VERDICT_TOLERANCE
      });
  }

  function buyerBestInterimReport(interim, trueValue) {
    return bestInterimReport(interim, "buyer", trueValue);
  }

  function sellerBestInterimReport(interim, trueCost) {
    return bestInterimReport(interim, "seller", trueCost);
  }

  function gridLocationAt(v, c) {
    validateDeviationArguments(v, c);
    var boundedV = clamp(v, 0, 1);
    var boundedC = clamp(c, 0, 1);
    var i = interimIntervalIndex(boundedV);
    var j = interimIntervalIndex(boundedC);
    var isLower = boundedV - i * CELL_SIZE >= boundedC - j * CELL_SIZE;
    return {
      v: boundedV,
      c: boundedC,
      i: i,
      j: j,
      isLower: isLower,
      gridSide: isLower ? "lower" : "upper",
      side: isLower ? "R" : "L"
    };
  }

  function scalarGridValueAt(grid, v, c) {
    validateDeviationArguments(v, c);
    return sharedEnvelope.scalarGridValueAt(grid, v, c);
  }

  function allocationErrorAt(q, v, c) {
    validateDeviationArguments(v, c);
    return sharedEnvelope.allocationErrorAt(q, v, c);
  }

  function patchGridValueAt(grid, v, c) {
    validateDeviationArguments(v, c);
    return sharedEnvelope.patchGridValueAt(grid, v, c);
  }

  function ruleValuesAt(rule, v, c) {
    var location = gridLocationAt(v, c);
    return {
      v: location.v,
      c: location.c,
      side: location.side,
      q: rule.q[location.gridSide][location.i][location.j],
      pB: evaluatePatch(
        rule.pB[location.gridSide][location.i][location.j], location.v, location.c
      ),
      pS: evaluatePatch(
        rule.pS[location.gridSide][location.i][location.j], location.v, location.c
      )
    };
  }

  function countCombinedViolations(left, right) {
    var count = 0;
    var i;
    for (i = 0; i < left.length; i += 1) {
      if (left[i] || right[i]) {
        count += 1;
      }
    }
    return count;
  }

  function checkPiecewiseMonotonicity(polynomials, increasing) {
    return sharedEnvelope.checkPiecewiseMonotonicity(
      polynomials, increasing, VERDICT_TOLERANCE
    );
  }

  function buyerEnvelopePaymentPolynomials(allocationPolynomials) {
    var result = new Array(CELL_RESOLUTION);
    var cumulative = 0;
    var x = [0, 1];
    var i;
    for (i = 0; i < CELL_RESOLUTION; i += 1) {
      var start = i * CELL_SIZE;
      var end = (i + 1) * CELL_SIZE;
      var primitive = antiderivativePolynomial(allocationPolynomials[i]);
      var localIntegral = primitive.slice();
      localIntegral[0] = (localIntegral[0] || 0) + cumulative -
        evaluatePolynomial(primitive, start);
      result[i] = subtractPolynomials(
        multiplyPolynomials(x, allocationPolynomials[i]), localIntegral
      );
      cumulative += integratePolynomial(allocationPolynomials[i], start, end);
    }
    return result;
  }

  function sellerEnvelopePaymentPolynomials(allocationPolynomials) {
    var result = new Array(CELL_RESOLUTION);
    var tail = 0;
    var x = [0, 1];
    var i;
    for (i = CELL_RESOLUTION - 1; i >= 0; i -= 1) {
      var start = i * CELL_SIZE;
      var end = (i + 1) * CELL_SIZE;
      var primitive = antiderivativePolynomial(allocationPolynomials[i]);
      var tailIntegral = scalePolynomial(primitive, -1);
      tailIntegral[0] = (tailIntegral[0] || 0) + tail +
        evaluatePolynomial(primitive, end);
      result[i] = addPolynomials(
        multiplyPolynomials(x, allocationPolynomials[i]), tailIntegral
      );
      tail += integratePolynomial(allocationPolynomials[i], start, end);
    }
    return result;
  }

  function checkPiecewiseConstantOffset(actual, envelope) {
    var intervalViolations = new Array(CELL_RESOLUTION).fill(false);
    var reference = null;
    var maxViolation = 0;
    var i;
    for (i = 0; i < CELL_RESOLUTION; i += 1) {
      var difference = subtractPolynomials(actual[i], envelope[i]);
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
        maxViolation = Math.max(maxViolation, Math.abs((local[0] || 0) - reference));
      }
    }
    return {
      holds: intervalViolations.every(function (value) { return !value; }),
      intervalViolations: intervalViolations,
      violationCount: intervalViolations.filter(function (value) { return value; }).length,
      maxViolation: maxViolation
    };
  }

  function bicImplementability(interim) {
    var buyer = checkPiecewiseMonotonicity(interim.buyerAllocation, true);
    var seller = checkPiecewiseMonotonicity(interim.sellerAllocation, false);
    return {
      holds: buyer.holds && seller.holds,
      buyer: buyer,
      seller: seller,
      buyerAllocation: interim.buyerAllocation,
      sellerAllocation: interim.sellerAllocation
    };
  }

  function checkBicImplementability(q) {
    validateScalarGrid(q, true);
    return bicImplementability(
      sharedEnvelope.interimAllocationPolynomials(q)
    );
  }

  function checkBic(rule) {
    var interim = sharedEnvelope.interimRulePolynomials(rule);
    var implementability = bicImplementability(interim);
    var buyerPayment = interim.buyerPayment;
    var sellerPayment = interim.sellerPayment;
    var buyerEnvelope = buyerEnvelopePaymentPolynomials(
      implementability.buyerAllocation
    );
    var sellerEnvelope = sellerEnvelopePaymentPolynomials(
      implementability.sellerAllocation
    );
    var buyerPaymentCheck = checkPiecewiseConstantOffset(
      buyerPayment, buyerEnvelope
    );
    var sellerPaymentCheck = checkPiecewiseConstantOffset(
      sellerPayment, sellerEnvelope
    );
    var buyerHolds = implementability.buyer.holds && buyerPaymentCheck.holds;
    var sellerHolds = implementability.seller.holds && sellerPaymentCheck.holds;
    return {
      holds: buyerHolds && sellerHolds,
      implementable: implementability.holds,
      buyer: {
        holds: buyerHolds,
        allocation: implementability.buyer,
        payment: buyerPaymentCheck
      },
      seller: {
        holds: sellerHolds,
        allocation: implementability.seller,
        payment: sellerPaymentCheck
      },
      buyerAllocation: implementability.buyerAllocation,
      sellerAllocation: implementability.sellerAllocation,
      buyerPayment: buyerPayment,
      sellerPayment: sellerPayment
    };
  }

  function checkDsicAllocation(q) {
    validateScalarGrid(q, true);
    return sharedEnvelope.checkDsicAllocation(q, VERDICT_TOLERANCE);
  }

  function zeroBoundaryPayments(q) {
    validateScalarGrid(q, true);
    return sharedEnvelope.zeroBoundaryPayments(q);
  }

  function subtractPatch(left, right) {
    var result = new Array(PATCH_LENGTH);
    var k;
    for (k = 0; k < PATCH_LENGTH; k += 1) {
      result[k] = left[k] - right[k];
    }
    return result;
  }

  function checkBuyerDsicPayment(actual, envelope) {
    var violations = createScalarGrid(
      function () { return false; },
      function () { return false; }
    );
    var maxViolation = 0;
    var i;
    var j;
    for (j = 0; j < CELL_RESOLUTION; j += 1) {
      var reference = subtractPatch(actual.upper[0][j], envelope.upper[0][j]);
      for (i = 0; i < CELL_RESOLUTION; i += 1) {
        [true, false].forEach(function (isLower) {
          var offset = subtractPatch(
            isLower ? actual.lower[i][j] : actual.upper[i][j],
            isLower ? envelope.lower[i][j] : envelope.upper[i][j]
          );
          var ownMagnitude = Math.max(
            Math.abs(offset[1]), Math.abs(offset[3]), Math.abs(offset[4])
          );
          var otherMagnitude = Math.max(
            Math.abs(offset[0] - reference[0]),
            Math.abs(offset[2] - reference[2]),
            Math.abs(offset[5] - reference[5])
          );
          var magnitude = Math.max(ownMagnitude, otherMagnitude);
          if (magnitude > VERDICT_TOLERANCE) {
            if (isLower) {
              violations.lower[i][j] = true;
            } else {
              violations.upper[i][j] = true;
            }
            maxViolation = Math.max(maxViolation, magnitude);
          }
        });
      }
    }
    var violationCount = countTrue(violations);
    return {
      holds: violationCount === 0,
      violations: violations,
      violationCount: violationCount,
      maxViolation: maxViolation
    };
  }

  function checkSellerDsicPayment(actual, envelope) {
    var violations = createScalarGrid(
      function () { return false; },
      function () { return false; }
    );
    var maxViolation = 0;
    var i;
    var j;
    for (i = 0; i < CELL_RESOLUTION; i += 1) {
      var reference = subtractPatch(actual.upper[i][0], envelope.upper[i][0]);
      for (j = 0; j < CELL_RESOLUTION; j += 1) {
        [true, false].forEach(function (isLower) {
          var offset = subtractPatch(
            isLower ? actual.lower[i][j] : actual.upper[i][j],
            isLower ? envelope.lower[i][j] : envelope.upper[i][j]
          );
          var ownMagnitude = Math.max(
            Math.abs(offset[2]), Math.abs(offset[4]), Math.abs(offset[5])
          );
          var otherMagnitude = Math.max(
            Math.abs(offset[0] - reference[0]),
            Math.abs(offset[1] - reference[1]),
            Math.abs(offset[3] - reference[3])
          );
          var magnitude = Math.max(ownMagnitude, otherMagnitude);
          if (magnitude > VERDICT_TOLERANCE) {
            if (isLower) {
              violations.lower[i][j] = true;
            } else {
              violations.upper[i][j] = true;
            }
            maxViolation = Math.max(maxViolation, magnitude);
          }
        });
      }
    }
    var violationCount = countTrue(violations);
    return {
      holds: violationCount === 0,
      violations: violations,
      violationCount: violationCount,
      maxViolation: maxViolation
    };
  }

  function checkDsic(rule) {
    var allocation = sharedEnvelope.checkDsicAllocation(
      rule.q, VERDICT_TOLERANCE
    );
    var envelope = sharedEnvelope.zeroBoundaryPayments(rule.q);
    var buyerPayment = checkBuyerDsicPayment(rule.pB, envelope.pB);
    var sellerPayment = checkSellerDsicPayment(rule.pS, envelope.pS);
    var buyerHolds = allocation.buyer.holds && buyerPayment.holds;
    var sellerHolds = allocation.seller.holds && sellerPayment.holds;
    return {
      holds: buyerHolds && sellerHolds,
      implementable: allocation.holds,
      buyer: {
        holds: buyerHolds,
        allocation: allocation.buyer,
        payment: buyerPayment
      },
      seller: {
        holds: sellerHolds,
        allocation: allocation.seller,
        payment: sellerPayment
      }
    };
  }

  function pointInsideTriangle(point, i, j, isLower) {
    var localV = point.v - i * CELL_SIZE;
    var localC = point.c - j * CELL_SIZE;
    if (localV < -ALGEBRA_TOLERANCE || localV > CELL_SIZE + ALGEBRA_TOLERANCE ||
        localC < -ALGEBRA_TOLERANCE || localC > CELL_SIZE + ALGEBRA_TOLERANCE) {
      return false;
    }
    return isLower ? localV >= localC - ALGEBRA_TOLERANCE :
      localV <= localC + ALGEBRA_TOLERANCE;
  }

  function patchRangeOnTriangle(patch, i, j, isLower, vertices) {
    var candidates = vertices.slice();
    var edgeIndex;
    for (edgeIndex = 0; edgeIndex < 3; edgeIndex += 1) {
      var start = vertices[edgeIndex];
      var end = vertices[(edgeIndex + 1) % 3];
      var dv = end.v - start.v;
      var dc = end.c - start.c;
      var quadratic = patch[3] * dv * dv + patch[4] * dv * dc +
        patch[5] * dc * dc;
      var linear = patch[1] * dv + patch[2] * dc +
        2 * patch[3] * start.v * dv +
        patch[4] * (start.v * dc + start.c * dv) +
        2 * patch[5] * start.c * dc;
      if (Math.abs(quadratic) > ALGEBRA_TOLERANCE) {
        var stationary = -linear / (2 * quadratic);
        if (stationary > 0 && stationary < 1) {
          candidates.push({
            v: start.v + stationary * dv,
            c: start.c + stationary * dc
          });
        }
      }
    }
    var determinant = 4 * patch[3] * patch[5] - patch[4] * patch[4];
    if (Math.abs(determinant) > ALGEBRA_TOLERANCE) {
      var interior = {
        v: (-2 * patch[5] * patch[1] + patch[4] * patch[2]) / determinant,
        c: (patch[4] * patch[1] - 2 * patch[3] * patch[2]) / determinant
      };
      if (pointInsideTriangle(interior, i, j, isLower)) {
        candidates.push(interior);
      }
    }
    var minimum = Infinity;
    var maximum = -Infinity;
    var minimumPoint = null;
    var maximumPoint = null;
    candidates.forEach(function (point) {
      var value = evaluatePatch(patch, point.v, point.c);
      if (value < minimum) {
        minimum = value;
        minimumPoint = point;
      }
      if (value > maximum) {
        maximum = value;
        maximumPoint = point;
      }
    });
    return {
      min: minimum,
      max: maximum,
      minPoint: minimumPoint,
      maxPoint: maximumPoint
    };
  }

  function patchGridRanges(grids) {
    var ranges = grids.map(function () {
      return {
        min: Infinity,
        max: -Infinity,
        minLocation: null,
        maxLocation: null
      };
    });
    var i;
    var j;
    var gridIndex;
    [true, false].forEach(function (isLower) {
      for (i = 0; i < CELL_RESOLUTION; i += 1) {
        for (j = 0; j < CELL_RESOLUTION; j += 1) {
          var vertices = sharedEnvelope.triangleVertices(
            i, j, isLower, CELL_RESOLUTION
          );
          for (gridIndex = 0; gridIndex < grids.length; gridIndex += 1) {
            var grid = grids[gridIndex];
            var range = patchRangeOnTriangle(
              isLower ? grid.lower[i][j] : grid.upper[i][j],
              i, j, isLower, vertices
            );
            if (range.min < ranges[gridIndex].min) {
              ranges[gridIndex].min = range.min;
              ranges[gridIndex].minLocation = {
                i: i,
                j: j,
                isLower: isLower,
                v: range.minPoint.v,
                c: range.minPoint.c
              };
            }
            if (range.max > ranges[gridIndex].max) {
              ranges[gridIndex].max = range.max;
              ranges[gridIndex].maxLocation = {
                i: i,
                j: j,
                isLower: isLower,
                v: range.maxPoint.v,
                c: range.maxPoint.c
              };
            }
          }
        }
      }
    });
    return ranges;
  }

  function integratePatchOnTriangle(patch, i, j, isLower) {
    var diagonalIntercept = (j - i) * CELL_SIZE;
    var polynomial;
    if (isLower) {
      polynomial = subtractPolynomials(
        verticalPrimitiveAt(patch, diagonalIntercept, 1),
        verticalPrimitiveAt(patch, j * CELL_SIZE, 0)
      );
    } else {
      polynomial = subtractPolynomials(
        verticalPrimitiveAt(patch, (j + 1) * CELL_SIZE, 0),
        verticalPrimitiveAt(patch, diagonalIntercept, 1)
      );
    }
    return integratePolynomial(
      polynomial, i * CELL_SIZE, (i + 1) * CELL_SIZE
    );
  }

  function integratePatchGridValues(grid) {
    var total = 0;
    var i;
    var j;
    for (i = 0; i < CELL_RESOLUTION; i += 1) {
      for (j = 0; j < CELL_RESOLUTION; j += 1) {
        total += integratePatchOnTriangle(grid.lower[i][j], i, j, true);
        total += integratePatchOnTriangle(grid.upper[i][j], i, j, false);
      }
    }
    return total;
  }

  function integratePatchGrid(grid) {
    validatePatchGrid(grid);
    return integratePatchGridValues(grid);
  }

  function utilityPolynomials(bic) {
    var buyer = new Array(CELL_RESOLUTION);
    var seller = new Array(CELL_RESOLUTION);
    var x = [0, 1];
    var i;
    for (i = 0; i < CELL_RESOLUTION; i += 1) {
      buyer[i] = subtractPolynomials(
        multiplyPolynomials(x, bic.buyerAllocation[i]), bic.buyerPayment[i]
      );
      seller[i] = subtractPolynomials(
        bic.sellerPayment[i], multiplyPolynomials(x, bic.sellerAllocation[i])
      );
    }
    return { buyer: buyer, seller: seller };
  }

  function summarize(rule) {
    validateRule(rule);
    var bic = checkBic(rule);
    var dsic = checkDsic(rule);
    var payoffPatches = sharedEnvelope.truthfulPayoffPatches(rule);
    var revenue = sharedEnvelope.revenuePatches(rule);
    var utility = utilityPolynomials(bic);
    var interim = {
      buyerAllocation: bic.buyerAllocation,
      sellerAllocation: bic.sellerAllocation,
      buyerPayment: bic.buyerPayment,
      sellerPayment: bic.sellerPayment,
      buyerPayoff: utility.buyer,
      sellerPayoff: utility.seller
    };
    var deviation = sharedEnvelope.interimDeviationDiagnostics(interim, {
      traceSamples: DEVIATION_TRACE_SAMPLES,
      algebraTolerance: ALGEBRA_TOLERANCE,
      verdictTolerance: VERDICT_TOLERANCE
    });
    var patchRanges = patchGridRanges([
      payoffPatches.buyer, payoffPatches.seller, revenue, rule.pB, rule.pS
    ]);
    var exPostBuyerRange = patchRanges[0];
    var exPostSellerRange = patchRanges[1];
    var revenueRange = patchRanges[2];
    var buyerPaymentRange = patchRanges[3];
    var sellerPaymentRange = patchRanges[4];
    var interimBuyerRange = piecewisePolynomialRange(utility.buyer);
    var interimSellerRange = piecewisePolynomialRange(utility.seller);
    var expectedBuyerPayoff = integratePatchGridValues(payoffPatches.buyer);
    var expectedSellerPayoff = integratePatchGridValues(payoffPatches.seller);
    var gainsFromTrade = sharedEnvelope.welfare(rule.q);
    var expectedRevenue = gainsFromTrade - expectedBuyerPayoff -
      expectedSellerPayoff;
    var firstBest = sharedEnvelope.efficientWelfare(CELL_RESOLUTION);
    var exAnteBuyerIr = expectedBuyerPayoff >= -VERDICT_TOLERANCE;
    var exAnteSellerIr = expectedSellerPayoff >= -VERDICT_TOLERANCE;
    var interimBuyerIr = interimBuyerRange.min >= -VERDICT_TOLERANCE;
    var interimSellerIr = interimSellerRange.min >= -VERDICT_TOLERANCE;
    var exPostBuyerIr = exPostBuyerRange.min >= -VERDICT_TOLERANCE;
    var exPostSellerIr = exPostSellerRange.min >= -VERDICT_TOLERANCE;
    var buyerIcViolationCount = countCombinedViolations(
      bic.buyer.allocation.intervalViolations,
      bic.buyer.payment.intervalViolations
    );
    var sellerIcViolationCount = countCombinedViolations(
      bic.seller.allocation.intervalViolations,
      bic.seller.payment.intervalViolations
    );
    var maxAbsImbalance = Math.max(
      Math.abs(revenueRange.min), Math.abs(revenueRange.max)
    );
    return {
      patches: {
        buyerPayoff: payoffPatches.buyer,
        sellerPayoff: payoffPatches.seller,
        revenue: revenue
      },
      paymentRange: {
        buyer: buyerPaymentRange,
        seller: sellerPaymentRange
      },
      interim: interim,
      deviation: deviation,
      bic: bic,
      dsic: dsic,
      ir: {
        exAnte: {
          buyer: exAnteBuyerIr,
          seller: exAnteSellerIr,
          holds: exAnteBuyerIr && exAnteSellerIr
        },
        interim: {
          buyer: interimBuyerIr,
          seller: interimSellerIr,
          holds: interimBuyerIr && interimSellerIr,
          buyerRange: interimBuyerRange,
          sellerRange: interimSellerRange
        },
        exPost: {
          buyer: exPostBuyerIr,
          seller: exPostSellerIr,
          holds: exPostBuyerIr && exPostSellerIr,
          buyerRange: exPostBuyerRange,
          sellerRange: exPostSellerRange
        }
      },
      verdicts: {
        bic: bic.holds,
        buyerBic: bic.buyer.holds,
        sellerBic: bic.seller.holds,
        bicImplementable: bic.implementable,
        buyerBicViolationCount: buyerIcViolationCount,
        sellerBicViolationCount: sellerIcViolationCount,
        dsic: dsic.holds,
        buyerDsic: dsic.buyer.holds,
        sellerDsic: dsic.seller.holds,
        dsicImplementable: dsic.implementable,
        exAnteIr: exAnteBuyerIr && exAnteSellerIr,
        exAnteBuyerIr: exAnteBuyerIr,
        exAnteSellerIr: exAnteSellerIr,
        interimIr: interimBuyerIr && interimSellerIr,
        interimBuyerIr: interimBuyerIr,
        interimSellerIr: interimSellerIr,
        exPostIr: exPostBuyerIr && exPostSellerIr,
        exPostBuyerIr: exPostBuyerIr,
        exPostSellerIr: exPostSellerIr,
        minBuyerPayoff: exPostBuyerRange.min,
        minSellerPayoff: exPostSellerRange.min,
        minInterimBuyerPayoff: interimBuyerRange.min,
        minInterimSellerPayoff: interimSellerRange.min,
        expectedBuyerPayoff: expectedBuyerPayoff,
        expectedSellerPayoff: expectedSellerPayoff,
        exPostBudgetBalanced: Math.abs(revenueRange.min) <= VERDICT_TOLERANCE &&
          Math.abs(revenueRange.max) <= VERDICT_TOLERANCE,
        exPostNoDeficit: revenueRange.min >= -VERDICT_TOLERANCE,
        expectedBudgetBalanced: Math.abs(expectedRevenue) <= VERDICT_TOLERANCE,
        expectedNoDeficit: expectedRevenue >= -VERDICT_TOLERANCE,
        minRevenue: revenueRange.min,
        maxRevenue: revenueRange.max,
        maxAbsImbalance: maxAbsImbalance,
        expectedRevenue: expectedRevenue,
        tradeProbability: sharedEnvelope.expectedTradeProbability(rule.q),
        welfare: gainsFromTrade,
        firstBestWelfare: firstBest,
        efficiencyLoss: firstBest - gainsFromTrade
      }
    };
  }

  function paymentGridForTrade(q, tradePatch) {
    var zeroPatch = constantPatch(0);
    return createPatchGrid(
      function (i, j) {
        return q.lower[i][j] > 0 ? tradePatch : zeroPatch;
      },
      function (i, j) {
        return q.upper[i][j] > 0 ? tradePatch : zeroPatch;
      }
    );
  }

  function presetVcg() {
    var q = efficientGrid();
    return {
      q: q,
      pB: paymentGridForTrade(q, [0, 0, 1, 0, 0, 0]),
      pS: paymentGridForTrade(q, [0, 1, 0, 0, 0, 0])
    };
  }

  function presetPostedPrice(buyerPrice, sellerReceipt) {
    var resolvedBuyerPrice = resolveGridParameter(
      buyerPrice, 0.5, "posted buyer price"
    );
    var resolvedSellerReceipt = resolveGridParameter(
      sellerReceipt, resolvedBuyerPrice, "posted seller receipt"
    );
    var q = sharedEnvelope.postedPriceGrid(
      CELL_RESOLUTION, resolvedBuyerPrice, resolvedSellerReceipt
    );
    return {
      parameters: {
        buyerPrice: resolvedBuyerPrice,
        sellerReceipt: resolvedSellerReceipt
      },
      q: q,
      pB: paymentGridForTrade(q, constantPatch(resolvedBuyerPrice)),
      pS: paymentGridForTrade(q, constantPatch(resolvedSellerReceipt))
    };
  }

  function presetAgv(k) {
    var constant = k === undefined ? 0.25 : k;
    if (!isFiniteNumber(constant)) {
      throw new TypeError("The AGV constant must be finite.");
    }
    if (Math.abs(constant) > MAX_PAYMENT_COEFFICIENT) {
      throw new RangeError(
        "The AGV constant must lie within the numerical diagnostic range."
      );
    }
    var payment = [constant, 0, 0, 0.5, 0, -0.5];
    return {
      q: efficientGrid(),
      pB: createPatchGrid(
        function () { return payment; },
        function () { return payment; }
      ),
      pS: createPatchGrid(
        function () { return payment; },
        function () { return payment; }
      )
    };
  }

  function presetSplitDifference(sellerShare, tradingThreshold) {
    var resolvedShare = resolveUnitParameter(
      sellerShare, 0.5, "seller share"
    );
    var resolvedThreshold = resolveTradingThreshold(tradingThreshold, 0);
    var q = sharedEnvelope.chatterjeeSamuelsonGrid(
      CELL_RESOLUTION, resolvedThreshold
    );
    var payment = [0, resolvedShare, 1 - resolvedShare, 0, 0, 0];
    return {
      parameters: {
        sellerShare: resolvedShare,
        tradingThreshold: resolvedThreshold
      },
      q: q,
      pB: paymentGridForTrade(q, payment),
      pS: paymentGridForTrade(q, payment)
    };
  }

  function presetChatterjeeSamuelson() {
    var q = sharedEnvelope.chatterjeeSamuelsonGrid(
      CELL_RESOLUTION, 0.25
    );
    var payment = [1 / 6, 1 / 3, 1 / 3, 0, 0, 0];
    return {
      parameters: {
        threshold: 0.25,
        sellerShare: 0.5
      },
      q: q,
      pB: paymentGridForTrade(q, payment),
      pS: paymentGridForTrade(q, payment)
    };
  }

  function presetRevenueThreshold(threshold, buyerMarkup, sellerDiscount) {
    var resolvedThreshold = resolveTradingThreshold(threshold, 0.5);
    var resolvedBuyerMarkup = resolveUnitParameter(
      buyerMarkup, 0.5, "buyer markup"
    );
    var resolvedSellerDiscount = resolveUnitParameter(
      sellerDiscount, 0.5, "seller discount"
    );
    var q = sharedEnvelope.chatterjeeSamuelsonGrid(
      CELL_RESOLUTION, resolvedThreshold
    );
    return {
      parameters: {
        threshold: resolvedThreshold,
        buyerMarkup: resolvedBuyerMarkup,
        sellerDiscount: resolvedSellerDiscount
      },
      q: q,
      pB: paymentGridForTrade(
        q, [resolvedBuyerMarkup, 0, 1, 0, 0, 0]
      ),
      pS: paymentGridForTrade(
        q, [-resolvedSellerDiscount, 1, 0, 0, 0, 0]
      )
    };
  }

  global.BargainingSandboxModel = Object.freeze({
    CELL_RESOLUTION: CELL_RESOLUTION,
    CELL_SIZE: CELL_SIZE,
    VERDICT_TOLERANCE: VERDICT_TOLERANCE,
    PATCH_LENGTH: PATCH_LENGTH,
    MAX_PAYMENT_COEFFICIENT: MAX_PAYMENT_COEFFICIENT,
    DEVIATION_TRACE_SAMPLES: DEVIATION_TRACE_SAMPLES,
    createScalarGrid: createScalarGrid,
    createPatchGrid: createPatchGrid,
    constantScalarGrid: constantScalarGrid,
    constantPatch: constantPatch,
    constantPatchGrid: constantPatchGrid,
    efficientGrid: efficientGrid,
    chatterjeeSamuelsonGrid: chatterjeeSamuelsonGrid,
    triangleCentroid: triangleCentroid,
    evaluatePatch: evaluatePatch,
    evaluatePolynomial: evaluatePolynomial,
    interimBuyerAllocationPolynomials: interimBuyerAllocationPolynomials,
    interimSellerAllocationPolynomials: interimSellerAllocationPolynomials,
    interimBuyerPaymentPolynomials: interimBuyerPaymentPolynomials,
    interimSellerPaymentPolynomials: interimSellerPaymentPolynomials,
    buyerInterimDeviationUtility: buyerInterimDeviationUtility,
    sellerInterimDeviationUtility: sellerInterimDeviationUtility,
    buyerBestInterimReport: buyerBestInterimReport,
    sellerBestInterimReport: sellerBestInterimReport,
    scalarGridValueAt: scalarGridValueAt,
    allocationErrorAt: allocationErrorAt,
    patchGridValueAt: patchGridValueAt,
    ruleValuesAt: ruleValuesAt,
    checkBicImplementability: checkBicImplementability,
    checkDsicAllocation: checkDsicAllocation,
    zeroBoundaryPayments: zeroBoundaryPayments,
    integratePatchGrid: integratePatchGrid,
    summarize: summarize,
    presetVcg: presetVcg,
    presetPostedPrice: presetPostedPrice,
    presetAgv: presetAgv,
    presetSplitDifference: presetSplitDifference,
    presetChatterjeeSamuelson: presetChatterjeeSamuelson,
    presetRevenueThreshold: presetRevenueThreshold
  });
})(window);
