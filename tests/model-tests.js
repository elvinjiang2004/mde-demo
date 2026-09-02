(function () {
  "use strict";

  var model = window.FPAModel;
  var distributions = window.AuctionDistributions;
  var tests = [];
  var tolerance = 1e-9;
  var beta21 = { type: "beta", alpha: 2, beta: 1 };

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
      tolerance :
      customTolerance;
    if (!Number.isFinite(actual) || Math.abs(actual - expected) > allowed) {
      throw new Error(
        (message || "Values differ.") +
        " Expected " + expected + ", received " + actual + "."
      );
    }
  }

  test("Distribution kernel and first-price model load independently", function () {
    assert(distributions, "AuctionDistributions was not loaded.");
    assert(model, "FPAModel was not loaded.");
    assert(typeof model.equilibriumBid === "function");
    assert(typeof model.winProbability === "function");
  });

  test("Legacy uniform calls retain the exact two-bidder benchmark", function () {
    var result = model.equilibriumOutcomes(0.8, 2, 0, 1);
    assertClose(result.bid, 0.4, "Equilibrium bid");
    assertClose(result.winProbability, 0.8, "Win probability");
    assertClose(result.paymentIfWin, 0.4, "Payment if win");
    assertClose(result.expectedPayment, 0.32, "Expected payment");
    assertClose(result.surplusIfWin, 0.4, "Surplus if win");
    assertClose(result.expectedPayoff, 0.32, "Expected payoff");
    assertClose(result.maximumEquilibriumBid, 0.5, "Maximum opponent bid");
    assertClose(model.winProbability(0.75, 2, 0, 1), 1, "Sure-win plateau");
  });

  test("Legacy uniform calls retain three-bidder and shifted benchmarks", function () {
    var three = model.equilibriumOutcomes(0.75, 3, 0, 1);
    assertClose(three.bid, 0.5, "Three-bidder equilibrium bid");
    assertClose(three.winProbability, 0.5625, "Three-bidder win probability");
    assertClose(three.expectedPayment, 0.28125, "Three-bidder expected payment");
    assertClose(three.expectedPayoff, 0.140625, "Three-bidder expected payoff");

    var shifted = model.equilibriumOutcomes(16, 4, 10, 20);
    assertClose(shifted.bid, 14.5, "Shifted-support equilibrium bid");
    assertClose(shifted.winProbability, 0.216, "Shifted-support win probability");
    assertClose(shifted.expectedPayoff, 0.324, "Shifted-support payoff");
    assertClose(shifted.maximumEquilibriumBid, 17.5, "Shifted maximum bid");
  });

  test("Explicit Uniform and Beta(1,1) equal the legacy uniform model", function () {
    var uniform = { type: "uniform" };
    var beta11 = { type: "beta", alpha: 1, beta: 1 };
    var n;

    for (n = 2; n <= 7; n += 1) {
      [0, 0.13, 0.5, 0.91, 1].forEach(function (value) {
        var legacyBid = model.equilibriumBid(value, n, 0, 1);
        assertClose(model.equilibriumBid(value, n, 0, 1, uniform), legacyBid);
        assertClose(model.equilibriumBid(value, n, 0, 1, beta11), legacyBid);
      });

      [0, 0.2, 0.7, 1].forEach(function (bid) {
        assertClose(
          model.winProbability(bid, n, 0, 1, beta11),
          model.winProbability(bid, n, 0, 1)
        );
      });
    }
  });

  test("Beta(2,1) equilibrium has the analytic power-CDF form", function () {
    var n;
    for (n = 2; n <= 8; n += 1) {
      var value = 0.75;
      var expectedBid = value * (2 * n - 2) / (2 * n - 1);
      var expectedProbability = Math.pow(value, 2 * (n - 1));
      var expectedUtility = Math.pow(value, 2 * n - 1) / (2 * n - 1);
      var result = model.equilibriumOutcomes(value, n, 0, 1, beta21);

      assertClose(result.bid, expectedBid, "Beta(2,1) bid for n=" + n, 2e-8);
      assertClose(
        result.winProbability,
        expectedProbability,
        "Beta(2,1) probability for n=" + n,
        2e-8
      );
      assertClose(
        result.expectedPayoff,
        expectedUtility,
        "Beta(2,1) payoff for n=" + n,
        2e-8
      );
    }
  });

  test("Beta(2,1) equilibrium translates and scales with [a,b]", function () {
    var n = 4;
    var a = 10;
    var b = 20;
    var value = 16;
    var normalizedValue = (value - a) / (b - a);
    var expectedBid = a + (b - a) *
      normalizedValue * (2 * n - 2) / (2 * n - 1);
    var expectedProbability = Math.pow(normalizedValue, 2 * (n - 1));
    var expectedUtility = (b - a) *
      Math.pow(normalizedValue, 2 * n - 1) / (2 * n - 1);
    var result = model.equilibriumOutcomes(value, n, a, b, beta21);

    assertClose(result.bid, expectedBid, "Shifted Beta equilibrium bid", 2e-8);
    assertClose(result.winProbability, expectedProbability, "Shifted probability", 2e-8);
    assertClose(result.expectedPayoff, expectedUtility, "Shifted payoff", 2e-8);
  });

  test("Inverting the equilibrium strategy recovers an opponent value", function () {
    var specifications = [
      beta21,
      { type: "beta", alpha: 2.7, beta: 4.1 }
    ];

    specifications.forEach(function (spec) {
      [0.2, 0.5, 0.85].forEach(function (value) {
        var bid = model.equilibriumBid(value, 4, 0, 1, spec);
        var cutoff = model.opponentValueCutoff(bid, 4, 0, 1, spec);
        var expectedProbability = Math.pow(
          distributions.cdf(value, 0, 1, spec),
          3
        );
        assertClose(cutoff, value, "Inverse strategy cutoff", 3e-6);
        assertClose(
          model.winProbability(bid, 4, 0, 1, spec),
          expectedProbability,
          "Probability after inversion",
          3e-6
        );
      });
    });
  });

  test("Winning probability plateaus above opponents' maximum equilibrium bid", function () {
    [
      { type: "uniform" },
      beta21,
      { type: "beta", alpha: 3, beta: 5 }
    ].forEach(function (spec) {
      var threshold = model.maximumEquilibriumBid(3, 0, 1, spec);
      assert(threshold < 1, "The maximum equilibrium bid should be below b.");
      assertClose(model.winProbability(threshold, 3, 0, 1, spec), 1);
      assertClose(model.winProbability((threshold + 1) / 2, 3, 0, 1, spec), 1);
      assertClose(model.winProbability(1, 3, 0, 1, spec), 1);
      assertClose(model.highestOpponentBidDensity(1, 3, 0, 1, spec), 0);
    });
  });

  test("Highest-opponent bid density integrates to winning probability", function () {
    [
      { type: "uniform" },
      beta21,
      { type: "beta", alpha: 3, beta: 2 }
    ].forEach(function (spec) {
      var n = 3;
      var a = 0;
      var b = 1;
      var supportEnd = model.maximumEquilibriumBid(n, a, b, spec);
      var steps = 50;
      var step = (supportEnd - a) / steps;
      var area = 0;
      var i;

      for (i = 0; i < steps; i += 1) {
        var left = a + i * step;
        var right = left + step;
        area += 0.5 * step * (
          model.highestOpponentBidDensity(left, n, a, b, spec) +
          model.highestOpponentBidDensity(right, n, a, b, spec)
        );
      }

      assertClose(area, 1, "Density should integrate to one", 5e-2);
    });
  });

  test("Expected payoff is maximized by the equilibrium bid", function () {
    var configurations = [
      { n: 3, a: 0, b: 1, value: 0.75, spec: beta21 },
      {
        n: 4,
        a: 2,
        b: 9,
        value: 6.4,
        spec: { type: "beta", alpha: 2.7, beta: 4.1 }
      }
    ];

    configurations.forEach(function (config) {
      var optimum = model.equilibriumBid(
        config.value,
        config.n,
        config.a,
        config.b,
        config.spec
      );
      var optimumPayoff = model.expectedPayoff(
        config.value,
        optimum,
        config.n,
        config.a,
        config.b,
        config.spec
      );
      var gridSize = 30;
      var i;

      for (i = 0; i <= gridSize; i += 1) {
        var bid = config.a + (config.b - config.a) * i / gridSize;
        var payoff = model.expectedPayoff(
          config.value,
          bid,
          config.n,
          config.a,
          config.b,
          config.spec
        );
        assert(
          payoff <= optimumPayoff + 2e-7,
          "A grid bid beat the equilibrium payoff."
        );
      }
    });
  });

  test("Uniform density benchmarks remain exact", function () {
    assertClose(model.highestOpponentBidDensity(0, 2, 0, 1), 2);
    assertClose(model.highestOpponentBidDensity(0.25, 2, 0, 1), 2);
    assertClose(model.highestOpponentBidDensity(0.5, 2, 0, 1), 2);
    assertClose(model.highestOpponentBidDensity(0.75, 2, 0, 1), 0);
    assertClose(model.highestOpponentBidDensity(1 / 3, 3, 0, 1), 1.5);
    assertClose(model.highestOpponentBidDensity(2 / 3, 3, 0, 1), 3);
    assertClose(model.highestOpponentBidDensity(13.75, 4, 10, 20), 0.1);
    assertClose(model.highestOpponentBidDensity(17.5, 4, 10, 20), 0.4);
  });

  test("All numerical outputs remain finite across admissible Beta shapes", function () {
    [
      { type: "beta", alpha: 0.2, beta: 0.2 },
      { type: "beta", alpha: 0.2, beta: 10 },
      { type: "beta", alpha: 10, beta: 0.2 },
      { type: "beta", alpha: 4.5, beta: 7.3 }
    ].forEach(function (spec) {
      var n = 5;
      var a = 0;
      var b = 10;
      var value = 6;
      var equilibrium = model.equilibriumOutcomes(value, n, a, b, spec);
      var maximumBid = model.maximumEquilibriumBid(n, a, b, spec);
      var numbers = [
        equilibrium.bid,
        equilibrium.winProbability,
        equilibrium.expectedPayment,
        equilibrium.expectedPayoff,
        maximumBid,
        model.highestOpponentBidDensity(a, n, a, b, spec),
        model.highestOpponentBidDensity((a + maximumBid) / 2, n, a, b, spec),
        model.highestOpponentBidDensity(maximumBid, n, a, b, spec)
      ];
      numbers.forEach(function (number) {
        assert(Number.isFinite(number), "A model output was not finite.");
      });
    });
  });

  test("Zero lower bounds are allowed and negative lower bounds are rejected", function () {
    assert(model.validateAuction(2, 0, 1).valid, "a=0 should be valid.");
    assert(model.validateAuction(2, 0, 1, beta21).valid, "Beta with a=0 should work.");
    assert(!model.validateAuction(2, -0.01, 1).valid, "Negative a should be invalid.");
  });

  test("Bidder 1's bid remains restricted to [a,b]", function () {
    assert(model.validateChoice(2, 0, 1, 0.5, 1).valid, "A bid of b is valid.");
    assert(!model.validateChoice(2, 0, 1, 0.5, 1.01).valid, "A bid above b is invalid.");
    assert(!model.validateChoice(2, 10, 20, 15, 9.9).valid, "A bid below a is invalid.");
  });

  test("Invalid bidder counts, supports, values, and Beta shapes are rejected", function () {
    assert(!model.validateAuction(1, 0, 1).valid, "n=1 should be invalid.");
    assert(!model.validateAuction(2.5, 0, 1).valid, "Fractional n should be invalid.");
    assert(!model.validateAuction(2, 1, 1).valid, "Equal bounds should be invalid.");
    assert(!model.validateAuction(2, 2, 1).valid, "Reversed bounds should be invalid.");
    assert(!model.validateAuction(2, 0, 1, {
      type: "beta", alpha: 0.1, beta: 2
    }).valid, "alpha below the supported range should be invalid.");
    assert(!model.validateAuction(2, 0, 1, {
      type: "beta", alpha: 2, beta: 10.1
    }).valid, "beta above the supported range should be invalid.");
    assert(!model.validateAuction(2, 0, 1, {
      type: "beta", alpha: NaN, beta: 2
    }).valid, "Nonfinite alpha should be invalid.");
    assert(!model.validateChoice(2, 0, 1, 1.2, 0.5).valid, "Value above support.");
    assert(!model.validateChoice(2, 0, 1, 0.5, -0.1).valid, "Bid below support.");
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
    summary.textContent =
      passed + " of " + tests.length + " model tests passed.";
    document.body.setAttribute(
      "data-status",
      allPassed ? "passed" : "failed"
    );
    document.title =
      (allPassed ? "PASS" : "FAIL") + " — FPA model tests";
  }
})();
