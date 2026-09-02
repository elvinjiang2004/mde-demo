(function (global) {
  "use strict";

  function resolutionOf(grid) {
    return grid.lower.length;
  }

  function emptyGrid(resolution) {
    var lower = new Array(resolution);
    var upper = new Array(resolution);
    var i;
    for (i = 0; i < resolution; i += 1) {
      lower[i] = new Array(resolution);
      upper[i] = new Array(resolution);
    }
    return { lower: lower, upper: upper };
  }

  function createGrid(resolution, fillLower, fillUpper) {
    var grid = emptyGrid(resolution);
    var i;
    var j;
    for (i = 0; i < resolution; i += 1) {
      for (j = 0; j < resolution; j += 1) {
        grid.lower[i][j] = fillLower(i, j);
        grid.upper[i][j] = fillUpper(i, j);
      }
    }
    return grid;
  }

  function constantGrid(resolution, value) {
    return createGrid(
      resolution,
      function () { return value; },
      function () { return value; }
    );
  }

  function efficientGrid(resolution) {
    return createGrid(
      resolution,
      function (i, j) { return i >= j ? 1 : 0; },
      function (i, j) { return i > j ? 1 : 0; }
    );
  }

  function postedPriceGrid(resolution, buyerPrice, sellerReceipt) {
    var cellSize = 1 / resolution;
    var boundedBuyerPrice = Math.min(1, Math.max(0, buyerPrice));
    var resolvedSellerReceipt = sellerReceipt === undefined ?
      buyerPrice : sellerReceipt;
    var boundedSellerReceipt = Math.min(1, Math.max(0, resolvedSellerReceipt));
    var buyerThreshold = Math.round(boundedBuyerPrice / cellSize);
    var sellerThreshold = Math.round(boundedSellerReceipt / cellSize);
    return createGrid(
      resolution,
      function (i, j) {
        return i >= buyerThreshold && j < sellerThreshold ? 1 : 0;
      },
      function (i, j) {
        return i >= buyerThreshold && j < sellerThreshold ? 1 : 0;
      }
    );
  }

  function chatterjeeSamuelsonGrid(resolution, threshold) {
    var resolvedThreshold = threshold === undefined ? 0.25 : threshold;
    var boundedThreshold = Math.min(1, Math.max(0, resolvedThreshold));
    var offset = Math.round(boundedThreshold * resolution);
    return createGrid(
      resolution,
      function (i, j) { return i - j >= offset ? 1 : 0; },
      function (i, j) { return i - j > offset ? 1 : 0; }
    );
  }

  function triangleCentroid(i, j, isLower, resolution) {
    var cellSize = 1 / resolution;
    return isLower ? {
      v: (i + 2 / 3) * cellSize,
      c: (j + 1 / 3) * cellSize
    } : {
      v: (i + 1 / 3) * cellSize,
      c: (j + 2 / 3) * cellSize
    };
  }

  function weightedScalarGridIntegral(grid, weightAt) {
    var resolution = resolutionOf(grid);
    var cellSize = 1 / resolution;
    var triangleArea = 1 / (2 * resolution * resolution);
    var total = 0;
    var i;
    var j;
    for (i = 0; i < resolution; i += 1) {
      for (j = 0; j < resolution; j += 1) {
        total += grid.lower[i][j] * weightAt(
          (i + 2 / 3) * cellSize, (j + 1 / 3) * cellSize
        );
        total += grid.upper[i][j] * weightAt(
          (i + 1 / 3) * cellSize, (j + 2 / 3) * cellSize
        );
      }
    }
    return total * triangleArea;
  }

  function welfare(q) {
    return weightedScalarGridIntegral(q, function (v, c) {
      return v - c;
    });
  }

  function expectedTradeProbability(q) {
    return weightedScalarGridIntegral(q, function () { return 1; });
  }

  var efficientWelfareCache = {};

  function efficientWelfare(resolution) {
    var key = String(resolution);
    if (efficientWelfareCache[key] === undefined) {
      efficientWelfareCache[key] = welfare(efficientGrid(resolution));
    }
    return efficientWelfareCache[key];
  }

  function countTrueGrid(grid) {
    var count = 0;
    [grid.lower, grid.upper].forEach(function (rows) {
      rows.forEach(function (row) {
        row.forEach(function (value) {
          if (value) {
            count += 1;
          }
        });
      });
    });
    return count;
  }

  function checkDsicAllocation(q, tolerance) {
    var resolution = resolutionOf(q);
    var tol = tolerance === undefined ? 1e-7 : tolerance;
    var buyerViolations = constantGrid(resolution, false);
    var sellerViolations = constantGrid(resolution, false);
    var buyerMaximum = 0;
    var sellerMaximum = 0;
    var i;
    var j;
    for (i = 0; i < resolution; i += 1) {
      for (j = 0; j < resolution; j += 1) {
        var within = q.upper[i][j] - q.lower[i][j];
        if (within > tol) {
          buyerViolations.lower[i][j] = true;
          buyerViolations.upper[i][j] = true;
          sellerViolations.lower[i][j] = true;
          sellerViolations.upper[i][j] = true;
          buyerMaximum = Math.max(buyerMaximum, within);
          sellerMaximum = Math.max(sellerMaximum, within);
        }
        if (i < resolution - 1) {
          var buyerBoundary = q.lower[i][j] - q.upper[i + 1][j];
          if (buyerBoundary > tol) {
            buyerViolations.lower[i][j] = true;
            buyerViolations.upper[i + 1][j] = true;
            buyerMaximum = Math.max(buyerMaximum, buyerBoundary);
          }
        }
        if (j < resolution - 1) {
          var sellerBoundary = q.lower[i][j + 1] - q.upper[i][j];
          if (sellerBoundary > tol) {
            sellerViolations.upper[i][j] = true;
            sellerViolations.lower[i][j + 1] = true;
            sellerMaximum = Math.max(sellerMaximum, sellerBoundary);
          }
        }
      }
    }
    var buyerCount = countTrueGrid(buyerViolations);
    var sellerCount = countTrueGrid(sellerViolations);
    return {
      holds: buyerCount === 0 && sellerCount === 0,
      buyer: {
        holds: buyerCount === 0,
        violations: buyerViolations,
        violationCount: buyerCount,
        maxViolation: buyerMaximum
      },
      seller: {
        holds: sellerCount === 0,
        violations: sellerViolations,
        violationCount: sellerCount,
        maxViolation: sellerMaximum
      }
    };
  }

  function evaluatePatch(patch, v, c) {
    return patch[0] + patch[1] * v + patch[2] * c +
      patch[3] * v * v + patch[4] * v * c + patch[5] * c * c;
  }

  function locationAt(grid, v, c) {
    var resolution = resolutionOf(grid);
    var cellSize = 1 / resolution;
    var boundedV = Math.min(1, Math.max(0, v));
    var boundedC = Math.min(1, Math.max(0, c));
    var i = Math.min(resolution - 1, Math.floor(boundedV / cellSize));
    var j = Math.min(resolution - 1, Math.floor(boundedC / cellSize));
    var isLower = boundedV - i * cellSize >= boundedC - j * cellSize;
    return {
      v: boundedV,
      c: boundedC,
      i: i,
      j: j,
      side: isLower ? "lower" : "upper"
    };
  }

  function scalarGridValueAt(grid, v, c) {
    var location = locationAt(grid, v, c);
    return grid[location.side][location.i][location.j];
  }

  function patchGridValueAt(grid, v, c) {
    var location = locationAt(grid, v, c);
    return evaluatePatch(
      grid[location.side][location.i][location.j], location.v, location.c
    );
  }

  function zeroBoundaryPayments(q) {
    var resolution = resolutionOf(q);
    var cellSize = 1 / resolution;
    var pB = emptyGrid(resolution);
    var pS = emptyGrid(resolution);
    var i;
    var j;
    for (j = 0; j < resolution; j += 1) {
      var priorRight = 0;
      var priorDifference = 0;
      for (i = 0; i < resolution; i += 1) {
        var qRight = q.lower[i][j];
        var qLeft = q.upper[i][j];
        var lowerDifference = priorDifference + qLeft - qRight;
        pB.upper[i][j] = [
          i * cellSize * qLeft - cellSize * priorRight +
            j * cellSize * priorDifference,
          0, -priorDifference, 0, 0, 0
        ];
        pB.lower[i][j] = [
          i * cellSize * qRight - cellSize * priorRight +
            j * cellSize * lowerDifference,
          0, -lowerDifference, 0, 0, 0
        ];
        priorRight += qRight;
        priorDifference = lowerDifference;
      }
    }
    for (i = 0; i < resolution; i += 1) {
      var futureLeft = 0;
      var futureDifference = 0;
      for (j = resolution - 1; j >= 0; j -= 1) {
        var sellerRight = q.lower[i][j];
        var sellerLeft = q.upper[i][j];
        var currentDifference = futureDifference + sellerRight - sellerLeft;
        pS.upper[i][j] = [
          (j + 1) * cellSize * sellerLeft + cellSize * futureLeft -
            i * cellSize * futureDifference,
          futureDifference, 0, 0, 0, 0
        ];
        pS.lower[i][j] = [
          j * cellSize * sellerRight + cellSize * futureLeft +
            cellSize * sellerLeft - i * cellSize * currentDifference,
          currentDifference, 0, 0, 0, 0
        ];
        futureLeft += sellerLeft;
        futureDifference = currentDifference;
      }
    }
    return { pB: pB, pS: pS };
  }

  function truthfulPayoffPatches(rule) {
    var resolution = resolutionOf(rule.q);
    var buyer = createGrid(
      resolution,
      function (i, j) {
        var payment = rule.pB.lower[i][j];
        return [-payment[0], rule.q.lower[i][j] - payment[1], -payment[2],
          -payment[3], -payment[4], -payment[5]];
      },
      function (i, j) {
        var payment = rule.pB.upper[i][j];
        return [-payment[0], rule.q.upper[i][j] - payment[1], -payment[2],
          -payment[3], -payment[4], -payment[5]];
      }
    );
    var seller = createGrid(
      resolution,
      function (i, j) {
        var payment = rule.pS.lower[i][j].slice();
        payment[2] -= rule.q.lower[i][j];
        return payment;
      },
      function (i, j) {
        var payment = rule.pS.upper[i][j].slice();
        payment[2] -= rule.q.upper[i][j];
        return payment;
      }
    );
    return { buyer: buyer, seller: seller };
  }

  function revenuePatches(rule) {
    var resolution = resolutionOf(rule.q);
    function difference(left, right) {
      return left.map(function (value, index) { return value - right[index]; });
    }
    return createGrid(
      resolution,
      function (i, j) { return difference(rule.pB.lower[i][j], rule.pS.lower[i][j]); },
      function (i, j) { return difference(rule.pB.upper[i][j], rule.pS.upper[i][j]); }
    );
  }

  function triangleVertices(i, j, isLower, resolution) {
    var h = 1 / resolution;
    var v0 = i * h;
    var v1 = (i + 1) * h;
    var c0 = j * h;
    var c1 = (j + 1) * h;
    return isLower ?
      [{ v: v0, c: c0 }, { v: v1, c: c0 }, { v: v1, c: c1 }] :
      [{ v: v0, c: c0 }, { v: v0, c: c1 }, { v: v1, c: c1 }];
  }

  function affinePatchGridRange(grid) {
    var resolution = resolutionOf(grid);
    var minimum = Infinity;
    var maximum = -Infinity;
    var i;
    var j;
    [true, false].forEach(function (isLower) {
      for (i = 0; i < resolution; i += 1) {
        for (j = 0; j < resolution; j += 1) {
          var patch = isLower ? grid.lower[i][j] : grid.upper[i][j];
          triangleVertices(i, j, isLower, resolution).forEach(function (point) {
            var value = evaluatePatch(patch, point.v, point.c);
            minimum = Math.min(minimum, value);
            maximum = Math.max(maximum, value);
          });
        }
      }
    });
    return { min: minimum, max: maximum };
  }

  function addPolynomials(left, right) {
    var length = Math.max(left.length, right.length);
    var result = new Array(length).fill(0);
    var i;
    for (i = 0; i < length; i += 1) {
      result[i] = (left[i] || 0) + (right[i] || 0);
    }
    return result;
  }

  function scalePolynomial(poly, scale) {
    return poly.map(function (value) { return value * scale; });
  }

  function subtractPolynomials(left, right) {
    return addPolynomials(left, scalePolynomial(right, -1));
  }

  function multiplyPolynomials(left, right) {
    var result = new Array(left.length + right.length - 1).fill(0);
    var i;
    var j;
    for (i = 0; i < left.length; i += 1) {
      for (j = 0; j < right.length; j += 1) {
        result[i + j] += left[i] * right[j];
      }
    }
    return result;
  }

  function evaluatePolynomial(poly, value) {
    var result = 0;
    var i;
    for (i = poly.length - 1; i >= 0; i -= 1) {
      result = result * value + poly[i];
    }
    return result;
  }

  function derivativePolynomial(poly) {
    var result;
    var i;
    if (poly.length <= 1) {
      return [0];
    }
    result = new Array(poly.length - 1);
    for (i = 1; i < poly.length; i += 1) {
      result[i - 1] = i * poly[i];
    }
    return result;
  }

  function verticalPrimitiveAt(patch, intercept, slope) {
    var v = [0, 1];
    var c = [intercept, slope];
    var v2 = multiplyPolynomials(v, v);
    var c2 = multiplyPolynomials(c, c);
    var c3 = multiplyPolynomials(c2, c);
    var result = [0];
    result = addPolynomials(result, scalePolynomial(c, patch[0]));
    result = addPolynomials(result,
      scalePolynomial(multiplyPolynomials(v, c), patch[1]));
    result = addPolynomials(result, scalePolynomial(c2, patch[2] / 2));
    result = addPolynomials(result,
      scalePolynomial(multiplyPolynomials(v2, c), patch[3]));
    result = addPolynomials(result,
      scalePolynomial(multiplyPolynomials(v, c2), patch[4] / 2));
    result = addPolynomials(result, scalePolynomial(c3, patch[5] / 3));
    return result;
  }

  function horizontalPrimitiveAt(patch, intercept, slope) {
    var c = [0, 1];
    var v = [intercept, slope];
    var c2 = multiplyPolynomials(c, c);
    var v2 = multiplyPolynomials(v, v);
    var v3 = multiplyPolynomials(v2, v);
    var result = [0];
    result = addPolynomials(result, scalePolynomial(v, patch[0]));
    result = addPolynomials(result, scalePolynomial(v2, patch[1] / 2));
    result = addPolynomials(result,
      scalePolynomial(multiplyPolynomials(c, v), patch[2]));
    result = addPolynomials(result, scalePolynomial(v3, patch[3] / 3));
    result = addPolynomials(result,
      scalePolynomial(multiplyPolynomials(c, v2), patch[4] / 2));
    result = addPolynomials(result,
      scalePolynomial(multiplyPolynomials(c2, v), patch[5]));
    return result;
  }

  function scalarGridAsPatchGrid(grid) {
    var resolution = resolutionOf(grid);
    return createGrid(
      resolution,
      function (i, j) { return [grid.lower[i][j], 0, 0, 0, 0, 0]; },
      function (i, j) { return [grid.upper[i][j], 0, 0, 0, 0, 0]; }
    );
  }

  function interimBuyerPolynomials(patchGrid) {
    var resolution = resolutionOf(patchGrid);
    var cellSize = 1 / resolution;
    var result = new Array(resolution);
    var i;
    var j;
    for (i = 0; i < resolution; i += 1) {
      var total = [0];
      for (j = 0; j < resolution; j += 1) {
        var diagonalIntercept = (j - i) * cellSize;
        total = addPolynomials(total, subtractPolynomials(
          verticalPrimitiveAt(patchGrid.lower[i][j], diagonalIntercept, 1),
          verticalPrimitiveAt(patchGrid.lower[i][j], j * cellSize, 0)
        ));
        total = addPolynomials(total, subtractPolynomials(
          verticalPrimitiveAt(patchGrid.upper[i][j], (j + 1) * cellSize, 0),
          verticalPrimitiveAt(patchGrid.upper[i][j], diagonalIntercept, 1)
        ));
      }
      result[i] = total;
    }
    return result;
  }

  function interimSellerPolynomials(patchGrid) {
    var resolution = resolutionOf(patchGrid);
    var cellSize = 1 / resolution;
    var result = new Array(resolution);
    var i;
    var j;
    for (j = 0; j < resolution; j += 1) {
      var total = [0];
      for (i = 0; i < resolution; i += 1) {
        var diagonalIntercept = (i - j) * cellSize;
        total = addPolynomials(total, subtractPolynomials(
          horizontalPrimitiveAt(patchGrid.upper[i][j], diagonalIntercept, 1),
          horizontalPrimitiveAt(patchGrid.upper[i][j], i * cellSize, 0)
        ));
        total = addPolynomials(total, subtractPolynomials(
          horizontalPrimitiveAt(patchGrid.lower[i][j], (i + 1) * cellSize, 0),
          horizontalPrimitiveAt(patchGrid.lower[i][j], diagonalIntercept, 1)
        ));
      }
      result[j] = total;
    }
    return result;
  }

  function interimBuyerAllocationPolynomials(q) {
    return interimBuyerPolynomials(scalarGridAsPatchGrid(q));
  }

  function interimSellerAllocationPolynomials(q) {
    return interimSellerPolynomials(scalarGridAsPatchGrid(q));
  }

  function interimBuyerPaymentPolynomials(pB) {
    return interimBuyerPolynomials(pB);
  }

  function interimSellerPaymentPolynomials(pS) {
    return interimSellerPolynomials(pS);
  }

  function interimAllocationPolynomials(q) {
    var patches = scalarGridAsPatchGrid(q);
    return {
      buyerAllocation: interimBuyerPolynomials(patches),
      sellerAllocation: interimSellerPolynomials(patches)
    };
  }

  function interimRulePolynomials(rule) {
    var allocation = interimAllocationPolynomials(rule.q);
    return {
      buyerAllocation: allocation.buyerAllocation,
      sellerAllocation: allocation.sellerAllocation,
      buyerPayment: interimBuyerPaymentPolynomials(rule.pB),
      sellerPayment: interimSellerPaymentPolynomials(rule.pS)
    };
  }

  function realQuadraticRoots(a, b, c, tolerance) {
    var tol = tolerance === undefined ? 1e-12 : tolerance;
    var discriminant;
    var root;
    if (Math.abs(a) <= tol) {
      if (Math.abs(b) <= tol) {
        return [];
      }
      return [-c / b];
    }
    discriminant = b * b - 4 * a * c;
    if (discriminant < -tol) {
      return [];
    }
    if (discriminant < 0) {
      discriminant = 0;
    }
    root = Math.sqrt(discriminant);
    return [(-b - root) / (2 * a), (-b + root) / (2 * a)];
  }

  function polynomialExtremaCandidates(poly, lower, upper, tolerance) {
    var derivative = derivativePolynomial(poly);
    var candidates = [lower, upper];
    realQuadraticRoots(
      derivative[2] || 0,
      derivative[1] || 0,
      derivative[0] || 0,
      tolerance
    ).forEach(function (root) {
      if (root > lower && root < upper) {
        candidates.push(root);
      }
    });
    return candidates;
  }

  function polynomialRangeOnInterval(poly, lower, upper, tolerance) {
    var minimum = Infinity;
    var maximum = -Infinity;
    polynomialExtremaCandidates(poly, lower, upper, tolerance)
      .forEach(function (value) {
        var evaluated = evaluatePolynomial(poly, value);
        minimum = Math.min(minimum, evaluated);
        maximum = Math.max(maximum, evaluated);
      });
    return { min: minimum, max: maximum };
  }

  function piecewisePolynomialRange(polynomials, tolerance) {
    var resolution = polynomials.length;
    var cellSize = 1 / resolution;
    var minimum = Infinity;
    var maximum = -Infinity;
    var i;
    for (i = 0; i < resolution; i += 1) {
      var range = polynomialRangeOnInterval(
        polynomials[i], i * cellSize, (i + 1) * cellSize, tolerance
      );
      minimum = Math.min(minimum, range.min);
      maximum = Math.max(maximum, range.max);
    }
    return { min: minimum, max: maximum };
  }

  function checkPiecewiseMonotonicity(polynomials, increasing, tolerance) {
    var resolution = polynomials.length;
    var cellSize = 1 / resolution;
    var tol = tolerance === undefined ? 1e-7 : tolerance;
    var intervalViolations = new Array(resolution).fill(false);
    var boundaryViolations = new Array(resolution - 1).fill(false);
    var maxViolation = 0;
    var i;
    for (i = 0; i < resolution; i += 1) {
      var start = i * cellSize;
      var end = (i + 1) * cellSize;
      var derivativeRange = polynomialRangeOnInterval(
        derivativePolynomial(polynomials[i]), start, end, 1e-12
      );
      var intervalViolation = increasing ?
        Math.max(0, -derivativeRange.min) : Math.max(0, derivativeRange.max);
      if (intervalViolation > tol) {
        intervalViolations[i] = true;
        maxViolation = Math.max(maxViolation, intervalViolation);
      }
      if (i < resolution - 1) {
        var leftLimit = evaluatePolynomial(polynomials[i], end);
        var rightLimit = evaluatePolynomial(polynomials[i + 1], end);
        var jumpViolation = increasing ?
          Math.max(0, leftLimit - rightLimit) :
          Math.max(0, rightLimit - leftLimit);
        if (jumpViolation > tol) {
          boundaryViolations[i] = true;
          intervalViolations[i] = true;
          intervalViolations[i + 1] = true;
          maxViolation = Math.max(maxViolation, jumpViolation);
        }
      }
    }
    return {
      holds: intervalViolations.every(function (value) { return !value; }),
      intervalViolations: intervalViolations,
      boundaryViolations: boundaryViolations,
      violationCount: intervalViolations.filter(function (value) { return value; }).length,
      maxViolation: maxViolation
    };
  }

  function validateDeviationArguments(trueType, report) {
    if (!Number.isFinite(trueType) || !Number.isFinite(report)) {
      throw new TypeError("True types and alternate reports must be finite.");
    }
  }

  function interimIntervalIndex(interim, report) {
    var resolution = interim.buyerAllocation.length;
    var boundedReport = Math.min(1, Math.max(0, report));
    return Math.min(resolution - 1, Math.floor(boundedReport * resolution));
  }

  function buyerInterimDeviationUtility(interim, trueValue, report) {
    validateDeviationArguments(trueValue, report);
    var boundedType = Math.min(1, Math.max(0, trueValue));
    var boundedReport = Math.min(1, Math.max(0, report));
    var index = interimIntervalIndex(interim, boundedReport);
    return boundedType *
      evaluatePolynomial(interim.buyerAllocation[index], boundedReport) -
      evaluatePolynomial(interim.buyerPayment[index], boundedReport);
  }

  function sellerInterimDeviationUtility(interim, trueCost, report) {
    validateDeviationArguments(trueCost, report);
    var boundedType = Math.min(1, Math.max(0, trueCost));
    var boundedReport = Math.min(1, Math.max(0, report));
    var index = interimIntervalIndex(interim, boundedReport);
    return evaluatePolynomial(interim.sellerPayment[index], boundedReport) -
      boundedType *
      evaluatePolynomial(interim.sellerAllocation[index], boundedReport);
  }

  function deviationPolynomial(interim, agent, trueType, index) {
    if (agent === "buyer") {
      return subtractPolynomials(
        scalePolynomial(interim.buyerAllocation[index], trueType),
        interim.buyerPayment[index]
      );
    }
    return subtractPolynomials(
      interim.sellerPayment[index],
      scalePolynomial(interim.sellerAllocation[index], trueType)
    );
  }

  function bestInterimReport(interim, agent, trueType, options) {
    validateDeviationArguments(trueType, trueType);
    var settings = options || {};
    var algebraTolerance = settings.algebraTolerance === undefined ?
      1e-12 : settings.algebraTolerance;
    var verdictTolerance = settings.verdictTolerance === undefined ?
      1e-7 : settings.verdictTolerance;
    var resolution = interim.buyerAllocation.length;
    var cellSize = 1 / resolution;
    var boundedType = Math.min(1, Math.max(0, trueType));
    var bestUtility = -Infinity;
    var bestReport = boundedType;
    var i;
    for (i = 0; i < resolution; i += 1) {
      var lower = i * cellSize;
      var upper = (i + 1) * cellSize;
      var poly = deviationPolynomial(interim, agent, boundedType, i);
      polynomialExtremaCandidates(poly, lower, upper, algebraTolerance)
        .forEach(function (candidate) {
          var utility = evaluatePolynomial(poly, candidate);
          var isHigher = utility > bestUtility + algebraTolerance;
          var isCloserTie = Math.abs(utility - bestUtility) <= algebraTolerance &&
            Math.abs(candidate - boundedType) < Math.abs(bestReport - boundedType);
          if (isHigher || isCloserTie) {
            bestUtility = utility;
            bestReport = candidate;
          }
        });
    }
    var truthfulUtility = agent === "buyer" ?
      buyerInterimDeviationUtility(interim, boundedType, boundedType) :
      sellerInterimDeviationUtility(interim, boundedType, boundedType);
    if (truthfulUtility >= bestUtility - verdictTolerance) {
      bestUtility = truthfulUtility;
      bestReport = boundedType;
    }
    return {
      report: Math.min(1, Math.max(0, bestReport)),
      utility: bestUtility,
      truthfulUtility: truthfulUtility,
      gain: Math.max(0, bestUtility - truthfulUtility)
    };
  }

  function buyerBestInterimReport(interim, trueValue, options) {
    return bestInterimReport(interim, "buyer", trueValue, options);
  }

  function sellerBestInterimReport(interim, trueCost, options) {
    return bestInterimReport(interim, "seller", trueCost, options);
  }

  function deviationUtilityRange(interim, agent, tolerance) {
    var resolution = interim.buyerAllocation.length;
    var atZero = new Array(resolution);
    var atOne = new Array(resolution);
    var i;
    for (i = 0; i < resolution; i += 1) {
      atZero[i] = deviationPolynomial(interim, agent, 0, i);
      atOne[i] = deviationPolynomial(interim, agent, 1, i);
    }
    var zeroRange = piecewisePolynomialRange(atZero, tolerance);
    var oneRange = piecewisePolynomialRange(atOne, tolerance);
    return {
      min: Math.min(zeroRange.min, oneRange.min),
      max: Math.max(zeroRange.max, oneRange.max)
    };
  }

  function interimDeviationDiagnostics(interim, options) {
    var settings = options || {};
    var traceSamples = settings.traceSamples === undefined ?
      61 : settings.traceSamples;
    var buyerResponses = [];
    var sellerResponses = [];
    var sample;
    for (sample = 0; sample < traceSamples; sample += 1) {
      var trueType = sample / (traceSamples - 1);
      var buyer = buyerBestInterimReport(interim, trueType, settings);
      var seller = sellerBestInterimReport(interim, trueType, settings);
      buyer.trueType = trueType;
      seller.trueType = trueType;
      buyerResponses.push(buyer);
      sellerResponses.push(seller);
    }
    return {
      buyer: {
        range: deviationUtilityRange(interim, "buyer", settings.algebraTolerance),
        bestResponses: buyerResponses
      },
      seller: {
        range: deviationUtilityRange(interim, "seller", settings.algebraTolerance),
        bestResponses: sellerResponses
      }
    };
  }

  function allocationErrorAt(q, v, c) {
    var allocation = scalarGridValueAt(q, v, c);
    var efficient = v >= c ? 1 : 0;
    return {
      q: allocation,
      efficient: efficient,
      over: Math.max(0, allocation - efficient),
      under: Math.max(0, efficient - allocation)
    };
  }

  global.BilateralTradeEnvelope = Object.freeze({
    createGrid: createGrid,
    constantGrid: constantGrid,
    efficientGrid: efficientGrid,
    postedPriceGrid: postedPriceGrid,
    chatterjeeSamuelsonGrid: chatterjeeSamuelsonGrid,
    triangleCentroid: triangleCentroid,
    triangleVertices: triangleVertices,
    weightedScalarGridIntegral: weightedScalarGridIntegral,
    welfare: welfare,
    expectedTradeProbability: expectedTradeProbability,
    efficientWelfare: efficientWelfare,
    countTrueGrid: countTrueGrid,
    checkDsicAllocation: checkDsicAllocation,
    evaluatePatch: evaluatePatch,
    scalarGridValueAt: scalarGridValueAt,
    patchGridValueAt: patchGridValueAt,
    zeroBoundaryPayments: zeroBoundaryPayments,
    truthfulPayoffPatches: truthfulPayoffPatches,
    revenuePatches: revenuePatches,
    affinePatchGridRange: affinePatchGridRange,
    addPolynomials: addPolynomials,
    scalePolynomial: scalePolynomial,
    subtractPolynomials: subtractPolynomials,
    multiplyPolynomials: multiplyPolynomials,
    evaluatePolynomial: evaluatePolynomial,
    verticalPrimitiveAt: verticalPrimitiveAt,
    piecewisePolynomialRange: piecewisePolynomialRange,
    interimBuyerAllocationPolynomials: interimBuyerAllocationPolynomials,
    interimSellerAllocationPolynomials: interimSellerAllocationPolynomials,
    interimBuyerPaymentPolynomials: interimBuyerPaymentPolynomials,
    interimSellerPaymentPolynomials: interimSellerPaymentPolynomials,
    interimAllocationPolynomials: interimAllocationPolynomials,
    interimRulePolynomials: interimRulePolynomials,
    checkPiecewiseMonotonicity: checkPiecewiseMonotonicity,
    buyerInterimDeviationUtility: buyerInterimDeviationUtility,
    sellerInterimDeviationUtility: sellerInterimDeviationUtility,
    buyerBestInterimReport: buyerBestInterimReport,
    sellerBestInterimReport: sellerBestInterimReport,
    interimDeviationDiagnostics: interimDeviationDiagnostics,
    allocationErrorAt: allocationErrorAt
  });
})(window);
