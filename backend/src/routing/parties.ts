import { Router, type Request, type Response } from "express";
import { v4 as uuidv4 } from "uuid";
import {
  ADD_MODE_EVERYONE,
  ADD_MODES,
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
import { routeHandler, sendHttpError } from "../exceptions/http.js";
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
router.post(
  "/",
  routeHandler(createParty, "Error creating party:", "Failed to create party")
);

// GET /api/parties/:code — Get party info for join screen
router.get(
  "/:code",
  routeHandler(getParty, "Error fetching party:", "Failed to fetch party")
);

// POST /api/parties/:code/join — Join a party
router.post(
  "/:code/join",
  routeHandler(joinParty, "Error joining party:", "Failed to join party")
);

async function createParty(req: Request, res: Response): Promise<void> {
  const { name, hostName, maxSongsPerPerson, maxUsers, maxDurationMinutes, addMode } =
    req.body as CreatePartyRequest;

  // Validate name
  if (!name || typeof name !== "string" || name.trim().length === 0 || name.trim().length > 100) {
    sendHttpError(res, 400, "name is required and must be 1-100 characters");
    return;
  }

  // Validate hostName
  if (!hostName || typeof hostName !== "string" || hostName.trim().length === 0 || hostName.trim().length > 50) {
    sendHttpError(res, 400, "hostName is required and must be 1-50 characters");
    return;
  }

  // Validate maxSongsPerPerson
  const songsPerPerson = maxSongsPerPerson ?? DEFAULT_MAX_SONGS_PER_PERSON;
  if (
    typeof songsPerPerson !== "number" ||
    songsPerPerson < MIN_MAX_SONGS_PER_PERSON ||
    songsPerPerson > MAX_MAX_SONGS_PER_PERSON
  ) {
    sendHttpError(
      res,
      400,
      `maxSongsPerPerson must be between ${MIN_MAX_SONGS_PER_PERSON} and ${MAX_MAX_SONGS_PER_PERSON}`
    );
    return;
  }

  // Validate maxUsers
  const userLimit = maxUsers ?? DEFAULT_MAX_USERS;
  if (typeof userLimit !== "number" || userLimit < MIN_MAX_USERS || userLimit > MAX_MAX_USERS) {
    sendHttpError(res, 400, `maxUsers must be between ${MIN_MAX_USERS} and ${MAX_MAX_USERS}`);
    return;
  }

  // Validate maxDurationMinutes
  const duration = maxDurationMinutes ?? DEFAULT_PARTY_DURATION_MINUTES;
  if (
    typeof duration !== "number" ||
    duration < MIN_PARTY_DURATION_MINUTES ||
    duration > MAX_PARTY_DURATION_MINUTES
  ) {
    sendHttpError(
      res,
      400,
      `maxDurationMinutes must be between ${MIN_PARTY_DURATION_MINUTES} and ${MAX_PARTY_DURATION_MINUTES}`
    );
    return;
  }

  const songAddMode = addMode ?? ADD_MODE_EVERYONE;
  if (typeof songAddMode !== "string" || !ADD_MODES.includes(songAddMode as never)) {
    sendHttpError(res, 400, "addMode must be either everyone or host");
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
    sendHttpError(res, 500, "Failed to generate a unique party code");
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
      addMode: songAddMode,
    },
  });

  res.status(201).json({ code, hostToken });
}

async function getParty(req: Request<{ code: string }>, res: Response): Promise<void> {
  const code = req.params.code.toUpperCase();
  const party = await prisma.party.findUnique({
    where: { code },
  });

  if (!party) {
    sendHttpError(res, 404, "Party not found");
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
}

async function joinParty(req: Request<{ code: string }>, res: Response): Promise<void> {
  const { name, clientToken } = req.body as JoinPartyRequest;
  const code = req.params.code.toUpperCase();

  // Validate name
  if (!name || typeof name !== "string" || name.trim().length === 0 || name.trim().length > 50) {
    sendHttpError(res, 400, "name is required and must be 1-50 characters");
    return;
  }

  // Validate clientToken
  if (!clientToken || typeof clientToken !== "string") {
    sendHttpError(res, 400, "clientToken is required");
    return;
  }

  const party = await prisma.party.findUnique({
    where: { code },
  });

  if (!party) {
    sendHttpError(res, 404, "Party not found");
    return;
  }

  if (party.status === "ended") {
    sendHttpError(res, 400, "This party has ended");
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
    sendHttpError(res, 403, "This room is full");
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
}

export default router;
