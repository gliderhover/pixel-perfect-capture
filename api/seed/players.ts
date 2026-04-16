import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getMongoDb } from "../../lib/mongodb";
import { getPlayerCollection, type PlayerDoc } from "../../lib/server/dbCollections";
import { mockPlayers } from "../../src/data/mockData";

function toSlug(id: string, name: string) {
  const safeName = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `player-${id}-${safeName}`;
}

/**
 * POST /api/seed/players
 * Idempotent seed endpoint for moving mock players into MongoDB.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const db = await getMongoDb();
    const players = await getPlayerCollection(db);
    const now = new Date();

    let upserted = 0;
    let updated = 0;

    for (const p of mockPlayers) {
      const doc: Omit<PlayerDoc, "_id"> = {
        externalId: p.id,
        slug: toSlug(p.id, p.name),
        name: p.name,
        portrait: p.portrait,
        age: p.age,
        position: p.position,
        clubTeam: p.clubTeam,
        nationalTeam: p.nationalTeam,
        representedCountry: p.representedCountry,
        rarity: p.rarity,
        traits: p.traits,
        stats: {
          confidence: p.attributes.confidence,
          form: p.attributes.form,
          morale: p.attributes.morale,
          fanBond: p.attributes.fanBond,
        },
        level: p.level,
        xp: p.currentXp,
        evolutionStage: p.evolutionStage,
        createdAt: now,
        updatedAt: now,
      };

      const result = await players.updateOne(
        { externalId: p.id },
        {
          $set: {
            slug: doc.slug,
            name: doc.name,
            portrait: doc.portrait,
            age: doc.age,
            position: doc.position,
            clubTeam: doc.clubTeam,
            nationalTeam: doc.nationalTeam,
            representedCountry: doc.representedCountry,
            rarity: doc.rarity,
            traits: doc.traits,
            stats: doc.stats,
            level: doc.level,
            xp: doc.xp,
            evolutionStage: doc.evolutionStage,
            updatedAt: now,
          },
          $setOnInsert: {
            externalId: doc.externalId,
            createdAt: now,
          },
        },
        { upsert: true }
      );

      if (result.upsertedCount > 0) upserted += 1;
      else if (result.matchedCount > 0) updated += 1;
    }

    return res.status(200).json({
      ok: true,
      totalSource: mockPlayers.length,
      upserted,
      updated,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown seed error";
    return res.status(500).json({ ok: false, error: message });
  }
}
