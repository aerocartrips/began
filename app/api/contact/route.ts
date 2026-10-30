import { NextResponse, type NextRequest } from "next/server";
import { checkContactRateLimit, recordContactMessage } from "@/features/messages/rate-limit";
import { createContactMessage } from "@/features/messages/service/contact-messages";
import { validateContactMessage } from "@/features/messages/validation/contact-message";

const MAX_REQUEST_BYTES = 16 * 1024;

function getClientAddress(request: NextRequest) {
  const forwarded = request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for");
  const candidate = forwarded?.split(",")[0]?.trim() ?? "unknown";
  return /^[\da-fA-F.:]{1,64}$/.test(candidate) ? candidate : "unknown";
}

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_REQUEST_BYTES) {
    return NextResponse.json({ error: "Your message is too large." }, { status: 413 });
  }

  let payload: unknown;
  try {
    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, "utf8") > MAX_REQUEST_BYTES) {
      return NextResponse.json({ error: "Your message is too large." }, { status: 413 });
    }
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "We could not read your message. Please try again." }, { status: 400 });
  }

  if (typeof payload === "object" && payload !== null && "website" in payload && payload.website) {
    return NextResponse.json({ error: "We could not accept this message." }, { status: 400 });
  }

  const validation = validateContactMessage(payload);
  if (!validation.ok) {
    return NextResponse.json({ errors: validation.errors }, { status: 400 });
  }

  const clientAddress = getClientAddress(request);
  const rateLimit = checkContactRateLimit(clientAddress);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many messages were sent. Please wait before trying again." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } },
    );
  }

  try {
    const savedMessage = await createContactMessage(validation.data);
    if (process.env.MONGODB_URI?.trim()) {
      try {
        const { connectDB } = await import("@/lib/db/connect");
        const { createSupportConversationFromContact } = await import(
          "@/lib/services/support-messages.service"
        );
        await connectDB();
        await createSupportConversationFromContact(validation.data);
      } catch {
        // JSON store remains source of truth if Mongo write fails.
      }
    }
    recordContactMessage(clientAddress);
    const { notifyContactMessage } = await import("@/lib/services/email.service");
    notifyContactMessage({
      name: validation.data.name,
      email: validation.data.email,
      subject: validation.data.subject,
      messageId: savedMessage.id,
    }).catch(() => undefined);
    return NextResponse.json({ success: true, messageId: savedMessage.id }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "We could not save your message right now. Please try again later." },
      { status: 503 },
    );
  }
}