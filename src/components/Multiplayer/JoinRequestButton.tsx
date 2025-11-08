import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAppContext } from "@/contexts/Auth0Context";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Users, UserCheck } from "lucide-react";

interface JoinRequest {
  id: string;
  room_code: string;
  child_id: string;
  player_name: string;
  player_avatar: string;
  status: string;
  created_at: string;
}

interface JoinRequestButtonProps {
  className?: string;
}

const JoinRequestButton = ({ className }: JoinRequestButtonProps) => {
  const { selectedChild } = useAppContext();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [roomCode, setRoomCode] = useState("");
  const [isRequesting, setIsRequesting] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<JoinRequest[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showInvitations, setShowInvitations] = useState(false);

  // Fetch pending join requests for current child
  const fetchPendingRequests = async () => {
    if (!selectedChild?.id) return;

    try {
      const { data, error } = await supabase
        .from('join_requests')
        .select('*')
        .eq('child_id', selectedChild.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching pending requests:', error);
        return;
      }

      setPendingRequests(data || []);
    } catch (error) {
      console.error('Error fetching pending requests:', error);
    }
  };

  // Load pending requests on mount and when child changes
  useEffect(() => {
    if (!selectedChild?.id) return;
    
    fetchPendingRequests();

    // Set up real-time subscription for new invitations
    const channel = supabase
      .channel('join-requests-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'join_requests',
          filter: `child_id=eq.${selectedChild.id}`
        },
        (payload) => {
          console.log('New invitation received:', payload);
          fetchPendingRequests();
          
          // Show notification toast
          toast({
            title: "🎮 New Game Invitation!",
            description: `You've been invited to join a game room`,
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'join_requests',
          filter: `child_id=eq.${selectedChild.id}`
        },
        () => {
          fetchPendingRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedChild?.id]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchPendingRequests();
    setIsRefreshing(false);
    toast({
      title: "Refreshed",
      description: "Invitation list updated",
    });
  };

  const handleAcceptInvitation = async (request: JoinRequest) => {
    try {
      const { data } = await supabase.functions.invoke('manage-game-rooms', {
        body: {
          action: 'handle_join_request',
          request_id: request.id,
          approve: true
        }
      });

      if (data?.success && data?.room) {
        toast({
          title: "Invitation Accepted!",
          description: `You joined ${selectedChild?.name}'s room`,
        });
        setShowInvitations(false);
        setIsOpen(false);
        await fetchPendingRequests(); // Refresh the list
        
        // Navigate to the game room
        const room = data.room;
        window.location.href = `/games/${room.game_id}?difficulty=${room.difficulty}&room=${room.room_code}`;
      } else {
        toast({
          title: "Failed to Join",
          description: "Could not join the room",
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

  const handleDeclineInvitation = async (request: JoinRequest) => {
    try {
      const { data } = await supabase.functions.invoke('manage-game-rooms', {
        body: {
          action: 'handle_join_request',
          request_id: request.id,
          approve: false
        }
      });

      if (data?.success) {
        toast({
          title: "Invitation Declined",
          description: "You have declined the room invitation",
        });
        await fetchPendingRequests(); // Refresh the list
      }
    } catch (error) {
      console.error('Error declining invitation:', error);
    }
  };

  const handleJoinRequest = async () => {
    if (!selectedChild?.id || !roomCode.trim()) {
      toast({
        title: "Missing Information",
        description: "Please select a child profile and enter a room code",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsRequesting(true);
      
      const { data } = await supabase.functions.invoke('manage-game-rooms', {
        body: {
          action: 'request_to_join',
          child_id: selectedChild.id,
          room_code: roomCode.toUpperCase()
        }
      });

      if (data?.success) {
        toast({
          title: "Request Sent!",
          description: "Your join request has been sent to the room host",
        });
        setIsOpen(false);
        setRoomCode("");
      } else {
        toast({
          title: "Request Failed",
          description: data?.error || "Failed to send join request",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error sending join request:', error);
      toast({
        title: "Error",
        description: "Failed to send join request",
        variant: "destructive",
      });
    } finally {
      setIsRequesting(false);
    }
  };

  return (
    <>
      <div className="relative">
        <Button
          variant="outline"
          onClick={() => {
            setIsOpen(true);
            setShowInvitations(false);
          }}
          className={className}
        >
          <Users className="w-4 h-4 mr-2" />
          Join Game
          {pendingRequests.length > 0 && (
            <Badge variant="destructive" className="ml-2 px-1.5 py-0.5 text-xs">
              {pendingRequests.length}
            </Badge>
          )}
        </Button>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              {showInvitations ? "Room Invitations" : "Join Game"}
              {!showInvitations && pendingRequests.length > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {pendingRequests.length} pending
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Toggle buttons */}
            <div className="flex gap-2">
              <Button
                variant={showInvitations ? "outline" : "default"}
                size="sm"
                onClick={() => setShowInvitations(false)}
                className="flex-1"
              >
                Request Join
              </Button>
              <Button
                variant={showInvitations ? "default" : "outline"}
                size="sm"
                onClick={() => setShowInvitations(true)}
                className="flex-1 relative"
              >
                Invitations
                {pendingRequests.length > 0 && (
                  <Badge variant="destructive" className="ml-1 px-1 py-0 text-xs">
                    {pendingRequests.length}
                  </Badge>
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="px-2"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            {!showInvitations ? (
              /* Request to join by room code */
              <>
                <div className="text-sm text-muted-foreground">
                  Enter the room code of an active game to request to join.
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="room-code-request">Room Code</Label>
                  <Input
                    id="room-code-request"
                    placeholder="Enter 6-digit room code"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                    maxLength={6}
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleJoinRequest}
                    disabled={!roomCode.trim() || isRequesting}
                    className="flex-1"
                  >
                    {isRequesting ? "Sending..." : "Send Request"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setIsOpen(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </>
            ) : (
              /* Show pending invitations */
              <div className="space-y-3">
                {pendingRequests.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No pending invitations</p>
                  </div>
                ) : (
                  <>
                    <div className="text-sm text-muted-foreground">
                      You have {pendingRequests.length} pending room invitation{pendingRequests.length > 1 ? 's' : ''}. You can only accept one at a time.
                    </div>
                    
                    <div className="max-h-60 overflow-y-auto space-y-2">
                      {pendingRequests.map((request) => (
                        <div key={request.id} className="border rounded-lg p-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{request.player_avatar || '👤'}</span>
                            <div className="flex-1">
                              <p className="font-medium text-sm">Room: {request.room_code}</p>
                              <p className="text-xs text-muted-foreground">
                                From {request.player_name} • {new Date(request.created_at).toLocaleTimeString()}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleAcceptInvitation(request)}
                              className="flex-1"
                            >
                              <UserCheck className="w-3 h-3 mr-1" />
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDeclineInvitation(request)}
                              className="flex-1"
                            >
                              Decline
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                
                <Button
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                  className="w-full"
                >
                  Close
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default JoinRequestButton;