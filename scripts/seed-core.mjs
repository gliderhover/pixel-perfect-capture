/**
 * Local helper script to run core seed routes.
 *
 * Usage:
 *   1) Start app locally: npx vercel dev
 *   2) In another terminal: npm run seed:core
 *
 * Optional:
 *   SEED_BASE_URL=http://localhost:3000 npm run seed:core
 *   SEED_USER_PLAYERS=0 npm run seed:core
 */
const baseUrl = process.env.SEED_BASE_URL || "http://localhost:3000";
const seedUserPlayers = process.env.SEED_USER_PLAYERS !== "0";

const endpoints = [
  { path: "/api/seed/players", body: {} },
  {
    path: "/api/seed/bootstrap",
    body: { seedUserPlayers, userId: "demo-user" },
  },
];

async function callSeed(path, body) {
  const url = `${baseUrl.replace(/\/$/, "")}${path}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = { raw: await response.text() };
  }

  if (!response.ok) {
    throw new Error(`${path} failed: ${JSON.stringify(payload)}`);
  }
  return payload;
}

async function run() {
  for (const endpoint of endpoints) {
    const payload = await callSeed(endpoint.path, endpoint.body);
    console.log(`Seed completed for ${endpoint.path}:`, payload);
  }
}

run().catch((err) => {
  console.error("Core seed script error:", err);
  process.exit(1);
});
