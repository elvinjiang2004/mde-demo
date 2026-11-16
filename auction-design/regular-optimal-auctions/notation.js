"use strict";

// Groups contain [TeX symbol, definition] pairs; section labels match their order.
(function () {
  window.MechanismNotation.registerPage("regular-optimal-auctions", {
    pageNotation: [
      [["r_i=\\inf\\{t\\in T_i\\mid\\phi_i(t)\\geq 0\\}", "Buyer \\(i\\)'s reserve value that he must beat or tie to participate."]],
      [["x_i(v_{-i})=\\inf\\left\\{t\\in T_i\\ \\middle| \\begin{array}{l} \\phi_i(t)\\geq 0,\\\\ \\phi_i(t)\\gt \\phi_j(v_j)\\text{, for every }j\\lt i,\\\\ \\phi_i(t)\\geq\\phi_j(v_j)\\text{, for every }j\\gt i \\end{array} \\right\\}", "Buyer \\(i\\)'s critical winning value under the lowest-index tie-breaking rule given other buyers' reports."]],
      [["W(v)=\\left\\{i\\in\\{1,\\ldots,n\\}\\ \\middle| \\begin{array}{l} \\phi_i(v_i)\\geq 0,\\\\ \\phi_i(v_i)=\\max\\{\\phi_j(v_j)\\mid j\\in\\{1,\\ldots,n\\}\\} \\end{array} \\right\\}", "The buyers with the highest weakly positive virtual value."]],
      [
        ["q^*=(q_1^*,\\ldots,q_n^*)", "The optimal mechanism's allocation rule."],
        ["q_i^*(v)=\\begin{cases} 1 & \\text{if }i\\in W(v),\\\\ 0 & \\text{otherwise} \\end{cases}", "The optimal mechanism's allocation rule for buyer \\(i\\)."],
        ["p^*=(p_1^*,\\ldots,p_n^*)", "The optimal mechanism's payment rule."],
        ["p_i^*(v)=\\begin{cases} \\bar{\\phi}_i^{-1}(\\max_{j\\in W(v)} \\bar{\\phi}_j(v_j)) & \\text{if }i\\in W(v),\\\\ 0 & \\text{otherwise} \\end{cases}", "The optimal mechanism's payment rule for buyer \\(i\\)."]
      ],
      [
        ["\\epsilon_i", "Buyer \\(i\\)'s distribution shift: \\(V_i\\sim\\mathrm{Uniform}[\\epsilon_i,\\epsilon_i+1]\\), with \\(\\epsilon_i\\in\\{0,0.1,\\ldots,1\\}\\)."]
      ],
      [["V=(V_1,\\ldots,V_n)", "An unrealized profile of buyer values."]],
      [
        ["Q_i^*(v_i)", "The optimal mechanism's interim allocation probability for buyer \\(i\\), given the other buyers report truthfully."],
        ["P_i^*(v_i)", "The optimal mechanism's interim expected payment for buyer \\(i\\), given the other buyers report truthfully."]
      ],
      [
        ["\\rho_i", "A posted price offered to buyer \\(i\\) in the interpretation of virtual values."],
        ["\\omicron_i(\\rho_i)=1-F_i(\\rho_i)", "Buyer \\(i\\)'s purchase probability, interpreted as quantity demanded at price \\(\\rho_i\\)."],
        ["\\rho_i(\\omicron_i)=F_i^{-1}(1-\\omicron_i)", "Buyer \\(i\\)'s price corresponding to quantity demanded \\(\\omicron_i\\)."],
        ["R_i(\\omicron_i)=\\omicron_i F_i^{-1}(1-\\omicron_i)", "The expected revenue from offering buyer \\(i\\) quantity \\(\\omicron_i\\)."],
      ]
    ],
    pageNotationSections: [
      "Introduction",
      "Introduction",
      "Introduction",
      "Introduction",
      "Demo",
      "Expected revenue",
      "The optimal mechanism",
      "Author Insights"
    ],
    environmentNotation: window.MechanismNotation.pages["auction-design"].environmentNotation
  });
})();
