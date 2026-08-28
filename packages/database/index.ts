import { PrismaClient } from "@prisma/client";

const prismaClientSingleton = () => {
  return new PrismaClient({
    log:
      process.env.NODE_ENV === "production"
        ? ["error", "warn"]
        : ["query", "error", "warn"],
  });
};

declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>;
}

// In production (serverless), always create a new client to avoid stale connections.
// In development, reuse the global to avoid exhausting connections on HMR.
export const db =
  process.env.NODE_ENV === "production"
    ? prismaClientSingleton()
    : (globalThis.prismaGlobal ?? prismaClientSingleton());

if (process.env.NODE_ENV !== "production") globalThis.prismaGlobal = db;

export * from "@prisma/client";
