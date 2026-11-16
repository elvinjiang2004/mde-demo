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
      ["F", "The buyers' value CDF."],
      ["f", "The buyers' value PDF."]
    ],
    [["[\\underline{v},\\overline{v}]", "The value space and support of each buyer's value distribution."]]
  ]);
})();
