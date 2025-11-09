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
import { ToastAction } from '@/components/ui/toast';
import GameRoomPanel from "@/components/Multiplayer/GameRoomPanel";
import { AppHeader } from "@/components/Navigation/AppHeader";
import riddlesData from "@/config/riddles.json";
import type { Riddle, GameResult } from "@/types";
import { supabase } from "@/integrations/supabase/client";

// add attempts to Player type so we can show number of questions attempted during play
type Player = {
  id: string;
  name: string;
  avatar: string;
  score: number;
  attempts?: number;
  isAI?: boolean;
  streak?: number; // NEW
};

type GamePhase = 'theme-select' | 'setup' | 'countdown' | 'playing' | 'scoreboard' | 'complete';

const RiddleGame = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { gameId } = useParams();
  const { selectedChild } = useAppContext();
  const { updateGameResult } = useProgress();
  const { toast } = useToast();

  // Local UI / game state
  const difficulty = searchParams.get('difficulty') || 'easy';
  const paramRoom = searchParams.get('room')?.toUpperCase() || null;

  const [roomCode, setRoomCode] = useState<string | null>(paramRoom);
  const [players, _setPlayers] = useState<Player[]>([]);
  const playersRef = useRef<Player[]>([]);
  const setPlayersSafe = (next: Player[] | ((prev: Player[]) => Player[])) => {
    // functional or direct update supported
    const resolved = typeof next === 'function' ? (next as (p: Player[]) => Player[])(playersRef.current) : next;
    playersRef.current = resolved;
    _setPlayers(resolved);
  };

  const [selectedCategory, setSelectedCategory] = useState<string>('Zoo Animals');
  const [gamePhase, setGamePhase] = useState<GamePhase>('theme-select');
  const [waitingForPlayers, setWaitingForPlayers] = useState(false);
  const [currentRiddleIndex, setCurrentRiddleIndex] = useState(0);
  const [gameTimer, setGameTimer] = useState(0);
  const [finalPlayersSnapshot, setFinalPlayersSnapshot] = useState<Player[] | null>(null);
  const [finalPlayerScore, setFinalPlayerScore] = useState<number | null>(null);
  const [showNewPlayerDialog, setShowNewPlayerDialog] = useState(false);
  const [newPlayerInfo, setNewPlayerInfo] = useState<Player | null>(null);
  // incoming rematch request state for showing a popup/modal
  const [incomingRematch, setIncomingRematch] = useState<any | null>(null);

  const gameEndedRef = useRef(false);
  const scoreboardPollRef = useRef<number | null>(null);
  const countdownTimerRef = useRef<number | null>(null);
  const fallbackTimeoutRef = useRef<number | null>(null);
  const gameTimerRef = useRef<number | null>(null);
  const feedbackTimeoutRef = useRef<number | null>(null);
  const [playerProgress, setPlayerProgress] = useState({});
  const playerProgressRef = useRef({});

  const GAME_DURATION = 300; // 5 minutes

  // Room state
  const [isRoomCreator, setIsRoomCreator] = useState(false);
  const [pendingJoinRequests, setPendingJoinRequests] = useState(0);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);

  // UI states related to Q/A
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [countdown, setCountdown] = useState(3);

  // NEW: transient feedback banner for answers
  const [feedbackBanner, setFeedbackBanner] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const feedbackTimerRef = useRef<number | null>(null);

  // NEW: confetti toggle state
  const [showConfetti, setShowConfetti] = useState(false);
  const confettiTimerRef = useRef<number | null>(null);

  // Initialize room or single-player when params or selectedChild change
  useEffect(() => {
    const param = searchParams.get('room')?.toUpperCase() || null;
    setRoomCode(param);

    if (param) {
      // multiplayer mode: load participants from DB
      loadRoomData(param);
    } else {
      // single player default setup (ensure attempts initialized)
      const playerName = selectedChild?.name || 'Player';
      setSelectedCategory('Zoo Animals');
      const newPlayers: Player[] = [
        {
          id: selectedChild?.id || 'player1',
          name: playerName,
          avatar: selectedChild?.avatar || '👤',
          score: 0,
          attempts: 0,
          streak: 0 // NEW
        },
        {
          id: 'ai1',
          name: 'Vini',
          avatar: '🐵',
          score: 0,
          attempts: 0,
          isAI: true,
          streak: 0 // NEW
        }
      ];
      setPlayersSafe(newPlayers);
      // move to countdown mode
      setGamePhase('countdown');
      startCountdown();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, selectedChild]);

  const loadRoomData = async (roomCodeParam?: string | null) => {
    const rc = roomCodeParam ?? roomCode;
    if (!rc || !selectedChild) return;

    try {
      // Get room details
      const { data: roomData } = await supabase
        .from('game_rooms')
        .select('*')
        .eq('room_code', rc)
        .single();

      if (roomData) {
        setCurrentRoomId(roomData.id);
        setIsRoomCreator(roomData.host_child_id === selectedChild.id);

        // Load room participants
        const { data: participants } = await supabase
          .from('room_participants')
          .select('*')
          .eq('room_id', roomData.id);

        if (participants && participants.length) {
          const playerList: Player[] = participants.map((p: any) => ({
            id: p.child_id || p.id,
            name: p.player_name || 'Player',
            avatar: p.player_avatar || '👤',
            score: 0,
            attempts: 0,
            isAI: !!p.is_ai,
            streak: 0 // NEW
          }));

          setPlayersSafe(playerList);

          // Multiplayer: when another human joins, do NOT auto-start the game.
          const hasAI = playerList.some(p => p.isAI);
          const humanCount = playerList.filter(p => !p.isAI).length;

          if (hasAI && playerList.length === 1) {
            // solo with AI: proceed to countdown
            setGamePhase('countdown');
            startCountdown();
            await initializeGameScores(roomData.id, playerList);
          } else if (playerList.length >= 2) {
            // Two or more humans: show theme selection / waiting state until host chooses a theme
            setWaitingForPlayers(false);
            // If room already has a selected category and is already playing, follow it
            if ((roomData as any).selected_category) {
              setSelectedCategory((roomData as any).selected_category);
            }
            if (roomData.status === 'playing' && (roomData as any).selected_category) {
              // If the server already marked the room as playing, start immediately
              await initializeGameScores(roomData.id, playerList);
              setGamePhase('countdown');
              startCountdown();
            } else {
              // stay in theme-select so host can pick theme; guests will see waiting messages
              setGamePhase('theme-select');
            }

            // Subscribe to participant changes to keep the player list in sync (but DO NOT auto-start)
            const channel = supabase
              .channel(`riddle-room-participants-${roomData.id}`)
              .on('postgres_changes', { event: '*', schema: 'public', table: 'room_participants', filter: `room_id=eq.${roomData.id}` }, (payload) => {
                const rec: any = payload.new || payload.old;
                if (!rec) return;
                const newPlayer: Player = {
                  id: rec.child_id || rec.id,
                  name: rec.player_name || 'Player',
                  avatar: rec.player_avatar || '👤',
                  score: 0,
                  isAI: !!rec.is_ai
                };
                setPlayersSafe(prev => {
                  const exists = prev.some(p => p.id === newPlayer.id);
                  if (exists) return prev.map(p => p.id === newPlayer.id ? { ...p, ...newPlayer } : p);
                  const next = [...prev, newPlayer];
                  // when enough players arrive, clear waiting but do not auto-start
                  if (next.some(p => p.isAI) || next.length >= 2) {
                    setWaitingForPlayers(false);
                  }
                  return next;
                });
              })
              .subscribe();

            // cleanup subscription when leaving
            const unsubscribe = () => {
              try {
                supabase.removeChannel(channel);
              } catch (e) { /* ignore */ }
            };
            (window as any).__riddle_room_cleanup = unsubscribe;
          } else {
            // Wait for additional players to join
            setWaitingForPlayers(true);
            setGamePhase('theme-select');
          }

          // Initialize scores in database in background
          initializeGameScores(roomData.id, playerList).catch((e) => {
            console.error('Error initializing game scores:', e);
          });
        } else {
          // No participants found, still start the game for the host (solo)
          setPlayersSafe([{
            id: selectedChild.id || 'player1',
            name: selectedChild.name || 'Player',
            avatar: selectedChild.avatar || '👤',
            score: 0,
            attempts: 0
          }]);
          setGamePhase('countdown');
          startCountdown();
        }
      } else {
        // If room not found, fallback to single player
        const playerName = selectedChild?.name || 'Player';
        setPlayersSafe([{
          id: selectedChild?.id || 'player1',
          name: playerName,
          avatar: selectedChild?.avatar || '👤',
          score: 0
        }]);
        setGamePhase('countdown');
        startCountdown();
      }
    } catch (error) {
      console.error('Error loading room data:', error);
      // Fallback to single player
      const playerName = selectedChild?.name || 'Player';
      setPlayersSafe([{
        id: selectedChild?.id || 'player1',
        name: playerName,
        avatar: selectedChild?.avatar || '👤',
        score: 0
      }]);
      setGamePhase('countdown');
      startCountdown();
    }
  };

  const initializeGameScores = async (roomId: string, playerList: Player[]) => {
    try {
      // Clear existing scores for this room
      await supabase
        .from('multiplayer_game_scores')
        .delete()
        .eq('room_id', roomId);

      // Insert initial scores for all players
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

      // immediately sync attempts/scores from DB (authoritative)
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

  const startCountdown = () => {
    if (gameEndedRef.current) return; // don't start if game already finished

    // ensure the UI is aware we're in countdown
    setGamePhase('countdown');

    // Clear any existing timer
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
        // move to playing and start game timer
        setGamePhase('playing');
        startGameTimer();
      }
    }, 1000);
    countdownTimerRef.current = id;

    // Hard fallback: force transition after 4.5s even if interval fails
    fallbackTimeoutRef.current = window.setTimeout(() => {
      if (!gameEndedRef.current) {
        setGamePhase('playing');
        startGameTimer();
      }
    }, 4500);
  };

  const startGameTimer = () => {
    if (gameEndedRef.current) return; // guard against restarting after finish

    // Clear any existing game timer
    clearIntervalRef(gameTimerRef);

    setGameTimer(GAME_DURATION);
    const id = window.setInterval(() => {
      setGameTimer(prev => {
        if (prev <= 1) {
          try { window.clearInterval(id); } catch (e) { /* ignore */ }
          gameTimerRef.current = null;
          finishGame();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    gameTimerRef.current = id;
  };

  // Failsafe: ensure transition to playing when countdown completes (keeps UI consistent)
  useEffect(() => {
    if (gamePhase === 'countdown' && countdown <= 0) {
      setGamePhase('playing');
      startGameTimer();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown, gamePhase]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      clearIntervalRef(countdownTimerRef);
      clearTimeoutRef(fallbackTimeoutRef);
      clearIntervalRef(gameTimerRef);
      clearTimeoutRef(feedbackTimeoutRef);
      clearIntervalRef(scoreboardPollRef);

      // remove any supabase channel cleanup
      const cleanup = (window as any).__riddle_room_cleanup;
      if (typeof cleanup === 'function') {
        try { cleanup(); } catch (e) { /* ignore */ }
        delete (window as any).__riddle_room_cleanup;
      }
    };
  }, []);

  // Get riddles for selected category and difficulty
  const getCategoryRiddles = (category: string) => {
    const categoryData = (riddlesData as any)[category];
    if (categoryData && categoryData[difficulty]) {
      return categoryData[difficulty] as Riddle[];
    }
    return [];
  };

  const gameRiddles = getCategoryRiddles(selectedCategory) || [];
  const currentRiddle = gameRiddles[currentRiddleIndex];

  const humanPlayersCount = players.filter(p => !p.isAI).length;
  const hostCanSelectTheme = !!roomCode ? (isRoomCreator && humanPlayersCount >= 2) : true;
  const canSelectTheme = hostCanSelectTheme;

  const simulateAIAnswers = () => {
    // Simulate AI players answering with random delays
    const aiPlayers = playersRef.current.filter(p => p.isAI);
    aiPlayers.forEach((aiPlayer, index) => {
      const delay = (index + 1) * 1500 + Math.random() * 1000;
      setTimeout(async () => {
        const isCorrect = Math.random() > 0.4; // 60% chance correct
        // Update AI streak/score/attempts locally
        setPlayersSafe(prev => prev.map(p => {
          if (p.id !== aiPlayer.id) return p;
          const newStreak = isCorrect ? (p.streak ?? 0) + 1 : 0;
          return { ...p, score: p.score + (isCorrect ? 1 : 0), attempts: (p.attempts ?? 0) + 1, streak: newStreak };
        }));
        // Update AI score in database for multiplayer
        if (currentRoomId) {
          await updateAIPlayerScore(aiPlayer.id, isCorrect ? 1 : 0);
        }
      }, delay);
    });
  };

  const updateAIPlayerScore = async (aiPlayerId: string, scoreIncrement: number) => {
    if (!currentRoomId) return;

    try {
      // Find the AI entry by name within this room (child_id null)
      const aiPlayer = playersRef.current.find(p => p.id === aiPlayerId);
      if (!aiPlayer) return;
      const { data: currentScore } = await supabase
        .from('multiplayer_game_scores')
        .select('score, total_questions')
        .eq('room_id', currentRoomId)
        .eq('is_ai', true)
        .eq('child_id', null)
        .eq('player_name', aiPlayer.name)
        .single();

      if (currentScore) {
        await supabase
          .from('multiplayer_game_scores')
          .update({
            score: currentScore.score + scoreIncrement,
            total_questions: currentScore.total_questions + 1
          })
          .eq('room_id', currentRoomId)
          .eq('is_ai', true)
          .eq('child_id', null)
          .eq('player_name', aiPlayer.name);
        // sync local players from DB after updating
        await fetchRoomScores(currentRoomId);
      }
    } catch (error) {
      console.error('Error updating AI player score:', error);
    }
  };

  // Fetch latest scores from DB and reconcile into local players state
  const fetchRoomScores = async (roomId: string | null) => {
    if (!roomId) return;
    try {
      const { data: rows, error, status } = await supabase
        .from('multiplayer_game_scores')
        .select('child_id, player_name, player_avatar, is_ai, score, total_questions')
        .eq('room_id', roomId);

      if (error) {
        console.error('fetchRoomScores error', error, status);
        return;
      }
      if (!rows) return;

      // Build authoritative player list from DB rows, mapping total_questions -> attempts
      const nextPlayers: Player[] = rows.map((r: any) => ({
        id: r.child_id ?? `ai-${r.player_name}`,
        name: r.player_name,
        avatar: r.player_avatar ?? '👤',
        score: typeof r.score === 'number' ? r.score : 0,
        attempts: typeof r.total_questions === 'number' ? r.total_questions : 0,
        isAI: !!r.is_ai,
        streak: 0 // DB doesn't track streaks — start at 0 on sync
      }));

      setPlayersSafe(nextPlayers);
    } catch (err) {
      console.error('fetchRoomScores failed', err);
    }
  };

  const handlePlayerJoin = (newPlayer: any) => {
    // Add new player if not already in the list
    const exists = playersRef.current.find(p => p.id === newPlayer.id);
    if (!exists && gamePhase === 'playing') {
      // Show dialog asking if game should restart
      setNewPlayerInfo({
        id: newPlayer.id,
        name: newPlayer.name,
        avatar: newPlayer.avatar,
        score: 0,
        attempts: 0,
        isAI: newPlayer.isAI
      });
      setShowNewPlayerDialog(true);
    } else if (!exists) {
      setPlayersSafe(prev => [...prev, {
        id: newPlayer.id,
        name: newPlayer.name,
        avatar: newPlayer.avatar,
        score: 0,
        attempts: 0,
        isAI: newPlayer.isAI
      }]);
    }
  };

  const handleNewPlayerResponse = (restart: boolean) => {
    if (newPlayerInfo) {
      setPlayersSafe(prev => [...prev, newPlayerInfo]);
      if (restart) {
        handlePlayAgain();
      }
    }
    setShowNewPlayerDialog(false);
    setNewPlayerInfo(null);
  };

  // KEYBOARD SHORTCUTS: A/B/C/D or 1-4 to select options
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (gamePhase !== 'playing' || showFeedback || !currentRiddle) return;
      const key = e.key.toLowerCase();
      let idx: number | null = null;
      if (key >= '1' && key <= '4') idx = parseInt(key, 10) - 1;
      if (key >= 'a' && key <= 'd') idx = key.charCodeAt(0) - 'a'.charCodeAt(0);
      if (idx !== null && currentRiddle.options[idx]) {
        e.preventDefault();
        handleAnswerSelect(currentRiddle.options[idx]);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gamePhase, showFeedback, currentRiddle]);

  const clearFeedback = () => {
    if (feedbackTimerRef.current) { try { window.clearTimeout(feedbackTimerRef.current); } catch(_){} feedbackTimerRef.current = null; }
    setFeedbackBanner(null);
  };
  const showTemporaryFeedback = (message: string, type: 'success'|'error'|'info' = 'info') => {
    clearFeedback();
    setFeedbackBanner({ message, type });
    feedbackTimerRef.current = window.setTimeout(() => setFeedbackBanner(null), 1600);
  };

  const triggerConfetti = () => {
    if (confettiTimerRef.current) { try { window.clearTimeout(confettiTimerRef.current); } catch(_){} confettiTimerRef.current = null; }
    setShowConfetti(true);
    confettiTimerRef.current = window.setTimeout(() => setShowConfetti(false), 1400);
  };

  const handleAnswerSelect = async (answer: string) => {
    if (showFeedback || gameEndedRef.current) return;
    if (!currentRiddle) return;

    setSelectedAnswer(answer);
    setShowFeedback(true);

    const correctIdx = currentRiddle.correctAnswer;
    const correctText = currentRiddle.options[correctIdx];
    const isCorrect = answer === correctText;

    const playerId = selectedChild?.id ?? 'player1';
    const baseIncrement = isCorrect ? 1 : 0;

    // compute streak locally & update players
    setPlayersSafe(prev => prev.map(p => {
      if (p.id !== playerId) return p;
      const prevStreak = p.streak ?? 0;
      const newStreak = isCorrect ? prevStreak + 1 : 0;
      return {
        ...p,
        score: p.score + baseIncrement,
        attempts: (p.attempts ?? 0) + 1,
        streak: newStreak
      };
    }));

    // Feedback & confetti
    if (isCorrect) {
      showTemporaryFeedback(`Correct! 🔥 Streak +1`, 'success');
      triggerConfetti();
    } else {
      showTemporaryFeedback(`Oops — that's incorrect. 😕`, 'error');
    }

    // Persist base score if multiplayer
    if (currentRoomId) {
      try {
        await updatePlayerScore(playerId, baseIncrement);
        await fetchRoomScores(currentRoomId);
      } catch (err) {
        console.error('updatePlayerScore failed', err);
      }
    }

    // simulate AI answers (unchanged but AI now updates streak)
    simulateAIAnswers();

    // store feedback timeout so finishGame can clear it
    clearTimeoutRef(feedbackTimeoutRef);
    feedbackTimeoutRef.current = window.setTimeout(() => {
      setShowFeedback(false);
      setSelectedAnswer(null);
      if (!gameEndedRef.current) nextQuestion();
      feedbackTimeoutRef.current = null;
    }, 2000);
  };

  const updatePlayerScore = async (playerId: string, scoreIncrement: number) => {
    // Persist only; local state should be updated by caller via setPlayersSafe
    if (!currentRoomId) return;
    try {
      // Find the player's DB row
      const player = playersRef.current.find(p => p.id === playerId);
      if (!player) return;

      // Attempt to get existing row
      const { data: currentScore } = await supabase
        .from('multiplayer_game_scores')
        .select('score, total_questions')
        .eq('room_id', currentRoomId)
        .eq('player_name', player.name)
        .maybeSingle();

      if (currentScore) {
        await supabase
          .from('multiplayer_game_scores')
          .update({
            score: currentScore.score + scoreIncrement,
            total_questions: currentScore.total_questions + 1
          })
          .eq('room_id', currentRoomId)
          .eq('player_name', player.name);
        // refresh local copy after update
        await fetchRoomScores(currentRoomId);
      } else {
        // If row missing, insert a row for this player
        await supabase
          .from('multiplayer_game_scores')
          .insert([{
            room_id: currentRoomId,
            child_id: player.isAI ? null : playerId,
            player_name: player.name,
            player_avatar: player.avatar,
            is_ai: player.isAI || false,
            score: scoreIncrement,
            total_questions: 1
          }]);
        // and refresh
        await fetchRoomScores(currentRoomId);
      }
    } catch (err) {
      console.error('Failed to persist player score', err);
    }
  };

  const nextQuestion = () => {
    if (currentRiddleIndex < gameRiddles.length - 1) {
      setCurrentRiddleIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setShowFeedback(false);
      // Stay in playing phase, no countdown between questions
    } else {
      finishGame();
    }
  };

  const finishGame = async () => {
    if (gameEndedRef.current) return; // idempotent

    const totalQuestions = Math.max(1, gameRiddles.length);
    const playerId = selectedChild?.id || 'player1';

    // Persist latest scores first
    if (currentRoomId) {
      try { await fetchRoomScores(currentRoomId); } catch (e) { /* ignore */ }

      // Tell the server this player has finished their questions. The server will
      // update a room-level player_progress and, if everyone finished, mark the room as finished.
      try {
        const res = await supabase.functions.invoke('manage-game-rooms', {
          body: {
            action: 'mark_player_finished',
            room_id: currentRoomId,
            child_id: playerId,
            total_questions: totalQuestions
          }
        });

        // res.data may include { all_finished: boolean }
        const resp = res.data;
        const allFinished = resp?.all_finished ?? false;

        if (allFinished) {
          // server decided everyone finished — finalize immediately
          await finalizeGame();
          return;
        }

        // Not everyone finished yet — show waiting scoreboard and rely on realtime updates
        setGamePhase('scoreboard');
        gameEndedRef.current = true;

        // Fallback poll in case realtime misses the final update
        clearIntervalRef(scoreboardPollRef);
        scoreboardPollRef.current = window.setInterval(async () => {
          try {
            await fetchRoomScores(currentRoomId);
            const nowAll = (playersRef.current || players).every(p => (p.attempts ?? 0) >= totalQuestions);
            if (nowAll) {
              clearIntervalRef(scoreboardPollRef);
              await finalizeGameAfterWait();
            }
          } catch (e) { /* ignore */ }
        }, 2000);

        return;
      } catch (err) {
        console.error('mark_player_finished failed', err);
        // fallback to previous behaviour
        const allFinished = (playersRef.current || players).every(p => (p.attempts ?? 0) >= totalQuestions);
        if (!allFinished) {
          setGamePhase('scoreboard');
          gameEndedRef.current = true;
          return;
        }
      }
    }

    // Single-player or fallback: finalize immediately
    await finalizeGame();
  };

  const finalizeGameAfterWait = async () => {
    // Called when polling/realtime detects all players finished
    await finalizeGame();
  };

  const finalizeGame = async () => {
    if (gameEndedRef.current !== true) {
      // ensure we mark ended
      gameEndedRef.current = true;
    }

    // attempt to sync final DB scores before snapshotting
    if (currentRoomId) {
      try { await fetchRoomScores(currentRoomId); } catch (e) { /* ignore */ }
    }

    // compute and store a final snapshot before switching to complete phase
    const finalPlayers = (playersRef.current && playersRef.current.length) ? playersRef.current : players;
    const playerScore = finalPlayers.find(p => p.id === (selectedChild?.id || 'player1'))?.score ?? 0;

    // store snapshot into state so UI reads this stable copy
    setFinalPlayersSnapshot(finalPlayers);
    setFinalPlayerScore(playerScore);

    // now switch phase — scoreboard will read from the snapshot
    setGamePhase('complete');

    // Clear any running timers so nothing restarts the game
    clearIntervalRef(countdownTimerRef);
    clearIntervalRef(gameTimerRef);
    clearTimeoutRef(fallbackTimeoutRef);
    clearTimeoutRef(feedbackTimeoutRef);
    clearIntervalRef(scoreboardPollRef);

    // compute totals & persist using the snapshot
    const totalQuestions = Math.max(1, currentRiddleIndex + 1);
    const percentage = (playerScore / totalQuestions);
    let starsEarned = 1;
    if (percentage >= 0.8) starsEarned = 3;
    else if (percentage >= 0.6) starsEarned = 2;

    const gameResult: GameResult = {
      gameId: 'riddle',
      profileId: selectedChild?.id || '',
      difficulty,
      correct: playerScore,
      total: totalQuestions,
      starsEarned,
      endedAt: new Date().toISOString()
    };
    updateGameResult(gameResult);

    toast({
      title: `Game Complete! ${starsEarned} ⭐`,
      description: `You got ${playerScore}/${totalQuestions} correct!`,
    });
  };

  const handlePlayAgain = async () => {
    // Multiplayer: send a rematch request to the room and wait for others to accept
    if (currentRoomId) {
      try {
        const payload = {
          requester_child_id: selectedChild?.id ?? null,
          requester_name: selectedChild?.name ?? 'Player',
          requested_at: new Date().toISOString()
        } as any;

        const { data: upData, error: upError, status: upStatus } = await supabase
          .from('game_rooms')
          .update({ play_again_request: payload } as any)
          .eq('id', currentRoomId)
          .select()
          .maybeSingle();

        if (upError) {
          console.error('Supabase update error (play_again_request):', upError, upStatus, upData);
          toast({ title: 'Rematch error', description: upError.message || 'Failed to request rematch.' });
        } else {
          // success
          toast({ title: 'Rematch requested', description: 'Waiting for other players to join the rematch.' });
        }
      } catch (e) {
        console.error('Failed to request rematch', e);
        toast({ title: 'Error', description: 'Could not request rematch.' });
      }
      return;
    }

    // Single-player or fallback: local reset
    gameEndedRef.current = false;
    setCurrentRiddleIndex(0);
    setSelectedAnswer(null);
    setShowFeedback(false);

    // Reset scores but keep players
    setPlayersSafe(prev => prev.map(p => ({ ...p, score: 0, attempts: 0 })));

    // Go directly to countdown/playing phase, restart game timer
    setGamePhase('playing');
    startGameTimer();
  };

  const acceptPlayAgain = async () => {
    if (!currentRoomId) return;
    try {
      // Re-initialize scores in DB and clear any play_again_request marker
      await initializeGameScores(currentRoomId, playersRef.current);

      // Ensure the room keeps the same selected_category. Fetch DB value and prefer it if present.
      const { data: roomRow } = await supabase.from('game_rooms').select('selected_category').eq('id', currentRoomId).maybeSingle();
      const categoryToSet = (roomRow && (roomRow as any).selected_category) || selectedCategory || null;

      const updatePayload: any = { play_again_request: null, status: 'playing' };
      if (categoryToSet) updatePayload.selected_category = categoryToSet;

      const { data: accData, error: accError, status: accStatus } = await supabase
        .from('game_rooms')
        .update(updatePayload)
        .eq('id', currentRoomId)
        .select()
        .maybeSingle();

      if (accError) {
        console.error('Supabase acceptPlayAgain update error:', accError, accStatus, accData);
        toast({ title: 'Rematch error', description: accError.message || 'Failed to start rematch.' });
        return;
      }
      // clients will get realtime update and transition to countdown/playing
    } catch (e) {
      console.error('Failed to accept play again', e);
      toast({ title: 'Error', description: 'Could not start rematch.' });
    }
  };
  const handleJoinRequestUpdate = (requestCount: number) => {
    setPendingJoinRequests(requestCount);
  };

  // Track last seen play_again_request to avoid duplicate toasts
  const lastPlayRequestRef = useRef<string | null>(null);

  // Cleanup any temporary room subscriptions created by loadRoomData
  useEffect(() => {
    return () => {
      const cleanup = (window as any).__riddle_room_cleanup;
      if (typeof cleanup === 'function') {
        try { cleanup(); } catch (e) { /* ignore */ }
        delete (window as any).__riddle_room_cleanup;
      }
    };
  }, []);

  const handleThemeSelect = (theme: string) => {
    // If this is a multiplayer room, only the room creator may select the theme
    if (roomCode && !isRoomCreator) {
      toast({ title: 'Waiting for host', description: 'Only the room creator can select the theme', variant: 'default' });
      return;
    }

    setSelectedCategory(theme);

    if (roomCode && isRoomCreator) {
      // Persist selection to the room so other participants receive it via realtime
      (async () => {
        try {
          // Persist only the selected category; don't mark as playing yet — host will start the game explicitly
          await supabase
            .from('game_rooms')
            .update({ selected_category: theme } as any)
            .eq('room_code', roomCode);
        } catch (e) {
          console.error('Failed to update room with selected theme', e);
        }
      })();
    }
    // remain in theme-select until host explicitly starts the game
  };

  // Subscribe to game_rooms updates so invited players learn when the host starts
  useEffect(() => {
    // subscribe to game_rooms updates by room code when available, otherwise by room id
    const filterBy = roomCode ? `room_code=eq.${roomCode}` : (currentRoomId ? `id=eq.${currentRoomId}` : null);
    if (!filterBy) return;

    const channelName = `game-room-updates-${roomCode ?? currentRoomId}`;

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'game_rooms', filter: filterBy }, (payload) => {
        const rec: any = payload.new;
        if (!rec) return;

        // If host selected a category, apply it locally even if status isn't 'playing' yet
        if (rec.selected_category) {
          setSelectedCategory(rec.selected_category);
          setWaitingForPlayers(false);
        }

        // Sync player progress if present
        if (rec.player_progress) {
          setPlayerProgress(rec.player_progress);
          playerProgressRef.current = rec.player_progress;
        }

        // Only transition to countdown when server sets status='playing'
        if (rec.status === 'playing') {
          setGamePhase('countdown');
          startCountdown();
        }

        // If server marks room finished (all players finished), finalize locally
        if (rec.status === 'finished') {
          // ensure we snapshot latest scores and move to complete
          finalizeGame().catch((e) => console.error('Failed to finalize on room finished update', e));
        }

        // If a play-again request was posted by someone, show a toast + popup to other players
        if (rec.play_again_request) {
          try {
            const req = rec.play_again_request as any;
            const key = `${req.requester_child_id || 'anon'}::${req.requested_at || ''}`;
            // avoid showing the same toast/modal multiple times
            if (lastPlayRequestRef.current === key) return;
            lastPlayRequestRef.current = key;

            // if this client is NOT the requester, show an accept toast and modal
            if (req.requester_child_id !== (selectedChild?.id)) {
              // set modal state so a pop-up appears on screen
              setIncomingRematch(req);
              const t = toast({
                title: `${req.requester_name || 'Player'} wants a rematch!`,
                description: 'Join the rematch with a fresh game — Tap Play to accept.',
                action: (
                  <ToastAction altText="Accept rematch" onClick={() => {
                    // dismiss the toast immediately and accept
                    try { t.dismiss(); } catch (_) {}
                    setIncomingRematch(null);
                    acceptPlayAgain();
                  }}>
                    Play
                  </ToastAction>
                )
              });
            } else {
              // requester sees a confirmation toast
              toast({ title: 'Rematch requested', description: 'Waiting for other players to accept.' });
            }
          } catch (e) {
            console.error('Failed to handle play_again_request realtime', e);
          }
        } else {
          // when play_again_request cleared on room, reset dedupe key and modal state so future requests show
          lastPlayRequestRef.current = null;
          setIncomingRematch(null);
        }
      })
      .subscribe();

    return () => { try { supabase.removeChannel(channel); } catch (e) { /* ignore */ } };
  }, [roomCode]);

  // Sync multiplayer scores in realtime so everyone sees updated scores as answers are recorded
  useEffect(() => {
    if (!currentRoomId) return;

    const channel = supabase
      .channel(`multiplayer-scores-${currentRoomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'multiplayer_game_scores', filter: `room_id=eq.${currentRoomId}` },
        (payload) => {
          // whenever a DB change happens, refresh the scores list from DB to keep everyone in sync
          fetchRoomScores(currentRoomId).catch((e) => { /* ignore */ });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentRoomId]);

  // Host explicit start handler: persist 'playing' status and kick off countdown
  const startGameAsHost = async () => {
    if (!roomCode || !currentRoomId) return;

    try {
      // Ensure initial scores exist for participants
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

    // Local optimistic transition while realtime notifies others
    setGamePhase('countdown');
    setWaitingForPlayers(false);
    startCountdown();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // NEW: decorative 3D background component (uses inline <style> so no extra files are required)
  const Background3D = () => (
    <>
      <div className="riddle-3d-bg" aria-hidden>
        <div className="riddle-layer layer1" />
        <div className="riddle-layer layer2" />
        <div className="riddle-layer layer3" />
        <div className="riddle-shape shape1" />
        <div className="riddle-shape shape2" />
      </div>
      <style>{`
        .riddle-3d-bg { position: fixed; inset: 0; z-index: -20; perspective: 1000px; pointer-events: none; overflow: hidden; }
        .riddle-layer { position: absolute; width: 140%; height: 140%; left: -20%; top: -20%; transform-origin: center; filter: blur(60px) saturate(120%); opacity: 0.75; }
        .riddle-layer.layer1 { background: radial-gradient(circle at 20% 20%, rgba(99,102,241,0.38), transparent 40%), radial-gradient(circle at 80% 80%, rgba(236,72,153,0.26), transparent 30%); animation: float 20s linear infinite; transform: translateZ(-200px) scale(1.2) rotateX(18deg); }
        .riddle-layer.layer2 { background: radial-gradient(circle at 50% 10%, rgba(34,197,94,0.2), transparent 30%), radial-gradient(circle at 10% 80%, rgba(59,130,246,0.18), transparent 30%); animation: float 28s linear infinite reverse; transform: translateZ(-100px) scale(1.05) rotateX(12deg); }
        .riddle-layer.layer3 { background: linear-gradient(120deg, rgba(245,158,11,0.05), rgba(236,72,153,0.04)); transform: translateZ(0) scale(1); opacity: 0.6; animation: float 35s linear infinite; }
        .riddle-shape { position: absolute; border-radius: 24px; mix-blend-mode: screen; filter: blur(20px); opacity: 0.95; transform-origin: center; animation: spin 20s linear infinite; }
        .riddle-shape.shape1 { width: 320px; height: 320px; left: 6%; top: 8%; background: linear-gradient(135deg, rgba(99,102,241,0.22), rgba(59,130,246,0.10)); transform: translateZ(180px) rotateY(22deg) rotateX(8deg); }
        .riddle-shape.shape2 { width: 420px; height: 420px; right: 6%; bottom: 4%; background: linear-gradient(135deg, rgba(236,72,153,0.20), rgba(245,158,11,0.06)); transform: translateZ(120px) rotateY(-18deg) rotateX(6deg); animation-duration: 26s; }
        @keyframes float { 0% { transform: translateY(0) } 50% { transform: translateY(-28px) } 100% { transform: translateY(0) } }
        @keyframes spin { 0% { transform: rotateY(0deg) rotateX(0deg) } 100% { transform: rotateY(360deg) rotateX(20deg) } }
        /* keep small shapes subtle on small screens */
        @media (max-width: 640px) {
          .riddle-shape.shape1, .riddle-shape.shape2 { display: none; }
          .riddle-layer { filter: blur(40px); }
        }

        /* UI enhancements */
        .ui-card { border-radius: 14px; box-shadow: 0 8px 30px rgba(2,6,23,0.12); }
        .answer-btn { transition: transform .16s ease, box-shadow .16s ease; border-radius: 10px; }
        .answer-btn:hover { transform: translateY(-4px) scale(1.02); box-shadow: 0 8px 20px rgba(2,6,23,0.08); }
        .answer-btn:active { transform: translateY(-2px) scale(0.998); }
        .answer-selected { box-shadow: 0 10px 30px rgba(34,197,94,0.14) !important; transform: translateY(-2px) !important; }
        .streak-badge { display:inline-flex; align-items:center; gap:6px; background: linear-gradient(90deg,#FFEDD5,#FFF7ED); color:#B45309; padding:2px 8px; border-radius:999px; font-weight:600; font-size:12px; margin-left:8px; box-shadow: 0 4px 10px rgba(11,15,30,0.06); }
        .keyboard-hint { font-size:12px; color:rgba(17,24,39,0.65); background:rgba(255,255,255,0.6); padding:6px 10px; border-radius:999px; display:inline-block; margin-top:8px; }
        .player-row:hover { transform: translateY(-4px); transition: transform .18s ease; box-shadow:0 10px 30px rgba(2,6,23,0.06); }
      `}</style>
    </>
  );

  // NEW: Confetti visual (very lightweight CSS-only)
  const Confetti = () => (
    <>
      {showConfetti && (
        <div className="confetti-wrapper" aria-hidden>
          {Array.from({ length: 18 }).map((_, i) => (
            <span key={i} className={`confetti confetti-${i%6}`} />
          ))}
        </div>
      )}
      <style>{`
        .confetti-wrapper { position: fixed; left:0; right:0; top:20%; pointer-events: none; z-index: 60; display:flex; justify-content:center; gap:6px; }
        .confetti { width:8px; height:14px; display:inline-block; transform-origin:center; opacity:0.95; animation: confetti-fall 1000ms linear forwards; border-radius:2px; }
        .confetti-0 { background:#FDE047; animation-delay:0ms; }
        .confetti-1 { background:#F87171; animation-delay:30ms; }
        .confetti-2 { background:#60A5FA; animation-delay:60ms; }
        .confetti-3 { background:#34D399; animation-delay:90ms; }
        .confetti-4 { background:#A78BFA; animation-delay:120ms; }
        .confetti-5 { background:#FB7185; animation-delay:150ms; }
        @keyframes confetti-fall {
          0% { transform: translateY(-10px) rotate(0deg) scale(1); opacity:1; }
          60% { transform: translateY(40px) rotate(120deg) scale(1.1); opacity:1; }
          100% { transform: translateY(140px) rotate(240deg) scale(0.95); opacity:0; }
        }
      `}</style>
    </>
  );

  // Theme Selection Phase
  if (gamePhase === 'theme-select') {
    const availableThemes = Object.keys(riddlesData as any);
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/20 to-secondary/20">
        <Background3D /> {/* <-- added */}
        <AppHeader title="Select Theme" showBackButton />
        <div className="container mx-auto px-4 py-6">
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="text-center text-2xl font-fredoka text-primary">
                Choose Your Riddle Theme
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {availableThemes.map((theme) => {
                  const isSelected = selectedCategory === theme;
                  return (
                    <Button
                      key={theme}
                      onClick={() => handleThemeSelect(theme)}
                      className={`h-24 text-lg font-medium ${isSelected ? 'ring-2 ring-green-400 shadow-md' : ''}`}
                      variant={isSelected ? 'default' : 'outline'}
                      disabled={!canSelectTheme}
                      title={!canSelectTheme ? (roomCode && !isRoomCreator ? 'Waiting for host to select theme' : 'Waiting for player to join') : undefined}
                    >
                      {theme === 'Zoo Animals' && '🦁 '}
                      {theme === 'Ocean Friends' && '🐋 '}
                      <span className="flex items-center justify-center">
                        {theme}
                        {isSelected && <Badge className="ml-3" variant="secondary">Selected</Badge>}
                      </span>
                    </Button>
                  );
                })}
                {/* Host waiting hint: host can't select until another human joins */}
                {roomCode && isRoomCreator && humanPlayersCount < 2 && (
                  <div className="text-center text-sm text-muted-foreground mt-3">
                    Waiting for the other player to join to select the theme…
                  </div>
                )}
                {/* Invited player hint: waiting for host selection */}
                {roomCode && !isRoomCreator && !selectedCategory && (
                  <div className="text-center text-sm text-muted-foreground mt-3">
                    Waiting for the host to select the theme and start the game…
                  </div>
                )}
                {/* If a theme is already selected, show Start for host, waiting message for guests */}
                {roomCode && selectedCategory && (
                  <div className="w-full mt-3">
                    {isRoomCreator ? (
                      <div className="flex justify-center">
                        <Button onClick={startGameAsHost} className="w-48">
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
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/20 via-secondary/20 to-accent/20 p-4 flex items-center justify-center">
        <Background3D /> {/* <-- added */}
        <Card className="max-w-md mx-auto bg-white/90 shadow-xl">
          <CardContent className="text-center py-16">
            <h2 className="text-2xl font-fredoka text-primary mb-4">
              {selectedCategory} Riddle Challenge
            </h2>
            <div className="flex justify-center space-x-2 mb-6">
              <span className="text-3xl">🐄</span>
              <span className="text-3xl">🐵</span>
              <span className="text-3xl">🐘</span>
            </div>
            <p className="text-lg text-muted-foreground mb-4">Get ready! Starting in...</p>
            <div className="text-6xl font-bold text-primary">
              {countdown > 0 ? countdown : "GO!"}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

      // Scoreboard Wait Phase (multiplayer) — show a waiting scoreboard until everyone has attempted all questions
      if (gamePhase === 'scoreboard') {
        const totalQuestions = Math.max(1, gameRiddles.length);
        return (
          <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/20 via-secondary/20 to-accent/20 p-4">
            <Background3D />
            <Card className="max-w-lg mx-auto bg-white/90 shadow-xl">
              <CardHeader className="text-center">
                <div className="text-4xl mb-2">⏳</div>
                <CardTitle className="text-2xl font-fredoka text-primary">Waiting for players to finish</CardTitle>
                <p className="text-sm text-muted-foreground mt-2">We'll show the final scoreboard once everyone has attempted all {totalQuestions} questions.</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {[...players].map((p) => (
                    <div key={p.id} className="flex items-center justify-between p-2 rounded-md bg-secondary/10">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-8 h-8"><AvatarFallback className="text-lg">{p.avatar}</AvatarFallback></Avatar>
                        <div>
                          <div className="font-medium text-primary">{p.name}</div>
                          <div className="text-xs text-muted-foreground">{p.attempts ?? 0}/{totalQuestions} attempted</div>
                        </div>
                      </div>
                      <div className="text-sm font-semibold">{p.score}</div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-center">
                  <Button onClick={async () => {
                    // allow manual force finalize for host in case of stuck state
                    if (!currentRoomId) return;
                    // fetch latest and check; if all finished, finalize
                    await fetchRoomScores(currentRoomId);
                    const totalQ = Math.max(1, gameRiddles.length);
                    const all = (playersRef.current || players).every(pp => (pp.attempts ?? 0) >= totalQ);
                    if (all) {
                      await finalizeGame();
                    } else {
                      toast({ title: 'Not all players finished', description: 'Please wait for everyone to finish their attempts.' });
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

  // Game Complete Phase — render using the stable snapshot (finalPlayersSnapshot)
  if (gamePhase === 'complete') {
    const finalPlayers = finalPlayersSnapshot ?? (playersRef.current.length ? playersRef.current : players);
    const playerScore = finalPlayerScore ?? finalPlayers.find(p => p.id === (selectedChild?.id || 'player1'))?.score ?? 0;
    const totalQuestions = Math.max(1, currentRiddleIndex + 1);
    const percentage = (playerScore / totalQuestions) * 100;

    let starsEarned = 1;
    if (percentage >= 80) starsEarned = 3;
    else if (percentage >= 60) starsEarned = 2;

    // Determine winners/losers
    const sortedPlayers = [...finalPlayers].sort((a, b) => b.score - a.score);
    const highestScore = sortedPlayers.length ? sortedPlayers[0].score : 0;
    const lowestScore = sortedPlayers.length ? sortedPlayers[sortedPlayers.length - 1].score : 0;
    const winners = sortedPlayers.filter(p => p.score === highestScore);
    const losers = sortedPlayers.filter(p => p.score === lowestScore);

    // friendly feedback for the current player
    const currentPlayerId = selectedChild?.id || 'player1';
    const amIWinner = winners.some(w => w.id === currentPlayerId);
    const amILoser = losers.some(l => l.id === currentPlayerId);
    let personalFeedback = 'Great effort!';
    if (amIWinner) {
      personalFeedback = winners.length === 1 ? 'You are the Winner! 🎉 Excellent work!' : 'You tied for 1st place! 🥳';
    } else if (amILoser) {
      personalFeedback = 'Oops — last place this time. Try again to improve! 💪';
    } else {
      personalFeedback = 'Nice job — keep practicing to climb to the top!';
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/20 via-secondary/20 to-accent/20 p-4">
        <Background3D /> {/* <-- added */}
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
             {/* Personal feedback banner */}
             <div className="mt-2">
               <div className={`inline-block px-3 py-1 rounded-full text-sm ${
                 amIWinner ? 'bg-green-100 text-green-800' : amILoser ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-50 text-blue-800'
               }`}>
                 {personalFeedback}
               </div>
 
               {/* NEW: If player finished last, show a friendly participation badge CTA */}
               {amILoser && (
                 <div className="mt-2 flex items-center justify-center space-x-2">
                   <div className="text-lg">🏅</div>
                   <div className="text-sm text-yellow-800">
                     You earned a Participation Badge — keep practicing to level up!
                   </div>
                 </div>
               )}
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
                        <div className="font-medium text-primary">
                          {player.name}
                          {/* NEW: show streak if present */}
                          {player.streak ? <span className="streak-badge">🔥 {player.streak}</span> : null}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          <div className="w-40">
                            <Progress
                              value={Math.min(100, ((player.attempts ?? 0) / Math.max(1, gameRiddles.length)) * 100)}
                              className="h-2 rounded-full"
                            />
                          </div>
                          <div className="mt-1">
                            <span className="text-xs">{player.attempts ?? 0}/{Math.max(1, gameRiddles.length)}</span>
                            {isWinner && <span className="ml-2 text-sm text-green-700">Winner</span>}
                            {isLoser && <span className="ml-2 text-sm text-red-700">Needs practice</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                    <span className="text-xl font-bold text-primary">{player.score}</span>
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
                className="w-full bg-primary hover:bg-primary/90 text-white"
                size="lg"
              >
                Play Again 🔄
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

  if (!currentRiddle) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-500 to-purple-600">
        <Background3D /> {/* <-- added */}
        <Card className="max-w-md mx-auto bg-pink-100/90">
          <CardContent className="text-center py-8">
            <p className="text-lg text-pink-700">No riddles available for {selectedCategory} - {difficulty}.</p>
            <Button onClick={() => navigate('/games')} className="mt-4 bg-pink-600 hover:bg-pink-700 text-white">
              Back to Games
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Playing Phase
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/20 via-secondary/20 to-accent/20 p-4">
      <Background3D /> {/* <-- added */}
      {/* Join Request Notification Banner */}
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

      {/* Waiting for other player banner */}
      {waitingForPlayers && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50">
          <Card className="bg-blue-50 border-blue-200 shadow-lg">
            <CardContent className="py-3 px-4">
              <div className="flex items-center space-x-2">
                <span className="text-blue-600 text-lg">⏳</span>
                <span className="text-blue-800 font-medium">Waiting for the other player to join…</span>
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

      {/* Scoreboard Panel (visible during play: names/avatars shown, show attempts realtime) */}
      <div className="fixed top-20 right-4 z-50 w-72">
        <Card className="bg-white/95 shadow-lg">
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-sm">Players</CardTitle>
          </CardHeader>
          <CardContent className="py-2 px-3">
            <div className="space-y-2 max-h-64 overflow-auto">
              {[...players].sort((a, b) => (b.attempts ?? 0) - (a.attempts ?? 0)).map((player, idx) => (
                <div key={player.id} className="flex items-center justify-between player-row">
                  <div className="flex items-center space-x-2">
                    <Avatar className="w-6 h-6">
                      <AvatarFallback className="text-sm">{player.avatar}</AvatarFallback>
                    </Avatar>
                    <div className="flex items-center">
                      <span className="text-sm truncate">{idx === 0 ? `👑 ${player.name}` : player.name}</span>
                      {/* NEW: streak on scoreboard */}
                      {player.streak ? <span className="streak-badge ml-2">🔥 {player.streak}</span> : null}
                    </div>
                  </div>
                  {/* Visualize attempts as a small progress bar (attempts / total questions) */}
                  <div className="flex flex-col items-end">
                    <div className="w-24">
                      <Progress
                        value={Math.min(100, ((player.attempts ?? 0) / Math.max(1, gameRiddles.length)) * 100)}
                        className="h-2 rounded-full"
                      />
                    </div>
                    <div className="text-xs font-semibold text-primary mt-1">
                      {player.attempts ?? 0}/{Math.max(1, gameRiddles.length)}
                    </div>
                  </div>
                </div>
              ))} 
            </div>
          </CardContent>
        </Card>
      </div>

      {/* New Player Join Dialog */}
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
          gameId={gameId || 'riddle'}
          onPlayerJoin={handlePlayerJoin}
          players={players}
          gameMode={roomCode ? 'multiplayer' : 'single'}
          onJoinRequestUpdate={handleJoinRequestUpdate}
        />
      )}

      <div className="max-w-md mx-auto">
        <Card className="bg-white/90 shadow-xl">
          <CardHeader className="text-center">
            <CardTitle className="text-xl font-fredoka text-primary">
              {selectedCategory} Challenge
            </CardTitle>
            <div className="flex justify-center space-x-2 mt-2">
              <span className="text-2xl">🐄</span>
              <span className="text-2xl">🐵</span>
              <span className="text-2xl">🐘</span>
            </div>
            <Progress
              value={((currentRiddleIndex + 1) / Math.max(1, gameRiddles.length)) * 100}
              className="w-full mt-4"
            />
            <p className="text-sm text-muted-foreground mt-2">
              Question {currentRiddleIndex + 1} of {gameRiddles.length}
            </p>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="text-center bg-secondary/10 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <Badge variant="secondary">{selectedCategory}</Badge>
                <Badge variant="outline">{difficulty}</Badge>
              </div>
              <h3 className="text-lg font-medium text-primary mb-3">
                {currentRiddle.question}
              </h3>

              {/* Keyboard hint for power users */}
              <div className="flex justify-center">
                <div className="keyboard-hint">Press A/B/C/D or 1-4 to answer</div>
              </div>
              
            </div>

            <div className="space-y-3">
              {currentRiddle.options.map((option, index) => (
                <Button
                  key={index}
                  onClick={() => handleAnswerSelect(option)}
                  disabled={showFeedback}
                  variant={
                    showFeedback
                      ? option === currentRiddle.options[currentRiddle.correctAnswer]
                        ? "default"
                        : option === selectedAnswer
                          ? "destructive"
                          : "outline"
                      : "outline"
                  }
                  className={`answer-btn w-full text-left justify-start p-4 h-auto ${
                    showFeedback && option === currentRiddle.options[currentRiddle.correctAnswer]
                      ? "bg-green-500 hover:bg-green-500 text-white border-green-500"
                      : showFeedback && option === selectedAnswer && option !== currentRiddle.options[currentRiddle.correctAnswer]
                        ? "bg-red-500 hover:bg-red-500 text-white border-red-500"
                        : "bg-white hover:bg-secondary/10 text-primary border-input"
                  }`}
                  size="lg"
                >
                  <span className="font-medium mr-3">{String.fromCharCode(65 + index)}.</span>
                  {option}
                </Button>
              ))}
            </div>

            {/* Game Control Buttons */}
            <div className="flex justify-center space-x-3 mt-6">
              {isRoomCreator && roomCode && (
                <Button
                  onClick={handlePlayAgain}
                  className="bg-green-500 hover:bg-green-600 text-white"
                  size="sm"
                >
                  🔄 Restart Game
                </Button>
              )}
              <Button
                onClick={() => navigate('/games')}
                variant="outline"
                className="border-pink-300 text-pink-700"
                size="sm"
              >
                ← Back to Games
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {feedbackBanner && <div className={`fixed top-28 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-md ${feedbackBanner.type === 'success' ? 'bg-green-100 text-green-800' : feedbackBanner.type === 'error' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>{feedbackBanner.message}</div>}
      <Confetti />
    </div>
  );
};

export default RiddleGame;