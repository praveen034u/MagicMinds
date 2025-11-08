import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAppAuth } from "@/contexts/Auth0Context";
import { BookOpen, Gamepad2, Trophy, Sparkles, Users, Brain } from "lucide-react";

const Landing = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, loginWithRedirect } = useAppAuth();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate('/profile', { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  const handleGetStarted = () => {
    if (isAuthenticated) {
      navigate('/profile');
    } else {
      loginWithRedirect();
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/20 via-secondary/20 to-accent/20">
        <div className="text-2xl font-fredoka text-primary animate-pulse">Loading... 🎮</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/20 via-secondary/20 to-accent/20">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="container mx-auto px-4 py-20 text-center">
          <div className="mb-8 animate-fade-in">
            <h1 className="text-6xl md:text-7xl font-fredoka font-bold text-primary mb-4 tracking-tight">
              🌟 StoryTeller Kids
            </h1>
            <p className="text-2xl md:text-3xl text-muted-foreground font-medium mb-2">
              Where Stories Come Alive
            </p>
            <p className="text-xl text-muted-foreground">
              Interactive storytelling & educational games for curious minds
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16 animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <Button 
              onClick={handleGetStarted}
              size="lg"
              className="text-lg px-8 py-6 bg-primary hover:bg-primary/90 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
            >
              <Sparkles className="w-5 h-5 mr-2" />
              Get Started Free
            </Button>
            <Button 
              onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
              size="lg"
              variant="outline"
              className="text-lg px-8 py-6 border-2 hover:bg-primary/10 transition-all duration-300"
            >
              Learn More
            </Button>
          </div>

          {/* Feature Highlights */}
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto animate-fade-in" style={{ animationDelay: '0.4s' }}>
            <Card className="bg-white/80 backdrop-blur-sm border-2 hover:shadow-xl transition-all duration-300 hover:scale-105">
              <CardContent className="p-6 text-center">
                <div className="text-4xl mb-3">📚</div>
                <h3 className="font-fredoka text-xl font-bold text-primary mb-2">
                  Personalized Stories
                </h3>
                <p className="text-sm text-muted-foreground">
                  AI-generated tales tailored to your child's interests
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm border-2 hover:shadow-xl transition-all duration-300 hover:scale-105">
              <CardContent className="p-6 text-center">
                <div className="text-4xl mb-3">🎮</div>
                <h3 className="font-fredoka text-xl font-bold text-primary mb-2">
                  Fun Learning Games
                </h3>
                <p className="text-sm text-muted-foreground">
                  Educational challenges that make learning exciting
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm border-2 hover:shadow-xl transition-all duration-300 hover:scale-105">
              <CardContent className="p-6 text-center">
                <div className="text-4xl mb-3">👥</div>
                <h3 className="font-fredoka text-xl font-bold text-primary mb-2">
                  Multiplayer Fun
                </h3>
                <p className="text-sm text-muted-foreground">
                  Play and learn together with friends online
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Decorative Elements */}
        <div className="absolute top-10 left-10 text-6xl animate-bounce opacity-20">✨</div>
        <div className="absolute top-20 right-20 text-6xl animate-pulse opacity-20">🎨</div>
        <div className="absolute bottom-10 left-1/4 text-6xl animate-bounce opacity-20" style={{ animationDelay: '1s' }}>🚀</div>
        <div className="absolute bottom-20 right-1/3 text-6xl animate-pulse opacity-20" style={{ animationDelay: '1.5s' }}>🌈</div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-white/50 backdrop-blur-sm">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl md:text-5xl font-fredoka font-bold text-center text-primary mb-4">
            Everything Your Child Needs to Learn & Play
          </h2>
          <p className="text-center text-muted-foreground text-lg mb-16 max-w-2xl mx-auto">
            A comprehensive platform designed to nurture creativity, critical thinking, and social skills
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <Card className="bg-white border-2 hover:shadow-xl transition-all duration-300 hover:scale-105">
              <CardContent className="p-8">
                <BookOpen className="w-12 h-12 text-primary mb-4" />
                <h3 className="font-fredoka text-2xl font-bold text-primary mb-3">
                  Interactive Stories
                </h3>
                <p className="text-muted-foreground">
                  Immersive narratives with beautiful illustrations that adapt to your child's age and reading level.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white border-2 hover:shadow-xl transition-all duration-300 hover:scale-105">
              <CardContent className="p-8">
                <Brain className="w-12 h-12 text-primary mb-4" />
                <h3 className="font-fredoka text-2xl font-bold text-primary mb-3">
                  Brain Teasers
                </h3>
                <p className="text-muted-foreground">
                  Challenging riddles and puzzles that enhance problem-solving and critical thinking skills.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white border-2 hover:shadow-xl transition-all duration-300 hover:scale-105">
              <CardContent className="p-8">
                <Gamepad2 className="w-12 h-12 text-primary mb-4" />
                <h3 className="font-fredoka text-2xl font-bold text-primary mb-3">
                  Educational Games
                </h3>
                <p className="text-muted-foreground">
                  Multiple difficulty levels ensure every child finds the right challenge for their skill level.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white border-2 hover:shadow-xl transition-all duration-300 hover:scale-105">
              <CardContent className="p-8">
                <Users className="w-12 h-12 text-primary mb-4" />
                <h3 className="font-fredoka text-2xl font-bold text-primary mb-3">
                  Multiplayer Mode
                </h3>
                <p className="text-muted-foreground">
                  Connect with friends, create game rooms, and compete in real-time educational challenges.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white border-2 hover:shadow-xl transition-all duration-300 hover:scale-105">
              <CardContent className="p-8">
                <Trophy className="w-12 h-12 text-primary mb-4" />
                <h3 className="font-fredoka text-2xl font-bold text-primary mb-3">
                  Rewards System
                </h3>
                <p className="text-muted-foreground">
                  Earn stars, unlock achievements, and celebrate progress with our engaging reward system.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white border-2 hover:shadow-xl transition-all duration-300 hover:scale-105">
              <CardContent className="p-8">
                <Sparkles className="w-12 h-12 text-primary mb-4" />
                <h3 className="font-fredoka text-2xl font-bold text-primary mb-3">
                  Voice Cloning
                </h3>
                <p className="text-muted-foreground">
                  Premium feature: Hear stories in a familiar voice for an extra personal touch.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-3xl mx-auto bg-gradient-to-br from-primary/10 to-secondary/10 rounded-3xl p-12 border-2 border-primary/20 shadow-2xl">
            <h2 className="text-4xl md:text-5xl font-fredoka font-bold text-primary mb-6">
              Ready to Begin the Adventure?
            </h2>
            <p className="text-xl text-muted-foreground mb-8">
              Join thousands of families enjoying safe, educational entertainment
            </p>
            <Button 
              onClick={handleGetStarted}
              size="lg"
              className="text-xl px-10 py-7 bg-primary hover:bg-primary/90 text-white shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-110"
            >
              <Sparkles className="w-6 h-6 mr-2" />
              Start Your Free Journey
            </Button>
            <p className="text-sm text-muted-foreground mt-4">
              No credit card required • Safe & secure • Kid-friendly content
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 bg-white/30 backdrop-blur-sm border-t">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p className="text-sm">
            © 2025 StoryTeller Kids. Made with ❤️ for curious young minds.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
