const state = {
  rows: [],
  query: "",
  evidence: "all",
  sort: "name-asc",
  compact: false,
  alpha: "all",
};

const els = {
  searchInput: document.querySelector("#searchInput"),
  evidenceFilter: document.querySelector("#evidenceFilter"),
  sortSelect: document.querySelector("#sortSelect"),
  clearFilters: document.querySelector("#clearFilters"),
  toggleDensity: document.querySelector("#toggleDensity"),
  resultCount: document.querySelector("#resultCount"),
  cards: document.querySelector("#cards"),
  cardTemplate: document.querySelector("#cardTemplate"),
  alphaNav: document.querySelector("#alphaNav"),
};

const EVIDENCE_ORDER = ["strong", "moderate", "emerging", "mixed", "unclear"];

init();

async function init() {
  bindEvents();

  try {
    const response = await fetch("./patterns.tsv");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const tsv = await response.text();
    state.rows = parseTsv(tsv).map((row, index) => normalizeRow(row, index));
    populateEvidenceOptions(state.rows);
    renderAlphaNav();
    render();
  } catch (error) {
    console.error(error);
    els.cards.innerHTML = `
      <div class="empty-state">
        <p><strong>Could not load <code>patterns.tsv</code>.</strong></p>
        <p>Preview this page through a local server (for example: <code>python3 -m http.server</code>) or ensure the file exists in the same folder.</p>
      </div>
    `;
  }
}

function bindEvents() {
  els.searchInput.addEventListener("input", (event) => {
    state.query = event.target.value.trim().toLowerCase();
    render();
  });

  els.evidenceFilter.addEventListener("change", (event) => {
    state.evidence = event.target.value;
    render();
  });

  els.sortSelect.addEventListener("change", (event) => {
    state.sort = event.target.value;
    render();
  });

  els.clearFilters.addEventListener("click", () => {
    state.query = "";
    state.evidence = "all";
    state.sort = "name-asc";
    state.alpha = "all";
    els.searchInput.value = "";
    els.evidenceFilter.value = "all";
    els.sortSelect.value = "name-asc";
    syncAlphaUI();
    render();
  });

  els.toggleDensity.addEventListener("click", () => {
    state.compact = !state.compact;
    els.cards.classList.toggle("compact", state.compact);
    els.toggleDensity.textContent = state.compact ? "Expanded view" : "Compact view";
  });
}

function parseTsv(tsv) {
  const lines = tsv
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = lines[0].split("\t").map((header) => header.trim());

  return lines.slice(1).map((line) => {
    const cells = line.split("\t");
    const row = {};
    headers.forEach((header, index) => {
      row[header] = (cells[index] || "").trim();
    });
    return row;
  });
}

function normalizeRow(row, index) {
  const searchable = Object.values(row).join(" ").toLowerCase();
  const evidenceText = row["Strength of evidence + key references"] || "";
  const evidenceBucket = detectEvidenceBucket(evidenceText);
  const prevalenceText = row["Prevalence / population notes"] || "";

  return {
    id: index,
    ...row,
    searchable,
    evidenceBucket,
    prevalenceBadge: summarizePrevalence(prevalenceText),
  };
}

function detectEvidenceBucket(text) {
  const value = text.toLowerCase();
  if (value.includes("moderate") && value.includes("strong")) return "moderate-strong";
  if (value.includes("strong")) return "strong";
  if (value.includes("emerging")) return "emerging";
  if (value.includes("moderate")) return "moderate";
  if (value.includes("mixed")) return "mixed";
  return "unclear";
}

function summarizePrevalence(text) {
  if (!text) return "Prevalence notes";
  const lower = text.toLowerCase();
  if (lower.includes("common") || lower.includes("widespread")) return "Common / widespread";
  if (lower.includes("varies") || lower.includes("varies widely")) return "Varies by context";
  if (lower.includes("uncommon") || lower.includes("hard to estimate")) return "Limited prevalence data";
  if (lower.includes("meta-analysis")) return "Meta-analytic notes";
  return "Population notes";
}

function populateEvidenceOptions(rows) {
  const values = [...new Set(rows.map((row) => row.evidenceBucket))]
    .sort((a, b) => evidenceRank(a) - evidenceRank(b));

  for (const value of values) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = `Only ${labelEvidence(value)}`;
    els.evidenceFilter.append(option);
  }
}

function labelEvidence(bucket) {
  return bucket
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("-");
}

function evidenceRank(bucket) {
  const normalized = bucket === "moderate-strong" ? "strong" : bucket;
  const index = EVIDENCE_ORDER.indexOf(normalized);
  return index === -1 ? EVIDENCE_ORDER.length : index;
}

function getFilteredRows() {
  return state.rows
    .filter((row) => {
      const matchesQuery = !state.query || row.searchable.includes(state.query);
      const matchesEvidence = state.evidence === "all" || row.evidenceBucket === state.evidence;
      const firstChar = (row.Pattern || "").trim().charAt(0).toUpperCase();
      const matchesAlpha = state.alpha === "all" || firstChar === state.alpha;
      return matchesQuery && matchesEvidence && matchesAlpha;
    })
    .sort(sortRows);
}

function renderAlphaNav() {
  if (!els.alphaNav) return;
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const fragment = document.createDocumentFragment();

  const allBtn = document.createElement("button");
  allBtn.type = "button";
  allBtn.className = "alpha-link is-active";
  allBtn.dataset.letter = "all";
  allBtn.textContent = "All";
  fragment.append(allBtn);

  for (const letter of letters) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "alpha-link";
    btn.dataset.letter = letter;
    btn.textContent = letter;
    fragment.append(btn);
  }

  els.alphaNav.replaceChildren(fragment);
  els.alphaNav.addEventListener("click", onAlphaClick);
}

function onAlphaClick(event) {
  const button = event.target.closest(".alpha-link");
  if (!button) return;
  state.alpha = button.dataset.letter || "all";
  syncAlphaUI();
  render();
}

function syncAlphaUI() {
  if (!els.alphaNav) return;
  els.alphaNav.querySelectorAll(".alpha-link").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.letter === state.alpha);
  });
}

function sortRows(a, b) {
  switch (state.sort) {
    case "name-desc":
      return b.Pattern.localeCompare(a.Pattern);
    case "evidence": {
      const rankDiff = evidenceRank(a.evidenceBucket) - evidenceRank(b.evidenceBucket);
      return rankDiff || a.Pattern.localeCompare(b.Pattern);
    }
    case "name-asc":
    default:
      return a.Pattern.localeCompare(b.Pattern);
  }
}

function render() {
  const rows = getFilteredRows();
  els.resultCount.textContent = String(rows.length);
  els.cards.classList.toggle("compact", state.compact);

  if (!rows.length) {
    els.cards.innerHTML = `
      <div class="empty-state">
        No patterns match the current search and filters.
      </div>
    `;
    return;
  }

  const fragment = document.createDocumentFragment();

  for (const row of rows) {
    const node = els.cardTemplate.content.firstElementChild.cloneNode(true);
    const titleLink = node.querySelector(".card-title-link");
    titleLink.textContent = row.Pattern || "Untitled pattern";
    titleLink.href = `entry.html?id=${encodeURIComponent(row.id)}`;
    titleLink.setAttribute("aria-label", `Open entry for ${row.Pattern || "Untitled pattern"}`);
    node.querySelector(".card-definition").textContent = row["Concise definition"] || "";

    const evidenceBadge = node.querySelector(".evidence-badge");
    evidenceBadge.textContent = `Evidence: ${labelEvidence(row.evidenceBucket)}`;
    evidenceBadge.classList.add(`evidence-${row.evidenceBucket.split("-")[0]}`);

    const prevalenceBadge = node.querySelector(".prevalence-badge");
    prevalenceBadge.textContent = row.prevalenceBadge;

    fragment.append(node);
  }

  els.cards.replaceChildren(fragment);
}
