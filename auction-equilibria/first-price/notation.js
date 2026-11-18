"use strict";

// Groups contain [TeX symbol, definition] pairs; section labels match their order.
(function () {
  window.MechanismNotation.registerPage("first-price", {
    pageNotation: [
      [["Y_i=\\max\\{V_j\\mid j\\neq i\\}", "The unrealized highest value among buyers \\(j\\neq i\\)."]],
      [["\\beta^{\\mathrm{I}}(v_i)=\\mathbb{E}[Y_i\\mid Y_i\\lt v_i]", "The equilibrium bidding strategy in the symmetric first-price auction."]],
      [
        ["Z_i\\sim\\mathrm{Beta}(\\alpha,\\beta)", "Buyer \\(i\\)'s Beta\\((\\alpha, \\beta)\\) distrbuted rancom variable used to determine his value."]
      ],
      [
        ["\\alpha, \\beta", "The Beta-distribution shape parameters; recall the Beta distribution PDF: \\(h(x)=\\frac{\\Gamma(\\alpha+\\beta)}{\\Gamma(\\alpha)\\Gamma(\\beta)}x^{\\alpha-1}(1-x)^{\\beta-1}\\) for \\(\\alpha,\\beta\\gt 0\\)."],
      ],
      [["F=F_1=\\cdots=F_n", "The common value CDF when buyers are symmetric."],
       ["[\\underline{v}, \\overline{v}]", "The support of the common value distribution."]
      ],
      [
        ["G(t)=F(t)^{n-1}", "The CDF of \\(Y_i\\) when buyers are symmetric."],
        ["g(t)", "The PDF of \\(Y_i\\)."]
      ],
      [["v_i'", "The alternative value used to determine the alternative bid \\(\\beta^{\\mathrm{I}}(v_i')\\)."]],
      [["U_i(v_i,x_i)", "Buyer \\(i\\)'s expected payoff from bidding \\(x_i\\) with value \\(v_i\\), given other buyers use \\(\\beta^{\\mathrm{I}}\\)."]]
    ],
    pageNotationSections: [
      "Introduction",
      "Introduction",
      "Demo",
      "Demo",
      "Proof of the proposition",
      "Proof of the proposition",
      "Proof of the proposition",
      "Proof of the proposition"
    ],
    environmentNotation: window.MechanismNotation.pages["auction-equilibria"].environmentNotation
  });
})();
