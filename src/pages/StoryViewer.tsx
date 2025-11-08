import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAppContext } from "@/contexts/Auth0Context";
import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import { AppHeader } from "@/components/Navigation/AppHeader";

interface StorySegment {
  text: string;
  image?: string;
}

const StoryViewer = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { selectedChild } = useAppContext();
  const { toast } = useToast();
  const [currentSegment, setCurrentSegment] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [storySegments, setStorySegments] = useState<StorySegment[]>([]);
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);

  const storyText = location.state?.storyText;
  const storyId = location.state?.storyId;

  useEffect(() => {
    if (!storyText && !storyId) {
      navigate('/stories');
      return;
    }

    if (storyText) {
      // Split user's story into segments
      const sentences = storyText.split(/[.!?]+/).filter(s => s.trim().length > 0);
      const segments = sentences.map(sentence => ({
        text: sentence.trim() + '.',
        image: `https://picsum.photos/400/300?random=${Math.floor(Math.random() * 1000)}`
      }));
      setStorySegments(segments);
      setIsGeneratingImages(false);
    } else if (storyId) {
      // Load pre-made story
      const predefinedStories: Record<string, StorySegment[]> = {
        "adventure-forest": [
          {
            text: "Once upon a time, Luna discovered a magical portal hidden behind an old oak tree.",
            image: "https://picsum.photos/400/300?random=101"
          },
          {
            text: "She stepped through and found herself in an enchanted forest filled with glowing flowers.",
            image: "https://picsum.photos/400/300?random=102"
          },
          {
            text: "A friendly fairy appeared and offered to guide her on an amazing adventure.",
            image: "https://picsum.photos/400/300?random=103"
          }
        ],
        "space-explorer": [
          {
            text: "Captain Alex zoomed through space in a shiny silver rocket ship.",
            image: "https://picsum.photos/400/300?random=201"
          },
          {
            text: "The first planet had purple skies and friendly aliens with big smiles.",
            image: "https://picsum.photos/400/300?random=202"
          },
          {
            text: "Together they discovered a crystal that could power the entire galaxy.",
            image: "https://picsum.photos/400/300?random=203"
          }
        ],
        "underwater-kingdom": [
          {
            text: "Princess Marina dove deep into the ocean and discovered a hidden kingdom.",
            image: "https://picsum.photos/400/300?random=301"
          },
          {
            text: "The sea creatures welcomed her with a parade of colorful fish and dancing seahorses.",
            image: "https://picsum.photos/400/300?random=302"
          },
          {
            text: "She learned the ancient secret of speaking with all ocean life.",
            image: "https://picsum.photos/400/300?random=303"
          }
        ]
      };

      setStorySegments(predefinedStories[storyId] || []);
    }
  }, [storyText, storyId, navigate]);

  const speakText = (text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.8;
      utterance.pitch = 1.1;
      utterance.volume = 1;

      utterance.onstart = () => setIsPlaying(true);
      utterance.onend = () => {
        setIsPlaying(false);
        // Auto advance to next segment after a pause
        setTimeout(() => {
          if (currentSegment < storySegments.length - 1) {
            setCurrentSegment(currentSegment + 1);
          }
        }, 1000);
      };

      speechSynthesis.speak(utterance);
    } else {
      toast({
        title: "Not Supported",
        description: "Text-to-speech is not supported in this browser",
        variant: "destructive"
      });
    }
  };

  const stopSpeaking = () => {
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
      setIsPlaying(false);
    }
  };

  const nextSegment = () => {
    if (currentSegment < storySegments.length - 1) {
      stopSpeaking();
      setCurrentSegment(currentSegment + 1);
    }
  };

  const prevSegment = () => {
    if (currentSegment > 0) {
      stopSpeaking();
      setCurrentSegment(currentSegment - 1);
    }
  };

  const playCurrentSegment = () => {
    if (storySegments[currentSegment]) {
      speakText(storySegments[currentSegment].text);
    }
  };

  if (storySegments.length === 0) {
    return (
      <>
        <AppHeader title="Story Viewer" showBackButton />
        <div className="min-h-screen bg-gradient-to-br from-secondary/20 via-accent/20 to-primary/20 p-4 flex items-center justify-center">
        <Card className="bg-white/90 p-8">
          <div className="text-center">
            <div className="text-6xl mb-4">📖</div>
            <h2 className="text-2xl font-fredoka font-bold text-primary mb-4">Loading Story...</h2>
            <Button onClick={() => navigate('/stories')} variant="outline">
              Back to Stories
            </Button>
          </div>
        </Card>
        </div>
      </>
    );
  }

  const currentStory = storySegments[currentSegment];

  return (
    <>
      <AppHeader title="Story Viewer" showBackButton />
      <div className="min-h-screen bg-gradient-to-br from-secondary/20 via-accent/20 to-primary/20 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-fredoka font-bold text-primary mb-2">
            📚 Story Time, {selectedChild?.name}!
          </h1>
          <p className="text-muted-foreground">
            Segment {currentSegment + 1} of {storySegments.length}
          </p>
        </div>

        <Card className="bg-white/95 shadow-xl mb-6">
          <CardContent className="p-8">
            {currentStory.image && (
              <div className="text-center mb-6">
                <img
                  src={currentStory.image}
                  alt="Story illustration"
                  className="rounded-lg shadow-lg mx-auto max-w-full h-64 object-cover"
                />
              </div>
            )}
            
            <div className="text-center mb-8">
              <p className="text-xl leading-relaxed text-foreground font-medium">
                {currentStory.text}
              </p>
            </div>

            <div className="flex justify-center gap-4 flex-wrap">
              <Button
                onClick={prevSegment}
                disabled={currentSegment === 0}
                variant="outline"
                size="lg"
              >
                ⬅️ Previous
              </Button>

              {!isPlaying ? (
                <Button
                  onClick={playCurrentSegment}
                  className="bg-primary hover:bg-primary/90 text-white"
                  size="lg"
                >
                  🔊 Read Aloud
                </Button>
              ) : (
                <Button
                  onClick={stopSpeaking}
                  className="bg-red-500 hover:bg-red-600 text-white animate-pulse"
                  size="lg"
                >
                  ⏹️ Stop Reading
                </Button>
              )}

              <Button
                onClick={nextSegment}
                disabled={currentSegment === storySegments.length - 1}
                variant="outline"
                size="lg"
              >
                Next ➡️
              </Button>
            </div>
          </CardContent>
        </Card>

        {currentSegment === storySegments.length - 1 && (
          <Card className="bg-gradient-to-r from-primary/10 to-secondary/10 shadow-lg">
            <CardContent className="p-6 text-center">
              <div className="text-4xl mb-4">🎉</div>
              <h3 className="text-2xl font-fredoka font-bold text-primary mb-4">
                The End!
              </h3>
              <p className="text-muted-foreground mb-6">
                Great job reading the story! What adventure will you choose next?
              </p>
              <div className="flex gap-4 justify-center flex-wrap">
                <Button
                  onClick={() => setCurrentSegment(0)}
                  variant="outline"
                  size="lg"
                >
                  🔄 Read Again
                </Button>
                <Button
                  onClick={() => navigate('/stories')}
                  className="bg-primary hover:bg-primary/90 text-white"
                  size="lg"
                >
                  📚 More Stories
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      </div>
    </>
  );
};

export default StoryViewer;