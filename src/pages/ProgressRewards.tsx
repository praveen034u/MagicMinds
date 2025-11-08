import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAppContext } from "@/contexts/Auth0Context";
import { useProgress } from "@/contexts/ProgressContext";
import { format, subDays, startOfDay, isSameDay } from "date-fns";
import { AppHeader } from "@/components/Navigation/AppHeader";

const ProgressRewards = () => {
  const navigate = useNavigate();
  const { selectedChild } = useAppContext();
  const { progress } = useProgress();

  // Generate calendar for current month (simplified)
  const generateStreakCalendar = () => {
    const today = new Date();
    const days = [];
    
    for (let i = 29; i >= 0; i--) {
      const date = subDays(today, i);
      const wasPlayedToday = progress?.streak.lastPlayedISO && 
        isSameDay(new Date(progress.streak.lastPlayedISO), date);
      
      days.push({
        date,
        played: wasPlayedToday || (i > 7 && Math.random() > 0.7), // Mock some previous days
        isToday: isSameDay(date, today)
      });
    }
    
    return days;
  };

  const streakDays = generateStreakCalendar();

  const badges = [
    {
      id: "riddle-master",
      name: "Riddle Master",
      description: "Solve 20 riddles correctly",
      icon: "🧩",
      unlocked: (progress?.perGame.riddle?.correct || 0) >= 20,
      progress: Math.min((progress?.perGame.riddle?.correct || 0), 20),
      target: 20
    },
    {
      id: "word-wizard",
      name: "Word Wizard",
      description: "Complete word challenges",
      icon: "✨",
      unlocked: false,
      progress: 0,
      target: 15
    },
    {
      id: "story-explorer",
      name: "Story Explorer",
      description: "Read 5 complete stories",
      icon: "📚",
      unlocked: false,
      progress: 2,
      target: 5
    },
    {
      id: "streak-champion",
      name: "Streak Champion",
      description: "Play 7 days in a row",
      icon: "🔥",
      unlocked: (progress?.streak.current || 0) >= 7,
      progress: progress?.streak.current || 0,
      target: 7
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-accent/20 via-primary/20 to-secondary/20 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-fredoka font-bold text-primary mb-2">
            ⭐ {selectedChild?.name}'s Progress
          </h1>
          <p className="text-lg text-muted-foreground">Look at all your amazing achievements!</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Stars Card */}
          <Card className="bg-white/90 shadow-lg">
            <CardHeader className="text-center">
              <div className="text-5xl mb-2">⭐</div>
              <CardTitle className="text-2xl font-fredoka text-primary">Stars Earned</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <div className="text-4xl font-bold text-primary mb-2">
                {progress?.stars || 0}
              </div>
              <p className="text-muted-foreground">Keep playing to earn more!</p>
            </CardContent>
          </Card>

          {/* Streak Card */}
          <Card className="bg-white/90 shadow-lg">
            <CardHeader className="text-center">
              <div className="text-5xl mb-2">🔥</div>
              <CardTitle className="text-2xl font-fredoka text-primary">Current Streak</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <div className="text-4xl font-bold text-primary mb-2">
                {progress?.streak.current || 0} days
              </div>
              <p className="text-sm text-muted-foreground">
                Longest: {progress?.streak.longest || 0} days
              </p>
            </CardContent>
          </Card>

          {/* Badges Count */}
          <Card className="bg-white/90 shadow-lg">
            <CardHeader className="text-center">
              <div className="text-5xl mb-2">🏅</div>
              <CardTitle className="text-2xl font-fredoka text-primary">Badges</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <div className="text-4xl font-bold text-primary mb-2">
                {badges.filter(b => b.unlocked).length}/{badges.length}
              </div>
              <p className="text-muted-foreground">Badges unlocked</p>
            </CardContent>
          </Card>
        </div>

        {/* Streak Calendar */}
        <Card className="bg-white/90 shadow-lg mb-8">
          <CardHeader>
            <CardTitle className="text-xl font-fredoka text-primary text-center">
              📅 30-Day Play Streak
            </CardTitle>
            <CardDescription className="text-center">
              Your daily play activity
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-10 gap-2 max-w-2xl mx-auto">
              {streakDays.map((day, index) => (
                <div
                  key={index}
                  className={`aspect-square rounded-lg flex items-center justify-center text-xs font-medium ${
                    day.played 
                      ? 'bg-primary text-white' 
                      : 'bg-muted text-muted-foreground'
                  } ${
                    day.isToday ? 'ring-2 ring-primary ring-offset-2' : ''
                  }`}
                  title={format(day.date, 'MMM d')}
                >
                  {format(day.date, 'd')}
                </div>
              ))}
            </div>
            <p className="text-center text-sm text-muted-foreground mt-4">
              Green = Played that day • Today is highlighted
            </p>
          </CardContent>
        </Card>

        {/* Badges Gallery */}
        <Card className="bg-white/90 shadow-lg mb-8">
          <CardHeader>
            <CardTitle className="text-xl font-fredoka text-primary text-center">
              🏅 Badge Collection
            </CardTitle>
            <CardDescription className="text-center">
              Unlock badges by completing challenges
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {badges.map((badge) => (
                <div
                  key={badge.id}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    badge.unlocked
                      ? 'bg-primary/10 border-primary/30 text-primary'
                      : 'bg-muted/50 border-muted text-muted-foreground'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">{badge.icon}</span>
                    <div className="flex-1">
                      <h3 className="font-semibold">{badge.name}</h3>
                      <p className="text-sm opacity-80">{badge.description}</p>
                    </div>
                    {badge.unlocked && (
                      <Badge variant="secondary" className="bg-primary text-white">
                        Unlocked!
                      </Badge>
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>Progress</span>
                      <span>{badge.progress}/{badge.target}</span>
                    </div>
                    <Progress 
                      value={(badge.progress / badge.target) * 100} 
                      className="h-2"
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="text-center">
          <Button
            onClick={() => navigate('/modes')}
            size="lg"
            className="bg-primary hover:bg-primary/90 text-white"
          >
            Continue Playing! 🚀
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ProgressRewards;