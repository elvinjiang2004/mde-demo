(function () {
  "use strict";

  var model = window.FPAModel;
  var math = window.MechanismMath;
  var formatMoney = window.AuctionChart.formatMoney;
  var formatPercent = window.AuctionChart.formatPercent;
  var DEFAULTS = {
    n: 2,
    a: 0,
    b: 100,
    value: 50,
    bid: 30,
    alpha: 1,
    beta: 1
  };

  var state = {
    n: DEFAULTS.n,
    a: DEFAULTS.a,
    b: DEFAULTS.b,
    value: DEFAULTS.value,
    bid: DEFAULTS.bid,
    alpha: DEFAULTS.alpha,
    beta: DEFAULTS.beta
  };

  var elements = {};
  var charts;
  var controls;

  document.addEventListener("DOMContentLoaded", initialize);

  function initialize() {
    elements = {
      bidderCount: byId("bidder-count"),
      alphaNumber: byId("alpha-number"),
      alphaSlider: byId("alpha-slider"),
      betaNumber: byId("beta-number"),
      betaSlider: byId("beta-slider"),
      lowerBound: byId("lower-bound"),
      upperBound: byId("upper-bound"),
      valueSlider: byId("value-slider"),
      valueNumber: byId("value-number"),
      bidSlider: byId("bid-slider"),
      bidNumber: byId("bid-number"),
      valueMinLabel: byId("value-min-label"),
      valueMaxLabel: byId("value-max-label"),
      bidMinLabel: byId("bid-min-label"),
      bidMaxLabel: byId("bid-max-label"),
      randomValueButton: byId("random-value-button"),
      resetButton: byId("reset-button"),
      inputError: byId("input-error"),
      liveSummary: byId("live-summary"),
      valuePdfPreview: byId("value-pdf-preview"),
      chart: byId("tradeoff-chart")
    };

    charts = window.FirstPriceCharts.create(state, elements, distributionSpec);
    controls = window.FirstPriceControls.create(
      state, elements, DEFAULTS, render, charts, distributionSpec
    );

    math.typesetInitial(
      ".introduction, .model-specifications, .choice-controls, .derivation, " +
      ".notes, .references"
    );
    controls.bindEvents();
    window.EquationChain.initDividers();
    controls.syncControlsFromState();
    render();
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function distributionSpec() {
    return {
      type: "beta",
      alpha: state.alpha,
      beta: state.beta
    };
  }

  function render() {
    var validation = model.validateChoice(
      state.n,
      state.a,
      state.b,
      state.value,
      state.bid,
      distributionSpec()
    );

    if (!validation.valid) {
      controls.showError(validation.errors.join(" "));
      return;
    }

    controls.clearError();

    var current = model.outcomes(
      state.value,
      state.bid,
      state.n,
      state.a,
      state.b,
      distributionSpec()
    );
    var equilibrium = model.equilibriumOutcomes(
      state.value,
      state.n,
      state.a,
      state.b,
      distributionSpec()
    );

    controls.updateControls();
    charts.drawValuePdfPreview();
    charts.drawChart(current, equilibrium);
    updateAccessibleSummary(current, equilibrium);
  }

  function updateAccessibleSummary(current, equilibrium) {
    var span = state.b - state.a;
    var rectangleState = current.expectedPayoff < -model.EPSILON ?
      "a negative signed rectangle" :
      (Math.abs(current.expectedPayoff) <= model.EPSILON ?
        "a zero-area rectangle" : "a positive rectangle");
    elements.liveSummary.textContent =
      charts.distributionSummary() + ". With " + state.n +
      " bidders, your private value is " +
      formatMoney(state.value, span) + " and your proposed bid is " +
      formatMoney(state.bid, span) + ". The area under the PDF of beta " +
      "superscript I of Y subscript 1, the highest opposing bid, gives a " +
      "probability of winning of " +
      formatPercent(current.winProbability) + ". On the CDF panel's bid axis, " +
      "x subscript 1 is the payment upon winning, " +
      formatMoney(current.paymentIfWin, span) +
      ", and v subscript 1 minus x subscript 1 is the " +
      "payoff if you win, " + formatMoney(current.surplusIfWin, span) + ". " +
      "The " +
      rectangleState + " has probability height " +
      formatPercent(current.winProbability) + ", signed width " +
      formatMoney(state.value - state.bid, span) + ", and expected payoff " +
      formatMoney(current.expectedPayoff, span) + ". The equilibrium bid is " +
      formatMoney(equilibrium.bid, span) + " and its expected payoff is " +
      formatMoney(equilibrium.expectedPayoff, span) + ".";
  }

}());
