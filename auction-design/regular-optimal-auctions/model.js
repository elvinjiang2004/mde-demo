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

  function preset(name) {
    if (["efficient", "optimal", "empty", "equal"].indexOf(name) < 0) {
      throw new RangeError("Unknown allocation preset.");
    }
    return gridFrom(function (v1, v2) {
      if (name === "empty" || (name === "optimal" && Math.max(v1, v2) < 0.5)) { return [0, 0]; }
      if (name === "equal") { return [0.5, 0.5]; }
      return v1 >= v2 ? [1, 0] : [0, 1];
    });
  }

  function clone(grid) {
    return gridFrom(function (v1, v2, i, j, half) { return grid[half][i][j]; });
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

  function virtualValue(v) { return 2 * v - 1; }

  function interim(grid, bidder) {
    var pieces = [];
    var integral = 0;
    var expectedPayment = 0;
    var virtualSurplus = 0;
    var allocationProbability = 0;
    var violations = [];
    for (var k = 0; k < N; k += 1) {
      var start = 0;
      var slope = 0;
      for (var other = 0; other < N; other += 1) {
        var lower = bidder === 0 ? grid.lower[k][other][0] : grid.lower[other][k][1];
        var upper = bidder === 0 ? grid.upper[k][other][0] : grid.upper[other][k][1];
        start += H * (bidder === 0 ? upper : lower);
        slope += bidder === 0 ? lower - upper : upper - lower;
      }
      var a = k * H;
      var end = start + slope * H;
      // Local t = v-a: Q=A+Bt, U=I+At+Bt^2/2, P=vQ-U.
      var p = [a * start - integral, a * slope, slope / 2];
      pieces.push({ a: a, b: (k + 1) * H, start: start, slope: slope,
        end: end, utility: integral, payment: p });
      if (end < start - EPS) { violations.push({ kind: "slope", a: a, b: (k + 1) * H }); }
      if (k > 0 && start < pieces[k - 1].end - EPS) {
        violations.push({ kind: "jump", a: a, b: a });
      }
      var mass = H * start + slope * H * H / 2;
      integral += mass;
      allocationProbability += mass;
      expectedPayment += p[0] * H + p[1] * H * H / 2 + p[2] * H * H * H / 3;
      virtualSurplus += (2 * a - 1) * start * H +
        ((2 * a - 1) * slope + 2 * start) * H * H / 2 + 2 * slope * H * H * H / 3;
    }
    return { pieces: pieces, expectedPayment: expectedPayment, virtualSurplus: virtualSurplus,
      allocationProbability: allocationProbability, bic: violations.length === 0, violations: violations };
  }

  function evaluatePiece(piece, v) {
    var t = v - piece.a;
    var q = piece.start + piece.slope * t;
    var u = piece.utility + piece.start * t + piece.slope * t * t / 2;
    var p = piece.payment;
    return { value: v, allocation: q, utility: u, payment: p[0] + p[1] * t + p[2] * t * t,
      virtual: virtualValue(v), included: virtualValue(v) * q, excluded: virtualValue(v) * (1 - q) };
  }

  function evaluate(agent, v) {
    if (!NumberUtils.isFiniteNumber(v) || v < 0 || v > 1) { throw new RangeError("Value must be in [0,1]."); }
    return evaluatePiece(agent.pieces[Math.min(N - 1, Math.floor(v * N))], v);
  }

  function diagnose(grid) {
    validate(grid);
    var bidders = [interim(grid, 0), interim(grid, 1)];
    // An independent triangle-centroid integral of affine virtual surplus.
    var profileSurplus = 0;
    ["lower", "upper"].forEach(function (half) {
      for (var i = 0; i < N; i += 1) {
        for (var j = 0; j < N; j += 1) {
          var v1 = (i + (half === "lower" ? 2 / 3 : 1 / 3)) * H;
          var v2 = (j + (half === "lower" ? 1 / 3 : 2 / 3)) * H;
          var q = grid[half][i][j];
          profileSurplus += H * H / 2 * (virtualValue(v1) * q[0] + virtualValue(v2) * q[1]);
        }
      }
    });
    return { bidders: bidders, bic: bidders.every(function (b) { return b.bic; }),
      revenue: bidders[0].expectedPayment + bidders[1].expectedPayment,
      virtualSurplus: profileSurplus, optimalRevenue: 5 / 12,
      saleProbability: bidders[0].allocationProbability + bidders[1].allocationProbability };
  }

  return Object.freeze({ RESOLUTION: N, CELL_SIZE: H, TOLERANCE: EPS,
    lottery: lottery, gridFrom: gridFrom, validate: validate, preset: preset, clone: clone,
    cellAt: cellAt, allocationAt: allocationAt, virtualValue: virtualValue,
    evaluate: evaluate, evaluatePiece: evaluatePiece, diagnose: diagnose });
}());
