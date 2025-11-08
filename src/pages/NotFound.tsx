import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center p-4">
      <Card className="max-w-md mx-auto bg-white/95 shadow-xl">
        <CardHeader className="text-center">
          <div className="text-6xl mb-4">🤔</div>
          <CardTitle className="text-2xl font-fredoka text-primary">
            Oops! Page Not Found
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">
            Looks like you've wandered off the path! Don't worry, we'll help you get back to the fun.
          </p>
          
          <div className="space-y-2">
            <Button 
              onClick={() => navigate('/')}
              className="w-full bg-primary hover:bg-primary/90 text-white"
              size="lg"
            >
              Go Home 🏠
            </Button>
            <Button 
              onClick={() => navigate(-1)}
              variant="outline"
              className="w-full"
              size="lg"
            >
              Go Back ↩️
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default NotFound;