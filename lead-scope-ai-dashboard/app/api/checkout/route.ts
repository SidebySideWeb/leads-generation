import { NextRequest, NextResponse } from 'next/server'
import { withGuard, type GuardedRequest } from '@/lib/api-guard'
import Stripe from 'stripe'

// Plan configuration
const plans = {
  snapshot: {
    priceId: process.env.STRIPE_PRICE_SNAPSHOT || 'price_snapshot', // You'll need to create these in Stripe
    amount: 3000, // €30.00 in cents
  },
  professional: {
    priceId: process.env.STRIPE_PRICE_PROFESSIONAL || 'price_professional',
    amount: 9900, // €99.00 in cents
  },
  agency: {
    priceId: process.env.STRIPE_PRICE_AGENCY || 'price_agency',
    amount: 29900, // €299.00 in cents
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

    const plan = plans[planId as keyof typeof plans]
    if (!plan) {
      return NextResponse.json(
        { error: 'Invalid plan ID' },
        { status: 400 }
      )
    }

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: `${planId === 'snapshot' ? 'Snapshot' : planId === 'professional' ? 'Professional' : 'Agency'} Plan`,
              description: planId === 'snapshot' 
                ? 'One-time export, no updates'
                : planId === 'professional'
                ? 'Monthly subscription for growing teams'
                : 'Monthly subscription for agencies',
            },
            unit_amount: plan.amount,
            recurring: planId === 'snapshot' ? undefined : {
              interval: 'month',
            },
          },
          quantity: 1,
        },
      ],
      mode: planId === 'snapshot' ? 'payment' : 'subscription',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/(dashboard)/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/(dashboard)/billing?canceled=true`,
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
