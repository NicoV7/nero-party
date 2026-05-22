import { io } from "socket.io-client";

const API_URL = process.env.API_URL ?? "http://localhost:3000";
const SOCKET_URL = process.env.SOCKET_URL ?? API_URL;
const TIMEOUT_MS = 5000;

const songs = [
  {
    youtubeVideoId: "agent-host-song",
    title: "Host Signal",
    artist: "Agent Host",
    thumbnailUrl: "https://i.ytimg.com/vi/agent-host-song/mqdefault.jpg",
  },
  {
    youtubeVideoId: "agent-ada-song",
    title: "Ada's Pick",
    artist: "Agent Ada",
    thumbnailUrl: "https://i.ytimg.com/vi/agent-ada-song/mqdefault.jpg",
  },
  {
    youtubeVideoId: "agent-ben-song",
    title: "Ben's Pick",
    artist: "Agent Ben",
    thumbnailUrl: "https://i.ytimg.com/vi/agent-ben-song/mqdefault.jpg",
  },
];

async function main() {
  const everyone = await runEveryoneCanAdd();
  const hostOnly = await runHostOnlyCanAdd();

  console.log(JSON.stringify({ everyone, hostOnly }, null, 2));
}

async function runEveryoneCanAdd() {
  const party = await createParty("Smoke Everyone", "Agent Host", "everyone");
  const clients = await joinAgentClients(party);
  const addedSongs = [];

  try {
    addedSongs.push(await addSong(clients.host.socket, songs[0]));
    addedSongs.push(await addSong(clients.ada.socket, songs[1]));
    addedSongs.push(await addSong(clients.ben.socket, songs[2]));

    const leaderboard = await voteAll(clients, addedSongs);

    return {
      code: party.code,
      hostToken: party.hostToken,
      addMode: "everyone",
      addedBy: addedSongs.map((song) => song.addedByName),
      leaderboard: summarizeLeaderboard(leaderboard),
    };
  } finally {
    disconnectAll(clients);
  }
}

async function runHostOnlyCanAdd() {
  const party = await createParty("Smoke Host Only", "Agent Host", "host");
  const clients = await joinAgentClients(party);

  try {
    const guestError = await addSongExpectingError(clients.ada.socket, songs[1]);
    const hostSong = await addSong(clients.host.socket, songs[0]);
    const leaderboard = await voteAll(clients, [hostSong]);

    return {
      code: party.code,
      hostToken: party.hostToken,
      addMode: "host",
      guestAddError: guestError,
      addedBy: [hostSong.addedByName],
      leaderboard: summarizeLeaderboard(leaderboard),
    };
  } finally {
    disconnectAll(clients);
  }
}

async function createParty(name, hostName, addMode) {
  const response = await fetch(`${API_URL}/api/parties`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      hostName,
      maxSongsPerPerson: 5,
      maxUsers: 8,
      maxDurationMinutes: 15,
      addMode,
    }),
  });

  if (!response.ok) {
    throw new Error(`Create party failed: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

async function joinParty(code, name, clientToken) {
  const response = await fetch(`${API_URL}/api/parties/${code}/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, clientToken }),
  });

  if (!response.ok) {
    throw new Error(`Join party failed: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

async function joinAgentClients(party) {
  const adaToken = `agent-ada-${party.code}`;
  const benToken = `agent-ben-${party.code}`;
  await joinParty(party.code, "Agent Ada", adaToken);
  await joinParty(party.code, "Agent Ben", benToken);

  const host = await connectAgent("Agent Host", party.code, party.hostToken);
  const ada = await connectAgent("Agent Ada", party.code, adaToken);
  const ben = await connectAgent("Agent Ben", party.code, benToken);

  return { host, ada, ben };
}

async function connectAgent(name, partyCode, clientToken) {
  const socket = io(SOCKET_URL, {
    autoConnect: false,
    reconnection: false,
    transports: ["websocket", "polling"],
  });

  const state = { leaderboard: [], errors: [] };
  socket.on("leaderboard-updated", (leaderboard) => {
    state.leaderboard = leaderboard;
  });
  socket.on("error", (error) => {
    state.errors.push(error?.message ?? String(error));
  });

  await waitForConnect(socket);
  socket.emit("join-room", { partyCode, clientToken });
  const partyState = await waitFor(socket, "party-state");

  return { name, socket, state, participantId: partyState.participantId };
}

function waitForConnect(socket) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Socket connection timed out")), TIMEOUT_MS);
    socket.once("connect", () => {
      clearTimeout(timer);
      resolve();
    });
    socket.once("connect_error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    socket.connect();
  });
}

function waitFor(socket, eventName, predicate = () => true) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timed out waiting for ${eventName}`)),
      TIMEOUT_MS
    );

    const handler = (payload) => {
      if (!predicate(payload)) return;
      clearTimeout(timer);
      socket.off(eventName, handler);
      resolve(payload);
    };

    socket.on(eventName, handler);
  });
}

async function addSong(socket, song) {
  const addedPromise = waitFor(
    socket,
    "song-added",
    (payload) => payload.youtubeVideoId === song.youtubeVideoId
  );
  socket.emit("add-song", song);
  return addedPromise;
}

async function addSongExpectingError(socket, song) {
  const errorPromise = waitFor(socket, "error");
  socket.emit("add-song", song);
  const error = await errorPromise;
  return error.message;
}

async function voteAll(clients, addedSongs) {
  const clientList = [clients.host, clients.ada, clients.ben];
  const reactions = ["fire", "heart", "meh"];

  for (let i = 0; i < clientList.length; i++) {
    for (const song of addedSongs) {
      clientList[i].socket.emit("react-to-song", {
        songId: song.id,
        reaction: reactions[i],
      });
    }
  }

  await new Promise((resolve) => setTimeout(resolve, 500));
  return clients.host.state.leaderboard;
}

function summarizeLeaderboard(leaderboard) {
  return [...leaderboard]
    .sort((a, b) => (b.totalScore ?? 0) - (a.totalScore ?? 0))
    .map((song) => ({
      title: song.title,
      addedByName: song.addedByName,
      totalScore: song.totalScore,
      reactionCount: song.reactionCount,
      reactionBreakdown: song.reactionBreakdown,
    }));
}

function disconnectAll(clients) {
  for (const client of [clients.host, clients.ada, clients.ben]) {
    client.socket.disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

