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
  test("Feasibility, input validation, boundaries, and independent lotteries", function () {
    [[-0.1, 0.2], [0.8, 0.3], [NaN, 0], [0, Infinity]].forEach(function (q) { rejects(function () { M.lottery(q[0], q[1]); }); });
    rejects(function () { M.diagnose({ lower: [], upper: [] }); });
    rejects(function () { M.cellAt(-0.01, 0.5); });
    rejects(function () { M.preset("unknown"); });
    var grid = M.preset("efficient");
    var shared = M.gridFrom(function () { return [0.2,0.3]; });
    shared.lower[0][0][0] = 0.4;
    close(shared.upper[0][0][0], 0.2);
    close(shared.lower[0][1][0], 0.2);
    close(grid.lower[0][0][0], 1);
    assert(M.cellAt(1, 1).i === 19 && M.cellAt(0, 0).half === "lower", "Boundary ownership");
    rejects(function () { M.evaluate(M.diagnose(grid).bidders[0], NaN); });
  });
  test("All 121 shifted-uniform optima are constant on every mesh triangle", function () {
    for (var e1 = 0; e1 <= 10; e1 += 1) {
      for (var e2 = 0; e2 <= 10; e2 += 1) {
        var shifts = [e1 / 10, e2 / 10], grid = M.preset("optimal", shifts), d = M.diagnose(grid, shifts);
        assert(d.bic, "Every shifted optimum is BIC");
        close(d.revenue, d.optimalRevenue, 2e-12);
        close(d.revenue, d.virtualSurplus, 2e-12);
        close(d.saleProbability, 1 - (1 - shifts[0]) * (1 - shifts[1]) / 4);
        ["lower", "upper"].forEach(function (half) {
          for (var i = 0; i < 20; i += 1) {
            for (var j = 0; j < 20; j += 1) {
              var q = grid[half][i][j];
              var vertices = half === "lower" ? [[i,j],[i+1,j],[i+1,j+1]] : [[i,j],[i,j+1],[i+1,j+1]];
              vertices.forEach(function (p) {
                // Ten times each virtual value, using integer arithmetic.
                var a = p[0] + e1 - 10, b = p[1] + e2 - 10;
                var attained = a * q[0] + b * q[1];
                assert(attained === Math.max(0, a, b), "Triangle allocation maximizes virtual surplus at every vertex");
              });
            }
          }
        });
      }
    }
  });
  test("Shifted optimal payments match critical-price formulas and boundary cases", function () {
    [[0,0], [0.2,0.6], [0,1], [1,0], [1,1]].forEach(function (shifts) {
      var d = M.diagnose(M.preset("optimal", shifts), shifts);
      d.bidders.forEach(function (agent, i) {
        var own = shifts[i], other = shifts[1-i], reserve = (1 + own) / 2;
        close(M.evaluate(agent, own).utility, 0);
        [0, 0.1375, 0.7125, 1].forEach(function (z) {
          var v = own + z;
          // Winning requires other value <= v+(other-own)/2.
          var limit = Math.max(other, Math.min(other + 1, v + (other - own) / 2));
          var cutoff = Math.max(own, reserve), switchAt = cutoff + (other - own) / 2;
          var split = Math.max(other, Math.min(limit, switchAt));
          var expectedPayment = v < reserve ? 0 : cutoff * (split - other) +
            (limit * limit - split * split) / 2 + (own - other) * (limit - split) / 2;
          var point = M.evaluate(agent, v);
          close(point.allocation, v < reserve ? 0 : limit - other);
          close(point.payment, expectedPayment);
          assert(point.utility >= -1e-12, "Interim IR with zero bottom utility");
        });
      });
    });
    var high = M.diagnose(M.preset("optimal", [1,1]), [1,1]);
    close(high.revenue, 4 / 3); close(M.evaluate(high.bidders[0], 2).payment, 1.5);
    close(M.optimalRevenue([0,1]), 25 / 24);
    var asymmetric = M.preset("optimal", [0,1]);
    assert(M.allocationAt(asymmetric, 0.913, 0.213).join() === "1,0", "Lower actual value wins when its virtual value is higher");
    assert(M.allocationAt(M.preset("efficient", [0,1]), 0.913, 0.213).join() === "0,1", "Efficiency compares actual rather than relative values");
  });
  test("Shifts preserve a painted allocation and add its exact support-dependent payments", function () {
    var grid = M.gridFrom(function (x,y,i,j,half) { return [(i % 5) / 8, half === "lower" ? 0.25 : 0.125]; });
    var original = M.diagnose(grid), shifted = M.diagnose(grid, [0.3,0.8]);
    shifted.bidders.forEach(function (agent, i) {
      var shift = shifted.shifts[i], before = original.bidders[i];
      close(agent.expectedPayment, before.expectedPayment + shift * before.allocationProbability);
      [0, 0.1375, 0.7125, 1].forEach(function (z) {
        var first = M.evaluate(before, z), next = M.evaluate(agent, z + shift);
        close(next.allocation, first.allocation); close(next.utility, first.utility);
        close(next.payment, first.payment + shift * first.allocation);
      });
    });
    close(shifted.revenue, shifted.virtualSurplus);
    var constant = M.diagnose(M.gridFrom(function () { return [0.2,0.35]; }), [0.3,0.8]);
    close(constant.bidders[0].expectedPayment, 0.06); close(constant.bidders[1].expectedPayment, 0.28);
    close(constant.revenue, 0.34);
  });
  test("Distribution validation rejects shifts that cannot align with the mesh", function () {
    [[0.05,0], [0,0.37], [-0.1,0], [0,1.1], [NaN,0], [0,Infinity], [0], null].forEach(function (shifts) {
      rejects(function () { M.diagnose(M.preset("empty"), shifts); });
      rejects(function () { M.preset("optimal", shifts); });
    });
    var agent = M.diagnose(M.preset("optimal", [0.3,0.8]), [0.3,0.8]).bidders[0];
    rejects(function () { M.evaluate(agent, 0.299); }); rejects(function () { M.evaluate(agent, 1.301); });
    close(M.virtualValue(1.3, 0.3), 1.3);
  });
  test("The efficient grid maximizes realized value throughout every triangle for all shift pairs", function () {
    for (var e1 = 0; e1 <= 10; e1 += 1) {
      for (var e2 = 0; e2 <= 10; e2 += 1) {
        var shifts = [e1 / 10, e2 / 10], grid = M.preset("efficient", shifts), result = M.diagnose(grid, shifts);
        assert(result.bic); close(result.saleProbability, 1, 1e-10);
        ["lower", "upper"].forEach(function (half) {
          grid[half].forEach(function (row, i) { row.forEach(function (q, j) {
            var vertices = half === "lower" ? [[i,j],[i+1,j],[i+1,j+1]] : [[i,j],[i,j+1],[i+1,j+1]];
            vertices.forEach(function (p) {
              var one = p[0] + 2 * e1, two = p[1] + 2 * e2;
              assert(one * q[0] + two * q[1] === Math.max(one,two), "Efficient allocation maximizes value at every vertex");
            });
          }); });
        });
      }
    }
  });
  T.run(tests);
}());
