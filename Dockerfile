FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Install dependencies
RUN cd backend && npm install && cd ../frontend && npm install && cd .. && npm install

# Copy source code
COPY . .

# Generate Prisma client and push schema
RUN cd backend && npx prisma generate

# Build frontend
RUN cd frontend && npx vite build

# Expose ports
EXPOSE 3000

# Start backend (serves API + Socket.IO, frontend is built static)
CMD ["sh", "-c", "cd backend && npx prisma db push --skip-generate && npx tsx src/index.ts"]
