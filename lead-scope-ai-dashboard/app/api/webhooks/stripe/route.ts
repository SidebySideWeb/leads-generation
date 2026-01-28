/**
 * Hardened Stripe Webhook Handler
 * 
 * Security:
 * - Webhook signature verification (required)
 * - Never trusts client input
 * - Webhook is the only plan authority
 * 
 * Handles:
 * - checkout.session.completed
 * - customer.subscription.updated
 * - customer.subscription.deleted
 * 
 * On cancellation or past_due: downgrades user to demo immediately
 */

import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'

// Initialize database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

// Plan mapping from Stripe price IDs
function mapStripePriceToPlan(priceId: string | null | undefined): 'demo' | 'starter' | 'pro' {
  if (!priceId) return 'demo'

  const priceStarter = process.env.STRIPE_PRICE_STARTER
  const pricePro = process.env.STRIPE_PRICE_PROFESSIONAL
  const priceAgency = process.env.STRIPE_PRICE_AGENCY

  if (priceStarter && priceId === priceStarter) return 'starter'
  if (pricePro && priceId === pricePro) return 'pro'
  if (priceAgency && priceId === priceAgency) return 'pro' // Agency maps to pro

  console.warn(`[webhook] Unknown price ID: ${priceId}, defaulting to demo`)
  return 'demo'
}

// Upsert subscription
async function upsertSubscription(data: {
  user_id: string
  stripe_customer_id: string
  stripe_subscription_id: string
  plan: 'demo' | 'starter' | 'pro'
  status: string
  stripe_price_id?: string | null
  current_period_start?: Date | null
  current_period_end?: Date | null
  canceled_at?: Date | null
}): Promise<void> {
  await pool.query(
    `
    INSERT INTO subscriptions (
      user_id, stripe_customer_id, stripe_subscription_id, plan, status,
      stripe_price_id, current_period_start, current_period_end, canceled_at, updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
    ON CONFLICT (stripe_subscription_id)
    DO UPDATE SET
      user_id = EXCLUDED.user_id,
      stripe_customer_id = EXCLUDED.stripe_customer_id,
      plan = EXCLUDED.plan,
      status = EXCLUDED.status,
      stripe_price_id = EXCLUDED.stripe_price_id,
      current_period_start = EXCLUDED.current_period_start,
      current_period_end = EXCLUDED.current_period_end,
      canceled_at = EXCLUDED.canceled_at,
      updated_at = NOW()
    `,
    [
      data.user_id,
      data.stripe_customer_id,
      data.stripe_subscription_id,
      data.plan,
      data.status,
      data.stripe_price_id || null,
      data.current_period_start || null,
      data.current_period_end || null,
      data.canceled_at || null,
    ]
  )
}

// Downgrade user to demo
async function downgradeUserToDemo(userId: string): Promise<void> {
  await pool.query(
    `
    UPDATE subscriptions
    SET status = 'canceled', updated_at = NOW()
    WHERE user_id = $1 AND status IN ('active', 'trialing', 'past_due')
    `,
    [userId]
  )
  console.log(`[webhook] Downgraded user ${userId} to demo plan`)
}

// Get subscription by Stripe ID
async function getSubscriptionByStripeId(stripeSubscriptionId: string): Promise<{ user_id: string } | null> {
  const result = await pool.query<{ user_id: string }>(
    'SELECT user_id FROM subscriptions WHERE stripe_subscription_id = $1',
    [stripeSubscriptionId]
  )
  return result.rows[0] || null
}

import Stripe from 'stripe'

function getStripeAndSecret() {
  const secretKey = process.env.STRIPE_SECRET_KEY
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!secretKey || !webhookSecret) {
    console.error('Stripe webhook environment variables are not fully configured.')
    return { stripe: null as Stripe | null, webhookSecret: null as string | null }
  }

  const stripe = new Stripe(secretKey, {
    apiVersion: '2025-12-15.clover',
  })

  return { stripe, webhookSecret }
}

/**
 * POST /api/webhooks/stripe
 * 
 * Handles Stripe webhook events with hardened security.
 * Webhook signature verification is required.
 */
export async function POST(request: NextRequest) {
  const { stripe, webhookSecret } = getStripeAndSecret()
  if (!stripe || !webhookSecret) {
    return NextResponse.json(
      { error: 'Stripe webhook is not configured' },
      { status: 503 }
    )
  }
  // Read raw body (required for signature verification)
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  // Security: Require signature
  if (!signature) {
    console.error('[webhook] Missing stripe-signature header')
    return NextResponse.json(
      { error: 'Missing signature' },
      { status: 400 }
    )
  }

  // Security: Verify webhook signature (never trust unverified events)
  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err: any) {
    console.error('[webhook] Signature verification failed:', err.message)
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${err.message}` },
      { status: 400 }
    )
  }

  // Handle the event (webhook is authoritative - never trust client input)
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        
        // Extract user ID from metadata (webhook is authoritative)
        const userId = session.metadata?.userId || session.client_reference_id
        if (!userId) {
          throw new Error('User ID not found in checkout session')
        }

        // For subscription mode, get the subscription
        if (session.mode === 'subscription' && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(
            session.subscription as string
          ) as Stripe.Subscription

          // Map price ID to plan (webhook is authoritative)
          const priceId = subscription.items.data[0]?.price.id
          const plan = mapStripePriceToPlan(priceId)

          // Get customer ID
          const customerId = typeof subscription.customer === 'string'
            ? subscription.customer
            : subscription.customer.id

          // Persist subscription
          await upsertSubscription({
            user_id: userId,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscription.id,
            plan,
            status: subscription.status,
            stripe_price_id: priceId,
            // Some Stripe API versions omit these fields; use null-safe defaults.
            current_period_start: null,
            current_period_end: null,
            canceled_at: subscription.canceled_at
              ? new Date(subscription.canceled_at * 1000)
              : null,
          })

          console.log(`[webhook] Checkout completed: subscription ${subscription.id} for user ${userId}, plan: ${plan}`)
        } else if (session.mode === 'payment') {
          // One-time payment (snapshot) - no subscription to create
          console.log(`[webhook] One-time payment completed for user ${userId}`)
        }
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        
        // Extract user ID from metadata (webhook is authoritative)
        let userId = subscription.metadata?.userId
        
        if (!userId) {
          // Try to find existing subscription
          const existing = await getSubscriptionByStripeId(subscription.id)
          if (!existing) {
            throw new Error('User ID not found and subscription does not exist')
          }
          userId = existing.user_id
        }

        // Map price ID to plan
        const priceId = subscription.items.data[0]?.price.id
        const plan = mapStripePriceToPlan(priceId)

        // Get customer ID
        const customerId = typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer.id

        // Check if subscription is canceled or past_due - downgrade to demo immediately
        if (subscription.status === 'canceled' || subscription.status === 'past_due') {
          await downgradeUserToDemo(userId)
          console.log(`[webhook] Subscription ${subscription.status}, downgraded user ${userId} to demo`)
        }

        // Persist subscription update
        await upsertSubscription({
          user_id: userId,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscription.id,
          plan,
          status: subscription.status,
          stripe_price_id: priceId,
          current_period_start: null,
          current_period_end: null,
          canceled_at: subscription.canceled_at
            ? new Date(subscription.canceled_at * 1000)
            : null,
        })

        // Regenerate JWT token with updated plan
        const { regenerateTokenForUser } = await import('@/lib/jwt-regeneration')
        const newToken = await regenerateTokenForUser(userId)
        if (newToken) {
          // Note: We can't set cookie in webhook handler directly
          // Token will be regenerated on next request via getServerUser()
          console.log(`[webhook] JWT token will be regenerated on next request for user ${userId}`)
        }

        console.log(`[webhook] Subscription updated: ${subscription.id} for user ${userId}, plan: ${plan}, status: ${subscription.status}`)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        
        // Extract user ID from metadata (webhook is authoritative)
        let userId = subscription.metadata?.userId
        
        if (!userId) {
          // Try to find existing subscription
          const existing = await getSubscriptionByStripeId(subscription.id)
          if (!existing) {
            console.error('[webhook] Subscription deleted but user ID not found')
            // Still return success to avoid retries
            return NextResponse.json({ received: true })
          }
          userId = existing.user_id
        }

        // Downgrade user to demo immediately
        await downgradeUserToDemo(userId)
        
        // Update subscription status
        await pool.query(
          `UPDATE subscriptions
           SET status = 'canceled', canceled_at = NOW(), updated_at = NOW()
           WHERE stripe_subscription_id = $1`,
          [subscription.id]
        )

        // Regenerate JWT token with updated plan (demo)
        const { regenerateTokenForUser } = await import('@/lib/jwt-regeneration')
        const newToken = await regenerateTokenForUser(userId)
        if (newToken) {
          // Note: We can't set cookie in webhook handler directly
          // Token will be regenerated on next request via getServerUser()
          console.log(`[webhook] JWT token will be regenerated on next request for user ${userId}`)
        }

        console.log(`[webhook] Subscription deleted: ${subscription.id} for user ${userId}, downgraded to demo`)
        break
      }

      default:
        // Log unhandled events but don't fail
        console.log(`[webhook] Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error: any) {
    console.error('[webhook] Handler error:', error)
    // Return 500 so Stripe will retry
    return NextResponse.json(
      { error: 'Webhook handler failed', message: error.message },
      { status: 500 }
    )
  }
}
