"use strict";

// Groups contain [TeX symbol, definition] pairs; section labels match their order.
(function () {
  window.MechanismNotation.registerPage("bargaining-mechanism-sandbox", {
    pageNotation: [
      [
        ["z_B", "The posted buyer price."],
        ["z_S", "The posted seller price."]
      ],
      [["K", "The constant payment offset from buyer to seller in the AGV mechanism."]],
      [["t", "The minimum \\(v-c\\) required for trade."]],
      [["k", "The weight on the buyer's report in the \\(k\\)-double auction mechanism."]],
      [
        ["\\alpha", "The buyer's markup in the revenue-threshold mechanism."],
        ["\\beta", "The seller's discount in the revenue-threshold mechanism."]
      ],
      [
        ["\\text{T-L}", "The top-left half of a cell."],
        ["\\text{B-R}", "The bottom-right half of a cell."]
      ],
      [
        ["u_B(v,c)=v q-p_B(v,c)", "The buyer's ex-post, truthful payoff at \\(v, c\\)."],
        ["u_S(v,c)=p_S(v,c)-c q", "The seller's ex-post, truthful payoff at \\(v, c\\)."],
        ["R(v,c)=p_B(v,c)-p_S(v,c)", "The ex-post, net revenue at \\(v, c\\)."],
        ["L(v,c)=\\max\\{v-c,0\\}-(v-c)q(v,c)", "The ex-post lost gains from trade at \\(v, c\\)."]
      ]
    ],
    pageNotationSections: [
      "Demo",
      "Demo",
      "Demo",
      "Demo",
      "Demo",
      "Demo",
      "Demo"
    ],
    environmentNotation: window.MechanismNotation.pages["bilateral-trade"].environmentNotation
  });
})();
