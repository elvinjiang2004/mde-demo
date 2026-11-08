(function () {
  "use strict";

  function create(state, elements, defaults, render, charts, distributionSpec) {
    return window.AuctionControls.createController({
      state: state, elements: elements, defaults: defaults, render: render,
      charts: charts, distributionSpec: distributionSpec, model: window.SPAModel
    });
  }

  window.SecondPriceControls = Object.freeze({ create: create });
}());
