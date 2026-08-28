(function (global) {
  "use strict";

  var MONOTONICITY_TOLERANCE = 1e-6;
  var BALANCE_TOLERANCE = 1e-6;

  var CELL_RESOLUTION = 20;
  var CELL_SIZE = 1 / CELL_RESOLUTION;
  var TRIANGLE_AREA = (CELL_SIZE * CELL_SIZE) / 2;

  var clamp = global.NumberUtils.clamp;

  function clampIndex(index) {
    return Math.max(0, Math.min(CELL_RESOLUTION - 1, index));
  }

  function createCellGrid(fillLower, fillUpper) {
    var lower = new Array(CELL_RESOLUTION);
    var upper = new Array(CELL_RESOLUTION);
    var i;
    var j;
    for (i = 0; i < CELL_RESOLUTION; i += 1) {
      lower[i] = new Array(CELL_RESOLUTION);
      upper[i] = new Array(CELL_RESOLUTION);
      for (j = 0; j < CELL_RESOLUTION; j += 1) {
        lower[i][j] = fillLower(i, j);
        upper[i][j] = fillUpper(i, j);
      }
    }
    return { lower: lower, upper: upper };
  }

  function constantCellGrid(value) {
    return createCellGrid(
      function () { return value; },
      function () { return value; }
    );
  }

  function efficientGrid() {
    return createCellGrid(
      function (i, j) { return i >= j ? 1 : 0; },
      function (i, j) { return i > j ? 1 : 0; }
    );
  }

  function postedPriceGrid(price) {
    var p = clamp(price, 0, 1);
    var k = Math.round(p / CELL_SIZE);
    return createCellGrid(
      function (i, j) { return (i >= k && j < k) ? 1 : 0; },
      function (i, j) { return (i >= k && j < k) ? 1 : 0; }
    );
  }

  function chatterjeeSamuelsonGrid() {
    var OFFSET = Math.round(0.25 / CELL_SIZE);
    return createCellGrid(
      function (i, j) { return (i - j) >= OFFSET ? 1 : 0; },
      function (i, j) { return (i - j) > OFFSET ? 1 : 0; }
    );
  }

  function countTrue(cellGrid) {
    var count = 0;
    function scan(rows) {
      rows.forEach(function (row) {
        row.forEach(function (value) {
          if (value) { count += 1; }
        });
      });
    }
    scan(cellGrid.lower);
    scan(cellGrid.upper);
    return count;
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
    var violations = createCellGrid(
      function () { return false; },
      function () { return false; }
    );
    var i;
    var j;
    for (j = 0; j < CELL_RESOLUTION; j += 1) {
      for (i = 0; i < CELL_RESOLUTION - 1; i += 1) {
        if (grid.lower[i + 1][j] < grid.lower[i][j] - tol ||
            grid.upper[i + 1][j] < grid.upper[i][j] - tol) {
          violations.lower[i][j] = true;
          violations.lower[i + 1][j] = true;
          violations.upper[i][j] = true;
          violations.upper[i + 1][j] = true;
        }
      }
    }
    return violations;
  }

  function checkSellerMonotonicity(grid, tolerance) {
    var tol = tolerance === undefined ? MONOTONICITY_TOLERANCE : tolerance;
    var violations = createCellGrid(
      function () { return false; },
      function () { return false; }
    );
    var i;
    var j;
    for (i = 0; i < CELL_RESOLUTION; i += 1) {
      for (j = 0; j < CELL_RESOLUTION - 1; j += 1) {
        if (grid.lower[i][j + 1] > grid.lower[i][j] + tol ||
            grid.upper[i][j + 1] > grid.upper[i][j] + tol) {
          violations.lower[i][j] = true;
          violations.lower[i][j + 1] = true;
          violations.upper[i][j] = true;
          violations.upper[i][j + 1] = true;
        }
      }
    }
    return violations;
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
    if (isLower) {
      return {
        v: i * CELL_SIZE + (2 / 3) * CELL_SIZE,
        c: j * CELL_SIZE + (1 / 3) * CELL_SIZE
      };
    }
    return {
      v: i * CELL_SIZE + (1 / 3) * CELL_SIZE,
      c: j * CELL_SIZE + (2 / 3) * CELL_SIZE
    };
  }

  function cumulativeBuyerUtilityAt(grid, v, c) {
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

  function cumulativeSellerUtilityAt(grid, v, c) {
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

  function pointwiseTriangleGrid(grid, fn) {
    var lower = new Array(CELL_RESOLUTION);
    var upper = new Array(CELL_RESOLUTION);
    var i;
    var j;
    for (i = 0; i < CELL_RESOLUTION; i += 1) {
      lower[i] = new Array(CELL_RESOLUTION);
      upper[i] = new Array(CELL_RESOLUTION);
      for (j = 0; j < CELL_RESOLUTION; j += 1) {
        var lc = triangleCentroid(i, j, true);
        var uc = triangleCentroid(i, j, false);
        lower[i][j] = fn(lc.v, lc.c, grid.lower[i][j], i, j, true);
        upper[i][j] = fn(uc.v, uc.c, grid.upper[i][j], i, j, false);
      }
    }
    return { lower: lower, upper: upper };
  }

  function buyerUtilityGrid(grid) {
    return pointwiseTriangleGrid(grid, function (v, c) {
      return cumulativeBuyerUtilityAt(grid, v, c);
    });
  }

  function sellerUtilityGrid(grid) {
    return pointwiseTriangleGrid(grid, function (v, c) {
      return cumulativeSellerUtilityAt(grid, v, c);
    });
  }

  function revenueGrid(grid, buyerUtility, sellerUtility) {
    return pointwiseTriangleGrid(grid, function (v, c, q, i, j, isLower) {
      var uB = isLower ? buyerUtility.lower[i][j] : buyerUtility.upper[i][j];
      var uS = isLower ? sellerUtility.lower[i][j] : sellerUtility.upper[i][j];
      return (v * q - uB) - (c * q + uS);
    });
  }

  function overTradeGrid(grid) {
    return pointwiseTriangleGrid(grid, function (v, c, q) {
      return v < c ? q : 0;
    });
  }

  function underTradeGrid(grid) {
    return pointwiseTriangleGrid(grid, function (v, c, q) {
      return v > c ? 1 - q : 0;
    });
  }

  function sumOverTriangles(grid, weightFn) {
    var total = 0;
    var i;
    var j;
    for (i = 0; i < CELL_RESOLUTION; i += 1) {
      for (j = 0; j < CELL_RESOLUTION; j += 1) {
        var lc = triangleCentroid(i, j, true);
        var uc = triangleCentroid(i, j, false);
        total += grid.lower[i][j] * weightFn(lc.v, lc.c);
        total += grid.upper[i][j] * weightFn(uc.v, uc.c);
      }
    }
    return total * TRIANGLE_AREA;
  }

  function welfare(grid) {
    return sumOverTriangles(grid, function (v, c) { return v - c; });
  }

  function expectedBuyerUtility(grid) {
    return sumOverTriangles(grid, function (v) { return 1 - v; });
  }

  function expectedSellerUtility(grid) {
    return sumOverTriangles(grid, function (v, c) { return c; });
  }

  function minValue(cellGrid) {
    var minimum = Infinity;
    function scan(rows) {
      rows.forEach(function (row) {
        row.forEach(function (value) {
          if (value < minimum) { minimum = value; }
        });
      });
    }
    scan(cellGrid.lower);
    scan(cellGrid.upper);
    return minimum;
  }

  function maxValue(cellGrid) {
    var maximum = -Infinity;
    function scan(rows) {
      rows.forEach(function (row) {
        row.forEach(function (value) {
          if (value > maximum) { maximum = value; }
        });
      });
    }
    scan(cellGrid.lower);
    scan(cellGrid.upper);
    return maximum;
  }

  var cachedEfficientWelfare = null;

  function efficientWelfare() {
    if (cachedEfficientWelfare === null) {
      cachedEfficientWelfare = welfare(efficientGrid());
    }
    return cachedEfficientWelfare;
  }

  function summarize(grid) {
    var interimBuyerProbabilityArray = interimBuyerProbability(grid);
    var interimSellerProbabilityArray = interimSellerProbability(grid);
    var buyerIcViolations = checkInterimBuyerMonotonicity(interimBuyerProbabilityArray);
    var sellerIcViolations = checkInterimSellerMonotonicity(interimSellerProbabilityArray);
    var icImplementable = countTrue1D(buyerIcViolations) === 0 &&
      countTrue1D(sellerIcViolations) === 0;

    var buyerUtility = buyerUtilityGrid(grid);
    var sellerUtility = sellerUtilityGrid(grid);
    var revenue = revenueGrid(grid, buyerUtility, sellerUtility);

    var minBuyerUtility = 0;
    var minSellerUtility = 0;
    var minRevenue = minValue(revenue);
    var maxRevenue = maxValue(revenue);

    var eBuyerUtility = expectedBuyerUtility(grid);
    var eSellerUtility = expectedSellerUtility(grid);

    var w = welfare(grid);
    var eRevenue = w - eBuyerUtility - eSellerUtility;
    var firstBestWelfare = efficientWelfare();

    var overTrade = overTradeGrid(grid);
    var underTrade = underTradeGrid(grid);

    return {
      grid: grid,
      interimBuyerProbability: interimBuyerProbabilityArray,
      interimSellerProbability: interimSellerProbabilityArray,
      buyerIcViolations: buyerIcViolations,
      sellerIcViolations: sellerIcViolations,
      buyerUtility: buyerUtility,
      sellerUtility: sellerUtility,
      revenue: revenue,
      overTrade: overTrade,
      underTrade: underTrade,
      verdicts: {
        icImplementable: icImplementable,
        buyerIcViolationCount: countTrue1D(buyerIcViolations),
        sellerIcViolationCount: countTrue1D(sellerIcViolations),
        minBuyerUtility: minBuyerUtility,
        minSellerUtility: minSellerUtility,
        expectedBuyerUtility: eBuyerUtility,
        expectedSellerUtility: eSellerUtility,
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
    cumulativeBuyerUtilityAt: cumulativeBuyerUtilityAt,
    cumulativeSellerUtilityAt: cumulativeSellerUtilityAt,
    welfare: welfare,
    expectedBuyerUtility: expectedBuyerUtility,
    expectedSellerUtility: expectedSellerUtility,
    summarize: summarize
  });
})(window);
