"use strict";

(function () {
  var sequence = 0;

  function element(tag, className, text) {
    var node = document.createElement(tag);
    if (className) { node.className = className; }
    if (text) { node.textContent = text; }
    return node;
  }

  function hasMathSource(root) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        if (node.nodeType === 1 && /^(svg|mjx-container|script|noscript|style|textarea|pre|code|annotation|annotation-xml)$/i.test(node.localName)) {
          return NodeFilter.FILTER_REJECT;
        }
        return node.nodeType === 3 && /\\\(|\\\[/.test(node.textContent) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      }
    });
    return !!walker.nextNode();
  }

  function notationList(groups, sections, prefix) {
    var list = document.createDocumentFragment();
    var section = null;
    var heading;
    groups.forEach(function (entries, index) {
      if (sections && sections[index] !== section) {
        section = sections[index];
        heading = element("h3", "notation-section-heading");
        heading.appendChild(element("span", "notation-section-label", section));
        heading.id = prefix + "-section-" + index;
        list.appendChild(heading);
      }
      var group = element("dl", "notation-group");
      if (heading) { group.setAttribute("aria-labelledby", heading.id); }
      if (sections && index + 1 < groups.length && sections[index] !== sections[index + 1]) {
        group.classList.add("notation-group-before-section");
      }
      entries.forEach(function (entry) {
        var row = element("div", "notation-entry");
        var term = element("dt");
        term.appendChild(element("span", "", "\\(" + entry[0] + "\\)"));
        row.appendChild(term);
        row.appendChild(element("dd", "", entry[1]));
        group.appendChild(row);
      });
      list.appendChild(group);
    });
    return list;
  }

  class LearningSidebar extends HTMLElement {
    connectedCallback() {
      if (this.querySelector(".learning-sidebar-panel")) { return; }
      var catalog = window.MechanismNotation;
      if (!catalog) { return; }

      var page = this.getAttribute("page");
      var notation = catalog.pages[page || this.getAttribute("environment")] || {};
      var pageEntries = notation.pageNotation || [];
      var environmentEntries = notation.environmentNotation || [];
      var template = this.querySelector("template[data-insights]");
      var prefix = "learning-sidebar-" + (++sequence);
      var toggle = element("button", "text-button learning-sidebar-toggle", "Page Appendix");
      toggle.type = "button";
      toggle.setAttribute("aria-controls", prefix);
      toggle.setAttribute("aria-expanded", "false");

      // This reference remains nonmodal so the lesson can still be explored.
      var panel = element("aside", "learning-sidebar-panel");
      panel.id = prefix;
      panel.hidden = true;
      panel.setAttribute("aria-labelledby", prefix + "-title");
      var header = element("div", "learning-sidebar-header");
      var title = element("h2", "", "Page Appendix");
      title.id = prefix + "-title";
      var close = element("button", "text-button learning-sidebar-close", "Close");
      close.type = "button";
      close.setAttribute("aria-label", "Close Page Appendix");
      header.appendChild(title);
      header.appendChild(close);
      panel.appendChild(header);

      var tablist = element("div", "learning-sidebar-tabs");
      tablist.setAttribute("role", "tablist");
      tablist.setAttribute("aria-label", "Page Appendix sections");
      panel.appendChild(tablist);
      var status = element("div", "learning-sidebar-status");
      status.setAttribute("role", "status");
      status.hidden = true;
      var statusMessage = element("p");
      var retry = element("button", "text-button learning-sidebar-retry", "Retry");
      retry.type = "button";
      retry.setAttribute("aria-label", "Retry appendix content");
      retry.hidden = true;
      status.appendChild(statusMessage);
      status.appendChild(retry);
      panel.appendChild(status);
      var content = element("div", "learning-sidebar-content");
      var tabs = [
        { id: "page", label: "Page notation", entries: pageEntries, sections: notation.pageNotationSections, disabled: !pageEntries.length },
        { id: "environment", label: "Environment notation", entries: environmentEntries, disabled: !environmentEntries.length },
        { id: "insights", label: "Author Insights", entries: null, disabled: false }
      ];
      var active = tabs.findIndex(function (tab) { return !tab.disabled; });
      var renderVersion = 0;

      tabs.forEach(function (tab, index) {
        var button = element("button", "text-button learning-sidebar-tab", tab.label);
        button.type = "button";
        button.id = prefix + "-tab-" + tab.id;
        button.setAttribute("role", "tab");
        button.setAttribute("aria-controls", prefix + "-" + tab.id);
        button.setAttribute("aria-selected", String(index === active));
        button.tabIndex = index === active ? 0 : -1;
        button.disabled = tab.disabled;
        if (tab.disabled) { button.setAttribute("aria-disabled", "true"); }
        var section = element("section", "learning-sidebar-tabpanel learning-sidebar-" + tab.id);
        section.id = prefix + "-" + tab.id;
        section.setAttribute("role", "tabpanel");
        section.setAttribute("aria-labelledby", button.id);
        section.tabIndex = 0;
        section.hidden = index !== active;
        tab.button = button;
        tab.panel = section;
        tab.scrollTop = 0;
        tab.prepared = false;
        tab.ready = false;
        tab.pending = null;
        tablist.appendChild(button);
        content.appendChild(section);
        button.addEventListener("click", function () { selectTab(index, false); });
        button.addEventListener("keydown", function (event) {
          var next = index;
          if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
            var step = event.key === "ArrowRight" ? 1 : -1;
            do { next = (next + step + tabs.length) % tabs.length; } while (tabs[next].disabled);
          } else if (event.key === "Home") {
            next = tabs.findIndex(function (item) { return !item.disabled; });
          } else if (event.key === "End") {
            next = tabs.length - 1;
            while (tabs[next].disabled) { next -= 1; }
          } else { return; }
          event.preventDefault();
          selectTab(next, true);
        });
      });
      panel.appendChild(content);
      this.appendChild(toggle);
      this.appendChild(panel);

      function setStatus(message, canRetry) {
        status.hidden = !message;
        statusMessage.textContent = message;
        retry.hidden = !canRetry;
      }

      function isCurrent(tab, version) {
        return version === renderVersion && host.isConnected && !panel.hidden && !tab.panel.hidden;
      }

      function renderTab(tab) {
        if (panel.hidden || tab.panel.hidden) { return; }
        content.hidden = false;
        if (tab.ready) { setStatus("", false); return; }
        var version = ++renderVersion;
        tab.panel.removeAttribute("data-render-error");
        tab.panel.setAttribute("aria-busy", "true");
        setStatus("Loading appendix content...", false);
        // Reuse work already queued for this tab during rapid navigation.
        if (!tab.pending) {
          var needsMath = tab.entries ? tab.entries.length > 0 : template && hasMathSource(template.content);
          tab.pending = Promise.resolve(needsMath ? window.mechanismMathReady : null).then(function () {
            if (!host.isConnected || panel.hidden || tab.panel.hidden) { return false; }
            if (!tab.prepared) {
              if (tab.entries) { tab.panel.appendChild(notationList(tab.entries, tab.sections, tab.panel.id)); }
              if (tab.id === "insights" && template) {
                tab.panel.appendChild(template.content.cloneNode(true));
              }
              tab.prepared = true;
            }
            if (tab.panel.querySelector('mjx-merror, merror, [data-mml-node="merror"]')) {
              throw new Error("The appendix contains a mathematical error.");
            }
            if (!hasMathSource(tab.panel)) { return true; }
            if (!window.MechanismMath || typeof window.MechanismMath.typesetInitial !== "function") {
              throw new Error("The appendix math renderer is unavailable.");
            }
            return window.MechanismMath.typesetInitial("#" + tab.panel.id).then(function () {
              // The shared queue absorbs failures, so inspect the actual output.
              if (hasMathSource(tab.panel) || tab.panel.querySelector('mjx-merror, merror, [data-mml-node="merror"]')) {
                throw new Error("The appendix mathematics did not finish rendering.");
              }
              return true;
            });
          }).then(function (rendered) {
            tab.pending = null;
            return rendered;
          }, function (error) {
            tab.pending = null;
            throw error;
          });
        }
        tab.pending.then(function (rendered) {
          if (!isCurrent(tab, version)) { return; }
          if (!rendered) { renderTab(tab); return; }
          tab.ready = true;
          tab.panel.removeAttribute("aria-busy");
          setStatus("", false);
          // The earlier restore may have been clamped before math created its height.
          content.scrollTop = tab.scrollTop;
        }, function () {
          if (!isCurrent(tab, version)) { return; }
          tab.panel.removeAttribute("aria-busy");
          tab.panel.setAttribute("data-render-error", "true");
          content.hidden = true;
          setStatus("Appendix content could not be displayed.", true);
        });
      }

      function selectTab(index, focus) {
        if (tabs[index].disabled) { return; }
        if (index === active) {
          if (focus) { tabs[index].button.focus({ preventScroll: true }); }
          return;
        }
        tabs[active].scrollTop = content.scrollTop;
        renderVersion += 1;
        active = index;
        tabs.forEach(function (tab, tabIndex) {
          var selected = tabIndex === active;
          tab.button.setAttribute("aria-selected", String(selected));
          tab.button.tabIndex = selected ? 0 : -1;
          tab.panel.hidden = !selected;
        });
        content.scrollTop = tabs[active].scrollTop;
        if (focus) { tabs[active].button.focus({ preventScroll: true }); }
        renderTab(tabs[active]);
      }

      var host = this;
      function setOpen(open, restoreFocus) {
        panel.hidden = !open;
        host.classList.toggle("is-open", open);
        toggle.setAttribute("aria-expanded", String(open));
        if (open) {
          close.focus({ preventScroll: true });
          renderTab(tabs[active]);
        } else {
          renderVersion += 1;
          if (restoreFocus) { toggle.focus({ preventScroll: true }); }
        }
      }
      retry.addEventListener("click", function () {
        tabs[active].button.focus({ preventScroll: true });
        renderTab(tabs[active]);
      });
      toggle.addEventListener("click", function () { setOpen(panel.hidden, false); });
      close.addEventListener("click", function () { setOpen(false, true); });
      this.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && !panel.hidden) {
          event.preventDefault();
          setOpen(false, true);
        }
      });
    }
  }

  if (!window.customElements.get("learning-sidebar")) {
    window.customElements.define("learning-sidebar", LearningSidebar);
  }
})();

