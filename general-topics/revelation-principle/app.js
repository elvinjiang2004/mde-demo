(function (global) {
  "use strict";
  var M = global.RevelationPrincipleModel;
  var state = { trueRanking: "ABC", publicRankings: ["BCA", "CAB"], report: "ABC", direct: false, first: null, final: null };
  var solution = M.solve(state.publicRankings[0], state.publicRankings[1]);
  var editors = [];
  function byId(id) { return document.getElementById(id); }
  function text(id, value) { byId(id).textContent = value; }
  function announce(message) { text("game-status", message); }
  function displayRanking(value) { return value.split("").join(" ≻ "); }

  function newElection() {
    state.first = null;
    state.final = null;
    state.report = state.trueRanking;
    editors.forEach(function (editor) { editor.cancel(); });
    editors[3].set(state.report);
    render();
  }

  function setPreferences(voter, value) {
    editors[voter].set(value);
    if (voter === 0) {
      state.trueRanking = value;
    } else {
      state.publicRankings[voter - 1] = value;
      solution = M.solve(state.publicRankings[0], state.publicRankings[1]);
      renderDirectRule();
    }
    newElection();
    announce("Voter " + (voter + 1) + ": " + displayRanking(value) + ". " + byId("game-status").textContent);
  }

  function ballots(id, round, shown) {
    Array.from(byId(id).querySelectorAll("dd")).forEach(function (node, index) {
      node.textContent = shown ? round.ballots[index] : "—";
    });
  }

  function tableRow(values) {
    var row = document.createElement("tr");
    values.forEach(function (value, index) {
      var cell = document.createElement(index === 0 ? "th" : "td");
      if (index === 0) { cell.scope = "row"; }
      cell.textContent = value;
      row.appendChild(cell);
    });
    return row;
  }

  function renderDirectRule() {
    var profile = solution.selected;
    byId("direct-rule").textContent = "";
    M.rankings.forEach(function (report) {
      var trace = M.simulate(profile, report);
      byId("direct-rule").appendChild(tableRow([
        displayRanking(report), trace.first.ballots[0], trace.first.winner + " vs C",
        trace.final.ballots[0], trace.final.winner
      ]));
    });
  }

  function render() {
    var profile = solution.selected;
    var firstShown = state.direct || state.first !== null;
    var finalShown = state.direct || state.final !== null;
    var overrides = {};
    if (state.first !== null) { overrides.first = state.first; }
    if (state.final !== null) { overrides.final = state.final; }
    var trace = state.direct ? M.simulate(profile, state.report) : M.simulate(profile, state.trueRanking, overrides);
    var benchmark = M.simulate(profile, state.trueRanking);
    var survivor = trace.first.winner;
    byId("direct-mode").checked = state.direct;
    byId("ranking-report").setAttribute("aria-label", state.direct ? "Voter 1 reported ranking" : "Voter 1 true ranking");
    if (state.direct) { byId("ranking-report").setAttribute("aria-describedby", "ranking-help"); }
    else { byId("ranking-report").removeAttribute("aria-describedby"); }
    editors[3].setEditable(state.direct);
    text("final-contest", firstShown ? survivor + " vs C" : "— vs C");
    var firstBallot = state.direct ? trace.first.ballots[0] : state.first;
    var finalBallot = state.direct ? trace.final.ballots[0] : state.final;
    Array.from(document.querySelectorAll("[data-first]")).forEach(function (button) {
      button.disabled = state.direct;
      button.setAttribute("aria-pressed", String(firstBallot === button.dataset.first));
    });
    byId("vote-survivor").disabled = state.direct || !firstShown;
    byId("vote-c").disabled = state.direct || !firstShown;
    text("vote-survivor", firstShown ? survivor : "—");
    byId("vote-survivor").dataset.candidate = firstShown ? survivor : "";
    byId("vote-survivor").setAttribute("aria-label", firstShown ? "Vote " + survivor + " in round 2" : "Vote for the round 1 winner");
    byId("vote-survivor").setAttribute("aria-pressed", String(finalBallot === survivor));
    byId("vote-c").setAttribute("aria-pressed", String(finalBallot === "C"));
    ballots("first-ballots", trace.first, firstShown);
    ballots("final-ballots", trace.final, finalShown);
    text("first-winner", firstShown ? survivor : "—");
    text("final-winner", finalShown ? trace.final.winner : "—");
    text("outcome-candidate", finalShown ? trace.final.winner : "—");
    byId("outcome-candidate").dataset.candidate = finalShown ? trace.final.winner : "";
    text("own-payoff", finalShown ? M.utility(state.trueRanking, trace.final.winner) : "—");
    byId("benchmark").style.visibility = finalShown && !state.direct ? "visible" : "hidden";
    text("benchmark-candidate", benchmark.final.winner);
    var benchmarkPayoff = M.utility(state.trueRanking, benchmark.final.winner);
    text("benchmark-payoff", benchmarkPayoff);
    if (finalShown) {
      var payoff = M.utility(state.trueRanking, trace.final.winner);
      announce((state.direct ? "Voter 1's report " + displayRanking(state.report) + ". " : "") +
        trace.final.winner + " elected. Voter 1's payoff: " + payoff +
        (state.direct ? "." : ". Benchmark: " + benchmarkPayoff + "."));
    } else {
      announce(firstShown ? survivor + " advances. Choose Voter 1's round 2 vote." : "New election. Choose Voter 1's round 1 vote.");
    }
  }

  [0, 1, 2].forEach(function (index) {
    var initial = index === 0 ? state.trueRanking : state.publicRankings[index - 1];
    editors.push(global.RevelationRanking.create(byId("ranking-" + (index + 1)), initial, function (value) {
      setPreferences(index, value);
    }, announce));
    byId("random-preferences-" + (index + 1)).addEventListener("click", function () {
      setPreferences(index, M.rankings[Math.floor(Math.random() * M.rankings.length)]);
    });
  });
  editors.push(global.RevelationRanking.create(byId("ranking-report"), state.report, function (value) {
    state.report = value;
    render();
  }, announce));

  byId("direct-mode").addEventListener("change", function (event) {
    state.direct = event.target.checked;
    newElection();
  });
  byId("new-election").addEventListener("click", newElection);
  Array.from(document.querySelectorAll("[data-first]")).forEach(function (button) {
    button.addEventListener("click", function () {
      if (state.direct || state.first === button.dataset.first) { return; }
      state.first = button.dataset.first;
      state.final = null;
      render();
    });
  });
  function finalVote(survivor) {
    if (state.direct || state.first === null) { return; }
    state.final = survivor ? M.simulate(solution.selected, state.trueRanking, { first: state.first }).first.winner : "C";
    render();
  }
  byId("vote-survivor").addEventListener("click", function () { finalVote(true); });
  byId("vote-c").addEventListener("click", function () { finalVote(false); });

  global.RevelationPrincipleApp = Object.freeze({
    snapshot: function () {
      return Object.assign({}, state, { publicRankings: state.publicRankings.slice(), selectedId: solution.selected.id });
    }
  });
  renderDirectRule();
  render();
  document.body.dataset.ready = "true";
})(window);
