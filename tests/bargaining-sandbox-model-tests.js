(function () {
  "use strict";

  var model = window.BargainingSandboxModel;
  var tests = [];
  var tolerance = 1e-10;

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

  function assertFiniteNumbers(value, path) {
    if (typeof value === "number") {
      assert(Number.isFinite(value), path + " should be finite.");
      return;
    }
    if (!value || typeof value !== "object") {
      return;
    }
    Object.keys(value).forEach(function (key) {
      assertFiniteNumbers(value[key], path + "." + key);
    });
  }

  test("The preset exposes two formula regions and no triangle-grid arrays", function () {
    var rule = model.createRevenueThresholdRule();
    assert(model && typeof model.summarize === "function",
      "BargainingSandboxModel should load.");
    assert(rule.representation === "formula-regions",
      "The preset should identify its formula-region representation.");
    assert(rule.family === "revenue-threshold",
      "The preset should identify its analytic family.");
    assert(rule.regions.length === 2,
      "The rule should contain one trade and one no-trade region.");
    assert(rule.q === undefined && rule.pB === undefined && rule.pS === undefined,
      "The formula preset should not expose production-style field grids.");
    assert(!rule.regions.some(function (region) {
      return region.fields.q && region.fields.q.lower ||
        region.fields.pB && region.fields.pB.lower ||
        region.fields.pS && region.fields.pS.lower;
    }), "No formula field should contain lower/upper triangle arrays.");
    assert(Object.isFrozen(rule) && Object.isFrozen(rule.regions) &&
      Object.isFrozen(rule.regions[1].fields.pB),
    "The formula rule and polynomial data should be immutable.");
  });

  test("Point evaluators return exact trade and no-trade values", function () {
    var rule = model.createRevenueThresholdRule(0.4, 0.3, 0.2);
    var trade = model.ruleValuesAt(rule, 0.9, 0.2);
    var noTrade = model.ruleValuesAt(rule, 0.5, 0.2);
    assert(trade.region === "trade" && trade.q === 1,
      "A report pair above the threshold should trade.");
    assertClose(trade.pB, 0.5, "Buyer payment on trade");
    assertClose(trade.pS, 0.7, "Seller payment on trade");
    assert(noTrade.region === "no-trade" && noTrade.q === 0,
      "A report pair below the threshold should not trade.");
    assertClose(noTrade.pB, 0, "Buyer payment without trade");
    assertClose(noTrade.pS, 0, "Seller payment without trade");
  });

  test("Literal weak threshold equality trades at an interior parameter value", function () {
    var rule = model.createRevenueThresholdRule(0.4, 0.3, 0.2);
    var equality = model.ruleValuesAt(rule, 0.65, 0.25);
    assert(equality.region === "trade" && equality.q === 1,
      "The equality boundary should belong to the trade region.");
    assertClose(equality.pB, 0.55, "Boundary buyer payment");
    assertClose(equality.pS, 0.45, "Boundary seller payment");
    var decimalComplement = model.ruleValuesAt(
      model.createRevenueThresholdRule(0.08, 0.3, 0.2),
      1,
      1 - 0.08
    );
    assert(decimalComplement.q === 1,
      "Algebra-scale floating residue should preserve weak equality.");
    assert(model.ruleValuesAt(
      model.createRevenueThresholdRule(0.08, 0.3, 0.2),
      1,
      1 - 0.08 + 5e-13
    ).q === 0, "The equality normalization must not absorb a strict gap.");
  });

  test("Buyer interim allocation and payment use the stated formulas", function () {
    var rule = model.createRevenueThresholdRule(0.4, 0.3, 0.2);
    assertClose(model.buyerInterimAllocation(rule, 0.2), 0,
      "Allocation below the threshold");
    assertClose(model.buyerInterimPayment(rule, 0.2), 0,
      "Payment below the threshold");
    assertClose(model.buyerInterimAllocation(rule, 0.4), 0,
      "Allocation at the threshold");
    assertClose(model.buyerInterimPayment(rule, 0.4), 0,
      "Payment at the threshold");
    assertClose(model.buyerInterimAllocation(rule, 0.8), 0.4,
      "Allocation above the threshold");
    assertClose(model.buyerInterimPayment(rule, 0.8), 0.2,
      "Payment above the threshold");
    var interim = model.buyerInterimRule(rule);
    assertClose(interim.trade.allocation[0], -0.4,
      "Trade-segment allocation constant");
    assertClose(interim.trade.allocation[1], 1,
      "Trade-segment allocation slope");
    assertClose(interim.trade.payment[0], -0.04,
      "Trade-segment payment constant");
    assertClose(interim.trade.payment[1], -0.1,
      "Trade-segment payment slope");
    assertClose(interim.trade.payment[2], 0.5,
      "Trade-segment payment quadratic coefficient");
  });

  test("Buyer envelope residual detects only the nonconstant payment component", function () {
    var truthful = model.buyerIcDiagnostics(
      model.createRevenueThresholdRule(0.4, 0.4, 0.2)
    );
    assert(truthful.envelopeResidual.holds,
      "The truthful payment should satisfy the envelope identity.");
    assertClose(truthful.envelopeResidual.referenceResidual, 0,
      "Truthful envelope residual constant");
    assertClose(truthful.envelopeResidual.maxViolation, 0,
      "Truthful envelope residual violation");

    var offFamily = model.buyerIcDiagnostics(
      model.createRevenueThresholdRule(0.4, 0.3, 0.2)
    );
    var tradeResidual = offFamily.envelopeResidual.residualPieces[1].coefficients;
    assert(!offFamily.envelopeResidual.holds,
      "An off-family payment should fail the envelope identity.");
    assertClose(tradeResidual[0], 0.04,
      "Off-family residual constant coefficient");
    assertClose(tradeResidual[1], -0.1,
      "Off-family residual slope");
    assertClose(offFamily.envelopeResidual.bounds.infimum, -0.06,
      "Off-family residual infimum");
    assertClose(offFamily.envelopeResidual.bounds.supremum, 0,
      "Off-family residual supremum");
    assertClose(offFamily.envelopeResidual.maxViolation, 0.06,
      "Off-family maximum nonconstant residual");

    var toleranceTie = model.buyerIcDiagnostics(
      model.createRevenueThresholdRule(0.5, 0.5002, 0.5)
    );
    assert(toleranceTie.holds && !toleranceTie.envelopeResidual.holds,
      "The internal residual must not replace the utility-gain verdict.");
  });

  test("Buyer envelope residual permits a payment constant and a singleton piece", function () {
    function shiftedPieces(rule, constant) {
      var interim = model.buyerInterimRule(rule);
      return [interim.noTrade, interim.trade].map(function (piece) {
        var payment = piece.payment.slice();
        payment[0] += constant;
        return {
          lower: piece.lower,
          upper: piece.upper,
          lowerClosed: piece.lowerClosed !== false,
          upperClosed: piece.upperClosed !== false,
          allocation: piece.allocation.slice(),
          payment: payment
        };
      });
    }

    var constant = 0.37;
    var truthful = model.checkBuyerEnvelopeResidual(
      shiftedPieces(
        model.createRevenueThresholdRule(0.4, 0.4, 0.2),
        constant
      )
    );
    assert(truthful.holds,
      "A type-independent payment constant should remain envelope-compatible.");
    assertClose(truthful.referenceResidual, constant,
      "Permitted envelope residual constant");
    assertClose(truthful.maxViolation, 0,
      "Constant-shift residual violation");

    var offFamily = model.checkBuyerEnvelopeResidual(
      shiftedPieces(
        model.createRevenueThresholdRule(0.4, 0.3, 0.2),
        constant
      )
    );
    assert(!offFamily.holds,
      "A common constant must not conceal a varying envelope residual.");
    assertClose(offFamily.referenceResidual, constant,
      "Shifted off-family residual constant");
    assertClose(offFamily.bounds.infimum, constant - 0.06,
      "Shifted off-family residual infimum");
    assertClose(offFamily.bounds.supremum, constant,
      "Shifted off-family residual supremum");
    assertClose(offFamily.maxViolation, 0.06,
      "Shifted off-family maximum violation");

    var endpoint = model.buyerIcDiagnostics(
      model.createRevenueThresholdRule(1, 0.3, 0.2)
    ).envelopeResidual;
    assert(endpoint.holds,
      "The t=1 singleton should satisfy the interim envelope identity.");
    assertClose(endpoint.maxViolation, 0,
      "The singleton residual violation");
    assert(Math.abs(endpoint.residualPieces[1].coefficients[1]) > 0,
      "The singleton characterization should not discard its symbolic slope.");

    var tinyInteriorDeviation = model.checkBuyerEnvelopeResidual([{
      lower: 0,
      upper: 1,
      lowerClosed: true,
      upperClosed: true,
      allocation: [0],
      payment: [0, 5e-13, -5e-13]
    }], 0);
    assert(!tinyInteriorDeviation.holds,
      "A zero-tolerance check should retain a tiny interior residual.");
    assertClose(tinyInteriorDeviation.maxViolation, 1.25e-13,
      "Tiny interior residual maximum", 1e-20);
  });

  test("Buyer envelope residual requires exact and unique piece ownership", function () {
    function piece(lower, upper, lowerClosed, upperClosed) {
      return {
        lower: lower,
        upper: upper,
        lowerClosed: lowerClosed,
        upperClosed: upperClosed,
        allocation: [0],
        payment: [0]
      };
    }

    function rejects(pieces) {
      try {
        model.checkBuyerEnvelopeResidual(pieces);
      } catch (error) {
        return error instanceof RangeError;
      }
      return false;
    }

    assert(rejects([piece(0, 1, false, true)]),
      "The first report cannot be left unowned.");
    assert(rejects([piece(0, 1, true, false)]),
      "The last report cannot be left unowned.");
    assert(rejects([
      piece(0, 0.5, true, false),
      piece(0.5, 1, false, true)
    ]), "Adjacent open pieces cannot leave a breakpoint unowned.");
    assert(rejects([
      piece(0, 0.5, true, true),
      piece(0.5, 1, true, true)
    ]), "Adjacent closed pieces cannot own one breakpoint twice.");
    assert(rejects([
      piece(0, 0.5, true, false),
      piece(0.5 + 5e-13, 1, true, true)
    ]), "An algebra-scale gap cannot be silently accepted.");
    assert(rejects([
      piece(0, 0.5, true, false),
      piece(0.5 - 5e-13, 1, true, true)
    ]), "An algebra-scale overlap cannot be silently accepted.");
  });

  test("Buyer deviation utility is exact below, at, and above the threshold", function () {
    var rule = model.createRevenueThresholdRule(0.4, 0.3, 0.2);
    assertClose(model.buyerInterimDeviationUtility(rule, 0.7, 0.2), 0,
      "Utility below threshold");
    assertClose(model.buyerInterimDeviationUtility(rule, 0.7, 0.4), 0,
      "Utility at threshold");
    assertClose(model.buyerInterimDeviationUtility(rule, 0.7, 0.8), 0.08,
      "Utility above threshold");
  });

  test("Seller interim allocation, receipt, and deviation utility use the mirrored formulas", function () {
    var rule = model.createRevenueThresholdRule(0.4, 0.3, 0.2);
    var interim = model.sellerInterimRule(rule);
    assertClose(model.sellerInterimAllocation(rule, 0.8), 0,
      "Seller allocation above the active report interval");
    assertClose(model.sellerInterimAllocation(rule, 0.6), 0,
      "Seller allocation at the active-interval endpoint");
    assertClose(model.sellerInterimAllocation(rule, 0.2), 0.4,
      "Seller allocation inside the active report interval");
    assertClose(model.sellerInterimPayment(rule, 0.2), 0.24,
      "Seller interim receipt");
    assertClose(model.sellerInterimDeviationUtility(rule, 0.3, 0.2), 0.12,
      "Seller interim deviation utility");
    assertClose(
      model.sellerInterimAllocation(rule, 0.2),
      interim.trade.allocation[0] + interim.trade.allocation[1] * 0.2,
      "Seller interim allocation polynomial"
    );
    assertClose(
      model.sellerInterimPayment(rule, 0.2),
      interim.trade.payment[0] + interim.trade.payment[1] * 0.2 +
        interim.trade.payment[2] * 0.2 * 0.2,
      "Seller interim payment polynomial"
    );
  });

  test("Buyer best reports are truthful throughout the alpha equals t family", function () {
    var rule = model.createRevenueThresholdRule(0.5, 0.5, 0.1);
    [0, 0.2, 0.5, 0.8, 1].forEach(function (trueValue) {
      var response = model.buyerBestReport(rule, trueValue);
      assertClose(response.report, trueValue,
        "Truthful best report at value " + trueValue);
      assertClose(response.maximumGain, 0,
        "Truthful maximum gain at value " + trueValue);
    });
    assert(model.buyerIcDiagnostics(rule).holds,
      "The exact buyer-BIC verdict should pass when alpha equals t.");
  });

  test("Buyer best reports use analytic stationary points off the IC family", function () {
    var lowMarkup = model.createRevenueThresholdRule(0.5, 0.25, 0.5);
    var highMarkup = model.createRevenueThresholdRule(0.5, 0.75, 0.5);
    var upward = model.buyerBestReport(lowMarkup, 0.6);
    var downward = model.buyerBestReport(highMarkup, 0.8);
    assertClose(upward.report, 0.85, "Low-markup best report");
    assertClose(upward.maximumGain, 0.03125, "Low-markup deviation gain");
    assertClose(downward.report, 0.55, "High-markup best report");
    assertClose(downward.maximumGain, 0.03125, "High-markup deviation gain");
    assert(!model.buyerIcDiagnostics(lowMarkup).holds &&
      !model.buyerIcDiagnostics(highMarkup).holds,
    "Both deliberately off-family rules should fail buyer BIC.");
  });

  test("Best-report traces use exact analytic segments and separate jumps", function () {
    var lowMarkup = model.createRevenueThresholdRule(0.5, 0.25, 0.5);
    var lowTrace = model.buyerBestReportTrace(lowMarkup);
    assert(lowTrace.map(function (segment) {
      return segment.kind;
    }).join(" ") === "truthful stationary cap truthful",
    "The low-markup trace should expose all four analytic pieces.");
    var lowerSwitch = 0.25 + Math.sqrt(2 * model.VERDICT_TOLERANCE);
    var upperSwitch = 0.75 + Math.sqrt(
      0.25 * 0.25 - 2 * model.VERDICT_TOLERANCE
    );
    assertClose(lowTrace[0].points[1].trueValue, lowerSwitch,
      "Low-markup lower tie boundary");
    assertClose(lowTrace[1].points[0].trueValue, lowerSwitch,
      "Low-markup stationary right limit");
    assertClose(lowTrace[0].points[1].report, lowerSwitch,
      "Truthful report at the lower tie boundary");
    assertClose(lowTrace[1].points[0].report, 0.5 + lowerSwitch - 0.25,
      "Stationary report at the lower right limit");
    assert(!lowTrace[1].startClosed && !lowTrace[2].endClosed,
      "Discontinuous nontruthful pieces should expose their open limits.");
    assertClose(lowTrace[2].points[1].trueValue, upperSwitch,
      "Low-markup upper tie boundary");

    var highMarkup = model.createRevenueThresholdRule(0.5, 0.75, 0.5);
    var highTrace = model.buyerBestReportTrace(highMarkup);
    assert(highTrace.map(function (segment) {
      return segment.kind;
    }).join(" ") === "truthful no-trade stationary",
    "The high-markup trace should expose its three analytic pieces.");
    assert(!highTrace[1].startClosed && highTrace[1].endClosed,
      "The no-trade segment should begin after the tolerance tie and meet the stationary piece.");
    assertClose(highTrace[2].points[0].report, 0.5,
      "The high-markup stationary piece should meet the no-trade report.");
    assert(Object.isFrozen(lowTrace) && Object.isFrozen(lowTrace[0]) &&
      Object.isFrozen(lowTrace[0].points),
    "Exact trace geometry should be immutable formula data.");

    var tinyGainRule = model.createRevenueThresholdRule(0.5, 0.4999999, 0.5);
    var tinyGainResponse = model.buyerBestReport(tinyGainRule, 0.5, 0);
    var zeroToleranceTrace = model.buyerBestReportTrace(tinyGainRule, 0);
    assert(tinyGainResponse.maximumGain > 0 &&
      tinyGainResponse.report > 0.5 &&
      zeroToleranceTrace.length > 1,
    "Algebra tolerance should not erase a positive gain under a zero verdict tolerance.");
    var exactIcRule = model.createRevenueThresholdRule(0.06, 0.06, 0.5);
    var exactIcResponse = model.buyerBestReport(exactIcRule, 0.85, 0);
    assertClose(exactIcResponse.report, 0.85,
      "Exact alpha equals t report under zero tolerance");
    assert(exactIcResponse.maximumGain === 0 && exactIcResponse.truthfulTie,
      "Exact IC identity should not acquire a floating-point deviation gain.");
  });

  test("Seller best reports and traces mirror the buyer optimization exactly", function () {
    var truthful = model.createRevenueThresholdRule(0.5, 0.1, 0.5);
    [0, 0.2, 0.5, 0.8, 1].forEach(function (trueCost) {
      var response = model.sellerBestReport(truthful, trueCost);
      assertClose(response.report, trueCost,
        "Truthful seller report at cost " + trueCost);
      assertClose(response.maximumGain, 0,
        "Truthful seller gain at cost " + trueCost);
    });
    var lowDiscount = model.createRevenueThresholdRule(0.5, 0.5, 0.25);
    var highDiscount = model.createRevenueThresholdRule(0.5, 0.5, 0.75);
    var upwardQuantity = model.sellerBestReport(lowDiscount, 0.4);
    var downwardQuantity = model.sellerBestReport(highDiscount, 0.2);
    assertClose(upwardQuantity.report, 0.15, "Low-discount best seller report");
    assertClose(upwardQuantity.maximumGain, 0.03125,
      "Low-discount seller gain");
    assertClose(downwardQuantity.report, 0.45,
      "High-discount best seller report");
    assertClose(downwardQuantity.maximumGain, 0.03125,
      "High-discount seller gain");
    assert(model.sellerBestReportTrace(lowDiscount).map(function (segment) {
      return segment.kind;
    }).join(" ") === "truthful cap stationary truthful",
    "The low-discount seller trace should reverse the buyer-like pieces.");
    assert(model.sellerBestReportTrace(highDiscount).map(function (segment) {
      return segment.kind;
    }).join(" ") === "stationary no-trade truthful",
    "The high-discount seller trace should reverse the buyer-like pieces.");
    assert(model.sellerIcDiagnostics(truthful).envelopeResidual.holds &&
      !model.sellerIcDiagnostics(lowDiscount).envelopeResidual.holds,
    "The internal seller envelope residual should detect the mirrored payment identity.");
  });

  test("Truthful reporting wins displayed ties inside the verdict tolerance", function () {
    var rule = model.createRevenueThresholdRule(0.5, 0.5002, 0.5);
    var response = model.buyerBestReport(rule, 0.8);
    assert(response.maximumGain > 0 &&
      response.maximumGain < model.VERDICT_TOLERANCE,
    "The fixture should have a positive gain inside the verdict tolerance.");
    assert(response.truthfulTie,
      "The response should record the verdict-tolerance tie.");
    assertClose(response.report, 0.8,
      "The displayed report should remain on the truthful diagonal.");
    assert(model.buyerIcDiagnostics(rule).holds,
      "The exact verdict should apply the economic acceptance band.");
  });

  test("Exact ex-ante integrals and dependency keys follow formula parameters", function () {
    var baseline = model.createRevenueThresholdRule(0.5, 0.5, 0.5);
    var betaChange = model.createRevenueThresholdRule(0.5, 0.5, 0.2);
    var alphaChange = model.createRevenueThresholdRule(0.5, 0.2, 0.5);
    var totals = model.exAnteIntegrals(baseline);
    assertClose(totals.tradeProbability, 1 / 8, "Trade probability");
    assertClose(totals.welfare, 1 / 12, "Expected welfare");
    assertClose(totals.buyerPayment, 1 / 12, "Expected buyer payment");
    assertClose(totals.sellerPayment, 1 / 24, "Expected seller payment");
    assertClose(totals.revenue, 1 / 24, "Expected revenue");
    assert(model.dependencyKey(baseline, "q") ===
      model.dependencyKey(betaChange, "q"),
    "Beta should not enter the allocation dependency key.");
    assert(model.dependencyKey(baseline, "pB") ===
      model.dependencyKey(betaChange, "pB"),
    "Beta should not enter the buyer-payment dependency key.");
    assert(model.dependencyKey(baseline, "buyerIc") ===
      model.dependencyKey(betaChange, "buyerIc"),
    "Beta should not enter the buyer-IC dependency key.");
    assert(model.dependencyKey(baseline, "pS") !==
      model.dependencyKey(betaChange, "pS"),
    "Beta should enter the seller-payment dependency key.");
    assert(model.dependencyKey(baseline, "sellerIc") !==
      model.dependencyKey(betaChange, "sellerIc") &&
      model.dependencyKey(baseline, "sellerPayoff") !==
      model.dependencyKey(betaChange, "sellerPayoff"),
    "Beta should enter both seller diagnostic keys.");
    assert(model.dependencyKey(baseline, "buyerPayoff") ===
      model.dependencyKey(betaChange, "buyerPayoff") &&
      model.dependencyKey(baseline, "efficiency") ===
      model.dependencyKey(betaChange, "efficiency"),
    "Beta should not enter buyer-payoff or efficiency keys.");
    assert(model.dependencyKey(baseline, "revenue") !==
      model.dependencyKey(betaChange, "revenue") &&
      model.dependencyKey(baseline, "revenue") !==
      model.dependencyKey(alphaChange, "revenue"),
    "Both transfer parameters should enter the revenue key.");
  });

  test("Truthful payoff, revenue, and efficiency diagnostics use exact formula fields", function () {
    var rule = model.createRevenueThresholdRule(0.4, 0.3, 0.2);
    var payoffs = model.truthfulPayoffValuesAt(rule, 0.8, 0.2);
    var missingTrade = model.allocationErrorAt(rule, 0.3, 0.2);
    assertClose(payoffs.buyerPayoff, 0.3, "Buyer truthful payoff");
    assertClose(payoffs.sellerPayoff, 0.4, "Seller truthful payoff");
    assertClose(payoffs.revenue, -0.1, "Pointwise revenue");
    assert(missingTrade.q === 0 && missingTrade.efficient === 1 &&
      missingTrade.over === 0 && missingTrade.under === 1,
    "Efficiency should identify missing trade between the two boundaries.");
    assertClose(model.diagnosticValueAt(rule, "buyerPayoff", 0.8, 0.2), 0.3,
      "Buyer-payoff diagnostic evaluator");
    assertClose(model.diagnosticValueAt(rule, "sellerPayoff", 0.8, 0.2), 0.4,
      "Seller-payoff diagnostic evaluator");
    assertClose(model.diagnosticValueAt(rule, "revenue", 0.8, 0.2), -0.1,
      "Revenue diagnostic evaluator");
    assertClose(model.truthfulPayoffRange(rule, "buyer").min, 0,
      "Buyer payoff minimum");
    assertClose(model.truthfulPayoffRange(rule, "buyer").max, 0.7,
      "Buyer payoff maximum");
    assertClose(model.truthfulPayoffRange(rule, "seller").max, 0.8,
      "Seller payoff maximum");
    assertClose(model.revenueRange(rule).min, -0.5, "Revenue minimum");
    assertClose(model.revenueRange(rule).max, 0.1, "Revenue maximum");
    assertClose(model.interimTruthfulPayoffRange(rule, "buyer").max, 0.24,
      "Buyer interim payoff maximum");
    assertClose(model.interimTruthfulPayoffRange(rule, "seller").max, 0.3,
      "Seller interim payoff maximum");
  });

  test("The six-diagnostic summary reports exact IC, IR, budget, and efficiency verdicts", function () {
    var rule = model.createRevenueThresholdRule(0.4, 0.3, 0.2);
    var summary = model.summarize(rule);
    assert(!summary.verdicts.buyerBic && !summary.verdicts.sellerBic &&
      !summary.verdicts.buyerDsic && !summary.verdicts.sellerDsic,
    "Both off-family transfer parameters should fail BIC and DSIC.");
    assert(summary.verdicts.exAnteBuyerIr && summary.verdicts.interimBuyerIr &&
      summary.verdicts.exPostBuyerIr && summary.verdicts.exAnteSellerIr &&
      summary.verdicts.interimSellerIr && summary.verdicts.exPostSellerIr,
    "Both agents should satisfy all three IR notions in the positive-surplus fixture.");
    assert(!summary.verdicts.exPostBudgetBalanced &&
      !summary.verdicts.exPostNoDeficit &&
      !summary.verdicts.expectedBudgetBalanced &&
      !summary.verdicts.expectedNoDeficit,
    "The fixture should fail both ex-post and expected budget conditions.");
    assertClose(summary.verdicts.efficiencyLoss,
      0.5 * 0.4 * 0.4 - 0.4 * 0.4 * 0.4 / 3,
      "Threshold efficiency loss");
    var highBuyerCharge = model.summarize(
      model.createRevenueThresholdRule(0.4, 0.8, 0.2)
    );
    assert(!highBuyerCharge.verdicts.exAnteBuyerIr &&
      !highBuyerCharge.verdicts.interimBuyerIr &&
      !highBuyerCharge.verdicts.exPostBuyerIr,
    "A sufficiently high buyer charge should fail every buyer IR notion.");
  });

  test("All control endpoints produce finite formula and diagnostic results", function () {
    [0, 1].forEach(function (threshold) {
      [0, 1].forEach(function (buyerMarkup) {
        [0, 1].forEach(function (sellerDiscount) {
          var rule = model.createRevenueThresholdRule(
            threshold, buyerMarkup, sellerDiscount
          );
          [0, 1].forEach(function (trueValue) {
            [0, 1].forEach(function (report) {
              assertFiniteNumbers(
                model.ruleValuesAt(rule, trueValue, report),
                "ruleValuesAt"
              );
              assertFiniteNumbers(
                model.buyerBestReport(rule, trueValue),
                "buyerBestReport"
              );
              assertClose(
                model.buyerInterimDeviationUtility(rule, trueValue, report),
                model.buyerInterimDeviationUtility(rule, trueValue, report),
                "Finite deviation utility"
              );
              assertClose(
                model.sellerInterimDeviationUtility(rule, trueValue, report),
                model.sellerInterimDeviationUtility(rule, trueValue, report),
                "Finite seller deviation utility"
              );
              ["buyerIc", "sellerIc", "buyerPayoff", "sellerPayoff",
                "revenue", "efficiency"].forEach(function (field) {
                assertFiniteNumbers(
                  model.diagnosticValueAt(rule, field, trueValue, report),
                  "diagnosticValueAt." + field
                );
              });
            });
          });
          assertFiniteNumbers(model.summarize(rule), "summary");
        });
      });
    });
  });

  test("t equals one has literal point trade but zero interim and ex-ante trade", function () {
    var rule = model.createRevenueThresholdRule(1, 0.3, 0.2);
    var endpoint = model.ruleValuesAt(rule, 1, 0);
    assert(endpoint.q === 1 && endpoint.region === "trade",
      "The literal weak inequality should trade at (1,0).");
    assertClose(endpoint.pB, 0.3, "Endpoint buyer payment");
    assertClose(endpoint.pS, 0.8, "Endpoint seller payment");
    assert(model.ruleValuesAt(rule, 0.999, 0).q === 0 &&
      model.ruleValuesAt(rule, 1, 0.001).q === 0,
    "Every neighboring report pair should be outside the t=1 trade set.");
    assert(model.ruleValuesAt(rule, 1, Number.MIN_VALUE).q === 0,
      "No positive seller value may be rounded into the t=1 trade point.");
    assertClose(model.buyerInterimAllocation(rule, 1), 0,
      "The measure-zero trade point should not change interim allocation.");
    assertClose(model.exAnteIntegrals(rule).tradeProbability, 0,
      "The measure-zero trade point should not change trade probability.");
    assertClose(model.buyerMaximumDeviationGain(rule), 0,
      "The t=1 rule should have no buyer interim deviation gain.");
    assert(model.fieldRange(rule, "q").max === 1,
      "The ex-post allocation range should retain the literal endpoint value.");
    var summary = model.summarize(rule);
    assert(summary.verdicts.buyerBic && summary.verdicts.sellerBic,
      "Zero interim trade should satisfy both BIC verdicts.");
    assert(!summary.verdicts.buyerDsic && !summary.verdicts.sellerDsic,
      "The literal trade point should retain both off-family DSIC failures.");
    assert(summary.verdicts.exPostBuyerIr &&
      summary.verdicts.exPostSellerIr,
    "Both endpoint payoffs should be nonnegative.");
    assert(!summary.verdicts.exPostBudgetBalanced &&
      !summary.verdicts.exPostNoDeficit,
    "The endpoint transfer wedge should remain an ex-post deficit.");
    assert(summary.verdicts.expectedBudgetBalanced &&
      summary.verdicts.expectedNoDeficit,
    "A measure-zero deficit should not change expected budget verdicts.");
    assertClose(summary.ranges.buyerPayoff.max, 0.7,
      "Endpoint buyer-payoff maximum");
    assertClose(summary.ranges.sellerPayoff.max, 0.8,
      "Endpoint seller-payoff maximum");
    assertClose(summary.ranges.revenue.min, -0.5,
      "Endpoint revenue minimum");
  });

  test("All six preset constructors expose their exact point formulas without grids", function () {
    var vcg = model.createVcgRule();
    var posted = model.createPostedPriceRule(0.6, 0.4);
    var agv = model.createAgvRule(0.25);
    var split = model.createSplitDifferenceRule(0.25, 0.2);
    var chatterjee = model.createChatterjeeSamuelsonRule();
    var revenue = model.createRevenueThresholdRule(0.2, 0.3, 0.1);
    [vcg, posted, agv, split, chatterjee, revenue].forEach(function (rule) {
      assert(rule.representation === "formula-regions" &&
        !rule.q && !rule.pB && !rule.pS,
      rule.preset + " should retain a formula-only rule representation.");
    });
    var vcgTrade = model.ruleValuesAt(vcg, 0.8, 0.2);
    assertClose(vcgTrade.q, 1, "VCG allocation");
    assertClose(vcgTrade.pB, 0.2, "VCG buyer payment");
    assertClose(vcgTrade.pS, 0.8, "VCG seller payment");
    var postedTrade = model.ruleValuesAt(posted, 0.7, 0.3);
    assertClose(postedTrade.q, 1, "Posted-price allocation");
    assertClose(postedTrade.pB, 0.6, "Posted buyer payment");
    assertClose(postedTrade.pS, 0.4, "Posted seller receipt");
    assert(model.ruleValuesAt(posted, 0.59, 0.3).q === 0 &&
      model.ruleValuesAt(posted, 0.7, 0.41).q === 0,
    "Posted-price reports outside either cutoff should not trade.");
    var agvTrade = model.ruleValuesAt(agv, 0.8, 0.2);
    var agvNoTrade = model.ruleValuesAt(agv, 0.2, 0.8);
    assertClose(agvTrade.pB, 0.55, "AGV trade payment");
    assertClose(agvNoTrade.pB, -0.05, "AGV no-trade payment");
    assertClose(agvNoTrade.pS, -0.05, "AGV no-trade receipt");
    var splitTrade = model.ruleValuesAt(split, 0.8, 0.2);
    assertClose(splitTrade.q, 1, "Split allocation");
    assertClose(splitTrade.pB, 0.35, "Split buyer payment");
    assertClose(splitTrade.pS, 0.35, "Split seller receipt");
    var chatterjeeTrade = model.ruleValuesAt(chatterjee, 0.8, 0.2);
    assertClose(chatterjeeTrade.pB, 0.5,
      "Chatterjee-Samuelson midpoint payment");
    assertClose(chatterjeeTrade.pS, 0.5,
      "Chatterjee-Samuelson midpoint receipt");
  });

  test("Posted-price and AGV interim rules use exact closed-form polynomials", function () {
    var posted = model.createPostedPriceRule(0.6, 0.4);
    assertClose(model.buyerInterimAllocation(posted, 0.7), 0.4,
      "Posted buyer interim allocation");
    assertClose(model.buyerInterimPayment(posted, 0.7), 0.24,
      "Posted buyer interim payment");
    assertClose(model.sellerInterimAllocation(posted, 0.3), 0.4,
      "Posted seller interim allocation");
    assertClose(model.sellerInterimPayment(posted, 0.3), 0.16,
      "Posted seller interim receipt");
    var agv = model.createAgvRule(0.25);
    assertClose(model.buyerInterimAllocation(agv, 0.8), 0.8,
      "AGV buyer interim allocation");
    assertClose(model.buyerInterimPayment(agv, 0.8),
      0.25 - 1 / 6 + 0.5 * 0.8 * 0.8,
      "AGV buyer interim payment");
    assertClose(model.sellerInterimAllocation(agv, 0.2), 0.8,
      "AGV seller interim allocation");
    assertClose(model.sellerInterimPayment(agv, 0.2),
      0.25 + 1 / 6 - 0.5 * 0.2 * 0.2,
      "AGV seller interim receipt");
    assert(model.buyerIcDiagnostics(posted).envelopeResidual.holds &&
      model.sellerIcDiagnostics(posted).envelopeResidual.holds &&
      model.buyerIcDiagnostics(agv).envelopeResidual.holds &&
      model.sellerIcDiagnostics(agv).envelopeResidual.holds,
    "Both exact posted-price and AGV interim transfers should satisfy their envelope identities.");
  });

  test("Preset diagnostics distinguish BIC, DSIC, IR, and budget properties", function () {
    var vcg = model.summarize(model.createVcgRule());
    var posted = model.summarize(model.createPostedPriceRule(0.6, 0.4));
    var agv = model.summarize(model.createAgvRule(0.25));
    var split = model.summarize(
      model.createSplitDifferenceRule(0.5, 0)
    );
    var chatterjee = model.summarize(
      model.createChatterjeeSamuelsonRule()
    );
    assert(vcg.verdicts.buyerBic && vcg.verdicts.sellerBic &&
      vcg.verdicts.buyerDsic && vcg.verdicts.sellerDsic,
    "VCG should satisfy both incentive notions for both agents.");
    assert(!vcg.verdicts.exPostBudgetBalanced &&
      !vcg.verdicts.expectedNoDeficit && vcg.verdicts.efficiencyLoss === 0,
    "VCG should be efficient but run a deficit.");
    assert(posted.verdicts.buyerBic && posted.verdicts.sellerBic &&
      posted.verdicts.buyerDsic && posted.verdicts.sellerDsic &&
      posted.verdicts.exPostNoDeficit,
    "The positive-spread posted price should be IC, IR, and no-deficit.");
    assert(agv.verdicts.buyerBic && agv.verdicts.sellerBic &&
      !agv.verdicts.buyerDsic && !agv.verdicts.sellerDsic &&
      agv.verdicts.exPostBudgetBalanced &&
      agv.verdicts.exAnteBuyerIr && agv.verdicts.exAnteSellerIr &&
      !agv.verdicts.interimBuyerIr && !agv.verdicts.interimSellerIr,
    "AGV should be BIC and ex-ante IR but not DSIC or interim IR at K=1/4.");
    assert(!split.verdicts.buyerBic && !split.verdicts.sellerBic &&
      !split.verdicts.buyerDsic && !split.verdicts.sellerDsic &&
      split.verdicts.exPostBudgetBalanced && split.verdicts.efficiencyLoss === 0,
    "The default split rule should be balanced and efficient but not truthful.");
    assert(chatterjee.verdicts.buyerBic && chatterjee.verdicts.sellerBic &&
      !chatterjee.verdicts.buyerDsic && !chatterjee.verdicts.sellerDsic &&
      chatterjee.verdicts.exPostBudgetBalanced,
    "The Chatterjee-Samuelson direct rule should be BIC and balanced but not DSIC.");
    assertClose(split.buyerIc.maximumGain, 1 / 12,
      "Split buyer maximum interim gain");
    assertClose(split.sellerIc.maximumGain, 1 / 12,
      "Split seller maximum interim gain");
    assertClose(chatterjee.buyerIc.maximumGain, 0,
      "Chatterjee-Samuelson buyer interim gain");
    assertClose(chatterjee.sellerIc.maximumGain, 0,
      "Chatterjee-Samuelson seller interim gain");
    assertClose(chatterjee.buyerIc.maximumExPostGain, 0.25,
      "Chatterjee-Samuelson buyer ex-post gain");
    assertClose(chatterjee.sellerIc.maximumExPostGain, 0.25,
      "Chatterjee-Samuelson seller ex-post gain");
  });

  test("All-preset totals, ranges, and dependency maps are exact", function () {
    var posted = model.createPostedPriceRule(0.6, 0.4);
    var postedTotals = model.exAnteIntegrals(posted);
    assertClose(postedTotals.tradeProbability, 0.16,
      "Posted trade probability");
    assertClose(postedTotals.welfare, 0.096, "Posted welfare");
    assertClose(postedTotals.buyerPayment, 0.096,
      "Posted buyer payment");
    assertClose(postedTotals.sellerPayment, 0.064,
      "Posted seller receipt");
    assertClose(postedTotals.revenue, 0.032, "Posted revenue");
    var agv = model.createAgvRule(0.25);
    var agvSummary = model.summarize(agv);
    assertClose(agvSummary.exAnte.buyerPayment, 0.25,
      "AGV expected buyer payment");
    assertClose(agvSummary.exAnte.sellerPayment, 0.25,
      "AGV expected seller receipt");
    assertClose(agvSummary.ranges.pB.min, -0.25,
      "AGV payment minimum");
    assertClose(agvSummary.ranges.pB.max, 0.75,
      "AGV payment maximum");
    assertClose(agvSummary.ranges.buyerPayoff.min, -0.25,
      "AGV buyer-payoff minimum");
    assertClose(agvSummary.ranges.sellerPayoff.min, -0.75,
      "AGV seller-payoff minimum");
    assert(model.fieldDependencies(agv, "revenue").length === 0 &&
      model.fieldDependencies(agv, "buyerPayoff")[0] === "constant",
    "AGV constant changes payoff fields but not its identically zero revenue.");
    var split = model.createSplitDifferenceRule(0.25, 0.4);
    assert(model.fieldDependencies(split, "q").join(" ") === "threshold" &&
      model.fieldDependencies(split, "pB").join(" ") ===
        "threshold sellerShare" &&
      model.fieldDependencies(split, "revenue").length === 0,
    "Split dependencies should retain only parameters that enter each field.");
    assert(model.fieldDependencies(posted, "efficiency").length === 2,
      "Both posted-price cutoffs should affect allocation efficiency.");
  });

  test("Analytic families load through separate private registries", function () {
    var groups = window.BargainingSandboxAnalyticGroups;
    assert(groups && groups.diagonalAffine && groups.postedPrice &&
      groups.balancedAgv,
    "Each analytic family file should register its own constructor group.");
    assert(model.createVcgRule().family === "diagonal-affine" &&
      model.createPostedPriceRule().family === "posted-price" &&
      model.createAgvRule().family === "balanced-agv",
    "The public model facade should retain one API across the split files.");
  });

  test("Custom rules contain exactly two 20 by 20 triangle grids", function () {
    var q = model.createEfficientCustomAllocation();
    var payments = model.zeroBoundaryPayments(q);
    var rule = model.createCustomRule(q, payments.pB, payments.pS, {
      q: 2,
      paymentMode: "fixed"
    });
    assert(model.CUSTOM_RESOLUTION === 20 && q.lower.length === 20 &&
      q.upper.length === 20 && q.lower.every(function (column) {
        return column.length === 20;
      }) && q.upper.every(function (column) {
        return column.length === 20;
      }), "Custom allocation should have exactly 800 split-triangle values.");
    assert(rule.representation === "triangle-grid" &&
      rule.family === "custom-grid",
    "Custom rules should identify the triangle-grid representation.");
    var lower = model.customTriangleCentroid(7, 3, true);
    var upper = model.customTriangleCentroid(7, 3, false);
    assert(lower.v > lower.c && upper.v > upper.c &&
      lower.v > upper.v && lower.c < upper.c,
    "Both triangle centroids should lie in their requested halves of the cell.");
  });

  test("Fix IC/IR produces the zero-boundary VCG payments on efficient trade", function () {
    var q = model.createEfficientCustomAllocation();
    var payments = model.zeroBoundaryPayments(q);
    var rule = model.createCustomRule(q, payments.pB, payments.pS, {
      q: 1,
      paymentMode: "fixed"
    });
    var trade = model.ruleValuesAt(rule, 0.8, 0.2);
    var noTrade = model.ruleValuesAt(rule, 0.2, 0.8);
    var payoffs = model.truthfulPayoffValuesAt(rule, 0.8, 0.2);
    var summary = model.summarize(rule);
    assertClose(trade.q, 1, "Custom efficient allocation on trade");
    assertClose(trade.pB, 0.2, "Custom zero-boundary buyer payment");
    assertClose(trade.pS, 0.8, "Custom zero-boundary seller receipt");
    assertClose(noTrade.q, 0, "Custom efficient allocation without trade");
    assertClose(noTrade.pB, 0, "Custom no-trade buyer payment");
    assertClose(noTrade.pS, 0, "Custom no-trade seller receipt");
    assertClose(payoffs.buyerPayoff, 0.6,
      "Custom buyer truthful payoff");
    assertClose(payoffs.sellerPayoff, 0.6,
      "Custom seller truthful payoff");
    assertClose(payoffs.revenue, -0.6, "Custom pointwise revenue");
    assert(!Object.prototype.hasOwnProperty.call(payoffs, "buyer") &&
      !Object.prototype.hasOwnProperty.call(payoffs, "seller"),
    "Custom truthful payoff results should use the formula API names.");
    assert(summary.verdicts.buyerBic && summary.verdicts.sellerBic &&
      summary.verdicts.buyerDsic && summary.verdicts.sellerDsic &&
      summary.verdicts.exPostBuyerIr && summary.verdicts.exPostSellerIr,
    "Efficient trade with zero-boundary payments should be IC and ex-post IR.");
    assertClose(summary.verdicts.expectedRevenue, -1 / 6,
      "Custom VCG expected revenue", 1e-9);
    assertClose(summary.buyerIc.maximumExPostGain, 0, "Custom VCG buyer DSIC gain");
    assertClose(summary.sellerIc.maximumExPostGain, 0, "Custom VCG seller DSIC gain");
    assert(summary.buyerIc.maximumGain === null &&
      summary.buyerIc.bestReportPoints.length === 61,
    "Custom IC should expose exact verdicts and discrete optimized display marks.");
  });

  test("Fix IC/IR preserves IR but does not repair nonmonotone allocation", function () {
    var q = model.createCustomAllocationGrid(0);
    var j;
    for (j = 0; j < model.CUSTOM_RESOLUTION; j += 1) {
      q.lower[0][j] = 1;
      q.upper[0][j] = 1;
    }
    var payments = model.zeroBoundaryPayments(q);
    var rule = model.createCustomRule(q, payments.pB, payments.pS, {
      q: 1,
      paymentMode: "fixed"
    });
    var summary = model.summarize(rule);
    assert(!summary.verdicts.buyerBic && !summary.verdicts.buyerDsic,
      "A buyer-nonmonotone allocation should still fail buyer IC.");
    assertClose(summary.buyerIc.maximumExPostGain, 0.95,
      "A high buyer type gains 1 minus the truthful envelope payoff of 0.05");
    assertClose(summary.sellerIc.maximumExPostGain, 0,
      "Allocation independent of seller report remains seller DSIC");
    assert(summary.verdicts.exPostBuyerIr && summary.verdicts.exPostSellerIr,
      "Zero-boundary payments should still make both truthful payoffs nonnegative.");
  });

  test("Unchecked Custom payments remain independent editable constants", function () {
    var q = model.createCustomAllocationGrid(0);
    var pB = model.createCustomPaymentGrid(0.2);
    var pS = model.createCustomPaymentGrid(-0.1);
    var rule = model.createCustomRule(q, pB, pS, {
      pB: 1,
      pS: 1,
      paymentMode: "manual"
    });
    var summary = model.summarize(rule);
    assertClose(model.fieldValueAt(rule, "pB", 0.37, 0.61), 0.2,
      "Manual buyer payment");
    assertClose(model.fieldValueAt(rule, "pS", 0.37, 0.61), -0.1,
      "Manual seller payment");
    assertClose(summary.verdicts.expectedRevenue, 0.3,
      "Manual Custom expected revenue", 1e-9);
    assert(!summary.verdicts.exPostBuyerIr &&
      !summary.verdicts.exPostSellerIr,
    "Independent manual transfers can violate both ex-post IR constraints.");
    assert(model.dependencyKey(rule, "buyerIc").includes("manual:1") &&
      model.dependencyKey(rule, "efficiency") === "efficiency:custom:q:0",
    "Custom dependency keys should separate manual transfers from allocation.");
  });

  test("Custom DSIC gains optimize affine payments at a fixed other-agent report", function () {
    [false, true].forEach(function (ownTypePayments) {
      var q = model.createCustomAllocationGrid(0);
      var pB = model.createCustomPaymentGrid(0);
      var pS = model.createCustomPaymentGrid(0);
      ["lower", "upper"].forEach(function (side) {
        for (var i = 0; i < model.CUSTOM_RESOLUTION; i += 1) {
          for (var j = 0; j < model.CUSTOM_RESOLUTION; j += 1) {
            // Jumps in the OTHER agent's report must not create an own-report gain.
            pB[side][i][j] = [j % 2, ownTypePayments ? 1 : 0, 2, 0, 0, 0];
            pS[side][i][j] = [i % 2, 2, ownTypePayments ? 1 : 0, 0, 0, 0];
          }
        }
      });
      var summary = model.summarize(model.createCustomRule(q, pB, pS));
      var expected = ownTypePayments ? 1 : 0;
      assertClose(summary.buyerIc.maximumExPostGain, expected, "Buyer affine deviation gain");
      assertClose(summary.sellerIc.maximumExPostGain, expected, "Seller affine deviation gain");
    });
  });

  test("Custom DSIC gains retain both sides of triangle jumps and cancel common transfers", function () {
    var q = model.createCustomAllocationGrid(0);
    var pB = model.createCustomPaymentGrid(0);
    var pS = model.createCustomPaymentGrid(0);
    pB.lower[7][3][0] = 1;
    pS.lower[7][3][0] = -1;
    var spike = model.summarize(model.createCustomRule(q, pB, pS));
    assertClose(spike.buyerIc.maximumExPostGain, 1, "Buyer can avoid the payment spike");
    assertClose(spike.sellerIc.maximumExPostGain, 1, "Seller can avoid the negative receipt");

    var efficient = model.createEfficientCustomAllocation();
    var common = model.createCustomPaymentGrid(1e100);
    var transfer = model.summarize(model.createCustomRule(efficient, common, common));
    assertClose(transfer.buyerIc.maximumExPostGain, 1,
      "A constant transfer cancels before computing the buyer's allocation gain");
    assertClose(transfer.sellerIc.maximumExPostGain, 1,
      "A constant transfer cancels before computing the seller's allocation gain");
  });

  test("Invalid formula parameters and reports are rejected", function () {
    var threwNonfinite = false;
    var threwRange = false;
    var threwReport = false;
    try {
      model.createRevenueThresholdRule(NaN, 0.5, 0.5);
    } catch (error) {
      threwNonfinite = error instanceof TypeError;
    }
    try {
      model.createRevenueThresholdRule(0.5, 1.01, 0.5);
    } catch (error) {
      threwRange = error instanceof RangeError;
    }
    try {
      model.buyerInterimAllocation(
        model.createRevenueThresholdRule(), -0.01
      );
    } catch (error) {
      threwReport = error instanceof RangeError;
    }
    assert(threwNonfinite, "Nonfinite parameters should throw TypeError.");
    assert(threwRange, "Out-of-domain parameters should throw RangeError.");
    assert(threwReport, "Out-of-domain reports should throw RangeError.");
  });

  function verifyWorstLoss(rule, expected, attained) {
    var maximum = model.summarize(rule).exPostEfficiency;
    assertClose(maximum.loss, expected, "Exact largest loss");
    assert(maximum.attained === attained, "Attainment must respect boundary ownership.");
    function lossAt(v, c) {
      return Math.max(v - c, 0) - (v - c) * model.fieldValueAt(rule, "q", v, c);
    }
    if (attained) {
      assertClose(lossAt(maximum.v, maximum.c), expected, "Loss at the reported point");
    } else {
      var weight = 1e-6;
      var v = maximum.v + weight * (maximum.approachFrom.v - maximum.v);
      var c = maximum.c + weight * (maximum.approachFrom.c - maximum.c);
      assertClose(lossAt(v, c), expected, "Loss approaching the reported boundary", 1e-6);
      assert(lossAt(maximum.v, maximum.c) < expected,
        "A limit must not be claimed as an attained pointwise maximum.");
    }
    for (var i = 0; i <= 20; i += 1) {
      for (var j = 0; j <= 20; j += 1) {
        assert(lossAt(i / 20, j / 20) <= expected + 1e-12,
          "An independent point probe must not exceed the analytic bound.");
      }
    }
    return maximum;
  }

  test("Diagonal efficiency finds the exact open-boundary loss at every threshold", function () {
    [0, 0.0001, 0.17, 0.25, 1].forEach(function (threshold) {
      var rule = model.createRevenueThresholdRule(threshold, 0.4, 0.2);
      var worst = verifyWorstLoss(rule, threshold, threshold === 0);
      assertClose(worst.v, threshold, "Limiting buyer value");
      assertClose(worst.c, 0, "Limiting seller cost");
      if (threshold === 0.0001) {
        assert(model.summarize(rule).verdicts.efficiencyLoss < model.VERDICT_TOLERANCE &&
          worst.loss > model.VERDICT_TOLERANCE,
        "A shared efficiency verdict must use expected loss rather than re-test worst loss.");
      }
    });
    verifyWorstLoss(model.createVcgRule(), 0, true);
    verifyWorstLoss(model.createAgvRule(0.6), 0, true);
    verifyWorstLoss(model.createSplitDifferenceRule(), 0, true);
    verifyWorstLoss(model.createChatterjeeSamuelsonRule(), 0.25, false);
  });

  test("Posted-price efficiency compares both missing-trade strips and harmful trade", function () {
    [
      [0.5, 0.5, 0.5, false], [0.6, 0.4, 0.6, false],
      [0.2, 0.4, 0.6, false], [0.25, 0.75, 0.5, true],
      [0, 1, 1, true], [1, 0, 1, false],
      [0, 0, 1, false], [1, 1, 1, false]
    ].forEach(function (example) {
      verifyWorstLoss(model.createPostedPriceRule(example[0], example[1]),
        example[2], example[3]);
    });
  });

  test("Custom efficiency uses exact triangle loss independently of transfers", function () {
    var q = model.createEfficientCustomAllocation();
    q.lower[16][2] = 0.4;
    var zero = model.createCustomPaymentGrid(0);
    var changed = model.createCustomPaymentGrid(4);
    var first = verifyWorstLoss(model.createCustomRule(q, zero, zero), 0.45, false);
    var second = verifyWorstLoss(model.createCustomRule(q, changed, zero), 0.45, false);
    assert(JSON.stringify(first) === JSON.stringify(second),
      "Transfers must not change gains lost through the allocation.");
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
      " Bargaining sandbox model tests passed.";
    document.body.dataset.status = allPassed ? "passed" : "failed";
    document.title = (allPassed ? "PASS" : "FAIL") +
      " — Bargaining Mechanism Sandbox model tests";
  }
}());
