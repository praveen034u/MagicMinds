import { useParams } from "react-router-dom";
import RiddleGame from "./games/RiddleGame";
import CrosswordGame from "./games/CrosswordGame";
import WordScrambleGame from "../pages/WordScrambleGame";
import EmojiGuessGame from "../pages/EmojiGuessGame";
import NotFound from "./NotFound";

const GameRouter = () => {
  const { gameId } = useParams();

  switch (gameId) {
    case 'riddle':
      return <RiddleGame />;
    case 'crossword':
      return <CrosswordGame />;
    case 'word-scramble':
      return <WordScrambleGame />;
    case 'emoji-guess':
      return <EmojiGuessGame />;
    default:
      return <NotFound />;
  }
};

export default GameRouter;
