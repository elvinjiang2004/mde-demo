(function () {
  "use strict";

  var formula = window.BargainingSandboxModel;
  var legacy = window.LegacyBargainingSandboxModel;
  var myersonSatterthwaite = window.BilateralTradeModel;
  var envelope = window.BilateralTradeEnvelope;
  var tests = [];
  var pointTolerance = 1e-11;
  var integralTolerance = 1e-8;
  var parameterCases = [
    { t: 0, alpha: 0, beta: 0 },
    { t: 0, alpha: 1, beta: 1 },
    { t: 0.37, alpha: 0.37, beta: 0.37 },
    { t: 0.37, alpha: 0.36, beta: 0.38 },
    { t: 0.8, alpha: 0.1, beta: 0.8 },
    { t: 0.2, alpha: 0.8, beta: 0.2 },
    { t: 0.99, alpha: 0.98, beta: 1 },
    { t: 1, alpha: 0.3, beta: 0.2 }
  ];
  var diagnosticCases = parameterCases.concat([
    { t: 0.37, alpha: 0.38, beta: 0.36 },
    { t: 1, alpha: 0, beta: 1 },
    { t: 1, alpha: 1, beta: 1 }
  ]);
  var presetCases = [
    {
      name: "VCG",
      formulaRule: function () { return formula.createVcgRule(); },
      legacyRule: function () { return legacy.presetVcg(); }
    },
    {
      name: "Posted price",
      formulaRule: function () {
        return formula.createPostedPriceRule(0.5, 0.5);
      },
      legacyRule: function () {
        return legacy.presetPostedPrice(0.5, 0.5);
      }
    },
    {
      name: "AGV",
      formulaRule: function () { return formula.createAgvRule(0.25); },
      legacyRule: function () { return legacy.presetAgv(0.25); }
    },
    {
      name: "Split-the-difference",
      formulaRule: function () {
        return formula.createSplitDifferenceRule(0.5, 0);
      },
      legacyRule: function () {
        return legacy.presetSplitDifference(0.5, 0);
      }
    },
    {
      name: "Chatterjee-Samuelson",
      formulaRule: function () {
        return formula.createChatterjeeSamuelsonRule();
      },
      legacyRule: function () {
        return legacy.presetChatterjeeSamuelson();
      }
    },
    {
      name: "Revenue threshold",
      formulaRule: function () {
        return formula.createRevenueThresholdRule(0.5, 0.5, 0.5);
      },
      legacyRule: function () {
        return legacy.presetRevenueThreshold(0.5, 0.5, 0.5);
      }
    }
  ];

  test("Custom Fix IC/IR exactly matches the current M-S payment construction", function () {
    var q = formula.createEfficientCustomAllocation();
    var customPayments = formula.zeroBoundaryPayments(q);
    var msGrid = myersonSatterthwaite.efficientGrid();
    var msPayments = myersonSatterthwaite.zeroBoundaryPayments(msGrid);
    assert(formula.CUSTOM_RESOLUTION === myersonSatterthwaite.CELL_RESOLUTION,
      "Custom and M-S should use the same 20 by 20 resolution.");
    ["lower", "upper"].forEach(function (side) {
      var i;
      var j;
      var coefficient;
      for (i = 0; i < formula.CUSTOM_RESOLUTION; i += 1) {
        for (j = 0; j < formula.CUSTOM_RESOLUTION; j += 1) {
          assertClose(q[side][i][j], msGrid[side][i][j],
            "Allocation parity " + side + " " + i + "," + j);
          for (coefficient = 0; coefficient < 6; coefficient += 1) {
            assertClose(
              customPayments.pB[side][i][j][coefficient],
              msPayments.pB[side][i][j][coefficient],
              "Buyer payment parity " + side + " " + i + "," + j +
                " coefficient " + coefficient
            );
            assertClose(
              customPayments.pS[side][i][j][coefficient],
              msPayments.pS[side][i][j][coefficient],
              "Seller payment parity " + side + " " + i + "," + j +
                " coefficient " + coefficient
            );
          }
        }
      }
    });
  });

  function test(name, callback) {
    tests.push({ name: name, callback: callback });
  }

  function assert(condition, message) {
    if (!condition) {
      throw new Error(message || "Assertion failed.");
    }
  }

  function assertClose(actual, expected, message, customTolerance) {
    var allowed = customTolerance === undefined ?
      pointTolerance : customTolerance;
    if (!Number.isFinite(actual) || Math.abs(actual - expected) > allowed) {
      throw new Error(
        (message || "Values differ.") +
        " Expected " + expected + ", received " + actual + "."
      );
    }
  }

  function parametersLabel(parameters) {
    return "t=" + parameters.t + ", alpha=" + parameters.alpha +
      ", beta=" + parameters.beta;
  }

  function formulaRule(parameters) {
    return formula.createRevenueThresholdRule(
      parameters.t, parameters.alpha, parameters.beta
    );
  }

  function legacyRule(parameters) {
    return legacy.presetRevenueThreshold(
      parameters.t, parameters.alpha, parameters.beta
    );
  }

  function interimValue(polynomials, value) {
    var index = Math.min(
      legacy.CELL_RESOLUTION - 1,
      Math.floor(Math.max(0, Math.min(1, value)) *
        legacy.CELL_RESOLUTION)
    );
    return legacy.evaluatePolynomial(polynomials[index], value);
  }

  function assertInteriorFieldClose(actual, expected, field, parameters,
      i, j, side) {
    if (!Number.isFinite(actual) ||
        Math.abs(actual - expected) > pointTolerance) {
      throw new Error(
        field + " differs at " + parametersLabel(parameters) +
        ", cell (" + i + "," + j + "), " + side +
        " triangle. Expected " + expected + ", received " + actual + "."
      );
    }
  }

  function legacyExpectedValues(rule) {
    var payoffs = envelope.truthfulPayoffPatches(rule);
    var buyerPayment = legacy.integratePatchGrid(rule.pB);
    var sellerPayment = legacy.integratePatchGrid(rule.pS);
    return {
      tradeProbability: envelope.expectedTradeProbability(rule.q),
      welfare: envelope.welfare(rule.q),
      buyerPayment: buyerPayment,
      sellerPayment: sellerPayment,
      buyerUtility: legacy.integratePatchGrid(payoffs.buyer),
      sellerUtility: legacy.integratePatchGrid(payoffs.seller),
      revenue: buyerPayment - sellerPayment
    };
  }

  function scalarGridRange(grid) {
    var minimum = Infinity;
    var maximum = -Infinity;
    ["lower", "upper"].forEach(function (side) {
      grid[side].forEach(function (row) {
        row.forEach(function (value) {
          minimum = Math.min(minimum, value);
          maximum = Math.max(maximum, value);
        });
      });
    });
    return { min: minimum, max: maximum };
  }

  test("Both isolated model representations load without compatibility grids", function () {
    var formulaPreset = formulaRule(parameterCases[2]);
    var legacyPreset = legacyRule(parameterCases[2]);
    assert(formula && legacy && envelope,
      "Both models and the shared legacy envelope should load.");
    assert(formulaPreset.representation === "formula-regions",
      "The production rule should retain its formula representation.");
    assert(formulaPreset.q === undefined && formulaPreset.pB === undefined &&
      formulaPreset.pS === undefined,
    "The formula rule should not acquire legacy grid fields.");
    assert(legacyPreset.q.lower.length === legacy.CELL_RESOLUTION &&
      legacyPreset.pB.upper.length === legacy.CELL_RESOLUTION,
    "The legacy preset should retain its native triangle grids.");
  });

  test("Allocation agrees at every triangle interior for all 101 thresholds", function () {
    var resolution = legacy.CELL_RESOLUTION;
    var thresholdStep;
    var i;
    var j;
    for (thresholdStep = 0; thresholdStep <= resolution;
        thresholdStep += 1) {
      var threshold = thresholdStep / resolution;
      var grid = legacy.chatterjeeSamuelsonGrid(threshold);
      var evaluateFormula = formula.fieldEvaluator(
        formula.createRevenueThresholdRule(threshold, 0.37, 0.63), "q"
      );
      for (i = 0; i < resolution; i += 1) {
        for (j = 0; j < resolution; j += 1) {
          var lower = legacy.triangleCentroid(i, j, true);
          var upper = legacy.triangleCentroid(i, j, false);
          var lowerExpected = evaluateFormula(lower.v, lower.c);
          var upperExpected = evaluateFormula(upper.v, upper.c);
          if (grid.lower[i][j] !== lowerExpected) {
            throw new Error(
              "Lower allocation differs at threshold step " + thresholdStep +
              ", cell (" + i + "," + j + ")."
            );
          }
          if (grid.upper[i][j] !== upperExpected) {
            throw new Error(
              "Upper allocation differs at threshold step " + thresholdStep +
              ", cell (" + i + "," + j + ")."
            );
          }
        }
      }
    }
  });

  test("Allocation and both transfers agree on representative triangle interiors", function () {
    var resolution = legacy.CELL_RESOLUTION;
    parameterCases.forEach(function (parameters) {
      var formulaPreset = formulaRule(parameters);
      var legacyPreset = legacyRule(parameters);
      var evaluateQ = formula.fieldEvaluator(formulaPreset, "q");
      var evaluateBuyerPayment = formula.fieldEvaluator(formulaPreset, "pB");
      var evaluateSellerPayment = formula.fieldEvaluator(formulaPreset, "pS");
      var evaluateBuyerPayoff = formula.diagnosticEvaluator(
        formulaPreset, "buyerPayoff"
      );
      var evaluateSellerPayoff = formula.diagnosticEvaluator(
        formulaPreset, "sellerPayoff"
      );
      var evaluateRevenue = formula.diagnosticEvaluator(
        formulaPreset, "revenue"
      );
      var evaluateEfficiency = formula.diagnosticEvaluator(
        formulaPreset, "efficiency"
      );
      var payoffPatches = envelope.truthfulPayoffPatches(legacyPreset);
      var revenuePatches = envelope.revenuePatches(legacyPreset);
      var i;
      var j;
      ["lower", "upper"].forEach(function (side) {
        var isLower = side === "lower";
        for (i = 0; i < resolution; i += 1) {
          for (j = 0; j < resolution; j += 1) {
            var point = legacy.triangleCentroid(i, j, isLower);
            assertInteriorFieldClose(
              legacyPreset.q[side][i][j],
              evaluateQ(point.v, point.c),
              "q", parameters, i, j, side
            );
            assertInteriorFieldClose(
              legacy.evaluatePatch(
                legacyPreset.pB[side][i][j], point.v, point.c
              ),
              evaluateBuyerPayment(point.v, point.c),
              "pB", parameters, i, j, side
            );
            assertInteriorFieldClose(
              legacy.evaluatePatch(
                legacyPreset.pS[side][i][j], point.v, point.c
              ),
              evaluateSellerPayment(point.v, point.c),
              "pS", parameters, i, j, side
            );
            assertInteriorFieldClose(
              legacy.evaluatePatch(
                payoffPatches.buyer[side][i][j], point.v, point.c
              ),
              evaluateBuyerPayoff(point.v, point.c),
              "buyer payoff", parameters, i, j, side
            );
            assertInteriorFieldClose(
              legacy.evaluatePatch(
                payoffPatches.seller[side][i][j], point.v, point.c
              ),
              evaluateSellerPayoff(point.v, point.c),
              "seller payoff", parameters, i, j, side
            );
            assertInteriorFieldClose(
              legacy.evaluatePatch(
                revenuePatches[side][i][j], point.v, point.c
              ),
              evaluateRevenue(point.v, point.c),
              "revenue", parameters, i, j, side
            );
            var legacyError = legacy.allocationErrorAt(
              legacyPreset.q, point.v, point.c
            );
            var formulaError = evaluateEfficiency(point.v, point.c);
            assert(legacyError.q === formulaError.q &&
              legacyError.efficient === formulaError.efficient &&
              legacyError.over === formulaError.over &&
              legacyError.under === formulaError.under,
            "Efficiency error differs at " + parametersLabel(parameters) +
              ", cell (" + i + "," + j + "), " + side + " triangle.");
          }
        }
      });
    });
  });

  test("Buyer interim functions and ex-ante outcomes agree", function () {
    var trueValues = [0, 0.13, 0.37, 0.61, 0.89, 1];
    parameterCases.forEach(function (parameters) {
      var formulaPreset = formulaRule(parameters);
      var legacyPreset = legacyRule(parameters);
      var legacyInterim = envelope.interimRulePolynomials(
        legacyPreset
      );
      var reportStep;
      for (reportStep = 0; reportStep <= 200; reportStep += 1) {
        var report = reportStep / 200;
        assertClose(
          interimValue(legacyInterim.buyerAllocation, report),
          formula.buyerInterimAllocation(formulaPreset, report),
          "Buyer interim allocation at " + parametersLabel(parameters) +
            ", report=" + report
        );
        assertClose(
          interimValue(legacyInterim.buyerPayment, report),
          formula.buyerInterimPayment(formulaPreset, report),
          "Buyer interim payment at " + parametersLabel(parameters) +
            ", report=" + report
        );
        assertClose(
          interimValue(legacyInterim.sellerAllocation, report),
          formula.sellerInterimAllocation(formulaPreset, report),
          "Seller interim allocation at " + parametersLabel(parameters) +
            ", report=" + report
        );
        assertClose(
          interimValue(legacyInterim.sellerPayment, report),
          formula.sellerInterimPayment(formulaPreset, report),
          "Seller interim payment at " + parametersLabel(parameters) +
            ", report=" + report
        );
        trueValues.forEach(function (trueValue) {
          assertClose(
            legacy.buyerInterimDeviationUtility(
              legacyInterim, trueValue, report
            ),
            formula.buyerInterimDeviationUtility(
              formulaPreset, trueValue, report
            ),
            "Buyer deviation utility at " + parametersLabel(parameters) +
              ", value=" + trueValue + ", report=" + report
          );
          assertClose(
            legacy.sellerInterimDeviationUtility(
              legacyInterim, trueValue, report
            ),
            formula.sellerInterimDeviationUtility(
              formulaPreset, trueValue, report
            ),
            "Seller deviation utility at " + parametersLabel(parameters) +
              ", cost=" + trueValue + ", report=" + report
          );
        });
      }

      var formulaTotals = formula.exAnteIntegrals(formulaPreset);
      var legacyTotals = legacyExpectedValues(legacyPreset);
      Object.keys(formulaTotals).forEach(function (key) {
        assertClose(
          legacyTotals[key], formulaTotals[key],
          "Ex-ante " + key + " at " + parametersLabel(parameters),
          integralTolerance
        );
      });
    });
  });

  test("Buyer BIC, best reports, and the internal residual agree economically", function () {
    var trueValues = [0, 0.13, 0.37, 0.61, 0.89, 1];
    diagnosticCases.forEach(function (parameters) {
      var formulaPreset = formulaRule(parameters);
      var legacyPreset = legacyRule(parameters);
      var legacySummary = legacy.summarize(legacyPreset);
      var formulaDiagnostic = formula.buyerIcDiagnostics(formulaPreset);
      var formulaSellerDiagnostic = formula.sellerIcDiagnostics(formulaPreset);
      var legacyResidual = legacySummary.bic.buyer.payment;
      assert(formulaDiagnostic.holds ===
        legacySummary.verdicts.buyerBic,
      "Buyer-BIC verdicts should agree at " + parametersLabel(parameters) + ".");
      assert(formulaDiagnostic.envelopeResidual.holds ===
        legacyResidual.holds,
      "Envelope-payment verdicts should agree at " +
        parametersLabel(parameters) + ".");
      assert(formulaSellerDiagnostic.holds ===
        legacySummary.verdicts.sellerBic,
      "Seller-BIC verdicts should agree at " + parametersLabel(parameters) + ".");
      assert(formulaSellerDiagnostic.envelopeResidual.holds ===
        legacySummary.bic.seller.payment.holds,
      "Seller envelope-payment verdicts should agree at " +
        parametersLabel(parameters) + ".");
      assertClose(
        legacySummary.deviation.buyer.range.min,
        formulaDiagnostic.range.min,
        "Buyer deviation minimum at " + parametersLabel(parameters),
        pointTolerance
      );
      assertClose(
        legacySummary.deviation.buyer.range.max,
        formulaDiagnostic.range.max,
        "Buyer deviation maximum at " + parametersLabel(parameters),
        pointTolerance
      );
      assertClose(
        legacySummary.deviation.seller.range.min,
        formulaSellerDiagnostic.range.min,
        "Seller deviation minimum at " + parametersLabel(parameters),
        pointTolerance
      );
      assertClose(
        legacySummary.deviation.seller.range.max,
        formulaSellerDiagnostic.range.max,
        "Seller deviation maximum at " + parametersLabel(parameters),
        pointTolerance
      );

      var formulaTotals = formula.exAnteIntegrals(formulaPreset);
      assertClose(
        legacySummary.verdicts.tradeProbability,
        formulaTotals.tradeProbability,
        "Legacy summary trade probability at " +
          parametersLabel(parameters),
        integralTolerance
      );
      assertClose(
        legacySummary.verdicts.welfare,
        formulaTotals.welfare,
        "Legacy summary welfare at " + parametersLabel(parameters),
        integralTolerance
      );
      assertClose(
        legacySummary.verdicts.expectedBuyerPayoff,
        formulaTotals.buyerUtility,
        "Legacy summary buyer payoff at " +
          parametersLabel(parameters),
        integralTolerance
      );
      assertClose(
        legacySummary.verdicts.expectedSellerPayoff,
        formulaTotals.sellerUtility,
        "Legacy summary seller payoff at " +
          parametersLabel(parameters),
        integralTolerance
      );
      assertClose(
        legacySummary.verdicts.expectedRevenue,
        formulaTotals.revenue,
        "Legacy summary revenue at " + parametersLabel(parameters),
        integralTolerance
      );

      if (parameters.t < 1) {
        var formulaRanges = {
          q: formula.fieldRange(formulaPreset, "q"),
          pB: formula.fieldRange(formulaPreset, "pB"),
          pS: formula.fieldRange(formulaPreset, "pS")
        };
        var legacyQRange = scalarGridRange(legacyPreset.q);
        assertClose(legacyQRange.min, formulaRanges.q.min,
          "Allocation range minimum at " + parametersLabel(parameters));
        assertClose(legacyQRange.max, formulaRanges.q.max,
          "Allocation range maximum at " + parametersLabel(parameters));
        assertClose(
          legacySummary.paymentRange.buyer.min,
          formulaRanges.pB.min,
          "Buyer-payment range minimum at " + parametersLabel(parameters)
        );
        assertClose(
          legacySummary.paymentRange.buyer.max,
          formulaRanges.pB.max,
          "Buyer-payment range maximum at " + parametersLabel(parameters)
        );
        assertClose(
          legacySummary.paymentRange.seller.min,
          formulaRanges.pS.min,
          "Seller-payment range minimum at " + parametersLabel(parameters)
        );
        assertClose(
          legacySummary.paymentRange.seller.max,
          formulaRanges.pS.max,
          "Seller-payment range maximum at " + parametersLabel(parameters)
        );
      }

      trueValues.concat([formulaDiagnostic.worstTrueValue])
        .forEach(function (trueValue) {
          var formulaResponse = formula.buyerBestReport(
            formulaPreset, trueValue
          );
          var legacyResponse = legacy.buyerBestInterimReport(
            legacySummary.interim, trueValue
          );
          assertClose(
            legacyResponse.report, formulaResponse.report,
            "Buyer best report at " + parametersLabel(parameters) +
              ", value=" + trueValue,
            pointTolerance
          );
          assertClose(
            legacyResponse.utility, formulaResponse.utility,
            "Buyer maximum utility at " + parametersLabel(parameters) +
              ", value=" + trueValue,
            pointTolerance
          );
          assertClose(
            legacyResponse.truthfulUtility,
            formulaResponse.truthfulUtility,
            "Buyer truthful utility at " + parametersLabel(parameters) +
              ", value=" + trueValue,
            pointTolerance
          );
          assertClose(
            legacyResponse.gain, formulaResponse.maximumGain,
            "Buyer deviation gain at " + parametersLabel(parameters) +
              ", value=" + trueValue,
            pointTolerance
          );
        });

      trueValues.concat([formulaSellerDiagnostic.worstTrueCost])
        .forEach(function (trueCost) {
          var formulaResponse = formula.sellerBestReport(
            formulaPreset, trueCost
          );
          var legacyResponse = legacy.sellerBestInterimReport(
            legacySummary.interim, trueCost
          );
          assertClose(
            legacyResponse.report, formulaResponse.report,
            "Seller best report at " + parametersLabel(parameters) +
              ", cost=" + trueCost,
            pointTolerance
          );
          assertClose(
            legacyResponse.utility, formulaResponse.utility,
            "Seller maximum utility at " + parametersLabel(parameters) +
              ", cost=" + trueCost,
            pointTolerance
          );
          assertClose(
            legacyResponse.truthfulUtility,
            formulaResponse.truthfulUtility,
            "Seller truthful utility at " + parametersLabel(parameters) +
              ", cost=" + trueCost,
            pointTolerance
          );
          assertClose(
            legacyResponse.gain, formulaResponse.maximumGain,
            "Seller deviation gain at " + parametersLabel(parameters) +
              ", cost=" + trueCost,
            pointTolerance
          );
        });

      var legacyWorst = legacy.buyerBestInterimReport(
        legacySummary.interim, formulaDiagnostic.worstTrueValue
      );
      assertClose(
        legacyWorst.gain, formulaDiagnostic.maximumGain,
        "Maximum buyer deviation gain at " + parametersLabel(parameters),
        pointTolerance
      );
      var legacySellerWorst = legacy.sellerBestInterimReport(
        legacySummary.interim, formulaSellerDiagnostic.worstTrueCost
      );
      assertClose(
        legacySellerWorst.gain, formulaSellerDiagnostic.maximumGain,
        "Maximum seller deviation gain at " + parametersLabel(parameters),
        pointTolerance
      );
    });
  });

  test("All six diagnostic ranges and verdicts agree away from endpoint-only differences", function () {
    parameterCases.filter(function (parameters) {
      return parameters.t < 1;
    }).forEach(function (parameters) {
      var formulaSummary = formula.summarize(formulaRule(parameters));
      var legacySummary = legacy.summarize(legacyRule(parameters));
      [
        [formulaSummary.ranges.buyerPayoff,
          legacySummary.ir.exPost.buyerRange, "buyer payoff"],
        [formulaSummary.ranges.sellerPayoff,
          legacySummary.ir.exPost.sellerRange, "seller payoff"],
        [formulaSummary.ranges.revenue,
          { min: legacySummary.verdicts.minRevenue,
            max: legacySummary.verdicts.maxRevenue }, "revenue"],
        [formulaSummary.interimPayoffRanges.buyer,
          legacySummary.ir.interim.buyerRange, "buyer interim payoff"],
        [formulaSummary.interimPayoffRanges.seller,
          legacySummary.ir.interim.sellerRange, "seller interim payoff"]
      ].forEach(function (comparison) {
        assertClose(comparison[0].min, comparison[1].min,
          comparison[2] + " minimum at " + parametersLabel(parameters),
          pointTolerance);
        assertClose(comparison[0].max, comparison[1].max,
          comparison[2] + " maximum at " + parametersLabel(parameters),
          pointTolerance);
      });
      [
        "buyerBic", "sellerBic", "buyerDsic", "sellerDsic",
        "exAnteBuyerIr", "interimBuyerIr", "exPostBuyerIr",
        "exAnteSellerIr", "interimSellerIr", "exPostSellerIr",
        "exPostBudgetBalanced", "exPostNoDeficit",
        "expectedBudgetBalanced", "expectedNoDeficit"
      ].forEach(function (key) {
        assert(formulaSummary.verdicts[key] === legacySummary.verdicts[key],
          key + " differs at " + parametersLabel(parameters) + ".");
      });
      assertClose(
        formulaSummary.verdicts.efficiencyLoss,
        legacySummary.verdicts.efficiencyLoss,
        "Efficiency loss at " + parametersLabel(parameters),
        integralTolerance
      );
    });
  });

  test("All six default formula presets match legacy fields and exact diagnostics", function () {
    var resolution = legacy.CELL_RESOLUTION;
    var reports = [0, 0.13, 0.37, 0.61, 0.89, 1];
    presetCases.forEach(function (presetCase) {
      var formulaPreset = presetCase.formulaRule();
      var legacyPreset = presetCase.legacyRule();
      var formulaSummary = formula.summarize(formulaPreset);
      var legacySummary = legacy.summarize(legacyPreset);
      var payoffPatches = envelope.truthfulPayoffPatches(legacyPreset);
      var revenuePatches = envelope.revenuePatches(legacyPreset);
      var evaluators = {
        q: formula.fieldEvaluator(formulaPreset, "q"),
        pB: formula.fieldEvaluator(formulaPreset, "pB"),
        pS: formula.fieldEvaluator(formulaPreset, "pS"),
        buyerPayoff: formula.diagnosticEvaluator(
          formulaPreset, "buyerPayoff"
        ),
        sellerPayoff: formula.diagnosticEvaluator(
          formulaPreset, "sellerPayoff"
        ),
        revenue: formula.diagnosticEvaluator(formulaPreset, "revenue")
      };
      ["lower", "upper"].forEach(function (side) {
        var isLower = side === "lower";
        var i;
        var j;
        for (i = 0; i < resolution; i += 1) {
          for (j = 0; j < resolution; j += 1) {
            var point = legacy.triangleCentroid(i, j, isLower);
            assertClose(
              evaluators.q(point.v, point.c),
              legacyPreset.q[side][i][j],
              presetCase.name + " allocation at (" + i + "," + j + ")"
            );
            assertClose(
              evaluators.pB(point.v, point.c),
              legacy.evaluatePatch(
                legacyPreset.pB[side][i][j], point.v, point.c
              ),
              presetCase.name + " buyer payment at (" + i + "," + j + ")"
            );
            assertClose(
              evaluators.pS(point.v, point.c),
              legacy.evaluatePatch(
                legacyPreset.pS[side][i][j], point.v, point.c
              ),
              presetCase.name + " seller payment at (" + i + "," + j + ")"
            );
            assertClose(
              evaluators.buyerPayoff(point.v, point.c),
              legacy.evaluatePatch(
                payoffPatches.buyer[side][i][j], point.v, point.c
              ),
              presetCase.name + " buyer payoff at (" + i + "," + j + ")"
            );
            assertClose(
              evaluators.sellerPayoff(point.v, point.c),
              legacy.evaluatePatch(
                payoffPatches.seller[side][i][j], point.v, point.c
              ),
              presetCase.name + " seller payoff at (" + i + "," + j + ")"
            );
            assertClose(
              evaluators.revenue(point.v, point.c),
              legacy.evaluatePatch(
                revenuePatches[side][i][j], point.v, point.c
              ),
              presetCase.name + " revenue at (" + i + "," + j + ")"
            );
          }
        }
      });
      reports.forEach(function (report) {
        assertClose(
          formula.buyerInterimAllocation(formulaPreset, report),
          interimValue(legacySummary.interim.buyerAllocation, report),
          presetCase.name + " buyer interim allocation at " + report
        );
        assertClose(
          formula.buyerInterimPayment(formulaPreset, report),
          interimValue(legacySummary.interim.buyerPayment, report),
          presetCase.name + " buyer interim payment at " + report
        );
        assertClose(
          formula.sellerInterimAllocation(formulaPreset, report),
          interimValue(legacySummary.interim.sellerAllocation, report),
          presetCase.name + " seller interim allocation at " + report
        );
        assertClose(
          formula.sellerInterimPayment(formulaPreset, report),
          interimValue(legacySummary.interim.sellerPayment, report),
          presetCase.name + " seller interim payment at " + report
        );
        var formulaBuyerBest = formula.buyerBestReport(
          formulaPreset, report
        );
        var legacyBuyerBest = legacy.buyerBestInterimReport(
          legacySummary.interim, report
        );
        assertClose(
          formulaBuyerBest.maximumGain, legacyBuyerBest.gain,
          presetCase.name + " buyer deviation gain at " + report
        );
        var formulaSellerBest = formula.sellerBestReport(
          formulaPreset, report
        );
        var legacySellerBest = legacy.sellerBestInterimReport(
          legacySummary.interim, report
        );
        assertClose(
          formulaSellerBest.maximumGain, legacySellerBest.gain,
          presetCase.name + " seller deviation gain at " + report
        );
      });
      var formulaTotals = formula.exAnteIntegrals(formulaPreset);
      var legacyTotals = legacyExpectedValues(legacyPreset);
      Object.keys(formulaTotals).forEach(function (key) {
        assertClose(
          formulaTotals[key], legacyTotals[key],
          presetCase.name + " ex-ante " + key,
          integralTolerance
        );
      });
      [
        [formulaSummary.ranges.pB,
          legacySummary.paymentRange.buyer, "buyer payment"],
        [formulaSummary.ranges.pS,
          legacySummary.paymentRange.seller, "seller payment"],
        [formulaSummary.ranges.buyerPayoff,
          legacySummary.ir.exPost.buyerRange, "buyer payoff"],
        [formulaSummary.ranges.sellerPayoff,
          legacySummary.ir.exPost.sellerRange, "seller payoff"],
        [formulaSummary.ranges.revenue,
          { min: legacySummary.verdicts.minRevenue,
            max: legacySummary.verdicts.maxRevenue }, "revenue"]
      ].forEach(function (comparison) {
        assertClose(comparison[0].min, comparison[1].min,
          presetCase.name + " " + comparison[2] + " minimum");
        assertClose(comparison[0].max, comparison[1].max,
          presetCase.name + " " + comparison[2] + " maximum");
      });
      [
        "buyerBic", "sellerBic", "buyerDsic", "sellerDsic",
        "exAnteBuyerIr", "interimBuyerIr", "exPostBuyerIr",
        "exAnteSellerIr", "interimSellerIr", "exPostSellerIr",
        "exPostBudgetBalanced", "exPostNoDeficit",
        "expectedBudgetBalanced", "expectedNoDeficit"
      ].forEach(function (key) {
        assert(formulaSummary.verdicts[key] === legacySummary.verdicts[key],
          presetCase.name + " " + key + " verdict differs.");
      });
    });
  });

  test("Formula equality and mesh endpoint ownership are classified separately", function () {
    var ordinaryParameters = { t: 0.5, alpha: 0.4, beta: 0.6 };
    var ordinaryFormula = formulaRule(ordinaryParameters);
    var ordinaryLegacy = legacyRule(ordinaryParameters);
    var interiorEqualityFormula = formula.ruleValuesAt(
      ordinaryFormula, 0.75, 0.25
    );
    var interiorEqualityLegacy = legacy.ruleValuesAt(
      ordinaryLegacy, 0.75, 0.25
    );
    assert(interiorEqualityFormula.q === 1 &&
      interiorEqualityLegacy.q === 1,
    "An ordinary interior equality point should trade in both representations.");
    assertClose(interiorEqualityLegacy.pB, interiorEqualityFormula.pB,
      "Interior equality buyer payment");
    assertClose(interiorEqualityLegacy.pS, interiorEqualityFormula.pS,
      "Interior equality seller payment");

    var thresholdStep;
    for (thresholdStep = 1;
        thresholdStep <= legacy.CELL_RESOLUTION;
        thresholdStep += 1) {
      var threshold = thresholdStep / legacy.CELL_RESOLUTION;
      var formulaEndpoint = formula.ruleValuesAt(
        formula.createRevenueThresholdRule(threshold, 0.4, 0.6),
        1,
        1 - threshold
      );
      var legacyGrid = legacy.chatterjeeSamuelsonGrid(threshold);
      var topCostCell = legacy.CELL_RESOLUTION - thresholdStep;
      assert(formulaEndpoint.q === 1,
        "Every decimal-complement top point should satisfy formula equality.");
      assert(legacyGrid.lower[legacy.CELL_RESOLUTION - 1][topCostCell] === 0 &&
        legacyGrid.upper[legacy.CELL_RESOLUTION - 1][topCostCell] === 0,
      "The legacy cell above a positive-threshold top endpoint should not trade.");
    }

    [
      { t: 0.25, alpha: 0.4, beta: 0.6 },
      ordinaryParameters,
      { t: 0.75, alpha: 0.4, beta: 0.6 },
      { t: 1, alpha: 0.3, beta: 0.2 }
    ].forEach(function (parameters) {
      var c = 1 - parameters.t;
      var formulaEndpoint = formula.ruleValuesAt(
        formulaRule(parameters), 1, c
      );
      var legacyEndpoint = legacy.ruleValuesAt(
        legacyRule(parameters), 1, c
      );
      assert(formulaEndpoint.q === 1,
        "The literal formula should trade at its top equality endpoint.");
      assert(legacyEndpoint.q === 0,
        "The legacy point convention should omit the named top endpoint.");
      assert(legacyEndpoint.pB === 0 && legacyEndpoint.pS === 0,
        "The omitted legacy endpoint should carry no transfers.");
    });

    var zeroParameters = { t: 0, alpha: 0.4, beta: 0.6 };
    assert(formula.ruleValuesAt(formulaRule(zeroParameters), 1, 1).q === 1 &&
      legacy.ruleValuesAt(legacyRule(zeroParameters), 1, 1).q === 1,
    "The t=0 top equality endpoint should agree.");

    var endpointFormula = formula.exAnteIntegrals(
      formulaRule({ t: 1, alpha: 0.3, beta: 0.2 })
    );
    var endpointLegacyRule = legacyRule(
      { t: 1, alpha: 0.3, beta: 0.2 }
    );
    var endpointLegacy = legacyExpectedValues(endpointLegacyRule);
    var endpointFormulaSummary = formula.summarize(
      formulaRule({ t: 1, alpha: 0.3, beta: 0.2 })
    );
    var endpointLegacySummary = legacy.summarize(
      endpointLegacyRule
    );
    var endpointLegacyQRange = scalarGridRange(
      endpointLegacyRule.q
    );
    assertClose(endpointFormula.tradeProbability, 0,
      "Formula t=1 trade probability");
    assertClose(endpointLegacy.tradeProbability, 0,
      "Legacy t=1 trade probability");
    assertClose(endpointFormula.revenue, endpointLegacy.revenue,
      "Expected revenue despite the endpoint difference", integralTolerance);
    assert(endpointFormulaSummary.ranges.q.max === 1 &&
      endpointLegacyQRange.max === 0,
    "The t=1 allocation ranges should retain the named pointwise difference.");
    assertClose(endpointFormulaSummary.ranges.pB.max, 0.3,
      "Formula t=1 buyer-payment maximum");
    assertClose(endpointLegacySummary.paymentRange.buyer.max, 0,
      "Legacy t=1 buyer-payment maximum");
    assertClose(endpointFormulaSummary.ranges.pS.max, 0.8,
      "Formula t=1 seller-payment maximum");
    assertClose(endpointLegacySummary.paymentRange.seller.max, 0,
      "Legacy t=1 seller-payment maximum");
    assert(!endpointFormulaSummary.verdicts.buyerDsic &&
      !endpointFormulaSummary.verdicts.sellerDsic &&
      endpointLegacySummary.verdicts.buyerDsic &&
      endpointLegacySummary.verdicts.sellerDsic,
    "The literal formula point should preserve DSIC failures omitted by the grid.");
    assert(!endpointFormulaSummary.verdicts.exPostBudgetBalanced &&
      !endpointFormulaSummary.verdicts.exPostNoDeficit &&
      endpointLegacySummary.verdicts.exPostBudgetBalanced &&
      endpointLegacySummary.verdicts.exPostNoDeficit,
    "The literal endpoint deficit should remain distinct from the empty grid.");
    assert(endpointFormulaSummary.verdicts.expectedBudgetBalanced ===
      endpointLegacySummary.verdicts.expectedBudgetBalanced &&
      endpointFormulaSummary.verdicts.expectedNoDeficit ===
      endpointLegacySummary.verdicts.expectedNoDeficit,
    "The zero-measure endpoint should not change expected budget verdicts.");
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
      " Bargaining sandbox parity tests passed.";
    document.body.dataset.status = allPassed ? "passed" : "failed";
    document.title = (allPassed ? "PASS" : "FAIL") +
      " — Bargaining Mechanism Sandbox parity tests";
  }
}());
