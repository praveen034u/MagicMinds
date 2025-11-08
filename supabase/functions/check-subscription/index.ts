import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const { auth0_user_id, email } = await req.json();
    
    if (!auth0_user_id || !email) {
      throw new Error("Auth0 user ID and email are required");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Set the Auth0 user ID for RLS policies
    await supabaseClient.rpc('set_config', {
      setting: 'app.current_auth0_user_id',
      value: auth0_user_id
    });

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    
    logStep("Stripe key verified");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    
    logStep("Checking for customer", { email });
    
    const customers = await stripe.customers.list({ email: email, limit: 1 });
    
    if (customers.data.length === 0) {
      logStep("No customer found, updating unsubscribed state");
      
      // Update or create voice subscription record
      const { data: parentData } = await supabaseClient
        .from('parent_profiles')
        .select('id')
        .eq('auth0_user_id', auth0_user_id)
        .single();

      if (parentData) {
        await supabaseClient
          .from('voice_subscriptions')
          .upsert({
            parent_id: parentData.id,
            status: 'inactive',
            plan_type: 'basic'
          });
      }

      return new Response(JSON.stringify({ 
        subscribed: false,
        status: 'inactive',
        plan_type: 'basic'
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });
    
    const hasActiveSub = subscriptions.data.length > 0;
    let subscriptionEnd = null;
    let planType = 'basic';
    let stripeSubscriptionId = null;

    if (hasActiveSub) {
      const subscription = subscriptions.data[0];
      subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
      planType = 'premium'; // Voice cloning premium plan
      stripeSubscriptionId = subscription.id;
      logStep("Active subscription found", { subscriptionId: subscription.id, endDate: subscriptionEnd });
    } else {
      logStep("No active subscription found");
    }

    // Update voice subscription in database
    const { data: parentData } = await supabaseClient
      .from('parent_profiles')
      .select('id')
      .eq('auth0_user_id', auth0_user_id)
      .single();

    if (parentData) {
      await supabaseClient
        .from('voice_subscriptions')
        .upsert({
          parent_id: parentData.id,
          stripe_subscription_id: stripeSubscriptionId,
          stripe_customer_id: customerId,
          status: hasActiveSub ? 'active' : 'inactive',
          plan_type: planType
        });
    }

    return new Response(JSON.stringify({
      subscribed: hasActiveSub,
      status: hasActiveSub ? 'active' : 'inactive',
      plan_type: planType,
      subscription_end: subscriptionEnd
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in check-subscription", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});