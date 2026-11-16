"use strict";

// Groups contain [TeX symbol, definition] pairs; section labels match their order.
(function () {
  window.MechanismNotation.registerPage("second-price", {
    pageNotation: [
      [["\\beta^{\\mathrm{II}}(v)=v", "The dominant bidding strategy in the second-price auction."]],
      [
        ["a=\\underline{v}", "The lower endpoint of each buyer's value support in the demo."],
        ["b=\\overline{v}", "The upper endpoint of each buyer's value support in the demo."],
        ["Z_i\\sim\\mathrm{Beta}(\\alpha,\\beta)", "Buyer \\(i\\)'s auxiliary Beta random variable on \\([0,1]\\), with \\(V_i=a+(b-a)Z_i\\)."]
      ],
      [["\\alpha, \\beta", "The Beta-distribution shape parameters for \\(Z_i\\)."]],
      [["x_1", "Buyer 1's proposed bid."]],
      [["x_2,\\ldots,x_n", "The bids from buyers \\(2,\\ldots,n\\)."]],
      [["p_1=\\max\\{x_2,\\ldots,x_n\\}", "The highest bid among buyers \\(2,\\ldots,n\\)."]],
      [
        ["x^-\\lt v_1", "An alternative underbid."],
        ["x^+\\gt v_1", "An alternative overbid."]
      ]
    ],
    pageNotationSections: [
      "Introduction",
      "Demo",
      "Demo",
      "Demo",
      "Proof of the dominant strategy for buyer 1",
      "Proof of the dominant strategy for buyer 1",
      "Proof of the dominant strategy for buyer 1"
    ],
    environmentNotation: window.MechanismNotation.pages["auction-equilibria"].environmentNotation
  });
})();
