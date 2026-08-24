(function () {
  "use strict";

  var model = window.BilateralTradeModel;
  var tests = [];
  var tolerance = 1e-8;

  function test(name, callback) {
    tests.push({ name: name, callback: callback });
  }

  function assert(condition, message) {
    if (!condition) {
      throw new Error(message || "Assertion failed.");
    }
  }

  function assertClose(actual, expected, message, customTolerance) {
    var allowed = customTolerance === undefined ? tolerance : customTolerance;
    if (!Number.isFinite(actual) || Math.abs(actual - expected) > allowed) {
      throw new Error(
        (message || "Values differ.") +
        " Expected " + expected + ", received " + actual + "."
      );
    }
  }

  function isFiniteCellGrid(grid) {
    function ok(rows) {
      return rows.every(function (row) {
        return row.every(function (value) { return Number.isFinite(value); });
      });
    }
    return ok(grid.lower) && ok(grid.upper);
  }

  var R = model.CELL_RESOLUTION;
  var H = model.CELL_SIZE;
  var NONNEGATIVITY_TOLERANCE = 1e-9;

  function oscillatingGrid() {
    function valueAt(i, j) {
      return model.clamp(
        0.5 + 0.5 * Math.sin(9 * i / R) * Math.cos(7 * j / R), 0, 1
      );
    }
    return model.createCellGrid(valueAt, valueAt);
  }

  test("The bilateral-trade model exposes the expected pure API", function () {
    assert(model && typeof model.summarize === "function",
      "BilateralTradeModel should be available.");
    assert(model.CELL_RESOLUTION === 20,
      "The paintable grid should be 20x20 cells.");
    assertClose(model.CELL_SIZE, 0.05, "Each cell should be exactly 0.05 wide.", 1e-12);
    assert(window.FPAModel === undefined && window.SPAModel === undefined,
      "The bilateral-trade test should not load an auction model.");
  });

  test("efficientGrid represents v=c exactly via the diagonal split", function () {
    var grid = model.efficientGrid();
    var i;
    var j;
    for (i = 0; i < R; i += 1) {
      for (j = 0; j < R; j += 1) {
        if (i > j) {
          assert(grid.lower[i][j] === 1 && grid.upper[i][j] === 1,
            "Cell (" + i + "," + j + ") is entirely v>c and should trade fully.");
        } else if (i < j) {
          assert(grid.lower[i][j] === 0 && grid.upper[i][j] === 0,
            "Cell (" + i + "," + j + ") is entirely v<c and should never trade.");
        } else {
          assert(grid.lower[i][j] === 1 && grid.upper[i][j] === 0,
            "The diagonal cell (" + i + "," + i + ") should trade only on " +
            "its lower-right (v>c) triangle.");
        }
      }
    }
  });

  test("chatterjeeSamuelsonGrid represents v-c=1/4 exactly via the diagonal split", function () {
    var grid = model.chatterjeeSamuelsonGrid();
    var OFFSET = 5; // 0.25 / 0.05
    var i;
    var j;
    for (i = 0; i < R; i += 1) {
      for (j = 0; j < R; j += 1) {
        var diff = i - j;
        if (diff > OFFSET) {
          assert(grid.lower[i][j] === 1 && grid.upper[i][j] === 1,
            "Cell with i-j=" + diff + " is entirely v-c>1/4 and should trade fully.");
        } else if (diff < OFFSET) {
          assert(grid.lower[i][j] === 0 && grid.upper[i][j] === 0,
            "Cell with i-j=" + diff + " is entirely v-c<1/4 and should never trade.");
        } else {
          assert(grid.lower[i][j] === 1 && grid.upper[i][j] === 0,
            "The i-j=5 diagonal cell should trade only on its lower-right triangle.");
        }
      }
    }
  });

  test("postedPriceGrid classifies whole cells against the price with no boundary tie", function () {
    [0, 1, 5, 10, 19, 20].forEach(function (k) {
      var price = k * H;
      var grid = model.postedPriceGrid(price);
      var i;
      var j;
      for (i = 0; i < R; i += 1) {
        for (j = 0; j < R; j += 1) {
          var expected = (i >= k && j < k) ? 1 : 0;
          assert(grid.lower[i][j] === expected && grid.upper[i][j] === expected,
            "price=" + price + " cell (" + i + "," + j + ") should be " + expected);
        }
      }
    });
  });

  test("postedPriceGrid rounds an off-grid price to its nearest cell boundary", function () {
    // 0.37 is closer to 0.35 (k=7) than to 0.40 (k=8).
    var grid = model.postedPriceGrid(0.37);
    var expectedGrid = model.postedPriceGrid(0.35);
    var i;
    var j;
    for (i = 0; i < R; i += 1) {
      for (j = 0; j < R; j += 1) {
        assert(grid.lower[i][j] === expectedGrid.lower[i][j] &&
          grid.upper[i][j] === expectedGrid.upper[i][j],
        "price=0.37 should round to the same grid as price=0.35.");
      }
    }
  });

  test("checkBuyerMonotonicity and checkSellerMonotonicity find no violations on efficientGrid", function () {
    var grid = model.efficientGrid();
    assert(model.countTrue(model.checkBuyerMonotonicity(grid)) === 0,
      "efficientGrid should be pointwise buyer-monotonic.");
    assert(model.countTrue(model.checkSellerMonotonicity(grid)) === 0,
      "efficientGrid should be pointwise seller-monotonic.");
  });

  test("interimBuyerProbability and interimSellerProbability are exact cell averages", function () {
    // A constant grid q=0.7: every row and column should average to exactly
    // 0.7, since the average of a constant is that constant.
    var grid = model.constantCellGrid(0.7);
    var Q_B = model.interimBuyerProbability(grid);
    var Q_S = model.interimSellerProbability(grid);
    var i;
    for (i = 0; i < R; i += 1) {
      assertClose(Q_B[i], 0.7, "Q_B should equal the constant q", 1e-12);
      assertClose(Q_S[i], 0.7, "Q_S should equal the constant q", 1e-12);
    }
  });

  test("checkInterimBuyerMonotonicity and checkInterimSellerMonotonicity flag deliberate dips/bumps", function () {
    var Q_B = [];
    var i;
    for (i = 0; i < R; i += 1) {
      Q_B[i] = i / (R - 1);
    }
    Q_B[10] = 0;
    var buyerViolations = model.checkInterimBuyerMonotonicity(Q_B);
    assert(model.countTrue1D(buyerViolations) === 2,
      "Exactly one adjacent pair should be flagged.");
    assert(buyerViolations[9] && buyerViolations[10],
      "The dip should flag both endpoints of the violating transition.");

    var Q_S = [];
    for (i = 0; i < R; i += 1) {
      Q_S[i] = (R - 1 - i) / (R - 1);
    }
    Q_S[10] = 1;
    var sellerViolations = model.checkInterimSellerMonotonicity(Q_S);
    assert(model.countTrue1D(sellerViolations) === 2,
      "Exactly one adjacent pair should be flagged.");
    assert(sellerViolations[9] && sellerViolations[10],
      "The bump should flag both endpoints of the violating transition.");
  });

  test("The never-trade rule q=0 is exactly, trivially budget balanced", function () {
    var summary = model.summarize(model.constantCellGrid(0));
    var v = summary.verdicts;
    assert(v.icImplementable, "A constant rule is trivially IC.");
    assertClose(v.minBuyerUtility, 0, "Minimum buyer utility");
    assertClose(v.minSellerUtility, 0, "Minimum seller utility");
    assert(v.exPostBudgetBalanced, "q=0 should be exactly ex-post balanced.");
    assertClose(v.expectedRevenue, 0, "Expected revenue");
    assertClose(v.welfare, 0, "Gains from trade");
    assertClose(v.expectedBuyerUtility, 0, "Expected buyer rent under never-trade");
    assertClose(v.expectedSellerUtility, 0, "Expected seller rent under never-trade");
  });

  test("The always-trade rule q=1 has an exact, constant deficit of 1", function () {
    var grid = model.constantCellGrid(1);
    // Pointwise: U_B(v,c)=v and U_S(v,c)=1-c exactly, so p_B=0, p_S=1, R=-1
    // everywhere -- check this directly via the closed-form point evaluator
    // at a handful of triangle centroids, not just the aggregate verdicts.
    [[0.1, 0.9], [0.4166666666666667, 0.5833333333333334], [0.99, 0.01]]
      .forEach(function (point) {
        var v = point[0];
        var c = point[1];
        assertClose(model.cumulativeBuyerUtilityAt(grid, v, c), v,
          "U_B(v,c) should equal v exactly under q=1", 1e-9);
      });

    var summary = model.summarize(grid);
    assert(summary.verdicts.icImplementable, "A constant rule is trivially IC.");
    assertClose(summary.verdicts.welfare, 0,
      "E[V]=E[C]=0.5 under Uniform[0,1], so W(q)=0 exactly", 1e-9);
    assertClose(summary.verdicts.expectedBuyerUtility, 0.5,
      "Expected buyer rent under certain trade", 1e-9);
    assertClose(summary.verdicts.expectedSellerUtility, 0.5,
      "Expected seller rent under certain trade", 1e-9);
    assertClose(summary.verdicts.expectedRevenue, -1,
      "Expected revenue under certain trade", 1e-9);
    assert(!summary.verdicts.exPostNoDeficit,
      "A constant deficit of 1 should fail ex-post no-deficit.");
  });

  test("The efficient benchmark's welfare and revenue match the continuous closed forms exactly", function () {
    // Triangle-centroid integration of an affine integrand is exact, and
    // v=c runs exactly along the grid's diagonal split (see the dedicated
    // structural test above), so this is not an approximation: it agrees
    // with the textbook Uniform[0,1] values to floating-point precision,
    // not merely within a quadrature tolerance.
    var grid = model.efficientGrid();
    assertClose(model.welfare(grid), 1 / 6, "W(q*) for Uniform[0,1]", 1e-9);
    assertClose(model.expectedBuyerUtility(grid), 1 / 6,
      "E[U_B] at the efficient benchmark", 1e-9);
    assertClose(model.expectedSellerUtility(grid), 1 / 6,
      "E[U_S] at the efficient benchmark", 1e-9);

    var summary = model.summarize(grid);
    assertClose(summary.verdicts.expectedRevenue, -1 / 6,
      "E[R] for the efficient benchmark", 1e-9);
  });

  test("The efficient benchmark's cumulative utilities match max(0,v-c) exactly off the diagonal", function () {
    var grid = model.efficientGrid();
    [[0.62, 0.3], [0.47, 0.13], [0.9, 0.05], [0.2, 0.75]].forEach(function (point) {
      var v = point[0];
      var c = point[1];
      var expected = Math.max(0, v - c);
      assertClose(model.cumulativeBuyerUtilityAt(grid, v, c), expected,
        "U_B(" + v + "," + c + ") should equal max(0,v-c)", 1e-9);
      assertClose(model.cumulativeSellerUtilityAt(grid, v, c), expected,
        "U_S(" + v + "," + c + ") should equal max(0,v-c)", 1e-9);
    });
  });

  test("The efficient-benchmark preset reports exactly zero efficiency loss", function () {
    var summary = model.summarize(model.efficientGrid());
    assertClose(summary.verdicts.efficiencyLoss, 0,
      "Painting exactly the efficient benchmark should show zero efficiency loss.",
      1e-9);
    assertClose(summary.verdicts.welfare, summary.verdicts.firstBestWelfare,
      "W(q) should exactly equal W(q*) for the efficient preset.", 1e-9);
  });

  test("The posted-price mechanism is exactly ex-post budget balanced at every price", function () {
    // Unlike the old point-sampled grid, this holds at every price,
    // including the grid-aligned ones and the p=0/p=1 boundaries -- no
    // nudge or special-casing is needed, because whole cells (never sampled
    // points) are classified against the price and a cell boundary is
    // never inside a cell's own interior. Verified pointwise via the exact
    // closed-form cumulative-utility evaluator, not just in expectation.
    [0, 0.05, 0.25, 0.5, 0.75, 0.95, 1].forEach(function (price) {
      var grid = model.postedPriceGrid(price);
      var summary = model.summarize(grid);
      assert(summary.verdicts.icImplementable,
        "Posted price should be IC-implementable at price=" + price);
      assert(summary.verdicts.exPostBudgetBalanced,
        "Posted price should be exactly ex-post budget balanced at price=" + price);
      assertClose(summary.verdicts.expectedRevenue, 0,
        "Expected revenue should be exactly zero at price=" + price, 1e-9);

      var i;
      var j;
      for (i = 0; i < R; i += 1) {
        for (j = 0; j < R; j += 1) {
          [true, false].forEach(function (isLower) {
            var centroid = model.triangleCentroid(i, j, isLower);
            var q = isLower ? grid.lower[i][j] : grid.upper[i][j];
            var uB = model.cumulativeBuyerUtilityAt(grid, centroid.v, centroid.c);
            var uS = model.cumulativeSellerUtilityAt(grid, centroid.v, centroid.c);
            var pB = centroid.v * q - uB;
            var pS = centroid.c * q + uS;
            assertClose(pB - pS, 0,
              "R should be exactly zero at price=" + price, 1e-9);
          });
        }
      }
    });
  });

  test("The Chatterjee-Samuelson double auction matches its closed-form welfare and exact budget balance", function () {
    // Trade iff v - c >= 1/4, the threshold induced by the linear
    // Bayes-Nash equilibrium b(v)=2/3 v+1/12, a(c)=2/3 c+1/4 of the k=1/2
    // double auction (Chatterjee and Samuelson 1983) under Uniform[0,1].
    // 1/4 = 5*CELL_SIZE runs exactly along the grid's own diagonal split,
    // so -- like the efficient benchmark -- this is exact, not merely
    // convergent: both W(q)=9/64 and E[R]=0 hold to floating-point
    // precision, not just within a loose quadrature tolerance.
    var grid = model.chatterjeeSamuelsonGrid();
    assertClose(model.welfare(grid), 9 / 64,
      "W(q) = E[(V-C) 1{V-C>=1/4}] = 9/64 under Uniform[0,1]", 1e-9);

    var summary = model.summarize(grid);
    // By revenue equivalence, this module's minimal-rent transfers for this
    // allocation must have the same expected value as the actual double
    // auction's own (a+b)/2 pricing, which is budget balanced by
    // construction (no intermediary): E[R] = 0 exactly, even though the
    // pointwise transfers differ from the real double-auction price.
    assertClose(summary.verdicts.expectedRevenue, 0,
      "E[R] should be exactly zero by revenue equivalence", 1e-9);
    assert(summary.verdicts.icImplementable,
      "The Chatterjee-Samuelson allocation should be IC-implementable.");
    assert(summary.verdicts.efficiencyLoss > 0 &&
      summary.verdicts.efficiencyLoss < 1 / 6,
    "The double auction should be inefficient but far better than never trading.");
  });

  test("Bayesian IC is weaker than pointwise DSIC: a rule can fail ex-post monotonicity yet be interim-monotonic", function () {
    var grid = model.createCellGrid(
      function (i, j) { return j < 10 ? i / (R - 1) : (R - 1 - i) / (R - 1); },
      function (i, j) { return j < 10 ? i / (R - 1) : (R - 1 - i) / (R - 1); }
    );

    // Pointwise (ex-post/dominant-strategy) monotonicity fails on both sides.
    var buyerViolations = model.checkBuyerMonotonicity(grid);
    var sellerViolations = model.checkSellerMonotonicity(grid);
    assert(model.countTrue(buyerViolations) > 0,
      "Pointwise buyer monotonicity should fail in the decreasing half.");
    assert(model.countTrue(sellerViolations) > 0,
      "Pointwise seller monotonicity should fail across the j=9/10 jump.");
    assert(!model.isDsicImplementable(buyerViolations, sellerViolations),
      "A pointwise violation on either side should break DSIC-implementability.");

    // But by construction every row and every column is an equal mix of
    // the increasing half (i/(R-1)) and the decreasing half
    // ((R-1-i)/(R-1)), so both interim probabilities are exactly the
    // constant 0.5 -- trivially monotonic (both nondecreasing and
    // nonincreasing) despite the pointwise failures above.
    var Q_B = model.interimBuyerProbability(grid);
    var Q_S = model.interimSellerProbability(grid);
    Q_B.forEach(function (value) {
      assertClose(value, 0.5, "Q_B should be exactly 0.5 for every v", 1e-9);
    });
    Q_S.forEach(function (value) {
      assertClose(value, 0.5, "Q_S should be exactly 0.5 for every c", 1e-9);
    });
    assert(model.countTrue1D(model.checkInterimBuyerMonotonicity(Q_B)) === 0,
      "Interim buyer probability should be monotonic despite the pointwise failures.");
    assert(model.countTrue1D(model.checkInterimSellerMonotonicity(Q_S)) === 0,
      "Interim seller probability should be monotonic despite the pointwise failures.");

    var summary = model.summarize(grid);
    assert(summary.verdicts.icImplementable,
      "The live pipeline should report this rule as IC-implementable.");
  });

  test("Cumulative utilities are always nonnegative and vanish exactly at the boundary type", function () {
    var grids = [
      model.efficientGrid(),
      model.constantCellGrid(1),
      model.constantCellGrid(0),
      model.chatterjeeSamuelsonGrid(),
      oscillatingGrid()
    ];

    grids.forEach(function (grid) {
      var i;
      var j;
      for (i = 0; i < R; i += 1) {
        for (j = 0; j < R; j += 1) {
          [true, false].forEach(function (isLower) {
            var centroid = model.triangleCentroid(i, j, isLower);
            assert(model.cumulativeBuyerUtilityAt(grid, centroid.v, centroid.c) >= -NONNEGATIVITY_TOLERANCE,
              "Buyer utility should never be negative.");
            assert(model.cumulativeSellerUtilityAt(grid, centroid.v, centroid.c) >= -NONNEGATIVITY_TOLERANCE,
              "Seller utility should never be negative.");
          });
        }
      }
      // The true boundary condition, checked directly (not sampled from a
      // centroid-based heatmap, which never touches v=0 or c=1 exactly).
      assertClose(model.cumulativeBuyerUtilityAt(grid, 0, 0.37), 0,
        "U_B(0,c) should vanish exactly", 1e-12);
      assertClose(model.cumulativeSellerUtilityAt(grid, 0.62, 1), 0,
        "U_S(v,1) should vanish exactly", 1e-12);
    });

    // Expected rent is the quantity that actually distinguishes these
    // allocation rules from one another.
    var neverTradeRent = model.expectedBuyerUtility(model.constantCellGrid(0));
    var alwaysTradeRent = model.expectedBuyerUtility(model.constantCellGrid(1));
    assert(alwaysTradeRent - neverTradeRent > 0.1,
      "Expected buyer rent should differ meaningfully across allocation rules.");
  });

  test("A non-monotonic rule is flagged as not IC-implementable but stays finite", function () {
    var grid = oscillatingGrid();
    var summary = model.summarize(grid);
    assert(!summary.verdicts.icImplementable,
      "This oscillating rule's interim probability should also be nonmonotonic.");
    assert(summary.verdicts.buyerIcViolationCount > 0 ||
      summary.verdicts.sellerIcViolationCount > 0,
    "At least one interim monotonicity condition should be violated.");
    assert(Number.isFinite(summary.verdicts.expectedRevenue) &&
      Number.isFinite(summary.verdicts.welfare) &&
      Number.isFinite(summary.verdicts.efficiencyLoss),
    "Summary scalars should remain finite even when IC fails.");
    assert(isFiniteCellGrid(summary.buyerUtility) &&
      isFiniteCellGrid(summary.sellerUtility) &&
      isFiniteCellGrid(summary.revenue),
    "Diagnostic grids should remain finite.");
  });

  test("Revenue uses the matching lower or upper triangle's q and utilities", function () {
    var grid = model.createCellGrid(
      function (i, j) { return (2 * i + j) / (3 * (R - 1)); },
      function (i, j) { return (i + 2 * j) / (3 * (R - 1)); }
    );
    var summary = model.summarize(grid);
    var i;
    var j;
    for (i = 0; i < R; i += 1) {
      for (j = 0; j < R; j += 1) {
        [true, false].forEach(function (isLower) {
          var centroid = model.triangleCentroid(i, j, isLower);
          var q = isLower ? grid.lower[i][j] : grid.upper[i][j];
          var uB = model.cumulativeBuyerUtilityAt(grid, centroid.v, centroid.c);
          var uS = model.cumulativeSellerUtilityAt(grid, centroid.v, centroid.c);
          var expected = (centroid.v * q - uB) - (centroid.c * q + uS);
          var actual = isLower ?
            summary.revenue.lower[i][j] : summary.revenue.upper[i][j];
          assertClose(actual, expected,
            "Revenue should use the matching triangle at cell (" + i + "," + j + ").",
            1e-12);
        });
      }
    }
  });

  test("summarize stays finite for every preset and constant grid", function () {
    [
      model.efficientGrid(),
      model.constantCellGrid(0),
      model.constantCellGrid(1),
      model.postedPriceGrid(0.35),
      model.chatterjeeSamuelsonGrid()
    ].forEach(function (grid) {
      var summary = model.summarize(grid);
      assert(isFiniteCellGrid(summary.grid), "Grid finite");
      ["buyerUtility", "sellerUtility", "revenue", "overTrade", "underTrade"]
        .forEach(function (key) {
          assert(isFiniteCellGrid(summary[key]), "Diagnostic grid finite: " + key);
        });
      Object.keys(summary.verdicts).forEach(function (key) {
        var value = summary.verdicts[key];
        if (typeof value === "number") {
          assert(Number.isFinite(value), "Verdict finite: " + key);
        }
      });
    });
  });

  run();

  function run() {
    var results = document.getElementById("results");
    var passed = 0;

    tests.forEach(function (item) {
      var row = document.createElement("li");
      try {
        item.callback();
        row.className = "pass";
        row.textContent = "PASS — " + item.name;
        passed += 1;
      } catch (error) {
        row.className = "fail";
        row.textContent = "FAIL — " + item.name + ": " + error.message;
      }
      results.appendChild(row);
    });

    var allPassed = passed === tests.length;
    var summary = document.getElementById("summary");
    summary.className = allPassed ? "pass" : "fail";
    summary.textContent = passed + " of " + tests.length +
      " bilateral-trade model tests passed.";
    document.body.dataset.status = allPassed ? "passed" : "failed";
    document.title = (allPassed ? "PASS" : "FAIL") +
      " — Bilateral-trade model tests";
  }
}());
