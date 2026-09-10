(function (global) {
  "use strict";

  function create(state, page, geometry, charts, actions) {
    var model = global.BargainingSandboxModel;
    var numbers = global.NumberUtils;
    var visuals = global.BilateralTradeVisuals;
    var R = model.CUSTOM_RESOLUTION;
    var mesh = geometry.mesh;
    var SURFACE_KEYS = Object.freeze(["q", "pB", "pS"]);
    var LAYOUT = geometry.layout;
    var elements = page.elements;
    var surfaces = page.surfaces;
    var dragState = null;
    var keyboardPaintState = {
      key: null,
      enter: false,
      space: false,
      dirty: false
    };
    var recomputeCustom = actions.recomputeCustom;
    var formatChoice = actions.formatChoice;
    var invalidateQuality = actions.invalidateQuality;

    function bindCustomControls() {
      elements.fixIcIrCheckbox.addEventListener("change", setFixIcIr);
      SURFACE_KEYS.forEach(function (key) {
        var surface = surfaces[key];
        surface.slider.addEventListener("input", function () {
          setBrushValue(key, Number(surface.slider.value));
        });
        surface.number.addEventListener("change", function () {
          setBrushValue(key, surface.number.valueAsNumber);
        });
        bindCustomSurfaceChart(key);
      });
    }

    function setFixIcIr() {
      if (state.activePreset !== "custom") {
        return;
      }
      finishKeyboardPaint();
      dragState = null;
      invalidateQuality();
      state.custom.fixIcIr = elements.fixIcIrCheckbox.checked;
      if (state.custom.fixIcIr) {
        state.activeSurface = "q";
      }
      syncEditingState();
      syncSurfaceControls();
      recomputeCustom("fix-ic-ir", "fix-ic-ir");
    }

    function isSurfaceEditable(key) {
      return state.activePreset === "custom" &&
        (key === "q" || !state.custom.fixIcIr);
    }

    function syncEditingState() {
      if (!surfaces.q) {
        return;
      }
      SURFACE_KEYS.forEach(function (key) {
        var editable = isSurfaceEditable(key);
        var surface = surfaces[key];
        surface.controls.hidden = !editable;
        surface.chart.setAttribute("aria-readonly", String(!editable));
        surface.chart.setAttribute(
          "aria-keyshortcuts",
          editable ?
            "ArrowLeft ArrowRight ArrowUp ArrowDown Home End l r Enter Space Escape" :
            "ArrowLeft ArrowRight ArrowUp ArrowDown Home End Escape"
        );
      });
    }

    function syncSurfaceControls() {
      if (!surfaces.q) {
        return;
      }
      SURFACE_KEYS.forEach(function (key) {
        var surface = surfaces[key];
        var value = state.brushes[key];
        if (key !== "q") {
          ensureSymmetricRange(surface, value);
        }
        surface.slider.value = String(value);
        surface.number.value = formatChoice(value);
        surface.slider.setAttribute(
          "aria-valuetext",
          (key === "q" ? "Allocation " :
            (key === "pB" ? "Buyer payment " : "Seller payment ")) +
            formatChoice(value)
        );
      });
    }

    function ensureSymmetricRange(surface, value) {
      var current = Math.max(
        Math.abs(Number(surface.slider.min)),
        Math.abs(Number(surface.slider.max)),
        1
      );
      var extent = Math.abs(value) > current ?
        Math.ceil(Math.abs(value) * 10) / 10 : current;
      surface.slider.min = String(-extent);
      surface.slider.max = String(extent);
      if (surface.endpoints) {
        surface.endpoints.children[0].textContent = formatChoice(-extent);
        surface.endpoints.children[1].textContent = formatChoice(extent);
      }
    }

    function setBrushValue(key, value) {
      if (!isSurfaceEditable(key)) {
        return;
      }
      if (!Number.isFinite(value)) {
        elements.validationStatus.textContent = "Enter a finite brush value.";
        syncSurfaceControls();
        return;
      }
      if (key !== "q" && Math.abs(value) > 1e140) {
        elements.validationStatus.textContent =
          "Enter a finite payment within the diagnostic range.";
        syncSurfaceControls();
        return;
      }
      state.brushes[key] = key === "q" ? numbers.clamp(value, 0, 1) : value;
      elements.validationStatus.textContent = "";
      syncSurfaceControls();
    }

    function bindCustomSurfaceChart(key) {
      var chart = surfaces[key].chart;
      chart.addEventListener("pointerdown", function (event) {
        finishKeyboardPaint();
        var point = visuals.plotPointFromEvent(chart, event, LAYOUT);
        if (!point) {
          return;
        }
        charts.setSurfaceProbe(key, point.x, point.y, true);
        if (!isSurfaceEditable(key)) {
          return;
        }
        activateSurface(key);
        var triangle = mesh.pointerToTriangle(chart, event, LAYOUT);
        if (!triangle || !triangle.insidePlot) {
          return;
        }
        dragState = {
          key: key,
          pointerId: event.pointerId,
          value: state.brushes[key],
          last: selectionKey(triangle.i, triangle.j, triangle.isLower),
          dirty: false
        };
        dragState.dirty = paintSurfaceTriangle(
          key, triangle.i, triangle.j, triangle.isLower, dragState.value
        );
        if (typeof chart.setPointerCapture === "function") {
          try {
            chart.setPointerCapture(event.pointerId);
          } catch {}
        }
      });
      chart.addEventListener("pointermove", function (event) {
        if (!dragState || dragState.key !== key ||
            dragState.pointerId !== event.pointerId) {
          var point = visuals.plotPointFromEvent(chart, event, LAYOUT);
          if (point) {
            charts.setSurfaceProbe(key, point.x, point.y, false);
          }
          return;
        }
        var triangle = mesh.pointerToTriangle(chart, event, LAYOUT);
        if (!triangle) {
          return;
        }
        var nextKey = selectionKey(triangle.i, triangle.j, triangle.isLower);
        if (nextKey === dragState.last) {
          return;
        }
        dragState.last = nextKey;
        dragState.dirty = paintSurfaceTriangle(
          key, triangle.i, triangle.j, triangle.isLower, dragState.value
        ) || dragState.dirty;
      });
      chart.addEventListener("pointerup", endPointerDrag);
      chart.addEventListener("pointercancel", endPointerDrag);
      chart.addEventListener("pointerleave", function () {
        if (document.activeElement !== chart) {
          charts.hideSurfaceProbe(key);
        }
      });
      chart.addEventListener("focus", function () {
        if (isSurfaceEditable(key)) {
          activateSurface(key);
          var point = model.customTriangleCentroid(
            state.selected.i, state.selected.j, state.selected.isLower
          );
          charts.setSurfaceProbe(key, point.v, point.c, true);
        } else {
          charts.setSurfaceProbe(
            key, state.surfaceProbes[key].v, state.surfaceProbes[key].c, true
          );
        }
      });
      chart.addEventListener("blur", function () {
        charts.hideSurfaceProbe(key);
        if (keyboardPaintState.key === key) {
          finishKeyboardPaint();
        }
      });
      chart.addEventListener("keydown", function (event) {
        var handled = true;
        var selectionChanged = false;
        if (event.key === "Escape") {
          charts.hideSurfaceProbe(key);
          finishKeyboardPaint();
        } else if (isSurfaceEditable(key)) {
          if (event.key === "ArrowLeft") {
            moveHorizontalSelection(-1);
            selectionChanged = true;
          } else if (event.key === "ArrowRight") {
            moveHorizontalSelection(1);
            selectionChanged = true;
          } else if (event.key === "ArrowUp") {
            moveVerticalSelection(1);
            selectionChanged = true;
          } else if (event.key === "ArrowDown") {
            moveVerticalSelection(-1);
            selectionChanged = true;
          } else if (event.key === "Home") {
            selectTriangle(0, state.selected.j, false);
            selectionChanged = true;
          } else if (event.key === "End") {
            selectTriangle(R - 1, state.selected.j, true);
            selectionChanged = true;
          } else if (event.key === "l" || event.key === "L") {
            selectTriangle(state.selected.i, state.selected.j, false);
            selectionChanged = true;
          } else if (event.key === "r" || event.key === "R") {
            selectTriangle(state.selected.i, state.selected.j, true);
            selectionChanged = true;
          } else if (event.key === "Enter" || event.key === " ") {
            startKeyboardPaint(key, event.key);
          } else {
            handled = false;
          }
          if (selectionChanged && keyboardPaintActive(key)) {
            applyKeyboardBrush(key);
          }
          if (handled && event.key !== "Escape") {
            var selectedPoint = model.customTriangleCentroid(
              state.selected.i, state.selected.j, state.selected.isLower
            );
            charts.setSurfaceProbe(key, selectedPoint.v, selectedPoint.c, true);
          }
        } else {
          var step = event.shiftKey ? 0.1 : 0.01;
          var v = state.surfaceProbes[key].v;
          var c = state.surfaceProbes[key].c;
          if (event.key === "ArrowLeft") {
            v -= step;
          } else if (event.key === "ArrowRight") {
            v += step;
          } else if (event.key === "ArrowUp") {
            c += step;
          } else if (event.key === "ArrowDown") {
            c -= step;
          } else if (event.key === "Home") {
            v = 0;
          } else if (event.key === "End") {
            v = 1;
          } else {
            handled = false;
          }
          if (handled && event.key !== "Escape") {
            charts.setSurfaceProbe(key, v, c, true);
          }
        }
        if (handled) {
          event.preventDefault();
        }
      });
      chart.addEventListener("keyup", function (event) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          stopKeyboardPaint(key, event.key);
        }
      });
    }

    function endPointerDrag(event) {
      if (!dragState || dragState.pointerId !== event.pointerId) {
        return;
      }
      var chart = surfaces[dragState.key].chart;
      if (typeof chart.hasPointerCapture === "function" &&
          typeof chart.releasePointerCapture === "function") {
        try {
          if (chart.hasPointerCapture(event.pointerId)) {
            chart.releasePointerCapture(event.pointerId);
          }
        } catch {}
      }
      var shouldRefresh = dragState.dirty;
      var changedSurface = dragState.key;
      dragState = null;
      if (shouldRefresh) {
        recomputeCustom("pointer-edit", changedSurface);
      }
    }

    function selectionKey(i, j, isLower) {
      return i + ":" + j + ":" + (isLower ? "R" : "L");
    }

    function activateSurface(key) {
      if (!isSurfaceEditable(key) || state.activeSurface === key) {
        return;
      }
      state.activeSurface = key;
      SURFACE_KEYS.forEach(function (surfaceKey) {
        charts.removeProbe(surfaces[surfaceKey].chart, ".cell-cursor");
        charts.removeProbe(surfaces[surfaceKey].chart, ".cell-label");
      });
      charts.drawCustomSelection(key);
    }

    function moveHorizontalSelection(direction) {
      if (direction > 0) {
        if (!state.selected.isLower) {
          selectTriangle(state.selected.i, state.selected.j, true);
        } else if (state.selected.i < R - 1) {
          selectTriangle(state.selected.i + 1, state.selected.j, false);
        }
      } else if (state.selected.isLower) {
        selectTriangle(state.selected.i, state.selected.j, false);
      } else if (state.selected.i > 0) {
        selectTriangle(state.selected.i - 1, state.selected.j, true);
      }
    }

    function moveVerticalSelection(direction) {
      if (direction > 0) {
        if (state.selected.isLower) {
          selectTriangle(state.selected.i, state.selected.j, false);
        } else if (state.selected.j < R - 1) {
          selectTriangle(state.selected.i, state.selected.j + 1, true);
        }
      } else if (!state.selected.isLower) {
        selectTriangle(state.selected.i, state.selected.j, true);
      } else if (state.selected.j > 0) {
        selectTriangle(state.selected.i, state.selected.j - 1, false);
      }
    }

    function keyboardPaintActive(key) {
      return keyboardPaintState.key === key &&
        (keyboardPaintState.enter || keyboardPaintState.space);
    }

    function startKeyboardPaint(key, pressedKey) {
      if (keyboardPaintState.key !== null && keyboardPaintState.key !== key) {
        finishKeyboardPaint();
      }
      keyboardPaintState.key = key;
      keyboardPaintState[pressedKey === "Enter" ? "enter" : "space"] = true;
      applyKeyboardBrush(key);
    }

    function applyKeyboardBrush(key) {
      keyboardPaintState.dirty = paintSurfaceTriangle(
        key,
        state.selected.i,
        state.selected.j,
        state.selected.isLower,
        state.brushes[key]
      ) || keyboardPaintState.dirty;
    }

    function stopKeyboardPaint(key, releasedKey) {
      if (keyboardPaintState.key !== key) {
        return;
      }
      keyboardPaintState[releasedKey === "Enter" ? "enter" : "space"] = false;
      if (!keyboardPaintActive(key)) {
        finishKeyboardPaint();
      }
    }

    function finishKeyboardPaint() {
      var shouldRefresh = keyboardPaintState.dirty;
      var changedSurface = keyboardPaintState.key;
      keyboardPaintState.key = null;
      keyboardPaintState.enter = false;
      keyboardPaintState.space = false;
      keyboardPaintState.dirty = false;
      if (shouldRefresh) {
        recomputeCustom("keyboard-edit", changedSurface);
      }
    }

    function selectTriangle(i, j, isLower) {
      state.selected = { i: i, j: j, isLower: isLower };
      charts.drawCustomSelection(state.activeSurface);
    }

    function writeSurfaceTriangle(key, i, j, isLower, value) {
      var grid = key === "q" ? state.custom.q :
        (key === "pB" ? state.custom.manualPB : state.custom.manualPS);
      var current = isLower ? grid.lower[i][j] : grid.upper[i][j];
      if (key === "q" ? current === value :
          current[0] === value && current.slice(1).every(function (coefficient) {
            return coefficient === 0;
          })) {
        return false;
      }
      var next = key === "q" ? value :
        model.constantCustomPaymentPatch(value);
      if (isLower) {
        grid.lower[i][j] = next;
      } else {
        grid.upper[i][j] = next;
      }
      return true;
    }

    function recordSurfaceEdit(key) {
      if (key === "q") {
        state.custom.qRevision += 1;
      } else if (key === "pB") {
        state.custom.pBRevision += 1;
      } else {
        state.custom.pSRevision += 1;
      }
    }

    function paintSurfaceTriangle(key, i, j, isLower, value) {
      if (!isSurfaceEditable(key)) {
        return false;
      }
      activateSurface(key);
      state.selected = { i: i, j: j, isLower: isLower };
      var changed = writeSurfaceTriangle(key, i, j, isLower, value);
      if (changed) {
        recordSurfaceEdit(key);
        charts.drawCustomTriangle(key, i, j, isLower);
      }
      charts.drawCustomSelection(key);
      return changed;
    }

    return Object.freeze({
      bindCustomControls: bindCustomControls,
      isSurfaceEditable: isSurfaceEditable,
      syncEditingState: syncEditingState,
      syncSurfaceControls: syncSurfaceControls
    });
  }

  global.BargainingSandboxEditor = Object.freeze({ create: create });
})(window);
