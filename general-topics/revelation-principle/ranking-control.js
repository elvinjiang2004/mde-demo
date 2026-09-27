(function (global) {
  "use strict";

  function create(container, initial, onChange, announce) {
    var value = initial;
    var editable = true;
    var selected = null;
    var drag = null;
    var ghost = null;
    var target = null;
    var suppressClick = false;
    var buttons = [];
    var label = container.getAttribute("aria-label");

    function paint() {
      label = container.getAttribute("aria-label");
      buttons.forEach(function (button, index) {
        button.disabled = !editable;
        button.textContent = value[index];
        button.dataset.candidate = value[index];
        button.setAttribute("aria-label", label + ": " + value[index] + ", position " + (index + 1) + " of 3");
        button.setAttribute("aria-pressed", String(index === selected));
      });
    }

    function clearDrag() {
      if (ghost) { ghost.remove(); ghost = null; }
      buttons.forEach(function (button) { button.classList.remove("drop-target", "drag-source"); });
      var previous = drag;
      drag = null;
      target = null;
      if (previous && buttons[previous.index].hasPointerCapture(previous.id)) {
        buttons[previous.index].releasePointerCapture(previous.id);
      }
    }

    function cancel() {
      if (drag && drag.moved) { suppressClick = true; }
      clearDrag();
      selected = null;
      paint();
    }

    function swap(first, second) {
      if (first === second) { cancel(); return; }
      var order = value.split("");
      var temporary = order[first];
      order[first] = order[second];
      order[second] = temporary;
      value = order.join("");
      selected = null;
      paint();
      onChange(value);
      buttons[second].focus({ preventScroll: true });
    }

    [0, 1, 2].forEach(function (index) {
      if (index) {
        var relation = document.createElement("span");
        relation.className = "ranking-relation";
        relation.textContent = "≻";
        relation.setAttribute("aria-hidden", "true");
        container.appendChild(relation);
      }
      var button = document.createElement("button");
      button.type = "button";
      button.className = "candidate ranking-token";
      button.dataset.position = index;
      buttons.push(button);
      container.appendChild(button);
      button.addEventListener("click", function () {
        if (!editable) { return; }
        if (suppressClick) { suppressClick = false; return; }
        if (selected === null) {
          selected = index;
          paint();
          announce(label + ": " + value[index] + " selected. Select a second square to swap.");
        } else if (selected === index) {
          cancel();
          announce("Selection cancelled.");
        } else { swap(selected, index); }
      });
      button.addEventListener("keydown", function (event) {
        if (!editable) { return; }
        if (event.key === "Enter" || event.key === " ") { suppressClick = false; }
        var next = index;
        if (event.key === "ArrowRight" || event.key === "ArrowDown") { next = (index + 1) % 3; }
        if (event.key === "ArrowLeft" || event.key === "ArrowUp") { next = (index + 2) % 3; }
        if (event.key === "Home") { next = 0; }
        if (event.key === "End") { next = 2; }
        if (next !== index) { event.preventDefault(); buttons[next].focus(); }
      });
      button.addEventListener("pointerdown", function (event) {
        if (!editable || event.button !== 0 || event.isPrimary === false) { return; }
        suppressClick = false;
        drag = { index: index, id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
        // Synthetic browser tests have no active pointer to capture.
        try { button.setPointerCapture(event.pointerId); } catch (_) { /* Native events capture normally. */ }
      });
      button.addEventListener("pointermove", function (event) {
        if (!drag || drag.id !== event.pointerId) { return; }
        if (!drag.moved && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 8) { return; }
        if (!drag.moved) {
          drag.moved = true;
          selected = null;
          paint();
          ghost = document.createElement("span");
          ghost.className = "ranking-ghost";
          ghost.textContent = value[index];
          ghost.dataset.candidate = value[index];
          ghost.setAttribute("aria-hidden", "true");
          document.body.appendChild(ghost);
          button.classList.add("drag-source");
        }
        ghost.style.left = (event.clientX - 24) + "px";
        ghost.style.top = (event.clientY - 24) + "px";
        var hit = document.elementFromPoint(event.clientX, event.clientY);
        target = buttons.indexOf(hit);
        buttons.forEach(function (item, position) {
          item.classList.toggle("drop-target", position === target && position !== index);
        });
      });
      button.addEventListener("pointerup", function (event) {
        if (!drag || drag.id !== event.pointerId) { return; }
        var moved = drag.moved;
        var destination = buttons.indexOf(document.elementFromPoint(event.clientX, event.clientY));
        clearDrag();
        if (moved) {
          suppressClick = true;
          if (destination !== null && destination >= 0 && destination !== index) { swap(index, destination); }
          else { announce("Swap cancelled."); }
          global.setTimeout(function () { suppressClick = false; }, 0);
        }
      });
      button.addEventListener("pointercancel", cancel);
      button.addEventListener("lostpointercapture", function () { if (drag) { cancel(); } });
      button.addEventListener("dragstart", function (event) { event.preventDefault(); });
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && (selected !== null || drag)) {
        event.preventDefault();
        cancel();
        announce("Selection cancelled.");
      }
    });
    document.addEventListener("pointerdown", function (event) {
      if (!container.contains(event.target)) { cancel(); }
    });
    paint();
    return Object.freeze({
      set: function (next) {
        if (global.RevelationPrincipleModel.rankings.indexOf(next) < 0) { throw new Error("Invalid ranking."); }
        value = next;
        cancel();
      },
      get: function () { return value; },
      setEditable: function (next) {
        if (editable === Boolean(next)) { return; }
        editable = Boolean(next);
        cancel();
        // A mode change ends the old gesture, including its suppressed click.
        suppressClick = false;
      },
      cancel: cancel
    });
  }

  global.RevelationRanking = Object.freeze({ create: create });
})(window);
