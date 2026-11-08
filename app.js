/* Ideas for Here — all behaviour. No dependencies, no network requests. */
(function () {
  "use strict";

  const $ = (sel, root) => (root || document).querySelector(sel);
  const el = (tag, cls) => { const n = document.createElement(tag); if (cls) n.className = cls; return n; };

  const GOAL_TEXT = {
    ease:  "making daily life easier",
    earn:  "bringing in a little money",
    help:  "being useful to people nearby",
    learn: "learning something by doing it"
  };

  const LANE_REASON = {
    ready:     "no coding needed",
    assistant: "you can build it with an AI assistant",
    code:      "it's a proper coding project"
  };

  const LANE_SHORT = {
    ready: "no code",
    assistant: "with an AI assistant",
    code: "write the code"
  };

  const state = {
    area: null,
    time: null,
    lane: null,
    query: "",
    answers: { goal: null, area: null, time: null, lane: null },
    qIndex: 0,
    remixSeed: 1,
    open: new Set()
  };

  const byId = (list, id) => list.find((x) => x.id === id);
  const areaOf = (idea) => byId(AREAS, idea.area) || { label: "—", colour: "#999" };
  const timeLabel = (id) => (byId(TIMES, id) || {}).label || id;
  const laneLabel = (id) => (byId(LANES, id) || {}).label || id;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  function scrollToEl(node, block) {
    if (!node) return;
    node.scrollIntoView({ behavior: reduceMotion.matches ? "auto" : "smooth", block: block || "start" });
  }

  /* ------------------------------------------------------------------ */
  /* Tabs                                                                */
  /* ------------------------------------------------------------------ */

  const tabOrder = ["browse", "ask"];
  const tabs = {
    browse: { tab: $("#tab-browse"), panel: $("#panel-browse") },
    ask: { tab: $("#tab-ask"), panel: $("#panel-ask") }
  };

  function selectedTab() {
    return tabOrder.find((name) => tabs[name].tab.getAttribute("aria-selected") === "true") || "browse";
  }

  function showTab(name, moveFocus) {
    tabOrder.forEach((key) => {
      const on = key === name;
      tabs[key].tab.setAttribute("aria-selected", String(on));
      tabs[key].tab.tabIndex = on ? 0 : -1;
      tabs[key].panel.hidden = !on;
    });
    const hero = $("#hero");
    if (hero) hero.hidden = name === "ask";
    if (name === "ask") renderQuestion();
    if (moveFocus) tabs[name].tab.focus();
  }

  tabOrder.forEach((name) => {
    tabs[name].tab.tabIndex = name === "browse" ? 0 : -1;
    tabs[name].tab.addEventListener("click", () => showTab(name));
  });

  $(".modeswitch").addEventListener("keydown", (e) => {
    const i = tabOrder.indexOf(selectedTab());
    let next = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (i + 1) % tabOrder.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (i - 1 + tabOrder.length) % tabOrder.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabOrder.length - 1;
    if (next === null) return;
    e.preventDefault();
    showTab(tabOrder[next], true);
  });

  /* ------------------------------------------------------------------ */
  /* Filters                                                             */
  /* ------------------------------------------------------------------ */

  function chip(label, pressed, value, group, onClick, colour) {
    const b = el("button", "chip");
    b.type = "button";
    b.dataset.group = group;
    b.dataset.value = value;
    b.setAttribute("aria-pressed", String(pressed));
    if (colour) {
      const d = el("i", "dot");
      d.style.background = colour;
      b.appendChild(d);
    }
    b.appendChild(document.createTextNode(label));
    b.addEventListener("click", onClick);
    return b;
  }

  function buildChips() {
    const hostA = $("#chips-area");
    hostA.innerHTML = "";
    hostA.appendChild(chip("Everything", state.area === null, "", "area", () => {
      state.area = null; renderGrid(); syncChips();
    }));
    AREAS.forEach((a) => {
      hostA.appendChild(chip(a.label, state.area === a.id, a.id, "area", () => {
        state.area = state.area === a.id ? null : a.id;
        renderGrid(); syncChips();
      }, a.colour));
    });

    const hostT = $("#chips-time");
    hostT.innerHTML = "";
    TIMES.forEach((t) => {
      hostT.appendChild(chip(t.label, state.time === t.id, t.id, "time", () => {
        state.time = state.time === t.id ? null : t.id;
        renderGrid(); syncChips();
      }));
    });

    const hostL = $("#chips-lane");
    hostL.innerHTML = "";
    LANES.forEach((l) => {
      hostL.appendChild(chip(shortLane(l.label), state.lane === l.id, l.id, "lane", () => {
        state.lane = state.lane === l.id ? null : l.id;
        renderGrid(); syncChips();
      }));
    });
  }

  /* Update pressed state in place so keyboard focus is never lost. */
  function syncChips() {
    document.querySelectorAll(".chip[data-group]").forEach((b) => {
      const group = b.dataset.group;
      const value = b.dataset.value;
      const on = value === ""
        ? state[group] === null
        : state[group] === value;
      b.setAttribute("aria-pressed", String(on));
    });
  }

  function shortLane(label) {
    return label.split(",")[0].replace("building it with an AI assistant", "with an AI assistant")
      .replace("writing the code yourself", "writing the code");
  }

  function matchesQuery(idea) {
    if (!state.query) return true;
    const hay = [
      idea.title, idea.tagline, idea.describe, idea.area,
      areaOf(idea).label, (idea.needs || []).join(" "),
      (idea.steps || []).join(" ")
    ].join(" ").toLowerCase();
    return state.query.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w));
  }

  function filtered() {
    return IDEAS.filter((i) =>
      (!state.area || i.area === state.area) &&
      (!state.time || i.minutes === state.time) &&
      (!state.lane || i.lanes.includes(state.lane)) &&
      matchesQuery(i)
    );
  }

  function resetBrowse(area) {
    state.area = area || null;
    state.time = null;
    state.lane = null;
    state.query = "";
    $("#search").value = "";
    syncChips();
    renderGrid();
  }

  /* ------------------------------------------------------------------ */
  /* Catalog rendering                                                   */
  /* ------------------------------------------------------------------ */

  function safeHref(url) {
    return typeof url === "string" && /^https?:\/\//i.test(url);
  }

  function kitRow(label, item) {
    if (!item) return null;
    const left = el("div");
    const b = el("b"); b.textContent = item[0];
    const small = el("small"); small.textContent = item[2] || "";
    left.append(b, small);
    const tag = el("span"); tag.textContent = label;

    if (!safeHref(item[1])) {
      const plain = el("div", "kitlink-plain");
      plain.append(left, tag);
      return plain;
    }
    const a = el("a");
    a.href = item[1];
    a.target = "_blank";
    a.rel = "noopener";
    a.append(left, tag);
    return a;
  }

  function cardEl(idea) {
    const card = el("article", "card");
    card.dataset.id = idea.id;
    const area = areaOf(idea);

    const top = el("div", "card__top");
    const num = el("span", "card__num");
    num.textContent = String(IDEAS.indexOf(idea) + 1).padStart(2, "0");
    const areaTag = el("span", "card__area");
    const dot = el("i", "dot"); dot.style.background = area.colour;
    areaTag.append(dot, document.createTextNode(area.label));
    top.append(num, areaTag);

    const h3 = el("h3"); h3.textContent = idea.title;
    const tag = el("p", "card__tag"); tag.textContent = idea.tagline;
    const text = el("p", "card__text"); text.textContent = idea.describe;

    const meta = el("div", "card__meta");
    const metaText = el("span");
    metaText.textContent = `${timeLabel(idea.minutes)} · ${idea.lanes.map((l) => LANE_SHORT[l] || l).join(" · ")}`;
    meta.append(metaText);

    const btn = el("button", "expander");
    btn.type = "button";
    btn.setAttribute("aria-expanded", "false");
    btn.innerHTML = 'Build kit <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
    btn.addEventListener("click", () => toggleKit(card, idea, btn));

    card.append(top, h3, tag, text, meta, btn);

    if (state.open.has(idea.id)) openKit(card, idea, btn);
    return card;
  }

  function openKit(card, idea, btn) {
    card.classList.add("card--open");
    btn.setAttribute("aria-expanded", "true");
    btn.firstChild.textContent = "Hide the kit ";
    if (!card.querySelector(".kit")) card.appendChild(kitEl(idea));
  }

  function closeKit(card, btn) {
    const kit = card.querySelector(".kit");
    if (kit) kit.remove();
    card.classList.remove("card--open");
    btn.setAttribute("aria-expanded", "false");
    btn.firstChild.textContent = "Build kit ";
  }

  function toggleKit(card, idea, btn) {
    const open = btn.getAttribute("aria-expanded") === "true";
    if (open) {
      state.open.delete(idea.id);
      closeKit(card, btn);
    } else {
      state.open.add(idea.id);
      openKit(card, idea, btn);
    }
  }

  function kitEl(idea) {
    const kit = el("div", "kit");

    const hSteps = el("h4"); hSteps.textContent = "How you'd do it";
    const ol = el("ol");
    (idea.steps || []).forEach((s) => { const li = el("li"); li.textContent = s; ol.appendChild(li); });

    kit.append(hSteps, ol);

    if (idea.needs && idea.needs.length) {
      const hNeeds = el("h4"); hNeeds.textContent = "What you need";
      const ul = el("ul", "plain");
      idea.needs.forEach((n) => { const li = el("li"); li.textContent = n; ul.appendChild(li); });
      kit.append(hNeeds, ul);
    }

    const rows = [
      ["data source", idea.kit && idea.kit.data],
      ["also", idea.kit && idea.kit.data2],
      ["starter prompt", idea.kit && idea.kit.prompt],
      ["also", idea.kit && idea.kit.prompt2],
      ["pattern", idea.kit && idea.kit.pattern],
      ["publish free", idea.kit && idea.kit.publish]
    ].map(([label, item]) => kitRow(label, item)).filter(Boolean);

    if (rows.length) {
      const hKit = el("h4"); hKit.textContent = "Free pieces";
      const links = el("div", "kitlinks");
      rows.forEach((r) => links.appendChild(r));
      kit.append(hKit, links);
    }
    return kit;
  }

  function renderGrid() {
    const list = filtered();
    const grid = $("#grid");
    grid.innerHTML = "";
    list.forEach((idea) => grid.appendChild(cardEl(idea)));

    const count = $("#count");
    count.textContent = list.length === IDEAS.length
      ? `${IDEAS.length} ideas`
      : `${list.length} of ${IDEAS.length} ideas${state.query ? ` for “${state.query}”` : ""}`;

    if (!list.length) {
      const empty = el("p");
      empty.style.cssText = "padding:34px 4px;grid-column:1/-1;border-top:1px solid var(--rule);color:var(--muted)";
      empty.textContent = "Nothing matches that combination. Try clearing one filter — or shuffle a new brief at the bottom of the page.";
      grid.appendChild(empty);
    }
  }

  let searchTimer = null;
  $("#search").addEventListener("input", (e) => {
    state.query = e.target.value.trim();
    clearTimeout(searchTimer);
    searchTimer = setTimeout(renderGrid, 120);
  });

  $("#btn-reset").addEventListener("click", () => resetBrowse(null));

  $("#btn-surprise").addEventListener("click", () => {
    if (!filtered().length) resetBrowse(null);
    const pool = filtered();
    if (!pool.length) return;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    const card = document.querySelector(`.card[data-id="${pick.id}"]`);
    if (!card) return;
    const btn = card.querySelector(".expander");
    if (btn.getAttribute("aria-expanded") !== "true") btn.click();
    scrollToEl(card, "center");
    card.style.transition = "background .6s";
    card.style.background = "rgba(178,58,42,.07)";
    setTimeout(() => { card.style.background = ""; }, 1600);
  });

  /* Print: open every kit so the paper copy is complete. */
  window.addEventListener("beforeprint", () => {
    document.querySelectorAll(".card").forEach((card) => {
      const btn = card.querySelector(".expander");
      if (btn && btn.getAttribute("aria-expanded") !== "true") btn.click();
    });
  });

  /* ------------------------------------------------------------------ */
  /* Remix generator (deterministic)                                     */
  /* ------------------------------------------------------------------ */

  function renderRemix() {
    const s = state.remixSeed;
    const topic = REMIX_TOPICS[(s * 5 + 1) % REMIX_TOPICS.length];
    const format = REMIX_FORMATS[(s * 3 + 2) % REMIX_FORMATS.length];
    const constraint = REMIX_CONSTRAINTS[(s * 2 + 4) % REMIX_CONSTRAINTS.length];

    const brief = $("#remix-brief");
    brief.innerHTML = "";
    brief.append(
      document.createTextNode("Take "),
      mark(topic),
      document.createTextNode(" and turn it into "),
      mark(format),
      document.createTextNode(" — "),
      mark(constraint),
      document.createTextNode(".")
    );

    $("#remix-step").textContent =
      `First move: one evening writing down every fact you already know about ${topic}. ` +
      `That list is the content; ${format.replace(/^a /, "the ")} is only the wrapper.`;

    $("#remix").dataset.copy = `Take ${topic} and turn it into ${format} — ${constraint}.`;
  }

  function mark(text) {
    const m = document.createElement("mark");
    m.textContent = text;
    return m;
  }

  $("#btn-remix").addEventListener("click", () => {
    state.remixSeed += 1;
    renderRemix();
  });

  $("#btn-copy-remix").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    const text = $("#remix").dataset.copy || "";
    try {
      await navigator.clipboard.writeText(text);
      btn.textContent = "Copied";
    } catch (_) {
      // No clipboard permission: select the brief so Ctrl+C does the job.
      const brief = $("#remix-brief");
      const range = document.createRange();
      range.selectNodeContents(brief);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      btn.textContent = "Press Ctrl+C";
    }
    setTimeout(() => { btn.textContent = "Copy this brief"; }, 2200);
  });

  /* ------------------------------------------------------------------ */
  /* Questionnaire                                                       */
  /* ------------------------------------------------------------------ */

  const QUESTIONS = [
    {
      key: "goal",
      title: "What do you want out of this?",
      options: [
        { id: "ease",  label: "Make daily life easier",     hint: "Fewer missed things, less repetition, less arguing." },
        { id: "earn",  label: "Bring in a little money",    hint: "A trade, a small shop, a side income." },
        { id: "help",  label: "Be useful to people nearby", hint: "The street, the building, the family." },
        { id: "learn", label: "Learn something by building", hint: "The project is the practice." }
      ]
    },
    {
      key: "area",
      title: "Which part of life should it touch?",
      options: AREAS.map((a) => ({ id: a.id, label: a.label, hint: "" }))
    },
    {
      key: "time",
      title: "How much time do you really have?",
      options: [
        { id: "weekend", label: "One weekend",       hint: "Start Friday, something usable by Sunday night." },
        { id: "evenings", label: "A few evenings",   hint: "An hour here and there, for a couple of weeks." },
        { id: "month",   label: "A month of Sundays", hint: "Slow, careful, done properly." }
      ]
    },
    {
      key: "lane",
      title: "How do you want to build it?",
      options: [
        { id: "ready",     label: "No code at all",              hint: "Ready-made tools, glued together by hand." },
        { id: "assistant", label: "With an AI assistant",        hint: "You describe it, it writes the parts you can't." },
        { id: "code",      label: "I want to write the code",    hint: "You'll learn the most, and it'll take longest." }
      ]
    }
  ];

  function renderQuestion() {
    const host = $("#qhost");
    const q = QUESTIONS[state.qIndex];
    const answered = state.answers[q.key];
    host.innerHTML = "";

    const wrap = el("div", "q");
    const num = el("p", "q__num");
    num.textContent = `Question ${state.qIndex + 1} of ${QUESTIONS.length}`;
    const h3 = el("h3"); h3.textContent = q.title;
    const opts = el("div", "options");
    opts.setAttribute("role", "group");
    opts.setAttribute("aria-label", q.title);

    q.options.forEach((o, i) => {
      const b = el("button", "option");
      b.type = "button";
      b.dataset.value = o.id;
      b.setAttribute("aria-pressed", String(answered === o.id));
      const key = el("span", "option__key"); key.textContent = String.fromCharCode(65 + i);
      const body = el("span");
      const strong = el("b"); strong.textContent = o.label;
      body.appendChild(strong);
      if (o.hint) { const s = el("small"); s.textContent = o.hint; body.appendChild(s); }
      b.append(key, body);
      b.addEventListener("click", () => {
        state.answers[q.key] = o.id;
        syncOptions();
      });
      opts.appendChild(b);
    });

    wrap.append(num, h3, opts);
    host.appendChild(wrap);

    const prog = $("#ask-progress");
    prog.innerHTML = "";
    QUESTIONS.forEach((_, i) => {
      const bar = el("i", i <= state.qIndex ? "done" : "");
      prog.appendChild(bar);
    });

    $("#btn-back").disabled = state.qIndex === 0;
    const last = state.qIndex === QUESTIONS.length - 1;
    $("#btn-next").textContent = last ? "Show my matches" : "Next";
    $("#btn-next").disabled = !state.answers[q.key];
  }

  /* Update the chosen option in place, so the clicked button keeps focus. */
  function syncOptions() {
    const q = QUESTIONS[state.qIndex];
    const answered = state.answers[q.key];
    document.querySelectorAll("#qhost .option").forEach((b) => {
      b.setAttribute("aria-pressed", String(b.dataset.value === answered));
    });
    $("#btn-next").disabled = !answered;
  }

  $("#btn-back").addEventListener("click", () => {
    if (state.qIndex > 0) { state.qIndex -= 1; renderQuestion(); }
  });

  $("#btn-next").addEventListener("click", () => {
    const q = QUESTIONS[state.qIndex];
    if (!state.answers[q.key]) return;
    if (state.qIndex === QUESTIONS.length - 1) { renderMatches(); return; }
    state.qIndex += 1;
    renderQuestion();
  });

  $("#btn-again").addEventListener("click", () => {
    $("#ask-results").hidden = true;
    $("#ask-form").hidden = false;
    state.qIndex = 0;
    renderQuestion();
  });

  $("#btn-see-all").addEventListener("click", () => {
    showTab("browse");
    resetBrowse(null);
    scrollToEl($("#grid"), "start");
  });

  /* ------------------------------------------------------------------ */
  /* Matching                                                            */
  /* ------------------------------------------------------------------ */

  function score(idea) {
    const a = state.answers;
    let s = 0;
    let hits = 0;
    const reasons = [];

    if (a.area && idea.area === a.area) {
      s += 5;
      hits += 1;
      reasons.push(`it sits in ${areaOf(idea).label.toLowerCase()}, the area you picked`);
    }
    if (a.goal && idea.goals.includes(a.goal)) {
      s += 3;
      hits += 1;
      reasons.push(`it's about ${GOAL_TEXT[a.goal]}`);
    }
    if (a.time) {
      const want = TIMES.findIndex((t) => t.id === a.time);
      const has = TIMES.findIndex((t) => t.id === idea.minutes);
      if (want === has) {
        s += 2; hits += 1;
        reasons.push(`it fits ${timeLabel(idea.minutes)}`);
      } else if (Math.abs(want - has) === 1) {
        s += 1;
      }
    }
    if (a.lane && idea.lanes.includes(a.lane)) {
      s += 2;
      hits += 1;
      reasons.push(LANE_REASON[a.lane]);
    }
    return { s, hits, reasons };
  }

  function ranked() {
    return IDEAS
      .map((idea) => ({ idea, ...score(idea) }))
      .sort((x, y) => (y.s - x.s) || (y.hits - x.hits) || (x.idea.title.localeCompare(y.idea.title)));
  }

  function renderMatches() {
    const list = ranked();
    const top = list.slice(0, 3);
    const rest = list.slice(3, 11);
    const a = state.answers;

    $("#ask-form").hidden = true;
    $("#ask-results").hidden = false;

    const title = $("#match-title");
    title.textContent = `Your ${top.length} starter${top.length === 1 ? "" : "s"}`;
    $("#match-sub").textContent =
      `Picked for ${areaLabelOf(a.area)} · ${timeLabel(a.time)} · ${laneLabel(a.lane)}. ` +
      `Ranked by arithmetic, not by a model — the reasons are printed on each one.`;

    const host = $("#matches");
    host.innerHTML = "";
    top.forEach((row, i) => host.appendChild(matchEl(row, i)));

    const also = $(".also");
    const alsoList = $("#alsolist");
    alsoList.innerHTML = "";
    rest.forEach((row) => {
      const b = el("button");
      b.type = "button";
      b.append(textEl("b", row.idea.title), textEl("span", timeLabel(row.idea.minutes)));
      b.addEventListener("click", () => {
        showTab("browse");
        resetBrowse(row.idea.area);
        const card = document.querySelector(`.card[data-id="${row.idea.id}"]`);
        if (card) {
          state.open.add(row.idea.id);
          if (card.querySelector(".expander").getAttribute("aria-expanded") !== "true") {
            card.querySelector(".expander").click();
          }
          scrollToEl(card, "center");
        }
      });
      alsoList.appendChild(b);
    });
    also.hidden = rest.length === 0;

    title.setAttribute("tabindex", "-1");
    title.focus({ preventScroll: true });
    scrollToEl($("#ask-results"), "start");
  }

  function areaLabelOf(id) {
    const a = byId(AREAS, id);
    return a ? a.label.toLowerCase() : "every area";
  }

  function textEl(tag, text) {
    const n = el(tag);
    n.textContent = text;
    return n;
  }

  function matchEl(row, i) {
    const idea = row.idea;
    const wrap = el("article", "match");

    const main = el("div");
    const rank = el("p", "match__rank");
    rank.textContent = `Starter ${i + 1} · ${areaOf(idea).label}`;
    const h3 = textEl("h3", idea.title);
    const tag = textEl("p", "match__tag");
    tag.textContent = idea.tagline;
    const text = textEl("p", "match__text");
    text.textContent = idea.describe;

    const why = el("p", "why");
    why.append(document.createTextNode("Why this one: "));
    const strong = el("b");
    strong.textContent = row.reasons.length
      ? row.reasons.join("; ") + "."
      : "it's the closest thing in the catalog to what you described.";
    why.appendChild(strong);

    main.append(rank, h3, tag, text, why);

    const side = el("div", "match__side");
    const h4 = textEl("h4", "Your first moves");
    const ol = el("ol");
    (idea.steps || []).forEach((s) => { const li = el("li"); li.textContent = s; ol.appendChild(li); });
    side.append(h4, ol);

    if (idea.needs && idea.needs.length) {
      const hNeed = textEl("h4", "You'll need");
      hNeed.style.marginTop = "18px";
      const ul = el("ul", "plain");
      idea.needs.forEach((n) => { const li = el("li"); li.textContent = n; ul.appendChild(li); });
      side.append(hNeed, ul);
    }

    const k = idea.kit || {};
    const pieces = [
      ["starter prompt", k.prompt],
      ["data source", k.data],
      ["pattern", k.pattern],
      ["publish free", k.publish]
    ].filter(([, item]) => item);

    if (pieces.length) {
      const h4b = textEl("h4", "Start from");
      h4b.style.marginTop = "18px";
      const links = el("div", "kitlinks");
      pieces.forEach(([label, item]) => {
        const r = kitRow(label, item);
        if (r) links.appendChild(r);
      });
      side.append(h4b, links);
    }

    wrap.append(main, side);
    return wrap;
  }

  /* ------------------------------------------------------------------ */
  /* Boot                                                                */
  /* ------------------------------------------------------------------ */

  const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
    "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
  const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

  function numberWord(n) {
    if (n < 20) return ONES[n] || String(n);
    const t = Math.floor(n / 10);
    const o = n % 10;
    return TENS[t] + (o ? "-" + ONES[o] : "");
  }

  function capitalise(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  const total = IDEAS.length;
  $("#fig-ideas").textContent = String(total);
  const word = $("#fig-word");
  if (word) word.textContent = capitalise(numberWord(total));
  const bootCount = $("#count");
  if (bootCount) bootCount.textContent = `${total} ideas`;

  buildChips();
  renderGrid();
  renderRemix();
  renderQuestion();
})();
