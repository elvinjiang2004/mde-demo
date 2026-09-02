(function () {
  "use strict";

  var model = window.BargainingSandboxModel;
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

  function assertPatchClose(actual, expected, message) {
    var k;
    for (k = 0; k < 6; k += 1) {
      assertClose(actual[k], expected[k], message + " coefficient " + k, 1e-10);
    }
  }

  function valueAt(patchGrid, v, c) {
    var i = Math.min(model.CELL_RESOLUTION - 1,
      Math.floor(v / model.CELL_SIZE));
    var j = Math.min(model.CELL_RESOLUTION - 1,
      Math.floor(c / model.CELL_SIZE));
    var localV = v - i * model.CELL_SIZE;
    var localC = c - j * model.CELL_SIZE;
    var patch = localV >= localC ? patchGrid.lower[i][j] : patchGrid.upper[i][j];
    return model.evaluatePatch(patch, v, c);
  }

  function integratePatchOverCost(patch, v, lower, upper) {
    var constant = patch[0] + patch[1] * v + patch[3] * v * v;
    var linear = patch[2] + patch[4] * v;
    return constant * (upper - lower) +
      linear * (upper * upper - lower * lower) / 2 +
      patch[5] * (upper * upper * upper - lower * lower * lower) / 3;
  }

  function integratePatchOverValue(patch, c, lower, upper) {
    var constant = patch[0] + patch[2] * c + patch[5] * c * c;
    var linear = patch[1] + patch[4] * c;
    return constant * (upper - lower) +
      linear * (upper * upper - lower * lower) / 2 +
      patch[3] * (upper * upper * upper - lower * lower * lower) / 3;
  }

  function buyerInterimFromRow(grid, row, v) {
    var total = 0;
    var j;
    for (j = 0; j < model.CELL_RESOLUTION; j += 1) {
      var lower = j * model.CELL_SIZE;
      var upper = (j + 1) * model.CELL_SIZE;
      var diagonal = Math.min(upper, Math.max(
        lower, v + (j - row) * model.CELL_SIZE
      ));
      total += integratePatchOverCost(grid.lower[row][j], v, lower, diagonal);
      total += integratePatchOverCost(grid.upper[row][j], v, diagonal, upper);
    }
    return total;
  }

  function sellerInterimFromColumn(grid, column, c) {
    var total = 0;
    var i;
    for (i = 0; i < model.CELL_RESOLUTION; i += 1) {
      var lower = i * model.CELL_SIZE;
      var upper = (i + 1) * model.CELL_SIZE;
      var diagonal = Math.min(upper, Math.max(
        lower, c + (i - column) * model.CELL_SIZE
      ));
      total += integratePatchOverValue(grid.upper[i][column], c, lower, diagonal);
      total += integratePatchOverValue(grid.lower[i][column], c, diagonal, upper);
    }
    return total;
  }

  function allFiniteScalarGrid(grid) {
    return [grid.lower, grid.upper].every(function (rows) {
      return rows.every(function (row) {
        return row.every(Number.isFinite);
      });
    });
  }

  function allFinitePatchGrid(grid) {
    return [grid.lower, grid.upper].every(function (rows) {
      return rows.every(function (row) {
        return row.every(function (patch) {
          return patch.length === 6 && patch.every(Number.isFinite);
        });
      });
    });
  }

  test("The model exposes the exact triangular-patch API", function () {
    assert(model && typeof model.summarize === "function",
      "BargainingSandboxModel should load.");
    assert(window.BilateralTradeEnvelope &&
      typeof window.BilateralTradeEnvelope.zeroBoundaryPayments === "function",
    "The shared bilateral-trade envelope pipeline should load before the sandbox model.");
    assert(model.CELL_RESOLUTION === 100, "The grid should have 100 cells per side.");
    assertClose(model.CELL_SIZE, 0.01, "Cell width", 1e-12);
    assert(typeof model.presetRevenueThreshold === "function",
      "The broker-revenue threshold preset should be public.");
    assert(model.PATCH_LENGTH === 6, "Quadratic patches should have six coefficients.");
    assertPatchClose(model.constantPatch(-0.3), [-0.3, 0, 0, 0, 0, 0],
      "A constant patch");
    assertClose(model.evaluatePatch([1, 2, 3, 4, 5, 6], 0.2, 0.4),
      1 + 2 * 0.2 + 3 * 0.4 + 4 * 0.04 + 5 * 0.08 + 6 * 0.16,
      "Patch evaluation", 1e-12);
  });

  test("Quadratic patch integration is exact over the full square", function () {
    var vSquared = model.createPatchGrid(
      function () { return [0, 0, 0, 1, 0, 0]; },
      function () { return [0, 0, 0, 1, 0, 0]; }
    );
    var crossTerm = model.createPatchGrid(
      function () { return [0, 0, 0, 0, 1, 0]; },
      function () { return [0, 0, 0, 0, 1, 0]; }
    );
    assertClose(model.integratePatchGrid(vSquared), 1 / 3,
      "Integral of v squared", 1e-10);
    assertClose(model.integratePatchGrid(crossTerm), 1 / 4,
      "Integral of vc", 1e-10);
  });

  test("Efficient interim allocation polynomials are Q_B(v)=v and Q_S(c)=1-c", function () {
    var q = model.efficientGrid();
    var buyer = model.interimBuyerAllocationPolynomials(q);
    var seller = model.interimSellerAllocationPolynomials(q);
    [0.013, 0.24, 0.501, 0.87, 0.999].forEach(function (type) {
      var index = Math.min(
        model.CELL_RESOLUTION - 1, Math.floor(type / model.CELL_SIZE)
      );
      assertClose(model.evaluatePolynomial(buyer[index], type), type,
        "Efficient buyer interim probability", 1e-10);
      assertClose(model.evaluatePolynomial(seller[index], type), 1 - type,
        "Efficient seller interim probability", 1e-10);
    });
  });

  test("Interim payment polynomials integrate every quadratic basis term on both boundary sides", function () {
    var grid = model.createPatchGrid(
      function (i, j) {
        return [
          0.07 + i / 100 + j / 200,
          -0.31 + i / 90,
          0.23 - j / 80,
          0.41 - (i + j) / 150,
          -0.52 + (i - j) / 100,
          0.37 + j / 110
        ];
      },
      function (i, j) {
        return [
          -0.11 + i / 120 - j / 170,
          0.29 - j / 95,
          -0.33 + i / 105,
          -0.47 + i / 160,
          0.61 - (i + j) / 130,
          -0.25 + j / 140
        ];
      }
    );
    var buyer = model.interimBuyerPaymentPolynomials(grid);
    var seller = model.interimSellerPaymentPolynomials(grid);
    var buyerBoundary = 0.45;
    var sellerBoundary = 0.6;
    var cases = [
      {
        actual: model.evaluatePolynomial(buyer[43], 0.437),
        expected: buyerInterimFromRow(grid, 43, 0.437),
        name: "buyer interior"
      },
      {
        actual: model.evaluatePolynomial(buyer[44], buyerBoundary),
        expected: buyerInterimFromRow(grid, 44, buyerBoundary),
        name: "buyer left boundary value"
      },
      {
        actual: model.evaluatePolynomial(buyer[45], buyerBoundary),
        expected: buyerInterimFromRow(grid, 45, buyerBoundary),
        name: "buyer right boundary value"
      },
      {
        actual: model.evaluatePolynomial(seller[61], 0.613),
        expected: sellerInterimFromColumn(grid, 61, 0.613),
        name: "seller interior"
      },
      {
        actual: model.evaluatePolynomial(seller[59], sellerBoundary),
        expected: sellerInterimFromColumn(grid, 59, sellerBoundary),
        name: "seller left boundary value"
      },
      {
        actual: model.evaluatePolynomial(seller[60], sellerBoundary),
        expected: sellerInterimFromColumn(grid, 60, sellerBoundary),
        name: "seller right boundary value"
      }
    ];
    cases.forEach(function (item) {
      assertClose(item.actual, item.expected, item.name, 1e-10);
    });
    assert(Math.abs(
      model.evaluatePolynomial(buyer[44], buyerBoundary) -
      model.evaluatePolynomial(buyer[45], buyerBoundary)
    ) > 1e-6, "The buyer boundary fixture should have distinct one-sided values.");
    assert(Math.abs(
      model.evaluatePolynomial(seller[59], sellerBoundary) -
      model.evaluatePolynomial(seller[60], sellerBoundary)
    ) > 1e-6, "The seller boundary fixture should have distinct one-sided values.");
  });

  test("VCG is represented exactly and has its continuous benchmark diagnostics", function () {
    var rule = model.presetVcg();
    var summary = model.summarize(rule);
    var v = summary.verdicts;
    assertPatchClose(rule.pB.lower[10][10], [0, 0, 1, 0, 0, 0],
      "VCG buyer payment on a trade triangle");
    assertPatchClose(rule.pS.lower[10][10], [0, 1, 0, 0, 0, 0],
      "VCG seller receipt on a trade triangle");
    assertPatchClose(rule.pB.upper[10][10], [0, 0, 0, 0, 0, 0],
      "VCG no-trade payment");
    assert(v.bic && v.dsic, "VCG should be BIC and DSIC.");
    assert(v.exAnteIr && v.interimIr && v.exPostIr,
      "VCG should pass all three IR notions.");
    assert(!v.exPostBudgetBalanced && !v.expectedBudgetBalanced,
      "VCG should not be budget balanced.");
    assertClose(v.expectedBuyerPayoff, 1 / 6, "VCG buyer payoff", 1e-9);
    assertClose(v.expectedSellerPayoff, 1 / 6, "VCG seller payoff", 1e-9);
    assertClose(v.expectedRevenue, -1 / 6, "VCG revenue", 1e-9);
    assertClose(v.welfare, 1 / 6, "VCG welfare", 1e-9);
    assertClose(v.efficiencyLoss, 0, "VCG efficiency loss", 1e-9);
    assertClose(v.maxAbsImbalance, 1, "VCG maximum pointwise deficit", 1e-9);
    var tradeValues = model.ruleValuesAt(rule, 0.8, 0.3);
    var noTradeValues = model.ruleValuesAt(rule, 0.2, 0.7);
    assertClose(tradeValues.q, 1, "VCG probed trade allocation", 1e-12);
    assertClose(tradeValues.pB, 0.3, "VCG probed buyer payment", 1e-12);
    assertClose(tradeValues.pS, 0.8, "VCG probed seller payment", 1e-12);
    assertClose(noTradeValues.q, 0, "VCG probed no-trade allocation", 1e-12);
    assertClose(noTradeValues.pB, 0, "VCG probed no-trade buyer payment", 1e-12);
    assertClose(noTradeValues.pS, 0, "VCG probed no-trade seller payment", 1e-12);
    assertClose(model.scalarGridValueAt(rule.q, 0.8, 0.3), 1,
      "Exact scalar-grid point evaluation", 1e-12);
    assertClose(model.patchGridValueAt(rule.pB, 0.8, 0.3), 0.3,
      "Exact payment-grid point evaluation", 1e-12);
  });

  test("Interim deviation utilities and best-report traces use exact payments", function () {
    var vcg = model.summarize(model.presetVcg());
    assertClose(
      model.buyerInterimDeviationUtility(vcg.interim, 0.6, 0.2),
      0.1,
      "Buyer utility from reporting 0.2 at true value 0.6",
      1e-10
    );
    assertClose(
      model.sellerInterimDeviationUtility(vcg.interim, 0.3, 0.7),
      0.165,
      "Seller utility from reporting 0.7 at true cost 0.3",
      1e-10
    );
    [0, 0.17, 0.6, 0.93, 1].forEach(function (type) {
      assertClose(model.buyerBestInterimReport(vcg.interim, type).report, type,
        "VCG buyer best report", 1e-9);
      assertClose(model.sellerBestInterimReport(vcg.interim, type).report, type,
        "VCG seller best report", 1e-9);
    });
    assert(vcg.deviation.buyer.bestResponses.length ===
      model.DEVIATION_TRACE_SAMPLES && vcg.deviation.seller.bestResponses.length ===
      model.DEVIATION_TRACE_SAMPLES,
    "Each exact best-response trace should use the declared display sample count.");
    assert(vcg.deviation.buyer.range.min <= 0.1 &&
      vcg.deviation.buyer.range.max >= 0.1,
    "The exact buyer utility range should contain the tested deviation utility.");

    var agv = model.summarize(model.presetAgv(0.25));
    var chatterjeeSamuelson = model.summarize(
      model.presetChatterjeeSamuelson()
    );
    [agv, chatterjeeSamuelson].forEach(function (summary) {
      [0.13, 0.51, 0.86].forEach(function (type) {
        assertClose(model.buyerBestInterimReport(summary.interim, type).report, type,
          "BIC buyer best report", 1e-7);
        assertClose(model.sellerBestInterimReport(summary.interim, type).report, type,
          "BIC seller best report", 1e-7);
      });
    });

    var split = model.summarize(model.presetSplitDifference());
    var splitGain = split.deviation.buyer.bestResponses.reduce(function (maximum, item) {
      return Math.max(maximum, item.gain);
    }, 0);
    assert(splitGain > model.VERDICT_TOLERANCE,
      "The non-IC midpoint direct rule should have a profitable buyer deviation.");
  });

  test("Two-sided posted prices can collect a spread or require a subsidy", function () {
    var rule = model.presetPostedPrice(0.674, 0.334);
    var onePriceRule = model.presetPostedPrice(0.374);
    var subsidyRule = model.presetPostedPrice(0.25, 0.75);
    var summary = model.summarize(rule);
    var subsidySummary = model.summarize(subsidyRule);
    var v = summary.verdicts;
    var subsidyVerdicts = subsidySummary.verdicts;
    assertClose(rule.parameters.buyerPrice, 0.67,
      "Resolved posted buyer price", 1e-12);
    assertClose(rule.parameters.sellerReceipt, 0.33,
      "Resolved posted seller receipt", 1e-12);
    assertClose(onePriceRule.parameters.buyerPrice, 0.37,
      "One-price buyer cutoff", 1e-12);
    assertClose(onePriceRule.parameters.sellerReceipt, 0.37,
      "One-price seller cutoff", 1e-12);
    assertClose(subsidyRule.parameters.buyerPrice, 0.25,
      "Subsidized posted buyer price", 1e-12);
    assertClose(subsidyRule.parameters.sellerReceipt, 0.75,
      "Subsidized posted seller receipt", 1e-12);
    assert(rule.q.lower[67][32] === 1 && rule.q.upper[67][32] === 1,
      "Reports satisfying both posted cutoffs should trade.");
    assert(rule.q.lower[66][32] === 0 && rule.q.lower[67][33] === 0,
      "Failing either posted cutoff should prevent trade.");
    assertPatchClose(rule.pB.lower[67][32], [0.67, 0, 0, 0, 0, 0],
      "Posted buyer payment patch");
    assertPatchClose(rule.pS.lower[67][32], [0.33, 0, 0, 0, 0, 0],
      "Posted seller receipt patch");
    assert(v.bic && v.dsic, "Two posted cutoffs should be BIC and DSIC.");
    assert(v.exAnteIr && v.interimIr && v.exPostIr,
      "Two posted cutoffs should pass all IR notions.");
    assert(!v.exPostBudgetBalanced && !v.expectedBudgetBalanced &&
      v.exPostNoDeficit,
    "A positive posted spread should collect nonnegative intermediary revenue.");
    assertClose(v.expectedRevenue, 0.34 * 0.33 * 0.33,
      "Posted-price revenue", 1e-10);
    assertClose(v.tradeProbability, 0.33 * 0.33,
      "Posted-price trade probability", 1e-10);
    assertClose(v.welfare, 0.33 * 0.33 * (1 + 0.67 - 0.33) / 2,
      "Posted-price welfare", 1e-10);
    assert(subsidyRule.q.lower[25][74] === 1 &&
      subsidyRule.q.upper[25][74] === 1,
    "Posted prices should trade even when the seller receipt exceeds the buyer price.");
    assertPatchClose(subsidyRule.pB.lower[25][74], [0.25, 0, 0, 0, 0, 0],
      "Subsidized posted buyer payment patch");
    assertPatchClose(subsidyRule.pS.lower[25][74], [0.75, 0, 0, 0, 0, 0],
      "Subsidized posted seller receipt patch");
    assert(subsidyVerdicts.bic && subsidyVerdicts.dsic &&
      subsidyVerdicts.exPostIr,
    "Independent posted cutoffs should remain truthful and individually rational.");
    assert(!subsidyVerdicts.exPostBudgetBalanced &&
      !subsidyVerdicts.expectedBudgetBalanced &&
      !subsidyVerdicts.exPostNoDeficit &&
      !subsidyVerdicts.expectedNoDeficit,
    "A seller receipt above the buyer price should require a subsidy.");
    assertClose(subsidyVerdicts.expectedRevenue, -9 / 32,
      "Expected posted-price subsidy", 1e-10);
    assertClose(subsidyVerdicts.tradeProbability, 9 / 16,
      "Subsidized posted-price trade probability", 1e-10);
    assertClose(subsidyVerdicts.welfare, 9 / 64,
      "Subsidized posted-price welfare", 1e-10);
  });

  test("Balanced AGV is exactly quadratic, BIC, ex-ante IR, and not interim IR", function () {
    var rule = model.presetAgv(0.25);
    var summary = model.summarize(rule);
    var v = summary.verdicts;
    assertPatchClose(rule.pB.upper[0][model.CELL_RESOLUTION - 1],
      [0.25, 0, 0, 0.5, 0, -0.5],
      "AGV payment on a no-trade triangle");
    assert(v.bic && !v.dsic, "AGV should be BIC but not DSIC.");
    assert(v.exAnteIr, "K=1/4 should satisfy both ex-ante participation constraints.");
    assert(!v.interimIr && !v.exPostIr,
      "No AGV normalization can give both agents interim IR here.");
    assert(v.exPostBudgetBalanced && v.expectedBudgetBalanced,
      "The same AGV transfer on both sides should be pointwise balanced.");
    assertClose(v.expectedBuyerPayoff, 1 / 12, "AGV buyer ex-ante payoff", 1e-9);
    assertClose(v.expectedSellerPayoff, 1 / 12, "AGV seller ex-ante payoff", 1e-9);
    assertClose(v.minInterimBuyerPayoff, -1 / 12,
      "AGV minimum buyer interim payoff", 1e-9);
    assertClose(v.minInterimSellerPayoff, -1 / 12,
      "AGV minimum seller interim payoff", 1e-9);
    assertClose(v.welfare, 1 / 6, "AGV welfare", 1e-9);
  });

  test("The AGV constant shifts participation exactly as the envelope predicts", function () {
    var low = model.summarize(model.presetAgv(1 / 6)).verdicts;
    var high = model.summarize(model.presetAgv(1 / 3)).verdicts;
    assert(low.interimBuyerIr && !low.interimSellerIr,
      "At K=1/6 only buyer interim IR should hold.");
    assert(!high.interimBuyerIr && high.interimSellerIr,
      "At K=1/3 only seller interim IR should hold.");
    assert(low.exAnteIr && high.exAnteIr,
      "Both endpoints of [1/6,1/3] should satisfy ex-ante IR.");
  });

  test("Split-the-difference direct reports are balanced and IR at truth but not IC", function () {
    var rule = model.presetSplitDifference();
    var efficient = model.efficientGrid();
    var summary = model.summarize(rule);
    var v = summary.verdicts;
    var i;
    var j;
    assertClose(rule.parameters.sellerShare, 0.5,
      "Default split seller share", 1e-12);
    assertClose(rule.parameters.tradingThreshold, 0,
      "Default split trading threshold", 1e-12);
    for (i = 0; i < model.CELL_RESOLUTION; i += 1) {
      for (j = 0; j < model.CELL_RESOLUTION; j += 1) {
        assert(rule.q.lower[i][j] === efficient.lower[i][j] &&
          rule.q.upper[i][j] === efficient.upper[i][j],
        "The default split allocation should trade exactly when value covers cost.");
      }
    }
    assertPatchClose(rule.pB.lower[50][25], [0, 0.5, 0.5, 0, 0, 0],
      "Default split buyer-payment patch");
    assertPatchClose(rule.pS.lower[50][25], [0, 0.5, 0.5, 0, 0, 0],
      "Default split seller-payment patch");
    assert(!v.bic && !v.dsic,
      "Truthful direct reports should not be incentive compatible at the midpoint price.");
    assert(v.exAnteIr && v.interimIr && v.exPostIr,
      "Truth-profile midpoint payoffs should pass all IR notions.");
    assert(v.exPostBudgetBalanced && v.expectedBudgetBalanced,
      "A common midpoint transfer should be pointwise balanced.");
    assertClose(v.expectedBuyerPayoff, 1 / 12, "Midpoint buyer payoff", 1e-9);
    assertClose(v.expectedSellerPayoff, 1 / 12, "Midpoint seller payoff", 1e-9);
    assertClose(v.tradeProbability, 1 / 2,
      "Default split trade probability", 1e-10);
    assertClose(v.welfare, 1 / 6, "Default split allocation welfare", 1e-9);
  });

  test("The split parameter assigns the exact gains-from-trade shares", function () {
    var rule = model.presetSplitDifference(0.25);
    var v = model.summarize(rule).verdicts;
    assertClose(rule.parameters.sellerShare, 0.25,
      "Off-default split seller share", 1e-12);
    assertPatchClose(rule.pB.lower[50][25], [0, 0.25, 0.75, 0, 0, 0],
      "Off-default split buyer-payment patch");
    assertPatchClose(rule.pS.lower[50][25], [0, 0.25, 0.75, 0, 0, 0],
      "Off-default split seller-payment patch");
    assertClose(v.expectedBuyerPayoff, 1 / 8,
      "Buyer three-quarter share of expected gains", 1e-9);
    assertClose(v.expectedSellerPayoff, 1 / 24,
      "Seller one-quarter share of expected gains", 1e-9);
    assert(v.exPostIr && v.exPostBudgetBalanced,
      "Every unit-interval split should remain ex-post IR and balanced.");
  });

  test("The split parameter accepts both endpoint shares", function () {
    var buyerEndpoint = model.presetSplitDifference(0);
    var sellerEndpoint = model.presetSplitDifference(1);
    assertPatchClose(buyerEndpoint.pB.lower[50][25], [0, 0, 1, 0, 0, 0],
      "Buyer endpoint split patch");
    assertPatchClose(sellerEndpoint.pB.lower[50][25], [0, 1, 0, 0, 0, 0],
      "Seller endpoint split patch");
    assert(buyerEndpoint.parameters.sellerShare === 0 &&
      sellerEndpoint.parameters.sellerShare === 1,
    "Both closed-domain split endpoints should be retained exactly.");
  });

  test("The C-S direct equivalent is exact, BIC, balanced, and not DSIC", function () {
    var rule = model.presetChatterjeeSamuelson();
    var summary = model.summarize(rule);
    var v = summary.verdicts;
    assertClose(rule.parameters.threshold, 0.25,
      "Default C-S trading threshold", 1e-12);
    assertClose(rule.parameters.sellerShare, 0.5,
      "Default C-S seller share", 1e-12);
    assertPatchClose(rule.pB.lower[50][25], [1 / 6, 1 / 3, 1 / 3, 0, 0, 0],
      "C-S transaction-price patch");
    assert(v.bic && !v.dsic, "The C-S direct equivalent should be BIC but not DSIC.");
    assert(v.exAnteIr && v.interimIr && v.exPostIr,
      "The C-S direct equivalent should pass all IR notions.");
    assert(v.exPostBudgetBalanced && v.expectedBudgetBalanced,
      "The common C-S price should be exactly balanced.");
    assertClose(v.welfare, 9 / 64, "C-S welfare", 1e-9);
    assertClose(v.expectedBuyerPayoff, 9 / 128, "C-S buyer payoff", 1e-9);
    assertClose(v.expectedSellerPayoff, 9 / 128, "C-S seller payoff", 1e-9);
    assertClose(v.expectedRevenue, 0, "C-S expected revenue", 1e-9);
  });

  test("The split trading threshold is exact on the mesh and diagnostics track its change", function () {
    var rule = model.presetSplitDifference(0.5, 0.5);
    var v = model.summarize(rule).verdicts;
    assertClose(rule.parameters.tradingThreshold, 0.5,
      "Changed split trading threshold", 1e-12);
    assert(rule.q.lower[50][0] === 1 && rule.q.upper[50][0] === 0,
      "The threshold diagonal should belong only to the lower-right triangle.");
    assert(rule.q.lower[51][0] === 1 && rule.q.upper[51][0] === 1,
      "Both triangles strictly above the threshold should trade.");
    assert(rule.q.lower[49][0] === 0 && rule.q.upper[49][0] === 0,
      "Neither triangle below the threshold should trade.");
    assertClose(v.tradeProbability, 1 / 8,
      "Threshold-one-half trade probability", 1e-10);
    assertClose(v.welfare, 1 / 12,
      "Threshold-one-half welfare", 1e-10);
    assert(!v.bic,
      "The thresholded midpoint rule should not be BIC.");
    assert(v.exAnteIr && v.interimIr && v.exPostIr,
      "The threshold-one-half truth profile should pass all IR notions.");
    assert(v.exPostBudgetBalanced && v.expectedBudgetBalanced,
      "The common split transfer should remain exactly balanced.");
  });

  test("The split threshold resolves to the nearest one-cent mesh diagonal", function () {
    var rule = model.presetSplitDifference(0.5, 0.274);
    assertClose(rule.parameters.tradingThreshold, 0.27,
      "Resolved split trading threshold", 1e-12);
    assert(rule.q.lower[27][0] === 1 && rule.q.upper[27][0] === 0,
      "The resolved threshold should use the twenty-seven-cell diagonal.");
  });

  test("The split threshold endpoints give efficient trade and no trade", function () {
    var efficient = model.efficientGrid();
    var thresholdZero = model.presetSplitDifference(0.5, 0).q;
    var thresholdOne = model.presetSplitDifference(0.5, 1).q;
    var i;
    var j;
    for (i = 0; i < model.CELL_RESOLUTION; i += 1) {
      for (j = 0; j < model.CELL_RESOLUTION; j += 1) {
        assert(thresholdZero.lower[i][j] === efficient.lower[i][j] &&
          thresholdZero.upper[i][j] === efficient.upper[i][j],
        "A zero split threshold should equal efficient trade.");
        assert(thresholdOne.lower[i][j] === 0 &&
          thresholdOne.upper[i][j] === 0,
        "A unit split threshold should give no trade.");
      }
    }
  });

  test("The broker-revenue preset defaults to the truthful uniform revenue optimum", function () {
    var rule = model.presetRevenueThreshold();
    var summary = model.summarize(rule);
    var v = summary.verdicts;
    assertClose(rule.parameters.threshold, 0.5,
      "Default broker threshold", 1e-12);
    assertClose(rule.parameters.buyerMarkup, 0.5,
      "Default broker buyer markup", 1e-12);
    assertClose(rule.parameters.sellerDiscount, 0.5,
      "Default broker seller discount", 1e-12);
    assertPatchClose(rule.pB.lower[50][0], [0.5, 0, 1, 0, 0, 0],
      "Broker buyer critical-payment patch");
    assertPatchClose(rule.pS.lower[50][0], [-0.5, 1, 0, 0, 0, 0],
      "Broker seller critical-receipt patch");
    assert(v.bic && v.dsic,
      "Critical payments should truthfully implement the threshold allocation.");
    assert(v.exAnteIr && v.interimIr && v.exPostIr,
      "The critical-payment broker rule should pass all IR notions.");
    assert(!v.exPostBudgetBalanced && !v.expectedBudgetBalanced &&
      v.exPostNoDeficit && v.expectedNoDeficit,
    "The optimal broker rule should collect weakly positive revenue.");
    assertClose(v.tradeProbability, 1 / 8,
      "Optimal broker trade probability", 1e-10);
    assertClose(v.welfare, 1 / 12,
      "Optimal broker welfare", 1e-10);
    assertClose(v.expectedBuyerPayoff, 1 / 48,
      "Optimal broker buyer payoff", 1e-9);
    assertClose(v.expectedSellerPayoff, 1 / 48,
      "Optimal broker seller payoff", 1e-9);
    assertClose(v.expectedRevenue, 1 / 24,
      "Optimal broker expected revenue", 1e-9);
    var below = model.summarize(
      model.presetRevenueThreshold(0.49, 0.49, 0.49)
    ).verdicts.expectedRevenue;
    var above = model.summarize(
      model.presetRevenueThreshold(0.51, 0.51, 0.51)
    ).verdicts.expectedRevenue;
    assert(v.expectedRevenue > below && v.expectedRevenue > above,
      "The one-half truthful threshold should beat both adjacent slider choices.");
  });

  test("The broker threshold and payment parameters remain independent diagnostics", function () {
    var truthful = model.summarize(
      model.presetRevenueThreshold(0.25, 0.25, 0.25)
    ).verdicts;
    var rule = model.presetRevenueThreshold(0.5, 0.4, 0.6);
    var v = model.summarize(rule).verdicts;
    assert(truthful.bic && truthful.dsic && truthful.exPostIr,
      "Matching both payment adjustments to the threshold should remain truthful and IR.");
    assert(truthful.expectedBudgetBalanced && !truthful.exPostNoDeficit,
      "The truthful quarter-threshold rule should balance only in expectation.");
    assertPatchClose(rule.pB.lower[50][0], [0.4, 0, 1, 0, 0, 0],
      "Independent broker buyer-payment patch");
    assertPatchClose(rule.pS.lower[50][0], [-0.6, 1, 0, 0, 0, 0],
      "Independent broker seller-receipt patch");
    assert(!v.bic && !v.dsic,
      "Payment adjustments that differ from the allocation threshold should fail IC.");
    assert(v.exPostBuyerIr && !v.exPostSellerIr,
      "Independent payment adjustments should expose their separate IR consequences.");
  });

  test("The broker family contains VCG and no trade at its two threshold endpoints", function () {
    var revenueVcg = model.presetRevenueThreshold(0, 0, 0);
    var vcg = model.presetVcg();
    var noTrade = model.presetRevenueThreshold(1, 1, 1);
    var i;
    var j;
    ["lower", "upper"].forEach(function (side) {
      for (i = 0; i < model.CELL_RESOLUTION; i += 1) {
        for (j = 0; j < model.CELL_RESOLUTION; j += 1) {
          assert(revenueVcg.q[side][i][j] === vcg.q[side][i][j],
            "The zero-threshold broker allocation should equal VCG.");
          assertPatchClose(revenueVcg.pB[side][i][j], vcg.pB[side][i][j],
            "The zero-threshold broker buyer payment should equal VCG");
          assertPatchClose(revenueVcg.pS[side][i][j], vcg.pS[side][i][j],
            "The zero-threshold broker seller receipt should equal VCG");
          assert(noTrade.q[side][i][j] === 0,
            "The unit-threshold broker allocation should never trade.");
          assertPatchClose(noTrade.pB[side][i][j], model.constantPatch(0),
            "The no-trade broker buyer payment should vanish");
          assertPatchClose(noTrade.pS[side][i][j], model.constantPatch(0),
            "The no-trade broker seller receipt should vanish");
        }
      }
    });
  });

  test("Fix IC/IR turns the efficient allocation into exact zero-boundary VCG", function () {
    var q = model.efficientGrid();
    var fixed = model.zeroBoundaryPayments(q);
    var vcg = model.presetVcg();
    var i;
    var j;
    for (i = 0; i < model.CELL_RESOLUTION; i += 1) {
      for (j = 0; j < model.CELL_RESOLUTION; j += 1) {
        assertPatchClose(fixed.pB.lower[i][j], vcg.pB.lower[i][j],
          "Fixed buyer lower patch");
        assertPatchClose(fixed.pB.upper[i][j], vcg.pB.upper[i][j],
          "Fixed buyer upper patch");
        assertPatchClose(fixed.pS.lower[i][j], vcg.pS.lower[i][j],
          "Fixed seller lower patch");
        assertPatchClose(fixed.pS.upper[i][j], vcg.pS.upper[i][j],
          "Fixed seller upper patch");
      }
    }
    var summary = model.summarize({ q: q, pB: fixed.pB, pS: fixed.pS });
    assert(summary.verdicts.bic && summary.verdicts.dsic && summary.verdicts.exPostIr,
      "The repaired efficient rule should be DSIC and ex-post IR.");
  });

  test("Fix IC/IR gives the C-S allocation its exact critical-value transfers", function () {
    var q = model.chatterjeeSamuelsonGrid();
    var fixed = model.zeroBoundaryPayments(q);
    var summary = model.summarize({ q: q, pB: fixed.pB, pS: fixed.pS });
    assertClose(valueAt(fixed.pB, 0.83, 0.2), 0.45,
      "C-S-threshold buyer critical payment", 1e-10);
    assertClose(valueAt(fixed.pS, 0.83, 0.2), 0.58,
      "C-S-threshold seller critical receipt", 1e-10);
    assert(summary.verdicts.bic && summary.verdicts.dsic && summary.verdicts.exPostIr,
      "Critical-value transfers should make the threshold rule DSIC and ex-post IR.");
    assert(!summary.verdicts.exPostBudgetBalanced,
      "Critical-value transfers should not be pointwise balanced.");
    assert(summary.verdicts.expectedBudgetBalanced,
      "The zero-boundary C-S threshold transfers should balance in expectation.");
  });

  test("BIC implementability can hold when pointwise DSIC implementability fails", function () {
    var q = model.createScalarGrid(
      function (i, j) {
        return j < model.CELL_RESOLUTION / 2 ?
          i / (model.CELL_RESOLUTION - 1) :
          (model.CELL_RESOLUTION - 1 - i) / (model.CELL_RESOLUTION - 1);
      },
      function (i, j) {
        return j < model.CELL_RESOLUTION / 2 ?
          i / (model.CELL_RESOLUTION - 1) :
          (model.CELL_RESOLUTION - 1 - i) / (model.CELL_RESOLUTION - 1);
      }
    );
    var bic = model.checkBicImplementability(q);
    var dsic = model.checkDsicAllocation(q);
    assert(bic.holds, "Both interim allocations should be constant at one half.");
    assert(!dsic.holds, "The pointwise allocation should violate DSIC monotonicity.");
    var fixed = model.zeroBoundaryPayments(q);
    var summary = model.summarize({ q: q, pB: fixed.pB, pS: fixed.pS });
    assert(summary.verdicts.bic && !summary.verdicts.dsic,
      "Repair should achieve BIC but cannot repair pointwise allocation monotonicity.");
    assert(summary.verdicts.exPostIr,
      "Zero-boundary pointwise envelopes should give nonnegative truthful payoffs.");
  });

  test("Within-triangle changes and interim slopes are included in exact IC tests", function () {
    var pointwiseFailure = model.constantScalarGrid(0);
    pointwiseFailure.upper[0][0] = 1;
    assert(!model.checkDsicAllocation(pointwiseFailure).holds,
      "q_L>q_R within one cell should violate pointwise monotonicity.");

    var interimFailure = model.constantScalarGrid(0.5);
    var j;
    for (j = 0; j < model.CELL_RESOLUTION; j += 1) {
      interimFailure.upper[model.CELL_RESOLUTION / 2][j] = 1;
      interimFailure.lower[model.CELL_RESOLUTION / 2][j] = 0;
    }
    assert(!model.checkBicImplementability(interimFailure).buyer.holds,
      "A falling within-cell interim affine segment should violate buyer monotonicity.");
    var formalPayments = model.zeroBoundaryPayments(interimFailure);
    var formalSummary = model.summarize({
      q: interimFailure,
      pB: formalPayments.pB,
      pS: formalPayments.pS
    });
    assert(!formalSummary.verdicts.bic,
      "Formal envelope payments should not conceal the allocation's BIC failure.");
    assert(formalSummary.verdicts.exPostIr,
      "The zero-boundary calculation should still give nonnegative truthful payoffs.");
  });

  test("Editing one payment patch breaks the actual-transfer IC and balance checks", function () {
    var rule = model.presetVcg();
    rule.pB.lower[model.CELL_RESOLUTION - 1][0] = model.constantPatch(2);
    var summary = model.summarize(rule);
    assert(!summary.verdicts.bic && !summary.verdicts.dsic,
      "Actual-transfer IC should fail after a local payment edit.");
    assert(!summary.verdicts.exPostBudgetBalanced,
      "The local edit should not look pointwise balanced.");
    assert(summary.verdicts.buyerBicViolationCount > 0,
      "The affected buyer interim interval should be marked.");
  });

  test("Ex-post IR uses continuous quadratic extrema rather than centroid samples", function () {
    var rule = {
      q: model.constantScalarGrid(0),
      pB: model.constantPatchGrid(0),
      pS: model.constantPatchGrid(0)
    };
    var boundaryLoss = model.CELL_SIZE / 5;
    rule.pB.lower[0][0] = [boundaryLoss, -1, -1, 0, 0, 0];
    var summary = model.summarize(rule);
    var centroid = model.triangleCentroid(0, 0, true);
    assert(model.patchGridValueAt(
      summary.patches.buyerPayoff, centroid.v, centroid.c
    ) > 0, "The payoff should be positive at the triangle centroid.");
    assertClose(summary.verdicts.minBuyerPayoff, -boundaryLoss,
      "The true vertex payoff minimum", 1e-10);
    assert(!summary.verdicts.exPostBuyerIr,
      "The exact continuous minimum should fail buyer ex-post IR.");
  });

  test("Ex-post IR finds a quadratic minimum strictly inside a triangle", function () {
    var rule = {
      q: model.constantScalarGrid(0),
      pB: model.constantPatchGrid(0),
      pS: model.constantPatchGrid(0)
    };
    var i = 28;
    var j = 36;
    var minimizingValue = 0.289;
    var minimizingCost = 0.361;
    var loss = 0.000001;
    rule.pB.lower[i][j] = [
      loss - minimizingValue * minimizingValue - minimizingCost * minimizingCost,
      2 * minimizingValue,
      2 * minimizingCost,
      -1,
      0,
      -1
    ];
    var summary = model.summarize(rule);
    var range = summary.ir.exPost.buyerRange;
    var centroid = model.triangleCentroid(i, j, true);
    assert(model.patchGridValueAt(
      summary.patches.buyerPayoff, centroid.v, centroid.c
    ) > 0, "The centroid should miss the interior participation failure.");
    assertClose(range.min, -loss, "Interior quadratic payoff minimum", 1e-10);
    assertClose(range.minLocation.v, minimizingValue,
      "Interior minimizing buyer value", 1e-10);
    assertClose(range.minLocation.c, minimizingCost,
      "Interior minimizing seller cost", 1e-10);
    assert(!summary.verdicts.exPostBuyerIr,
      "The exact interior minimum should fail buyer ex-post IR.");
  });

  test("Every preset summary and exact output stays finite", function () {
    [
      model.presetVcg(),
      model.presetPostedPrice(0.67, 0.33),
      model.presetAgv(0.25),
      model.presetSplitDifference(),
      model.presetChatterjeeSamuelson(),
      model.presetRevenueThreshold()
    ].forEach(function (rule) {
      var summary = model.summarize(rule);
      assert(allFiniteScalarGrid(rule.q) &&
        allFinitePatchGrid(rule.pB) && allFinitePatchGrid(rule.pS),
        "Preset patch coefficients should be finite.");
      ["buyerPayoff", "sellerPayoff", "revenue"].forEach(function (key) {
        assert(allFinitePatchGrid(summary.patches[key]),
          "Exact summary patches finite: " + key);
      });
      Object.keys(summary.verdicts).forEach(function (key) {
        if (typeof summary.verdicts[key] === "number") {
          assert(Number.isFinite(summary.verdicts[key]),
            "Summary scalar finite: " + key);
        }
      });
      ["buyerAllocation", "sellerAllocation", "buyerPayment", "sellerPayment",
        "buyerPayoff", "sellerPayoff"].forEach(function (key) {
        assert(summary.interim[key].length === model.CELL_RESOLUTION &&
          summary.interim[key].every(function (polynomial) {
            return polynomial.every(Number.isFinite);
          }), "Exact interim polynomials should remain finite: " + key);
      });
      [summary.deviation.buyer, summary.deviation.seller].forEach(function (diagnostic) {
        assert(Number.isFinite(diagnostic.range.min) &&
          Number.isFinite(diagnostic.range.max) &&
          diagnostic.bestResponses.every(function (response) {
            return Number.isFinite(response.trueType) &&
              Number.isFinite(response.report) && Number.isFinite(response.utility) &&
              Number.isFinite(response.truthfulUtility) && Number.isFinite(response.gain);
          }), "Deviation diagnostics should remain finite.");
      });
    });
  });

  test("Invalid grids and nonfinite preset parameters fail before diagnostics", function () {
    var threwAllocation = false;
    var threwPayment = false;
    var threwParameter = false;
    var threwMagnitude = false;
    var threwPresetMagnitude = false;
    var threwSplitNonfinite = false;
    var threwSplitRange = false;
    var threwSplitThresholdNonfinite = false;
    var threwSplitThresholdRange = false;
    var threwPostedBuyerNonfinite = false;
    var threwPostedSellerRange = false;
    var threwRevenueThresholdNonfinite = false;
    var threwRevenueMarkupRange = false;
    var threwRevenueDiscountNonfinite = false;
    var badAllocation = model.presetVcg();
    badAllocation.q.lower[0][0] = 1.1;
    try {
      model.summarize(badAllocation);
    } catch (error) {
      threwAllocation = error instanceof RangeError;
    }
    var badPayment = model.presetVcg();
    badPayment.pB.lower[0][0][0] = Infinity;
    try {
      model.summarize(badPayment);
    } catch (error) {
      threwPayment = error instanceof TypeError;
    }
    try {
      model.presetAgv(NaN);
    } catch (error) {
      threwParameter = error instanceof TypeError;
    }
    var extremePayment = model.presetVcg();
    extremePayment.pB.lower[0][0][0] = 1e141;
    try {
      model.summarize(extremePayment);
    } catch (error) {
      threwMagnitude = error instanceof RangeError;
    }
    try {
      model.presetAgv(-1e141);
    } catch (error) {
      threwPresetMagnitude = error instanceof RangeError;
    }
    try {
      model.presetSplitDifference(NaN);
    } catch (error) {
      threwSplitNonfinite = error instanceof TypeError;
    }
    try {
      model.presetSplitDifference(-0.01);
    } catch (error) {
      threwSplitRange = error instanceof RangeError;
    }
    try {
      model.presetSplitDifference(0.5, Infinity);
    } catch (error) {
      threwSplitThresholdNonfinite = error instanceof TypeError;
    }
    try {
      model.presetSplitDifference(0.5, 1.01);
    } catch (error) {
      threwSplitThresholdRange = error instanceof RangeError;
    }
    try {
      model.presetPostedPrice(NaN, 0.3);
    } catch (error) {
      threwPostedBuyerNonfinite = error instanceof TypeError;
    }
    try {
      model.presetPostedPrice(0.7, -0.01);
    } catch (error) {
      threwPostedSellerRange = error instanceof RangeError;
    }
    try {
      model.presetRevenueThreshold(Infinity, 0.5, 0.5);
    } catch (error) {
      threwRevenueThresholdNonfinite = error instanceof TypeError;
    }
    try {
      model.presetRevenueThreshold(0.5, -0.01, 0.5);
    } catch (error) {
      threwRevenueMarkupRange = error instanceof RangeError;
    }
    try {
      model.presetRevenueThreshold(0.5, 0.5, NaN);
    } catch (error) {
      threwRevenueDiscountNonfinite = error instanceof TypeError;
    }
    assert(threwAllocation, "Out-of-range q should throw RangeError.");
    assert(threwPayment, "Nonfinite payment coefficients should throw TypeError.");
    assert(threwParameter, "Nonfinite preset parameters should throw TypeError.");
    assert(threwMagnitude,
      "A payment outside the stable diagnostic range should throw RangeError.");
    assert(threwPresetMagnitude,
      "A preset outside the stable diagnostic range should throw RangeError.");
    assert(threwSplitNonfinite,
      "A nonfinite seller share should throw TypeError.");
    assert(threwSplitRange,
      "A seller share outside [0,1] should throw RangeError.");
    assert(threwSplitThresholdNonfinite,
      "A nonfinite split trading threshold should throw TypeError.");
    assert(threwSplitThresholdRange,
      "A split trading threshold outside [0,1] should throw RangeError.");
    assert(threwPostedBuyerNonfinite,
      "A nonfinite posted buyer price should throw TypeError.");
    assert(threwPostedSellerRange,
      "A posted seller receipt outside [0,1] should throw RangeError.");
    assert(threwRevenueThresholdNonfinite,
      "A nonfinite broker threshold should throw TypeError.");
    assert(threwRevenueMarkupRange,
      "A broker buyer markup outside [0,1] should throw RangeError.");
    assert(threwRevenueDiscountNonfinite,
      "A nonfinite broker seller discount should throw TypeError.");
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
      " bargaining-sandbox model tests passed.";
    document.body.dataset.status = allPassed ? "passed" : "failed";
    document.title = (allPassed ? "PASS" : "FAIL") +
      " — Bargaining-sandbox model tests";
  }
}());
