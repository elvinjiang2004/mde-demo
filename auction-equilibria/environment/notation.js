"use strict";

// Shared by this Environment page and every lesson in the group.
(function () {
  window.MechanismNotation.registerEnvironment("auction-equilibria", [
    [
      ["n", "The number of buyers."],
      ["i", "A buyer's index."]
    ],
    [
      ["V_i", "Buyer \\(i\\)'s random private value."],
      ["v_i", "Buyer \\(i\\)'s realized value."]
    ],
    [
      ["F_i", "Buyer \\(i\\)'s value CDF."],
      ["f_i", "Buyer \\(i\\)'s value PDF."]
    ],
    [["[\\underline{v}_i,\\overline{v}_i]", "Buyer \\(i\\)'s value space and the support of \\(F_i\\)."]],
    [["x_i", "Buyer \\(i\\)'s submitted bid."]]
  ]);
})();
