(function (global) {
  "use strict";

  var EPSILON = 1e-9;
  // Violations are decided from a dense sample of a continuous inequality,
  // not from a handful of exactly-comparable grid values (contrast the
  // bilateral-trade module's interim-monotonicity check, which compares
  // finitely many exact cell averages) -- see findViolations below -- so
  // this tolerance is looser than that module's MONOTONICITY_TOLERANCE.
  var VIOLATION_TOLERANCE = 1e-3;
  var SAMPLES_PER_SEGMENT = 40;

  // The two endpoints v=0 and v=1 always exist (the domain must be fully
  // covered for the Hermite interpolant to be defined everywhere); "up to
  // nine points" therefore means up to seven interior points the learner
  // adds on top of those two. Nine (not ten) is deliberate: repeated adds
  // bisect the largest gap, and starting from the five default points that
  // sequence reaches a perfectly even 0.125 spacing at exactly nine points
  // (0, 0.125, 0.25, ..., 1) -- a tenth add would break that even spacing
  // by bisecting again down to an off-grid 0.0625, which is worth avoiding
  // rather than exposing as the normal end state of repeated adding.
  var MIN_TOTAL_POINTS = 2;
  var MAX_TOTAL_POINTS = 9;

  function clamp(value, lower, upper) {
    return Math.min(upper, Math.max(lower, value));
  }

  function clampHeight(value) {
    return clamp(value, 0, 1);
  }

  function sortedPoints(points) {
    return points.slice().sort(function (a, b) { return a.v - b.v; });
  }

  // Q(v) = v: a smooth, strictly increasing default, so the module opens on
  // a curve that already satisfies global IC everywhere, before the learner
  // paints or breaks anything.
  function defaultPoints() {
    return [0, 0.25, 0.5, 0.75, 1].map(function (v) {
      return { v: v, q: v };
    });
  }

  // --- Point-set editing -----------------------------------------------

  function canAddPoint(points) {
    return points.length < MAX_TOTAL_POINTS;
  }

  function canRemovePoint(points, index) {
    return points.length > MIN_TOTAL_POINTS && index > 0 && index < points.length - 1;
  }

  // Inserts a new interior point in the middle of whichever gap between
  // consecutive points is currently largest, so repeated adds spread out
  // rather than clustering. Its height is read off the curve's own current
  // value there, so adding a point never changes Q's shape at the instant
  // it is added -- only dragging it afterward does.
  function addPoint(points) {
    var sorted = sortedPoints(points);
    if (!canAddPoint(sorted)) {
      return { points: sorted, insertedIndex: -1 };
    }
    var curve = buildCurve(sorted);
    var bestGap = -1;
    var bestIndex = 0;
    var i;
    for (i = 0; i < sorted.length - 1; i += 1) {
      var gap = sorted[i + 1].v - sorted[i].v;
      if (gap > bestGap) {
        bestGap = gap;
        bestIndex = i;
      }
    }
    var newV = (sorted[bestIndex].v + sorted[bestIndex + 1].v) / 2;
    var newQ = curve.Q(newV);
    var next = sorted.slice();
    next.splice(bestIndex + 1, 0, { v: newV, q: newQ });
    return { points: next, insertedIndex: bestIndex + 1 };
  }

  function removePointAt(points, index) {
    if (!canRemovePoint(points, index)) {
      return points;
    }
    var next = points.slice();
    next.splice(index, 1);
    return next;
  }

  function setPointHeight(points, index, value) {
    var next = points.slice();
    next[index] = { v: next[index].v, q: clampHeight(value) };
    return next;
  }

  // --- Monotone cubic Hermite tangents (Fritsch-Carlson) ----------------
  //
  // Initial tangents are the average of adjacent secants; each segment's
  // pair of tangents is then rescaled (the classic alpha^2+beta^2<=9 test)
  // so the curve never overshoots a locally-monotone run of points, and
  // forced to zero at any point where the incoming and outgoing secants
  // have opposite signs -- a genuine local max/min *among the placed
  // points*, which the learner is free to create on purpose by dragging.
  // This is what makes the envelope panel trustworthy: the
  // curve between two points never wiggles beyond what the points
  // themselves imply, so a violation shown there is never a spline
  // artifact, and a real one is never hidden by one either.
  function monotoneTangents(points) {
    var n = points.length;
    var secants = new Array(n - 1);
    var i;
    for (i = 0; i < n - 1; i += 1) {
      var dv = points[i + 1].v - points[i].v;
      secants[i] = dv > EPSILON ? (points[i + 1].q - points[i].q) / dv : 0;
    }

    var tangents = new Array(n);
    tangents[0] = secants[0];
    tangents[n - 1] = secants[n - 2];
    for (i = 1; i < n - 1; i += 1) {
      if (secants[i - 1] === 0 || secants[i] === 0 ||
          (secants[i - 1] > 0) !== (secants[i] > 0)) {
        tangents[i] = 0;
      } else {
        tangents[i] = (secants[i - 1] + secants[i]) / 2;
      }
    }

    for (i = 0; i < n - 1; i += 1) {
      if (secants[i] === 0) {
        tangents[i] = 0;
        tangents[i + 1] = 0;
      } else {
        var alpha = tangents[i] / secants[i];
        var beta = tangents[i + 1] / secants[i];
        var normSquared = alpha * alpha + beta * beta;
        if (normSquared > 9) {
          var scale = 3 / Math.sqrt(normSquared);
          tangents[i] = scale * alpha * secants[i];
          tangents[i + 1] = scale * beta * secants[i];
        }
      }
    }
    return tangents;
  }

  function findSegment(points, v) {
    var n = points.length;
    if (v <= points[0].v) { return 0; }
    if (v >= points[n - 1].v) { return n - 2; }
    var i;
    for (i = 0; i < n - 1; i += 1) {
      if (v <= points[i + 1].v) { return i; }
    }
    return n - 2;
  }

  // Cubic Hermite basis functions on t in [0,1], and their exact
  // antiderivatives (so U(v) below is a closed-form quartic, not a
  // numerical quadrature of Q).
  function h00(t) { var t2 = t * t; return 2 * t2 * t - 3 * t2 + 1; }
  function h10(t) { var t2 = t * t; return t2 * t - 2 * t2 + t; }
  function h01(t) { var t2 = t * t; return -2 * t2 * t + 3 * t2; }
  function h11(t) { var t2 = t * t; return t2 * t - t2; }

  function H00(t) { var t2 = t * t; return t2 * t2 / 2 - t2 * t + t; }
  function H10(t) { var t2 = t * t; return t2 * t2 / 4 - (2 / 3) * t2 * t + t2 / 2; }
  function H01(t) { var t2 = t * t; return -t2 * t2 / 2 + t2 * t; }
  function H11(t) { var t2 = t * t; return t2 * t2 / 4 - t2 * t / 3; }

  function buildCurve(points) {
    var tangents = monotoneTangents(points);
    var last = points.length - 1;

    function segmentAt(v) {
      var vv = clamp(v, points[0].v, points[last].v);
      var seg = findSegment(points, vv);
      var p0 = points[seg];
      var p1 = points[seg + 1];
      var h = p1.v - p0.v;
      var t = h > EPSILON ? (vv - p0.v) / h : 0;
      return { seg: seg, p0: p0, p1: p1, h: h, t: t };
    }

    function Q(v) {
      var s = segmentAt(v);
      var m0 = tangents[s.seg];
      var m1 = tangents[s.seg + 1];
      return clampHeight(
        s.p0.q * h00(s.t) + s.h * m0 * h10(s.t) +
        s.p1.q * h01(s.t) + s.h * m1 * h11(s.t)
      );
    }

    // Exact definite integral of the Hermite segment `seg` from its own
    // start out to local parameter t -- a closed-form quartic evaluation,
    // not a numerical quadrature.
    function segmentIntegral(seg, t) {
      var p0 = points[seg];
      var p1 = points[seg + 1];
      var h = p1.v - p0.v;
      var m0 = tangents[seg];
      var m1 = tangents[seg + 1];
      return h * (
        p0.q * H00(t) + h * m0 * H10(t) +
        p1.q * H01(t) + h * m1 * H11(t)
      );
    }

    var cumulativeIntegrals = [0];
    var segmentIndex;
    for (segmentIndex = 0; segmentIndex < last - 1; segmentIndex += 1) {
      cumulativeIntegrals.push(
        cumulativeIntegrals[segmentIndex] + segmentIntegral(segmentIndex, 1)
      );
    }

    function U(v) {
      var s = segmentAt(v);
      return cumulativeIntegrals[s.seg] + segmentIntegral(s.seg, s.t);
    }

    function P(v) {
      return v * Q(v) - U(v);
    }

    return {
      points: points,
      tangents: tangents,
      Q: Q,
      U: U,
      P: P
    };
  }

  function buildSampleGrid(points, perSegment) {
    var samples = [];
    var n = points.length;
    var i;
    var k;
    for (i = 0; i < n - 1; i += 1) {
      var v0 = points[i].v;
      var v1 = points[i + 1].v;
      for (k = i === 0 ? 0 : 1; k <= perSegment; k += 1) {
        samples.push(v0 + (v1 - v0) * (k / perSegment));
      }
    }
    return samples;
  }

  // For every control point r, treat it as a candidate deviation report:
  // the deviation payoff line is ell(v) = (v - r)*Q(r) + U(r) (the line
  // through (r, U(r)) with slope Q(r), i.e. v*Q(r) - P(r) rewritten so it
  // needs no separate P lookup). Local IC guarantees U touches this line
  // exactly at v=r; global IC additionally requires the line never rise
  // above U anywhere else. Whether it does is answered by sampling densely
  // rather than by exact root-finding -- U - ell is a quartic per segment,
  // and locating its exact extrema would need solving a cubic -- so this
  // one check, unlike Q/U/P themselves, is a numerical search rather than
  // a closed form.
  function findViolations(points, curve) {
    var samples = buildSampleGrid(points, SAMPLES_PER_SEGMENT).map(function (v) {
      return { v: v, u: curve.U(v) };
    });
    return points.map(function (r) {
      var qr = curve.Q(r.v);
      var ur = curve.U(r.v);
      var violates = samples.some(function (sample) {
        var ell = (sample.v - r.v) * qr + ur;
        return ell - sample.u > VIOLATION_TOLERANCE;
      });
      return {
        v: r.v,
        q: qr,
        u: ur,
        violates: violates
      };
    });
  }

  function summarize(points) {
    var sorted = sortedPoints(points);
    var curve = buildCurve(sorted);
    var violations = findViolations(sorted, curve);
    var violationCount = violations.filter(function (v) { return v.violates; }).length;
    return {
      points: sorted,
      curve: curve,
      violations: violations,
      icHolds: violationCount === 0,
      violationCount: violationCount
    };
  }

  global.PaymentsFromAllocationRuleModel = Object.freeze({
    EPSILON: EPSILON,
    VIOLATION_TOLERANCE: VIOLATION_TOLERANCE,
    MIN_TOTAL_POINTS: MIN_TOTAL_POINTS,
    MAX_TOTAL_POINTS: MAX_TOTAL_POINTS,
    clamp: clamp,
    clampHeight: clampHeight,
    sortedPoints: sortedPoints,
    defaultPoints: defaultPoints,
    canAddPoint: canAddPoint,
    canRemovePoint: canRemovePoint,
    addPoint: addPoint,
    removePointAt: removePointAt,
    setPointHeight: setPointHeight,
    monotoneTangents: monotoneTangents,
    buildCurve: buildCurve,
    findViolations: findViolations,
    summarize: summarize
  });
})(window);
