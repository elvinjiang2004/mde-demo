"use strict";

// Groups contain [TeX symbol, definition] pairs; section labels match their order.
(function () {
  window.MechanismNotation.registerPage("first-price", {
    pageNotation: [
      [["Y_1=\\max\\{V_2,\\ldots,V_n\\}", "The highest value among buyers \\(2,\\ldots,n\\)."]],
      [["\\beta^{\\mathrm{I}}(v)=\\mathbb{E}[Y_1\\mid Y_1\\lt v]", "The equilibrium bidding strategy in the symmetric, IPV first-price auction."]],
      [
        ["a=\\underline{v}", "The lower endpoint of each buyer's value support in the demo."],
        ["b=\\overline{v}", "The upper endpoint of each buyer's value support in the demo."],
        ["Z_i\\sim\\mathrm{Beta}(\\alpha,\\beta)", "Buyer \\(i\\)'s auxiliary Beta random variable on \\([0,1]\\), with \\(V_i=a+(b-a)Z_i\\)."]
      ],
      [
        ["\\alpha, \\beta", "The Beta-distribution shape parameters; recall the Beta distribution PDF: \\(h(x)=\\frac{\\Gamma(\\alpha+\\beta)}{\\Gamma(\\alpha)\\Gamma(\\beta)}x^{\\alpha-1}(1-x)^{\\beta-1}\\) for \\(\\alpha,\\beta\\gt 0\\)."],
      ],
      [["x_1", "Buyer 1's proposed bid."]],
      [
        ["G(y)=F(y)^{n-1}", "The CDF of \\(Y_1\\)."],
        ["g(y)", "The PDF of \\(Y_1\\)."]
      ],
      [["U_1(v_1,x_1)", "Buyer 1's expected payoff from bidding \\(x_1\\) with value \\(v_1\\), given other buyers use \\(\\beta^{\\mathrm{I}}\\)."]]
    ],
    pageNotationSections: [
      "Introduction",
      "Introduction",
      "Demo",
      "Demo",
      "Demo",
      "Proof of the optimal bid for bidder 1",
      "Proof of the optimal bid for bidder 1"
    ],
    environmentNotation: window.MechanismNotation.pages["auction-equilibria"].environmentNotation
  });
})();
