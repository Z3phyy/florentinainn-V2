import { NextResponse } from "next/server";

const PAYMONGO_SECRET_KEY = process.env.PAYMONGO_SECRET_KEY!;

export async function POST(req: Request) {
  try {
    const { amount, bookingId, referenceId } = await req.json();

    const response = await fetch(
      "https://api.paymongo.com/v1/checkout_sessions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${Buffer.from(PAYMONGO_SECRET_KEY + ":").toString("base64")}`,
        },
        body: JSON.stringify({
          data: {
            attributes: {
              billing: {
                name: "Guest",
              },
              line_items: [
                {
                  currency: "PHP",
                  amount: amount,
                  name: "Booking Payment",
                  quantity: 1,
                },
              ],
              payment_method_types: ["gcash", "card"],
              success_url: `${process.env.NEXT_PUBLIC_BASE_URL_LIVE}/guest/clientPayment?bookingId=${bookingId}&amount=${amount / 100}&gateway=paymongo`,
              cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL_LIVE}/`,
              metadata: { bookingId },
              reference_number: referenceId,
            },
          },
        }),
      },
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("PayMongo error:", data);
      return NextResponse.json(
        { error: data.errors?.[0]?.detail || "Payment creation failed" },
        { status: response.status },
      );
    }

    const sessionId = data?.data?.id;
    const checkoutUrl = data?.data?.attributes?.checkout_url || "";

    if (!checkoutUrl || !sessionId) {
      return NextResponse.json(
        { error: "Payment session creation failed" },
        { status: 502 },
      );
    }

    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL_LIVE}/booking/reservation/session`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookingId, sessionId, gateway: "paymongo" }),
        },
      );
    } catch (linkError) {
      console.error("Failed to link PayMongo session to booking:", linkError);
    }

    return NextResponse.json({
      checkoutUrl,
      sessionId,
    });
  } catch (error: any) {
    console.error("PayMongo error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 },
    );
  }
}
