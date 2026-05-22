import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import {
  AVATAR_COLORS,
  DEFAULT_MAX_SONGS_PER_PERSON,
  DEFAULT_MAX_USERS,
  DEFAULT_PARTY_DURATION_MINUTES,
  MAX_MAX_SONGS_PER_PERSON,
  MAX_MAX_USERS,
  MAX_PARTY_DURATION_MINUTES,
  MIN_MAX_SONGS_PER_PERSON,
  MIN_MAX_USERS,
  MIN_PARTY_DURATION_MINUTES,
  PARTY_CODE_CHARS,
  PARTY_CODE_LENGTH,
  PARTY_CODE_MAX_ATTEMPTS,
} from "../constants/party.js";
import type { CreatePartyRequest, JoinPartyRequest } from "../dto/party.js";
import { prisma } from "../models/db.js";
import { sanitize } from "../services/text.js";

const router = Router();

/** Generate a random 6-character uppercase alphanumeric code. */
function generatePartyCode(): string {
  let code = "";
  for (let i = 0; i < PARTY_CODE_LENGTH; i++) {
    code += PARTY_CODE_CHARS.charAt(Math.floor(Math.random() * PARTY_CODE_CHARS.length));
  }
  return code;
}

// POST /api/parties — Create a new party
router.post("/", async (req, res) => {
  try {
    const { name, hostName, maxSongsPerPerson, maxUsers, maxDurationMinutes } =
      req.body as CreatePartyRequest;

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
    const songsPerPerson = maxSongsPerPerson ?? DEFAULT_MAX_SONGS_PER_PERSON;
    if (
      typeof songsPerPerson !== "number" ||
      songsPerPerson < MIN_MAX_SONGS_PER_PERSON ||
      songsPerPerson > MAX_MAX_SONGS_PER_PERSON
    ) {
      res.status(400).json({ error: `maxSongsPerPerson must be between ${MIN_MAX_SONGS_PER_PERSON} and ${MAX_MAX_SONGS_PER_PERSON}` });
      return;
    }

    // Validate maxUsers
    const userLimit = maxUsers ?? DEFAULT_MAX_USERS;
    if (typeof userLimit !== "number" || userLimit < MIN_MAX_USERS || userLimit > MAX_MAX_USERS) {
      res.status(400).json({ error: `maxUsers must be between ${MIN_MAX_USERS} and ${MAX_MAX_USERS}` });
      return;
    }

    // Validate maxDurationMinutes
    const duration = maxDurationMinutes ?? DEFAULT_PARTY_DURATION_MINUTES;
    if (
      typeof duration !== "number" ||
      duration < MIN_PARTY_DURATION_MINUTES ||
      duration > MAX_PARTY_DURATION_MINUTES
    ) {
      res.status(400).json({ error: `maxDurationMinutes must be between ${MIN_PARTY_DURATION_MINUTES} and ${MAX_PARTY_DURATION_MINUTES}` });
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
    } while (attempts < PARTY_CODE_MAX_ATTEMPTS);

    if (attempts >= PARTY_CODE_MAX_ATTEMPTS) {
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
    const { name, clientToken } = req.body as JoinPartyRequest;
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
    const avatarColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

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

export default router;
