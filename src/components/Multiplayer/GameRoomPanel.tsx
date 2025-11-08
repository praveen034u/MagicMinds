import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LogOut, X } from "lucide-react";

interface Player {
  id: string;
  name: string;
  avatar: string;
  isAI?: boolean;
  status?: 'active' | 'away' | 'disconnected';
  score?: number;
}

interface JoinRequest {
  id: string;
  player_name: string;
  player_avatar: string;
  child_id: string;
}

interface GameRoomPanelProps {
  roomCode?: string;
  gameId: string;
  onPlayerJoin?: (player: Player) => void;
  players?: Player[];
  gameMode?: 'single' | 'multiplayer';
  onJoinRequestUpdate?: (requestCount: number) => void;
  onLeaveRoom?: () => void;
  selectedChildId?: string;
  isHost?: boolean;
}

const GameRoomPanel = ({ roomCode, gameId, onPlayerJoin, players: externalPlayers, gameMode = 'single', onJoinRequestUpdate, onLeaveRoom, selectedChildId, isHost }: GameRoomPanelProps) => {
  const { toast } = useToast();
  const [players, setPlayers] = useState<Player[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [showJoinRequest, setShowJoinRequest] = useState(false);
  const [currentRequest, setCurrentRequest] = useState<JoinRequest | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const displayedPlayers: Player[] = players.length > 0
    ? players.map((p) => {
        const match = (externalPlayers || []).find(ep => ep.id === p.id);
        return match
          ? { ...p, name: p.name || match.name, avatar: p.avatar || match.avatar, score: match.score }
          : p;
      })
    : (externalPlayers || []);

  useEffect(() => {
    if (gameMode === 'single' && externalPlayers) {
      setPlayers(externalPlayers);
      return;
    }
    
    if (gameMode === 'multiplayer' && roomCode) {
      loadRoomData();
      
      // Set up real-time subscription for join requests
      const channel = supabase
        .channel('game-room-updates')
        .on('postgres_changes', 
          { event: 'INSERT', schema: 'public', table: 'join_requests' },
          (payload) => {
            const newRequest = payload.new as JoinRequest;
            setJoinRequests(prev => {
              const updated = [...prev, newRequest];
              onJoinRequestUpdate?.(updated.length);
              return updated;
            });
            setCurrentRequest(newRequest);
            setShowJoinRequest(true);
            
            toast({
              title: "Join Request",
              description: `${newRequest.player_name} wants to join the game!`,
            });
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [roomCode, externalPlayers, gameMode]);

  const loadRoomData = async () => {
    if (!roomCode) return;
    
    try {
      // Get room info
      const { data: room } = await supabase
        .from('game_rooms')
        .select('*')
        .eq('room_code', roomCode)
        .single();

      if (room) {
        // Get participants
        const { data: participants } = await supabase
          .from('room_participants')
          .select('*')
          .eq('room_id', room.id);

        // Build list from DB participants
        let finalPlayers: Player[] = [];
        if (participants && participants.length > 0) {
          const playerList = participants.map(p => ({
            id: p.child_id || p.id,
            name: p.player_name,
            avatar: p.player_avatar,
            isAI: p.is_ai,
            status: 'active' as const,
          }));

          // If only one real player, merge AI from externalPlayers so the kid always has an AI friend
          const aiFromExternal = (externalPlayers || []).filter(p => p.isAI);
          if (participants.length === 1 && aiFromExternal.length > 0) {
            const merged = [...playerList, ...aiFromExternal];
            // de-dupe by id
            const seen = new Set<string>();
            finalPlayers = merged.filter(p => (seen.has(p.id) ? false : (seen.add(p.id), true)));
          } else {
            finalPlayers = playerList;
          }
        } else {
          // No participants in DB: fall back to external players (local) so we always show kid + AI
          finalPlayers = externalPlayers || [];
        }

        setPlayers(finalPlayers);

        // Get pending join requests - filter out those who are already participants
        const participantChildIds = participants?.map(p => p.child_id).filter(Boolean) || [];
        const { data: requests } = await supabase
          .from('join_requests' as any)
          .select('*')
          .eq('room_code', roomCode)
          .eq('status', 'pending')
          .not('child_id', 'in', `(${participantChildIds.join(',')})`);

        if (requests) {
          setJoinRequests(requests as unknown as JoinRequest[]);
          onJoinRequestUpdate?.(requests.length);
        }
      }
    } catch (error) {
      console.error('Error loading room data:', error);
    }
  };

  const handleJoinRequest = async (requestId: string, approve: boolean) => {
    try {
      const { data } = await supabase.functions.invoke('manage-game-rooms', {
        body: {
          action: 'handle_join_request',
          request_id: requestId,
          approve
        }
      });

      if (data?.success) {
        if (approve && data.player) {
          const newPlayer = {
            id: data.player.child_id,
            name: data.player.player_name,
            avatar: data.player.player_avatar,
            isAI: false,
            status: 'active' as const
          };
          setPlayers(prev => [...prev, newPlayer]);
          onPlayerJoin?.(newPlayer);
          
          toast({
            title: "Player Joined!",
            description: `${newPlayer.name} has joined the game`,
          });
        }
        
        setJoinRequests(prev => {
          const updated = prev.filter(r => r.id !== requestId);
          onJoinRequestUpdate?.(updated.length);
          return updated;
        });
        setShowJoinRequest(false);
        setCurrentRequest(null);
      }
    } catch (error) {
      console.error('Error handling join request:', error);
      toast({
        title: "Error",
        description: "Failed to handle join request",
        variant: "destructive",
      });
    }
  };

  const handleLeaveRoom = async () => {
    if (!roomCode || !selectedChildId) return;
    
    try {
      const { data: room } = await supabase
        .from('game_rooms')
        .select('id')
        .eq('room_code', roomCode)
        .single();
      
      if (room) {
        const { data } = await supabase.functions.invoke('manage-game-rooms', {
          body: {
            action: 'leave_room',
            room_id: room.id,
            child_id: selectedChildId
          }
        });
        
        if (data?.success) {
          toast({
            title: "Left Room",
            description: "You have left the game room",
          });
          onLeaveRoom?.();
        }
      }
    } catch (error) {
      console.error('Error leaving room:', error);
      toast({
        title: "Error",
        description: "Failed to leave room",
        variant: "destructive",
      });
    }
  };

  const handleCloseRoom = async () => {
    if (!roomCode || !selectedChildId || !isHost) return;
    
    try {
      const { data: room } = await supabase
        .from('game_rooms')
        .select('id')
        .eq('room_code', roomCode)
        .single();
      
      if (room) {
        const { data } = await supabase.functions.invoke('manage-game-rooms', {
          body: {
            action: 'close_room',
            room_id: room.id
          }
        });
        
        if (data?.success) {
          toast({
            title: "Room Closed",
            description: "The game room has been closed",
          });
          onLeaveRoom?.();
        }
      }
    } catch (error) {
      console.error('Error closing room:', error);
      toast({
        title: "Error",
        description: "Failed to close room",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      {/* Collapsible Room Panel */}
      <div className={`fixed top-4 right-4 z-50 transition-all duration-300 ${
        isExpanded ? 'w-80' : 'w-16'
      }`}>
        <Card className="bg-white/95 shadow-lg">
          {!isExpanded ? (
            <CardContent className="p-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(true)}
                className="w-full h-10 flex items-center justify-center"
              >
                <span className="text-lg">👥</span>
              </Button>
            </CardContent>
          ) : (
            <>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">
                    {gameMode === 'multiplayer' && roomCode ? `Room: ${roomCode}` : 'Players'}
                  </CardTitle>
                  <div className="flex items-center gap-1">
                    {gameMode === 'multiplayer' && roomCode && (
                      <>
                        {isHost ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleCloseRoom}
                            title="Close Room"
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleLeaveRoom}
                            title="Leave Room"
                          >
                            <LogOut className="w-3 h-3" />
                          </Button>
                        )}
                      </>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsExpanded(false)}
                    >
                      ✕
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground mb-2">
                    Players ({displayedPlayers.length})
                  </div>
                  {displayedPlayers.map((player) => (
                    <div key={player.id} className="flex items-center gap-2 p-2 bg-secondary/20 rounded">
                      <Avatar className="w-6 h-6">
                        <AvatarImage src={player.avatar} />
                        <AvatarFallback className="text-xs">{player.avatar || (player.name ? player.name[0] : '?')}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 flex items-center justify-between">
                        <span className="text-xs font-medium">{player.name}</span>
                        {typeof player.score === 'number' && (
                          <span className="text-xs font-bold text-primary">{player.score}</span>
                        )}
                      </div>
                      <div className="flex gap-1">
                        {player.isAI && <Badge variant="secondary" className="text-xs">AI</Badge>}
                        {player.status && (
                          <div className={`w-2 h-2 rounded-full ${
                            player.status === 'active' ? 'bg-green-500' :
                            player.status === 'away' ? 'bg-yellow-500' : 'bg-red-500'
                          }`} />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                
                {joinRequests.length > 0 && (
                  <div className="mt-3 pt-2 border-t">
                    <div className="text-xs text-muted-foreground mb-2">
                      Join Requests ({joinRequests.length})
                    </div>
                    {joinRequests.map((request) => (
                      <div key={request.id} className="flex items-center gap-2 p-2 bg-yellow-50 rounded text-xs">
                        <Avatar className="w-5 h-5">
                          <AvatarFallback className="text-xs">{request.player_name[0]}</AvatarFallback>
                        </Avatar>
                        <span className="flex-1">{request.player_name}</span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-xs"
                          onClick={() => {
                            setCurrentRequest(request);
                            setShowJoinRequest(true);
                          }}
                        >
                          Review
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </>
          )}
        </Card>
      </div>

      {/* Join Request Dialog */}
      <Dialog open={showJoinRequest} onOpenChange={setShowJoinRequest}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Join Request</DialogTitle>
          </DialogHeader>
          {currentRequest && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-secondary/10 rounded-lg">
                <Avatar>
                  <AvatarImage src={currentRequest.player_avatar} />
                  <AvatarFallback>{currentRequest.player_name[0]}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-medium">{currentRequest.player_name}</div>
                  <div className="text-sm text-muted-foreground">
                    Wants to join your {gameId} game
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button
                  onClick={() => handleJoinRequest(currentRequest.id, true)}
                  className="flex-1"
                >
                  Accept ✓
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleJoinRequest(currentRequest.id, false)}
                  className="flex-1"
                >  
                  Deny ✗
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default GameRoomPanel;