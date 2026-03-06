import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-02-25.clover',
});

// POST /api/stripe/checkout
// Body: { priceId: string; userId: string; userEmail: string }
export async function POST(request: NextRequest) {
  try {
    const { priceId, userId, userEmail } = (await request.json()) as {
      priceId: string;
      userId: string;
      userEmail: string;
    };

    if (!priceId || !userId || !userEmail) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const origin = request.headers.get('origin') ?? 'https://twine.hk';

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: userEmail,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/profile?upgraded=true`,
      cancel_url:  `${origin}/profile`,
      metadata: { userId },
      subscription_data: {
        metadata: { userId },
      },
    });

    return NextResponse.json({ checkoutUrl: session.url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Stripe error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
