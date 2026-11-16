"use strict";

// Groups contain [TeX symbol, definition] pairs; section labels match their order.
(function () {
  window.MechanismNotation.registerPage("revelation-principle", {
    pageNotation: [
      [["\\succ", "A strict preference relation, read as 'is preferred to'."]],
      [
        ["f^{\\mathrm{I}}", "The outcome function of the indirect mechanism."],
        ["f^{\\mathrm{D}}(\\theta)=f^{\\mathrm{I}}(s^*(\\theta))", "The outcome function of the direct mechanism constructed from the indirect mechanism."]
      ],
      [
        ["s_i^*", "Agent \\(i\\)'s equilibrium strategy from the selected equilibrium."],
        ["s^*=(s_1^*,\\ldots,s_n^*)", "The selected equilibrium strategy profile."],
        ["s_{-i}^*=(s_1^*,\\ldots,s_{i-1}^*,s_{i+1}^*,\\ldots,s_n^*)", "The other agents' equilibrium strategies from the selected equilibrium."]
      ],
      [
        ["\\theta_i'", "Agent \\(i\\)'s alternative report."],
        ["\\theta'=(\\theta_1',\\ldots,\\theta_n')", "A profile of reported types."],
        ["\\theta_{-i}'=(\\theta_1',\\ldots,\\theta_{i-1}',\\theta_{i+1}',\\ldots,\\theta_n')", "The other agents' reports."]
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
        ["\\theta_i", "Agent \\(i\\)'s type."],
        ["\\theta = (\\theta_1, \\ldots, \\theta_n)", "A profile of types."],
        ["\\theta_{-i}=(\\theta_1, \\ldots, \\theta_{i-1}, \\theta_{i+1}, \\ldots, \\theta_n)", "The other agents' types."]
      ],
      [
        ["T_i\\ni \\theta_i", "Agent \\(i\\)'s type space."],
        ["T=\\prod_{i=1}^n T_i\\ni \\theta", "The joint type space."],
      ],
      [["p_i(\\theta_{-i}\\mid\\theta_i)", "Agent \\(i\\)'s conditional belief about the other agents' types; here \\(p\\) is a belief."]],
      [["u_i(y,\\theta)", "Agent \\(i\\)'s payoff from outcome \\(y\\) at type profile \\(\\theta\\)."]],
      [
        ["A_i", "Agent \\(i\\)'s action space."],
        ["A=\\prod_{i=1}^n A_i", "The joint action space."],
        ["a_i", "Agent \\(i\\)'s chosen action."],
        ["a=(a_1,\\ldots,a_n)", "An action profile from the joint action space."],
        ["a_{-i}", "The other agents' actions."]
      ],
      [
        ["f:A\\to Y", "The mechanism's outcome function mapping actions to outcomes."],
        ["g:T\\to Y", "The outcome rule mapping types to outcomes."]
      ]
    ]
  });
})();
