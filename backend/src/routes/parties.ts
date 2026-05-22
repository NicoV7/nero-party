import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";

const prisma = new PrismaClient();
const router = Router();

/** Strip HTML tags from a string. */
function sanitize(input: string): string {
  return input.replace(/<[^>]*>/g, "");
}

/** Generate a random 6-character uppercase alphanumeric code. */
function generatePartyCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// POST /api/parties — Create a new party
router.post("/", async (req, res) => {
  try {
    const { name, hostName, maxSongsPerPerson, maxUsers, maxDurationMinutes } = req.body;

    // Validate name
    if (!name || typeof name !== "string" || name.trim().length === 0 || name.trim().length > 100) {
      res.status(400).json({ error: "name is required and must be 1-100 characters" });
      return;
    }

    // Validate hostName
    if (!hostName || typeof hostName !== "string" || hostName.trim().length === 0 || hostName.trim().length > 50) {
      res.status(400).json({ error: "hostName is required and must be 1-50 characters" });
      return;
    }

    // Validate maxSongsPerPerson
    const songsPerPerson = maxSongsPerPerson ?? 5;
    if (typeof songsPerPerson !== "number" || songsPerPerson < 1 || songsPerPerson > 20) {
      res.status(400).json({ error: "maxSongsPerPerson must be between 1 and 20" });
      return;
    }

    // Validate maxUsers
    const userLimit = maxUsers ?? 12;
    if (typeof userLimit !== "number" || userLimit < 2 || userLimit > 100) {
      res.status(400).json({ error: "maxUsers must be between 2 and 100" });
      return;
    }

    // Validate maxDurationMinutes
    const duration = maxDurationMinutes ?? 60;
    if (typeof duration !== "number" || duration < 5 || duration > 180) {
      res.status(400).json({ error: "maxDurationMinutes must be between 5 and 180" });
      return;
    }

    const sanitizedName = sanitize(name.trim());
    const sanitizedHostName = sanitize(hostName.trim());

    // Generate a unique party code, retrying on collision
    let code: string;
    let attempts = 0;
    do {
      code = generatePartyCode();
      const existing = await prisma.party.findUnique({ where: { code } });
      if (!existing) break;
      attempts++;
    } while (attempts < 10);

    if (attempts >= 10) {
      res.status(500).json({ error: "Failed to generate a unique party code" });
      return;
    }

    const hostToken = uuidv4();

    await prisma.party.create({
      data: {
        name: sanitizedName,
        code,
        hostToken,
        hostName: sanitizedHostName,
        maxSongsPerPerson: songsPerPerson,
        maxUsers: userLimit,
        maxDurationMinutes: duration,
      },
    });

    res.status(201).json({ code, hostToken });
  } catch (error) {
    console.error("Error creating party:", error);
    res.status(500).json({ error: "Failed to create party" });
  }
});

// GET /api/parties/:code — Get party info for join screen
router.get("/:code", async (req, res) => {
  try {
    const code = req.params.code.toUpperCase();
    const party = await prisma.party.findUnique({
      where: { code },
    });

    if (!party) {
      res.status(404).json({ error: "Party not found" });
      return;
    }

    const participantCount = await prisma.participant.count({
      where: { partyId: party.id, isConnected: true },
    });

    res.json({
      name: party.name,
      hostName: party.hostName,
      status: party.status,
      participantCount,
      maxUsers: party.maxUsers,
    });
  } catch (error) {
    console.error("Error fetching party:", error);
    res.status(500).json({ error: "Failed to fetch party" });
  }
});

// POST /api/parties/:code/join — Join a party
router.post("/:code/join", async (req, res) => {
  try {
    const { name, clientToken } = req.body;
    const code = req.params.code.toUpperCase();

    // Validate name
    if (!name || typeof name !== "string" || name.trim().length === 0 || name.trim().length > 50) {
      res.status(400).json({ error: "name is required and must be 1-50 characters" });
      return;
    }

    // Validate clientToken
    if (!clientToken || typeof clientToken !== "string") {
      res.status(400).json({ error: "clientToken is required" });
      return;
    }

    const party = await prisma.party.findUnique({
      where: { code },
    });

    if (!party) {
      res.status(404).json({ error: "Party not found" });
      return;
    }

    if (party.status === "ended") {
      res.status(400).json({ error: "This party has ended" });
      return;
    }

    const sanitizedName = sanitize(name.trim());

    // Check for reconnection — same clientToken in this party
    const existingParticipant = await prisma.participant.findFirst({
      where: { partyId: party.id, clientToken },
    });

    if (existingParticipant) {
      // Reconnection: update name and set connected
      await prisma.participant.update({
        where: { id: existingParticipant.id },
        data: { name: sanitizedName, isConnected: true },
      });

      res.json({ participantId: existingParticipant.id, partyCode: party.code });
      return;
    }

    const connectedCount = await prisma.participant.count({
      where: { partyId: party.id, isConnected: true },
    });

    if (connectedCount >= party.maxUsers) {
      res.status(403).json({ error: "This room is full" });
      return;
    }

    // New participant
    const avatarColors = [
      "#7c3aed",
      "#2563eb",
      "#16a34a",
      "#ea580c",
      "#e11d48",
      "#0891b2",
      "#c026d3",
      "#65a30d",
    ];
    const avatarColor = avatarColors[Math.floor(Math.random() * avatarColors.length)];

    const participant = await prisma.participant.create({
      data: {
        partyId: party.id,
        name: sanitizedName,
        avatarColor,
        clientToken,
      },
    });

    res.status(201).json({ participantId: participant.id, partyCode: party.code });
  } catch (error) {
    console.error("Error joining party:", error);
    res.status(500).json({ error: "Failed to join party" });
  }
});

export { prisma };
export default router;
