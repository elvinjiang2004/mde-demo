(function () {
  "use strict";
  var M = window.OptimalAuctionsModel;
  var T = window.MechanismTest;
  var close = T.assertClose;
  var assert = T.assert;
  var tests = [];
  function test(name, run) { tests.push({ name: name, run: run }); }
  function rejects(fn) { var thrown = false; try { fn(); } catch (e) { thrown = true; } assert(thrown, "Must reject invalid input"); }

  test("Highest-value allocation reproduces the second-price interim formulas", function () {
    var d = M.diagnose(M.preset("efficient"));
    assert(d.bic, "Efficient rule is BIC");
    close(d.revenue, 1 / 3);
    close(d.saleProbability, 1);
    d.bidders.forEach(function (b) {
      close(b.expectedPayment, 1 / 6);
      [0, 0.013, 0.05, 0.375, 0.5, 0.973, 1].forEach(function (v) {
        var point = M.evaluate(b, v);
        close(point.allocation, v);
        close(point.payment, v * v / 2);
        close(point.utility, v * v / 2);
      });
    });
  });
  test("The optimal uniform reserve has exact revenue 5/12 and sale probability 3/4", function () {
    var d = M.diagnose(M.preset("optimal"));
    assert(d.bic, "Reserve rule is BIC");
    close(d.revenue, 5 / 12);
    close(d.saleProbability, 3 / 4);
    d.bidders.forEach(function (b) {
      close(M.evaluate(b, 0.499999).payment, 0);
      [0.5, 0.713, 1].forEach(function (v) {
        close(M.evaluate(b, v).payment, (v * v + 0.25) / 2);
        close(M.evaluate(b, v).allocation, v);
      });
    });
  });
  test("Constant lotteries require zero normalized payment", function () {
    var d = M.diagnose(M.gridFrom(function () { return [0.2, 0.35]; }));
    assert(d.bic, "Constant lotteries are BIC");
    close(d.revenue, 0);
    close(d.saleProbability, 0.55);
    close(M.evaluate(d.bidders[0], 0.9).utility, 0.18);
    close(M.evaluate(d.bidders[1], 0.9).payment, 0);
    close(M.diagnose(M.preset("empty")).revenue, 0);
  });
  test("Asymmetric posted offer: bidder 1 alone pays the 0.4 threshold", function () {
    var d = M.diagnose(M.gridFrom(function (v1) { return v1 >= 0.4 ? [1, 0] : [0, 0]; }));
    assert(d.bic, "Posted offer is BIC");
    close(d.revenue, 0.24);
    close(d.bidders[1].expectedPayment, 0);
    close(M.evaluate(d.bidders[0], 0.4).payment, 0.4);
    close(M.evaluate(d.bidders[0], 1).payment, 0.4);
  });
  test("Within-triangle slopes and one-sided downward jumps both fail BIC", function () {
    var falling = M.diagnose(M.gridFrom(function (v1, v2) { return v1 < v2 ? [1, 0] : [0, 1]; }));
    assert(!falling.bic, "Lowest value fails BIC");
    assert(falling.bidders.every(function (b) { return b.violations.some(function (v) { return v.kind === "slope"; }); }), "Both downward slopes detected");
    var jump = M.diagnose(M.gridFrom(function (v1) { return v1 < 0.5 ? [1, 0] : [0, 0]; }));
    assert(!jump.bidders[0].bic && jump.bidders[1].bic, "Check agents separately");
    assert(jump.bidders[0].violations.some(function (v) { return v.kind === "jump" && v.a === 0.5; }), "Downward jump detected");
    var truthful = M.evaluate(jump.bidders[0], 0.25).utility;
    var alternate = M.evaluate(jump.bidders[0], 0.75);
    assert(0.25 * alternate.allocation - alternate.payment > truthful, "Candidate admits profitable misreport");
  });
  test("BIC checks interim monotonicity, allowing a rule that is not pointwise monotone", function () {
    var d = M.diagnose(M.gridFrom(function (v1, v2) {
      return [(v1 < 0.5) === (v2 < 0.5) ? 1 : 0, 0];
    }));
    assert(d.bic, "Interim Q1 is constant despite ex-post drops");
    close(M.evaluate(d.bidders[0], 0.25).allocation, 0.5);
    close(M.evaluate(d.bidders[0], 0.75).allocation, 0.5);
    close(d.revenue, 0);
  });
  test("Arbitrary lotteries satisfy the payment/virtual-surplus identity and revenue bound", function () {
    var seed = 113;
    function random() { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; }
    for (var trial = 0; trial < 12; trial += 1) {
      var d = M.diagnose(M.gridFrom(function () { var a = random(); return [a, (1 - a) * random()]; }));
      close(d.revenue, d.virtualSurplus, 2e-12);
      close(d.revenue, d.bidders[0].virtualSurplus + d.bidders[1].virtualSurplus, 2e-12);
      assert(d.revenue <= 5 / 12 + 1e-12, "Pointwise virtual optimum is an upper bound");
      assert(d.saleProbability <= 1 + 1e-12, "Feasibility integrates correctly");
    }
  });
  test("Interim allocations agree with independent midpoint integration off mesh boundaries", function () {
    var grid = M.gridFrom(function (x, y, i, j, half) {
      var a = ((i + 3 * j) % 7) / 8;
      return [a, half === "lower" ? (1 - a) / 3 : (1 - a) / 2];
    });
    var d = M.diagnose(grid);
    [0, 1].forEach(function (bidder) {
      [0, 0.1375, 0.7125, 1].forEach(function (v) {
        var sum = 0;
        for (var k = 0; k < 4000; k += 1) {
          var other = (k + 0.5) / 4000;
          sum += M.allocationAt(grid, bidder === 0 ? v : other, bidder === 0 ? other : v)[bidder] / 4000;
        }
        close(sum, M.evaluate(d.bidders[bidder], v).allocation, 1e-10);
      });
    });
  });
  test("Feasibility, input validation, boundaries, and independent copies", function () {
    [[-0.1, 0.2], [0.8, 0.3], [NaN, 0], [0, Infinity]].forEach(function (q) { rejects(function () { M.lottery(q[0], q[1]); }); });
    rejects(function () { M.diagnose({ lower: [], upper: [] }); });
    rejects(function () { M.cellAt(-0.01, 0.5); });
    rejects(function () { M.preset("unknown"); });
    var grid = M.preset("efficient");
    var copy = M.clone(grid);
    copy.lower[0][0][0] = 0.2;
    close(grid.lower[0][0][0], 1);
    assert(M.cellAt(1, 1).i === 19 && M.cellAt(0, 0).half === "lower", "Boundary ownership");
    rejects(function () { M.evaluate(M.diagnose(grid).bidders[0], NaN); });
  });
  T.run(tests);
}());
