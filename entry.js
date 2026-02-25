const FIELD_ORDER = [
  "Concise definition",
  "Typical observable behaviors",
  "Psychological function + short-term benefits",
  "Long-term costs/harms",
  "Typical origins/etiology (developmental, attachment, cognitive)",
  "Prevalence / population notes",
  "Strength of evidence + key references",
  "Evidence-based interventions (brief; support level)",
];

const FIELD_LABELS = {
  "Concise definition": "Definition",
  "Typical observable behaviors": "Observable behaviors",
  "Psychological function + short-term benefits": "Function + short-term benefits",
  "Long-term costs/harms": "Long-term costs / harms",
  "Typical origins/etiology (developmental, attachment, cognitive)": "Typical origins / etiology",
  "Prevalence / population notes": "Prevalence / population notes",
  "Strength of evidence + key references": "Evidence strength + references",
  "Evidence-based interventions (brief; support level)": "Evidence-based interventions",
};

const container = document.querySelector("#entryContent");
init();

async function init() {
  const params = new URLSearchParams(window.location.search);
  const id = Number(params.get("id"));

  if (!Number.isInteger(id) || id < 0) {
    renderMessage("Invalid or missing entry id.");
    return;
  }

  try {
    const response = await fetch("./patterns.tsv");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const tsv = await response.text();
    const rows = parseTsv(tsv);
    const row = rows[id];

    if (!row) {
      renderMessage("Entry not found.");
      return;
    }

    renderEntry(row);
    document.title = `${row.Pattern} | DAE Encyclopedia of Patterns`;
  } catch (error) {
    console.error(error);
    renderMessage("Could not load entry data. Make sure patterns.tsv is in the same folder.");
  }
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

function renderMessage(message) {
  container.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
}

function renderEntry(row) {
  const article = document.createElement("article");
  article.className = "entry-article";

  const header = document.createElement("header");
  header.className = "entry-header";
  header.innerHTML = `
    <h2 class="entry-title">${escapeHtml(row.Pattern || "Untitled pattern")}</h2>
    <p class="entry-definition">${escapeHtml(row["Concise definition"] || "")}</p>
  `;
  article.append(header);

  const grid = document.createElement("div");
  grid.className = "entry-fields";

  for (const key of FIELD_ORDER) {
    if (key === "Concise definition") continue;
    const section = document.createElement("section");
    section.className = "entry-field";
    if (key === "Evidence-based interventions (brief; support level)") {
      section.classList.add("full-width");
    }

    const h3 = document.createElement("h3");
    h3.textContent = FIELD_LABELS[key] || key;
    const p = document.createElement("p");
    p.textContent = row[key] || "—";

    section.append(h3, p);
    grid.append(section);
  }

  article.append(grid);
  container.replaceChildren(article);
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
