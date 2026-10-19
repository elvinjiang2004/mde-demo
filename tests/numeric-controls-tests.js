(function () {
  "use strict";
  var T = MechanismTest, N = NumericControls, tests = [];
  function test(name, run) { tests.push({ name: name, run: run }); }
  function pair() {
    var box = document.getElementById("sandbox");
    box.innerHTML = '<input type="number" value="0.5"><input type="range" min="0" max="1" step="any" value="0.5">';
    return { number: box.children[0], range: box.children[1] };
  }
  test("Live number and slider paths synchronize through accepted state without rounding", function () {
    var p = pair(), state = 0.5;
    N.bindPair({ number: p.number, range: p.range, update: function (value) {
      state = Math.max(0, Math.min(1, value)); p.number.value = state.toFixed(3); p.range.value = state;
    }});
    p.number.value = "0.1234567"; T.dispatch(p.number, "input", window);
    T.assertClose(state, 0.1234567); T.assert(p.number.value === "0.123");
    T.assertClose(p.range.valueAsNumber, state);
    p.range.value = "0.81"; T.dispatch(p.range, "input", window);
    T.assertClose(state, 0.81); T.assert(p.number.value === "0.810");
  });
  test("Empty and invalid edits preserve state and can recover on commit", function () {
    var p = pair(), state = 0.5, errors = 0;
    N.bindPair({ number: p.number, range: p.range,
      invalid: function () { errors += 1; }, update: function (v) { state = v; },
      afterCommit: function () { p.number.value = state; }});
    ["", "not-a-number"].forEach(function (v) {
      p.number.value = v; T.dispatch(p.number, "input", window); T.assertClose(state, 0.5);
      T.dispatch(p.number, "change", window); T.assert(p.number.value === "0.5");
    });
    T.assert(errors === 2);
    p.number.value = "0.7"; T.dispatch(p.number, "input", window); T.assertClose(state, 0.7);
  });
  test("Commit-only typing, live sliders and removal retain their separate event policies", function () {
    var p = pair(), values = [], before = 0;
    var remove = N.bindPair({ number: p.number, range: p.range, numberEvent: "change",
      beforeInput: function () { before += 1; }, update: function (v) { values.push(v); }});
    p.number.value = "0.6"; T.dispatch(p.number, "input", window); T.assert(values.length === 0);
    T.dispatch(p.number, "change", window);
    p.range.value = "0.8"; T.dispatch(p.range, "input", window);
    T.assert(values.length === 2 && values[0] === 0.6 && values[1] === 0.8 && before === 2);
    remove(); T.dispatch(p.range, "input", window); T.assert(values.length === 2);
  });
  test("Invalid committed numbers restore their formatter without invoking an economic update", function () {
    var p = pair(), updates = 0; p.number.value = "";
    T.assert(!N.commit(p.number, 1 / 3, function () { updates += 1; }, function (v) { return v.toFixed(3); }));
    T.assert(p.number.value === "0.333" && updates === 0);
  });
  T.run(tests);
})();
