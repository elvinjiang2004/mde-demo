(function (global) {
  "use strict";
  var clamp = NumberUtils.clamp, TOL = 1e-9;
  function bisect(fn, lower, upper) {
    var leftValue = fn(lower);
    for (var i = 0; i < 55; i += 1) {
      var mid = (lower + upper) / 2, value = fn(mid);
      if (leftValue * value <= 0) { upper = mid; }
      else { lower = mid; leftValue = value; }
    }
    return (lower + upper) / 2;
  }
  function distribution(split, mass) {
    if (!Number.isFinite(split) || !Number.isFinite(mass) || split <= 0 || split >= 1 || mass <= 0 || mass >= 1) {
      throw new Error("The breakpoint and lower-interval probability must lie strictly between 0 and 1.");
    }
    return Object.freeze({ split: split, mass: mass, lowerDensity: mass / split, upperDensity: (1 - mass) / (1 - split) });
  }
  var DEFAULT = distribution(0.5, 0.75);
  function cdf(v, d) {
    d = d || DEFAULT; v = clamp(v, 0, 1);
    if (v === 0 || v === 1) { return v; }
    return v <= d.split ? d.lowerDensity * v : d.mass + d.upperDensity * (v - d.split);
  }
  function pdf(v, d, side) {
    d = d || DEFAULT;
    return v < d.split || (v === d.split && side === "left") ? d.lowerDensity : d.upperDensity;
  }
  function phi(v, d, side) {
    d = d || DEFAULT;
    return 2 * v - (v < d.split || (v === d.split && side === "left") ? d.split / d.mass : 1);
  }
  function quantile(u, d) {
    d = d || DEFAULT; u = clamp(u, 0, 1);
    if (u === 0 || u === 1) { return u; }
    return u <= d.mass ? u / d.lowerDensity : d.split + (u - d.mass) / d.upperDensity;
  }
  function primitive(v, d) {
    d = d || DEFAULT;
    if (v <= d.split) { return d.lowerDensity * v * v / 2; }
    var t = v - d.split;
    return d.mass * d.split / 2 + d.mass * t + d.upperDensity * t * t / 2;
  }
  function validate(points, n) {
    if (!Number.isInteger(n) || n < 2 || n > 5) { throw new Error("Choose 2 to 5 bidders."); }
    if (!Array.isArray(points) || points.length < 2 || points[0].v !== 0 || points[points.length - 1].v !== 1) {
      throw new Error("The allocation must cover [0,1].");
    }
    points.forEach(function (p, i) {
      if (!Number.isFinite(p.v) || !Number.isFinite(p.q) || p.v < 0 || p.v > 1 || p.q < 0 || p.q > 1 ||
          (i && p.v < points[i - 1].v) || (i > 1 && p.v === points[i - 2].v)) {
        throw new Error("Use ordered values and probabilities in [0,1], with at most two points at a jump.");
      }
    });
  }
  function controlValues(d) {
    var values = [d.split];
    for (var i = 0; i <= 10; i += 1) { values.push(i / 10); }
    return values.sort(function (a, b) { return a - b; }).filter(function (v, j, all) {
      return !j || v !== all[j - 1];
    });
  }
  function initial(n, d) {
    d = d || DEFAULT;
    return controlValues(d).map(function (v) { return { v: v, q: 2 * cdf(v, d) / n }; });
  }
  function pieces(points, d) {
    d = d || DEFAULT;
    var result = [], utility = 0;
    points.slice(1).forEach(function (right, i) {
      var left = points[i];
      if (right.v === left.v) { return; }
      var valueSlope = (right.q - left.q) / (right.v - left.v), cuts = [left.v, right.v];
      if (d.split > left.v && d.split < right.v) { cuts.splice(1, 0, d.split); }
      cuts.slice(1).forEach(function (b, j) {
        var a = cuts[j], q0 = left.q + valueSlope * (a - left.v), q1 = left.q + valueSlope * (b - left.v);
        result.push({ v0: a, v1: b, u0: cdf(a, d), u1: cdf(b, d), q0: q0, q1: q1,
          valueSlope: valueSlope, density: pdf((a + b) / 2, d), utility0: utility });
        utility += (q0 + q1) * (b - a) / 2;
      });
    });
    return result;
  }
  function evaluatePiece(p, v) {
    if (p.coefficients) {
      var z = (v - p.v0) / (p.v1 - p.v0), allocation = polynomial(p.coefficients, z);
      var rent = p.utility0 + (p.v1 - p.v0) * integral(p.coefficients, z);
      return { q: allocation, utility: rent, payment: v * allocation - rent };
    }
    var t = v - p.v0, q = p.q0 + p.valueSlope * t;
    var utility = p.utility0 + p.q0 * t + p.valueSlope * t * t / 2;
    return { q: q, utility: utility, payment: v * q - utility };
  }
  function evaluate(rule, v) {
    v = clamp(v, 0, 1);
    var p = rule.pieces.find(function (piece) { return v < piece.v1; }) || rule.pieces[rule.pieces.length - 1];
    var value = evaluatePiece(p, v);
    var exact = rule.points.filter(function (point) { return point.v === v; });
    if (exact.length) { value.q = exact[exact.length - 1].q; value.payment = v * value.q - value.utility; }
    return value;
  }
  function segment(u0, u1, q0, q1) { return { u0: u0, u1: u1, q0: q0, q1: q1 }; }
  // Ascending rearrangement: ramp pieces contribute uniform Q mass; flat pieces are atoms.
  function rearrange(source) {
    var heights = [], result = [], mass = 0;
    source.forEach(function (p) { heights.push(p.q0, p.q1); });
    heights = heights.sort(function (a, b) { return a - b; }).filter(function (x, i, a) { return !i || x !== a[i - 1]; });
    heights.forEach(function (height, i) {
      var atom = 0;
      source.forEach(function (p) { if (p.q0 === height && p.q1 === height) { atom += p.u1 - p.u0; } });
      if (atom > 0) { result.push(segment(mass, mass + atom, height, height)); mass += atom; }
      if (i === heights.length - 1) { return; }
      var next = heights[i + 1], density = 0;
      source.forEach(function (p) {
        if (Math.min(p.q0, p.q1) <= height && Math.max(p.q0, p.q1) >= next && p.q0 !== p.q1) {
          density += (p.u1 - p.u0) / Math.abs(p.q1 - p.q0);
        }
      });
      var length = density * (next - height);
      if (length > 0) { result.push(segment(mass, mass + length, height, next)); mass += length; }
    });
    result[result.length - 1].u1 = 1;
    return result;
  }
  function stationary(p, n) {
    var slope = (p.q1 - p.q0) / (p.u1 - p.u0), intercept = p.q0 - slope * p.u0;
    var fn = function (u) { return intercept + slope * u - Math.pow(u, n - 1); };
    var cuts = [p.u0, p.u1], roots = [];
    if (n > 2 && slope > 0) {
      var critical = Math.pow(slope / (n - 1), 1 / (n - 2));
      if (critical > p.u0 && critical < p.u1) { cuts.splice(1, 0, critical); }
    }
    cuts.forEach(function (u) { if (Math.abs(fn(u)) < 1e-13) { roots.push(u); } });
    cuts.slice(1).forEach(function (u, i) {
      if (fn(cuts[i]) * fn(u) < 0) { roots.push(bisect(fn, cuts[i], u)); }
    });
    return roots;
  }
  function constraints(source, n) {
    var tail = 0, max = { excess: 0, u: 1, q: 1 }, result = [];
    source.slice().reverse().forEach(function (p) {
      var width = p.u1 - p.u0, slope = (p.q1 - p.q0) / width;
      var tailAt = function (u) {
        var d = p.u1 - u;
        return tail + p.q1 * d - slope * d * d / 2;
      };
      var excessAt = function (u) { return n * tailAt(u) - (1 - Math.pow(u, n)); };
      [p.u0, p.u1].concat(stationary(p, n)).forEach(function (u) {
        var excess = excessAt(u);
        if (excess > max.excess) { max = { excess: excess, u: u, q: p.q0 + slope * (u - p.u0) }; }
      });
      result.unshift({ u0: p.u0, u1: p.u1, q0: p.q0, q1: p.q1, tailAbove: tail });
      tail += width * (p.q0 + p.q1) / 2;
    });
    return { feasible: max.excess <= TOL, witness: max, segments: result, saleProbability: n * tail };
  }
  function tailAt(check, u) {
    var p = check.segments.find(function (x) { return u <= x.u1; }) || check.segments[check.segments.length - 1];
    if (p.coefficients) {
      return p.tailAbove + (p.u1 - p.u0) * (integral(p.coefficients, 1) - integral(p.coefficients, (u - p.u0) / (p.u1 - p.u0)));
    }
    var d = p.u1 - u, slope = (p.q1 - p.q0) / (p.u1 - p.u0);
    return p.tailAbove + p.q1 * d - slope * d * d / 2;
  }
  // Allocation-level sets include ties; the right limit excludes an entire flat level.
  function levelAt(rule, alpha, side) {
    if (!Number.isFinite(alpha) || alpha < 0 || alpha > 1) {
      throw new Error("The allocation threshold must lie in [0,1].");
    }
    var check = rule.feasibility, strict = side === "right", u = 1;
    for (var i = 0; i < check.segments.length; i += 1) {
      var p = check.segments[i];
      if (p.q0 === p.q1) {
        if (p.q0 > alpha || (!strict && p.q0 === alpha)) { u = p.u0; break; }
      } else if (alpha <= p.q0) {
        u = p.u0; break;
      } else if (alpha < p.q1) {
        var z = p.coefficients ? bisect(function (t) { return polynomial(p.coefficients, t) - alpha; }, 0, 1) :
          (alpha - p.q0) / (p.q1 - p.q0);
        u = p.u0 + (p.u1 - p.u0) * z; break;
      }
    }
    var mass = clamp(1 - u, 0, 1);
    return { mass: mass, allocation: mass ? tailAt(check, u) : 0,
      capacity: (1 - Math.pow(1 - mass, rule.n)) / rule.n };
  }
  // Split the level-set graph at extrema and crossings, independently of drawing samples.
  function feasibilityThresholds(rule) {
    var check = rule.feasibility, n = rule.n, levels = [0, 1, clamp(check.witness.q, 0, 1)];
    check.segments.forEach(function (p) {
      var width = p.u1 - p.u0, extrema;
      function allocation(u) {
        var z = (u - p.u0) / width;
        return p.coefficients ? polynomial(p.coefficients, z) : p.q0 + (p.q1 - p.q0) * z;
      }
      function add(u) { levels.push(clamp(allocation(u), 0, 1)); }
      function excess(u) { return n * tailAt(check, u) - (1 - Math.pow(u, n)); }
      if (p.coefficients) {
        var rank = affinePower(p.u0, width, n - 1);
        var diff = Array.from({ length: Math.max(rank.length, p.coefficients.length) }, function (_, i) {
          return (p.coefficients[i] || 0) - (rank[i] || 0);
        });
        extrema = polynomialRoots(diff).map(function (z) { return p.u0 + width * z; });
      } else { extrema = stationary(p, n); }
      var cuts = [p.u0].concat(extrema).concat([p.u1]).sort(function (a, b) { return a - b; })
        .filter(function (u, i, all) { return !i || u !== all[i - 1]; });
      cuts.forEach(add);
      cuts.slice(1).forEach(function (b, i) {
        var a = cuts[i];
        // Also split at the verdict tolerance, so every colored interval has one status.
        [0, TOL].forEach(function (target) {
          if ((excess(a) - target) * (excess(b) - target) < 0) {
            add(bisect(function (u) { return excess(u) - target; }, a, b));
          }
        });
      });
    });
    return levels.sort(function (a, b) { return a - b; })
      .filter(function (alpha, i, all) { return !i || alpha !== all[i - 1]; });
  }
  function diagnose(points, n, d) {
    d = d ? distribution(d.split, d.mass) : DEFAULT;
    validate(points, n);
    var source = pieces(points, d), monotone = true, witness = null, revenue = 0, paymentRevenue = 0;
    points.slice(1).forEach(function (p, i) {
      if (p.q < points[i].q - TOL) { monotone = false; witness = { from: points[i].v, to: p.v }; }
    });
    source.forEach(function (p) {
      var h = p.v1 - p.v0, b = p.valueSlope, f = p.density, phi0 = p.v0 - (1 - p.u0) / f;
      revenue += n * f * (phi0 * p.q0 * h + (phi0 * b + 2 * p.q0) * h * h / 2 + 2 * b * h * h * h / 3);
      paymentRevenue += n * f * ((p.v0 * p.q0 - p.utility0) * h + p.v0 * b * h * h / 2 + b * h * h * h / 6);
    });
    var tails = constraints(source, n), allSets = constraints(rearrange(source), n);
    return { points: points, pieces: source, n: n, distribution: d, monotone: monotone, monotonicityWitness: witness,
      tails: tails, feasibility: allSets, valid: monotone && allSets.feasible, revenue: revenue, paymentRevenue: paymentRevenue };
  }
  // H(u)=-(1-u)V(u). Each density piece gives a convex quadratic; a density drop needs one common supporting chord.
  function ironing(d) {
    d = d || DEFAULT;
    var intervals = [], c = d.split, p = d.mass;
    if (p > c) {
      var distance = (1 - c / p) / 2, ratio = Math.sqrt(d.lowerDensity / d.upperDensity);
      var x = distance / (1 + ratio), a = c - x, b = c + ratio * x;
      if (a < 0) {
        var root = Math.sqrt(1 - d.upperDensity);
        a = 0; b = root / (1 + root);
      }
      if (b - a > 1e-14) {
        var priority = 2 * b - 1;
        if (Math.abs(priority) < 1e-13) { priority = 0; }
        intervals.push({ a: a, b: b, lower: cdf(a, d), upper: cdf(b, d), virtual: priority });
      }
    }
    return { intervals: intervals, distribution: d };
  }
  function ironedPhi(v, solution) {
    var interval = solution.intervals.find(function (p) { return v >= p.a && v < p.b; });
    return interval ? interval.virtual : phi(v, solution.distribution);
  }
  // H(u)=integral_0^u phi(F^-1(s))ds=-(1-u)F^-1(u) for support [0,1].
  function integratedVirtual(u, d) {
    return -(1 - u) * quantile(u, d);
  }
  function convexIntegrated(u, solution) {
    var d = solution.distribution;
    var interval = solution.intervals.find(function (p) { return u >= p.lower && u <= p.upper; });
    if (!interval) { return integratedVirtual(u, d); }
    return ((interval.upper - u) * integratedVirtual(interval.lower, d) +
      (u - interval.lower) * integratedVirtual(interval.upper, d)) / (interval.upper - interval.lower);
  }
  function powerDifference(a, b, exponent) {
    // Stable even for very narrow ironing intervals.
    var sum = 0;
    for (var i = 0; i < exponent; i += 1) { sum += Math.pow(b, exponent - 1 - i) * Math.pow(a, i); }
    return (b - a) * sum;
  }
  function polynomial(c, z) {
    var value = 0;
    for (var i = c.length - 1; i >= 0; i -= 1) { value = value * z + c[i]; }
    return value;
  }
  function integral(c, z) {
    return c.reduce(function (sum, value, i) { return sum + value * Math.pow(z, i + 1) / (i + 1); }, 0);
  }
  function affinePower(a, b, exponent) {
    var c = [1];
    for (var i = 0; i < exponent; i += 1) {
      var next = new Array(c.length + 1).fill(0);
      c.forEach(function (value, j) { next[j] += a * value; next[j + 1] += b * value; }); c = next;
    }
    return c;
  }
  // Isolate all roots, including tangencies, on the normalized piece [0,1].
  function polynomialRoots(c) {
    c = c.slice();
    while (c.length > 1 && Math.abs(c[c.length - 1]) < 1e-14) { c.pop(); }
    if (c.length <= 1) { return []; }
    var derivative = c.slice(1).map(function (v, i) { return (i + 1) * v; });
    var cuts = [0].concat(polynomialRoots(derivative)).concat([1]), roots = [];
    cuts.forEach(function (z) { if (Math.abs(polynomial(c, z)) < 1e-12) { roots.push(z); } });
    cuts.slice(1).forEach(function (b, i) {
      var a = cuts[i];
      if (polynomial(c, a) * polynomial(c, b) < 0) { roots.push(bisect(function (z) { return polynomial(c, z); }, a, b)); }
    });
    return roots.sort(function (a, b) { return a - b; }).filter(function (z, i, all) { return !i || z - all[i - 1] > 1e-10; });
  }
  function optimalPoints(chosen) {
    var points = [];
    function value(part, v) {
      return part.kind === "rank" ? Math.pow(cdf(v, chosen.distribution), chosen.n - 1) : part.q;
    }
    // Computational knots remain in parts; handles mark maximal continuous
    // segments, with both one-sided endpoints retained at allocation jumps.
    chosen.parts.forEach(function (p, i) {
      if (!i) { points.push({ v: p.a, q: value(p, p.a) }); }
      var next = chosen.parts[i + 1], left = value(p, p.b);
      if (!next) { points.push({ v: p.b, q: left }); }
      else {
        var right = value(next, next.a);
        if (Math.abs(left - right) > 1e-12) {
          points.push({ v: p.b, q: left }); points.push({ v: next.a, q: right });
        }
      }
    });
    return points;
  }
  function efficient(n, d) {
    validate([{ v: 0, q: 0 }, { v: 1, q: 1 }], n);
    d = d ? distribution(d.split, d.mass) : DEFAULT;
    return { n: n, distribution: d, kind: "efficient",
      parts: [{ a: 0, b: d.split, kind: "rank" }, { a: d.split, b: 1, kind: "rank" }],
      points: controlValues(d).map(function (v) { return { v: v, q: Math.pow(cdf(v, d), n - 1) }; }) };
  }
  // Preserve the exact chosen analytic rule when the evaluation environment
  // changes. Its monotone polynomial pieces need no allocation rearrangement.
  function adoptedRule(chosen, n, d) {
    d = d || DEFAULT;
    var points = optimalPoints(chosen); validate(points, n);
    var source = [], utility = 0, revenue = 0, paymentRevenue = 0;
    chosen.parts.forEach(function (part) {
      var cuts = [part.a, part.b];
      if (d.split > part.a && d.split < part.b) { cuts.splice(1, 0, d.split); }
      cuts.slice(1).forEach(function (b, i) {
        var a = cuts[i], h = b - a, f = pdf((a + b) / 2, d);
        var c = part.kind === "rank" ? affinePower(cdf(a, chosen.distribution), pdf((a + b) / 2, chosen.distribution) * h, chosen.n - 1) : [part.q];
        var iq = integral(c, 1), izq = c.reduce(function (sum, v, j) { return sum + v / (j + 2); }, 0);
        source.push({ v0: a, v1: b, u0: cdf(a, d), u1: cdf(b, d), q0: polynomial(c, 0), q1: polynomial(c, 1), coefficients: c, utility0: utility });
        paymentRevenue += n * f * h * ((a - h) * iq + 2 * h * izq - utility);
        revenue += n * f * h * (phi(a, d) * iq + 2 * h * izq);
        utility += h * iq;
      });
    });
    var tail = 0, maximum = { excess: 0, u: 1, q: 1 }, segments = [];
    source.slice().reverse().forEach(function (p) {
      var width = p.u1 - p.u0, rank = affinePower(p.u0, width, n - 1);
      var diff = Array.from({ length: Math.max(rank.length, p.coefficients.length) }, function (_, i) { return (p.coefficients[i] || 0) - (rank[i] || 0); });
      [0, 1].concat(polynomialRoots(diff)).forEach(function (z) {
        var u = p.u0 + width * z;
        var excess = n * (tail + width * (integral(p.coefficients, 1) - integral(p.coefficients, z))) - (1 - Math.pow(u, n));
        if (excess > maximum.excess) { maximum = { excess: excess, u: u, q: polynomial(p.coefficients, z) }; }
      });
      segments.unshift(Object.assign({}, p, { tailAbove: tail })); tail += width * integral(p.coefficients, 1);
    });
    var check = { feasible: maximum.excess <= TOL, witness: maximum, segments: segments, saleProbability: n * tail };
    return { points: points, pieces: source, n: n, distribution: d, monotone: true, monotonicityWitness: null,
      feasibility: check, tails: check, valid: check.feasible, revenue: revenue, paymentRevenue: paymentRevenue, adopted: true };
  }
  function benchmark(n, d) {
    validate([{ v: 0, q: 0 }, { v: 1, q: 1 }], n);
    d = d ? distribution(d.split, d.mass) : DEFAULT;
    var solution = ironing(d), reserve;
    var allocatedPool = solution.intervals.find(function (p) { return p.virtual > 0; });
    if (solution.intervals.length && !allocatedPool) { reserve = 0.5; }
    else if (allocatedPool || d.mass >= 0.5) { reserve = d.split / (2 * d.mass); }
    else { reserve = Math.max(d.split, 0.5); }
    var pools = solution.intervals.filter(function (p) { return p.virtual > 0; }).map(function (p) {
      var sum = 0;
      for (var k = 0; k < n; k += 1) { sum += Math.pow(p.upper, n - 1 - k) * Math.pow(p.lower, k); }
      return Object.assign({}, p, { q: sum / n });
    });
    function allocation(v) {
      if (v < reserve) { return 0; }
      var pool = pools.find(function (p) { return v >= p.a && v < p.b; });
      return pool ? pool.q : Math.pow(cdf(v, d), n - 1);
    }
    var cuts = [0, d.split, reserve, 1];
    solution.intervals.forEach(function (p) { cuts.push(p.a, p.b); });
    cuts = cuts.sort(function (a, b) { return a - b; }).filter(function (v, i, all) { return !i || v !== all[i - 1]; });
    var revenue = 0, utility = 0, parts = [];
    cuts.slice(1).forEach(function (b, i) {
      var a = cuts[i], mid = (a + b) / 2, pool = pools.find(function (p) { return mid >= p.a && mid < p.b; });
      var part = { a: a, b: b, u0: cdf(a, d), u1: cdf(b, d), f: pdf(mid, d), utility0: utility,
        kind: mid < reserve ? "excluded" : (pool ? "pool" : "rank"), q: pool ? pool.q : 0 };
      parts.push(part);
      if (part.kind === "pool") {
        utility += part.q * (b - a);
        revenue += n * part.q * part.f * ((a - (1 - part.u0) / part.f) * (b - a) + (b - a) * (b - a));
      } else if (part.kind === "rank") {
        utility += powerDifference(part.u0, part.u1, n) / (n * part.f);
        var beta = a - (1 + part.u0) / part.f;
        revenue += 2 * n * powerDifference(part.u0, part.u1, n + 1) / ((n + 1) * part.f) +
          beta * powerDifference(part.u0, part.u1, n);
      }
    });
    function payment(v) {
      var part = parts.find(function (p) { return v < p.b; }) || parts[parts.length - 1], extra = 0;
      if (part.kind === "pool") { extra = part.q * (v - part.a); }
      else if (part.kind === "rank") { extra = powerDifference(part.u0, cdf(v, d), n) / (n * part.f); }
      return v * allocation(v) - part.utility0 - extra;
    }
    return { n: n, distribution: d, reserve: reserve, pools: pools, cuts: cuts, parts: parts, revenue: revenue,
      allocation: allocation, payment: payment, virtual: function (v) { return ironedPhi(v, solution); }, ironing: solution };
  }
  global.IroningModel = Object.freeze({ distribution: distribution, defaultDistribution: DEFAULT, cdf: cdf, pdf: pdf, phi: phi,
    quantile: quantile, primitive: primitive, initial: initial, validate: validate, pieces: pieces, evaluate: evaluate,
    evaluatePiece: evaluatePiece, diagnose: diagnose, tailAt: tailAt, levelAt: levelAt, feasibilityThresholds: feasibilityThresholds,
    ironing: ironing, ironedPhi: ironedPhi,
    integratedVirtual: integratedVirtual, convexIntegrated: convexIntegrated, benchmark: benchmark,
    adoptedRule: adoptedRule, optimalPoints: optimalPoints, efficient: efficient, tolerance: TOL });
})(window);
