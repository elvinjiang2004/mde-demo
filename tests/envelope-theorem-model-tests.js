(function () {
  "use strict";

  var model = window.EnvelopeTheoremModel;
  var tests = [];
  var tolerance = 1e-9;

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

  test("The envelope-theorem model exposes the expected pure API", function () {
    assert(model && typeof model.summarize === "function",
      "EnvelopeTheoremModel should be available.");
    assert(model.MIN_LINES === 1, "The floor is a single line.");
    assert(model.MAX_LINES === model.LABEL_POOL.length,
      "The ceiling should match the size of the label pool.");
    assert(window.PaymentsFromAllocationRuleModel === undefined &&
      window.BilateralTradeModel === undefined,
    "The envelope-theorem test should not load another module's model.");
  });

  test("defaultLines is three letter-labeled, full-domain lines with the documented values", function () {
    var lines = model.defaultLines();
    assert(lines.length === 3, "defaultLines should return three lines.");
    assert(lines[0].id === "A" && lines[1].id === "B" && lines[2].id === "C",
      "The default lines should be labeled A, B, C in order.");
    assertClose(lines[0].p0.t, 0); assertClose(lines[0].p1.t, 1);
    assertClose(lines[0].p0.v, 0.2); assertClose(lines[0].p1.v, 0.8);
    assertClose(lines[1].p0.v, 0.9); assertClose(lines[1].p1.v, 0.3);
    assertClose(lines[2].p0.v, 0.6); assertClose(lines[2].p1.v, 0.6);
  });

  test("valueAt and slopeOf agree with the affine formula for an off-origin domain", function () {
    var line = { id: "X", p0: { t: 0.2, v: 1 }, p1: { t: 0.7, v: 4 } };
    assertClose(model.valueAt(line, 0.2), 1);
    assertClose(model.valueAt(line, 0.7), 4);
    assertClose(model.valueAt(line, 0.45), 2.5, "Midpoint in t should give the midpoint value.");
    assertClose(model.slopeOf(line), 6, "(4-1)/(0.7-0.2) = 6.");
  });

  test("valueAt extrapolates outside a line's own domain rather than stopping at it", function () {
    var line = { id: "X", p0: { t: 0.4, v: 0.4 }, p1: { t: 0.6, v: 0.6 } };
    assertClose(model.valueAt(line, 0), 0, "Extrapolating slope-1 line back to t=0 gives value 0.");
    assertClose(model.valueAt(line, 1), 1, "Extrapolating forward to t=1 gives value 1.");
  });

  test("slopeOf returns signed Infinity for an exactly vertical line, 0 for a degenerate point", function () {
    var rising = { id: "X", p0: { t: 0.5, v: 0.2 }, p1: { t: 0.5, v: 0.9 } };
    var falling = { id: "Y", p0: { t: 0.5, v: 0.9 }, p1: { t: 0.5, v: 0.2 } };
    var degenerate = { id: "Z", p0: { t: 0.5, v: 0.4 }, p1: { t: 0.5, v: 0.4 } };
    assert(model.slopeOf(rising) === Infinity, "p1 above p0 at equal t is +Infinity.");
    assert(model.slopeOf(falling) === -Infinity, "p1 below p0 at equal t is -Infinity.");
    assert(model.slopeOf(degenerate) === 0, "Two coincident points have no meaningful slope; 0 is the safe fallback.");
  });

  test("projectToEdge snaps to whichever of the four edges is nearest", function () {
    assertClose(model.projectToEdge(0.1, 0.9).t, 0, "Closer to the left edge (0.1) than the top (0.1)... tie breaks left.");
    assertClose(model.projectToEdge(0.1, 0.9).v, 0.9);
    var nearTop = model.projectToEdge(0.3, 0.95);
    assertClose(nearTop.v, 1, "Closer to the top edge than any other.");
    assertClose(nearTop.t, 0.3);
    var nearBottom = model.projectToEdge(0.7, 0.05);
    assertClose(nearBottom.v, 0, "Closer to the bottom edge than any other.");
    assertClose(nearBottom.t, 0.7);
    var nearRight = model.projectToEdge(0.95, 0.4);
    assertClose(nearRight.t, 1, "Closer to the right edge than any other.");
    assertClose(nearRight.v, 0.4);
  });

  test("projectToEdge clamps raw coordinates outside [0,1] before projecting", function () {
    var projected = model.projectToEdge(-3, 1.5);
    assert(projected.t === 0 || projected.v === 1, "A wildly out-of-range drag should still land exactly on the perimeter.");
    assert(projected.t >= 0 && projected.t <= 1 && projected.v >= 0 && projected.v <= 1,
      "The projected point must lie within the unit square.");
  });

  test("crossing solves the exact intersection t of two full-domain lines", function () {
    var a = { id: "A", p0: { t: 0, v: 0.2 }, p1: { t: 1, v: 0.8 } };
    var b = { id: "B", p0: { t: 0, v: 0.9 }, p1: { t: 1, v: 0.3 } };
    var t = model.crossing(a, b);
    assertClose(t, 7 / 12, "The A-B crossing should be at t=7/12.");
    assertClose(model.valueAt(a, t), model.valueAt(b, t),
      "Both lines should have equal value exactly at their crossing.");
  });

  test("crossing accounts for a line's own domain offset (t0 != 0)", function () {
    var a = { id: "A", p0: { t: 0.2, v: 0 }, p1: { t: 0.6, v: 1 } };
    var b = { id: "B", p0: { t: 0.2, v: 1 }, p1: { t: 0.6, v: 0 } };
    var t = model.crossing(a, b);
    assertClose(t, 0.4, "Two lines swapping order symmetrically over [0.2,0.6] cross at the midpoint.");
  });

  test("crossing is found even when the two lines' own drawn domains do not overlap, since the search is universal", function () {
    var a = { id: "A", p0: { t: 0, v: 0 }, p1: { t: 0.3, v: 0.3 } };
    var b = { id: "B", p0: { t: 0.5, v: 1 }, p1: { t: 1, v: 0.5 } };
    var t = model.crossing(a, b);
    assert(t !== null,
      "The two lines' own affine formulas still cross somewhere in (0,1) even though " +
      "neither line was actually drawn there; the module no longer restricts the " +
      "search to where a line's control points happen to sit.");
    assertClose(model.valueAt(a, t), model.valueAt(b, t));
  });

  test("crossing returns null for parallel (including identical) lines", function () {
    var a = { id: "A", p0: { t: 0, v: 0 }, p1: { t: 1, v: 1 } };
    var b = { id: "B", p0: { t: 0, v: 0.3 }, p1: { t: 1, v: 1.3 } };
    assert(model.crossing(a, b) === null, "Parallel lines never cross.");
    var c = { id: "C", p0: { t: 0, v: 0 }, p1: { t: 1, v: 1 } };
    assert(model.crossing(a, c) === null, "Identical lines have no single crossing point.");
  });

  test("crossing returns null when either line is vertical", function () {
    var vertical = { id: "V", p0: { t: 0.5, v: 0 }, p1: { t: 0.5, v: 1 } };
    var ordinary = { id: "O", p0: { t: 0, v: 0.2 }, p1: { t: 1, v: 0.8 } };
    assert(model.crossing(vertical, ordinary) === null,
      "A vertical line is not affine, so the point-slope crossing formula does not apply.");
  });

  test("computeEnvelope on the default lines gives exactly three segments (B, C, A) with hand-verified breakpoints", function () {
    var lines = model.defaultLines();
    var segments = model.computeEnvelope(lines);
    assert(segments.length === 3,
      "The default family should have exactly three envelope segments " +
      "(the A-B crossing at t=7/12 is real but lies strictly below C there, " +
      "so it must be merged away rather than reported as a fourth segment).");
    assert(segments[0].id === "B" && segments[1].id === "C" && segments[2].id === "A",
      "The winners in order should be B, then C, then A.");
    assertClose(segments[0].t0, 0); assertClose(segments[0].t1, 0.5, "B/C switch at t=1/2.");
    assertClose(segments[1].t0, 0.5); assertClose(segments[1].t1, 2 / 3, "C/A switch at t=2/3.");
    assertClose(segments[2].t0, 2 / 3); assertClose(segments[2].t1, 1);
    assertClose(segments[0].v1, segments[1].v0, "V should be continuous across the B/C switch.");
    assertClose(segments[1].v1, segments[2].v0, "V should be continuous across the C/A switch.");
    assertClose(segments[0].v1, 0.6, "V(1/2) = 0.6 exactly (both B and C equal 0.6 there).");
  });

  test("computeKinks reports the two switches with correct one-sided slopes", function () {
    var lines = model.defaultLines();
    var kinks = model.computeKinks(model.computeEnvelope(lines));
    assert(kinks.length === 2, "There should be exactly two kinks for the default family.");
    assertClose(kinks[0].t, 0.5);
    assertClose(kinks[0].leftSlope, -0.6, "B's slope is -0.6.");
    assertClose(kinks[0].rightSlope, 0, "C's slope is 0.");
    assertClose(kinks[1].t, 2 / 3);
    assertClose(kinks[1].leftSlope, 0); assertClose(kinks[1].rightSlope, 0.6);
  });

  test("A single full-domain line has no kinks and V equals that line everywhere", function () {
    var lines = [{ id: "A", p0: { t: 0, v: 0.3 }, p1: { t: 1, v: 0.9 } }];
    var summary = model.summarize(lines);
    assert(summary.segments.length === 1, "One line should give exactly one segment.");
    assert(summary.kinks.length === 0, "One line should have no switches.");
    [0, 0.3, 0.7, 1].forEach(function (t) {
      assertClose(model.V(lines, t), model.valueAt(lines[0], t));
    });
  });

  test("computeEnvelope searches universally: no gaps, and a segment's value may fall outside [0,1]", function () {
    var lines = [
      { id: "A", p0: { t: 0, v: 0.5 }, p1: { t: 0.3, v: 0.5 } },
      { id: "B", p0: { t: 0.7, v: 0.5 }, p1: { t: 1, v: 0.5 } }
    ];
    var segments = model.computeEnvelope(lines);
    assert(segments.length === 1, "Two flat, equal-height lines have no crossing, so one segment covers [0,1].");
    assertClose(segments[0].t0, 0); assertClose(segments[0].t1, 1);
    assert(model.V(lines, 0.5) === 0.5,
      "V is well-defined at t=0.5 via extrapolation, not undefined as it would be if " +
      "the search were still restricted to each line's own drawn domain.");

    var steep = { id: "C", p0: { t: 0.4, v: 0.4 }, p1: { t: 0.6, v: 0.6 } };
    var withSteep = model.computeEnvelope([steep]);
    assert(withSteep.length === 1);
    assertClose(withSteep[0].v0, 0, "Extrapolated back to t=0, the segment's own value is 0 -- in range here, but the mechanism (universal extrapolation) is what a steeper line would push outside [0,1].");
    var steeper = { id: "D", p0: { t: 0.45, v: 0.4 }, p1: { t: 0.55, v: 0.6 } };
    var withSteeper = model.computeEnvelope([steeper]);
    assert(withSteeper[0].v0 < 0,
      "A steep enough line's own extrapolated value at t=0 legitimately falls below 0 -- " +
      "computeEnvelope reports the true (out-of-range) envelope; clamping for display is " +
      "the caller's responsibility, not this function's.");
  });

  test("Vertical lines are excluded from the envelope search", function () {
    var lines = [
      { id: "A", p0: { t: 0, v: 0.3 }, p1: { t: 1, v: 0.7 } },
      { id: "V", p0: { t: 0.5, v: 0 }, p1: { t: 0.5, v: 1 } }
    ];
    var summary = model.summarize(lines);
    assert(summary.segments.length === 1 && summary.segments[0].id === "A",
      "The vertical line cannot win a positive-width interval and should not appear in the segments.");
    assert(summary.infiniteLines.length === 1 && summary.infiniteLines[0].id === "V",
      "summarize should separately report the vertical line.");
  });

  test("addLine appends a new flat, full-domain line at the family's current average value", function () {
    var lines = model.defaultLines();
    var averageBefore = (0.2 + 0.8 + 0.9 + 0.3 + 0.6 + 0.6) / 6;
    var result = model.addLine(lines);
    assert(result.lines.length === lines.length + 1, "addLine should grow the family by one.");
    assert(result.addedId === "D", "The next unused label after A, B, C is D.");
    var added = result.lines[result.lines.length - 1];
    assertClose(added.p0.t, 0); assertClose(added.p1.t, 1);
    assertClose(added.p0.v, averageBefore); assertClose(added.p1.v, averageBefore);
  });

  test("addLine respects the label-pool ceiling", function () {
    var lines = model.defaultLines();
    var i;
    for (i = 0; i < model.MAX_LINES - 3; i += 1) {
      var result = model.addLine(lines);
      assert(result.addedId !== null, "Adding up to the ceiling should succeed.");
      lines = result.lines;
    }
    assert(lines.length === model.MAX_LINES, "The family should now be at the ceiling.");
    assert(!model.canAddLine(lines), "No further lines should be addable at the ceiling.");
    var blocked = model.addLine(lines);
    assert(blocked.addedId === null && blocked.lines.length === lines.length,
      "addLine should be a no-op once the ceiling is reached.");
  });

  test("removeLine respects the one-line floor", function () {
    var lines = [{ id: "A", p0: { t: 0, v: 0 }, p1: { t: 1, v: 1 } }];
    assert(!model.canRemoveLine(lines), "A single line should not be removable.");
    var unchanged = model.removeLine(lines, "A");
    assert(unchanged.length === 1, "removeLine should be a no-op at the floor.");

    var two = model.defaultLines().slice(0, 2);
    assert(model.canRemoveLine(two), "Two lines should allow removing one.");
    var next = model.removeLine(two, "A");
    assert(next.length === 1 && next[0].id === "B", "Removing A should leave only B.");
  });

  test("movePoint projects onto the perimeter and updates only the targeted point, without mutation", function () {
    var lines = model.defaultLines();
    var next = model.movePoint(lines, "B", "p1", 0.6, 0.9);
    assertClose(next[1].p1.t, 0.6); assertClose(next[1].p1.v, 1);
    assertClose(next[1].p0.t, 0); assertClose(next[1].p0.v, 0.9, "The untouched point of the same line is unchanged.");
    assertClose(lines[1].p1.t, 1, "movePoint should not mutate the input array.");
    assertClose(lines[1].p1.v, 0.3);
  });

  test("movePoint snaps to an exactly vertical line once a drag is close enough to the other point's own t", function () {
    var lines = [{ id: "A", p0: { t: 0.5, v: 0 }, p1: { t: 1, v: 1 } }];
    var next = model.movePoint(lines, "A", "p1", 0.505, 0.9);
    assertClose(next[0].p1.t, 0.5, "A drag within VERTICAL_SNAP_THRESHOLD of p0's t should snap to exactly p0.t.");
    assert(next[0].p1.t === next[0].p0.t, "The two t values should be bit-for-bit equal after snapping.");
    assert(model.slopeOf(next[0]) === Infinity,
      "The resulting line is genuinely vertical: its slope is exactly Infinity, not a large finite number.");
  });

  test("movePoint does not snap when a drag is still well outside VERTICAL_SNAP_THRESHOLD", function () {
    var lines = [{ id: "A", p0: { t: 0.5, v: 0 }, p1: { t: 1, v: 1 } }];
    var next = model.movePoint(lines, "A", "p1", 0.7, 0.9);
    assertClose(next[0].p1.t, 0.7, "A drag well clear of p0's t should not snap.");
    assert(Number.isFinite(model.slopeOf(next[0])), "The line should remain an ordinary finite-slope line.");
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
      " envelope-theorem model tests passed.";
    document.body.dataset.status = allPassed ? "passed" : "failed";
    document.title = (allPassed ? "PASS" : "FAIL") +
      " — Envelope-theorem model tests";
  }
}());
