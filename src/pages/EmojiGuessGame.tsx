import React, { useState, useEffect, useContext } from "react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { useProgress } from "../contexts/ProgressContext";
import { useAppContext } from "../contexts/Auth0Context";
import { useParams } from "react-router-dom";
import puzzles from "../config/emoji-guess.json";

interface EmojiGuessPuzzle {
  id: string;
  difficulty: string;
  emojis: string;
  answer: string;
  hint: string;
}

const EmojiGuessGame: React.FC = () => {
  const { difficulty = "easy" } = useParams();
  const [current, setCurrent] = useState(0);
  const [input, setInput] = useState("");
  const [showHint, setShowHint] = useState(false);
  const [score, setScore] = useState(0);
  const { updateGameResult } = useProgress();
  const { selectedChild } = useAppContext();

  const filtered: EmojiGuessPuzzle[] = puzzles.filter(p => p.difficulty === difficulty);
  const puzzle = filtered[current];

  useEffect(() => {
    setInput("");
    setShowHint(false);
  }, [current]);

  const handleSubmit = () => {
    if (input.trim().toLowerCase() === puzzle.answer.toLowerCase() && selectedChild) {
      setScore(s => s + 1);
      updateGameResult({
        gameId: "emoji-guess",
        profileId: selectedChild.id,
        difficulty: difficulty,
        correct: 1,
        total: filtered.length,
        starsEarned: 1,
        endedAt: new Date().toISOString()
      });
      setCurrent(c => c + 1);
    }
  };

  if (!puzzle) {
    return <Card><h2>Game Over!</h2><p>Your score: {score}</p><Button onClick={() => setCurrent(0)}>Play Again</Button></Card>;
  }

  return (
    <Card>
      <h2>Emoji Guess</h2>
      <div style={{ fontSize: "2rem" }}>{puzzle.emojis}</div>
      <input
        type="text"
        value={input}
        onChange={e => setInput(e.target.value)}
        placeholder="Guess the word or phrase"
        style={{ margin: "1em 0", fontSize: "1.2em" }}
      />
      <Button onClick={handleSubmit}>Submit</Button>
      <Button onClick={() => setShowHint(h => !h)} style={{ marginLeft: 8 }}>Hint</Button>
      {showHint && <div style={{ marginTop: 8, color: "#888" }}>{puzzle.hint}</div>}
      <div style={{ marginTop: 16 }}>Score: {score}</div>
    </Card>
  );
};

export default EmojiGuessGame;
