(function () {
  "use strict";

  var model = window.SPAModel;
  var distributions = window.AuctionDistributions;
  var tests = [];
  var tolerance = 1e-8;
  var betaOne = { type: "beta", alpha: 1, beta: 1 };
  var betaTwoOne = { type: "beta", alpha: 2, beta: 1 };

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

  function midpointIntegral(callback, lower, upper, intervals) {
    var width = (upper - lower) / intervals;
    var total = 0;
    var i;
    for (i = 0; i < intervals; i += 1) {
      total += callback(lower + (i + 0.5) * width);
    }
    return total * width;
  }

  test("Second-price model uses an isolated shared-distribution API", function () {
    assert(distributions && typeof distributions.cdf === "function",
      "AuctionDistributions should be available.");
    assert(model && typeof model.outcomes === "function",
      "SPAModel should be available.");
    assert(window.FPAModel === undefined,
      "The second-price model test should not load FPAModel.");
  });

  test("Omitted distribution remains backward-compatible Uniform[a,b]", function () {
    var result = model.outcomes(80, 30, 2, 0, 100);
    assert(result.distribution.type === "uniform",
      "An omitted spec should normalize to uniform.");
    assertClose(result.winProbability, 0.3, "Win probability");
    assertClose(result.expectedPaymentIfWin, 15, "Conditional payment");
    assertClose(result.expectedPayment, 4.5, "Unconditional payment");
    assertClose(result.expectedPayoffIfWin, 65, "Conditional payoff");
    assertClose(result.expectedPayoff, 19.5, "Expected payoff");
    assertClose(result.truthfulBid, 80, "Truthful bid");

    var truthful = model.truthfulOutcomes(80, 2, 0, 100);
    assertClose(truthful.winProbability, 0.8, "Truthful probability");
    assertClose(truthful.expectedPaymentIfWin, 40,
      "Truthful conditional payment");
    assertClose(truthful.expectedPayment, 32,
      "Truthful unconditional payment");
    assertClose(truthful.expectedPayoff, 32, "Truthful payoff");
  });

  test("Uniform shifted-support benchmark is unchanged", function () {
    var result = model.outcomes(16, 14, 4, 10, 20, { type: "uniform" });
    assertClose(result.winProbability, 0.064, "Win probability");
    assertClose(model.highestOpponentBidDensity(
      14, 4, 10, 20, { type: "uniform" }
    ), 0.048, "Density");
    assertClose(result.expectedPaymentIfWin, 13, "Conditional payment");
    assertClose(result.expectedPayment, 0.832, "Unconditional payment");
    assertClose(result.expectedPayoff, 0.192, "Expected payoff");
    assertClose(model.truthfulExpectedPayoff(
      16, 4, 10, 20, { type: "uniform" }
    ), 0.324, "Truthful expected payoff");
  });

  test("A zero lower bound is valid", function () {
    assert(model.validateAuction(2, 0, 1).valid,
      "The support [0,1] should be valid.");
    var lower = model.outcomes(0.6, 0, 3, 0, 1);
    assertClose(lower.winProbability, 0, "Lower endpoint probability");
    assertClose(lower.expectedPayment, 0, "Lower endpoint payment");
    assertClose(lower.expectedPayoff, 0, "Lower endpoint payoff");
    assert(lower.expectedPaymentIfWin === null,
      "Conditional payment is undefined for a zero-probability event.");
  });

  test("Beta(1,1) exactly reproduces the uniform model", function () {
    [
      { n: 2, a: 0, b: 1, value: 0.73, bid: 0.41 },
      { n: 5, a: 3, b: 11, value: 9.2, bid: 7.4 }
    ].forEach(function (item) {
      var uniform = model.outcomes(
        item.value, item.bid, item.n, item.a, item.b, { type: "uniform" }
      );
      var beta = model.outcomes(
        item.value, item.bid, item.n, item.a, item.b, betaOne
      );
      [
        "winProbability",
        "expectedPayment",
        "expectedPaymentIfWin",
        "expectedPayoff",
        "expectedPayoffIfWin",
        "truthfulExpectedPayoff"
      ].forEach(function (field) {
        assertClose(beta[field], uniform[field], "Beta(1,1) " + field, 2e-8);
      });
    });
  });

  test("Shifted Beta(2,1) has the analytic second-price outcomes", function () {
    var result = model.outcomes(5, 4, 3, 2, 6, betaTwoOne);
    assert(result.distribution.type === "beta",
      "The normalized distribution should remain beta.");
    assertClose(result.winProbability, 1 / 16, "Win probability", 2e-8);
    assertClose(model.highestOpponentBidDensity(
      4, 3, 2, 6, betaTwoOne
    ), 1 / 8, "Highest-opponent density", 2e-8);
    assertClose(result.expectedPayment, 0.225,
      "Unconditional payment", 2e-7);
    assertClose(result.expectedPaymentIfWin, 3.6,
      "Conditional payment", 2e-7);
    assertClose(result.expectedPayoff, 0.0875, "Expected payoff", 2e-7);
    assertClose(result.expectedPayoffIfWin, 1.4,
      "Conditional payoff", 2e-7);
    assertClose(model.truthfulExpectedPayoff(5, 3, 2, 6, betaTwoOne),
      0.18984375, "Truthful payoff", 2e-7);
  });

  test("Beta translation and scale transform only monetary outcomes", function () {
    var original = model.outcomes(0.8, 0.4, 3, 0, 1, betaTwoOne);
    var shifted = model.outcomes(10.8, 10.4, 3, 10, 11, betaTwoOne);
    var scaled = model.outcomes(8, 4, 3, 0, 10, betaTwoOne);

    assertClose(shifted.winProbability, original.winProbability,
      "Translated probability");
    assertClose(shifted.expectedPayoff, original.expectedPayoff,
      "Translated payoff", 2e-7);
    assertClose(shifted.expectedPayment,
      original.expectedPayment + 10 * original.winProbability,
      "Translated payment", 2e-7);
    assertClose(scaled.winProbability, original.winProbability,
      "Scaled probability");
    assertClose(scaled.expectedPayoff, 10 * original.expectedPayoff,
      "Scaled payoff", 2e-7);
    assertClose(scaled.expectedPayment, 10 * original.expectedPayment,
      "Scaled payment", 2e-7);
  });

  test("Highest-opponent CDF and PDF apply the selected beta shape", function () {
    assertClose(model.highestOpponentBidCdf(
      0.5, 2, 0, 1, betaTwoOne
    ), 0.25, "One-opponent CDF");
    assertClose(model.highestOpponentBidDensity(
      0.5, 2, 0, 1, betaTwoOne
    ), 1, "One-opponent density");
    assertClose(model.highestOpponentBidCdf(
      0.5, 4, 0, 1, betaTwoOne
    ), 1 / 64, "Three-opponent CDF");
    assertClose(model.highestOpponentBidDensity(
      0.5, 4, 0, 1, betaTwoOne
    ), 3 / 16, "Three-opponent density");
    assertClose(model.highestOpponentBidDensity(
      -0.1, 4, 0, 1, betaTwoOne
    ), 0, "Density below support");
    assertClose(model.highestOpponentBidDensity(
      1.1, 4, 0, 1, betaTwoOne
    ), 0, "Density above support");
  });

  test("Highest-opponent density integrates to winning probability", function () {
    var spec = { type: "beta", alpha: 2.4, beta: 1.7 };
    var a = 2;
    var b = 9;
    var bid = 6.2;
    var area = midpointIntegral(function (point) {
      return model.highestOpponentBidDensity(point, 5, a, b, spec);
    }, a, bid, 30000);
    assertClose(area, model.winProbability(bid, 5, a, b, spec),
      "Density integral", 3e-7);
  });

  test("CDF-area payment and payoff identities agree", function () {
    var spec = { type: "beta", alpha: 3.2, beta: 1.4 };
    var result = model.outcomes(7.3, 6.2, 6, 4, 9, spec);
    assertClose(result.expectedPayment,
      result.winProbability * result.expectedPaymentIfWin,
      "Expected payment identity", 3e-7);
    assertClose(result.expectedPayoff,
      result.winProbability * result.expectedPayoffIfWin,
      "Expected payoff identity", 3e-7);
    assertClose(result.expectedPayoff,
      result.value * result.winProbability - result.expectedPayment,
      "Value-minus-payment identity", 3e-7);
  });

  test("A tiny positive winning probability has a conditional payment", function () {
    var payment = model.expectedPaymentIfWin(0.1, 10, 0, 100);
    assert(payment !== null && Number.isFinite(payment),
      "A positive-probability conditional payment should be defined.");
    assertClose(payment, 0.09, "Tiny-probability conditional payment", 2e-7);
  });

  test("Truthful bidding maximizes payoff for uniform and beta values", function () {
    [
      { spec: { type: "uniform" }, n: 7, a: 0, b: 2, value: 1.4 },
      { spec: betaTwoOne, n: 4, a: 0, b: 2, value: 1.4 },
      { spec: { type: "beta", alpha: 0.35, beta: 4 },
        n: 3, a: 1, b: 6, value: 4 },
      { spec: { type: "beta", alpha: 4, beta: 0.35 },
        n: 5, a: 1, b: 6, value: 4 }
    ].forEach(function (item) {
      var bestBid = item.a;
      var bestPayoff = -Infinity;
      var i;
      for (i = 0; i <= 2000; i += 1) {
        var bid = item.a + (item.b - item.a) * i / 2000;
        var payoff = model.expectedPayoff(
          item.value, bid, item.n, item.a, item.b, item.spec
        );
        if (payoff > bestPayoff) {
          bestPayoff = payoff;
          bestBid = bid;
        }
      }
      assertClose(bestBid, item.value, "Dense-grid truthful bid", 0.003);
      assertClose(bestPayoff, model.truthfulExpectedPayoff(
        item.value, item.n, item.a, item.b, item.spec
      ), "Truthful expected payoff", 4e-7);
    });
  });

  test("Underbids omit gains and overbids add losses under beta values", function () {
    var spec = { type: "beta", alpha: 2, beta: 5 };
    var truthful = model.expectedPayoff(0.6, 0.6, 4, 0, 1, spec);
    assert(model.expectedPayoff(0.6, 0.3, 4, 0, 1, spec) < truthful,
      "An underbid should have lower expected payoff.");
    assert(model.expectedPayoff(0.6, 0.9, 4, 0, 1, spec) < truthful,
      "An overbid should have lower expected payoff.");
  });

  test("Endpoint-singular beta shapes do not create NaN model values", function () {
    var spec = { type: "beta", alpha: 0.5, beta: 0.5 };
    var lower = model.outcomes(0.7, 0, 3, 0, 1, spec);
    var upper = model.outcomes(0.7, 1, 3, 0, 1, spec);

    assertClose(lower.winProbability, 0, "Lower probability");
    assert(lower.expectedPaymentIfWin === null,
      "Lower conditional payment should be null.");
    assertClose(upper.winProbability, 1, "Upper probability");
    [
      upper.expectedPayment,
      upper.expectedPaymentIfWin,
      upper.expectedPayoff,
      upper.expectedPayoffIfWin,
      model.highestOpponentBidDensity(0, 3, 0, 1, spec)
    ].forEach(function (value) {
      assert(!Number.isNaN(value), "Endpoint output should not be NaN.");
    });
  });

  test("Legal outputs remain finite across distribution shapes", function () {
    [
      { type: "uniform" },
      { type: "beta", alpha: 0.2, beta: 3 },
      { type: "beta", alpha: 3, beta: 0.2 },
      { type: "beta", alpha: 10, beta: 10 }
    ].forEach(function (spec) {
      var i;
      for (i = 1; i < 40; i += 1) {
        var result = model.outcomes(0.63, i / 40, 5, 0, 1, spec);
        [
          result.winProbability,
          result.expectedPayment,
          result.expectedPaymentIfWin,
          result.expectedPayoff,
          result.expectedPayoffIfWin,
          result.truthfulExpectedPayoff
        ].forEach(function (value) {
          assert(Number.isFinite(value), "Expected a finite legal output.");
        });
      }
    });
  });

  test("Invalid supports, choices, and beta shapes are rejected", function () {
    assert(!model.validateAuction(1, 0, 1).valid, "n=1 should be invalid.");
    assert(!model.validateAuction(2.5, 0, 1).valid,
      "Fractional n should be invalid.");
    assert(!model.validateAuction(2, -1, 1).valid,
      "A negative lower bound should be invalid.");
    assert(!model.validateAuction(2, 1, 1).valid,
      "Equal bounds should be invalid.");
    assert(!model.validateAuction(2, 2, 1).valid,
      "Reversed bounds should be invalid.");
    assert(!model.validateAuction(2, 0, 1,
      { type: "beta", alpha: 0.1, beta: 2 }).valid,
    "Alpha below the supported range should be invalid.");
    assert(!model.validateAuction(2, 0, 1,
      { type: "beta", alpha: 2, beta: 11 }).valid,
    "Beta above the supported range should be invalid.");
    assert(!model.validateAuction(2, 0, 1, { type: "gamma" }).valid,
      "An unknown distribution should be invalid.");
    assert(!model.validateChoice(2, 0, 1, 1.2, 0.5).valid,
      "Value above support should be invalid.");
    assert(!model.validateChoice(2, 0, 1, 0.5, -0.1).valid,
      "Bid below support should be invalid.");
    assert(model.validateChoice(2, 0, 1, 0.5, 1).valid,
      "The upper support endpoint should be a valid bid.");
    assert(!model.validateChoice(2, 0, 1, 0.5, 1.1).valid,
      "A bid above b should be invalid.");
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
      " second-price model tests passed.";
    document.body.dataset.status = allPassed ? "passed" : "failed";
    document.title = (allPassed ? "PASS" : "FAIL") +
      " — SPA model tests";
  }
}());
