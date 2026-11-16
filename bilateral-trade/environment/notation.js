"use strict";

// Shared by this Environment page and every lesson in the group.
(function () {
  window.MechanismNotation.registerEnvironment("bilateral-trade", [
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
  ]);
})();
