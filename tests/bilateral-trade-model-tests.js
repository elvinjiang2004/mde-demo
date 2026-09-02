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

  function isFinitePatchGrid(grid) {
    function ok(rows) {
      return rows.every(function (row) {
        return row.every(function (patch) {
          return patch.every(function (value) { return Number.isFinite(value); });
        });
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
    assert(window.BilateralTradeEnvelope &&
      typeof window.BilateralTradeEnvelope.zeroBoundaryPayments === "function",
    "The shared bilateral-trade envelope pipeline should load before the model.");
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
    var OFFSET = 5;
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

  test("Pointwise monotonicity includes the crossing between a cell's two triangles", function () {
    var grid = model.constantCellGrid(0);
    grid.upper[0][0] = 1;
    assert(model.countTrue(model.checkBuyerMonotonicity(grid)) > 0,
      "The within-cell upper-to-lower drop should violate buyer monotonicity.");
    assert(model.countTrue(model.checkSellerMonotonicity(grid)) > 0,
      "The same within-cell crossing should violate seller monotonicity.");
  });

  test("interimBuyerProbability and interimSellerProbability are exact cell averages", function () {
    var grid = model.constantCellGrid(0.7);
    var Q_B = model.interimBuyerProbability(grid);
    var Q_S = model.interimSellerProbability(grid);
    var i;
    for (i = 0; i < R; i += 1) {
      assertClose(Q_B[i], 0.7, "Q_B should equal the constant q", 1e-12);
      assertClose(Q_S[i], 0.7, "Q_S should equal the constant q", 1e-12);
    }
  });

  test("The shared exact interim pipeline detects within-cell IC violations hidden by cell averages", function () {
    var grid = model.createCellGrid(
      function () { return 0; },
      function () { return 1; }
    );
    var summary = model.summarize(grid);
    model.interimBuyerProbability(grid).forEach(function (value) {
      assertClose(value, 0.5, "Every buyer cell average should be 0.5", 1e-12);
    });
    model.interimSellerProbability(grid).forEach(function (value) {
      assertClose(value, 0.5, "Every seller cell average should be 0.5", 1e-12);
    });
    assert(window.BilateralTradeEnvelope.evaluatePolynomial(
      summary.interim.buyerAllocation[0], 0.01
    ) > window.BilateralTradeEnvelope.evaluatePolynomial(
      summary.interim.buyerAllocation[0], 0.04
    ),
    "The exact buyer interim allocation should fall within the first cell.");
    assert(window.BilateralTradeEnvelope.evaluatePolynomial(
      summary.interim.sellerAllocation[0], 0.01
    ) < window.BilateralTradeEnvelope.evaluatePolynomial(
      summary.interim.sellerAllocation[0], 0.04
    ),
    "The exact seller interim allocation should rise within the first cell.");
    assert(!summary.verdicts.icImplementable &&
      summary.verdicts.buyerIcViolationCount === R &&
      summary.verdicts.sellerIcViolationCount === R,
    "Exact within-cell monotonicity should fail for both agents in every interval.");
    assert(summary.deviation.buyer.bestResponses.some(function (response) {
      return response.gain > model.MONOTONICITY_TOLERANCE;
    }) && summary.deviation.seller.bestResponses.some(function (response) {
      return response.gain > model.MONOTONICITY_TOLERANCE;
    }),
    "The exact payoff diagnostics should expose profitable deviations for both agents.");
  });

  test("allocationErrorAt evaluates the represented rule at the requested point", function () {
    var over = model.allocationErrorAt(model.constantCellGrid(1), 0.2, 0.8);
    var under = model.allocationErrorAt(model.constantCellGrid(0), 0.8, 0.2);
    var efficient = model.allocationErrorAt(model.efficientGrid(), 0.8, 0.2);
    assertClose(over.q, 1, "Always-trade q below the efficient diagonal");
    assertClose(over.over, 1, "Always trade should over-trade below the diagonal");
    assertClose(under.under, 1, "Never trade should miss trade above the diagonal");
    assertClose(efficient.over + efficient.under, 0,
      "The efficient rule should have no pointwise allocation error");
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
    assertClose(v.minBuyerPayoff, 0, "Minimum buyer payoff");
    assertClose(v.minSellerPayoff, 0, "Minimum seller payoff");
    assert(v.exPostBudgetBalanced, "q=0 should be exactly ex-post balanced.");
    assertClose(v.expectedRevenue, 0, "Expected revenue");
    assertClose(v.welfare, 0, "Gains from trade");
    assertClose(v.expectedBuyerPayoff, 0, "Expected buyer payoff under never-trade");
    assertClose(v.expectedSellerPayoff, 0, "Expected seller payoff under never-trade");
  });

  test("The always-trade rule q=1 has an exact, constant deficit of 1", function () {
    var grid = model.constantCellGrid(1);
    [[0.1, 0.9], [0.4166666666666667, 0.5833333333333334], [0.99, 0.01]]
      .forEach(function (point) {
        var v = point[0];
        var c = point[1];
        assertClose(model.cumulativeBuyerPayoffAt(grid, v, c), v,
          "U_B(v,c) should equal v exactly under q=1", 1e-9);
      });

    var summary = model.summarize(grid);
    assert(summary.verdicts.icImplementable, "A constant rule is trivially IC.");
    assertClose(summary.verdicts.welfare, 0,
      "E[V]=E[C]=0.5 under Uniform[0,1], so W(q)=0 exactly", 1e-9);
    assertClose(summary.verdicts.expectedBuyerPayoff, 0.5,
      "Expected buyer payoff under certain trade", 1e-9);
    assertClose(summary.verdicts.expectedSellerPayoff, 0.5,
      "Expected seller payoff under certain trade", 1e-9);
    assertClose(summary.verdicts.expectedRevenue, -1,
      "Expected revenue under certain trade", 1e-9);
    assert(!summary.verdicts.exPostNoDeficit,
      "A constant deficit of 1 should fail ex-post no-deficit.");
  });

  test("The efficient benchmark's welfare and revenue match the continuous closed forms exactly", function () {
    var grid = model.efficientGrid();
    assertClose(model.welfare(grid), 1 / 6, "W(q*) for Uniform[0,1]", 1e-9);
    assertClose(model.expectedBuyerPayoff(grid), 1 / 6,
      "E[U_B] at the efficient benchmark", 1e-9);
    assertClose(model.expectedSellerPayoff(grid), 1 / 6,
      "E[U_S] at the efficient benchmark", 1e-9);

    var summary = model.summarize(grid);
    assertClose(summary.verdicts.expectedRevenue, -1 / 6,
      "E[R] for the efficient benchmark", 1e-9);
  });

  test("The efficient benchmark's cumulative payoffs match max(0,v-c) exactly off the diagonal", function () {
    var grid = model.efficientGrid();
    [[0.62, 0.3], [0.47, 0.13], [0.9, 0.05], [0.2, 0.75]].forEach(function (point) {
      var v = point[0];
      var c = point[1];
      var expected = Math.max(0, v - c);
      assertClose(model.cumulativeBuyerPayoffAt(grid, v, c), expected,
        "U_B(" + v + "," + c + ") should equal max(0,v-c)", 1e-9);
      assertClose(model.cumulativeSellerPayoffAt(grid, v, c), expected,
        "U_S(" + v + "," + c + ") should equal max(0,v-c)", 1e-9);
    });
  });

  test("The shared zero-boundary pipeline matches the M-S cumulative payoff formulas", function () {
    var grid = oscillatingGrid();
    var payments = model.zeroBoundaryPayments(grid);
    var shared = window.BilateralTradeEnvelope;
    [[0.613, 0.317], [0.142, 0.731], [0.827, 0.204]].forEach(function (point) {
      var v = point[0];
      var c = point[1];
      var q = shared.scalarGridValueAt(grid, v, c);
      var buyerPayoff = model.cumulativeBuyerPayoffAt(grid, v, c);
      var sellerPayoff = model.cumulativeSellerPayoffAt(grid, v, c);
      assertClose(shared.patchGridValueAt(payments.pB, v, c), v * q - buyerPayoff,
        "Shared buyer payment should equal vq minus the exact envelope payoff.", 1e-10);
      assertClose(shared.patchGridValueAt(payments.pS, v, c), c * q + sellerPayoff,
        "Shared seller payment should equal cq plus the exact envelope payoff.", 1e-10);
    });
  });

  test("M-S summaries retain exact within-triangle payoff and revenue surfaces", function () {
    var summary = model.summarize(model.constantCellGrid(1));
    var shared = window.BilateralTradeEnvelope;
    assertClose(model.patchGridValueAt(summary.patches.buyerPayoff, 0.613, 0.317),
      0.613, "The exact buyer-payoff surface should vary with v inside a triangle.", 1e-12);
    assertClose(model.patchGridValueAt(summary.patches.sellerPayoff, 0.613, 0.317),
      0.683, "The exact seller-payoff surface should vary with c inside a triangle.", 1e-12);
    assertClose(model.patchGridValueAt(summary.patches.revenue, 0.613, 0.317),
      -1, "The exact always-trade revenue surface should be constant at minus one.", 1e-12);
    assertClose(model.patchGridValueAt(summary.patches.buyerPayoff, 0.643, 0.317),
      0.643, "The exact buyer-payoff surface should retain within-triangle variation.", 1e-12);
    var range = shared.affinePatchGridRange(summary.patches.revenue);
    assertClose(summary.verdicts.minRevenue, range.min,
      "The revenue minimum should use the exact affine-patch range.", 1e-12);
    assertClose(summary.verdicts.maxRevenue, range.max,
      "The revenue maximum should use the exact affine-patch range.", 1e-12);
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
            var uB = model.cumulativeBuyerPayoffAt(grid, centroid.v, centroid.c);
            var uS = model.cumulativeSellerPayoffAt(grid, centroid.v, centroid.c);
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
    var grid = model.chatterjeeSamuelsonGrid();
    assertClose(model.welfare(grid), 9 / 64,
      "W(q) = E[(V-C) 1{V-C>=1/4}] = 9/64 under Uniform[0,1]", 1e-9);

    var summary = model.summarize(grid);
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

    var buyerViolations = model.checkBuyerMonotonicity(grid);
    var sellerViolations = model.checkSellerMonotonicity(grid);
    assert(model.countTrue(buyerViolations) > 0,
      "Pointwise buyer monotonicity should fail in the decreasing half.");
    assert(model.countTrue(sellerViolations) > 0,
      "Pointwise seller monotonicity should fail across the j=9/10 jump.");
    assert(!model.isDsicImplementable(buyerViolations, sellerViolations),
      "A pointwise violation on either side should break DSIC-implementability.");

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

  test("Cumulative payoffs are always nonnegative and vanish exactly at the boundary type", function () {
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
            assert(model.cumulativeBuyerPayoffAt(grid, centroid.v, centroid.c) >= -NONNEGATIVITY_TOLERANCE,
              "Buyer payoff should never be negative.");
            assert(model.cumulativeSellerPayoffAt(grid, centroid.v, centroid.c) >= -NONNEGATIVITY_TOLERANCE,
              "Seller payoff should never be negative.");
          });
        }
      }
      assertClose(model.cumulativeBuyerPayoffAt(grid, 0, 0.37), 0,
        "U_B(0,c) should vanish exactly", 1e-12);
      assertClose(model.cumulativeSellerPayoffAt(grid, 0.62, 1), 0,
        "U_S(v,1) should vanish exactly", 1e-12);
    });

    var neverTradePayoff = model.expectedBuyerPayoff(model.constantCellGrid(0));
    var alwaysTradePayoff = model.expectedBuyerPayoff(model.constantCellGrid(1));
    assert(alwaysTradePayoff - neverTradePayoff > 0.1,
      "Expected buyer payoff should differ meaningfully across allocation rules.");
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
    assert(isFinitePatchGrid(summary.patches.buyerPayoff) &&
      isFinitePatchGrid(summary.patches.sellerPayoff) &&
      isFinitePatchGrid(summary.patches.revenue),
    "Exact diagnostic patches should remain finite.");
  });

  test("Revenue uses the matching lower or upper triangle's q and payoffs", function () {
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
          var uB = model.cumulativeBuyerPayoffAt(grid, centroid.v, centroid.c);
          var uS = model.cumulativeSellerPayoffAt(grid, centroid.v, centroid.c);
          var expected = (centroid.v * q - uB) - (centroid.c * q + uS);
          var actual = model.patchGridValueAt(
            summary.patches.revenue, centroid.v, centroid.c
          );
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
      ["buyerPayoff", "sellerPayoff", "revenue"]
        .forEach(function (key) {
          assert(isFinitePatchGrid(summary.patches[key]),
            "Exact diagnostic patches finite: " + key);
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
