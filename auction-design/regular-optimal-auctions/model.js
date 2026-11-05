"use strict";

// Exact integration of constant lotteries on split triangles; see architecture.md.
window.OptimalAuctionsModel = (function () {
  var N = 20;
  var H = 1 / N;
  var EPS = 1e-10;

  function lottery(q1, q2) {
    if (!NumberUtils.isFiniteNumber(q1) || !NumberUtils.isFiniteNumber(q2) ||
        q1 < 0 || q2 < 0 || q1 + q2 > 1) {
      throw new RangeError("Allocation probabilities must be nonnegative and sum to at most one.");
    }
    return [q1, q2];
  }

  function gridFrom(fn) {
    var grid = { lower: [], upper: [] };
    ["lower", "upper"].forEach(function (half) {
      for (var i = 0; i < N; i += 1) {
        grid[half][i] = [];
        for (var j = 0; j < N; j += 1) {
          var v1 = (i + (half === "lower" ? 2 / 3 : 1 / 3)) * H;
          var v2 = (j + (half === "lower" ? 1 / 3 : 2 / 3)) * H;
          var q = fn(v1, v2, i, j, half);
          grid[half][i][j] = lottery(q[0], q[1]);
        }
      }
    });
    return grid;
  }

  function validate(grid) {
    ["lower", "upper"].forEach(function (half) {
      if (!grid || !Array.isArray(grid[half]) || grid[half].length !== N) {
        throw new TypeError("Expected a 20 by 20 split-triangle grid.");
      }
      grid[half].forEach(function (row) {
        if (!Array.isArray(row) || row.length !== N) { throw new TypeError("Invalid grid row."); }
        row.forEach(function (q) {
          if (!Array.isArray(q) || q.length !== 2) { throw new TypeError("Invalid lottery."); }
          lottery(q[0], q[1]);
        });
      });
    });
    return grid;
  }

  function distribution(shifts) {
    shifts = shifts === undefined ? [0, 0] : shifts;
    if (!Array.isArray(shifts) || shifts.length !== 2) { throw new TypeError("Expected two distribution shifts."); }
    return shifts.map(function (shift) {
      if (!NumberUtils.isFiniteNumber(shift) || shift < 0 || shift > 1 || Math.abs(shift * 10 - Math.round(shift * 10)) > EPS) {
        throw new RangeError("Distribution shifts must be in [0,1] in steps of 0.1.");
      }
      return Math.round(shift * 10) / 10;
    });
  }

  function preset(name, shifts) {
    if (["efficient", "optimal", "empty", "equal"].indexOf(name) < 0) {
      throw new RangeError("Unknown allocation preset.");
    }
    var steps = distribution(shifts).map(function (shift) { return Math.round(shift * 10); });
    return gridFrom(function (z1, z2, i, j, half) {
      if (name === "empty") { return [0, 0]; }
      if (name === "equal") { return [0.5, 0.5]; }
      // Integer-scaled centroid scores avoid rounding at aligned boundaries.
      var factor = name === "optimal" ? 3 : 6;
      var one = 3 * i + (half === "lower" ? 2 : 1) + factor * steps[0];
      var two = 3 * j + (half === "lower" ? 1 : 2) + factor * steps[1];
      if (name === "optimal" && Math.max(one, two) < 30) { return [0, 0]; }
      return one >= two ? [1, 0] : [0, 1];
    });
  }

  function cellAt(v1, v2) {
    if (!NumberUtils.isFiniteNumber(v1) || !NumberUtils.isFiniteNumber(v2) ||
        v1 < 0 || v1 > 1 || v2 < 0 || v2 > 1) { throw new RangeError("Reports must be in [0,1]."); }
    var i = Math.min(N - 1, Math.floor(v1 * N));
    var j = Math.min(N - 1, Math.floor(v2 * N));
    return { i: i, j: j, half: v1 - i * H >= v2 - j * H ? "lower" : "upper" };
  }

  function allocationAt(grid, v1, v2) {
    var cell = cellAt(v1, v2);
    return grid[cell.half][cell.i][cell.j].slice();
  }

  function virtualValue(v, shift) { return 2 * v - (shift || 0) - 1; }

  function interim(grid, bidder, shift) {
    var pieces = [];
    var offset = Math.round(shift * N);
    for (var k = 0; k < N; k += 1) {
      var start = 0;
      var slope = 0;
      for (var other = 0; other < N; other += 1) {
        var lower = bidder === 0 ? grid.lower[k][other][0] : grid.lower[other][k][1];
        var upper = bidder === 0 ? grid.upper[k][other][0] : grid.upper[other][k][1];
        start += H * (bidder === 0 ? upper : lower);
        slope += bidder === 0 ? lower - upper : upper - lower;
      }
      pieces.push({ a: (offset + k) / N, b: (offset + k + 1) / N,
        shift: shift, start: start, slope: slope });
    }
    var agent = integrateInterim(pieces);
    agent.shift = shift;
    return agent;
  }

  function integrateInterim(pieces) {
    var integral = 0;
    var expectedPayment = 0;
    var virtualSurplus = 0;
    var allocationProbability = 0;
    var violations = [];
    pieces.forEach(function (piece, k) {
      var a = piece.a, width = piece.b - a, start = piece.start, slope = piece.slope;
      var end = start + slope * width;
      // Local t = v-a: Q=A+Bt, U=I+At+Bt^2/2, P=vQ-U.
      var p = [a * start - integral, a * slope, slope / 2];
      piece.end = end; piece.utility = integral; piece.payment = p;
      if (end < start - EPS) { violations.push({ kind: "slope", a: a, b: piece.b }); }
      if (k > 0 && start < pieces[k - 1].end - EPS) {
        violations.push({ kind: "jump", a: a, b: a });
      }
      var mass = width * start + slope * width * width / 2;
      integral += mass;
      allocationProbability += mass;
      expectedPayment += p[0] * width + p[1] * width * width / 2 + p[2] * width * width * width / 3;
      var phi = virtualValue(a, piece.shift);
      virtualSurplus += phi * start * width +
        (phi * slope + 2 * start) * width * width / 2 + 2 * slope * width * width * width / 3;
    });
    return { pieces: pieces, expectedPayment: expectedPayment, virtualSurplus: virtualSurplus,
      allocationProbability: allocationProbability, bic: violations.length === 0, violations: violations };
  }

  function evaluatePiece(piece, v) {
    var t = v - piece.a;
    var q = piece.start + piece.slope * t;
    var u = piece.utility + piece.start * t + piece.slope * t * t / 2;
    var p = piece.payment;
    return { value: v, allocation: q, utility: u, payment: p[0] + p[1] * t + p[2] * t * t,
      virtual: virtualValue(v, piece.shift) };
  }

  function evaluate(agent, v) {
    var shift = agent.shift || 0;
    if (!NumberUtils.isFiniteNumber(v) || v < shift || v > shift + 1) { throw new RangeError("Value must lie in the buyer's support."); }
    // Actual support knots retain right-continuous ownership after a shift.
    for (var k = agent.pieces.length - 1; k >= 0; k -= 1) {
      if (v >= agent.pieces[k].a) { return evaluatePiece(agent.pieces[k], v); }
    }
  }

  function optimalRevenue(shifts) {
    var sorted = distribution(shifts).sort(function (a, b) { return a - b; });
    var a = sorted[0], b = sorted[1], length = 1 + a;
    // Integrate Pr(max(phi_1,phi_2)>t) over t>=0, splitting at 1+a.
    return length - (length * length * length / 3 + (2 - a - b) * length * length / 2 +
      (1 - a) * (1 - b) * length) / 4 + (b - a) * (b - a) / 4;
  }

  function diagnose(grid, shifts) {
    validate(grid);
    shifts = distribution(shifts);
    var bidders = [interim(grid, 0, shifts[0]), interim(grid, 1, shifts[1])];
    // An independent triangle-centroid integral of affine virtual surplus.
    var profileSurplus = 0;
    ["lower", "upper"].forEach(function (half) {
      for (var i = 0; i < N; i += 1) {
        for (var j = 0; j < N; j += 1) {
          var v1 = (i + (half === "lower" ? 2 / 3 : 1 / 3)) * H;
          var v2 = (j + (half === "lower" ? 1 / 3 : 2 / 3)) * H;
          var q = grid[half][i][j];
          profileSurplus += H * H / 2 * (virtualValue(v1 + shifts[0], shifts[0]) * q[0] +
            virtualValue(v2 + shifts[1], shifts[1]) * q[1]);
        }
      }
    });
    return { bidders: bidders, bic: bidders.every(function (b) { return b.bic; }),
      revenue: bidders[0].expectedPayment + bidders[1].expectedPayment,
      virtualSurplus: profileSurplus, optimalRevenue: optimalRevenue(shifts), shifts: shifts,
      saleProbability: bidders[0].allocationProbability + bidders[1].allocationProbability };
  }

  return Object.freeze({ RESOLUTION: N, CELL_SIZE: H, TOLERANCE: EPS,
    lottery: lottery, gridFrom: gridFrom, validate: validate, preset: preset,
    cellAt: cellAt, allocationAt: allocationAt, virtualValue: virtualValue,
    evaluate: evaluate, evaluatePiece: evaluatePiece, diagnose: diagnose,
    distribution: distribution, optimalRevenue: optimalRevenue });
}());
