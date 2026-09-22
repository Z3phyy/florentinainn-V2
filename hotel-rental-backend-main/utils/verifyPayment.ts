interface VerifiedPayment {
  bookingId?: string;
  amountCents: number;
  paid: boolean;
  status: "succeeded" | "pending" | "failed";
}

function paymongoBasicAuth(secret: string): string {
  return "Basic " + Buffer.from(secret + ":").toString("base64");
}

export async function verifyStripeSession(
  sessionId: string,
): Promise<VerifiedPayment> {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    throw new Error("STRIPE_SECRET_KEY is not configured on the server");
  }

  const res = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
    {
      headers: { Authorization: `Bearer ${secret}` },
    },
  );

  if (!res.ok) {
    throw new Error("Stripe session verification failed");
  }

  const session = await res.json();
  const paid = session?.payment_status === "paid";
  return {
    bookingId: session?.metadata?.bookingId,
    amountCents: Number(session?.amount_total || 0),
    paid,
    status: paid ? "succeeded" : "pending",
  };
}

async function fetchPaymongoSessionOnce(
  sessionId: string,
  secret: string,
): Promise<VerifiedPayment> {
  const res = await fetch(
    `https://api.paymongo.com/v1/checkout_sessions/${encodeURIComponent(sessionId)}`,
    {
      headers: { Authorization: paymongoBasicAuth(secret) },
    },
  );

  if (!res.ok) {
    throw new Error("PayMongo session verification failed");
  }

  const body = await res.json();
  const attrs = body?.data?.attributes;

  const paymentIntentAttrs = attrs?.payment_intent?.attributes;
  const payments: any[] = Array.isArray(attrs?.payments) ? attrs.payments : [];
  const hasPaidPayment = payments.some((p) => p?.attributes?.status === "paid");

  const intentStatus: string | undefined = paymentIntentAttrs?.status;
  const paid = intentStatus === "succeeded" || hasPaidPayment;

  let status: VerifiedPayment["status"] = "pending";
  if (paid) {
    status = "succeeded";
  } else if (
    intentStatus === "awaiting_payment_method" &&
    paymentIntentAttrs?.last_payment_error
  ) {
    status = "failed";
  } else if (attrs?.status === "expired") {
    status = "failed";
  }

  const amountCents = Number(
    paymentIntentAttrs?.amount ?? payments[0]?.attributes?.amount ?? 0,
  );

  return {
    bookingId: attrs?.metadata?.bookingId,
    amountCents,
    paid,
    status,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function verifyPaymongoSession(
  sessionId: string,
): Promise<VerifiedPayment> {
  const secret = process.env.PAYMONGO_SECRET_KEY;
  if (!secret) {
    throw new Error("PAYMONGO_SECRET_KEY is not configured on the server");
  }

  const maxAttempts = 3;
  let result: VerifiedPayment | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    result = await fetchPaymongoSessionOnce(sessionId, secret);
    if (result.status !== "pending" || attempt === maxAttempts) {
      break;
    }
    await sleep(1500);
  }

  return result as VerifiedPayment;
}

export async function verifyOnlinePayment(
  gateway: string,
  sessionId: string,
): Promise<VerifiedPayment> {
  if (gateway === "stripe") {
    return verifyStripeSession(sessionId);
  }
  if (gateway === "paymongo") {
    return verifyPaymongoSession(sessionId);
  }
  throw new Error("Unsupported payment gateway");
}
