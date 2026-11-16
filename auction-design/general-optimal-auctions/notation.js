"use strict";

// Groups contain [TeX symbol, definition] pairs; section labels match their order.
(function () {
  window.MechanismNotation.registerPage("general-optimal-auctions", {
    pageNotation: [
      [["r_i=\\inf\\{t\\in T_i\\mid\\bar{\\phi}_i(t)\\geq 0\\}", "Buyer \\(i\\)'s reserve value that he must beat or tie to participate."]],
      [["x_i(v_{-i})=\\inf\\left\\{t\\in T_i\\ \\middle| \\begin{array}{l} \\bar{\\phi}_i(t)\\geq 0,\\\\ \\bar{\\phi}_i(t)\\gt \\bar{\\phi}_j(v_j)\\text{, for every }j\\lt i,\\\\ \\bar{\\phi}_i(t)\\geq\\bar{\\phi}_j(v_j)\\text{, for every }j\\gt i \\end{array} \\right\\}", "Buyer \\(i\\)'s critical winning value under the lowest-index tie-breaking rule given other buyers' reports."]],
      [["W(v)=\\left\\{i\\in\\{1,\\ldots,n\\}\\ \\middle| \\begin{array}{l} \\bar{\\phi}_i(v_i)\\geq 0,\\\\ \\bar{\\phi}_i(v_i)=\\max\\{\\bar{\\phi}_j(v_j)\\mid j\\in\\{1,\\ldots,n\\}\\} \\end{array} \\right\\}", "The buyers with the highest weakly positive ironed virtual value."]],
      [
        ["q^*=(q_1^*,\\ldots,q_n^*)", "The optimal mechanism's allocation rule."],
        ["q_i^*(v)=\\begin{cases} 1 & \\text{if }i\\in W(v),\\\\ 0 & \\text{otherwise} \\end{cases}", "The optimal mechanism's allocation rule for buyer \\(i\\)."],
        ["p^*=(p_1^*,\\ldots,p_n^*)", "The optimal mechanism's payment rule."],
        ["p_i^*(v)=\\begin{cases} \\bar{\\phi}_i^{-1}(\\max_{j\\in W(v)} \\bar{\\phi}_j(v_j)) & \\text{if }i\\in W(v),\\\\ 0 & \\text{otherwise} \\end{cases}", "The optimal mechanism's payment rule for buyer \\(i\\)."]
      ],
      [
        ["c", "The distribution breakpoint."],
        ["\\pi", "The probability that a value lies in the lower interval \\([0,c]\\)."]
      ],
      [
        ["\\alpha\\in[0,1]", "The allocation-probability threshold."],
        ["E_\\alpha=\\{v_i\\in T_i \\mid Q_i(v_i) \\geq \\alpha\\}", "The set of values \\(v_i\\) with interim allocation probability of at least \\(\\alpha\\)."]
      ],
      [
        ["z", "A quantile in \\([0,1]\\)."],
        ["h_i(z)=\\phi_i(F_i^{-1}(z))", "Buyer \\(i\\)'s virtual value as a function of quantiles."],
        ["H_i(z)=\\int_0^z h_i(t)\\,dt", "The integral of \\(h_i\\) up to \\(z\\)."],
      ],
      [
        ["G_i", "The greatest convex function that lies below \\(H_i\\) on \\([0,1]\\)."],
        ["g_i", "The right derivative of \\(G_i\\) on \\([0,1)\\), with the left derivative used at \\(1\\)."],
        ["\\bar{\\phi}_i(v_i)=g_i(F_i(v_i))", "Buyer \\(i\\)'s ironed virtual value."]
      ],
      [
        ["D_i(v_i)=H_i(F_i(v_i))-G_i(F_i(v_i))", "The difference between buyer \\(i\\)'s integrated virtual value and its greatest convex lower bound at \\(F_i(v_i)\\)."]
      ],
      [
        ["Q_i^*(v_i)", "The optimal mechanism's interim allocation probability for buyer \\(i\\), given the other buyers report truthfully."]
      ]
    ],
    pageNotationSections: [
      "Introduction",
      "Introduction",
      "Introduction",
      "Introduction",
      "Demo",
      "Demo",
      "Ironed virtual values",
      "Ironed virtual values",
      "Expected revenue",
      "The optimal mechanism"
    ],
    environmentNotation: window.MechanismNotation.pages["auction-design"].environmentNotation
  });
})();
