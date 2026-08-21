(function () {
  "use strict";

  var distribution = window.AuctionDistributions;
  var tests = [];

  function test(name, callback) {
    tests.push({ name: name, callback: callback });
  }

  function assert(condition, message) {
    if (!condition) {
      throw new Error(message || "Assertion failed.");
    }
  }

  function assertClose(actual, expected, tolerance, message) {
    if (!Number.isFinite(actual) || Math.abs(actual - expected) > tolerance) {
      throw new Error(
        (message || "Values differ.") +
        " Expected " + expected + ", received " + actual + "."
      );
    }
  }

  function assertThrows(callback, message) {
    var threw = false;
    try {
      callback();
    } catch (error) {
      threw = true;
    }
    assert(threw, message || "Expected an exception.");
  }

  test("API and specification normalization", function () {
    assert(distribution, "AuctionDistributions should exist.");
    ["normalizeSpec", "validate", "cdf", "pdf", "quantile", "integrate"]
      .forEach(function (name) {
        assert(typeof distribution[name] === "function", name + " should be exposed.");
      });
    assert(distribution.normalizeSpec().type === "uniform", "Default is uniform.");
    assert(distribution.normalizeSpec("uniform").type === "uniform");
    var betaDefault = distribution.normalizeSpec({ type: "beta" });
    assert(betaDefault.type === "beta");
    assert(betaDefault.alpha === 1 && betaDefault.beta === 1,
      "Beta shapes should default to 1.");
    var normalized = distribution.validate(0, 1, {
      type: "BETA",
      alpha: 0.2,
      beta: 10
    });
    assert(normalized.type === "beta");
  });

  test("Beta(1,1) equals the uniform distribution", function () {
    var beta = { type: "beta", alpha: 1, beta: 1 };
    [0, 0.1, 0.37, 0.9, 1].forEach(function (x) {
      assertClose(distribution.cdf(x, 0, 1, beta), x, 2e-13, "CDF");
      assertClose(distribution.pdf(x, 0, 1, beta), 1, 2e-13, "PDF");
    });
  });

  test("Beta(2,1) has CDF z squared and density 2z", function () {
    var spec = { type: "beta", alpha: 2, beta: 1 };
    [0, 0.2, 0.5, 0.8, 1].forEach(function (z) {
      assertClose(distribution.cdf(z, 0, 1, spec), z * z, 3e-13, "CDF");
      assertClose(distribution.pdf(z, 0, 1, spec), 2 * z, 3e-13, "PDF");
    });
  });

  test("Beta(2,2) polynomial benchmarks", function () {
    var spec = { type: "beta", alpha: 2, beta: 2 };
    [0, 0.2, 0.5, 0.8, 1].forEach(function (z) {
      var expectedCdf = 3 * z * z - 2 * z * z * z;
      var expectedPdf = 6 * z * (1 - z);
      assertClose(distribution.cdf(z, 0, 1, spec), expectedCdf, 4e-13, "CDF");
      assertClose(distribution.pdf(z, 0, 1, spec), expectedPdf, 4e-13, "PDF");
    });
  });

  test("Beta(0.5,0.5) handles singular endpoints", function () {
    var spec = { type: "beta", alpha: 0.5, beta: 0.5 };
    [0.01, 0.2, 0.5, 0.8, 0.99].forEach(function (z) {
      var expected = 2 * Math.asin(Math.sqrt(z)) / Math.PI;
      assertClose(distribution.cdf(z, 0, 1, spec), expected, 2e-12, "CDF");
    });
    assert(distribution.pdf(0, 0, 1, spec) === Infinity,
      "Lower endpoint density should diverge.");
    assert(distribution.pdf(1, 0, 1, spec) === Infinity,
      "Upper endpoint density should diverge.");
    assertClose(distribution.pdf(0.5, 0, 1, spec), 2 / Math.PI, 2e-13, "PDF");
  });

  test("Densities normalize, including supported extreme shapes", function () {
    [
      { type: "uniform" },
      { type: "beta", alpha: 2, beta: 2 },
      { type: "beta", alpha: 0.5, beta: 0.5 },
      { type: "beta", alpha: 0.2, beta: 10 },
      { type: "beta", alpha: 10, beta: 0.2 }
    ].forEach(function (spec) {
      var area = distribution.integrate(function (x) {
        return distribution.pdf(x, 0, 1, spec);
      }, 0, 1, 2e-9);
      assertClose(area, 1, 2e-8,
        "Density normalization for " + JSON.stringify(spec));
    });
  });

  test("Translation and scaling produce the transformed Beta distribution", function () {
    var spec = { type: "beta", alpha: 2, beta: 1 };
    assertClose(distribution.cdf(14, 10, 20, spec), 0.16, 3e-13, "Shifted CDF");
    assertClose(distribution.pdf(14, 10, 20, spec), 0.08, 3e-13, "Scaled PDF");
    assertClose(distribution.quantile(0.36, 10, 20, spec), 16, 2e-12,
      "Shifted quantile");
    assert(distribution.cdf(9, 10, 20, spec) === 0, "CDF below support.");
    assert(distribution.cdf(21, 10, 20, spec) === 1, "CDF above support.");
    assert(distribution.pdf(9, 10, 20, spec) === 0, "PDF below support.");
  });

  test("Quantile inverts the CDF across shapes and shifted supports", function () {
    [
      { type: "uniform" },
      { type: "beta", alpha: 2, beta: 2 },
      { type: "beta", alpha: 0.5, beta: 0.5 },
      { type: "beta", alpha: 0.2, beta: 3.7 },
      { type: "beta", alpha: 6.5, beta: 0.2 }
    ].forEach(function (spec) {
      [0.01, 0.2, 0.5, 0.8, 0.99]
        .forEach(function (p) {
          var x = distribution.quantile(p, 7, 19, spec);
          assertClose(distribution.cdf(x, 7, 19, spec), p, 2e-8,
            "CDF at quantile");
        });
      assert(distribution.quantile(0, 7, 19, spec) === 7);
      assert(distribution.quantile(1, 7, 19, spec) === 19);
    });
  });

  test("Generic integration is accurate and respects orientation", function () {
    var polynomial = distribution.integrate(function (x) {
      return x * x;
    }, 0, 3, 1e-11);
    assertClose(polynomial, 9, 2e-10, "Polynomial integral");
    assertClose(distribution.integrate(Math.sin, 0, Math.PI, 1e-11), 2, 2e-10,
      "Sine integral");
    assertClose(distribution.integrate(function (x) {
      return x * x;
    }, 3, 0, 1e-11), -9, 2e-10, "Reversed integral");
    assert(distribution.integrate(function () { return 5; }, 2, 2) === 0);
  });

  test("Invalid bounds, specifications, probabilities, and integrals are rejected", function () {
    assertThrows(function () { distribution.validate(-0.01, 1); }, "Negative a.");
    assertThrows(function () { distribution.validate(1, 1); }, "Equal bounds.");
    assertThrows(function () { distribution.validate(2, 1); }, "Reversed bounds.");
    assertThrows(function () { distribution.validate(0, Infinity); }, "Infinite b.");
    assertThrows(function () {
      distribution.validate(0, 1, { type: "normal" });
    }, "Unknown family.");
    assertThrows(function () {
      distribution.validate(0, 1, { type: "beta", alpha: 0.19, beta: 2 });
    }, "Alpha below safe range.");
    assertThrows(function () {
      distribution.validate(0, 1, { type: "beta", alpha: 2, beta: 10.01 });
    }, "Beta above safe range.");
    assertThrows(function () {
      distribution.validate(0, 1, { type: "beta", alpha: "2", beta: 2 });
    }, "Nonnumeric alpha.");
    assertThrows(function () { distribution.quantile(-0.1, 0, 1); }, "p below zero.");
    assertThrows(function () { distribution.quantile(1.1, 0, 1); }, "p above one.");
    assertThrows(function () { distribution.integrate(null, 0, 1); }, "Invalid fn.");
    assertThrows(function () {
      distribution.integrate(function (x) { return x; }, 0, 1, 0);
    }, "Invalid tolerance.");
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
      " distribution tests passed.";
    document.body.setAttribute("data-status", allPassed ? "passed" : "failed");
    document.title = (allPassed ? "PASS" : "FAIL") +
      " — Distribution kernel tests";
  }
})();
