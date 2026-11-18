"use strict";

// Groups contain [TeX symbol, definition] pairs; section labels match their order.
(function () {
  window.MechanismNotation.registerPage("second-price", {
    pageNotation: [
      [["v_i", "Buyer \\(i\\)'s private value, also the truthful bid in the demo."]],
      [["x_i", "Buyer \\(i\\)'s proposed bid in the demo."]],
      [
        ["u_i(v_i,v_i,p_i)", "Buyer \\(i\\)'s payoff from truthful bidding at the highest opposing bid \\(p_i\\)."],
        ["u_i(v_i,x_i,p_i)", "Buyer \\(i\\)'s payoff from the proposed bid \\(x_i\\) at the same highest opposing bid. At a tie, payoff averages over equal tie-breaking with one other buyer."]
      ],
      [
        ["\\underline{v}_i=0", "The demo's lower value and bid endpoint."],
        ["\\overline{v}_i=100", "The demo's upper value and bid endpoint."]
      ],
      [
        ["p_i=\\max\\{x_j\\mid j\\neq i\\}", "The highest opposing bid faced by buyer \\(i\\)."],
        ["x_j", "Buyer \\(j\\)'s submitted bid."]
      ],
      [["v_i'", "An alternative bid by buyer \\(i\\)."]]
    ],
    pageNotationSections: [
      "Demo",
      "Demo",
      "Demo",
      "Demo",
      "Proof of the proposition",
      "Proof of the proposition"
    ],
    environmentNotation: window.MechanismNotation.pages["auction-equilibria"].environmentNotation
  });
})();
