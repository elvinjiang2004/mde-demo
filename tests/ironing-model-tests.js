(function () {
  "use strict";
  var T = MechanismTest, assert = T.assert, close = T.assertClose, M = IroningModel, tests = [];
  var uniform = M.distribution(0.5, 0.5);
  function test(name, run) { tests.push({ name: name, run: run }); }
  function points(entries, d) { return entries.map(function (p) { return { v: M.quantile(p[0], d), q: p[1] }; }); }
  function simpson(fn, a, b, count) {
    var h = (b - a) / count, sum = fn(a) + fn(b);
    for (var i = 1; i < count; i += 1) { sum += (i % 2 ? 4 : 2) * fn(a + i * h); }
    return sum * h / 3;
  }
  var settings = [[0.5, 0.75], [0.5, 0.5], [0.8, 0.4], [0.8, 0.7], [0.1, 0.3], [0.25, 0.75],
    [0.1, 0.95], [0.9, 0.05], [0.9, 0.95], [0.1, 0.05]];
  test("Piecewise-uniform density, CDF, inverse, and mass normalization agree", function () {
    settings.forEach(function (values) {
      var d = M.distribution(values[0], values[1]);
      close(d.lowerDensity * d.split + d.upperDensity * (1 - d.split), 1);
      close(M.cdf(d.split, d), d.mass); close(M.cdf(0, d), 0); close(M.cdf(1, d), 1);
      assert(d.lowerDensity > 0 && d.upperDensity > 0);
      for (var i = 0; i <= 500; i += 1) { close(M.cdf(M.quantile(i / 500, d), d), i / 500, 1e-12); }
      close(M.pdf(d.split, d, "left"), d.lowerDensity); close(M.pdf(d.split, d), d.upperDensity);
    });
  });
  test("Density drops create downward virtual jumps; density rises are regular", function () {
    var d = M.defaultDistribution;
    close(M.phi(0.5, d, "left"), 1 / 3); close(M.phi(0.5, d), 0);
    assert(M.phi(0.5, d, "left") > M.phi(0.5, d));
    var regular = M.distribution(0.8, 0.4);
    assert(M.phi(0.8, regular, "left") < M.phi(0.8, regular) && M.ironing(regular).intervals.length === 0);
    close(M.phi(0.4, uniform), -0.2); assert(M.ironing(uniform).intervals.length === 0);
  });
  test("Integrated virtual values and their lower convex hull retain contacts, dominance, and convexity", function () {
    settings.forEach(function (values) {
      var d = M.distribution(values[0], values[1]), solution = M.ironing(d), previousSlope = -Infinity;
      close(M.integratedVirtual(0, d), 0); close(M.integratedVirtual(1, d), 0);
      close(M.convexIntegrated(0, solution), 0); close(M.convexIntegrated(1, solution), 0);
      for (var i = 0; i <= 1000; i += 1) {
        var u = i / 1000, raw = M.integratedVirtual(u, d), hull = M.convexIntegrated(u, solution);
        assert(hull <= raw + 1e-12, "Convex hull stays below H");
        if (i) {
          var slope = (hull - M.convexIntegrated(u - 0.001, solution)) / 0.001;
          assert(slope >= previousSlope - 1e-8, "Convex slopes increase"); previousSlope = slope;
        }
        if (!solution.intervals.length) { close(hull, raw, 1e-12); }
      }
      solution.intervals.forEach(function (p) {
        var first = -(1 - p.lower) * p.a, last = -(1 - p.upper) * p.b;
        close(M.convexIntegrated(p.lower, solution), first, 1e-12);
        close(M.convexIntegrated(p.upper, solution), last, 1e-12);
        close(M.convexIntegrated((p.lower + p.upper) / 2, solution), (first + last) / 2, 1e-12);
        close((last - first) / (p.upper - p.lower), p.virtual, 1e-10);
      });
    });
  });
  test("Integrated virtual values agree with independent integrals and hull slopes give ironed priorities", function () {
    settings.forEach(function (values) {
      var d = M.distribution(values[0], values[1]), solution = M.ironing(d), h = 1e-7;
      for (var i = 1; i < 100; i += 1) {
        var u = i / 100, v = M.quantile(u, d);
        var split = Math.min(u, d.mass);
        var integral = ((split * split - split) / d.lowerDensity);
        if (u > d.mass) {
          var width = u - d.mass;
          integral += (2 * d.split - 1) * width + width * width / d.upperDensity;
        }
        close(M.integratedVirtual(u, d), integral, 1e-12);
        if (Math.abs(u - d.mass) > h) {
          close((M.integratedVirtual(u + h, d) - M.integratedVirtual(u - h, d)) / (2 * h), M.phi(v, d), 1e-7);
        }
        var nearContact = solution.intervals.some(function (p) { return Math.min(Math.abs(u - p.upper), Math.abs(u - p.lower)) < h; });
        if (!nearContact && Math.abs(u - d.mass) > h) {
          close((M.convexIntegrated(u + h, solution) - M.convexIntegrated(u - h, solution)) / (2 * h), M.ironedPhi(v, solution), 1e-7);
        }
      }
    });
  });
  test("Every bidder setting starts at an exact feasible allocation including the density kink", function () {
    settings.forEach(function (values) {
      var d = M.distribution(values[0], values[1]);
      for (var n = 2; n <= 5; n += 1) {
        var r = M.diagnose(M.initial(n, d), n, d);
        assert(r.valid); close(r.feasibility.saleProbability, 1, 1e-12);
        assert(r.points.some(function (p) { return p.v === d.split; }));
        close(r.revenue, r.paymentRevenue, 1e-11); close(M.evaluate(r, 0).utility, 0);
      }
    });
  });
  test("Allocation and envelope payments are invariant to distribution edits", function () {
    var chosen = [{ v: 0, q: 0.02 }, { v: 0.37, q: 0.2 }, { v: 0.81, q: 0.6 }, { v: 1, q: 0.9 }];
    var first = M.diagnose(chosen, 2), next = M.diagnose(chosen, 2, M.distribution(0.63, 0.21));
    for (var i = 0; i <= 1000; i += 1) {
      var a = M.evaluate(first, i / 1000), b = M.evaluate(next, i / 1000);
      close(a.q, b.q, 1e-12); close(a.utility, b.utility, 1e-12); close(a.payment, b.payment, 1e-12);
    }
    assert(Math.abs(first.revenue - next.revenue) > 0.001);
    close(M.evaluate(first, 0.185).q, 0.11, 1e-12);
  });
  test("Polynomial revenue agrees with independent payment integration across all breakpoints", function () {
    settings.forEach(function (values) {
      var d = M.distribution(values[0], values[1]);
      var r = M.diagnose([{ v: 0, q: 0.03 }, { v: 0.4, q: 0.2 }, { v: 0.9, q: 0.68 }, { v: 1, q: 0.9 }], 3, d);
      var reference = 0;
      r.pieces.forEach(function (p) {
        reference += 3 * simpson(function (v) { return M.evaluatePiece(p, v).payment * p.density; }, p.v0, p.v1, 400);
      });
      close(r.revenue, reference, 1e-11); close(r.revenue, r.paymentRevenue, 1e-11);
    });
  });
  test("Zero, equal, and signed invalid envelope candidates retain their meanings", function () {
    var zero = M.diagnose([{ v: 0, q: 0 }, { v: 1, q: 0 }], 2);
    assert(zero.valid); close(zero.revenue, 0);
    var equal = M.diagnose([{ v: 0, q: 0.5 }, { v: 1, q: 0.5 }], 2);
    assert(equal.valid); close(equal.revenue, 0);
    var decreasing = M.diagnose([{ v: 0, q: 1 }, { v: 1, q: 0 }], 2, uniform);
    assert(!decreasing.monotone && decreasing.feasibility.feasible && decreasing.revenue < 0);
    close(M.evaluate(decreasing, 1).payment, -0.5);
  });
  test("Full Border constraints catch nonmonotone rules missed by value tails", function () {
    var r = M.diagnose(points([[0, 1], [0.5, 1], [0.5, 0], [1, 0]]), 2);
    assert(r.tails.feasible && !r.feasibility.feasible); close(r.feasibility.witness.excess, 0.25, 1e-12);
  });
  test("Continuum constraints still catch an interior violation missed at every knot", function () {
    var r = M.diagnose(points([[0, 0], [0.5, 0.2], [0.6, 0.8], [1, 0.8]]), 2);
    assert(r.monotone && !r.feasibility.feasible);
    close(r.tails.witness.u, 0.56, 1e-12); close(r.tails.witness.excess, 0.008, 1e-12);
    [0, 0.5, 0.6, 1].forEach(function (u) { assert(2 * M.tailAt(r.tails, u) <= 1 - u * u + 1e-12); });
  });
  test("Jumps preserve utility continuity and right-continuous report ownership", function () {
    var r = M.diagnose([{ v: 0, q: 0 }, { v: 0.4, q: 0 }, { v: 0.4, q: 0.2 }, { v: 1, q: 0.2 }], 2);
    close(M.evaluate(r, 0.4).q, 0.2); close(M.evaluate(r, 0.4).payment, 0.08); close(M.evaluate(r, 1).utility, 0.12);
    assert(r.valid);
  });
  test("Continuous-contact and zero-boundary ironing chords certify the full curve", function () {
    settings.forEach(function (values) {
      var d = M.distribution(values[0], values[1]), solution = M.ironing(d), previous = -Infinity;
      solution.intervals.forEach(function (p) {
        close(M.phi(p.b, d), p.virtual, 1e-11);
        if (p.a > 0) { close(M.phi(p.a, d), p.virtual, 1e-11); }
        for (var j = 0; j <= 2000; j += 1) {
          var u = p.lower + (p.upper - p.lower) * j / 2000, v = M.quantile(u, d);
          var chord = -(1 - p.lower) * p.a + p.virtual * (u - p.lower);
          assert(chord <= -(1 - u) * v + 1e-11, "Supporting chord is below H");
        }
      });
      for (var k = 0; k <= 2000; k += 1) {
        var priority = M.ironedPhi(k / 2000, solution); assert(priority >= previous - 1e-10); previous = priority;
      }
    });
  });
  test("Default pooling and revenue match independent closed-form constants", function () {
    var o = M.benchmark(2), p = o.pools[0];
    close(o.reserve, 1 / 3, 1e-12); close(p.a, (7 - Math.sqrt(3)) / 12, 1e-12);
    close(p.b, (9 - Math.sqrt(3)) / 12, 1e-12); close(p.q, 0.7306624327025936, 1e-12);
    close(o.revenue, 0.2852593768693724, 1e-12);
    assert(o.revenue > 0.2847222222222223 + 0.0001, "Strict gain over the corresponding value-ranked reserve auction");
  });
  test("The two-bidder editor exactly represents the unrestricted default optimum", function () {
    var o = M.benchmark(2), p = o.pools[0], r = o.reserve;
    var chosen = [{ v: 0, q: 0 }, { v: r, q: 0 }, { v: r, q: M.cdf(r) }, { v: p.a, q: p.lower },
      { v: p.a, q: p.q }, { v: p.b, q: p.q }, { v: p.b, q: p.upper }, { v: 1, q: 1 }];
    var rule = M.diagnose(chosen, 2);
    assert(rule.valid); close(rule.revenue, o.revenue, 1e-12);
  });
  test("Regular, boundary, and zero-priority cases use the correct cutoff", function () {
    var u = M.benchmark(2, uniform); close(u.reserve, 0.5); close(u.revenue, 5 / 12);
    var jump = M.benchmark(2, M.distribution(0.8, 0.4)); close(jump.reserve, 0.8);
    var bottom = M.benchmark(2, M.distribution(0.1, 0.3));
    close(bottom.ironing.intervals[0].a, 0); close(bottom.ironing.intervals[0].b, 0.3203772410170408, 1e-12);
    assert(!bottom.pools.length); close(bottom.reserve, 0.5);
    var zero = M.benchmark(2, M.distribution(0.25, 0.75));
    close(zero.ironing.intervals[0].virtual, 0); close(zero.reserve, 0.5); assert(!zero.pools.length);
    close(zero.allocation(0.4), 0);
  });
  test("Benchmark power integrals and symmetric tie allocations hold across distributions and bidder counts", function () {
    settings.forEach(function (values) {
      var d = M.distribution(values[0], values[1]);
      [2, 3, 4, 5].forEach(function (n) {
        var o = M.benchmark(n, d), reference = 0;
        o.pools.forEach(function (p) {
          var expected = 0;
          for (var k = 0; k < n; k += 1) {
            var choose = 1; for (var j = 1; j <= k; j += 1) { choose *= (n - j) / j; }
            expected += choose * Math.pow(p.upper - p.lower, k) * Math.pow(p.lower, n - 1 - k) / (k + 1);
          }
          close(p.q, expected, 1e-12);
        });
        o.cuts.slice(1).forEach(function (b, i) {
          var a = o.cuts[i], e = Math.min(1e-12, (b - a) / 10), f = M.pdf((a + b) / 2, d);
          reference += n * simpson(function (v) {
            var phi = v - (1 - M.cdf(v, d)) / f;
            return phi * f * o.allocation(v);
          }, a + e, b - e, 1200);
        });
        close(o.revenue, reference, 1e-9);
        assert(Number.isFinite(o.payment(1)) && o.payment(1) >= 0);
      });
    });
  });
  test("Near-uniform and narrow ironing intervals stay numerically stable", function () {
    [0.17, 0.5, 0.88].forEach(function (c) {
      var base = M.benchmark(5, M.distribution(c, c));
      [-1e-10, 1e-10].forEach(function (epsilon) {
        var next = M.benchmark(5, M.distribution(c, c + epsilon));
        close(next.revenue, base.revenue, 1e-8);
        next.pools.forEach(function (p) { assert(p.q >= 0 && p.q <= 1); });
      });
    });
  });
  test("Malformed distributions, allocation rules, and bidder settings are rejected", function () {
    [
      function () { M.distribution(0, 0.5); }, function () { M.distribution(0.5, 1); },
      function () { M.distribution(NaN, 0.5); },
      function () { M.diagnose([{ v: 0, q: -0.1 }, { v: 1, q: 1 }], 2); },
      function () { M.diagnose([{ v: 0, q: 0 }, { v: 1, q: NaN }], 2); },
      function () { M.diagnose([{ v: 0.1, q: 0 }, { v: 1, q: 1 }], 2); },
      function () { M.diagnose([{ v: 0, q: 0 }, { v: 0.5, q: 0 }, { v: 0.5, q: 0.1 }, { v: 0.5, q: 0.2 }, { v: 1, q: 1 }], 2); },
      function () { M.benchmark(2.5); }, function () { M.benchmark(6); }
    ].forEach(function (fn) { var threw = false; try { fn(); } catch (_) { threw = true; } assert(threw); });
  });
  test("Continuum feasibility agrees with dense independent mass checks after distribution edits", function () {
    var seed = 703;
    function random() { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; }
    for (var k = 0; k < 40; k += 1) {
      var n = 2 + k % 4, list = [], d = M.distribution(0.1 + 0.8 * random(), 0.05 + 0.9 * random());
      for (var j = 0; j <= 5; j += 1) { list.push({ v: j / 5, q: random() }); }
      var r = M.diagnose(list, n, d), max = 0;
      for (var i = 0; i <= 5000; i += 1) {
        var u = i / 5000; max = Math.max(max, n * M.tailAt(r.feasibility, u) - 1 + Math.pow(u, n));
      }
      close(r.feasibility.witness.excess, max, 2e-6);
    }
  });
  test("Loading the optimum preserves exact curved allocations, payments, and feasibility for every bidder count", function () {
    settings.forEach(function (values) {
      var d = M.distribution(values[0], values[1]);
      for (var n = 2; n <= 5; n += 1) {
        var optimum = M.benchmark(n, d), rule = M.adoptedRule(optimum, n, d);
        assert(rule.valid && rule.points.length <= 8); close(rule.revenue, optimum.revenue, 1e-10);
        close(rule.points[0].v, 0); close(rule.points[rule.points.length - 1].v, 1);
        rule.points.slice(1, -1).forEach(function (point, index) {
          assert(point.v === rule.points[index].v || point.v === rule.points[index + 2].v,
            "Every interior handle is a one-sided endpoint at an allocation jump");
        });
        rule.pieces.slice(1).forEach(function (piece, index) {
          var previous = rule.pieces[index], left = M.evaluatePiece(previous, previous.v1).q, right = M.evaluatePiece(piece, piece.v0).q;
          if (Math.abs(left - right) > 1e-12) {
            var endpoints = rule.points.filter(function (point) { return point.v === piece.v0; });
            assert(endpoints.length === 2, "Both sides of each jump have handles");
            close(endpoints[0].q, left, 1e-10); close(endpoints[1].q, right, 1e-10);
          }
        });
        close(rule.paymentRevenue, optimum.revenue, 1e-10);
        for (var i = 0; i <= 100; i += 1) {
          var v = i / 100, point = M.evaluate(rule, v);
          close(point.q, optimum.allocation(v), 1e-10); close(point.payment, optimum.payment(v), 1e-10);
        }
      }
    });
  });
  test("An adopted mechanism keeps its Q and P under parameter edits and is checked against the new environment", function () {
    var chosen = M.benchmark(4), original = M.adoptedRule(chosen, 4);
    [M.distribution(0.63, 0.31), M.distribution(0.9, 0.1), M.distribution(0.1, 0.9)].forEach(function (d) {
      [2, 3, 5].forEach(function (n) {
        var rule = M.adoptedRule(chosen, n, d), expected = 0, max = 0;
        for (var i = 0; i <= 200; i += 1) {
          var v = i / 200;
          close(M.evaluate(rule, v).q, M.evaluate(original, v).q, 1e-10);
          close(M.evaluate(rule, v).payment, M.evaluate(original, v).payment, 1e-10);
        }
        rule.pieces.forEach(function (p) {
          expected += n * M.pdf((p.v0 + p.v1) / 2, d) * simpson(function (v) { return M.evaluatePiece(p, v).payment; }, p.v0, p.v1, 1000);
        });
        close(rule.revenue, expected, 1e-9); close(rule.revenue, rule.paymentRevenue, 1e-10);
        for (var j = 0; j <= 5000; j += 1) {
          var u = j / 5000; max = Math.max(max, n * M.tailAt(rule.feasibility, u) - (1 - Math.pow(u, n)));
        }
        rule.pieces.forEach(function (p) {
          [p.u0, p.u1].forEach(function (u) { max = Math.max(max, n * M.tailAt(rule.feasibility, u) - (1 - Math.pow(u, n))); });
        });
        close(rule.feasibility.witness.excess, max, 2e-6);
      });
    });
  });
  T.run(tests, { title: "Ironing model tests" });
})();
