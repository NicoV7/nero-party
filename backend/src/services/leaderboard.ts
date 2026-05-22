import { SONG_STATUS_ORDER } from "../constants/party.js";
import { REACTION_SCORES } from "../constants/reactions.js";
import { prisma } from "../models/db.js";
import { toSongData, type LeaderboardSongData } from "../models/song.js";

export async function buildLeaderboard(partyId: string): Promise<LeaderboardSongData[]> {
  const songs = await prisma.song.findMany({
    where: { partyId },
    include: {
      votes: true,
      addedBy: { select: { id: true, name: true, avatarColor: true } },
    },
  });

  return songs
    .map((song) => {
      const reactionBreakdown: Record<string, number> = {};
      let totalScore = 0;

      for (const vote of song.votes) {
        reactionBreakdown[vote.reaction] = (reactionBreakdown[vote.reaction] || 0) + 1;
        totalScore += REACTION_SCORES[vote.reaction] ?? 0;
      }

      return {
        ...toSongData(song),
        totalScore,
        reactionBreakdown,
        reactionCount: song.votes.length,
      };
    })
    .sort((a, b) => {
      // Primary: highest total score
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      // Tiebreaker 1: more total votes (higher engagement wins)
      if (b.reactionCount !== a.reactionCount) return b.reactionCount - a.reactionCount;
      // Tiebreaker 2: more fire reactions (strongest endorsement wins)
      const aFires = a.reactionBreakdown['fire'] ?? 0;
      const bFires = b.reactionBreakdown['fire'] ?? 0;
      if (bFires !== aFires) return bFires - aFires;
      // Tiebreaker 3: song status order (playing > queued > played)
      const statusDiff = (SONG_STATUS_ORDER[a.status] ?? 1) - (SONG_STATUS_ORDER[b.status] ?? 1);
      if (statusDiff !== 0) return statusDiff;
      // Final: earlier added song wins
      return a.position - b.position;
    });
}

export async function buildFinalResults(partyId: string): Promise<LeaderboardSongData[]> {
  const leaderboard = await buildLeaderboard(partyId);
  return [...leaderboard].sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    if (b.reactionCount !== a.reactionCount) return b.reactionCount - a.reactionCount;
    const aFires = a.reactionBreakdown['fire'] ?? 0;
    const bFires = b.reactionBreakdown['fire'] ?? 0;
    if (bFires !== aFires) return bFires - aFires;
    return a.position - b.position;
  });
}
