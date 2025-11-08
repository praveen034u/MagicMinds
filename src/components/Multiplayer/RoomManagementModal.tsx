import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Users, UserPlus, Home } from "lucide-react";
import { useAppContext } from "@/contexts/Auth0Context";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { GameRoom } from "@/types/multiplayer";

interface Player {
  id: string;
  name: string;
  avatar: string;
  isAI: boolean;
  // pending invite flag (not yet a room participant)
  pending?: boolean;
  // invitation id if created via join_requests
  invite_id?: string;
  // child id for invited player (when pending)
  child_id?: string;
}

interface Friend {
  id: string;
  name: string;
  avatar: string;
  status: 'online' | 'offline' | 'in-game';
  child_id: string;
  room_id?: string | null;
}

interface RoomManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const RoomManagementModal = ({ isOpen, onClose }: RoomManagementModalProps) => {
  const { selectedChild } = useAppContext();
  const { toast } = useToast();
  const [currentRoom, setCurrentRoom] = useState<GameRoom | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [roomCode, setRoomCode] = useState("");
  const [customRoomName, setCustomRoomName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [activeTab, setActiveTab] = useState("create");
  const [joinRoomCode, setJoinRoomCode] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  
  // Friend management states
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);
  
  // Invitations management
  const [pendingInvitations, setPendingInvitations] = useState<any[]>([]);
  const [isLoadingInvitations, setIsLoadingInvitations] = useState(false);

  useEffect(() => {
    if (!isOpen || !selectedChild) return;
    loadCurrentRoom();
    loadFriends();
    loadPendingInvitations();
  }, [isOpen, selectedChild]);

  const loadCurrentRoom = async () => {
    if (!selectedChild) return;

    try {
      // Check if child has a room_id in their profile (fallback to room_participants if column doesn't exist yet)
      try {
        const { data: childData, error } = await supabase
          .from('children_profiles')
          .select('room_id')
          .eq('id', selectedChild.id)
          .single();

        if (!error && childData && (childData as any).room_id) {
          // Get room details with creator information
          const { data: roomData } = await supabase
            .from('game_rooms')
            .select(`
              *,
              host:children_profiles!game_rooms_host_child_id_fkey(name)
            `)
            .eq('id', (childData as any).room_id)
            .single();

          if (roomData) {
            setCurrentRoom(roomData as GameRoom);
            setRoomCode(roomData.room_code);
            setActiveTab("room");
            loadRoomParticipants(roomData.id);
          }
          return;
        }
      } catch (error) {
        // Fallback to old method if room_id column doesn't exist yet
        console.log('Falling back to room_participants check');
      }

      // Fallback: Check if child is in a room via room_participants
      const { data: roomParticipant } = await supabase
        .from('room_participants')
        .select(`
          room_id,
          game_rooms(
            *,
            host:children_profiles!game_rooms_host_child_id_fkey(name)
          )
        `)
        .eq('child_id', selectedChild.id)
        .single();

      if (roomParticipant?.game_rooms) {
        const room = roomParticipant.game_rooms as GameRoom;
        setCurrentRoom(room);
        setRoomCode(room.room_code);
        setActiveTab("room");
        loadRoomParticipants(room.id);
      } else {
        setCurrentRoom(null);
        setActiveTab("create");
      }
    } catch (error) {
      console.error('Error loading current room:', error);
      setCurrentRoom(null);
      setActiveTab("create");
    }
  };

  const loadRoomParticipants = async (roomId: string) => {
    try {
      const { data: participants } = await supabase
        .from('room_participants')
        .select('*')
        .eq('room_id', roomId);

      if (participants) {
        const playerList: Player[] = participants.map(p => ({
          id: p.child_id || p.id,
          name: p.player_name,
          avatar: p.player_avatar || '👤',
          isAI: p.is_ai
        }));
        setPlayers(playerList);
      }
    } catch (error) {
      console.error('Error loading room participants:', error);
    }
  };

  const loadFriends = async () => {
    if (!selectedChild) return;

    try {
      setIsLoadingFriends(true);
      
      // Use edge function to fetch friends with names/avatars reliably
      const { data } = await supabase.functions.invoke('manage-friends', {
        body: {
          action: 'list_friends',
          child_id: selectedChild.id
        }
      });

      if (!data?.success) throw new Error(data?.error || 'Failed to load friends');

      const apiFriends: any[] = data.data || [];
      
      const friendsList = apiFriends.map((f) => ({
        id: f.id,
        child_id: f.child_id,
        name: f.name,
        avatar: f.avatar || '👤',
        status: f.status || 'offline',
        room_id: f.room_id || null
      } as Friend));

      setFriends(friendsList);
    } catch (error) {
      console.error('Error loading friends:', error);
      toast({
        title: 'Error',
        description: 'Failed to load friends',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingFriends(false);
    }
  };

  const loadPendingInvitations = async () => {
    if (!selectedChild) return;

    try {
      setIsLoadingInvitations(true);
      
      const { data } = await supabase.functions.invoke('manage-game-rooms', {
        body: {
          action: 'get_pending_invitations',
          child_id: selectedChild.id
        }
      });

      if (data?.success) {
        setPendingInvitations(data.data || []);
      }
    } catch (error) {
      console.error('Error loading pending invitations:', error);
    } finally {
      setIsLoadingInvitations(false);
    }
  };

  const acceptInvitation = async (invitationId: string) => {
    if (!selectedChild) return;

    try {
      const { data } = await supabase.functions.invoke('manage-game-rooms', {
        body: {
          action: 'accept_invitation',
          child_id: selectedChild.id,
          invitation_id: invitationId
        }
      });

      if (data?.success) {
        toast({
          title: "Joined Room!",
          description: "Successfully joined the room",
        });
        loadCurrentRoom();
        loadPendingInvitations();
      } else {
        toast({
          title: "Error",
          description: data?.error || "Failed to accept invitation",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error accepting invitation:', error);
      toast({
        title: "Error",
        description: "Failed to accept invitation",
        variant: "destructive",
      });
    }
  };

  const declineInvitation = async (invitationId: string) => {
    if (!selectedChild) return;

    try {
      const { data } = await supabase.functions.invoke('manage-game-rooms', {
        body: {
          action: 'decline_invitation',
          child_id: selectedChild.id,
          invitation_id: invitationId
        }
      });

      if (data?.success) {
        toast({
          title: "Invitation Declined",
          description: "You have declined the invitation",
        });
        loadPendingInvitations();
      } else {
        toast({
          title: "Error",
          description: data?.error || "Failed to decline invitation",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error declining invitation:', error);
    }
  };

  const createRoom = async () => {
    if (!selectedChild) return;

    try {
      setIsCreating(true);
      const { data } = await supabase.functions.invoke('manage-game-rooms', {
        body: {
          action: 'create_room',
          child_id: selectedChild.id,
          game_id: 'riddle', // Default game
          difficulty: 'easy', // Default difficulty
          room_name: customRoomName,
          // use the backend-expected field name
          friend_ids: selectedFriendIds
        }
      });

      if (data?.success) {
        const room = data.data;
        toast({
          title: "Room Created!",
          description: `Room code: ${room?.room_code || ''}`,
        });
        setRoomCode(room?.room_code || '');
        setCurrentRoom(room || null);
        setActiveTab("room");
        // load participants for UI
        if (room?.id) loadRoomParticipants(room.id);

        // After creating the room, explicitly call invite_friends so join_requests are created
        if (selectedFriendIds.length > 0 && room?.id) {
          try {
            const inviteResp = await supabase.functions.invoke('manage-game-rooms', {
              body: {
                action: 'invite_friends',
                room_id: room.id,
                child_id: selectedChild.id,
                friend_ids: selectedFriendIds
              }
            });

            const inviteData = inviteResp.data;

            if (inviteData?.success) {
              toast({ title: 'Invites Sent', description: `Invited ${selectedFriendIds.length} friend(s)` });
              // refresh pending invitations for the current child (if viewing join tab)
              loadPendingInvitations();

              // If the function returned created invitations, show them in the players panel as pending
              const createdInvitations = inviteData.data || [];
              if (createdInvitations.length > 0) {
                const pendingPlayers: Player[] = createdInvitations.map((inv: any) => ({
                  id: inv.child_id || inv.id || `invite-${inv.id}`,
                  child_id: inv.child_id,
                  invite_id: inv.id,
                  name: inv.player_name || 'Invited',
                  avatar: inv.player_avatar || '👤',
                  isAI: false,
                  pending: true
                }));

                // Merge pending invites into current players list while avoiding duplicates
                setPlayers(prev => {
                  const existingIds = new Set(prev.map(p => p.id));
                  const merged = [...prev];
                  for (const p of pendingPlayers) {
                    if (!existingIds.has(p.id)) merged.push(p);
                  }
                  return merged;
                });
              }
            } else {
              toast({ title: 'Invites Failed', description: inviteData?.error || 'Failed to send invites', variant: 'destructive' });
              console.error('invite_friends response error:', inviteData);
            }
          } catch (err) {
            console.error('Error sending invites after room creation:', err);
            toast({ title: 'Invites Failed', description: 'Failed to send invites', variant: 'destructive' });
          }
        }
      } else {
        toast({
          title: "Error",
          description: data?.error || "Failed to create room",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error creating room:', error);
      toast({
        title: "Error",
        description: "Failed to create room",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };


  const leaveRoom = async () => {
    if (!selectedChild || !currentRoom) return;

    try {
      setIsLeaving(true);
      
      const { data } = await supabase.functions.invoke('manage-game-rooms', {
        body: {
          action: 'leave_room',
          child_id: selectedChild.id,
          room_id: currentRoom.id
        }
      });

      if (data?.success) {
        toast({
          title: "Left Room",
          description: "You have successfully left the room",
        });
        setCurrentRoom(null);
        setRoomCode("");
        setPlayers([]);
        setActiveTab("create");
        // Try to update child's room_id to null (gracefully handle if column doesn't exist yet)
        try {
          await supabase
            .from('children_profiles')
            .update({ room_id: null } as any)
            .eq('id', selectedChild.id);
        } catch (error) {
          console.log('Could not update room_id (column may not exist yet)');
        }
      } else {
        toast({
          title: "Error",
          description: data?.error || "Failed to leave room",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error leaving room:', error);
      toast({
        title: "Error",
        description: "Failed to leave room",
        variant: "destructive",
      });
    } finally {
      setIsLeaving(false);
    }
  };

  const joinRoom = async () => {
    if (!selectedChild || !joinRoomCode.trim()) return;

    try {
      setIsJoining(true);
      
      const { data } = await supabase.functions.invoke('manage-game-rooms', {
        body: {
          action: 'join_room',
          child_id: selectedChild.id,
          room_code: joinRoomCode.trim()
        }
      });

      if (data?.success) {
        toast({
          title: "Joined Room!",
          description: "Successfully joined the room",
        });
        setJoinRoomCode("");
        loadCurrentRoom();
      } else {
        toast({
          title: "Error",
          description: data?.error || "Failed to join room",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error joining room:', error);
      toast({
        title: "Error",
        description: "Failed to join room",
        variant: "destructive",
      });
    } finally {
      setIsJoining(false);
    }
  };

  const closeRoom = async () => {
    if (!selectedChild || !currentRoom) return;

    try {
      setIsClosing(true);
      
      const { data } = await supabase.functions.invoke('manage-game-rooms', {
        body: {
          action: 'close_room',
          child_id: selectedChild.id,
          room_id: currentRoom.id
        }
      });

      if (data?.success) {
        toast({
          title: "Room Closed",
          description: "Room has been closed and all players have been removed",
        });
        setCurrentRoom(null);
        setRoomCode("");
        setPlayers([]);
        setActiveTab("create");
      } else {
        toast({
          title: "Error",
          description: data?.error || "Failed to close room",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error closing room:', error);
      toast({
        title: "Error",
        description: "Failed to close room",
        variant: "destructive",
      });
    } finally {
      setIsClosing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>🎮 Multiplayer Game</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="create">Create</TabsTrigger>
              <TabsTrigger value="join">Join</TabsTrigger>
              <TabsTrigger value="room" disabled={!currentRoom}>Current Room</TabsTrigger>
            </TabsList>
            
            <TabsContent value="create" className="space-y-4">
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2">Create New Room</h3>
                <p className="text-sm text-muted-foreground">
                  Play riddle on easy difficulty
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="room-name">Room Name (Optional)</Label>
                  <Input
                    id="room-name"
                    placeholder="Enter custom room name..."
                    value={customRoomName}
                    onChange={(e) => setCustomRoomName(e.target.value)}
                  />
                </div>

                {/* Friend Selection */}
                <Card>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <UserPlus className="h-4 w-4" />
                        <span className="text-sm font-medium">Add Friends</span>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={loadFriends}
                        disabled={isLoadingFriends}
                      >
                        🔄
                      </Button>
                    </div>

                    <div className="space-y-2 mb-3">
                      <Input
                        placeholder="Search friends..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-8"
                      />
                    </div>

                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {friends.filter(friend => 
                        friend.name && friend.name.toLowerCase().includes(searchQuery.toLowerCase())
                      ).map((friend) => (
                        <div key={friend.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`friend-${friend.id}`}
                            checked={selectedFriendIds.includes(friend.child_id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedFriendIds(prev => [...prev, friend.child_id]);
                              } else {
                                setSelectedFriendIds(prev => prev.filter(id => id !== friend.child_id));
                              }
                            }}
                            disabled={friend.room_id !== null}
                          />
                          <div className="flex items-center gap-2 flex-1">
                            <Avatar className="w-6 h-6">
                              <AvatarImage src={friend.avatar} />
                              <AvatarFallback>{friend.name?.[0] || '?'}</AvatarFallback>
                            </Avatar>
                            <span className={`text-sm ${friend.room_id ? 'text-muted-foreground' : ''}`}>
                              {friend.name}
                            </span>
                            <Badge variant={
                              friend.room_id ? 'secondary' : 
                              friend.status === 'online' ? 'default' : 'outline'
                            } className="text-xs">
                              {friend.room_id ? 'In Room' : friend.status}
                            </Badge>
                          </div>
                        </div>
                      ))}

                      {friends.length === 0 && !isLoadingFriends && (
                        <div className="text-center py-4 text-muted-foreground">
                          <p className="text-xs">No friends available</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Button 
                  onClick={createRoom} 
                  disabled={isCreating}
                  className="w-full"
                >
                  {isCreating ? "Creating..." : "Create Room"}
                </Button>

                <div className="text-xs text-muted-foreground text-center">
                  💡 If no friends join, an AI friend will play with you!
                </div>
              </div>
            </TabsContent>

            <TabsContent value="join" className="space-y-4">
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2">Join Room</h3>
                <p className="text-sm text-muted-foreground">
                  Pending invitations and join a room
                </p>
              </div>

              <div className="space-y-4">
                {/* Pending Invitations */}
                <Card>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">🎮 Game Invitations</span>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={loadPendingInvitations}
                        disabled={isLoadingInvitations}
                      >
                        🔄
                      </Button>
                    </div>

                    <div className="max-h-48 overflow-y-auto space-y-2">
                      {pendingInvitations.map((invitation) => (
                        <Card key={invitation.id} className="border border-primary/20">
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Avatar className="w-8 h-8">
                                  <AvatarImage src={invitation.player_avatar} />
                                  <AvatarFallback>{invitation.player_name?.[0] || '?'}</AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="text-sm font-medium">{invitation.player_name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    Room: {invitation.room_code} • {invitation.game_rooms?.game_id}
                                  </p>
                                </div>
                              </div>
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  onClick={() => acceptInvitation(invitation.id)}
                                  className="h-8 px-3"
                                >
                                  ✓
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => declineInvitation(invitation.id)}
                                  className="h-8 px-3"
                                >
                                  ✕
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}

                      {pendingInvitations.length === 0 && !isLoadingInvitations && (
                        <div className="text-center py-4 text-muted-foreground">
                          <p className="text-sm">No pending invitations</p>
                        </div>
                      )}

                      {isLoadingInvitations && (
                        <div className="text-center py-4 text-muted-foreground">
                          <p className="text-sm">Loading invitations...</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Manual Room Join */}
                <div>
                  <Label htmlFor="join-room-code">Or Enter Room Code</Label>
                  <Input
                    id="join-room-code"
                    placeholder="Enter room code..."
                    value={joinRoomCode}
                    onChange={(e) => setJoinRoomCode(e.target.value.toUpperCase())}
                    maxLength={6}
                  />
                </div>

                <Button 
                  onClick={joinRoom} 
                  disabled={isJoining || !joinRoomCode.trim()}
                  className="w-full"
                >
                  {isJoining ? "Joining..." : "Join Room"}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="room" className="space-y-4">
              {currentRoom && (
                <>
                  <div className="text-center p-4 bg-primary/10 rounded-lg mb-4">
                    <p className="text-sm text-muted-foreground mb-2">
                      You are currently in Room Code
                    </p>
                    <p className="text-2xl font-bold text-primary mb-2">
                      {roomCode}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Created by <span className="font-semibold">{currentRoom.host?.name || 'Unknown'}</span>
                    </p>
                  </div>

                  <Card>
                    <CardContent className="p-4">
                      <div className="space-y-2 text-sm mb-4">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Game:</span>
                          <span className="capitalize">{currentRoom.game_id}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Difficulty:</span>
                          <span className="capitalize">{currentRoom.difficulty}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Status:</span>
                          <Badge variant={currentRoom.status === 'waiting' ? 'secondary' : 'default'}>
                            {currentRoom.status}
                          </Badge>
                        </div>
                      </div>

                      <h4 className="font-medium mb-3">Players ({players.length}/4)</h4>
                      <div className="space-y-2">
                        {players.map((player) => (
                          <div key={player.id} className={`flex items-center gap-3 p-2 rounded-lg ${player.pending ? 'bg-yellow-50' : 'bg-secondary/20'}`}>
                            <Avatar className="w-8 h-8">
                              <AvatarImage src={player.avatar} />
                              <AvatarFallback>{player.name?.[0] || '?'}</AvatarFallback>
                            </Avatar>
                            <span className="flex-1 font-medium">{player.name}</span>
                            {player.isAI && <Badge variant="secondary">AI</Badge>}
                            {!player.pending && player.id === selectedChild?.id && <Badge variant="default">You</Badge>}
                            {player.pending && <Badge variant="outline">Invited</Badge>}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    {currentRoom.host_child_id === selectedChild?.id ? (
                      <>
                        <Button 
                          variant="destructive" 
                          onClick={closeRoom}
                          disabled={isClosing}
                          className="flex-1"
                        >
                          {isClosing ? "Closing..." : "Close Room"}
                        </Button>
                        <Button 
                          variant="outline" 
                          onClick={leaveRoom}
                          disabled={isLeaving}
                          className="flex-1"
                        >
                          {isLeaving ? "Leaving..." : "Leave Room"}
                        </Button>
                      </>
                    ) : (
                      <Button 
                        variant="destructive" 
                        onClick={leaveRoom}
                        disabled={isLeaving}
                        className="w-full"
                      >
                        {isLeaving ? "Leaving..." : "Leave Room"}
                      </Button>
                    )}
                  </div>

                  <div className="text-xs text-muted-foreground text-center">
                    💡 More players can join during the game using the room code
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>

          <div className="flex justify-end">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RoomManagementModal;