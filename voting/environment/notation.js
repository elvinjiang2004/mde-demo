"use strict";

// Shared by this Environment page and every lesson in the group.
(function () {
  window.MechanismNotation.registerEnvironment("voting", [
    [
      ["n", "The number of voters."],
      ["i", "A voter's index."]
    ],
    [
      ["E", "The set of candidates."]
    ],
    [
      ["\\preceq_i", "Voter \\(i\\)'s private linear order; \\(a\\preceq_i b\\) means that voter \\(i\\) weakly prefers \\(b\\) to \\(a\\)."],
      ["\\sim_i", "Voter \\(i\\)'s indifference relation; \\(a\\sim_i b\\) means that voter \\(i\\) is indifferent between \\(a\\) and \\(b\\)."],
      ["\\prec_i", "Voter \\(i\\)'s strict preference relation; \\(a\\prec_i b\\) means that voter \\(i\\) strictly prefers \\(b\\) to \\(a\\)."]
    ],
    [
      ["T_i", "The set of linear orders over \\(E\\) for voter \\(i\\)."],
      ["T=\\prod_{i=1}^n T_i", "The joint preference space."]
    ],
    [["f:T\\to E", "The direct voting mechanism selecting a candidate at each reported preference profile."]]
  ]);
})();
