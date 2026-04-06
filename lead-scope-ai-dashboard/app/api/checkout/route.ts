import { NextRequest, NextResponse } from 'next/server'
import { withGuard, type GuardedRequest } from '@/lib/api-guard'
import Stripe from 'stripe'

// Plan configuration
const plans = {
  starter: {
    priceId: process.env.STRIPE_PRICE_STARTER || process.env.STRIPE_PRICE_ID_STARTER || '',
    mode: 'subscription' as const,
  },
  pro: {
    priceId: process.env.STRIPE_PRICE_PROFESSIONAL || process.env.STRIPE_PRICE_ID_PRO || '',
    mode: 'subscription' as const,
  },
  agency: {
    priceId: process.env.STRIPE_PRICE_AGENCY || '',
    mode: 'subscription' as const,
  },
}

export const POST = withGuard(async (request: GuardedRequest) => {
  try {
    const secretKey = process.env.STRIPE_SECRET_KEY
    if (!secretKey) {
      return NextResponse.json(
        { error: 'Stripe is not configured' },
        { status: 503 }
      )
    }

    const stripe = new Stripe(secretKey, {
      apiVersion: '2025-12-15.clover',
    })
    // User and permissions already validated by guard
    const user = request.user

    const body = await request.json()
    const { planId } = body

    if (!planId) {
      return NextResponse.json(
        { error: 'Missing planId' },
        { status: 400 }
      )
    }

    // Use user.id from guard (never trust client payload)
    const userId = user.id
    // Remove userId from body if present - we use authenticated user ID

    const plan = plans[planId as keyof typeof plans]
    if (!plan) {
      return NextResponse.json(
        { error: 'Invalid plan ID' },
        { status: 400 }
      )
    }
    if (!plan.priceId) {
      return NextResponse.json(
        { error: 'Stripe price ID not configured for this plan' },
        { status: 400 }
      )
    }

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: plan.priceId,
          quantity: 1,
        },
      ],
      mode: plan.mode,
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/billing?canceled=true`,
      client_reference_id: userId,
      metadata: {
        planId,
        userId,
      },
    })

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
    })
  } catch (error: any) {
    console.error('Stripe checkout error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create checkout session' },
      { status: 500 }
    )
  }
})
