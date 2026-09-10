(function () {
  "use strict";

  var model = window.SPAModel;
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
      chart: byId("second-price-chart")
    };

    charts = window.SecondPriceCharts.create(state, elements, distributionSpec);
    controls = window.SecondPriceControls.create(
      state, elements, DEFAULTS, render, charts, distributionSpec
    );

    math.typesetInitial(
      ".introduction, .model-specifications, .choice-controls, .derivation, " +
      ".notes, .references"
    );
    controls.bindEvents();
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
    var spec = distributionSpec();
    var validation = model.validateChoice(
      state.n,
      state.a,
      state.b,
      state.value,
      state.bid,
      spec
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
      spec
    );
    var truthful = {
      bid: current.truthfulBid,
      winProbability: model.highestOpponentBidCdf(
        current.truthfulBid, state.n, state.a, state.b, spec
      ),
      expectedPayoff: current.truthfulExpectedPayoff
    };

    controls.updateControls();
    charts.renderValuePdfPreview();
    charts.drawChart(current, truthful);
    updateAccessibleSummary(current, truthful);
  }

  function updateAccessibleSummary(current, truthful) {
    var span = state.b - state.a;
    var conditionalPayment = current.expectedPaymentIfWin === null ?
      "undefined because the winning probability is zero" :
      formatMoney(current.expectedPaymentIfWin, span);
    elements.liveSummary.textContent =
      charts.distributionSummary() + ". Private value " +
      formatMoney(state.value, span) +
      ", proposed bid " + formatMoney(state.bid, span) +
      ", probability of winning " + formatPercent(current.winProbability) +
      ", expected payment conditional on winning " + conditionalPayment +
      ", expected payoff " + formatMoney(current.expectedPayoff, span) +
      ", and truthful bid " + formatMoney(truthful.bid, span) + ".";
  }

}());
