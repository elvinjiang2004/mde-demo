(function (global) {
  "use strict";

  function nonnegative(value, name) {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(name + " must be a finite nonnegative number.");
    }
  }

  function outcome(value, bid, opposingBid) {
    nonnegative(value, "Value");
    nonnegative(bid, "Bid");
    nonnegative(opposingBid, "Highest opposing bid");
    var winProbability = bid > opposingBid ? 1 : (bid < opposingBid ? 0 : 0.5);
    var payoff = winProbability * (value - opposingBid);
    return {
      bid: bid,
      outcome: winProbability === 1 ? "win" : (winProbability === 0 ? "lose" : "tie"),
      winProbability: winProbability,
      priceIfWin: winProbability > 0 ? opposingBid : null,
      payment: winProbability * opposingBid,
      payoff: payoff === 0 ? 0 : payoff
    };
  }

  function comparison(value, bid, opposingBid) {
    var truthful = outcome(value, value, opposingBid);
    var proposed = outcome(value, bid, opposingBid);
    var loss = truthful.payoff - proposed.payoff;
    return {
      truthful: truthful,
      proposed: proposed,
      loss: loss === 0 ? 0 : loss,
      direction: bid < value ? "underbid" : (bid > value ? "overbid" : "truthful")
    };
  }

  global.SPAModel = Object.freeze({ outcome: outcome, comparison: comparison });
})(window);
