(function () {
  "use strict";
  var model = window.GibbardSatterthwaiteTheoremModel;
  var demo = document.getElementById("voting-demo");
  var body = document.getElementById("rule-body");
  var head = document.getElementById("rule-head");
  var table = document.getElementById("rule-table");
  var scroll = document.getElementById("rule-scroll");
  var brushButtons = Array.from(document.querySelectorAll(".winner-choice"));
  var cells = [];
  var selected = 0;
  var brush = "A";
  var activePointer = null;
  var rule = model.createRule("plurality");
  var audit = model.audit(rule);

  function ranking(index) { return model.RANKINGS[index].join(" ≻ "); }
  function verdict(id, satisfied, text) {
    var node = document.getElementById(id);
    node.dataset.satisfied = String(satisfied);
    node.textContent = text;
  }
  function renderBrush() {
    brushButtons.forEach(function (button) {
      button.setAttribute("aria-pressed", String(button.dataset.candidate === brush));
    });
  }
  function selectBrush(candidate) {
    endStroke();
    brush = candidate;
    renderBrush();
    document.getElementById("live-summary").textContent = "Winner brush " + brush + ".";
  }
  function paint(index) {
    selected = index;
    if (rule[index] !== brush) {
      rule = model.replaceOutcome(rule, index, brush);
      audit = model.audit(rule);
    }
    render();
  }
  function makeCell(row, column) {
    var index = row * 6 + column;
    var td = document.createElement("td");
    var button = document.createElement("button");
    td.dataset.index = String(index);
    button.type = "button";
    button.className = "text-button rule-cell";
    button.dataset.index = String(index);
    button.setAttribute("aria-describedby", "rule-keyboard");
    button.addEventListener("click", function (event) {
      // Pointer strokes already paint on press/move; native keyboard clicks have detail zero.
      if (event.detail === 0) { paint(index); }
    });
    button.addEventListener("keydown", function (event) {
      var next = index;
      if (event.key === "ArrowUp") { next = Math.max(0, row - 1) * 6 + column; }
      else if (event.key === "ArrowDown") { next = Math.min(5, row + 1) * 6 + column; }
      else if (event.key === "ArrowLeft") { next = row * 6 + Math.max(0, column - 1); }
      else if (event.key === "ArrowRight") { next = row * 6 + Math.min(5, column + 1); }
      else if (event.key === "Home") { next = row * 6; }
      else if (event.key === "End") { next = row * 6 + 5; }
      else if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
        event.preventDefault();
        paint(index);
        return;
      } else if (/^[abc]$/i.test(event.key) && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        selectBrush(event.key.toUpperCase());
        paint(index);
        return;
      } else { return; }
      event.preventDefault();
      selected = next;
      render();
      cells[next].button.focus({ preventScroll: true });
      revealCell(cells[next].button);
    });
    td.appendChild(button);
    cells.push({ td: td, button: button });
    return td;
  }
  function buildTable() {
    var row = document.createElement("tr");
    var corner = document.createElement("th");
    corner.className = "table-corner";
    corner.setAttribute("aria-label", "Voter 1 rankings on rows; Voter 2 rankings on columns");
    var divider = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    divider.setAttribute("viewBox", "0 0 100 100");
    divider.setAttribute("preserveAspectRatio", "none");
    divider.setAttribute("aria-hidden", "true");
    var line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", "0"); line.setAttribute("y1", "0");
    line.setAttribute("x2", "100"); line.setAttribute("y2", "100");
    line.setAttribute("vector-effect", "non-scaling-stroke");
    divider.appendChild(line);
    corner.appendChild(divider);
    [1, 2].forEach(function (voter) {
      var label = document.createElement("span");
      label.className = "corner-voter-" + voter;
      label.textContent = "Voter " + voter;
      corner.appendChild(label);
    });
    row.appendChild(corner);
    model.RANKINGS.forEach(function (_, index) {
      var th = document.createElement("th");
      th.scope = "col";
      th.textContent = ranking(index);
      row.appendChild(th);
    });
    head.appendChild(row);
    model.RANKINGS.forEach(function (_, rowIndex) {
      var tr = document.createElement("tr");
      var th = document.createElement("th");
      th.scope = "row";
      th.textContent = ranking(rowIndex);
      tr.appendChild(th);
      model.RANKINGS.forEach(function (_, column) { tr.appendChild(makeCell(rowIndex, column)); });
      body.appendChild(tr);
    });
  }
  function revealCell(button) {
    var bounds = button.getBoundingClientRect();
    var region = scroll.getBoundingClientRect();
    if (bounds.left < region.left + 4) { scroll.scrollLeft += bounds.left - region.left - 4; }
    else if (bounds.right > region.right - 4) { scroll.scrollLeft += bounds.right - region.right + 4; }
  }
  function render() {
    var flags = cells.map(function () { return [false, false]; });
    audit.manipulations.forEach(function (deviation) { flags[deviation.from][deviation.voter] = true; });
    cells.forEach(function (entry, index) {
      var row = Math.floor(index / 6), column = index % 6;
      var voters = [];
      if (flags[index][0]) { voters.push("Voter 1"); }
      if (flags[index][1]) { voters.push("Voter 2"); }
      entry.button.textContent = rule[index];
      entry.button.className = "text-button rule-cell candidate-" + rule[index].toLowerCase();
      entry.button.dataset.winner = rule[index];
      entry.button.tabIndex = index === selected ? 0 : -1;
      entry.button.setAttribute("aria-pressed", String(index === selected));
      entry.button.setAttribute("aria-label", "Voter 1: " + ranking(row) + "; Voter 2: " + ranking(column) +
        "; winner " + rule[index] + "; " + (voters.length ? "profitable misreport for " + voters.join(" and ") : "no profitable misreport"));
      entry.td.classList.toggle("is-selected", index === selected);
      entry.td.classList.toggle("has-voter-1-manipulation", flags[index][0]);
      entry.td.classList.toggle("has-voter-2-manipulation", flags[index][1]);
      entry.td.dataset.voter1Manipulable = String(flags[index][0]);
      entry.td.dataset.voter2Manipulable = String(flags[index][1]);
    });
    renderBrush();
    verdict("onto-verdict", audit.onto, audit.onto ? "Passes (Every candidate can win)" :
      "Fails (" + (audit.missingCandidates.length === 1 ? "Candidate " : "Candidates ") +
      audit.missingCandidates.join(" and ") + " cannot win)");
    verdict("dictator-verdict", audit.dictators.length === 0, audit.dictators.length === 0 ? "Passes (No voter is a dictator)" :
      "Fails (Voter " + (audit.dictators[0] + 1) + " is a dictator)");
    verdict("strategy-verdict", audit.strategyProof, audit.strategyProof ? "Passes (No profitable misreports)" :
      "Fails (Profitable misreporting profiles marked with a red triangle in the bottom left/upper right for Voter 1/Voter 2)");
    document.getElementById("live-summary").textContent = cells[selected].button.getAttribute("aria-label") + ".";
  }
  function pointerIndex(event, hitTest) {
    var target = hitTest ? document.elementFromPoint(event.clientX, event.clientY) : event.target;
    var td = target && target.closest("td[data-index]");
    if (!td && event.target.closest) { td = event.target.closest("td[data-index]"); }
    return td && table.contains(td) ? Number(td.dataset.index) : null;
  }
  function endStroke(event) {
    if (activePointer === null || (event && event.pointerId !== activePointer)) { return; }
    var pointerId = activePointer;
    activePointer = null;
    if (table.hasPointerCapture && table.hasPointerCapture(pointerId)) { table.releasePointerCapture(pointerId); }
  }
  table.addEventListener("pointerdown", function (event) {
    if (activePointer !== null || !event.isPrimary || event.button !== 0) { return; }
    var index = pointerIndex(event, false);
    if (index === null) { return; }
    event.preventDefault();
    activePointer = event.pointerId;
    if (table.setPointerCapture) { table.setPointerCapture(activePointer); }
    paint(index);
    cells[index].button.focus({ preventScroll: true });
  });
  table.addEventListener("pointermove", function (event) {
    if (activePointer === null || event.pointerId !== activePointer || !event.isPrimary) { return; }
    if (!(event.buttons & 1)) { endStroke(event); return; }
    var index = pointerIndex(event, true);
    if (index !== null && (index !== selected || rule[index] !== brush)) {
      paint(index);
      cells[index].button.focus({ preventScroll: true });
    }
  });
  ["pointerup", "pointercancel", "lostpointercapture"].forEach(function (type) {
    table.addEventListener(type, endStroke);
  });
  brushButtons.forEach(function (button) {
    button.addEventListener("click", function () { selectBrush(button.dataset.candidate); });
  });
  buildTable();
  render();
  demo.dataset.ready = "true";
  window.MechanismMath.typesetInitial(".introduction, .rule-heading, #derivation, .notes, .references");
})();
