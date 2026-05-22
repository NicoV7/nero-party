import type { Party } from "@prisma/client";
import { ADD_MODE_HOST } from "../constants/party.js";
import type { AddSongPayload } from "../dto/party.js";
import { prisma } from "../models/db.js";
import { toSongData, type SongData } from "../models/song.js";
import { sanitize } from "./text.js";

interface QueueParticipant {
  participantId: string;
  clientToken: string;
}

export interface AddSongResult {
  songData: SongData;
  systemMessage: {
    id: string;
    content: string;
    type: string;
    createdAt: Date;
  };
}

export function validateAddSongPayload(payload: AddSongPayload): string | null {
  if (
    !payload.youtubeVideoId || typeof payload.youtubeVideoId !== "string" ||
    !payload.title || typeof payload.title !== "string" ||
    !payload.artist || typeof payload.artist !== "string" ||
    !payload.thumbnailUrl || typeof payload.thumbnailUrl !== "string"
  ) {
    return "Invalid song data";
  }

  return null;
}

export function canParticipantAddSongs(party: Party, participant: QueueParticipant): boolean {
  return party.addMode !== ADD_MODE_HOST || participant.clientToken === party.hostToken;
}

export async function addSongToQueue(
  party: Party,
  participant: QueueParticipant,
  payload: AddSongPayload
): Promise<AddSongResult | { error: string }> {
  const payloadError = validateAddSongPayload(payload);
  if (payloadError) return { error: payloadError };

  if (!canParticipantAddSongs(party, participant)) {
    return { error: "Only the host can add songs in this room" };
  }

  const sanitizedTitle = sanitize(payload.title);
  const sanitizedArtist = sanitize(payload.artist);

  const transactionResult = await prisma.$transaction(async (tx) => {
    const songCount = await tx.song.count({
      where: { partyId: party.id, addedById: participant.participantId },
    });

    if (songCount >= party.maxSongsPerPerson) {
      return {
        ok: false as const,
        error: `You can only add ${party.maxSongsPerPerson} songs`,
      };
    }

    const maxPos = await tx.song.aggregate({
      where: { partyId: party.id },
      _max: { position: true },
    });

    const createdSong = await tx.song.create({
      data: {
        partyId: party.id,
        youtubeVideoId: payload.youtubeVideoId,
        title: sanitizedTitle,
        artist: sanitizedArtist,
        thumbnailUrl: payload.thumbnailUrl,
        addedById: participant.participantId,
        position: (maxPos._max.position ?? -1) + 1,
      },
      include: {
        addedBy: { select: { id: true, name: true, avatarColor: true } },
      },
    });

    const message = await tx.chatMessage.create({
      data: {
        partyId: party.id,
        content: `${createdSong.addedBy.name} added ${createdSong.title}`,
        type: "system",
      },
    });

    return { ok: true as const, song: createdSong, systemMessage: message };
  });

  if (!transactionResult.ok) {
    return { error: transactionResult.error };
  }

  return {
    songData: toSongData(transactionResult.song),
    systemMessage: transactionResult.systemMessage,
  };
}

export async function reorderQueuedSongs(partyId: string, songIds: string[]): Promise<SongData[]> {
  await prisma.$transaction(
    songIds.map((songId, position) =>
      prisma.song.updateMany({
        where: { id: songId, partyId, status: "queued" },
        data: { position },
      })
    )
  );

  const songs = await prisma.song.findMany({
    where: { partyId },
    include: {
      addedBy: { select: { id: true, name: true, avatarColor: true } },
    },
  });

  return songs.map((song) => toSongData(song));
}
