(function (global) {
  "use strict";

  var EPSILON = 1e-9;
  // Once a drag brings a point's t within this distance of its own line's
  // other (untouched) point, movePoint snaps it to exactly that t -- a
  // genuine vertical line, infinite slope -- rather than letting it settle
  // at an ever-larger but still finite slope. This is a deliberate snap,
  // matching the perimeter snap in projectToEdge, not a numerical safety
  // margin: the module is meant to reach true verticality, not merely
  // approach it.
  var VERTICAL_SNAP_THRESHOLD = 0.01;

  // Lines are letter-labeled, not numbered, specifically to underline that
  // X carries no order or topology of its own -- the point of Milgrom and
  // Segal's "arbitrary choice sets" is that X need not be a subset of R^n
  // at all. The pool caps how many lines can exist at once.
  var LABEL_POOL = ["A", "B", "C", "D", "E", "F", "G", "H"];
  var MIN_LINES = 1;
  var MAX_LINES = LABEL_POOL.length;

  var clamp = global.NumberUtils.clamp;

  // A default family with two crossings, so the envelope shows three
  // segments (and two kinks) as soon as the page loads, before the learner
  // drags anything. Both points of every default line sit on the vertical
  // edges (t=0, t=1), the special case that reproduces the module's
  // original fixed-domain behavior.
  function defaultLines() {
    return [
      { id: "A", p0: { t: 0, v: 0.2 }, p1: { t: 1, v: 0.8 } },
      { id: "B", p0: { t: 0, v: 0.9 }, p1: { t: 1, v: 0.3 } },
      { id: "C", p0: { t: 0, v: 0.6 }, p1: { t: 1, v: 0.6 } }
    ];
  }

  function nextLabel(lines) {
    var used = {};
    lines.forEach(function (line) { used[line.id] = true; });
    var i;
    for (i = 0; i < LABEL_POOL.length; i += 1) {
      if (!used[LABEL_POOL[i]]) {
        return LABEL_POOL[i];
      }
    }
    return null;
  }

  // A vertical line (p1.t === p0.t exactly, reached only via movePoint's
  // own snap) has no finite slope; its sign is taken from which endpoint
  // is higher, independent of which of p0/p1 that happens to be.
  function slopeOf(line) {
    var dt = line.p1.t - line.p0.t;
    if (dt === 0) {
      if (line.p1.v > line.p0.v) { return Infinity; }
      if (line.p1.v < line.p0.v) { return -Infinity; }
      return 0;
    }
    return (line.p1.v - line.p0.v) / dt;
  }

  // Deliberately *not* restricted to [p0.t, p1.t]: this is the line's own
  // affine formula, extended to the whole domain, since computeEnvelope
  // searches for the envelope universally rather than only where each
  // line was actually drawn. For a vertical line this has no single
  // well-defined value; callers should check slopeOf first, since
  // computeEnvelope/V never call valueAt on a vertical line.
  function valueAt(line, t) {
    var dt = line.p1.t - line.p0.t;
    if (dt === 0) {
      return (line.p0.v + line.p1.v) / 2;
    }
    return line.p0.v + (line.p1.v - line.p0.v) * (t - line.p0.t) / dt;
  }

  // The nearest point on the plot's own perimeter (all four edges) to a raw
  // (t,v), clamped into [0,1] first. Ties are broken in a fixed order
  // (left, right, bottom, top) using an epsilon-tolerant comparison rather
  // than exact equality -- an exact tie such as (0.1, 0.9) has left
  // distance 0.1 and top distance 1-0.9, which are mathematically equal
  // but not bit-for-bit equal in IEEE 754, so comparing against the raw
  // minimum plus a small tolerance is what actually makes the tie-break
  // order deterministic. The four regions this partitions the square into
  // are exactly separated by its two diagonals, which the main panel draws
  // faintly as a visual guide to where a drag will snap.
  function projectToEdge(t, v) {
    var ct = clamp(t, 0, 1);
    var cv = clamp(v, 0, 1);
    var distLeft = ct;
    var distRight = 1 - ct;
    var distBottom = cv;
    var distTop = 1 - cv;
    var minDist = Math.min(distLeft, distRight, distBottom, distTop);
    if (distLeft <= minDist + EPSILON) { return { t: 0, v: cv }; }
    if (distRight <= minDist + EPSILON) { return { t: 1, v: cv }; }
    if (distBottom <= minDist + EPSILON) { return { t: ct, v: 0 }; }
    return { t: ct, v: 1 };
  }

  // Exact crossing t, in the open interval (0,1), of two lines' own affine
  // formulas extended universally -- not restricted to either line's own
  // [p0.t,p1.t] -- or null if they are parallel (including identical), one
  // of them is vertical (not affine, so this formula does not apply), or
  // the crossing falls outside (0,1). Solved directly from the two
  // point-slope forms, so this is closed form, never a numerical search,
  // even though each line's own p0.t may not be 0.
  function crossing(lineA, lineB) {
    var slopeA = slopeOf(lineA);
    var slopeB = slopeOf(lineB);
    if (!Number.isFinite(slopeA) || !Number.isFinite(slopeB)) {
      return null;
    }
    var denom = slopeA - slopeB;
    if (Math.abs(denom) < EPSILON) {
      return null;
    }
    var t = (lineB.p0.v - lineA.p0.v + slopeA * lineA.p0.t - slopeB * lineB.p0.t) / denom;
    if (t <= EPSILON || t >= 1 - EPSILON) {
      return null;
    }
    return t;
  }

  // The upper envelope over t in [0,1], searched universally: every line
  // with a finite slope is treated as defined for the whole domain (its
  // own extension, not merely the segment the learner actually drew), so
  // there is always a well-defined maximizer among the finite-slope lines
  // -- no gaps. Vertical (infinite-slope) lines are excluded from this
  // search entirely, since they are not affine functions of t and cannot
  // meaningfully "win" a positive-width interval; they are tracked
  // separately (see summarize) and displayed on their own.
  function V(lines, t) {
    var best = -Infinity;
    lines.forEach(function (line) {
      var slope = slopeOf(line);
      if (Number.isFinite(slope)) {
        var value = valueAt(line, t);
        if (value > best) {
          best = value;
        }
      }
    });
    return best;
  }

  // The upper envelope of finitely many universally-extended lines is
  // itself exactly piecewise-linear: between any two consecutive pairwise
  // crossings the ranking cannot change, so evaluating every finite-slope
  // line once at each sub-interval's midpoint identifies its winner
  // exactly, with no sampling or search. Segment values are the winning
  // line's own extrapolated value, which may fall outside [0,1] -- display
  // code is responsible for clamping, not this function, which reports the
  // true envelope. Adjacent sub-intervals sharing a winner are merged.
  function computeEnvelope(lines) {
    var finiteLines = [];
    var originalIndex = [];
    lines.forEach(function (line, index) {
      if (Number.isFinite(slopeOf(line))) {
        finiteLines.push(line);
        originalIndex.push(index);
      }
    });
    if (finiteLines.length === 0) {
      return [];
    }

    var breakpoints = [0, 1];
    var i;
    var j;
    for (i = 0; i < finiteLines.length; i += 1) {
      for (j = i + 1; j < finiteLines.length; j += 1) {
        var t = crossing(finiteLines[i], finiteLines[j]);
        if (t !== null) {
          breakpoints.push(t);
        }
      }
    }
    breakpoints = breakpoints.filter(function (t) { return t >= -EPSILON && t <= 1 + EPSILON; });
    breakpoints.sort(function (a, b) { return a - b; });
    var unique = [];
    breakpoints.forEach(function (t) {
      if (unique.length === 0 || t - unique[unique.length - 1] > EPSILON) {
        unique.push(t);
      }
    });

    var raw = [];
    for (i = 0; i < unique.length - 1; i += 1) {
      var t0 = unique[i];
      var t1 = unique[i + 1];
      var mid = (t0 + t1) / 2;
      var winner = 0;
      var bestValue = -Infinity;
      finiteLines.forEach(function (line, index) {
        var value = valueAt(line, mid);
        if (value > bestValue) {
          bestValue = value;
          winner = index;
        }
      });
      var winnerLine = finiteLines[winner];
      raw.push({
        t0: t0, t1: t1, lineIndex: originalIndex[winner], id: winnerLine.id,
        v0: valueAt(winnerLine, t0), v1: valueAt(winnerLine, t1),
        slope: slopeOf(winnerLine)
      });
    }

    var merged = [];
    raw.forEach(function (segment) {
      var last = merged[merged.length - 1];
      if (last && last.lineIndex === segment.lineIndex) {
        last.t1 = segment.t1;
        last.v1 = segment.v1;
      } else {
        merged.push(segment);
      }
    });
    return merged;
  }

  // The kinks are exactly the joints between consecutive merged segments:
  // genuine argmax switches, each with the two one-sided slopes on either
  // side. Since computeEnvelope no longer produces gaps, every joint is a
  // genuine kink.
  function computeKinks(segments) {
    var kinks = [];
    var i;
    for (i = 0; i < segments.length - 1; i += 1) {
      kinks.push({
        t: segments[i].t1,
        value: segments[i].v1,
        leftSlope: segments[i].slope,
        rightSlope: segments[i + 1].slope
      });
    }
    return kinks;
  }

  // --- Line-set editing ---------------------------------------------

  function canAddLine(lines) {
    return lines.length < MAX_LINES;
  }

  function canRemoveLine(lines) {
    return lines.length > MIN_LINES;
  }

  // A new line opens flat, spanning the full domain at the family's
  // current average value, so it is clearly visible without instantly
  // dominating the envelope; the learner then drags it into shape.
  function addLine(lines) {
    if (!canAddLine(lines)) {
      return { lines: lines, addedId: null };
    }
    var id = nextLabel(lines);
    var total = 0;
    var count = 0;
    lines.forEach(function (line) {
      total += line.p0.v + line.p1.v;
      count += 2;
    });
    var mid = count > 0 ? total / count : 0.5;
    var next = lines.concat([{ id: id, p0: { t: 0, v: mid }, p1: { t: 1, v: mid } }]);
    return { lines: next, addedId: id };
  }

  function removeLine(lines, id) {
    if (!canRemoveLine(lines)) {
      return lines;
    }
    return lines.filter(function (line) { return line.id !== id; });
  }

  // Moves whichever of a line's two points is targeted ("p0" or "p1") to
  // the nearest point on the plot's perimeter to the given raw (t,v). If
  // that lands within VERTICAL_SNAP_THRESHOLD of the line's *other* point
  // (in t), it snaps to exactly that t instead, producing a genuine
  // vertical line -- see slopeOf.
  function movePoint(lines, id, which, rawT, rawV) {
    return lines.map(function (line) {
      if (line.id !== id) {
        return line;
      }
      var other = which === "p0" ? line.p1 : line.p0;
      var projected = projectToEdge(rawT, rawV);
      if (Math.abs(projected.t - other.t) < VERTICAL_SNAP_THRESHOLD) {
        projected = { t: other.t, v: projected.v };
      }
      var next = { id: line.id, p0: line.p0, p1: line.p1 };
      next[which] = projected;
      return next;
    });
  }

  function summarize(lines) {
    var segments = computeEnvelope(lines);
    var kinks = computeKinks(segments);
    var infiniteLines = lines.filter(function (line) {
      return !Number.isFinite(slopeOf(line));
    });
    return {
      lines: lines,
      segments: segments,
      kinks: kinks,
      infiniteLines: infiniteLines
    };
  }

  global.EnvelopeTheoremModel = Object.freeze({
    EPSILON: EPSILON,
    VERTICAL_SNAP_THRESHOLD: VERTICAL_SNAP_THRESHOLD,
    LABEL_POOL: LABEL_POOL,
    MIN_LINES: MIN_LINES,
    MAX_LINES: MAX_LINES,
    clamp: clamp,
    defaultLines: defaultLines,
    nextLabel: nextLabel,
    slopeOf: slopeOf,
    valueAt: valueAt,
    projectToEdge: projectToEdge,
    crossing: crossing,
    V: V,
    computeEnvelope: computeEnvelope,
    computeKinks: computeKinks,
    canAddLine: canAddLine,
    canRemoveLine: canRemoveLine,
    addLine: addLine,
    removeLine: removeLine,
    movePoint: movePoint,
    summarize: summarize
  });
})(window);
