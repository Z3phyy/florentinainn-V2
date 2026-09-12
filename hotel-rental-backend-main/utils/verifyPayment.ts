interface VerifiedPayment {
  bookingId?: string;
  amountCents: number;
  paid: boolean;
}

function paymongoBasicAuth(secret: string): string {
  return "Basic " + Buffer.from(secret + ":").toString("base64");
}

export async function verifyStripeSession(sessionId: string): Promise<VerifiedPayment> {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    throw new Error("STRIPE_SECRET_KEY is not configured on the server");
  }

  const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });

  if (!res.ok) {
    throw new Error("Stripe session verification failed");
  }

  const session = await res.json();
  return {
    bookingId: session?.metadata?.bookingId,
    amountCents: Number(session?.amount_total || 0),
    paid: session?.payment_status === "paid",
  };
}

export async function verifyPaymongoSession(sessionId: string): Promise<VerifiedPayment> {
  const secret = process.env.PAYMONGO_SECRET_KEY;
  if (!secret) {
    throw new Error("PAYMONGO_SECRET_KEY is not configured on the server");
  }

  const res = await fetch(`https://api.paymongo.com/v1/checkout_sessions/${encodeURIComponent(sessionId)}`, {
    headers: { Authorization: paymongoBasicAuth(secret) },
  });

  if (!res.ok) {
    throw new Error("PayMongo session verification failed");
  }

  const body = await res.json();
  const attrs = body?.data?.attributes;
  return {
    bookingId: attrs?.metadata?.bookingId,
    amountCents: Number(attrs?.amount || 0),
    paid: attrs?.payment_status === "paid",
  };
}

export async function verifyOnlinePayment(
  gateway: string,
  sessionId: string
): Promise<VerifiedPayment> {
  if (gateway === "stripe") {
    return verifyStripeSession(sessionId);
  }
  if (gateway === "paymongo") {
    return verifyPaymongoSession(sessionId);
  }
  throw new Error("Unsupported payment gateway");
}