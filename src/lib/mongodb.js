import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;

let client;
let clientPromise;

if (!uri) {
  throw new Error("MONGODB_URI не задан в .env.local");
}

if (process.env.NODE_ENV === "development") {
  if (!globalThis._mongoClientPromise) {
    client = new MongoClient(uri);
    globalThis._mongoClientPromise = client.connect();
  }
  clientPromise = globalThis._mongoClientPromise;
} else {
  client = new MongoClient(uri);
  clientPromise = client.connect();
}

export async function getDb() {
  const c = await clientPromise;
  return c.db();
}

export default clientPromise;
