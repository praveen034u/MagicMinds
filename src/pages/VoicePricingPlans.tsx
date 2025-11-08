import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { AppHeader } from "@/components/Navigation/AppHeader";

interface PricingPlan {
  id: string;
  name: string;
  price: number;
  voices: number;
  features: string[];
  popular?: boolean;
}

const pricingPlans: PricingPlan[] = [
  {
    id: "starter",
    name: "Starter",
    price: 10,
    voices: 5,
    features: [
      "5 Custom Voice Clones",
      "High-quality voice synthesis",
      "Basic voice editing tools",
      "30-day voice storage",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: 15,
    voices: 10,
    features: [
      "10 Custom Voice Clones",
      "Premium voice quality",
      "Advanced voice editing",
      "60-day voice storage",
      "Priority support",
    ],
    popular: true,
  },
  {
    id: "ultimate",
    name: "Ultimate",
    price: 25,
    voices: 30,
    features: [
      "30 Custom Voice Clones",
      "Highest quality synthesis",
      "Professional editing suite",
      "Unlimited voice storage",
      "24/7 Priority support",
      "API Access",
    ],
  },
];

const VoicePricingPlans = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSelectPlan = (plan: PricingPlan) => {
    // TODO: Integrate with your payment gateway
    navigate('/payment', { 
      state: { 
        plan,
        returnUrl: '/stories' // Return to stories page after payment
      } 
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary/20 via-accent/20 to-primary/20">
      <AppHeader title="Voice Cloning Plans" showBackButton />
      <div className="max-w-6xl mx-auto p-4">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-fredoka font-bold text-primary mb-4">
            🎙️ Voice Cloning Plans
          </h1>
          <p className="text-xl text-muted-foreground">
            Choose the perfect plan for your storytelling needs
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {pricingPlans.map((plan) => (
            <Card
              key={plan.id}
              className={`relative overflow-hidden transition-all duration-300 transform hover:scale-105 ${
                plan.popular
                  ? "border-primary shadow-xl"
                  : "border-secondary/20"
              }`}
            >
              {plan.popular && (
                <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-4 py-1 rounded-bl-lg text-sm font-medium">
                  Most Popular
                </div>
              )}
              
              <CardHeader className="text-center pb-4">
                <CardTitle className="text-2xl font-fredoka text-primary">
                  {plan.name}
                </CardTitle>
                <CardDescription className="text-lg">
                  Perfect for {plan.voices} voices
                </CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold text-primary">${plan.price}</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
              </CardHeader>

              <CardContent className="text-center">
                <ul className="space-y-3">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-center justify-center gap-2">
                      <span className="text-primary">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter>
                <Button
                  onClick={() => handleSelectPlan(plan)}
                  className={`w-full ${
                    plan.popular
                      ? "bg-gradient-to-r from-primary to-secondary text-white"
                      : "bg-gradient-to-r from-secondary/80 to-primary/80 text-white"
                  }`}
                  size="lg"
                >
                  Choose {plan.name}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        <div className="text-center mt-12">
          <p className="text-sm text-muted-foreground">
            All plans include a 14-day money-back guarantee
          </p>
        </div>
      </div>
    </div>
  );
};

export default VoicePricingPlans;