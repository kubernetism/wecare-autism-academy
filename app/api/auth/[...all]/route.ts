import { getAuth } from "@/server/auth";

// Better Auth's HTTP endpoints (sign-in, sign-up, sign-out, session).
export async function GET(request: Request) {
  return getAuth().handler(request);
}

export async function POST(request: Request) {
  return getAuth().handler(request);
}
