"use strict";

(function () {
  // Definitions follow the current lessons and their shared Environment pages.
  // Each group contains [TeX symbol, definition] pairs, one symbol per row.
  // Groups share a divider. Use bare TeX in symbols and \\( ... \\) in definitions.
  // Page groups follow their first entry's appearance; parallel section labels
  // supply small headings without changing the groups or Environment notation.
  var sharedEnvironmentNotation = {
    "voting": [
      [
        ["n", "The number of voters."],
        ["i", "A voter's index."]
      ],
      [
        ["E", "The finite set of candidates."],
        ["a,b", "Candidates in \\(E\\)."]
      ],
      [
        ["\\preceq_i", "Voter \\(i\\)'s private linear order; \\(a\\preceq_i b\\) means that voter \\(i\\) weakly prefers \\(b\\) to \\(a\\)."],
        ["\\sim_i", "Voter \\(i\\)'s indifference relation; \\(a\\sim_i b\\) holds if and only if \\(a=b\\)."],
        ["\\prec_i", "Voter \\(i\\)'s strict preference relation; \\(a\\prec_i b\\) means that voter \\(i\\) strictly prefers \\(b\\) to \\(a\\)."]
      ],
      [
        ["T_i", "The set of admissible linear orders over \\(E\\) for voter \\(i\\)."],
        ["T=\\prod_{i=1}^n T_i", "The joint preference space."]
      ],
      [["f:T\\to E", "The deterministic rule selecting a candidate for each reported preference profile."]]
    ],
    "auction-equilibria": [
      [
        ["n", "The number of buyers."],
        ["i", "A buyer's index."]
      ],
      [
        ["V_i", "The buyer \\(i\\)'s random private value."],
        ["v_i", "The buyer \\(i\\)'s realized value."]
      ],
      [
        ["F", "The buyers' value CDF."],
        ["f", "The buyers' value PDF."]
      ],
      [["[\\underline{v},\\overline{v}]", "The value space and support of each buyer's value distribution."]]
    ],
    "auction-design": [
      [
        ["n", "The number of buyers."],
        ["i", "A buyer's index."]
      ],
      [
        ["V_i", "The buyer \\(i\\)'s random private value."],
        ["v_i", "The buyer \\(i\\)'s realized value."],
        ["v_i'", "The buyer \\(i\\)'s reported value."]
      ],
      [
        ["F_i", "The buyer \\(i\\)'s value CDF."],
        ["f_i", "The buyer \\(i\\)'s value PDF."]
      ],
      [
        ["T_i=[\\underline{v}_i,\\overline{v}_i]", "The value space and support of buyer \\(i\\)'s value distribution."],
        ["T=\\prod_{i=1}^n T_i", "The joint value space."],
        ["V=(V_1,\\ldots,V_n)", "An unrealized profile of values from the joint value space."],
        ["v=(v_1,\\ldots,v_n)", "A realized profile of values from the joint value space."],
        ["v'=(v_1',\\ldots,v_n')", "A reported profile of values from the joint value space."]
      ],
      [
        ["T_{-i}=\\prod_{j\\ne i} T_j", "The other buyers' joint value space."],
        ["V_{-i}=(V_1,\\ldots,V_{i-1},V_{i+1},\\ldots,V_n)", "The other buyers' unrealized values."],
        ["v_{-i}=(v_1,\\ldots,v_{i-1},v_{i+1},\\ldots,v_n)", "The other buyers' realized values."],
        ["v_{-i}'=(v_1',\\ldots,v_{i-1}',v_{i+1}',\\ldots,v_n')", "The other buyers' reported values."],
        ["f_{-i}(v_{-i})=\\prod_{j\\ne i} f_j(v_j)", "The other buyers' joint density."]
      ],
      [
        ["q=(q_1,\\ldots,q_n):T\\to[0,1]^n", "The allocation rule specifying the probability of allocation to each buyer at each reported value profile."],
        ["q_i:T\\to[0,1]", "The buyer \\(i\\)'s allocation probability at each reported value profile."],
        ["p=(p_1,\\ldots,p_n):T\\to\\mathbb{R}^n", "The payment rule specifying the expected payment from each buyer at each reported value profile."],
        ["p_i:T\\to\\mathbb{R}", "The buyer \\(i\\)'s expected payment at each reported value profile."]
      ],
      [
        ["Q_i(v_i')=\\int_{T_{-i}} q_i(v_i',v_{-i})\\,f_{-i}(v_{-i})\\,dv_{-i}", "The buyer \\(i\\)'s interim allocation probability from reporting \\(v_i'\\), given the other buyers report truthfully."],
        ["P_i(v_i')=\\int_{T_{-i}} p_i(v_i',v_{-i})\\,f_{-i}(v_{-i})\\,dv_{-i}", "The buyer \\(i\\)'s interim expected payment from reporting \\(v_i'\\), given the other buyers report truthfully."],
        ["U_i(v_i,v_i')=v_i Q_i(v_i')-P_i(v_i')", "The buyer \\(i\\)'s interim expected payoff from reporting \\(v_i'\\), given the other buyers report truthfully."],
        ["U_i(v_i)=U_i(v_i,v_i)", "The buyer \\(i\\)'s truthful interim expected payoff."]
      ],
      [["\\phi_i(v_i)=v_i-\\frac{1-F_i(v_i)}{f_i(v_i)}", "The buyer \\(i\\)'s virtual value."]]
    ],
    "bilateral-trade": [
      [
        ["V", "The buyer's random private value."],
        ["v", "The buyer's realized value."],
        ["v'", "The buyer's reported value."]
      ],
      [
        ["C", "The seller's random private value (opportunity cost)."],
        ["c", "The seller's realized value (opportunity cost)."],
        ["c'", "The seller's reported value (opportunity cost)."]
      ],
      [
        ["F_B", "The buyer's value CDF."],
        ["f_B", "The buyer's value PDF."],
        ["F_S", "The seller's value CDF."],
        ["f_S", "The seller's value PDF."]
      ],
      [
        ["[\\underline{v},\\overline{v}]", "The value space and support of the buyer's value distribution."],
        ["[\\underline{c},\\overline{c}]", "The value space and support of the seller's value distribution."],
        ["T=[\\underline{v},\\overline{v}]\\times[\\underline{c},\\overline{c}]", "The joint buyer and seller value space."],
        ["(v,c)", "A profile of values from the joint value space."]
      ],
      [
        ["q:T\\to[0,1]", "The allocation rule specifying the probability of trade at each reported value pair."],
        ["p_B:T\\to\\mathbb{R}", "The buyer's payment rule specifying the expected payment from the buyer at each reported value pair."],
        ["p_S:T\\to\\mathbb{R}", "The seller's payment rule specifying the expected payment to the seller at each reported value pair."]
      ],
      [
        ["Q_B(v')=\\int_{\\underline{c}}^{\\overline{c}} q(v',c)\\,f_S(c)\\,dc", "The buyer's interim allocation probability from reporting \\(v'\\), given the seller reports truthfully."],
        ["P_B(v')=\\int_{\\underline{c}}^{\\overline{c}} p_B(v',c)\\,f_S(c)\\,dc", "The buyer's interim expected payment from reporting \\(v'\\), given the seller reports truthfully."],
        ["U_B(v,v')=v Q_B(v')-P_B(v')", "The buyer's interim expected payoff from reporting \\(v'\\), given the seller reports truthfully."],
        ["U_B(v)=U_B(v,v)", "The buyer's truthful interim expected payoff."]
      ],
      [
        ["Q_S(c')=\\int_{\\underline{v}}^{\\overline{v}} q(v,c')\\,f_B(v)\\,dv", "The seller's interim allocation probability from reporting \\(c'\\), given the buyer reports truthfully."],
        ["P_S(c')=\\int_{\\underline{v}}^{\\overline{v}} p_S(v,c')\\,f_B(v)\\,dv", "The seller's interim expected payment received from reporting \\(c'\\), given the buyer reports truthfully."],
        ["U_S(c,c')=P_S(c')-c Q_S(c')", "The seller's interim expected payoff from reporting \\(c'\\), given the buyer reports truthfully."],
        ["U_S(c)=U_S(c,c)", "The seller's truthful interim expected payoff."]
      ],
      [
        ["\\phi_B(v)=v-\\frac{1-F_B(v)}{f_B(v)}", "The buyer's virtual value."],
        ["\\phi_S(c)=c+\\frac{F_S(c)}{f_S(c)}", "The seller's virtual value."]
      ],
    ]
  };

  // Page notation is authored independently in each page's own array.
  // Only environment definitions are shared between related pages.
  var pages = {
    "gibbard-satterthwaite-theorem": {
      pageNotation: [
        [["|E|", "The number of candidates."]],
        [["f", "The deterministic rule selecting a candidate for each pair of reported rankings."]]
      ],
      pageNotationSections: ["Theorem", "Demo"],
      environmentNotation: sharedEnvironmentNotation["voting"]
    },
    "voting": {
      pageNotation: [],
      environmentNotation: sharedEnvironmentNotation["voting"]
    },
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
        [["Y_1=\\max\\{V_2,\\ldots,V_n\\}", "The highest value among buyers \\(2,\\ldots,n\\)."]],
        [["\\beta^{\\mathrm{I}}(v)=\\mathbb{E}[Y_1\\mid Y_1\\lt v]", "The equilibrium bidding strategy in the symmetric, IPV first-price auction."]],
        [
          ["a=\\underline{v}", "The lower endpoint of each buyer's value support in the demo."],
          ["b=\\overline{v}", "The upper endpoint of each buyer's value support in the demo."],
          ["Z_i\\sim\\mathrm{Beta}(\\alpha,\\beta)", "The buyer \\(i\\)'s auxiliary Beta random variable on \\([0,1]\\), with \\(V_i=a+(b-a)Z_i\\)."]
        ],
        [
          ["\\alpha, \\beta", "The Beta-distribution shape parameters; recall the Beta distribution PDF: \\(h(x)=\\frac{\\Gamma(\\alpha+\\beta)}{\\Gamma(\\alpha)\\Gamma(\\beta)}x^{\\alpha-1}(1-x)^{\\beta-1}\\) for \\(\\alpha,\\beta\\gt 0\\)."],
        ],
        [["x_1", "The buyer 1's proposed bid."]],
        [
          ["G(y)=F(y)^{n-1}", "The CDF of \\(Y_1\\)."],
          ["g(y)", "The PDF of \\(Y_1\\)."]
        ],
        [["U_1(v_1,x_1)", "The buyer 1's expected payoff from bidding \\(x_1\\) with value \\(v_1\\), given other buyers use \\(\\beta^{\\mathrm{I}}\\)."]]
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
      environmentNotation: sharedEnvironmentNotation["auction-equilibria"]
    },
    "second-price": {
      pageNotation: [
        [["\\beta^{\\mathrm{II}}(v)=v", "The dominant bidding strategy in the second-price auction."]],
        [
          ["a=\\underline{v}", "The lower endpoint of each buyer's value support in the demo."],
          ["b=\\overline{v}", "The upper endpoint of each buyer's value support in the demo."],
          ["Z_i\\sim\\mathrm{Beta}(\\alpha,\\beta)", "The buyer \\(i\\)'s auxiliary Beta random variable on \\([0,1]\\), with \\(V_i=a+(b-a)Z_i\\)."]
        ],
        [["\\alpha, \\beta", "The Beta-distribution shape parameters for \\(Z_i\\)."]],
        [["x_1", "The buyer 1's proposed bid."]],
        [["x_2,\\ldots,x_n", "The bids from buyers \\(2,\\ldots,n\\)."]],
        [["p_1=\\max\\{x_2,\\ldots,x_n\\}", "The highest bid among buyers \\(2,\\ldots,n\\)."]],
        [
          ["x^-\\lt v_1", "An alternative underbid."],
          ["x^+\\gt v_1", "An alternative overbid."]
        ]
      ],
      pageNotationSections: [
        "Introduction",
        "Demo",
        "Demo",
        "Demo",
        "Proof of the dominant strategy for buyer 1",
        "Proof of the dominant strategy for buyer 1",
        "Proof of the dominant strategy for buyer 1"
      ],
      environmentNotation: sharedEnvironmentNotation["auction-equilibria"]
    },
    "regular-optimal-auctions": {
      pageNotation: [
        [["r_i=\\inf\\{t\\in T_i\\mid\\phi_i(t)\\geq 0\\}", "The buyer \\(i\\)'s reserve value that he must beat or tie to participate."]],
        [["x_i(v_{-i})=\\inf\\left\\{t\\in T_i\\ \\middle| \\begin{array}{l} \\phi_i(t)\\geq 0,\\\\ \\phi_i(t)\\gt \\phi_j(v_j)\\text{, for every }j\\lt i,\\\\ \\phi_i(t)\\geq\\phi_j(v_j)\\text{, for every }j\\gt i \\end{array} \\right\\}", "The buyer \\(i\\)'s critical winning value under lowest-index priority given other buyers' reports."]],
        [["W(v)=\\left\\{i\\in\\{1,\\ldots,n\\}\\ \\middle| \\begin{array}{l} \\phi_i(v_i)\\geq 0,\\\\ \\phi_i(v_i)=\\max\\{\\phi_j(v_j)\\mid j\\in\\{1,\\ldots,n\\}\\} \\end{array} \\right\\}", "The buyers with the highest weakly positive virtual value."]],
        [
          ["q^*=(q_1^*,\\ldots,q_n^*)", "The optimal mechanism's allocation rule."],
          ["q_i^*(v)=\\begin{cases} 1 & \\text{if }i\\in W(v),\\\\ 0 & \\text{otherwise} \\end{cases}", "The optimal mechanism's allocation rule for buyer \\(i\\)."],
          ["p^*=(p_1^*,\\ldots,p_n^*)", "The optimal mechanism's payment rule."],
          ["p_i^*(v)=\\begin{cases} \\bar{\\phi}_i^{-1}(\\max_{j\\in W(v)} \\bar{\\phi}_j(v_j)) & \\text{if }i\\in W(v),\\\\ 0 & \\text{otherwise} \\end{cases}", "The optimal mechanism's payment rule for buyer \\(i\\)."]
        ],
        [
          ["\\epsilon_i", "The buyer \\(i\\)'s distribution shift: \\(V_i\\sim\\mathrm{Uniform}[\\epsilon_i,\\epsilon_i+1]\\), with \\(\\epsilon_i\\in\\{0,0.1,\\ldots,1\\}\\)."]
        ],
        [["V_{-i}=(V_1,\\ldots,V_{i-1},V_{i+1},\\ldots,V_n)", "The other buyers' random private values."]],
        [
          ["Q_i^*(v_i)", "The optimal mechanism's interim allocation probability for buyer \\(i\\), given the other buyers report truthfully."],
          ["P_i^*(v_i)", "The optimal mechanism's interim expected payment for buyer \\(i\\), given the other buyers report truthfully."]
        ],
        [
          ["\\rho_i", "The posted price offered to buyer \\(i\\) in the virtual-value interpretation."],
          ["\\omicron_i(\\rho_i)=1-F_i(\\rho_i)", "The buyer \\(i\\)'s purchase probability, interpreted as quantity demanded at price \\(\\rho_i\\)."],
          ["\\rho_i(\\omicron_i)=F_i^{-1}(1-\\omicron_i)", "The buyer \\(i\\)'s inverse demand: the price corresponding to quantity \\(\\omicron_i\\)."],
          ["R_i(\\omicron_i)=\\omicron_i F_i^{-1}(1-\\omicron_i)", "The expected revenue from offering buyer \\(i\\) the price corresponding to quantity \\(\\omicron_i\\)."],
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
      environmentNotation: sharedEnvironmentNotation["auction-design"]
    },
    "general-optimal-auctions": {
      pageNotation: [
        [["r_i=\\inf\\{t\\in T_i\\mid\\bar{\\phi}_i(t)\\geq 0\\}", "The buyer \\(i\\)'s reserve value that he must beat or tie to participate."]],
        [["x_i(v_{-i})=\\inf\\left\\{t\\in T_i\\ \\middle| \\begin{array}{l} \\bar{\\phi}_i(t)\\geq 0,\\\\ \\bar{\\phi}_i(t)\\gt \\bar{\\phi}_j(v_j)\\text{, for every }j\\lt i,\\\\ \\bar{\\phi}_i(t)\\geq\\bar{\\phi}_j(v_j)\\text{, for every }j\\gt i \\end{array} \\right\\}", "The buyer \\(i\\)'s critical winning value under lowest-index priority given other buyers' reports."]],
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
          ["h_i(z)=\\phi_i(F_i^{-1}(z))", "The buyer \\(i\\)'s virtual value as a function of quantiles."],
          ["H_i(z)=\\int_0^z h_i(t)\\,dt", "The integral of \\(h_i\\) up to \\(z\\)."],
        ],
        [
          ["G_i", "The greatest convex function that lies below \\(H_i\\) on \\([0,1]\\)."],
          ["g_i", "The right derivative of \\(G_i\\) on \\([0,1)\\), with the left derivative used at \\(1\\)."],
          ["\\bar{\\phi}_i(v_i)=g_i(F_i(v_i))", "The buyer \\(i\\)'s ironed virtual value."]
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
      environmentNotation: sharedEnvironmentNotation["auction-design"]
    },
    "myerson-satterthwaite-theorem": {
      pageNotation: [
        [
          ["\\text{T-L}", "The top-left half of a cell."],
          ["\\text{B-R}", "The bottom-right half of a cell."]
        ],
        [
          ["u_B(v,c)=v q-p_B(v,c)", "The buyer's ex-post, truthful payoff at \\(v, c\\)."],
          ["u_S(v,c)=p_S(v,c)-c q", "The seller's ex-post, truthful payoff at \\(v, c\\)."],
          ["R(v,c)=p_B(v,c)-p_S(v,c)", "The ex-post, net revenue at \\(v, c\\)."],
          ["L(v,c)=\\max\\{v-c,0\\}-(v-c)q(v,c)", "The ex-post lost gains from trade at \\(v, c\\)."]
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
          ["z_B", "The posted buyer price."],
          ["z_S", "The posted seller price."]
        ],
        [["K", "The constant payment offset from buyer to seller in the AGV mechanism."]],
        [["t", "The minimum \\(v-c\\) required for trade."]],
        [["k", "The weight on the buyer's report in the \\(k\\)-double auction mechanism."]],
        [
          ["\\alpha", "The buyer's markup in the revenue-threshold mechanism."],
          ["\\beta", "The seller's discount in the revenue-threshold mechanism."]
        ],
        [
          ["\\text{T-L}", "The top-left half of a cell."],
          ["\\text{B-R}", "The bottom-right half of a cell."]
        ],
        [
          ["u_B(v,c)=v q-p_B(v,c)", "The buyer's ex-post, truthful payoff at \\(v, c\\)."],
          ["u_S(v,c)=p_S(v,c)-c q", "The seller's ex-post, truthful payoff at \\(v, c\\)."],
          ["R(v,c)=p_B(v,c)-p_S(v,c)", "The ex-post, net revenue at \\(v, c\\)."],
          ["L(v,c)=\\max\\{v-c,0\\}-(v-c)q(v,c)", "The ex-post lost gains from trade at \\(v, c\\)."]
        ]
      ],
      pageNotationSections: [
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
          ["q=(q_1,\\ldots,q_n):T\\to[0,1]^n", "The allocation rule specifying the probability of allocation to each buyer at each reported value profile."],
          ["q_i:T\\to[0,1]", "The buyer \\(i\\)'s allocation probability at each reported value profile."],
          ["p=(p_1,\\ldots,p_n):T\\to\\mathbb{R}^n", "The payment rule specifying the expected payment from each buyer at each reported value profile."],
          ["p_i:T\\to\\mathbb{R}", "The buyer \\(i\\)'s expected payment at each reported value profile."],
          ["u_i(v',v_i)=q_i(v')v_i-p_i(v')", "The buyer \\(i\\)'s ex-post payoff given the reported value profile \\(v'\\) and true value \\(v_i\\)."],
          ["u_i(v)=u_i(v,v_i)", "The buyer \\(i\\)'s truthful ex-post payoff at a value profile."]
        ],
        [
          ["n", "The number of buyers."],
          ["i", "A buyer's index."]
        ],
        [
          ["Q_i(v_i')=\\int_{T_{-i}} q_i(v_i',v_{-i})\\,f_{-i}(v_{-i})\\,dv_{-i}", "The buyer \\(i\\)'s interim allocation probability from reporting \\(v_i'\\), given the other buyers report truthfully."],
          ["P_i(v_i')=\\int_{T_{-i}} p_i(v_i',v_{-i})\\,f_{-i}(v_{-i})\\,dv_{-i}", "The buyer \\(i\\)'s interim expected payment from reporting \\(v_i'\\), given the other buyers report truthfully."],
          ["U_i(v_i,v_i')=v_i Q_i(v_i')-P_i(v_i')", "The buyer \\(i\\)'s interim expected payoff from reporting \\(v_i'\\), given the other buyers report truthfully."],
          ["U_i(v_i)=U_i(v_i,v_i)", "The buyer \\(i\\)'s truthful interim expected payoff."]
        ],
        [
          ["v_i", "The buyer \\(i\\)'s realized value."],
          ["v_i'", "The buyer \\(i\\)'s reported value."]
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
    },
    "revelation-principle": {
      pageNotation: [
        [["\\succ", "A strict preference: the candidate on the left is preferred to the candidate on the right."]],
        [
          ["f^{\\mathrm{I}}", "The outcome function of the indirect mechanism."],
          ["f^{\\mathrm{D}}", "The outcome function of the constructed direct mechanism."]
        ],
        [
          ["s_i^*", "The agent \\(i\\)'s selected equilibrium strategy."],
          ["s^*", "The selected equilibrium strategy profile."],
          ["s_{-i}^*", "The other agents' selected equilibrium strategies."]
        ],
        [
          ["\\hat{\\theta}_i", "The agent \\(i\\)'s alternative report."],
          ["\\hat{\\theta}_{-i}", "The other agents' reports."],
          ["\\hat{\\theta}=(\\hat{\\theta}_i,\\hat{\\theta}_{-i})", "A complete profile of reported types."]
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
          ["n", "The number of agents."],
          ["i", "An agent's index."]
        ],
        [
          ["Y", "The outcome space."],
          ["y", "An outcome from the outcome space."]
        ],
        [
          ["\\theta_i", "The agent \\(i\\)'s type."],
          ["\\theta = (\\theta_1, \\ldots, \\theta_n)", "A profile of types."],
          ["\\theta_{-i}=(\\theta_1, \\ldots, \\theta_{i-1}, \\theta_{i+1}, \\ldots, \\theta_n)", "The other agents' types."]
        ],
        [
          ["T_i\\ni \\theta_i", "The agent \\(i\\)'s type space."],
          ["T=\\prod_{i=1}^n T_i\\ni \\theta", "The joint type space."],
        ],
        [["p_i(\\theta_{-i}\\mid\\theta_i)", "The agent \\(i\\)'s conditional belief about the other agents' types; here \\(p\\) is a belief."]],
        [["u_i(y,\\theta)", "The agent \\(i\\)'s payoff from outcome \\(y\\) at type profile \\(\\theta\\)."]],
        [
          ["A_i", "The agent \\(i\\)'s action space."],
          ["A=\\prod_{i=1}^n A_i", "The joint action space."],
          ["a_i", "The agent \\(i\\)'s chosen action."],
          ["a=(a_1,\\ldots,a_n)", "An action profile from the joint action space."],
          ["a_{-i}", "The other agents' actions."]
        ],
        [
          ["f:A\\to Y", "The mechanism's outcome function mapping actions to outcomes."],
          ["g:T\\to Y", "The outcome rule mapping types to outcomes."]
        ]
      ]
    }
  };

  window.MechanismNotation = Object.freeze({ pages: pages });
})();
