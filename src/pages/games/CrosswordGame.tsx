import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAppContext } from "@/contexts/Auth0Context";
import { useProgress } from "@/contexts/ProgressContext";
import { useToast } from '@/hooks/use-toast';
import GameRoomPanel from "@/components/Multiplayer/GameRoomPanel";
import { AppHeader } from "@/components/Navigation/AppHeader";
import crosswordsData from "@/config/crosswords.json";
import type { CrosswordWord, CrosswordPuzzle, GameResult } from "@/types";
import { supabase } from "@/integrations/supabase/client";

type Player = {
  id: string;
  name: string;
  avatar: string;
  score: number;
  correctWords?: number;
  isAI?: boolean;
  streak?: number;
  scoreRowId?: string | number;
};

type GamePhase = 'theme-select' | 'setup' | 'countdown' | 'playing' | 'scoreboard' | 'complete';

type GridCell = {
  letter: string;
  userLetter: string;
  isBlack: boolean;
  number?: number;
  wordIds: number[]; // IDs of words that pass through this cell
};

const CrosswordGame = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { gameId } = useParams();
  const { selectedChild } = useAppContext();
  const { updateGameResult } = useProgress();
  const { toast } = useToast();

  const difficulty = searchParams.get('difficulty') || 'easy';
  const paramRoom = searchParams.get('room')?.toUpperCase() || null;

  const [roomCode, setRoomCode] = useState<string | null>(paramRoom);
  const [players, _setPlayers] = useState<Player[]>([]);
  const playersRef = useRef<Player[]>([]);
  const setPlayersSafe = (next: Player[] | ((prev: Player[]) => Player[])) => {
    const resolved = typeof next === 'function' ? (next as (p: Player[]) => Player[])(playersRef.current) : next;
    playersRef.current = resolved;
    _setPlayers(resolved);
  };

  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [gamePhase, setGamePhase] = useState<GamePhase>('theme-select');
  const [waitingForPlayers, setWaitingForPlayers] = useState(false);
  const [gameTimer, setGameTimer] = useState(0);
  const [finalPlayersSnapshot, setFinalPlayersSnapshot] = useState<Player[] | null>(null);
  const [finalPlayerScore, setFinalPlayerScore] = useState<number | null>(null);
  const [showNewPlayerDialog, setShowNewPlayerDialog] = useState(false);
  const [newPlayerInfo, setNewPlayerInfo] = useState<Player | null>(null);

  const gameEndedRef = useRef(false);
  const scoreboardPollRef = useRef<number | null>(null);
  const countdownTimerRef = useRef<number | null>(null);
  const fallbackTimeoutRef = useRef<number | null>(null);
  const gameTimerRef = useRef<number | null>(null);

  const GAME_DURATION = 600; // 10 minutes for crosswords

  const [isRoomCreator, setIsRoomCreator] = useState(false);
  const [pendingJoinRequests, setPendingJoinRequests] = useState(0);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);

  const [countdown, setCountdown] = useState(3);
  const [grid, setGrid] = useState<GridCell[][]>([]);
  const [selectedCell, setSelectedCell] = useState<{row: number, col: number} | null>(null);
  const [selectedWordId, setSelectedWordId] = useState<number | null>(null);
  const [selectedDirection, setSelectedDirection] = useState<'across' | 'down'>('across');

  useEffect(() => {
    const param = searchParams.get('room')?.toUpperCase() || null;
    setRoomCode(param);

    if (param) {
      loadRoomData(param);
    } else {
      const playerId = selectedChild?.id || 'player1';
      const playerName = selectedChild?.name || 'Player 1';
      const playerAvatar = selectedChild?.avatar || '👤';
      setPlayersSafe([{ id: playerId, name: playerName, avatar: playerAvatar, score: 0, correctWords: 0, streak: 0 }]);
    }
  }, [searchParams, selectedChild]);

  const loadRoomData = async (code: string) => {
    try {
      const { data, error } = await supabase
        .from('game_rooms')
        .select('*')
        .eq('room_code', code)
        .single();

      if (error || !data) {
        toast({ title: 'Room not found', description: 'Invalid room code', variant: 'destructive' });
        navigate('/games');
        return;
      }

      setCurrentRoomId(data.id);
      setIsRoomCreator(data.host_child_id === selectedChild?.id);
      
      if ((data as any).selected_category) {
        setSelectedCategory((data as any).selected_category);
      }

      await fetchRoomParticipants(data.id);

      if (data.status === 'playing') {
        setGamePhase('countdown');
        startCountdown();
      }
    } catch (err) {
      console.error('Failed to load room:', err);
    }
  };

  const fetchRoomParticipants = async (roomId: string) => {
    try {
      const { data: participants } = await supabase
        .from('room_participants')
        .select('child_id, children_profiles(name, avatar)')
        .eq('room_id', roomId);

      if (participants) {
        const playerList = participants.map((p: any) => ({
          id: p.child_id,
          name: p.children_profiles?.name || 'Player',
          avatar: p.children_profiles?.avatar || '👤',
          score: 0,
          correctWords: 0,
          streak: 0
        }));
        setPlayersSafe(playerList);
      }
    } catch (err) {
      console.error('Failed to fetch participants:', err);
    }
  };

  const fetchRoomScores = async (roomId: string) => {
    try {
      const { data } = await supabase
        .from('multiplayer_game_scores')
        .select('*')
        .eq('room_id', roomId);

      if (data) {
        setPlayersSafe(prev => prev.map(p => {
          const scoreData = data.find(s => s.child_id === p.id);
          return scoreData ? { ...p, score: scoreData.score || 0, correctWords: scoreData.total_questions || 0 } : p;
        }));
      }
    } catch (err) {
      console.error('Failed to fetch scores:', err);
    }
  };

  const initializeGameScores = async (roomId: string, playerList: Player[]) => {
    try {
      await supabase
        .from('multiplayer_game_scores')
        .delete()
        .eq('room_id', roomId);

      const scoreEntries = playerList.map(player => ({
        room_id: roomId,
        child_id: player.isAI ? null : player.id,
        player_name: player.name,
        player_avatar: player.avatar,
        is_ai: player.isAI || false,
        score: 0,
        total_questions: 0
      }));

      await supabase
        .from('multiplayer_game_scores')
        .insert(scoreEntries);

      await fetchRoomScores(roomId);
    } catch (error) {
      console.error('Error initializing game scores:', error);
    }
  };

  const clearIntervalRef = (ref: React.MutableRefObject<number | null>) => {
    if (ref.current) {
      try { window.clearInterval(ref.current); } catch (e) { /* ignore */ }
      ref.current = null;
    }
  };
  
  const clearTimeoutRef = (ref: React.MutableRefObject<number | null>) => {
    if (ref.current) {
      try { window.clearTimeout(ref.current); } catch (e) { /* ignore */ }
      ref.current = null;
    }
  };

  const getPuzzleData = (): CrosswordPuzzle | null => {
    if (!selectedCategory) return null;
    const categoryData = (crosswordsData as any)[selectedCategory];
    if (categoryData && categoryData[difficulty]) {
      return categoryData[difficulty] as CrosswordPuzzle;
    }
    return null;
  };

  const puzzleData = getPuzzleData();

  // Initialize grid when puzzle data changes
  useEffect(() => {
    if (puzzleData && gamePhase === 'playing') {
      initializeGrid(puzzleData);
    }
  }, [puzzleData, gamePhase]);

  const initializeGrid = (puzzle: CrosswordPuzzle) => {
    const size = puzzle.gridSize;
    const newGrid: GridCell[][] = Array(size).fill(null).map(() => 
      Array(size).fill(null).map(() => ({
        letter: '',
        userLetter: '',
        isBlack: true,
        wordIds: []
      }))
    );

    // Place all words in the grid
    puzzle.words.forEach(word => {
      for (let i = 0; i < word.word.length; i++) {
        const row = word.direction === 'across' ? word.startRow : word.startRow + i;
        const col = word.direction === 'across' ? word.startCol + i : word.startCol;
        
        if (row < size && col < size) {
          newGrid[row][col].letter = word.word[i];
          newGrid[row][col].isBlack = false;
          newGrid[row][col].wordIds.push(word.id);
          
          // Add number to first cell of word
          if (i === 0) {
            newGrid[row][col].number = word.number;
          }
        }
      }
    });

    setGrid(newGrid);
  };

  const handleCellClick = (row: number, col: number) => {
    const cell = grid[row][col];
    if (cell.isBlack) return;

    // If clicking the same cell, toggle direction
    if (selectedCell && selectedCell.row === row && selectedCell.col === col) {
      setSelectedDirection(prev => prev === 'across' ? 'down' : 'across');
    } else {
      setSelectedCell({ row, col });
      // Set direction based on available words at this cell
      const wordIds = cell.wordIds;
      if (wordIds.length > 0 && puzzleData) {
        const firstWord = puzzleData.words.find(w => w.id === wordIds[0]);
        if (firstWord) {
          setSelectedDirection(firstWord.direction);
          setSelectedWordId(firstWord.id);
        }
      }
    }
  };

  const handleKeyPress = (e: KeyboardEvent) => {
    if (!selectedCell || !puzzleData) return;

    const key = e.key.toUpperCase();
    
    if (key === 'BACKSPACE') {
      // Clear current cell and move back
      const newGrid = [...grid];
      newGrid[selectedCell.row][selectedCell.col].userLetter = '';
      setGrid(newGrid);
      moveToPreviousCell();
    } else if (key.length === 1 && /[A-Z]/.test(key)) {
      // Fill in letter and move to next cell
      const newGrid = [...grid];
      newGrid[selectedCell.row][selectedCell.col].userLetter = key;
      setGrid(newGrid);
      checkWordCompletion(selectedCell.row, selectedCell.col);
      moveToNextCell();
    } else if (key === 'ARROWUP' || key === 'ARROWDOWN' || key === 'ARROWLEFT' || key === 'ARROWRIGHT') {
      e.preventDefault();
      handleArrowKey(key);
    }
  };

  useEffect(() => {
    if (gamePhase === 'playing') {
      window.addEventListener('keydown', handleKeyPress);
      return () => window.removeEventListener('keydown', handleKeyPress);
    }
  }, [selectedCell, selectedDirection, grid, gamePhase]);

  const moveToNextCell = () => {
    if (!selectedCell || !puzzleData) return;

    let nextRow = selectedCell.row;
    let nextCol = selectedCell.col;

    if (selectedDirection === 'across') {
      nextCol++;
      while (nextCol < grid[0].length && grid[nextRow][nextCol].isBlack) {
        nextCol++;
      }
      if (nextCol >= grid[0].length || grid[nextRow][nextCol].isBlack) {
        return; // End of word
      }
    } else {
      nextRow++;
      while (nextRow < grid.length && grid[nextRow][nextCol].isBlack) {
        nextRow++;
      }
      if (nextRow >= grid.length || grid[nextRow][nextCol].isBlack) {
        return; // End of word
      }
    }

    setSelectedCell({ row: nextRow, col: nextCol });
  };

  const moveToPreviousCell = () => {
    if (!selectedCell) return;

    let prevRow = selectedCell.row;
    let prevCol = selectedCell.col;

    if (selectedDirection === 'across') {
      prevCol--;
      while (prevCol >= 0 && grid[prevRow][prevCol].isBlack) {
        prevCol--;
      }
      if (prevCol < 0 || grid[prevRow][prevCol].isBlack) {
        return;
      }
    } else {
      prevRow--;
      while (prevRow >= 0 && grid[prevRow][prevCol].isBlack) {
        prevRow--;
      }
      if (prevRow < 0 || grid[prevRow][prevCol].isBlack) {
        return;
      }
    }

    setSelectedCell({ row: prevRow, col: prevCol });
  };

  const handleArrowKey = (key: string) => {
    if (!selectedCell) return;

    let newRow = selectedCell.row;
    let newCol = selectedCell.col;

    switch (key) {
      case 'ARROWUP':
        newRow = Math.max(0, newRow - 1);
        while (newRow >= 0 && grid[newRow][newCol].isBlack) newRow--;
        break;
      case 'ARROWDOWN':
        newRow = Math.min(grid.length - 1, newRow + 1);
        while (newRow < grid.length && grid[newRow][newCol].isBlack) newRow++;
        break;
      case 'ARROWLEFT':
        newCol = Math.max(0, newCol - 1);
        while (newCol >= 0 && grid[newRow][newCol].isBlack) newCol--;
        break;
      case 'ARROWRIGHT':
        newCol = Math.min(grid[0].length - 1, newCol + 1);
        while (newCol < grid[0].length && grid[newRow][newCol].isBlack) newCol++;
        break;
    }

    if (newRow >= 0 && newRow < grid.length && newCol >= 0 && newCol < grid[0].length && !grid[newRow][newCol].isBlack) {
      setSelectedCell({ row: newRow, col: newCol });
    }
  };

  const checkWordCompletion = async (row: number, col: number) => {
    if (!puzzleData) return;

    const cell = grid[row][col];
    
    // Check all words that pass through this cell
    for (const wordId of cell.wordIds) {
      const word = puzzleData.words.find(w => w.id === wordId);
      if (!word) continue;

      // Check if word is complete
      let isComplete = true;
      let isCorrect = true;

      for (let i = 0; i < word.word.length; i++) {
        const r = word.direction === 'across' ? word.startRow : word.startRow + i;
        const c = word.direction === 'across' ? word.startCol + i : word.startCol;
        
        const cellLetter = grid[r][c].userLetter;
        if (!cellLetter) {
          isComplete = false;
          break;
        }
        if (cellLetter !== word.word[i]) {
          isCorrect = false;
        }
      }

      if (isComplete && isCorrect) {
        // Word completed correctly!
        const playerId = selectedChild?.id || 'player1';
        
        // Update local score
        setPlayersSafe(prev => prev.map(p => 
          p.id === playerId ? { 
            ...p, 
            score: p.score + 10,
            correctWords: (p.correctWords || 0) + 1 
          } : p
        ));

        // Update server score
        if (currentRoomId) {
          await updatePlayerScore(playerId, 10, 1);
        }

        toast({
          title: '✅ Correct!',
          description: `You completed "${word.word}"!`,
        });

        // Check if all words are complete
        checkPuzzleCompletion();
      }
    }
  };

  const checkPuzzleCompletion = () => {
    if (!puzzleData) return;

    const allCorrect = puzzleData.words.every(word => {
      for (let i = 0; i < word.word.length; i++) {
        const r = word.direction === 'across' ? word.startRow : word.startRow + i;
        const c = word.direction === 'across' ? word.startCol + i : word.startCol;
        if (grid[r][c].userLetter !== word.word[i]) {
          return false;
        }
      }
      return true;
    });

    if (allCorrect) {
      toast({
        title: '🎉 Puzzle Complete!',
        description: 'Amazing! You solved the entire crossword!',
      });
      setTimeout(() => finishGame(), 2000);
    }
  };

  const updatePlayerScore = async (playerId: string, points: number, wordsCompleted: number) => {
    if (!currentRoomId) return;

    try {
      const { data: existing } = await supabase
        .from('multiplayer_game_scores')
        .select('*')
        .eq('room_id', currentRoomId)
        .eq('child_id', playerId)
        .single();

      if (existing) {
        await supabase
          .from('multiplayer_game_scores')
          .update({
            score: (existing.score || 0) + points,
            total_questions: (existing.total_questions || 0) + wordsCompleted
          })
          .eq('id', existing.id);
      }
    } catch (err) {
      console.error('Failed to update score:', err);
    }
  };

  const startCountdown = () => {
    if (gameEndedRef.current) return;

    setGamePhase('countdown');
    clearIntervalRef(countdownTimerRef);
    clearTimeoutRef(fallbackTimeoutRef);

    let count = 3;
    setCountdown(count);

    const id = window.setInterval(() => {
      count -= 1;
      setCountdown(count);
      if (count <= 0) {
        try { window.clearInterval(id); } catch (e) { /* ignore */ }
        countdownTimerRef.current = null;
        setGamePhase('playing');
        startGameTimer();
      }
    }, 1000);

    countdownTimerRef.current = id;
  };

  const startGameTimer = () => {
    if (gameEndedRef.current) return;

    clearIntervalRef(gameTimerRef);
    setGameTimer(GAME_DURATION);

    const id = window.setInterval(() => {
      setGameTimer(prev => {
        if (prev <= 1) {
          clearIntervalRef(gameTimerRef);
          finishGame();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    gameTimerRef.current = id;
  };

  const handlePlayerJoin = (player: Player) => {
    setPlayersSafe(prev => {
      if (prev.find(p => p.id === player.id)) return prev;
      return [...prev, player];
    });
  };

  const handleJoinRequestUpdate = (count: number) => {
    setPendingJoinRequests(count);
  };

  const handleNewPlayerResponse = (restart: boolean) => {
    setShowNewPlayerDialog(false);
    setNewPlayerInfo(null);
    if (restart && isRoomCreator) {
      startGameAsHost();
    }
  };

  const humanPlayersCount = playersRef.current.filter(p => !p.isAI).length;
  const canSelectTheme = !roomCode || (isRoomCreator && humanPlayersCount >= 2);

  const handleThemeSelect = (theme: string) => {
    if (roomCode && !isRoomCreator) {
      toast({ title: 'Waiting for host', description: 'Only the room creator can select the theme', variant: 'default' });
      return;
    }

    setSelectedCategory(theme);

    if (roomCode && isRoomCreator) {
      (async () => {
        try {
          await supabase
            .from('game_rooms')
            .update({ selected_category: theme } as any)
            .eq('room_code', roomCode);
        } catch (e) {
          console.error('Failed to update room with selected theme', e);
        }
      })();
    }
  };

  useEffect(() => {
    if (!roomCode || isRoomCreator) return;

    const channel = supabase
      .channel(`game-room-${roomCode}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'game_rooms',
        filter: `room_code=eq.${roomCode}`
      }, (payload: any) => {
        const newData = payload.new;
        if (newData.status === 'playing' && gamePhase !== 'playing') {
          setGamePhase('countdown');
          startCountdown();
        }
        if (newData.selected_category && newData.selected_category !== selectedCategory) {
          setSelectedCategory(newData.selected_category);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomCode, isRoomCreator, gamePhase, selectedCategory]);

  const startGameAsHost = async () => {
    if (!roomCode || !currentRoomId) return;

    try {
      await initializeGameScores(currentRoomId, playersRef.current);
    } catch (e) {
      console.error('Failed to initialize scores before starting', e);
    }

    try {
      await supabase
        .from('game_rooms')
        .update({ status: 'playing' })
        .eq('room_code', roomCode);
    } catch (e) {
      console.error('Failed to set room status to playing', e);
    }

    try {
      gameEndedRef.current = false;
      clearIntervalRef(countdownTimerRef);
      clearIntervalRef(gameTimerRef);
      clearTimeoutRef(fallbackTimeoutRef);
      clearIntervalRef(scoreboardPollRef);

      setFinalPlayersSnapshot(null);
      setFinalPlayerScore(null);
      setSelectedCell(null);
      setSelectedWordId(null);
      setPlayersSafe(prev => prev.map(p => ({ ...p, score: 0, correctWords: 0, streak: 0 })));
    } catch (e) {
      console.error('Failed to reset local state before host start:', e);
    }

    setGamePhase('countdown');
    setWaitingForPlayers(false);
    startCountdown();
  };

  const handlePlayAgain = async () => {
    try {
      gameEndedRef.current = false;
      clearIntervalRef(countdownTimerRef);
      clearIntervalRef(gameTimerRef);
      clearTimeoutRef(fallbackTimeoutRef);
      clearIntervalRef(scoreboardPollRef);

      setFinalPlayersSnapshot(null);
      setFinalPlayerScore(null);
      setGameTimer(0);
      setSelectedCell(null);
      setSelectedWordId(null);

      setPlayersSafe(prev => prev.map(p => ({ ...p, score: 0, correctWords: 0, streak: 0 })));

      if (roomCode && currentRoomId) {
        try {
          await initializeGameScores(currentRoomId, playersRef.current);
          
          await supabase
            .from('game_rooms')
            .update({ status: 'playing' })
            .eq('room_code', roomCode);

          toast({ 
            title: 'Restarting game...', 
            description: 'Get ready for another round!'
          });
        } catch (e) {
          console.error('Failed to reset multiplayer room:', e);
          toast({ 
            title: 'Error', 
            description: 'Failed to restart the game. Please try again.',
            variant: 'destructive'
          });
          return;
        }
      }

      setGamePhase('countdown');
      setWaitingForPlayers(false);
      startCountdown();
    } catch (e) {
      console.error('Failed to restart game:', e);
      toast({ 
        title: 'Error', 
        description: 'Failed to restart the game. Please try again.',
        variant: 'destructive'
      });
    }
  };

  const finishGame = async () => {
    if (gameEndedRef.current) return;

    const totalWords = puzzleData?.words.length || 1;
    const playerId = selectedChild?.id || 'player1';

    if (currentRoomId) {
      try { await fetchRoomScores(currentRoomId); } catch (e) { /* ignore */ }

      try {
        const res = await supabase.functions.invoke('manage-game-rooms', {
          body: {
            action: 'mark_player_finished',
            room_id: currentRoomId,
            child_id: playerId,
            total_questions: totalWords
          }
        });

        const resp = res.data;
        const allFinished = resp?.all_finished ?? false;

        if (allFinished) {
          await finalizeGame();
          return;
        }

        setGamePhase('scoreboard');
        gameEndedRef.current = true;

        clearIntervalRef(scoreboardPollRef);
        scoreboardPollRef.current = window.setInterval(async () => {
          try {
            await fetchRoomScores(currentRoomId);
            const nowAll = (playersRef.current || players).every(p => (p.correctWords ?? 0) >= totalWords);
            if (nowAll) {
              clearIntervalRef(scoreboardPollRef);
              await finalizeGameAfterWait();
            }
          } catch (e) { /* ignore */ }
        }, 2000);

        return;
      } catch (err) {
        console.error('mark_player_finished failed', err);
        const allFinished = (playersRef.current || players).every(p => (p.correctWords ?? 0) >= totalWords);
        if (!allFinished) {
          setGamePhase('scoreboard');
          gameEndedRef.current = true;
          return;
        }
      }
    }

    await finalizeGame();
  };

  const finalizeGameAfterWait = async () => {
    await finalizeGame();
  };

  const finalizeGame = async () => {
    if (gameEndedRef.current !== true) {
      gameEndedRef.current = true;
    }

    if (currentRoomId) {
      try { await fetchRoomScores(currentRoomId); } catch (e) { /* ignore */ }
    }

    const finalPlayers = (playersRef.current && playersRef.current.length) ? playersRef.current : players;
    const playerScore = finalPlayers.find(p => p.id === (selectedChild?.id || 'player1'))?.score ?? 0;

    setFinalPlayersSnapshot(finalPlayers);
    setFinalPlayerScore(playerScore);

    setGamePhase('complete');

    clearIntervalRef(gameTimerRef);
    clearIntervalRef(scoreboardPollRef);

    if (!roomCode && puzzleData) {
      const playerData = finalPlayers.find(p => p.id === (selectedChild?.id || 'player1'));
      const correctWords = playerData?.correctWords || 0;
      const totalWords = puzzleData.words.length;
      const percentage = (correctWords / totalWords) * 100;
      
      let starsEarned = 1;
      if (percentage >= 80) starsEarned = 3;
      else if (percentage >= 60) starsEarned = 2;

      const result: GameResult = {
        gameId: 'crossword',
        profileId: selectedChild?.id || 'player1',
        difficulty,
        correct: correctWords,
        total: totalWords,
        starsEarned,
        theme: selectedCategory,
        endedAt: new Date().toISOString()
      };

      await updateGameResult(result);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const safeCorrectWords = (player: Player) => player.correctWords ?? 0;
  const visiblePlayers = playersRef.current.length ? playersRef.current : players;

  const Background3D = () => (
    <>
      <div className="crossword-3d-bg" aria-hidden>
        <div className="crossword-layer layer1" />
        <div className="crossword-layer layer2" />
        <div className="crossword-layer layer3" />
      </div>
      <style>{`
        .crossword-3d-bg { position: fixed; inset: 0; z-index: -20; perspective: 1000px; pointer-events: none; overflow: hidden; }
        .crossword-layer { position: absolute; width: 140%; height: 140%; left: -20%; top: -20%; transform-origin: center; filter: blur(60px) saturate(120%); opacity: 0.75; }
        .crossword-layer.layer1 { background: radial-gradient(circle at 20% 20%, rgba(59,130,246,0.38), transparent 40%), radial-gradient(circle at 80% 80%, rgba(168,85,247,0.26), transparent 30%); animation: float 20s linear infinite; transform: translateZ(-200px) scale(1.2) rotateX(18deg); }
        .crossword-layer.layer2 { background: radial-gradient(circle at 50% 10%, rgba(34,197,94,0.2), transparent 30%), radial-gradient(circle at 10% 80%, rgba(236,72,153,0.18), transparent 30%); animation: float 28s linear infinite reverse; transform: translateZ(-100px) scale(1.05) rotateX(12deg); }
        .crossword-layer.layer3 { background: linear-gradient(120deg, rgba(245,158,11,0.05), rgba(59,130,246,0.04)); transform: translateZ(0) scale(1); opacity: 0.6; animation: float 35s linear infinite; }
        @keyframes float { 0% { transform: translateZ(-200px) scale(1.2) rotateX(18deg) rotateY(0deg); } 100% { transform: translateZ(-200px) scale(1.2) rotateX(18deg) rotateY(360deg); } }
      `}</style>
    </>
  );

  // Theme Selection Phase
  if (gamePhase === 'theme-select') {
    const availableThemes = Object.keys(crosswordsData as any);
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/20 to-secondary/20">
        <Background3D />
        <AppHeader title="Select Crossword Theme" showBackButton />
        <div className="container mx-auto px-4 py-6">
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="text-center text-2xl font-fredoka text-primary">
                Choose Your Crossword Theme
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {availableThemes.map((theme) => {
                  const isSelected = selectedCategory === theme;
                  const themeImages: Record<string, string> = {
                    'Christmas': '/images/crossword-christmas.svg',
                    'Animals': '/images/crossword-animals.svg',
                    'Space': '/images/crossword-space.svg',
                    'Ocean': '/images/crossword-ocean.svg'
                  };
                  
                  return (
                    <Card
                      key={theme}
                      className={`cursor-pointer transition-all hover:shadow-lg ${
                        isSelected ? 'ring-4 ring-green-400 shadow-xl' : 'hover:ring-2 hover:ring-primary/50'
                      } ${!canSelectTheme ? 'opacity-50 cursor-not-allowed' : ''}`}
                      onClick={() => canSelectTheme && handleThemeSelect(theme)}
                      title={!canSelectTheme ? (roomCode && !isRoomCreator ? 'Waiting for host to select theme' : 'Waiting for player to join') : undefined}
                    >
                      <CardContent className="p-4">
                        <div className="flex flex-col items-center space-y-3">
                          <img 
                            src={themeImages[theme]} 
                            alt={`${theme} Crossword`}
                            className="w-full h-48 object-contain rounded-lg"
                          />
                          <div className="flex items-center justify-center gap-2">
                            <span className="text-xl font-semibold text-primary">{theme}</span>
                            {isSelected && <Badge className="bg-green-500">Selected ✓</Badge>}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                
                {/* Solo Play - Start Button */}
                {!roomCode && selectedCategory && (
                  <div className="col-span-full mt-4">
                    <div className="flex justify-center">
                      <Button 
                        onClick={() => {
                          setGamePhase('countdown');
                          startCountdown();
                        }} 
                        className="w-48 bg-primary hover:bg-primary/90"
                        size="lg"
                      >
                        Start Game ▶
                      </Button>
                    </div>
                  </div>
                )}
                
                {/* Multiplayer - Waiting Messages */}
                {roomCode && isRoomCreator && humanPlayersCount < 2 && (
                  <div className="col-span-full text-center text-sm text-muted-foreground mt-3">
                    Waiting for the other player to join to select the theme…
                  </div>
                )}
                {roomCode && !isRoomCreator && !selectedCategory && (
                  <div className="col-span-full text-center text-sm text-muted-foreground mt-3">
                    Waiting for the host to select the theme and start the game…
                  </div>
                )}
                
                {/* Multiplayer - Start Button */}
                {roomCode && selectedCategory && (
                  <div className="col-span-full mt-3">
                    {isRoomCreator ? (
                      <div className="flex justify-center">
                        <Button onClick={startGameAsHost} className="w-48" size="lg">
                          Start Game ▶
                        </Button>
                      </div>
                    ) : (
                      <div className="text-center text-sm text-muted-foreground mt-2">
                        Waiting for the host to start the game…
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Countdown Phase
  if (gamePhase === 'countdown') {
    const themeImages: Record<string, string> = {
      'Christmas': '/images/crossword-christmas.svg',
      'Animals': '/images/crossword-animals.svg',
      'Space': '/images/crossword-space.svg',
      'Ocean': '/images/crossword-ocean.svg'
    };
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/20 via-secondary/20 to-accent/20 p-4 flex items-center justify-center">
        <Background3D />
        <Card className="max-w-md mx-auto bg-white/90 shadow-xl">
          <CardContent className="text-center py-16">
            <img 
              src={themeImages[selectedCategory] || themeImages['Christmas']} 
              alt={`${selectedCategory} Crossword`}
              className="w-48 h-48 mx-auto mb-4 object-contain"
            />
            <h2 className="text-2xl font-fredoka text-primary mb-4">
              {selectedCategory} Crossword Puzzle
            </h2>
            <p className="text-lg text-muted-foreground mb-4">Get ready! Starting in...</p>
            <div className="text-6xl font-bold text-primary">
              {countdown > 0 ? countdown : "GO!"}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Scoreboard Wait Phase
  if (gamePhase === 'scoreboard') {
    const totalWords = puzzleData?.words.length || 1;
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/20 via-secondary/20 to-accent/20 p-4">
        <Background3D />
        <Card className="max-w-lg mx-auto bg-white/90 shadow-xl">
          <CardHeader className="text-center">
            <div className="text-4xl mb-2">⏳</div>
            <CardTitle className="text-2xl font-fredoka text-primary">Waiting for players to finish</CardTitle>
            <p className="text-sm text-muted-foreground mt-2">We'll show the final scoreboard once everyone completes the crossword.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {[...players].map((p) => (
                <div key={p.id} className="flex items-center justify-between p-2 rounded-md bg-secondary/10">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-8 h-8"><AvatarFallback className="text-lg">{p.avatar}</AvatarFallback></Avatar>
                    <div>
                      <div className="font-medium text-primary">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{safeCorrectWords(p)}/{totalWords} words</div>
                    </div>
                  </div>
                  <div className="text-sm font-semibold">{p.score} pts</div>
                </div>
              ))}
            </div>
            <div className="flex justify-center">
              <Button onClick={async () => {
                if (!currentRoomId) return;
                await fetchRoomScores(currentRoomId);
                const totalW = puzzleData?.words.length || 1;
                const all = (playersRef.current || players).every(pp => (pp.correctWords ?? 0) >= totalW);
                if (all) {
                  await finalizeGame();
                } else {
                  toast({ title: 'Not all players finished', description: 'Please wait for everyone to finish.' });
                }
              }}>
                Refresh Status
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Game Complete Phase
  if (gamePhase === 'complete') {
    const finalPlayers = finalPlayersSnapshot ?? (playersRef.current.length ? playersRef.current : players);
    const playerScore = finalPlayerScore ?? finalPlayers.find(p => p.id === (selectedChild?.id || 'player1'))?.score ?? 0;
    const totalWords = puzzleData?.words.length || 1;
    const playerData = finalPlayers.find(p => p.id === (selectedChild?.id || 'player1'));
    const correctWords = playerData?.correctWords || 0;
    const percentage = (correctWords / totalWords) * 100;

    let starsEarned = 1;
    if (percentage >= 80) starsEarned = 3;
    else if (percentage >= 60) starsEarned = 2;

    const sortedPlayers = [...finalPlayers].sort((a, b) => b.score - a.score);
    const highestScore = sortedPlayers.length ? sortedPlayers[0].score : 0;
    const lowestScore = sortedPlayers.length ? sortedPlayers[sortedPlayers.length - 1].score : 0;
    const winners = sortedPlayers.filter(p => p.score === highestScore);
    const losers = sortedPlayers.filter(p => p.score === lowestScore);

    const currentPlayerId = selectedChild?.id || 'player1';
    const amIWinner = winners.some(w => w.id === currentPlayerId);
    const amILoser = losers.some(l => l.id === currentPlayerId);
    
    let personalFeedback = 'Great effort!';
    if (amIWinner) {
      personalFeedback = winners.length === 1 ? 'You are the Winner! 🎉 Excellent work!' : 'You tied for 1st place! 🥳';
    } else if (amILoser) {
      personalFeedback = 'Keep practicing to improve! 💪';
    } else {
      personalFeedback = 'Nice job — keep solving to climb to the top!';
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/20 via-secondary/20 to-accent/20 p-4">
        <Background3D />
        <Card className="max-w-lg mx-auto bg-white/90 shadow-xl">
          <CardHeader className="text-center">
            {amILoser ? (
              <>
                <div className="text-6xl mb-4">😢</div>
                <CardTitle className="text-2xl font-fredoka text-primary">
                  Better luck next time, {selectedChild?.name || 'Player'}.
                </CardTitle>
              </>
            ) : (
              <>
                <div className="text-6xl mb-4">🎉</div>
                <CardTitle className="text-2xl font-fredoka text-primary">
                  Great Job, {selectedChild?.name || 'Player'}!
                </CardTitle>
              </>
            )}
            <div className="mt-2">
              <div className={`inline-block px-3 py-1 rounded-full text-sm ${
                amIWinner ? 'bg-green-100 text-green-800' : amILoser ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-50 text-blue-800'
              }`}>
                {personalFeedback}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 text-center">
            <div className="space-y-4">
              <p className="text-lg text-muted-foreground">Final Scoreboard:</p>
              {sortedPlayers.map((player, index) => {
                const isWinner = player.score === highestScore;
                const isLoser = player.score === lowestScore;
                return (
                  <div
                    key={player.id}
                    className={`flex items-center justify-between rounded-lg p-3 transition-all ${
                      isWinner ? 'bg-green-50 border-2 border-green-200' : isLoser ? 'bg-red-50 border border-red-100' : 'bg-secondary/10'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="text-xl">{isWinner ? '👑' : `${index + 1}.`}</div>
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="text-lg">{player.avatar}</AvatarFallback>
                      </Avatar>
                      <div className="text-left">
                        <div className="font-medium text-primary">{player.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {safeCorrectWords(player)}/{totalWords} words completed
                        </div>
                      </div>
                    </div>
                    <span className="text-xl font-bold text-primary">{player.score} pts</span>
                  </div>
                );
              })}

              <div className="flex justify-center mt-4">
                {Array.from({ length: 3 }, (_, i) => (
                  <span key={i} className={`text-2xl ${i < starsEarned ? 'text-yellow-500' : 'text-gray-300'}`}>
                    ⭐
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <Button
                onClick={handlePlayAgain}
                className="w-full bg-primary hover:bg-primary/90"
                size="lg"
              >
                🔄 Play Again in Same Room
              </Button>
              <Button
                onClick={() => navigate('/games')}
                variant="outline"
                className="w-full border-input hover:bg-secondary/10"
                size="lg"
              >
                Back to Games
              </Button>
              <Button
                onClick={() => navigate('/progress')}
                variant="outline"
                className="w-full border-input hover:bg-secondary/10"
                size="lg"
              >
                View Progress ⭐
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!puzzleData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-500 to-purple-600">
        <Background3D />
        <Card className="max-w-md mx-auto bg-pink-100/90">
          <CardContent className="text-center py-8">
            <p className="text-lg text-pink-700">No crossword available for {selectedCategory} - {difficulty}.</p>
            <Button onClick={() => navigate('/games')} className="mt-4 bg-pink-600 hover:bg-pink-700 text-white">
              Back to Games
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const acrossWords = puzzleData.words.filter(w => w.direction === 'across');
  const downWords = puzzleData.words.filter(w => w.direction === 'down');

  // Playing Phase - Main Crossword Grid
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/20 via-secondary/20 to-accent/20 p-4">
      <Background3D />

      {/* Join Request Notification */}
      {isRoomCreator && pendingJoinRequests > 0 && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50">
          <Card className="bg-yellow-100 border-yellow-300 shadow-lg animate-pulse">
            <CardContent className="py-3 px-4">
              <div className="flex items-center space-x-2">
                <span className="text-yellow-600 text-lg">🔔</span>
                <span className="text-yellow-800 font-medium">
                  {pendingJoinRequests} player{pendingJoinRequests > 1 ? 's' : ''} want{pendingJoinRequests === 1 ? 's' : ''} to join!
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Game Timer */}
      <div className="fixed top-4 left-4 z-50">
        <Card className="bg-white/95 shadow-lg">
          <CardContent className="py-2 px-4">
            <div className="flex items-center space-x-2">
              <span className="text-xl">⏱️</span>
              <span className={`text-lg font-bold ${gameTimer < 60 ? 'text-red-500' : 'text-primary'}`}>
                {formatTime(gameTimer)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Scoreboard Panel */}
      <div className="fixed top-4 right-4 z-50 w-72">
        <Card className="bg-white/95 shadow-lg">
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-sm">Players</CardTitle>
          </CardHeader>
          <CardContent className="py-2 px-3">
            <div className="space-y-2 max-h-64 overflow-auto">
              {[...visiblePlayers].sort((a, b) => b.score - a.score).map((player, idx) => (
                <div key={player.id} className="flex items-center justify-between player-row">
                  <div className="flex items-center space-x-2">
                    <Avatar className="w-6 h-6">
                      <AvatarFallback className="text-sm">{player.avatar}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="text-sm truncate">{idx === 0 ? `👑 ${player.name}` : player.name}</span>
                      <span className="text-xs text-muted-foreground">{safeCorrectWords(player)} words</span>
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-primary">
                    {player.score}
                  </div>
                </div>
              ))} 
            </div>
          </CardContent>
        </Card>
      </div>

      {/* New Player Dialog */}
      {showNewPlayerDialog && newPlayerInfo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="max-w-md mx-4">
            <CardHeader>
              <CardTitle>New Player Joined!</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                <strong>{newPlayerInfo.name}</strong> wants to join the game.
              </p>
              <p className="text-sm text-muted-foreground">
                Would you like to restart the game or continue playing?
              </p>
              <div className="flex gap-2">
                <Button onClick={() => handleNewPlayerResponse(true)} className="flex-1">
                  Restart Game
                </Button>
                <Button onClick={() => handleNewPlayerResponse(false)} variant="outline" className="flex-1">
                  Continue Playing
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {gamePhase !== 'playing' && (
        <GameRoomPanel
          roomCode={roomCode}
          gameId={gameId || 'crossword'}
          onPlayerJoin={handlePlayerJoin}
          players={players}
          gameMode={roomCode ? 'multiplayer' : 'single'}
          onJoinRequestUpdate={handleJoinRequestUpdate}
        />
      )}

      {/* Main Game Area */}
      <div className="container mx-auto max-w-7xl">
        <div className="text-center mb-4 flex items-center justify-center gap-4">
          <img 
            src={(() => {
              const themeImages: Record<string, string> = {
                'Christmas': '/images/crossword-christmas.svg',
                'Animals': '/images/crossword-animals.svg',
                'Space': '/images/crossword-space.svg',
                'Ocean': '/images/crossword-ocean.svg'
              };
              return themeImages[selectedCategory] || themeImages['Christmas'];
            })()} 
            alt={`${selectedCategory} theme`}
            className="w-16 h-16 object-contain"
          />
          <div>
            <h2 className="text-2xl font-fredoka text-primary">{selectedCategory} Crossword Puzzle</h2>
            <Badge variant="secondary" className="mt-1">{difficulty.toUpperCase()}</Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Clues - Left Side */}
          <Card className="bg-white/90 shadow-xl max-h-[600px] overflow-y-auto">
            <CardHeader>
              <CardTitle className="text-lg">Clues</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Across Clues */}
              <div>
                <h3 className="font-semibold text-primary mb-2">ACROSS</h3>
                <div className="space-y-2">
                  {acrossWords.map(word => (
                    <div 
                      key={word.id}
                      className={`text-sm cursor-pointer p-2 rounded ${
                        selectedWordId === word.id ? 'bg-blue-100 border border-blue-300' : 'hover:bg-gray-100'
                      }`}
                      onClick={() => {
                        setSelectedWordId(word.id);
                        setSelectedDirection('across');
                        setSelectedCell({ row: word.startRow, col: word.startCol });
                      }}
                    >
                      <strong>{word.number}.</strong> {word.clue}
                    </div>
                  ))}
                </div>
              </div>

              {/* Down Clues */}
              <div>
                <h3 className="font-semibold text-primary mb-2">DOWN</h3>
                <div className="space-y-2">
                  {downWords.map(word => (
                    <div 
                      key={word.id}
                      className={`text-sm cursor-pointer p-2 rounded ${
                        selectedWordId === word.id ? 'bg-blue-100 border border-blue-300' : 'hover:bg-gray-100'
                      }`}
                      onClick={() => {
                        setSelectedWordId(word.id);
                        setSelectedDirection('down');
                        setSelectedCell({ row: word.startRow, col: word.startCol });
                      }}
                    >
                      <strong>{word.number}.</strong> {word.clue}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Crossword Grid - Center */}
          <div className="lg:col-span-2">
            <Card className="bg-white/90 shadow-xl p-4">
              <div className="flex justify-center">
                <div 
                  className="grid gap-0 border-2 border-gray-800"
                  style={{
                    gridTemplateColumns: `repeat(${puzzleData.gridSize}, minmax(0, 1fr))`,
                    maxWidth: '600px',
                    aspectRatio: '1'
                  }}
                >
                  {grid.map((row, rowIndex) => (
                    row.map((cell, colIndex) => {
                      const isSelected = selectedCell?.row === rowIndex && selectedCell?.col === colIndex;
                      const isInSelectedWord = selectedWordId && cell.wordIds.includes(selectedWordId);
                      
                      return (
                        <div
                          key={`${rowIndex}-${colIndex}`}
                          onClick={() => handleCellClick(rowIndex, colIndex)}
                          className={`
                            relative border border-gray-400 flex items-center justify-center font-bold text-lg
                            ${cell.isBlack ? 'bg-black' : 'bg-white cursor-pointer'}
                            ${isSelected ? 'ring-2 ring-blue-500 bg-blue-100' : ''}
                            ${isInSelectedWord && !isSelected ? 'bg-yellow-50' : ''}
                            ${cell.userLetter && cell.userLetter === cell.letter ? 'text-green-600' : ''}
                            ${cell.userLetter && cell.userLetter !== cell.letter ? 'text-red-600' : ''}
                          `}
                          style={{
                            aspectRatio: '1',
                            minWidth: '30px',
                            minHeight: '30px'
                          }}
                        >
                          {!cell.isBlack && cell.number && (
                            <span className="absolute top-0 left-0 text-[8px] font-normal text-gray-600 p-0.5">
                              {cell.number}
                            </span>
                          )}
                          {!cell.isBlack && (cell.userLetter || '')}
                        </div>
                      );
                    })
                  ))}
                </div>
              </div>

              <div className="mt-4 text-center text-sm text-muted-foreground">
                <p>Click a cell and type to fill in letters. Use arrow keys to navigate.</p>
                <p className="mt-1">Click clues to highlight words on the grid.</p>
              </div>

              <div className="flex justify-center space-x-3 mt-4">
                <Button
                  onClick={() => navigate('/games')}
                  variant="outline"
                  className="border-pink-300 text-pink-700"
                  size="sm"
                >
                  ← Back to Games
                </Button>
                <Button
                  onClick={() => {
                    if (window.confirm('Are you sure you want to give up?')) {
                      finishGame();
                    }
                  }}
                  variant="outline"
                  className="border-red-300 text-red-700"
                  size="sm"
                >
                  Give Up
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CrosswordGame;
