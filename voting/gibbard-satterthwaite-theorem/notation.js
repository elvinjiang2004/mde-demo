"use strict";

// Groups contain [TeX symbol, definition] pairs; section labels match their order.
(function () {
  window.MechanismNotation.registerPage("gibbard-satterthwaite-theorem", {
    pageNotation: [
      [["\\preceq_i,\\preceq_i'\\in T_i", "Two preference orderings for voter \\(i\\)."]],
      [
        ["\\begin{aligned}\\preceq&=(\\preceq_1,\\ldots,\\preceq_n),\\\\\\preceq'&=(\\preceq_1',\\ldots,\\preceq_n')\\in T\\end{aligned}", "Two preference profiles for all voters."]
      ],
      [["X,Y", "Two candidates; in the proof, \\(X=f(\\preceq)\\) and \\(Y=f(\\preceq')\\)."]],
      [
        ["Z_0,\\ldots,Z_n", "The sequence of elected candidates as voters switch one at a time in index order from the preference profile \\(\\preceq\\) to \\(\\preceq'\\)."],
        ["k", "The first index for which \\(Z_k\\ne X\\), so \\(Z_{k-1}=X\\)."]
      ],
      [["\\prec_k,\\prec_k'", "Voter \\(k\\)'s strict preference relations under \\(\\preceq_k\\) and \\(\\preceq_k'\\), respectively."]]
    ],
    pageNotationSections: [
      "Monotone mechanisms",
      "Monotone mechanisms",
      "Monotone mechanisms",
      "Monotone mechanisms",
      "Monotone mechanisms"
    ],
    environmentNotation: window.MechanismNotation.pages["voting"].environmentNotation
  });
})();
