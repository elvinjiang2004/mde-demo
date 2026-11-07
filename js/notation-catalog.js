"use strict";

(function () {
  // Definitions follow the current lessons and their shared Environment pages.
  // Each group contains [TeX symbol, definition] pairs, one symbol per row.
  // Groups share a divider. Use bare TeX in symbols and \\( ... \\) in definitions.
  // Page groups follow their first entry's appearance; parallel section labels
  // supply small headings without changing the groups or Environment notation.
  var sharedEnvironmentNotation = {
    "auction-equilibria": [
      [
        ["n", "Number of buyers."],
        ["i", "A buyer's index."]
      ],
      [
        ["V_i", "Buyer \\(i\\)'s random private value."],
        ["v_i", "Buyer \\(i\\)'s realized value."]
      ],
      [
        ["F", "Buyers' value CDF."],
        ["f", "Buyers' value PDF."]
      ],
      [["[\\underline{v},\\overline{v}]", "Value space and support of each buyer's value distribution."]]
    ],
    "auction-design": [
      [
        ["n", "Number of buyers."],
        ["i", "A buyer's index."]
      ],
      [
        ["V_i", "Buyer \\(i\\)'s random private value."],
        ["v_i", "Buyer \\(i\\)'s realized value."],
        ["v_i'", "Buyer \\(i\\)'s reported value."]
      ],
      [
        ["F_i", "Buyer \\(i\\)'s value CDF."],
        ["f_i", "Buyer \\(i\\)'s value PDF."]
      ],
      [
        ["T_i=[\\underline{v}_i,\\overline{v}_i]", "Value space and support of buyer \\(i\\)'s value distribution."],
        ["T=\\prod_{i=1}^n T_i", "Joint value space."],
        ["V=(V_1,\\ldots,V_n)", "An unrealized profile of values from the joint value space."],
        ["v=(v_1,\\ldots,v_n)", "A realized profile of values from the joint value space."]
      ],
      [
        ["v_{-i}=(v_1,\\ldots,v_{i-1},v_{i+1},\\ldots,v_n)", "Other buyers' values."],
        ["v_{-i}'=(v_1',\\ldots,v_{i-1}',v_{i+1}',\\ldots,v_n')", "Other buyers' reported values."],
        ["T_{-i}=\\prod_{j\\ne i} T_j", "Other buyers' joint value space."],
        ["f_{-i}(v_{-i})=\\prod_{j\\ne i} f_j(v_j)", "Other buyers' joint density."]
      ],
      [
        ["q=(q_1,\\ldots,q_n):T\\to[0,1]^n", "Allocation rule specifying the probability of allocation to each buyer at each reported value profile."],
        ["q_i:T\\to[0,1]", "Buyer \\(i\\)'s allocation probability at each reported value profile."],
        ["p=(p_1,\\ldots,p_n):T\\to\\mathbb{R}^n", "Payment rule specifying the expected payment from each buyer at each reported value profile."],
        ["p_i:T\\to\\mathbb{R}", "Buyer \\(i\\)'s expected payment at each reported value profile."]
      ],
      [
        ["Q_i(v_i')=\\int_{T_{-i}} q_i(v_i',v_{-i})\\,f_{-i}(v_{-i})\\,dv_{-i}", "Buyer \\(i\\)'s interim allocation probability from reporting \\(v_i'\\), given the other buyers report truthfully."],
        ["P_i(v_i')=\\int_{T_{-i}} p_i(v_i',v_{-i})\\,f_{-i}(v_{-i})\\,dv_{-i}", "Buyer \\(i\\)'s interim expected payment from reporting \\(v_i'\\), given the other buyers report truthfully."],
        ["U_i(v_i,v_i')=v_i Q_i(v_i')-P_i(v_i')", "Buyer \\(i\\)'s interim expected payoff from reporting \\(v_i'\\), given the other buyers report truthfully."],
        ["U_i(v_i)=U_i(v_i,v_i)", "Buyer \\(i\\)'s truthful interim expected payoff."]
      ],
      [["\\phi_i(v_i)=v_i-\\frac{1-F_i(v_i)}{f_i(v_i)}", "Buyer \\(i\\)'s virtual value."]]
    ],
    "bilateral-trade": [
      [
        ["V", "Buyer's random private value."],
        ["v", "Buyer's realized value."],
        ["v'", "Buyer's reported value."]
      ],
      [
        ["C", "Seller's random private value (opportunity cost)."],
        ["c", "Seller's realized value (opportunity cost)."],
        ["c'", "Seller's reported value (opportunity cost)."]
      ],
      [
        ["F_B", "Buyer's value CDF."],
        ["f_B", "Buyer's value PDF."],
        ["F_S", "Seller's value CDF."],
        ["f_S", "Seller's value PDF."]
      ],
      [
        ["[\\underline{v},\\overline{v}]", "Value space and support of the buyer's value distribution."],
        ["[\\underline{c},\\overline{c}]", "Value space and support of the seller's value distribution."],
        ["T=[\\underline{v},\\overline{v}]\\times[\\underline{c},\\overline{c}]", "Joint buyer and seller type space."],
        ["(v,c)", "A profile of values from the joint type space."]
      ],
      [
        ["q:T\\to[0,1]", "Allocation rule specifying the probability of trade at each reported value pair."],
        ["p_B:T\\to\\mathbb{R}", "Buyer's payment rule specifying the expected payment from the buyer at each reported value pair."],
        ["p_S:T\\to\\mathbb{R}", "Seller's payment rule specifying the expected payment to the seller at each reported value pair."]
      ],
      [
        ["Q_B(v')=\\int_{\\underline{c}}^{\\overline{c}} q(v',c)\\,f_S(c)\\,dc", "Buyer's interim allocation probability from reporting \\(v'\\), given the seller reports truthfully."],
        ["P_B(v')=\\int_{\\underline{c}}^{\\overline{c}} p_B(v',c)\\,f_S(c)\\,dc", "Buyer's interim expected payment from reporting \\(v'\\), given the seller reports truthfully."],
        ["U_B(v,v')=v Q_B(v')-P_B(v')", "Buyer's interim expected payoff from reporting \\(v'\\), given the seller reports truthfully."],
        ["U_B(v)=U_B(v,v)", "Buyer's truthful interim expected payoff."],
        ["Q_S(c')=\\int_{\\underline{v}}^{\\overline{v}} q(v,c')\\,f_B(v)\\,dv", "Seller's interim allocation probability from reporting \\(c'\\), given the buyer reports truthfully."],
        ["P_S(c')=\\int_{\\underline{v}}^{\\overline{v}} p_S(v,c')\\,f_B(v)\\,dv", "Seller's interim expected payment received from reporting \\(c'\\), given the buyer reports truthfully."],
        ["U_S(c,c')=P_S(c')-c Q_S(c')", "Seller's interim expected payoff from reporting \\(c'\\), given the buyer reports truthfully."],
        ["U_S(c)=U_S(c,c)", "Seller's truthful interim expected payoff."]
      ],
      [
        ["\\phi_B(v)=v-\\frac{1-F_B(v)}{f_B(v)}", "Buyer's virtual value."],
        ["\\phi_S(c)=c+\\frac{F_S(c)}{f_S(c)}", "Seller's virtual value."]
      ],
    ]
  };

  // Page notation is authored independently in each page's own array.
  // Only environment definitions are shared between related pages.
  var pages = {
    "auction-equilibria": {
      pageNotation: [],
      environmentNotation: sharedEnvironmentNotation["auction-equilibria"]
    },
    "auction-design": {
      pageNotation: [],
      environmentNotation: sharedEnvironmentNotation["auction-design"]
    },
    "bilateral-trade": {
      pageNotation: [],
      environmentNotation: sharedEnvironmentNotation["bilateral-trade"]
    },
    "first-price": {
      pageNotation: [
        [["Y_1=\\max\\{V_2,\\ldots,V_n\\}", "Highest value among buyers \\(2,\\ldots,n\\)."]],
        [["\\beta^{\\mathrm{I}}(v)=\\mathbb{E}[Y_1\\mid Y_1\\lt v]", "Equilibrium bidding strategy in the symmetric, IPV first-price auction."]],
        [
          ["\\alpha, \\beta", "Beta-distribution shape parameters; recall the Beta distribution PDF: \\(f(x)=\\frac{\\Gamma(\\alpha+\\beta)}{\\Gamma(\\alpha)\\Gamma(\\beta)}x^{\\alpha-1}(1-x)^{\\beta-1}\\) for \\(\\alpha,\\beta\\gt 0\\)."]
        ],
        [
          ["G(y)=F(y)^{n-1}", "\\(Y_1\\)'s CDF."],
          ["g(y)", "\\(Y_1\\)'s PDF."]
        ],
        [["z\\in[a,b]", "An alternative value."]],
        [["U_1(v_1,x_1)", "Buyer 1's expected payoff from bidding \\(x_1\\) with value \\(v_1\\), given other buyers use \\(\\beta^{\\mathrm{I}}\\)."]]
      ],
      pageNotationSections: [
        "Introduction",
        "Introduction",
        "Demo",
        "Proof of the optimal bid for bidder 1",
        "Proof of the optimal bid for bidder 1",
        "Proof of the optimal bid for bidder 1"
      ],
      environmentNotation: sharedEnvironmentNotation["auction-equilibria"]
    },
    "second-price": {
      pageNotation: [
        [["\\beta^{\\mathrm{II}}(v)=v", "Dominant bidding strategy in the second-price auction."]],
        [["x_2,\\ldots,x_n", "Bids from buyers \\(2,\\ldots,n\\)."]],
        [["p_1=\\max\\{x_2,\\ldots,x_n\\}", "Highest bid among buyers \\(2,\\ldots,n\\)."]],
        [
          ["x^-\\lt v_1", "An alternative underbid."],
          ["x^+\\gt v_1", "An alternative overbid."]
        ]
      ],
      pageNotationSections: [
        "Introduction",
        "Proof of the dominant strategy for buyer 1",
        "Proof of the dominant strategy for buyer 1",
        "Proof of the dominant strategy for buyer 1"
      ],
      environmentNotation: sharedEnvironmentNotation["auction-equilibria"]
    },
    "regular-optimal-auctions": {
      pageNotation: [
        [["r_i=\\inf\\{t\\in T_i\\mid\\phi_i(t)\\geq 0\\}", "Buyer \\(i\\)'s reserve value that he must beat to participate."]],
        [["x_i(v_{-i})=\\inf\\left\\{t\\in T_i\\ \\middle| \\begin{array}{l} \\phi_i(t)\\geq 0,\\\\ \\phi_i(t)\\gt \\phi_j(v_j)\\text{, for every }j\\lt i,\\\\ \\phi_i(t)\\geq\\phi_j(v_j)\\text{, for every }j\\gt i \\end{array} \\right\\}", "Buyer \\(i\\)'s critical winning value under lowest-index priority given other buyers' reports."]],
        [["W(v)=\\left\\{i\\in\\{1,\\ldots,n\\}\\ \\middle| \\begin{array}{l} \\phi_i(v_i)\\geq 0,\\\\ \\phi_i(v_i)=\\max\\{\\phi_j(v_j)\\mid j\\in\\{1,\\ldots,n\\}\\} \\end{array} \\right\\}", "Buyers with the highest weakly positive virtual value."]],
        [
          ["(q^*,p^*)", "The optimal mechanism."],
          ["q_i^*(v)", "The optimal mechanism's allocation rule for buyer \\(i\\)."],
          ["p_i^*(v)", "The optimal mechanism's payment rule for buyer \\(i\\)."]
        ],
        [
          ["\\epsilon_i", "Buyer \\(i\\)'s distribution shift: \\(V_i\\sim\\mathrm{Uniform}[\\epsilon_i,\\epsilon_i+1]\\), with \\(\\epsilon_i\\in\\{0,0.1,\\ldots,1\\}\\)."]
        ],
        [
          ["Q_i^*(v_i)", "The optimal mechanism's interim allocation probability for buyer \\(i\\), given the other buyers report truthfully."],
          ["P_i^*(v_i)", "The optimal mechanism's interim expected payment for buyer \\(i\\), given the other buyers report truthfully."]
        ]
      ],
      pageNotationSections: [
        "Introduction",
        "Introduction",
        "Introduction",
        "Introduction",
        "Demo",
        "The Optimal Mechanism"
      ],
      environmentNotation: sharedEnvironmentNotation["auction-design"]
    },
    "general-optimal-auctions": {
      pageNotation: [
        [["x_i(v_{-i})=\\inf\\left\\{t\\in T_i\\ \\middle| \\begin{array}{l} \\bar{\\phi}_i(t)\\geq 0,\\\\ \\bar{\\phi}_i(t)\\gt \\bar{\\phi}_j(v_j)\\text{, for every }j\\lt i,\\\\ \\bar{\\phi}_i(t)\\geq\\bar{\\phi}_j(v_j)\\text{, for every }j\\gt i \\end{array} \\right\\}", "Buyer \\(i\\)'s critical winning value under lowest-index priority for fixed opposing reports."]],
        [["W(v)=\\left\\{i\\in\\{1,\\ldots,n\\}\\ \\middle| \\begin{array}{l} \\bar{\\phi}_i(v_i)\\geq 0,\\\\ \\bar{\\phi}_i(v_i)=\\max\\{\\bar{\\phi}_j(v_j)\\mid j\\in\\{1,\\ldots,n\\}\\} \\end{array} \\right\\}", "Buyers with the highest weakly positive ironed virtual value."]],
        [
          ["c", "Distribution breakpoint."],
          ["\\pi", "Probability that a value lies in the lower interval \\([0,c]\\)."]
        ],
        [
          ["\\rho", "A quantile in \\([0,1]\\)."],
          ["h_i(\\rho)=\\phi_i(F_i^{-1}(\\rho))", "Buyer \\(i\\)'s virtual value as a function of quantiles."],
          ["H_i(\\rho)=\\int_0^\\rho h_i(t)\\,dt", "Integral of \\(h_i\\) up to \\(\\rho\\)."],
        ],
        [
          ["G_i", "The greatest convex function that lies below \\(H_i\\) on \\([0,1]\\)."],
          ["g_i", "The right derivative of \\(G_i\\) on \\([0,1)\\), with the left derivative used at \\(1\\)."],
          ["\\bar{\\phi}_i(v_i)=g_i(F_i(v_i))", "Buyer \\(i\\)'s ironed virtual value."]
        ],
        [
          ["D_i(v_i)=H_i(F_i(v_i))-G_i(F_i(v_i))", "The difference between buyer \\(i\\)'s integrated virtual value and its greatest convex lower bound at \\(F_i(v_i)\\)."]
        ]
      ],
      pageNotationSections: [
        "Introduction",
        "Introduction",
        "Demo",
        "Ironed virtual values",
        "Ironed virtual values",
        "Expected revenue"
      ],
      environmentNotation: sharedEnvironmentNotation["auction-design"]
    },
    "myerson-satterthwaite-theorem": {
      pageNotation: [
        [
          ["\\text{T-L}", "Top-left half of a cell."],
          ["\\text{B-R}", "Bottom-right half of a cell."]
        ],
        [
          ["u_B(v,c)=v q-p_B(v,c)", "Buyer's ex-post, truthful payoff at \\(v, c\\)."],
          ["u_S(v,c)=p_S(v,c)-c q", "Seller's ex-post, truthful payoff at \\(v, c\\)."],
          ["R(v,c)=p_B(v,c)-p_S(v,c)", "Ex-post, net revenue at \\(v, c\\)."],
          ["L(v,c)=\\max\\{v-c,0\\}-(v-c)q(v,c)", "Ex-post lost gains from trade at \\(v, c\\)."]
        ],
        [["q^*(v,c)=\\mathbb{1}\\{v\\geq c\\}", "The ex-post efficient allocation rule."]]
      ],
      pageNotationSections: [
        "Demo",
        "Demo",
        "Efficiency"
      ],
      environmentNotation: sharedEnvironmentNotation["bilateral-trade"]
    },
    "bargaining-mechanism-sandbox": {
      pageNotation: [
        [
          ["z_B", "Posted buyer price."],
          ["z_S", "Posted seller price."]
        ],
        [["K", "Constant payment from buyer to seller in the AGV mechanism."]],
        [["t", "Minimum \\(v-c\\) required for trade."]],
        [["k", "Weight on the buyer's report in the \\(k\\)-double auction mechanism."]],
        [
          ["\\alpha", "Buyer markup in the revenue-threshold mechanism."],
          ["\\beta", "Seller discount in the revenue-threshold mechanism."]
        ],
        [
          ["\\text{T-L}", "Top-left half of a cell."],
          ["\\text{B-R}", "Bottom-right half of a cell."]
        ],
        [
          ["v'", "Alternate buyer report."],
          ["c'", "Alternate seller report."]
        ],
        [
          ["u_B(v,c)=v q-p_B(v,c)", "Buyer's ex-post, truthful payoff at \\(v, c\\)."],
          ["u_S(v,c)=p_S(v,c)-c q", "Seller's ex-post, truthful payoff at \\(v, c\\)."],
          ["R(v,c)=p_B(v,c)-p_S(v,c)", "Ex-post, net revenue at \\(v, c\\)."],
          ["L(v,c)=\\max\\{v-c,0\\}-(v-c)q(v,c)", "Ex-post lost gains from trade at \\(v, c\\)."]
        ]
      ],
      pageNotationSections: [
        "Demo",
        "Demo",
        "Demo",
        "Demo",
        "Demo",
        "Demo",
        "Demo",
        "Demo"
      ],
      environmentNotation: sharedEnvironmentNotation["bilateral-trade"]
    },
    "envelope-theorem": {
      pageNotation: [
        [
          ["q=(q_1,\\ldots,q_n):T\\to[0,1]^n", "Allocation rule specifying the probability of allocation to each buyer at each reported value profile."],
          ["q_i:T\\to[0,1]", "Buyer \\(i\\)'s allocation probability at each reported value profile."],
          ["p=(p_1,\\ldots,p_n):T\\to\\mathbb{R}^n", "Payment rule specifying the expected payment from each buyer at each reported value profile."],
          ["p_i:T\\to\\mathbb{R}", "Buyer \\(i\\)'s expected payment at each reported value profile."],
          ["u_i(v',v_i)=q_i(v')v_i-p_i(v')", "Buyer \\(i\\)'s ex-post payoff at a reported value profile."],
          ["u_i(v)=u_i(v,v_i)", "Buyer \\(i\\)'s truthful ex-post payoff at a value profile."]
        ],
        [
          ["n", "Number of buyers."],
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
        [["v_{-i}=(v_1,\\ldots,v_{i-1},v_{i+1},\\ldots,v_n)", "Other buyers' values."]]
      ],
      pageNotationSections: [
        "Myerson's Lemma",
        "Myerson's Lemma",
        "Myerson's Lemma",
        "Myerson's Lemma",
        "Myerson's Lemma"
      ],
      environmentNotation: [
        [
          ["X", "Choice set."],
          ["x", "A choice in the choice set."]
        ],
        [
          ["T=[0,1]", "Parameter domain."],
          ["t", "A parameter value from \\(T\\)."]
        ],
        [["f: X \\times T \\to \\mathbb{R}", "Objective function ."]],
        [["V(t)=\\sup\\{f(x,t)\\mid x\\in X\\}", "Value function or upper envelope of the family of objective functions indexed by choice \\(x\\in X\\)."]],
        [
          ["X^*(t)=\\operatorname*{arg\\,max}\\{f(x,t)\\mid x\\in X\\}", "Set of choices that maximize the objective at \\(t\\)."],
          ["x^*(t)", "A selection from the \\(X^*(t)\\) if it is nonempty."]
        ],
        [["b: T \\to \\mathbb{R}", "Theorem 2 condition 2's integrable bound."]]
      ]
    },
    "revelation-principle": {
      pageNotation: [
        [["\\succ", "Strict preference: the candidate on the left is preferred to the candidate on the right."]],
        [
          ["f^{\\mathrm{I}}", "Outcome function of the indirect mechanism."],
          ["f^{\\mathrm{D}}", "Outcome function of the constructed direct mechanism."]
        ],
        [
          ["s_i^*", "Agent \\(i\\)'s selected equilibrium strategy."],
          ["s^*", "Selected equilibrium strategy profile."],
          ["s_{-i}^*", "Other agents' selected equilibrium strategies."]
        ],
        [
          ["\\hat{\\theta}_i", "Agent \\(i\\)'s alternative report."],
          ["\\hat{\\theta}_{-i}", "Other agents' reports."]
        ]
      ],
      pageNotationSections: [
        "Demo",
        "Proof of the Revelation Principle",
        "Proof of the Revelation Principle",
        "Proof of the Revelation Principle"
      ],
      environmentNotation: [
        [
          ["n", "Number of agents."],
          ["i", "An agent's index."]
        ],
        [
          ["Y", "Outcome space."],
          ["y", "An outcome from the outcome space."]
        ],
        [
          ["\\theta_i", "Agent \\(i\\)'s type."],
          ["\\theta = (\\theta_1, \\ldots, \\theta_n)", "A profile of types."],
          ["\\theta_{-i}=(\\theta_1, \\ldots, \\theta_{i-1}, \\theta_{i+1}, \\ldots, \\theta_n)", "Other agents' types."]
        ],
        [
          ["T_i\\ni \\theta_i", "Agent \\(i\\)'s type space."],
          ["T=\\prod_{i=1}^n T_i\\ni \\theta", "Joint type space."],
        ],
        [["p_i(\\theta_{-i}\\mid\\theta_i)", "Agent \\(i\\)'s conditional belief about the other agents' types; here \\(p\\) is a belief."]],
        [["u_i(y,\\theta)", "Agent \\(i\\)'s payoff from outcome \\(y\\) at type profile \\(\\theta\\)."]],
        [
          ["A_i", "Agent \\(i\\)'s action space."],
          ["A=\\prod_{i=1}^n A_i", "Joint action space."],
          ["a_i", "Agent \\(i\\)'s chosen action."],
          ["a=(a_1,\\ldots,a_n)", "An action profile from the joint action space."],
          ["a_{-i}", "Other agents' actions."]
        ],
        [
          ["f:A\\to Y", "Mechanism's outcome function mapping actions to outcomes."],
          ["g:T\\to Y", "Outcome rule mapping types to outcomes."]
        ]
      ]
    }
  };

  window.MechanismNotation = Object.freeze({ pages: pages });
})();
