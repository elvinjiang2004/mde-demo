"use strict";

// Groups contain [TeX symbol, definition] pairs; section labels match their order.
(function () {
  window.MechanismNotation.registerPage("second-price", {
    pageNotation: [
      [["v_i", "Buyer \\(i\\)'s true value."]],
      [
        ["u_i(v_i,x_i,p_i)", "Buyer \\(i\\)'s ex-post payoff from bidding \\(x_i\\) when his value is \\(v_i\\) and the highest opposing bid is \\(p_i\\)."]
      ],
      [
        ["p_i=\\max\\{x_j\\mid j\\neq i\\}", "The highest opposing bid for buyer \\(i\\)."],
        ["x_i", "Buyer \\(i\\)'s proposed alternative bid."],
        ["x_j", "Buyer \\(j\\)'s submitted bid, where \\(j\\neq i\\)."]
      ]
    ],
    pageNotationSections: [
      "Demo",
      "Demo",
      "Proof of the proposition"
    ],
    environmentNotation: window.MechanismNotation.pages["auction-equilibria"].environmentNotation
  });
})();
