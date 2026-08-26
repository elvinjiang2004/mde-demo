"use strict";

// Shared collapsible-step behavior for `.equation-chain-steps` blocks. The
// grid itself is pure CSS -- column positions are fixed fractions, so nothing
// here needs to measure or reserve widths, and revealing a step cannot shift
// the relation column. Only the toggles need script.
//
// Each row is four cells, in this order, any of which may be empty:
//
//   <div class="equation-chain-steps">
//     <span class="equation-step-connector"></span>
//     <span class="equation-step-lhs">...</span>
//     <span class="equation-step-relation">\(=\)</span>
//     <span class="equation-step-rhs">...</span>
//     <button class="equation-chain-divider-toggle" aria-expanded="false"
//             aria-label="Show more detail" hidden>
//       <span class="equation-chain-divider-toggle-glyph" aria-hidden="true">+</span>
//     </button>
//     <span class="equation-step-connector equation-step-extra" hidden>\(\iff\)</span>
//     <span class="equation-step-lhs equation-step-extra" hidden>...</span>
//     <span class="equation-step-relation equation-step-extra" hidden>\(=\)</span>
//     <span class="equation-step-rhs equation-step-extra" hidden>...</span>
//   </div>
//
// Every consecutive `.equation-step-extra` sibling immediately after a toggle
// belongs to that toggle -- all four cells of a hidden step need the class. A
// toggle followed by no such rows is left hidden, so an authored chain with no
// detail to reveal shows no dead control.
window.EquationChain = Object.freeze({
  initDividers: function () {
    var toggles = Array.prototype.slice.call(
      document.querySelectorAll(".equation-chain-divider-toggle")
    );

    toggles.forEach(function (toggle) {
      var rows = [];
      var node = toggle.nextElementSibling;
      while (node && node.classList.contains("equation-step-extra")) {
        rows.push(node);
        node = node.nextElementSibling;
      }

      if (rows.length === 0) {
        return;
      }

      var bottomRule = document.createElement("div");
      bottomRule.className = "equation-chain-divider-rule";
      bottomRule.hidden = true;
      rows[rows.length - 1].after(bottomRule);

      toggle.hidden = false;
      var glyph = toggle.querySelector(".equation-chain-divider-toggle-glyph");

      toggle.addEventListener("click", function () {
        var expanded = toggle.getAttribute("aria-expanded") === "true";
        rows.forEach(function (row) {
          row.hidden = expanded;
        });
        bottomRule.hidden = expanded;
        toggle.setAttribute("aria-expanded", String(!expanded));
        if (glyph) {
          glyph.textContent = expanded ? "+" : "−";
        }
      });
    });
  }
});
