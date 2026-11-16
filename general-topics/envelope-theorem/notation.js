"use strict";

// Groups contain [TeX symbol, definition] pairs; section labels match their order.
(function () {
  window.MechanismNotation.registerPage("envelope-theorem", {
    pageNotation: [
      [
        ["q=(q_1,\\ldots,q_n):T\\to[0,1]^n", "The allocation rule specifying the probability of allocation to each buyer at each reported value profile."],
        ["q_i:T\\to[0,1]", "Buyer \\(i\\)'s allocation probability at each reported value profile."],
        ["p=(p_1,\\ldots,p_n):T\\to\\mathbb{R}^n", "The payment rule specifying the expected payment from each buyer at each reported value profile."],
        ["p_i:T\\to\\mathbb{R}", "Buyer \\(i\\)'s expected payment at each reported value profile."],
        ["u_i(v',v_i)=q_i(v')v_i-p_i(v')", "Buyer \\(i\\)'s ex-post payoff given the reported value profile \\(v'\\) and true value \\(v_i\\)."],
        ["u_i(v)=u_i(v,v_i)", "Buyer \\(i\\)'s truthful ex-post payoff at a value profile."]
      ],
      [
        ["n", "The number of buyers."],
        ["i", "A buyer's index."]
      ],
      [
        ["Q_i(v_i')=\\int_{T_{-i}} q_i(v_i',v_{-i})\\,f_{-i}(v_{-i})\\,dv_{-i}", "Buyer \\(i\\)'s interim allocation probability from reporting \\(v_i'\\), given the other buyers report truthfully."],
        ["P_i(v_i')=\\int_{T_{-i}} p_i(v_i',v_{-i})\\,f_{-i}(v_{-i})\\,dv_{-i}", "Buyer \\(i\\)'s interim expected payment from reporting \\(v_i'\\), given the other buyers report truthfully."],
        ["U_i(v_i,v_i')=v_i Q_i(v_i')-P_i(v_i')", "Buyer \\(i\\)'s interim expected payoff from reporting \\(v_i'\\), given the other buyers report truthfully."],
        ["U_i(v_i)=U_i(v_i,v_i)", "Buyer \\(i\\)'s truthful interim expected payoff."]
      ],
      [
        ["v_i", "Buyer \\(i\\)'s realized value."],
        ["v_i'", "Buyer \\(i\\)'s reported value."]
      ],
      [
        ["v_{-i}=(v_1,\\ldots,v_{i-1},v_{i+1},\\ldots,v_n)", "The other buyers' values."],
        ["T_{-i}=\\prod_{j\\ne i} T_j", "The other buyers' joint value space."],
        ["f_{-i}(v_{-i})=\\prod_{j\\ne i} f_j(v_j)", "The other buyers' joint density."]
      ],
      [
        ["T_i=[\\underline{v}_i,\\overline{v}_i]", "The value space and support of buyer \\(i\\)'s value distribution."],
        ["T=\\prod_{i=1}^n T_i", "The joint value space in Myerson's Lemma; separate from the envelope theorem's parameter domain."],
        ["v=(v_1,\\ldots,v_n)", "A realized profile of values from the joint value space."],
        ["v'=(v_1',\\ldots,v_n')", "The reported value profile in Myerson's Lemma."]
      ],
      [
        ["V^*(v_i)", "The set of reports that maximize \\(U_i(v_i,v_i')\\) for a given true value \\(v_i\\)."],
        ["v^*(v_i)\\in V^*(v_i)", "A selected optimal report from the nonempty set \\(V^*(v_i)\\)."]
      ]
    ],
    pageNotationSections: [
      "Myerson's Lemma",
      "Myerson's Lemma",
      "Myerson's Lemma",
      "Myerson's Lemma",
      "Myerson's Lemma",
      "Myerson's Lemma",
      "Author Insights"
    ],
    environmentNotation: [
      [
        ["X", "The choice set."],
        ["x", "A choice in the choice set."]
      ],
      [
        ["T=[0,1]", "The parameter domain."],
        ["t", "A parameter value from \\(T\\)."]
      ],
      [["f: X \\times T \\to \\mathbb{R}", "The objective function."]],
      [["V(t)=\\sup\\{f(x,t)\\mid x\\in X\\}", "The value function or upper envelope of the family of objective functions indexed by choice \\(x\\in X\\)."]],
      [
        ["X^*(t)=\\operatorname*{arg\\,max}\\{f(x,t)\\mid x\\in X\\}", "The set of choices that maximize the objective at \\(t\\)."],
        ["x^*(t)", "A selection from \\(X^*(t)\\) if it is nonempty."]
      ],
      [["b: T \\to \\mathbb{R_+}", "The integrable bound in condition 2 of Theorem 2."]]
    ]
  });
})();
