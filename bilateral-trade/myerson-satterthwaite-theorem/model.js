(function (global) {
  "use strict";

  var MONOTONICITY_TOLERANCE = 1e-6;
  var BALANCE_TOLERANCE = 1e-6;

  var CELL_RESOLUTION = 20;
  var CELL_SIZE = 1 / CELL_RESOLUTION;

  var clamp = global.NumberUtils.clamp;
  var sharedEnvelope = global.BilateralTradeEnvelope;
  var countTrue = sharedEnvelope.countTrueGrid;
  var zeroBoundaryPayments = sharedEnvelope.zeroBoundaryPayments;
  var buyerInterimDeviationUtility = sharedEnvelope.buyerInterimDeviationUtility;
  var sellerInterimDeviationUtility = sharedEnvelope.sellerInterimDeviationUtility;
  var allocationErrorAt = sharedEnvelope.allocationErrorAt;

  function clampIndex(index) {
    return Math.max(0, Math.min(CELL_RESOLUTION - 1, index));
  }

  function createCellGrid(fillLower, fillUpper) {
    return sharedEnvelope.createGrid(
      CELL_RESOLUTION, fillLower, fillUpper
    );
  }

  function constantCellGrid(value) {
    return sharedEnvelope.constantGrid(CELL_RESOLUTION, value);
  }

  function efficientGrid() {
    return sharedEnvelope.efficientGrid(CELL_RESOLUTION);
  }

  function postedPriceGrid(price) {
    return sharedEnvelope.postedPriceGrid(CELL_RESOLUTION, price);
  }

  function chatterjeeSamuelsonGrid() {
    return sharedEnvelope.chatterjeeSamuelsonGrid(CELL_RESOLUTION);
  }

  function countTrue1D(boolArray) {
    var count = 0;
    boolArray.forEach(function (value) {
      if (value) { count += 1; }
    });
    return count;
  }

  function checkBuyerMonotonicity(grid, tolerance) {
    var tol = tolerance === undefined ? MONOTONICITY_TOLERANCE : tolerance;
    return sharedEnvelope.checkDsicAllocation(grid, tol).buyer.violations;
  }

  function checkSellerMonotonicity(grid, tolerance) {
    var tol = tolerance === undefined ? MONOTONICITY_TOLERANCE : tolerance;
    return sharedEnvelope.checkDsicAllocation(grid, tol).seller.violations;
  }

  function isDsicImplementable(buyerViolations, sellerViolations) {
    return countTrue(buyerViolations) === 0 && countTrue(sellerViolations) === 0;
  }

  function interimBuyerProbability(grid) {
    var result = new Array(CELL_RESOLUTION);
    var i;
    var j;
    for (i = 0; i < CELL_RESOLUTION; i += 1) {
      var total = 0;
      for (j = 0; j < CELL_RESOLUTION; j += 1) {
        total += grid.lower[i][j] + grid.upper[i][j];
      }
      result[i] = total / (2 * CELL_RESOLUTION);
    }
    return result;
  }

  function interimSellerProbability(grid) {
    var result = new Array(CELL_RESOLUTION);
    var i;
    var j;
    for (j = 0; j < CELL_RESOLUTION; j += 1) {
      var total = 0;
      for (i = 0; i < CELL_RESOLUTION; i += 1) {
        total += grid.lower[i][j] + grid.upper[i][j];
      }
      result[j] = total / (2 * CELL_RESOLUTION);
    }
    return result;
  }

  function checkInterimBuyerMonotonicity(Q, tolerance) {
    var tol = tolerance === undefined ? MONOTONICITY_TOLERANCE : tolerance;
    var violations = new Array(CELL_RESOLUTION).fill(false);
    var i;
    for (i = 0; i < CELL_RESOLUTION - 1; i += 1) {
      if (Q[i + 1] < Q[i] - tol) {
        violations[i] = true;
        violations[i + 1] = true;
      }
    }
    return violations;
  }

  function checkInterimSellerMonotonicity(Q, tolerance) {
    var tol = tolerance === undefined ? MONOTONICITY_TOLERANCE : tolerance;
    var violations = new Array(CELL_RESOLUTION).fill(false);
    var j;
    for (j = 0; j < CELL_RESOLUTION - 1; j += 1) {
      if (Q[j + 1] > Q[j] + tol) {
        violations[j] = true;
        violations[j + 1] = true;
      }
    }
    return violations;
  }

  function triangleCentroid(i, j, isLower) {
    return sharedEnvelope.triangleCentroid(
      i, j, isLower, CELL_RESOLUTION
    );
  }

  function cumulativeBuyerPayoffAt(grid, v, c) {
    var h = CELL_SIZE;
    var i = clampIndex(Math.floor(v / h));
    var delta = v - i * h;
    var j = clampIndex(Math.floor(c / h));
    var epsilon = c - j * h;
    var total = 0;
    var row;
    for (row = 0; row < i; row += 1) {
      total += epsilon * grid.upper[row][j] + (h - epsilon) * grid.lower[row][j];
    }
    total += Math.min(delta, epsilon) * grid.upper[i][j] +
      Math.max(0, delta - epsilon) * grid.lower[i][j];
    return total;
  }

  function cumulativeSellerPayoffAt(grid, v, c) {
    var h = CELL_SIZE;
    var i = clampIndex(Math.floor(v / h));
    var delta = v - i * h;
    var j = clampIndex(Math.floor(c / h));
    var epsilon = c - j * h;
    var total = 0;
    var col;
    for (col = j + 1; col < CELL_RESOLUTION; col += 1) {
      total += delta * grid.lower[i][col] + (h - delta) * grid.upper[i][col];
    }
    total += Math.max(0, delta - epsilon) * grid.lower[i][j] +
      (h - Math.max(epsilon, delta)) * grid.upper[i][j];
    return total;
  }

  function exactRuleSurfaces(grid) {
    var payments = zeroBoundaryPayments(grid);
    var rule = { q: grid, pB: payments.pB, pS: payments.pS };
    var payoff = sharedEnvelope.truthfulPayoffPatches(rule);
    return {
      rule: rule,
      buyerPayoff: payoff.buyer,
      sellerPayoff: payoff.seller,
      revenue: sharedEnvelope.revenuePatches(rule)
    };
  }

  function welfare(grid) {
    return sharedEnvelope.welfare(grid);
  }

  function expectedBuyerPayoff(grid) {
    return sharedEnvelope.weightedScalarGridIntegral(
      grid, function (v) { return 1 - v; }
    );
  }

  function expectedSellerPayoff(grid) {
    return sharedEnvelope.weightedScalarGridIntegral(
      grid, function (v, c) { return c; }
    );
  }

  function summarize(grid) {
    var exact = exactRuleSurfaces(grid);
    var interim = sharedEnvelope.interimRulePolynomials(exact.rule);
    var buyerMonotonicity = sharedEnvelope.checkPiecewiseMonotonicity(
      interim.buyerAllocation, true, MONOTONICITY_TOLERANCE
    );
    var sellerMonotonicity = sharedEnvelope.checkPiecewiseMonotonicity(
      interim.sellerAllocation, false, MONOTONICITY_TOLERANCE
    );
    var icImplementable = buyerMonotonicity.holds && sellerMonotonicity.holds;
    var deviation = sharedEnvelope.interimDeviationDiagnostics(interim, {
      traceSamples: 61,
      algebraTolerance: 1e-12,
      verdictTolerance: MONOTONICITY_TOLERANCE
    });
    var revenueRange = sharedEnvelope.affinePatchGridRange(exact.revenue);

    var minRevenue = revenueRange.min;
    var maxRevenue = revenueRange.max;

    var eBuyerPayoff = expectedBuyerPayoff(grid);
    var eSellerPayoff = expectedSellerPayoff(grid);

    var w = welfare(grid);
    var eRevenue = w - eBuyerPayoff - eSellerPayoff;
    var firstBestWelfare = sharedEnvelope.efficientWelfare(CELL_RESOLUTION);

    return {
      grid: grid,
      interim: interim,
      deviation: deviation,
      patches: {
        buyerPayoff: exact.buyerPayoff,
        sellerPayoff: exact.sellerPayoff,
        revenue: exact.revenue
      },
      verdicts: {
        icImplementable: icImplementable,
        buyerIcViolationCount: buyerMonotonicity.violationCount,
        sellerIcViolationCount: sellerMonotonicity.violationCount,
        minBuyerPayoff: 0,
        minSellerPayoff: 0,
        expectedBuyerPayoff: eBuyerPayoff,
        expectedSellerPayoff: eSellerPayoff,
        exPostBudgetBalanced: Math.abs(minRevenue) <= BALANCE_TOLERANCE &&
          Math.abs(maxRevenue) <= BALANCE_TOLERANCE,
        exPostNoDeficit: minRevenue >= -BALANCE_TOLERANCE,
        minRevenue: minRevenue,
        maxRevenue: maxRevenue,
        expectedRevenue: eRevenue,
        expectedNoDeficit: eRevenue >= -BALANCE_TOLERANCE,
        welfare: w,
        firstBestWelfare: firstBestWelfare,
        efficiencyLoss: firstBestWelfare - w
      }
    };
  }

  global.BilateralTradeModel = Object.freeze({
    MONOTONICITY_TOLERANCE: MONOTONICITY_TOLERANCE,
    BALANCE_TOLERANCE: BALANCE_TOLERANCE,
    CELL_RESOLUTION: CELL_RESOLUTION,
    CELL_SIZE: CELL_SIZE,
    clamp: clamp,
    triangleCentroid: triangleCentroid,
    createCellGrid: createCellGrid,
    constantCellGrid: constantCellGrid,
    efficientGrid: efficientGrid,
    postedPriceGrid: postedPriceGrid,
    chatterjeeSamuelsonGrid: chatterjeeSamuelsonGrid,
    checkBuyerMonotonicity: checkBuyerMonotonicity,
    checkSellerMonotonicity: checkSellerMonotonicity,
    countTrue: countTrue,
    countTrue1D: countTrue1D,
    isDsicImplementable: isDsicImplementable,
    interimBuyerProbability: interimBuyerProbability,
    interimSellerProbability: interimSellerProbability,
    checkInterimBuyerMonotonicity: checkInterimBuyerMonotonicity,
    checkInterimSellerMonotonicity: checkInterimSellerMonotonicity,
    cumulativeBuyerPayoffAt: cumulativeBuyerPayoffAt,
    cumulativeSellerPayoffAt: cumulativeSellerPayoffAt,
    patchGridValueAt: sharedEnvelope.patchGridValueAt,
    buyerInterimDeviationUtility: buyerInterimDeviationUtility,
    sellerInterimDeviationUtility: sellerInterimDeviationUtility,
    allocationErrorAt: allocationErrorAt,
    zeroBoundaryPayments: zeroBoundaryPayments,
    welfare: welfare,
    expectedBuyerPayoff: expectedBuyerPayoff,
    expectedSellerPayoff: expectedSellerPayoff,
    summarize: summarize
  });
})(window);
