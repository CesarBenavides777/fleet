// Generic fleet board: reads the thread list from ./config.json, then polls each
// thread's status JSON + comms JSONL every 2s. No build step — plain ES modules.
const POLL_MS = 2000;
const STALE_MS = 8 * 60 * 1000;

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );

const noStore = (url) =>
  fetch(`${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`, { cache: "no-store" });

async function getJson(url) {
  try {
    const r = await noStore(url);
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

async function getJsonl(url) {
  try {
    const r = await noStore(url);
    if (!r.ok) return [];
    const text = await r.text();
    return text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        try {
          return JSON.parse(l);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

const STEP_ICON = { pending: "○", active: "◐", done: "●", blocked: "✕" };

function tile(thread, st) {
  const color = thread.color || "#7c3aed";
  const phase = (st && st.phase) || "pending";
  const done = st && st.progress ? st.progress.done : 0;
  const total = st && st.progress ? st.progress.total : 0;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const updated = st && st.updatedAt ? Date.parse(st.updatedAt) : 0;
  const stale = updated && phase !== "done" && Date.now() - updated > STALE_MS;
  const cls = ["tile", phase === "done" ? "done" : "", phase === "blocked" ? "blocked" : "", stale ? "stale" : ""]
    .filter(Boolean)
    .join(" ");
  const steps = (st && st.steps) || [];
  const stepsHtml = steps
    .map((s) => `<li class="${esc(s.status)}">${STEP_ICON[s.status] || "○"} ${esc(s.title)}</li>`)
    .join("");
  const blockers = (st && st.blockers) || [];
  const prHtml =
    st && st.pr ? `<div class="pr">PR <a href="${esc(st.pr)}" target="_blank">${esc(st.pr)}</a></div>` : "";
  return `
    <div class="${cls}" style="border-left-color:${esc(color)}">
      <div class="tile-head">
        <span class="chip" style="color:${esc(color)}">${esc(thread.name)}</span>
        <span class="phase">${esc(phase)}</span>
        ${stale ? '<span class="badge-stale">STALE</span>' : ""}
      </div>
      <div class="branch">${esc(thread.title || "")}${thread.branch ? ` · ${esc(thread.branch)}` : ""}</div>
      <div class="track"><div class="fill" style="width:${pct}%;background:${esc(color)}"></div></div>
      <div class="current">${esc((st && st.currentStep) || "—")} <span class="t">${done}/${total}</span></div>
      ${stepsHtml ? `<ul class="steps">${stepsHtml}</ul>` : ""}
      ${blockers.length ? `<div class="blockers">⚠ ${blockers.map(esc).join("; ")}</div>` : ""}
      ${prHtml}
    </div>`;
}

function msgEl(m) {
  const refs = m.refs && m.refs.length ? ` [${m.refs.map(esc).join(", ")}]` : "";
  return `<div class="msg ${esc(m.type)}">
    <span class="who">${esc(m.from)}→${esc(m.to)}</span> <span class="t">${esc(m.ts)}</span>
    <div>${esc(m.body)}${refs}</div>
  </div>`;
}

function unansweredAsks(all) {
  const answers = all.filter((m) => m.type === "answer");
  return all
    .filter((m) => m.type === "ask")
    .filter(
      (ask) =>
        !answers.some(
          (a) => a.ts > ask.ts && (a.from === ask.to || ask.to === "all") && (a.to === ask.from || a.to === "all"),
        ),
    );
}

async function tick(threads) {
  const states = await Promise.all(threads.map((t) => getJson(`status/${t.name}.json`)));
  const commsLists = await Promise.all(threads.map((t) => getJsonl(`comms/${t.name}.jsonl`)));
  const all = commsLists.flat().sort((a, b) => String(a.ts).localeCompare(String(b.ts)));

  document.getElementById("tiles").innerHTML = threads.map((t, i) => tile(t, states[i])).join("");

  let done = 0;
  let total = 0;
  for (const st of states) {
    if (st && st.progress) {
      done += st.progress.done || 0;
      total += st.progress.total || 0;
    }
  }
  const pct = total ? Math.round((done / total) * 100) : 0;
  document.getElementById("overallFill").style.width = `${pct}%`;
  document.getElementById("overallText").textContent = `${done}/${total} (${pct}%)`;
  document.getElementById("clock").textContent = new Date().toLocaleTimeString();

  const asks = unansweredAsks(all);
  document.getElementById("asks").innerHTML = asks.length
    ? asks.map(msgEl).join("")
    : '<div class="empty">none</div>';
  document.getElementById("feed").innerHTML = all.length
    ? all.slice(-60).reverse().map(msgEl).join("")
    : '<div class="empty">no messages yet</div>';
}

async function main() {
  const config = (await getJson("config.json")) || { threads: [] };
  const threads = config.threads || [];
  document.title = `🐝 fleet board · ${threads.length} threads`;
  await tick(threads);
  setInterval(() => tick(threads), POLL_MS);
}

main();
