(function () {
  "use strict";

  var model = window.PaymentsFromAllocationRuleModel;
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

  // Local fixtures standing in for the module's former preset buttons (now
  // removed from the product), kept here because the underlying shapes are
  // still useful regression cases for the model's math.
  function evenPoints(qs) {
    return [0, 0.25, 0.5, 0.75, 1].map(function (v, index) {
      return { v: v, q: qs[index] };
    });
  }

  var NEVER_POINTS = evenPoints([0, 0, 0, 0, 0]);
  var ALWAYS_POINTS = evenPoints([1, 1, 1, 1, 1]);
  var LINEAR_POINTS = evenPoints([0, 0.25, 0.5, 0.75, 1]); // Q(v) = v

  // Deliberately non-monotonic (up, down, up, down), so global IC should
  // fail without anything else needing to be painted.
  var NON_MONOTONIC_POINTS = evenPoints([0.2, 0.85, 0.3, 0.8, 0.45]);

  test("The payments-from-allocation-rule model exposes the expected pure API", function () {
    assert(model && typeof model.summarize === "function",
      "PaymentsFromAllocationRuleModel should be available.");
    assert(model.MIN_TOTAL_POINTS === 2, "The floor is the two fixed endpoints.");
    assert(model.MAX_TOTAL_POINTS === 9, "Up to nine total points are allowed.");
    assert(window.EnvelopeTheoremModel === undefined &&
      window.BilateralTradeModel === undefined && window.FPAModel === undefined,
      "The payments-from-allocation-rule test should not load another module's model.");
  });

  test("defaultPoints is five evenly-spaced points along Q(v) = v", function () {
    var points = model.defaultPoints();
    assert(points.length === 5, "defaultPoints should return five points.");
    [0, 0.25, 0.5, 0.75, 1].forEach(function (v, index) {
      assertClose(points[index].v, v, "Point " + index + " should sit at v=" + v + ".");
      assertClose(points[index].q, v, "The default is Q(v)=v.");
    });
  });

  function assertInterpolatesExactly(points, label) {
    var curve = model.buildCurve(points);
    points.forEach(function (point) {
      assertClose(curve.Q(point.v), point.q,
        label + ": the curve should pass exactly through its own control point.");
    });
  }

  test("The curve passes exactly through its own control points", function () {
    assertInterpolatesExactly(NEVER_POINTS, "never-allocate fixture");
    assertInterpolatesExactly(ALWAYS_POINTS, "always-allocate fixture");
    assertInterpolatesExactly(LINEAR_POINTS, "linear fixture");
    assertInterpolatesExactly(NON_MONOTONIC_POINTS, "non-monotonic fixture");
  });

  test("Evenly-spaced points on Q(v)=v reproduce Q(v)=v and U(v)=v^2/2 exactly, not just at the five points", function () {
    var curve = model.buildCurve(LINEAR_POINTS);
    // Evenly-spaced points lying exactly on a line give every secant the
    // same slope, so the Fritsch-Carlson tangents all equal that slope too
    // (no rescaling triggered) -- the monotone Hermite interpolant reduces
    // to the line itself everywhere, not merely at the five control points.
    [0.1, 0.37, 0.6, 0.83].forEach(function (v) {
      assertClose(curve.Q(v), v, "Q(v) should equal v at every v, not only at control points.");
      assertClose(curve.U(v), v * v / 2, "U(v) should equal v^2/2 exactly (closed-form).");
      assertClose(curve.P(v), v * v / 2, "P(v) = v*Q(v) - U(v) = v^2/2 for this curve.");
    });
  });

  test("Prefix integrals match exact per-segment Simpson integrals on an uneven nonlinear curve", function () {
    var points = [
      { v: 0, q: 0.1 },
      { v: 0.17, q: 0.8 },
      { v: 0.63, q: 0.25 },
      { v: 1, q: 0.9 }
    ];
    var curve = model.buildCurve(points);
    var cumulative = 0;
    var i;
    for (i = 0; i < points.length - 1; i += 1) {
      var left = points[i].v;
      var right = points[i + 1].v;
      var midpoint = (left + right) / 2;
      cumulative += (right - left) / 6 * (
        curve.Q(left) + 4 * curve.Q(midpoint) + curve.Q(right)
      );
      assertClose(curve.U(right), cumulative,
        "U at control point " + (i + 1) +
          " should equal the exact sum of every completed cubic segment.",
        1e-12);
    }
  });

  test("Q=1 everywhere gives U(v)=v exactly", function () {
    var curve = model.buildCurve(ALWAYS_POINTS);
    [0.05, 0.3, 0.71, 0.99].forEach(function (v) {
      assertClose(curve.Q(v), 1, "Q should be identically 1.");
      assertClose(curve.U(v), v, "U(v) = integral of 1 from 0 to v = v.");
      assertClose(curve.P(v), 0, "P(v) = v*1 - v = 0 everywhere.");
    });
  });

  test("Q=0 everywhere gives U(v)=0 and P(v)=0 exactly", function () {
    var curve = model.buildCurve(NEVER_POINTS);
    [0.05, 0.3, 0.71, 0.99].forEach(function (v) {
      assertClose(curve.Q(v), 0, "Q should be identically 0.");
      assertClose(curve.U(v), 0, "U(v) should be identically 0.");
      assertClose(curve.P(v), 0, "P(v) should be identically 0.");
    });
  });

  test("A monotone-increasing point set never overshoots between points", function () {
    var points = [
      { v: 0, q: 0 },
      { v: 0.2, q: 0.1 },
      { v: 0.5, q: 0.6 },
      { v: 0.9, q: 0.62 },
      { v: 1, q: 1 }
    ];
    var curve = model.buildCurve(points);
    var previous = -Infinity;
    var i;
    for (i = 0; i <= 400; i += 1) {
      var v = i / 400;
      var q = curve.Q(v);
      assert(q >= previous - 1e-9,
        "The Fritsch-Carlson interpolant should stay nondecreasing at v=" + v +
        " for a monotone point set (no spline overshoot).");
      previous = q;
    }
  });

  test("Monotone allocation curves satisfy global IC", function () {
    [LINEAR_POINTS, ALWAYS_POINTS, NEVER_POINTS].forEach(function (points) {
      var summary = model.summarize(points);
      assert(summary.icHolds,
        "A monotone allocation curve should have no profitable deviation.");
      assert(summary.violationCount === 0,
        "A monotone allocation curve should report zero violating points.");
    });
  });

  test("A non-monotonic allocation curve violates global IC", function () {
    var summary = model.summarize(NON_MONOTONIC_POINTS);
    assert(!summary.icHolds,
      "A non-monotonic allocation curve should fail global IC.");
    assert(summary.violationCount > 0,
      "At least one control point should have a profitable deviation.");
  });

  test("addPoint inserts into the largest gap without changing the curve's shape", function () {
    var points = model.defaultPoints();
    var before = model.buildCurve(points);
    var result = model.addPoint(points);
    assert(result.points.length === points.length + 1,
      "addPoint should grow the point set by exactly one.");
    assert(result.insertedIndex === 1,
      "With five tied 0.25-wide gaps, the first (leftmost) gap is bisected.");
    var inserted = result.points[result.insertedIndex];
    assertClose(inserted.v, 0.125, "The new point sits at the bisected gap's midpoint.");
    assertClose(inserted.q, before.Q(0.125),
      "The new point's height matches the curve's own prior value there, so " +
      "adding a point never visibly changes Q at the instant it is added.");
  });

  test("Repeated adds from the five default points land on an even 0.125 grid at the nine-point ceiling", function () {
    var points = model.defaultPoints();
    var i;
    for (i = 0; i < 4; i += 1) {
      var result = model.addPoint(points);
      assert(result.insertedIndex !== -1, "Adding up to the ceiling should succeed.");
      points = result.points;
    }
    assert(points.length === model.MAX_TOTAL_POINTS,
      "Four additions to five points should reach the nine-point ceiling.");
    points.forEach(function (point, index) {
      assertClose(point.v, index * 0.125,
        "At nine points the spacing should be a perfectly even 0.125, with " +
        "no off-grid point (this is exactly why the ceiling is nine, not ten: " +
        "a tenth add would bisect down to an uneven 0.0625).");
    });
    assert(!model.canAddPoint(points), "No further points should be addable at the ceiling.");
    var blocked = model.addPoint(points);
    assert(blocked.insertedIndex === -1 && blocked.points.length === points.length,
      "addPoint should be a no-op once the ceiling is reached.");
  });

  test("Interior points are removable; the two endpoints are not", function () {
    var points = model.defaultPoints();
    assert(!model.canRemovePoint(points, 0), "The v=0 endpoint should not be removable.");
    assert(!model.canRemovePoint(points, points.length - 1),
      "The v=1 endpoint should not be removable.");
    assert(model.canRemovePoint(points, 2), "An interior point should be removable.");

    var next = model.removePointAt(points, 2);
    assert(next.length === points.length - 1,
      "Removing an interior point should shrink the set by one.");

    var untouched = model.removePointAt(points, 0);
    assert(untouched.length === points.length,
      "Attempting to remove an endpoint should be a no-op.");
  });

  test("The floor is exactly the two endpoints", function () {
    var points = model.defaultPoints();
    while (model.canRemovePoint(points, 1)) {
      points = model.removePointAt(points, 1);
    }
    assert(points.length === model.MIN_TOTAL_POINTS,
      "Removing every removable interior point should leave exactly the two endpoints.");
    assertClose(points[0].v, 0, "The first remaining point should be v=0.");
    assertClose(points[1].v, 1, "The last remaining point should be v=1.");
  });

  test("setPointHeight clamps to [0,1]", function () {
    var points = model.defaultPoints();
    var high = model.setPointHeight(points, 2, 1.5);
    assertClose(high[2].q, 1, "Heights above 1 should clamp to 1.");
    var low = model.setPointHeight(points, 2, -0.4);
    assertClose(low[2].q, 0, "Heights below 0 should clamp to 0.");
    assertClose(points[2].q, 0.5,
      "setPointHeight should not mutate the array it was given.");
  });

  test("sortedPoints sorts by v regardless of input order", function () {
    var shuffled = [
      { v: 0.75, q: 0.2 },
      { v: 0, q: 0 },
      { v: 1, q: 1 },
      { v: 0.25, q: 0.9 },
      { v: 0.5, q: 0.4 }
    ];
    var sorted = model.sortedPoints(shuffled);
    for (var i = 0; i < sorted.length - 1; i += 1) {
      assert(sorted[i].v < sorted[i + 1].v, "sortedPoints should order strictly by v.");
    }
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
      " payments-from-allocation-rule model tests passed.";
    document.body.dataset.status = allPassed ? "passed" : "failed";
    document.title = (allPassed ? "PASS" : "FAIL") +
      " — Payments-from-allocation-rule model tests";
  }
}());
