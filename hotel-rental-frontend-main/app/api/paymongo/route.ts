import { NextResponse } from 'next/server';

const PAYMONGO_SECRET_KEY = process.env.PAYMONGO_SECRET_KEY!;

export async function POST(req: Request) {
  try {
    const { amount, bookingId, referenceId } = await req.json();

    const response = await fetch('https://api.paymongo.com/v1/checkout_sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(PAYMONGO_SECRET_KEY + ':').toString('base64')}`,
      },
      body: JSON.stringify({
        data: {
          attributes: {
            billing: {
              name: 'Guest',
            },
            line_items: [{
              currency: 'PHP',
              amount: amount,
              name: 'Booking Payment',
              quantity: 1,
            }],
            payment_method_types: ['gcash', 'card'],
            success_url: `${process.env.NEXT_PUBLIC_BASE_URL_LIVE}/guest/clientPayment?bookingId=${bookingId}&amount=${amount/100}&gateway=paymongo`,
            cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL_LIVE}/`,
            metadata: { bookingId },
            reference_number: referenceId,
          },
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('PayMongo error:', data);
      return NextResponse.json(
        { error: data.errors?.[0]?.detail || 'Payment creation failed' },
        { status: response.status }
      );
    }

    const sessionId = data?.data?.id;

    const successUrl = `${process.env.NEXT_PUBLIC_BASE_URL_LIVE}/guest/clientPayment?bookingId=${bookingId}&amount=${amount/100}&gateway=paymongo${
      sessionId ? `&session_id=${sessionId}` : ""
    }`;

    const checkoutUrl = data?.data?.attributes?.checkout_url || "";
    const separator = checkoutUrl.includes("?") ? "&" : "?";
    const redirectUrl = `${checkoutUrl}${separator}redirect_url=${encodeURIComponent(successUrl)}`;

    return NextResponse.json({
      checkoutUrl: redirectUrl,
    });
  } catch (error: any) {
    console.error('PayMongo error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
