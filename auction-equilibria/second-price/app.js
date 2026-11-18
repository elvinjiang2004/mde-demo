(function () {
  "use strict";
  var defaults = { value: 50, bid: 30, opposing: 40 };
  var state = { value: defaults.value, bid: defaults.bid, opposing: defaults.opposing, probe: null };
  var elements, charts, controls;

  document.addEventListener("DOMContentLoaded", function () {
    elements = {
      chart: document.getElementById("second-price-chart"),
      summary: document.getElementById("live-summary"),
      reset: document.getElementById("reset-button")
    };
    charts = window.SecondPriceCharts.create(state, elements);
    controls = window.SecondPriceControls.create(state, elements, defaults, render, charts);
    controls.bindEvents();
    window.MechanismMath.typesetInitial(".introduction, .choice-controls, .chart-x-axis-label, .derivation, .notes, .references");
    render();
    document.getElementById("second-price-demo").dataset.ready = "true";
  });

  function render() {
    var result = window.SPAModel.comparison(state.value, state.bid, state.opposing);
    controls.syncControlsFromState();
    charts.drawChart(result);
    elements.summary.textContent = "Private value " + charts.format(state.value) + ", proposed bid " + charts.format(state.bid) +
      (state.probe ? ", highest opposing bid " + charts.format(state.opposing) +
      ". Truthful payoff " + charts.format(result.truthful.payoff) + "; proposed-bid payoff " + charts.format(result.proposed.payoff) + "." :
      ". Hover over the plot or focus it and use the arrow keys to compare payoffs.");
  }
})();
