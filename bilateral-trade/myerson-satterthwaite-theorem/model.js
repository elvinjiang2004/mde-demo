(function (global) {
  "use strict";

  var MONOTONICITY_TOLERANCE = 1e-6;
  var BALANCE_TOLERANCE = 1e-6;

  // The paintable grid is 20x20 genuine 0.05 x 0.05 cells, not point
  // samples: cell (i,j) covers v in [i*CELL_SIZE, (i+1)*CELL_SIZE), c in
  // [j*CELL_SIZE, (j+1)*CELL_SIZE), so every cell -- including the ones
  // touching v=0, v=1, c=0, c=1 -- is a full-width square. There is no
  // point-sampled grid needing half-width edge tiles.
  var CELL_RESOLUTION = 20;
  var CELL_SIZE = 1 / CELL_RESOLUTION;
  var TRIANGLE_AREA = (CELL_SIZE * CELL_SIZE) / 2;

  function clamp(value, lower, upper) {
    return Math.min(upper, Math.max(lower, value));
  }

  function clampIndex(index) {
    return Math.max(0, Math.min(CELL_RESOLUTION - 1, index));
  }

  // Each cell is split by its own bottom-left-to-top-right diagonal into a
  // lower-right triangle (LOWER: local v-offset >= local c-offset, i.e. the
  // higher-v/lower-c half) and an upper-left triangle (UPPER: local
  // v-offset <= local c-offset). A grid is therefore two parallel 20x20
  // arrays, `lower` and `upper`. The learner can paint either triangle
  // independently, and the exact preset generators below can likewise set
  // the two halves separately. This is what lets a diagonal threshold like
  // v=c or v-c=1/4 be represented exactly -- with literally zero
  // approximation error -- whenever that threshold is a whole multiple of
  // CELL_SIZE, because the threshold then runs exactly along that cell's
  // own diagonal split.
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
    // q*(v,c) = 1{v>c}. The threshold v=c runs exactly along the diagonal
    // of every cell on the grid's own diagonal (i===j): that cell's
    // lower-right triangle has v>c throughout its open interior, so it is
    // 1; its upper-left triangle has v<c throughout, so it is 0 (the
    // shared diagonal edge itself, v=c, has probability zero under a
    // continuous type distribution and does not affect any integral). Off
    // the diagonal, i>j gives v>c throughout the whole cell (both
    // triangles 1); i<j gives v<c throughout (both 0).
    return createCellGrid(
      function (i, j) { return i >= j ? 1 : 0; },
      function (i, j) { return i > j ? 1 : 0; }
    );
  }

  function postedPriceGrid(price) {
    // Trade happens iff both sides find the posted price acceptable. Cell
    // boundaries sit exactly at multiples of CELL_SIZE, so price is
    // rounded to the nearest boundary k*CELL_SIZE (the price control's own
    // step matches CELL_SIZE, so this is a no-op for any price the control
    // can actually produce) and whole cells -- not sampled points -- are
    // classified against it: row i is v>=price throughout iff i>=k; column
    // j is c<=price throughout iff j<k. Because a boundary between whole
    // cells is never inside a cell's interior, there is no tie to break:
    // p_B(v,c)=p_S(v,c)=price*q(v,c) and R(v,c)=0 exactly, everywhere,
    // for any price (verified at every one of the 800 triangle centroids).
    var p = clamp(price, 0, 1);
    var k = Math.round(p / CELL_SIZE);
    return createCellGrid(
      function (i, j) { return (i >= k && j < k) ? 1 : 0; },
      function (i, j) { return (i >= k && j < k) ? 1 : 0; }
    );
  }

  function chatterjeeSamuelsonGrid() {
    // The allocation induced by the symmetric linear Bayes-Nash equilibrium
    // of the Chatterjee-Samuelson (1983) k=1/2 double auction under
    // Uniform[0,1] buyer/seller types: b(v)=2/3 v+1/12, a(c)=2/3 c+1/4,
    // trade iff b(v)>=a(c), which reduces to v-c >= 1/4. 1/4 is exactly
    // 5*CELL_SIZE, so this threshold runs exactly along the diagonal of
    // every cell with i-j=5, the same way v=c runs along the diagonal of
    // every cell with i=j in efficientGrid above -- and for the same
    // reason it is exact: trade is decided by comparing the integer cell
    // indices i and j directly, never by subtracting two floating-point
    // coordinates, so there is no floating-point cancellation to guard
    // against here.
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

  // Pointwise (ex-post/dominant-strategy) monotonicity, checked directly on
  // the triangle values: q must be nondecreasing in v for the buyer,
  // nonincreasing in c for the seller. Kept as a tested utility, matching
  // the stronger DSIC notion the module used before switching to Bayesian
  // (interim) IC; not part of the live diagnostic.
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

  // Interim (Bayesian) allocation probabilities, cell-averaged: Q_B(row i)
  // is the trade probability for a buyer whose value is uniform within
  // that 0.05-wide row, averaged exactly over the seller's full cost range
  // -- an exact area-weighted average over the row's 40 triangles (each of
  // area TRIANGLE_AREA), not a quadrature approximation of a continuous
  // curve. Bayesian IC (Myerson 1981) holds iff Q_B is nondecreasing and
  // Q_S is nonincreasing; this is weaker than pointwise q(v,c)
  // monotonicity, since the average of a non-monotonic row/column can
  // still be monotonic.
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

  // The centroid of a triangle is the exact point at which evaluating any
  // affine (linear-plus-constant) function and multiplying by the
  // triangle's area reproduces that function's exact integral over the
  // triangle. Every quantity this module needs from a linear integrand
  // (v-c for welfare, 1-v and c for the expected-utility identities below)
  // is therefore exact when evaluated here, not approximated.
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

  // U_B(v,c) = integral_0^v q(x,c) dx, evaluated exactly at any (v,c): full
  // rows below v each contribute their exact trapezoid-free area (a row is
  // two triangles, so integrating across it at fixed c splits cleanly into
  // an upper-triangle portion and a lower-triangle portion of the column's
  // local c-offset), and the row containing v contributes the same split
  // truncated at v's own local offset. This is a closed form, not a
  // discretization of q -- see the paired PowerShell verification in this
  // change's history for hand-checked agreement with the closed forms
  // max(0,v-c) (efficient benchmark) and max(0,v-p) (posted price).
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

  // U_S(v,c) = integral_c^1 q(v,y) dy, the mirror image of the buyer
  // formula: full columns to the right of c, plus the column containing c
  // itself truncated at c's own local offset.
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

  // Builds another {lower, upper} grid at the same 20x20x2 resolution as q
  // itself, evaluating fn(v, c, q, i, j, isLower) at every triangle's own
  // centroid -- so
  // every diagnostic heatmap is drawn from the same triangular mesh the
  // learner paints, with no separate display resolution.
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
      // Preserve the transfer arithmetic directly:
      // R = p_B - p_S = (v*q - U_B) - (c*q + U_S).
      return (v * q - uB) - (c * q + uS);
    });
  }

  function overTradeGrid(grid) {
    // Trade occurring where v < c, weighted by how much trade occurs.
    return pointwiseTriangleGrid(grid, function (v, c, q) {
      return v < c ? q : 0;
    });
  }

  function underTradeGrid(grid) {
    // Trade failing to occur where v > c, weighted by the missing amount.
    return pointwiseTriangleGrid(grid, function (v, c, q) {
      return v > c ? 1 - q : 0;
    });
  }

  // Exact double integral of grid(v,c) * weightFn(v,c) over [0,1]^2, valid
  // whenever weightFn is affine in (v,c) -- see triangleCentroid above.
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
    // W(q) = E[(V-C) q(V,C)]. (v-c) is affine, so this is exact.
    return sumOverTriangles(grid, function (v, c) { return v - c; });
  }

  // E[U_B] = E[(1-V) q(V,C)] and E[U_S] = E[C q(V,C)]: by Fubini,
  // integral U_B(v,c) dv dc = integral integral_{0<=x<=v} q(x,c) dx dv dc
  // = integral q(x,c)*(1-x) dx dc, switching the order of integration (the
  // v-integral of dv over [x,1] is exactly (1-x)); U_S is the mirror
  // argument. Both integrands are affine, so both are exact, and neither
  // needs a pointwise U_B/U_S grid to compute -- only q itself.
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
    // Bayesian IC is checked on the interim (own-type-averaged) allocation
    // probabilities, not the pointwise q(v,c) grid -- see the comment above
    // interimBuyerProbability. checkBuyerMonotonicity/checkSellerMonotonicity
    // (the stronger, ex-post/dominant-strategy condition) remain available
    // as tested utilities but are no longer part of the live diagnostic.
    var interimBuyerProbabilityArray = interimBuyerProbability(grid);
    var interimSellerProbabilityArray = interimSellerProbability(grid);
    var buyerIcViolations = checkInterimBuyerMonotonicity(interimBuyerProbabilityArray);
    var sellerIcViolations = checkInterimSellerMonotonicity(interimSellerProbabilityArray);
    var icImplementable = countTrue1D(buyerIcViolations) === 0 &&
      countTrue1D(sellerIcViolations) === 0;

    var buyerUtility = buyerUtilityGrid(grid);
    var sellerUtility = sellerUtilityGrid(grid);
    var revenue = revenueGrid(grid, buyerUtility, sellerUtility);

    // U_B(0,c) = U_S(v,1) = 0 and both are monotone in their own type by
    // construction (dU_B/dv = q >= 0, dU_S/dc = -q <= 0), so the true
    // minimum over the whole continuous domain is always exactly 0
    // regardless of q: ex-post IR is automatic here and never actually
    // varies. This is a structural fact, not something to sample -- the
    // displayed buyerUtility/sellerUtility grids are only evaluated at
    // triangle centroids (the closest being at v=CELL_SIZE/3, not v=0
    // itself), so scanning them with minValue would report a small
    // positive number instead of the true 0. Expected utility
    // (information rent) is the quantity that does move with q, so it is
    // what gets displayed.
    var minBuyerUtility = 0;
    var minSellerUtility = 0;
    var minRevenue = minValue(revenue);
    var maxRevenue = maxValue(revenue);

    var eBuyerUtility = expectedBuyerUtility(grid);
    var eSellerUtility = expectedSellerUtility(grid);

    var w = welfare(grid);
    // R = (v-c)q - U_B - U_S pointwise, and every operator used here is
    // linear, so this identity survives exactly into the expectations:
    // E[R] = W(q) - E[U_B] - E[U_S], with no separate integral needed.
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
