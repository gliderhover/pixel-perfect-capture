/**
 * Local helper script to run the player seed route.
 *
 * Usage:
 *   1) Start app locally: npm run dev
 *   2) In another terminal: npm run seed:players
 *
 * Optional:
 *   SEED_BASE_URL=http://localhost:3000 npm run seed:players
 */
const baseUrl = process.env.SEED_BASE_URL || "http://localhost:8080";
const url = `${baseUrl.replace(/\/$/, "")}/api/seed/players`;

async function run() {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = { raw: await response.text() };
  }

  if (!response.ok) {
    console.error("Seed failed:", payload);
    process.exit(1);
  }

  console.log("Seed completed:", payload);
}

run().catch((err) => {
  console.error("Seed script error:", err);
  process.exit(1);
});
