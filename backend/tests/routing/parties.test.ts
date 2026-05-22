import { describe, it, expect, beforeEach, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import router from "../../src/routing/parties.js";
import { prisma } from "../../src/models/db.js";

const app = express();
app.use(express.json());
app.use("/api/parties", router);

beforeEach(async () => {
  // Clean up all data between tests (order matters due to foreign keys)
  await prisma.vote.deleteMany();
  await prisma.chatMessage.deleteMany();
  await prisma.song.deleteMany();
  await prisma.participant.deleteMany();
  await prisma.party.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("POST /api/parties", () => {
  it("creates a party with valid data and returns code + hostToken", async () => {
    const res = await request(app)
      .post("/api/parties")
      .send({
        name: "Friday Night Jams",
        hostName: "DJ Nick",
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("code");
    expect(res.body).toHaveProperty("hostToken");
    expect(res.body.code).toMatch(/^[A-Z0-9]{6}$/);
    expect(typeof res.body.hostToken).toBe("string");
    expect(res.body.hostToken.length).toBeGreaterThan(0);
  });

  it("rejects missing name", async () => {
    const res = await request(app)
      .post("/api/parties")
      .send({
        hostName: "DJ Nick",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/name/i);
  });

  it("rejects name over 100 chars", async () => {
    const res = await request(app)
      .post("/api/parties")
      .send({
        name: "A".repeat(101),
        hostName: "DJ Nick",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/name/i);
  });
});

describe("GET /api/parties/:code", () => {
  it("returns party info for a valid code", async () => {
    // Create a party first
    const createRes = await request(app)
      .post("/api/parties")
      .send({
        name: "Chill Vibes",
        hostName: "Alice",
      });

    const { code } = createRes.body;

    const res = await request(app).get(`/api/parties/${code}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("name", "Chill Vibes");
    expect(res.body).toHaveProperty("hostName", "Alice");
    expect(res.body).toHaveProperty("status", "waiting");
    expect(res.body).toHaveProperty("participantCount", 0);
  });

  it("returns 404 for invalid code", async () => {
    const res = await request(app).get("/api/parties/ZZZZZZ");

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });
});

describe("POST /api/parties/:code/join", () => {
  let partyCode: string;

  beforeEach(async () => {
    const createRes = await request(app)
      .post("/api/parties")
      .send({
        name: "Join Test Party",
        hostName: "Host",
      });
    partyCode = createRes.body.code;
  });

  it("joins with valid data", async () => {
    const res = await request(app)
      .post(`/api/parties/${partyCode}/join`)
      .send({
        name: "Bob",
        clientToken: "token-abc-123",
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("participantId");
    expect(res.body).toHaveProperty("partyCode", partyCode);
  });

  it("rejects when party is ended", async () => {
    // Manually set party status to ended
    await prisma.party.update({
      where: { code: partyCode },
      data: { status: "ended" },
    });

    const res = await request(app)
      .post(`/api/parties/${partyCode}/join`)
      .send({
        name: "Late Joiner",
        clientToken: "token-late",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/ended/i);
  });

  it("reconnects existing participant with same clientToken", async () => {
    // First join
    const firstJoin = await request(app)
      .post(`/api/parties/${partyCode}/join`)
      .send({
        name: "Charlie",
        clientToken: "token-reconnect",
      });

    expect(firstJoin.status).toBe(201);
    const participantId = firstJoin.body.participantId;

    // Second join with same clientToken (reconnection)
    const secondJoin = await request(app)
      .post(`/api/parties/${partyCode}/join`)
      .send({
        name: "Charlie Updated",
        clientToken: "token-reconnect",
      });

    // Reconnection returns 200, not 201
    expect(secondJoin.status).toBe(200);
    expect(secondJoin.body.participantId).toBe(participantId);
    expect(secondJoin.body.partyCode).toBe(partyCode);
  });
});
