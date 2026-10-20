// Netlify Function: GitHub sebagai database (data/db.json)
const R = process.env.GH_REPO, P = process.env.GH_PATH || "data/db.json", B = process.env.GH_BRANCH || "main";
const U = `https://api.github.com/repos/${R}/contents/${P}`;
const H = { Authorization: "Bearer " + process.env.GH_TOKEN, "User-Agent": "kelas-web", Accept: "application/vnd.github+json" };
const out = (s, o) => ({ statusCode: s, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body: JSON.stringify(o) });

async function get() {
  const r = await fetch(U + "?ref=" + B, { headers: H });
  if (!r.ok) throw new Error("GitHub " + r.status);
  const j = await r.json();
  return { sha: j.sha, db: JSON.parse(Buffer.from(j.content, "base64").toString("utf8")) };
}
async function put(db, sha) {
  const r = await fetch(U, { method: "PUT", headers: H, body: JSON.stringify({
    message: "update data kelas", branch: B, sha,
    content: Buffer.from(JSON.stringify(db, null, 1)).toString("base64") }) });
  if (!r.ok) throw new Error("GitHub " + r.status);
}

exports.handler = async (e) => {
  try {
    if (e.httpMethod === "GET") return out(200, (await get()).db);
    const b = JSON.parse(e.body || "{}");
    if (b.action === "save") { // khusus admin
      if (!process.env.ADMIN_PASSWORD || b.password !== process.env.ADMIN_PASSWORD) return out(401, { error: "Password salah" });
      const { sha } = await get(); await put(b.db, sha); return out(200, { ok: 1 });
    }
    const { db, sha } = await get(); // aksi publik
    if (b.action === "vote") {
      const o = db.voting.opts[b.o]; if (!o) return out(400, { error: "pilihan tidak ada" }); o.v++;
    } else if (b.action === "confess") {
      const t = String(b.text || "").trim().slice(0, 280); if (!t) return out(400, { error: "pesan kosong" });
      db.confess.unshift({ a: t, b: new Date().toISOString() }); db.confess = db.confess.slice(0, 50);
    } else return out(400, { error: "aksi tidak dikenal" });
    await put(db, sha); return out(200, db);
  } catch (err) { return out(500, { error: err.message }); }
};
