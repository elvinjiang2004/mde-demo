"use strict";

// Shared by this Environment page and every lesson in the group.
(function () {
  window.MechanismNotation.registerEnvironment("auction-design", [
    [
      ["n", "The number of buyers."],
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
      ["q_i:T\\to[0,1]", "Buyer \\(i\\)'s allocation probability at each reported value profile."],
      ["p=(p_1,\\ldots,p_n):T\\to\\mathbb{R}^n", "The payment rule specifying the expected payment from each buyer at each reported value profile."],
      ["p_i:T\\to\\mathbb{R}", "Buyer \\(i\\)'s expected payment at each reported value profile."]
    ],
    [
      ["Q_i(v_i')=\\int_{T_{-i}} q_i(v_i',v_{-i})\\,f_{-i}(v_{-i})\\,dv_{-i}", "Buyer \\(i\\)'s interim allocation probability from reporting \\(v_i'\\), given the other buyers report truthfully."],
      ["P_i(v_i')=\\int_{T_{-i}} p_i(v_i',v_{-i})\\,f_{-i}(v_{-i})\\,dv_{-i}", "Buyer \\(i\\)'s interim expected payment from reporting \\(v_i'\\), given the other buyers report truthfully."],
      ["U_i(v_i,v_i')=v_i Q_i(v_i')-P_i(v_i')", "Buyer \\(i\\)'s interim expected payoff from reporting \\(v_i'\\), given the other buyers report truthfully."],
      ["U_i(v_i)=U_i(v_i,v_i)", "Buyer \\(i\\)'s truthful interim expected payoff."]
    ],
    [["\\phi_i(v_i)=v_i-\\frac{1-F_i(v_i)}{f_i(v_i)}", "Buyer \\(i\\)'s virtual value."]]
  ]);
})();
