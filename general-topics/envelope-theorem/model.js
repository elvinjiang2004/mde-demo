(function (global) {
  "use strict";

  var EPSILON = 1e-9;
  var VERTICAL_SNAP_THRESHOLD = 0.01;

  var LABEL_POOL = ["A", "B", "C", "D", "E", "F", "G", "H"];
  var MIN_LINES = 1;
  var MAX_LINES = LABEL_POOL.length;

  var clamp = global.NumberUtils.clamp;

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

  function slopeOf(line) {
    var dt = line.p1.t - line.p0.t;
    if (dt === 0) {
      if (line.p1.v > line.p0.v) { return Infinity; }
      if (line.p1.v < line.p0.v) { return -Infinity; }
      return 0;
    }
    return (line.p1.v - line.p0.v) / dt;
  }

  function valueAt(line, t) {
    var dt = line.p1.t - line.p0.t;
    if (dt === 0) {
      return (line.p0.v + line.p1.v) / 2;
    }
    return line.p0.v + (line.p1.v - line.p0.v) * (t - line.p0.t) / dt;
  }

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

  function canAddLine(lines) {
    return lines.length < MAX_LINES;
  }

  function canRemoveLine(lines) {
    return lines.length > MIN_LINES;
  }

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
