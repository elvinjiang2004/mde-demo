"use strict";

// Groups contain [TeX symbol, definition] pairs; section labels match their order.
(function () {
  window.MechanismNotation.registerPage("myerson-satterthwaite-theorem", {
    pageNotation: [
      [
        ["\\text{T-L}", "The top-left half of a cell."],
        ["\\text{B-R}", "The bottom-right half of a cell."]
      ],
      [
        ["u_B(v,c)=v q-p_B(v,c)", "The buyer's ex-post, truthful payoff at \\(v, c\\)."],
        ["u_S(v,c)=p_S(v,c)-c q", "The seller's ex-post, truthful payoff at \\(v, c\\)."],
        ["R(v,c)=p_B(v,c)-p_S(v,c)", "The ex-post, net revenue at \\(v, c\\)."],
        ["L(v,c)=\\max\\{v-c,0\\}-(v-c)q(v,c)", "The ex-post lost gains from trade at \\(v, c\\)."]
      ],
      [["q^*(v,c)=\\mathbb{1}\\{v\\geq c\\}", "The ex-post efficient allocation rule."]]
    ],
    pageNotationSections: [
      "Demo",
      "Demo",
      "Efficiency"
    ],
    environmentNotation: window.MechanismNotation.pages["bilateral-trade"].environmentNotation
  });
})();
