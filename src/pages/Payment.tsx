import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { AppHeader } from "@/components/Navigation/AppHeader";
import { useState } from "react";

const PaymentPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  
  const { plan, returnUrl } = location.state || {};

  if (!plan) {
    navigate('/pricing');
    return null;
  }

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);

    try {
      // TODO: Integrate with your payment gateway here
      // Simulating payment processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      toast({
        title: "Payment Successful! 🎉",
        description: `You now have access to ${plan.voices} voice clones!`,
      });

      // Navigate back to the return URL or stories page
      navigate(returnUrl || '/stories');
    } catch (error) {
      toast({
        title: "Payment Failed",
        description: "There was an error processing your payment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary/20 via-accent/20 to-primary/20">
      <AppHeader title="Complete Payment" showBackButton />
      <div className="max-w-md mx-auto p-4">
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl font-fredoka text-primary">
              Complete Your Purchase
            </CardTitle>
            <CardDescription>
              {plan.name} Plan - ${plan.price}/month
            </CardDescription>
          </CardHeader>

          <form onSubmit={handlePayment}>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="cardName">Name on Card</Label>
                <Input id="cardName" placeholder="John Doe" required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cardNumber">Card Number</Label>
                <Input 
                  id="cardNumber" 
                  placeholder="4242 4242 4242 4242"
                  required
                  pattern="[0-9\s]{13,19}"
                  maxLength={19}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="expiry">Expiry Date</Label>
                  <Input 
                    id="expiry" 
                    placeholder="MM/YY"
                    required
                    pattern="(0[1-9]|1[0-2])\/([0-9]{2})"
                    maxLength={5}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cvc">CVC</Label>
                  <Input 
                    id="cvc" 
                    placeholder="123"
                    required
                    pattern="[0-9]{3,4}"
                    maxLength={4}
                  />
                </div>
              </div>

              <div className="rounded-lg bg-secondary/10 p-4">
                <div className="flex justify-between mb-2">
                  <span>Plan Price</span>
                  <span>${plan.price}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span>Total</span>
                  <span className="text-primary">${plan.price}/month</span>
                </div>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-4">
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-primary to-secondary text-white"
                disabled={isProcessing}
              >
                {isProcessing ? "Processing..." : `Pay $${plan.price}`}
              </Button>
              <p className="text-sm text-muted-foreground text-center">
                Your payment is secure and encrypted
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default PaymentPage;