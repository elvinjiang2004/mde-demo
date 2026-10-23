"use strict";

(function () {
  // Definitions follow the current lessons and their shared Environment pages.
  // Each group contains [TeX symbol, definition] pairs, one symbol per row.
  // Groups share a divider. Use bare TeX in symbols and \\( ... \\) in definitions.
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
      [["[\\underline v,\\overline v]", "Value space and support of each buyer's value distribution."]]
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
        ["T_i=[\\underline v_i,\\overline v_i]", "Value space and support of buyer \\(i\\)'s value distribution."],
        ["T=\\prod_{i=1}^n T_i", "Joint value space."],
        ["v=(v_1,\\ldots,v_n)", "A profile of values from the joint value space."]
      ],
      [
        ["v_{-i}=(v_1,\\ldots,v_{i-1},v_{i+1},\\ldots,v_n)", "Other buyers' values."],
        ["T_{-i}=\\prod_{j\\ne i} T_j", "Other buyers' joint value space."],
        ["f_{-i}(v_{-i})=\\prod_{j\\ne i} f_j(v_j)", "Other buyers' joint density."]
      ],
      [
        ["q=(q_1,\\ldots,q_n):T\\to[0,1]^n", "Allocation rule specifying the probability of allocation to each buyer at each reported value profile."],
        ["q_i:T\\to[0,1]", "Buyer \\(i\\)'s allocation probability at each reported value profile."],
        ["p=(p_1,\\ldots,p_n):T\\to\\mathbb R^n", "Payment rule specifying the expected payment from each buyer at each reported value profile."],
        ["p_i:T\\to\\mathbb R", "Buyer \\(i\\)'s expected payment at each reported value profile."]
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
        ["[\\underline v,\\overline v]", "Value space and support of the buyer's value distribution."],
        ["[\\underline c,\\overline c]", "Value space and support of the seller's value distribution."],
        ["T=[\\underline v,\\overline v]\\times[\\underline c,\\overline c]", "Joint buyer and seller type space."],
        ["(v,c)", "A profile of values from the joint type space."]
      ],
      [
        ["q:T\\to[0,1]", "Allocation rule specifying the probability of trade at each reported value pair."],
        ["p_B:T\\to\\mathbb R", "Buyer's payment rule specifying the expected payment from the buyer at each reported value pair."],
        ["p_S:T\\to\\mathbb R", "Seller's payment rule specifying the expected payment to the seller at each reported value pair."]
      ],
      [
        ["Q_B(v')=\\int_{\\underline c}^{\\overline c} q(v',c)\\,f_S(c)\\,dc", "Buyer's interim allocation probability from reporting \\(v'\\), given the seller reports truthfully."],
        ["P_B(v')=\\int_{\\underline c}^{\\overline c} p_B(v',c)\\,f_S(c)\\,dc", "Buyer's interim expected payment from reporting \\(v'\\), given the seller reports truthfully."],
        ["U_B(v,v')=v Q_B(v')-P_B(v')", "Buyer's interim expected payoff from reporting \\(v'\\), given the seller reports truthfully."],
        ["U_B(v)=U_B(v,v)", "Buyer's truthful interim expected payoff."],
        ["Q_S(c')=\\int_{\\underline v}^{\\overline v} q(v,c')\\,f_B(v)\\,dv", "Seller's interim allocation probability from reporting \\(c'\\), given the buyer reports truthfully."],
        ["P_S(c')=\\int_{\\underline v}^{\\overline v} p_S(v,c')\\,f_B(v)\\,dv", "Seller's interim expected payment received from reporting \\(c'\\), given the buyer reports truthfully."],
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
        [
          ["\\alpha, \\beta", "Beta-distribution shape parameters; recall the Beta distribution PDF: \\(f(x)=\\frac{\\Gamma(\\alpha+\\beta)}{\\Gamma(\\alpha)\\Gamma(\\beta)}x^{\\alpha-1}(1-x)^{\\beta-1}\\) for \\(\\alpha,\\beta>0\\)."]
        ],
        [["Y_1=\\max\\{V_2,\\ldots,V_n\\}", "Highest value among buyers \\(2,\\ldots,n\\)."]],
        [
          ["G(y)=F(y)^{n-1}", "\\(Y_1\\)'s CDF."],
          ["g(y)", "\\(Y_1\\)'s PDF."]
        ],
        [["\\beta^{\\mathrm I}(v)=\\mathbb E[Y_1\\mid Y_1<v]", "Equilibrium bidding strategy in the symmetric, IPV first-price auction."]],
        [["z\\in[a,b]", "An alternative value used in proof."]],
        [["U_1(v_1,x_1)", "Buyer 1's expected payoff from bidding \\(x_1\\) with value \\(v_1\\), given other buyers use \\(\\beta^{\\mathrm I}\\)."]]
      ],
      environmentNotation: sharedEnvironmentNotation["auction-equilibria"]
    },
    "second-price": {
      pageNotation: [

        [["\\beta^{\\mathrm{II}}(v)=v", "Dominant bidding strategy in the second-price auction."]],
        [["x_2,\\ldots,x_n", "Bids from buyers \\(2,\\ldots,n\\)."]],
        [["p_1=\\max\\{x_2,\\ldots,x_n\\}", "Highest bid among buyers \\(2,\\ldots,n\\)."]],
        [
          ["x^-<v_1", "An alternative underbid used in proof."],
          ["x^+>v_1", "An alternative overbid used in proof."]
        ]
      ],
      environmentNotation: sharedEnvironmentNotation["auction-equilibria"]
    },
    "optimal-auctions": {
      pageNotation: [
        [["r", "A reserve price that the winning bid must exceed."]],
      ],
      environmentNotation: sharedEnvironmentNotation["auction-design"]
    },
    "ironing": {
      pageNotation: [
        [
          ["c", "Distribution breakpoint."],
          ["\\pi", "Probability that a value lies in the lower interval \\([0,c]\\)."]
        ]
      ],
      environmentNotation: sharedEnvironmentNotation["auction-design"]
    },
    "myerson-satterthwaite-theorem": {
      pageNotation: [
        [
          ["u_B(v,c)=v q-p_B(v,c)", "Buyer's ex-post, truthful payoff at \\(v, c\\)."],
          ["u_S(v,c)=p_S(v,c)-c q", "Seller's ex-post, truthful payoff at \\(v, c\\)."],
          ["R(v,c)=p_B(v,c)-p_S(v,c)", "Ex-post, net revenue at \\(v, c\\)."],
          ["L(v,c)=\\max(v-c,0)-(v-c)q(v,c)", "Ex-post lost gains from trade at \\(v, c\\)."]
        ],
        [
          ["\\text{T-L}", "Top-left half of a cell."],
          ["\\text{B-R}", "Bottom-right half of a cell."]
        ],
        [["q^*(v,c)=\\mathbb{1}(v\\geq c)", "The ex-post efficient allocation rule."]]
      ],
      environmentNotation: sharedEnvironmentNotation["bilateral-trade"]
    },
    "bargaining-mechanism-sandbox": {
      pageNotation: [
        [
          ["u_B(v,c)=v q-p_B(v,c)", "Buyer's ex-post, truthful payoff at \\(v, c\\)."],
          ["u_S(v,c)=p_S(v,c)-c q", "Seller's ex-post, truthful payoff at \\(v, c\\)."],
          ["R(v,c)=p_B(v,c)-p_S(v,c)", "Ex-post, net revenue at \\(v, c\\)."],
          ["L(v,c)=\\max(v-c,0)-(v-c)q(v,c)", "Ex-post lost gains from trade at \\(v, c\\)."]
        ],
        [
          ["\\text{T-L}", "Top-left half of a cell."],
          ["\\text{B-R}", "Bottom-right half of a cell."]
        ],
        [
          ["v'", "Alternate buyer report in the deviation-payoff plot; equivalent to \\(v'\\)."],
          ["c'", "Alternate seller report in the deviation-payoff plot; equivalent to \\(c'\\)."]
        ],
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
        ]
      ],
      environmentNotation: sharedEnvironmentNotation["bilateral-trade"]
    },
    "envelope-theorem": {
      pageNotation: [
        [
          ["v", "Buyer's realized value in the mechanism-design application."],
          ["v'", "Buyer's reported value in the mechanism-design application."]
        ],
        [
          ["q(v')", "Allocation probability from reporting \\(v'\\) in the mechanism-design application."],
          ["p(v')", "Expected payment from reporting \\(v'\\) in the mechanism-design application."]
        ],
        [
          ["u(v,v')=v q(v')-p(v')", "Buyer's payoff from reporting \\(v'\\) in the mechanism-design application."],
          ["U(v)", "Maximum payoff over reports in the application; under IC it equals truthful payoff."]
        ],
        [
          ["V^*(v)", "Set of optimal reports in the mechanism-design application."],
          ["v^*(v)", "A selected optimal report in the mechanism-design application."]
        ],
        [["u_i(v_i,v_{-i})", "Truthful payoff with the other buyers' reports held fixed in the DSIC payment condition."]],
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
          ["T_i=[\\underline v_i,\\overline v_i]", "Value space and support of buyer \\(i\\)'s value distribution."],
          ["T=\\prod_{i=1}^n T_i", "Joint value space."],
          ["v=(v_1,\\ldots,v_n)", "A profile of values from the joint value space."]
        ],
        [
          ["v_{-i}=(v_1,\\ldots,v_{i-1},v_{i+1},\\ldots,v_n)", "Other buyers' values."],
          ["T_{-i}=\\prod_{j\\ne i} T_j", "Other buyers' joint value space."],
          ["f_{-i}(v_{-i})=\\prod_{j\\ne i} f_j(v_j)", "Other buyers' joint density."]
        ],
        [
          ["q=(q_1,\\ldots,q_n):T\\to[0,1]^n", "Allocation rule specifying the probability of allocation to each buyer at each reported value profile."],
          ["q_i:T\\to[0,1]", "Buyer \\(i\\)'s allocation probability at each reported value profile."],
          ["p=(p_1,\\ldots,p_n):T\\to\\mathbb R^n", "Payment rule specifying the expected payment from each buyer at each reported value profile."],
          ["p_i:T\\to\\mathbb R", "Buyer \\(i\\)'s expected payment at each reported value profile."]
        ],
        [
          ["Q_i(v_i')=\\int_{T_{-i}} q_i(v_i',v_{-i})\\,f_{-i}(v_{-i})\\,dv_{-i}", "Buyer \\(i\\)'s interim allocation probability from reporting \\(v_i'\\), given the other buyers report truthfully."],
          ["P_i(v_i')=\\int_{T_{-i}} p_i(v_i',v_{-i})\\,f_{-i}(v_{-i})\\,dv_{-i}", "Buyer \\(i\\)'s interim expected payment from reporting \\(v_i'\\), given the other buyers report truthfully."],
          ["U_i(v_i,v_i')=v_i Q_i(v_i')-P_i(v_i')", "Buyer \\(i\\)'s interim expected payoff from reporting \\(v_i'\\), given the other buyers report truthfully."],
          ["U_i(v_i)=U_i(v_i,v_i)", "Buyer \\(i\\)'s truthful interim expected payoff."]
        ],
        [["\\phi_i(v_i)=v_i-\\frac{1-F_i(v_i)}{f_i(v_i)}", "Buyer \\(i\\)'s virtual value."]]
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
        [["f: X \\times T \\to \\mathbb R", "Objective function ."]],
        [["V(t)=\\sup\\{f(x,t)|x\\in X\\}", "Value function or upper envelope of the family of objective functions indexed by choice \\(x\\in X\\)."]],
        [
          ["X^*(t)=\\arg\\max\\{f(x,t)|x\\in X\\}", "Set of choices that maximize the objective at \\(t\\)."],
          ["x^*(t)", "A selection from the \\(X^*(t)\\) if it is nonempty."]
        ],
        [["b: T \\to \\mathbb R", "Theorem 2 condition 2's integrable bound."]]
      ]
    },
    "revelation-principle": {
      pageNotation: [
        [["\\succ", "Strict preference: the candidate on the left is preferred to the candidate on the right."]],
        [
          ["a_i", "Agent \\(i\\)'s chosen action."],
          ["a", "An action profile from the joint action space."],
          ["a_{-i}", "Other agents' actions."]
        ],
        [
          ["s_i^*", "Agent \\(i\\)'s selected equilibrium strategy."],
          ["s^*", "Selected equilibrium strategy profile."],
          ["s_{-i}^*", "Other agents' selected equilibrium strategies."]
        ],
        [
          ["f^{\\mathrm I}", "Outcome function of the indirect mechanism."],
          ["f^{\\mathrm D}", "Outcome function of the constructed direct mechanism."]
        ],
        [
          ["\\hat\\theta_i", "Agent \\(i\\)'s alternative report."],
          ["\\hat\\theta_{-i}", "Other agents' reports."]
        ]
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
          ["T_i", "Agent \\(i\\)'s type space."],
          ["\\theta_i", "Agent \\(i\\)'s private type."],
          ["T=\\prod_i T_i", "Joint type space."],
          ["\\theta", "A profile of types from the joint type space."],
          ["\\theta_{-i}", "Other agents' types."]
        ],
        [["p_i(\\theta_{-i}\\mid\\theta_i)", "Agent \\(i\\)'s conditional belief about the other agents' types; here \\(p\\) is a belief."]],
        [["U_i(y,\\theta)", "Agent \\(i\\)'s payoff from outcome \\(y\\) at type profile \\(\\theta\\)."]],
        [
          ["A_i", "Agent \\(i\\)'s action space."],
          ["A", "Joint action space."]
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
