"use strict";

(function () {
  var notation = window.MechanismNotation;
  notation.registerPage("lying-cost", {
    pageNotation: [
      [
        ["v,c", "The buyer's and seller's true values."],
        ["v',c'", "The buyer's and seller's reported values."],
        ["\\gamma_B,\\gamma_S", "The buyer's and seller's lying-cost coefficients."]
      ],
      [
        ["V,C", "The independent buyer value and seller cost random variables."],
        ["\\epsilon", "The length of the intersection of the buyer's and seller's supports."],
        ["k", "The weight on the buyer's report in the price of the \\(k\\)-double auction."]
      ],
      [
        ["q(v,c)", "The probability of trade with values \\((v,c)\\), given truthful reporting."],
        ["p_B(v,c),p_S(v,c)", "The payment from the buyer and the payment to the seller with values \\((v,c)\\), given truthful reporting."]
      ],
      [
        ["U_B(v,v'),U_S(c,c')", "Interim payoff, including the lying cost, for the buyer and seller given their true value and report."],
        ["R(v,c)", "The ex-post net revenue with values \\((v,c)\\), given truthful reporting."],
        ["u_B(v,c),u_S(v,c)", "The buyer's and seller's ex-post payoffs with values \\((v,c)\\), given truthful reporting."],
        ["L(v,c)", "The ex-post loss in gains from trade with values \\((v,c)\\), given truthful reporting.."]
      ]
    ],
    pageNotationSections: ["Introduction", "Demo", "Demo", "Demo"],
    environmentNotation: notation.pages["special-topics"].environmentNotation
  });
})();
