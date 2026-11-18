(function () {
  "use strict";
  var T = window.MechanismTest, model = window.SPAModel;
  var tests = [];
  function test(name, run) { tests.push({ name: name, run: run }); }
  function close(actual, expected, message) { T.assertClose(actual, expected, 1e-10, message); }

  test("The payoff model needs neither distributions nor first-price code", function () {
    T.assert(model && Object.isFrozen(model), "SPAModel must be isolated and immutable.");
    T.assert(!window.FPAModel && !window.AuctionDistributions, "The demo must work without distribution or equilibrium code.");
  });
  test("Strict outcomes use the opposing price rather than the winning bid", function () {
    var win = model.outcome(50, 90, 20);
    T.assert(win.outcome === "win", "A strictly higher bid must win.");
    close(win.winProbability, 1); close(win.priceIfWin, 20); close(win.payment, 20); close(win.payoff, 30);
    var lose = model.outcome(50, 10, 20);
    T.assert(lose.outcome === "lose" && lose.priceIfWin === null, "A losing bid has no conditional winning price.");
    close(lose.winProbability, 0); close(lose.payment, 0); close(lose.payoff, 0);
    close(model.outcome(50, 90, 80).payoff, -30, "Overbidding can win a purchase at a loss.");
  });
  test("An exact tie with one opposing buyer averages winning and losing equally", function () {
    var positive = model.comparison(50, 30, 30);
    close(positive.truthful.payoff, 20); close(positive.proposed.winProbability, 0.5);
    close(positive.proposed.payoff, 10); close(positive.proposed.payment, 15); close(positive.loss, 10);
    T.assert(positive.proposed.outcome === "tie", "A matching bid must be identified as a tie.");
    var negative = model.comparison(50, 70, 70);
    close(negative.truthful.payoff, 0); close(negative.proposed.payoff, -10); close(negative.loss, 10);
    var atValue = model.comparison(50, 70, 50);
    close(atValue.truthful.winProbability, 0.5); close(atValue.truthful.payoff, 0); close(atValue.proposed.payoff, 0);
    close(model.outcome(0, 0, 0).payoff, 0);
    close(model.outcome(100, 100, 100).winProbability, 0.5);
  });
  test("Nearby unequal bids remain strict wins or losses", function () {
    T.assert(model.outcome(50, 30, 30 - 1e-9).outcome === "win", "A nearby lower opposing bid is not a tie.");
    T.assert(model.outcome(50, 30, 30 + 1e-9).outcome === "lose", "A nearby higher opposing bid is not a tie.");
  });
  test("Truthful dominance and payments hold at all critical prices and boundaries", function () {
    [0, 10, 35.7, 50, 100, 150].forEach(function (value) {
      [0, 10, 25, 50, 75, 100, 200].forEach(function (bid) {
        [0, 100, 200, value, bid, (value + bid) / 2, Math.max(0, bid - 1e-6), bid + 1e-6].forEach(function (price) {
          var result = model.comparison(value, bid, price);
          close(result.truthful.payoff, Math.max(value - price, 0), "The truthful payoff equals the nonnegative surplus.");
          T.assert(result.loss >= 0, "Truthful bidding cannot do worse at " + [value, bid, price]);
          if (price > Math.min(value, bid) && price < Math.max(value, bid)) {
            close(result.loss, Math.abs(value - price), "A strictly intermediate price loses the full surplus difference.");
          }
          [result.truthful, result.proposed].forEach(function (outcome) {
            close(outcome.payoff, outcome.winProbability * value - outcome.payment, "Payoff equals value times allocation probability minus payment.");
          });
          T.assert(result.direction === (bid < value ? "underbid" : (bid > value ? "overbid" : "truthful")), "The comparison must classify the deviation correctly.");
        });
      });
    });
  });
  test("Nonfinite, negative and nonnumeric inputs fail explicitly", function () {
    [-1, NaN, Infinity, -Infinity, "50", null, undefined].forEach(function (bad) {
      [0, 1, 2].forEach(function (position) {
        var args = [50, 30, 40]; args[position] = bad;
        [model.outcome, model.comparison].forEach(function (calculate) {
          var threw = false;
          try { calculate.apply(null, args); } catch (error) { threw = true; }
          T.assert(threw, "Invalid economic arguments must not return a numeric-looking result.");
        });
      });
    });
  });
  T.run(tests, { title: "Second-price payoff model tests" });
})();
