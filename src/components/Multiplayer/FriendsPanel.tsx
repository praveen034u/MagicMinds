import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { useAppContext } from "@/contexts/Auth0Context";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Search, Users, UserPlus, UserMinus } from "lucide-react";

interface Friend {
  id: string;
  name: string;
  avatar: string;
  status: 'online' | 'offline' | 'in-game';
  child_id: string;
}

interface FriendRequest {
  id: string;
  requester: {
    id: string;
    name: string;
    avatar: string;
  };
  created_at: string;
}

interface SearchResult {
  id: string;
  name: string;
  avatar: string;
}

interface OnlineUser {
  id: string;
  name: string;
  avatar: string;
  status: 'online' | 'in-game' | 'offline';
  last_seen?: string;
}

interface RoomInvitation {
  id: string;
  room_code: string;
  player_name: string;
  player_avatar: string;
  created_at: string;
}

interface FriendsPanelProps {
  onInviteFriend: (friendIds: string[]) => void;
}

const FriendsPanel = ({ onInviteFriend }: FriendsPanelProps) => {
  const { selectedChild } = useAppContext();
  const { toast } = useToast();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [roomInvites, setRoomInvites] = useState<RoomInvitation[]>([]);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [isLoadingOnlineUsers, setIsLoadingOnlineUsers] = useState(false);


  useEffect(() => {
    if (selectedChild) {
      loadFriends();
      loadFriendRequests();
      loadOnlineUsers();

      // Set up real-time subscription for friends updates (no filter; we filter in callback)
      const friendsChannel = supabase
        .channel('friends-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'friends',
          },
          (payload) => {
            const rec: any = payload.new || payload.old;
            if (!rec) return;
            if (rec.requester_id === selectedChild.id || rec.addressee_id === selectedChild.id) {
              loadFriends();
              loadFriendRequests();
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(friendsChannel);
      };
    }
  }, [selectedChild]);

  // Realtime and list for room invitations
  useEffect(() => {
    if (!selectedChild?.id) return;
    const load = async () => { await loadRoomInvites(); };
    load();

    const channel = supabase
      .channel('friends-panel-invites')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'join_requests', filter: `child_id=eq.${selectedChild.id}` },
        () => {
          loadRoomInvites();
          toast({ title: '🎮 New Game Invitation', description: 'You have a new room invite' });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'join_requests', filter: `child_id=eq.${selectedChild.id}` },
        () => { loadRoomInvites(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedChild?.id]);

  const loadFriends = async () => {
    if (!selectedChild?.id) return;

    try {
      setIsLoading(true);

      // Use edge function to fetch friends with names/avatars reliably
      const { data } = await supabase.functions.invoke('manage-friends', {
        body: {
          action: 'list_friends',
          child_id: selectedChild.id
        }
      });

      if (!data?.success) throw new Error(data?.error || 'Failed to load friends');

      const apiFriends: any[] = data.data || [];

      // Merge online status from current onlineUsers state (override edge fn status if we have fresher data)
      const merged = apiFriends.map((f) => {
        const online = onlineUsers.find(u => u.id === f.child_id)?.status;
        return {
          id: f.id,
          child_id: f.child_id,
          name: f.name,
          avatar: f.avatar || '👤',
          status: (online || f.status || 'offline') as Friend['status']
        } as Friend;
      })
      // Sort: online first, then by name
      .sort((a, b) => {
        if (a.status === b.status) return (a.name || '').localeCompare(b.name || '');
        return a.status === 'online' ? -1 : 1;
      });

      setFriends(merged);
    } catch (error) {
      console.error('Error loading friends:', error);
      toast({
        title: 'Error',
        description: 'Failed to load friends',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadOnlineUsers = async () => {
    if (!selectedChild?.id) return;

    try {
      setIsLoadingOnlineUsers(true);
      
      const { data } = await supabase.functions.invoke('manage-friends', {
        body: {
          action: 'list_all_children',
          child_id: selectedChild.id
        }
      });

      if (!data?.success) throw new Error(data?.error || 'Failed to load');

      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
      const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

      const onlineUsersList: OnlineUser[] = (data.data || []).map((child: any) => {
        // Use database online status if available, otherwise fall back to time-based status
        let status: 'online' | 'in-game' | 'offline' = 'offline';
        
        if (child.is_online) {
          status = 'online';
        } else {
          // Fallback to time-based status
          const lastSeen = new Date(child.last_seen_at || child.updated_at);
          if (lastSeen > fiveMinutesAgo) {
            status = 'online';
          }
        }

        return {
          id: child.id,
          name: child.name,
          avatar: child.avatar || '👤',
          status,
          last_seen: child.last_seen_at || child.updated_at
        };
      })
      // Sort: online first, then by name
      .sort((a: OnlineUser, b: OnlineUser) => {
        if (a.status === b.status) return a.name.localeCompare(b.name);
        return a.status === 'online' ? -1 : 1;
      });

      setOnlineUsers(onlineUsersList);
    } catch (error) {
      console.error('Error loading online users:', error);
      toast({
        title: "Error",
        description: "Failed to load users",
        variant: "destructive",
      });
    } finally {
      setIsLoadingOnlineUsers(false);
    }
  };

  const refreshOnlineUsers = () => {
    loadOnlineUsers();
    toast({
      title: "Refreshed",
      description: "Online users list updated",
    });
  };

  const loadFriendRequests = async () => {

    try {
      const { data } = await supabase.functions.invoke('manage-friends', {
        body: {
          action: 'get_friend_requests',
          child_id: selectedChild.id
        }
      });

      if (data?.success) {
        setFriendRequests(data.data);
      }
    } catch (error) {
      console.error('Error loading friend requests:', error);
    }
  };

  const loadRoomInvites = async () => {
    if (!selectedChild?.id) return;
    try {
      const { data } = await supabase
        .from('join_requests')
        .select('*')
        .eq('child_id', selectedChild.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      setRoomInvites((data || []) as RoomInvitation[]);
    } catch (e) {
      console.error('Error loading room invites:', e);
    }
  };

  const handleInvitation = async (requestId: string, approve: boolean) => {
    try {
      const { data } = await supabase.functions.invoke('manage-game-rooms', {
        body: { action: 'handle_join_request', request_id: requestId, approve },
      });
      if (data?.success) {
        if (approve && data?.room) {
          const room = data.room;
          window.location.href = `/games/${room.game_id}?difficulty=${room.difficulty}&room=${room.room_code}`;
        }
        await loadRoomInvites();
      } else {
        toast({ title: 'Error', description: data?.error || 'Failed to handle invite', variant: 'destructive' });
      }
    } catch (err) {
      console.error('Error handling invite:', err);
      toast({ title: 'Error', description: 'Failed to handle invite', variant: 'destructive' });
    }
  };

  const searchChildren = async () => {
    if (!selectedChild?.id || !searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setIsSearching(true);
      const { data } = await supabase.functions.invoke('manage-friends', {
        body: {
          action: 'search_children',
          child_id: selectedChild.id,
          search_query: searchQuery
        }
      });

      if (data?.success) {
        setSearchResults(data.data);
      }
    } catch (error) {
      console.error('Error searching children:', error);
      toast({
        title: "Error",
        description: "Failed to search for friends",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const sendFriendRequest = async (friendChildId: string) => {
    if (!selectedChild?.id) return;

    try {
      setIsLoading(true);
      const { data } = await supabase.functions.invoke('manage-friends', {
        body: {
          action: 'send_friend_request',
          child_id: selectedChild.id,
          friend_child_id: friendChildId
        }
      });

      if (data?.success) {
        toast({
          title: "Friend Request Sent",
          description: "Your friend request has been sent!",
        });
        setSearchQuery("");
        setSearchResults([]);
      } else {
        toast({
          title: "Error",
          description: data?.error || "Failed to send friend request",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error sending friend request:', error);
      toast({
        title: "Error",
        description: "Failed to send friend request",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFriendRequest = async (requestId: string, action: 'accept' | 'decline') => {
    try {
      setIsLoading(true);
      const { data } = await supabase.functions.invoke('manage-friends', {
        body: {
          action: action === 'accept' ? 'accept_friend_request' : 'decline_friend_request',
          friend_request_id: requestId
        }
      });

      if (data?.success) {
        toast({
          title: action === 'accept' ? "Friend Request Accepted" : "Friend Request Declined",
          description: action === 'accept' ? "You are now friends!" : "Friend request declined",
        });
        
        // Refresh both lists regardless of action to ensure UI consistency
        await loadFriendRequests();
        if (action === 'accept') {
          // Add a small delay to ensure the database transaction is complete
          setTimeout(async () => {
            await loadFriends();
          }, 500);
        }
      } else {
        toast({
          title: "Error",
          description: data?.error || "Failed to handle friend request",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error handling friend request:', error);
      toast({
        title: "Error",
        description: "Failed to handle friend request",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnfriend = async (friendshipId: string, friendName: string) => {
    if (!selectedChild?.id) return;

    try {
      setIsLoading(true);
      const { data } = await supabase.functions.invoke('manage-friends', {
        body: {
          action: 'unfriend',
          friendship_id: friendshipId
        }
      });

      if (data?.success) {
        toast({
          title: "Friend Removed",
          description: `${friendName} has been removed from your friends list`,
        });
        await loadFriends();
      } else {
        toast({
          title: "Error",
          description: data?.error || "Failed to remove friend",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error removing friend:', error);
      toast({
        title: "Error",
        description: "Failed to remove friend",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleInviteSelected = () => {
    if (selectedUsers.length > 0) {
      onInviteFriend(selectedUsers);
      setSelectedUsers([]);
    }
  };
  useEffect(() => {
    const timer = setTimeout(() => {
      searchChildren();
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'in-game': return 'bg-yellow-500';
      default: return 'bg-gray-400';
    }
  };

  return (
    <Card className="w-full h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          👥 Friends
          <Badge variant="secondary">{friends.length}</Badge>
          {(friendRequests.length + roomInvites.length) > 0 && (
            <Badge variant="destructive">{friendRequests.length + roomInvites.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 h-full">
        <Tabs defaultValue="friends" className="w-full ">
          <TabsList className="grid w-full h-full grid-cols-3">
            <TabsTrigger value="friends" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Friends
            </TabsTrigger>
            <TabsTrigger value="requests" className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Requests
              {(friendRequests.length + roomInvites.length) > 0 && (
                <Badge variant="destructive" className="ml-1 text-xs">
                  {friendRequests.length + roomInvites.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="search" className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              Search
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="friends" className="space-y-4">
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => { loadFriends(); loadOnlineUsers(); }}>
                🔄 Refresh
              </Button>
            </div>
            {selectedUsers.length > 0 && (
              <div className="flex items-center justify-between bg-secondary/20 rounded-lg p-3">
                <span className="text-sm font-medium">{selectedUsers.length} selected</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setSelectedUsers([])}>
                    Clear
                  </Button>
                  <Button size="sm" onClick={handleInviteSelected}>
                    Invite to Game
                  </Button>
                </div>
              </div>
            )}
            
            <ScrollArea className="h-60">
              <div className="space-y-2">
                {friends.map((friend) => (
                  <div
                    key={friend.id}
                    className="flex items-center justify-between p-3 bg-secondary/20 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      {friend.status === 'online' && (
                        <Checkbox
                          checked={selectedUsers.includes(friend.child_id)}
                          onCheckedChange={() => toggleUserSelection(friend.child_id)}
                        />
                      )}
                      <div className="relative">
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={friend.avatar} />
                          <AvatarFallback>{friend.name?.[0] || '?'}</AvatarFallback>
                        </Avatar>
                        <div 
                          className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-background ${getStatusColor(friend.status)}`}
                        />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{friend.name || 'Friend'}</p>
                        <p className="text-xs text-muted-foreground capitalize">{friend.status}</p>
                      </div>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleUnfriend(friend.id, friend.name)}
                      disabled={isLoading}
                      title="Remove friend"
                    >
                      <UserMinus className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                
                {friends.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <p className="text-sm">No friends yet!</p>
                    <p className="text-xs">Search and add friends to play together</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="requests" className="space-y-4">
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => { loadFriendRequests(); loadRoomInvites(); }}>
                🔄 Refresh
              </Button>
            </div>
            <ScrollArea className="h-60">
              <div className="space-y-3">
                {/* Room Invitations */}
                <div>
                  <div className="text-xs text-muted-foreground mb-2">Room Invitations ({roomInvites.length})</div>
                  {roomInvites.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground">
                      <p className="text-xs">No room invitations</p>
                    </div>
                  ) : (
                    roomInvites.map((invite) => (
                      <div key={invite.id} className="flex items-center justify-between p-3 bg-secondary/20 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-8 h-8">
                            <AvatarImage src={invite.player_avatar} />
                            <AvatarFallback>{invite.player_name?.[0] || '?'}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm">From {invite.player_name}</p>
                            <p className="text-xs text-muted-foreground">Room: {invite.room_code}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleInvitation(invite.id, true)}>Accept</Button>
                          <Button size="sm" variant="outline" onClick={() => handleInvitation(invite.id, false)}>Decline</Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Friend Requests */}
                <div>
                  <div className="text-xs text-muted-foreground mb-2">Friend Requests ({friendRequests.length})</div>
                  {friendRequests.map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center justify-between p-3 bg-secondary/20 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={request.requester.avatar} />
                          <AvatarFallback>{request.requester.name[0]}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm">{request.requester.name}</p>
                          <p className="text-xs text-muted-foreground">Wants to be friends</p>
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleFriendRequest(request.id, 'accept')}
                          disabled={isLoading}
                        >
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleFriendRequest(request.id, 'decline')}
                          disabled={isLoading}
                        >
                          Decline
                        </Button>
                      </div>
                    </div>
                  ))}
                  {friendRequests.length === 0 && (
                    <div className="text-center py-6 text-muted-foreground">
                      <p className="text-xs">No friend requests</p>
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="search" className="space-y-4">
            <div className="flex gap-2">
              <Button
                onClick={refreshOnlineUsers}
                disabled={isLoadingOnlineUsers}
                size="sm"
                variant="outline"
                className="flex items-center gap-2"
              >
                🔄 Refresh
              </Button>
              {/* Persistent search bar: always visible in Search tab */}
              <Input
                placeholder="Search by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1"
              />
            </div>

            {selectedUsers.length > 0 && (
              <div className="flex items-center justify-between bg-secondary/20 rounded-lg p-3">
                <span className="text-sm font-medium">{selectedUsers.length} selected</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setSelectedUsers([])}>
                    Clear
                  </Button>
                  <Button size="sm" onClick={handleInviteSelected}>
                    Invite to Game
                  </Button>
                </div>
              </div>
            )}

            {/* If user typed a search query, show search results; otherwise show online users */}
            {searchQuery.trim() ? (
              <>
                <ScrollArea className="h-60">
                  <div className="space-y-2">
                    {isSearching && (
                      <div className="text-center py-4 text-muted-foreground">
                        <p className="text-sm">Searching...</p>
                      </div>
                    )}
                    
                    {!isSearching && searchResults.map((result) => (
                      <div
                        key={result.id}
                        className="flex items-center justify-between p-3 bg-secondary/20 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="w-8 h-8">
                            <AvatarImage src={result.avatar} />
                            <AvatarFallback>{result.name[0]}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm">{result.name}</p>
                          </div>
                        </div>
                        
                        <Button
                          size="sm"
                          onClick={() => sendFriendRequest(result.id)}
                          disabled={isLoading}
                        >
                          Add Friend
                        </Button>
                      </div>
                    ))}

                    {!isSearching && searchResults.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <p className="text-sm">No users found</p>
                        <p className="text-xs">Try a different search term</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </>
            ) : (
              <ScrollArea className="h-60">
                <div className="space-y-1">
                  {isLoadingOnlineUsers && (
                    <div className="text-center py-4 text-muted-foreground">
                      <p className="text-sm">Loading online users...</p>
                    </div>
                  )}
                  
                  {!isLoadingOnlineUsers && onlineUsers.map((user) => {
                    const isOnline = user.status === 'online';
                    const bgClass = isOnline ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-secondary/20 border-border';
                    
                    return (
                      <div
                        key={user.id}
                        className={`flex items-center justify-between p-3 rounded-lg border ${bgClass}`}
                      >
                        <div className="flex items-center gap-3">
                          {isOnline && (
                            <Checkbox
                              checked={selectedUsers.includes(user.id)}
                              onCheckedChange={() => toggleUserSelection(user.id)}
                            />
                          )}
                          <div className="relative">
                            <Avatar className="w-8 h-8">
                              <AvatarImage src={user.avatar} />
                              <AvatarFallback>{user.name[0]}</AvatarFallback>
                            </Avatar>
                            <div 
                              className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-background ${getStatusColor(user.status)}`}
                            />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{user.name}</p>
                            <p className="text-xs text-muted-foreground capitalize">
                              {user.status === 'online' ? 'Online' : 'Offline'}
                            </p>
                          </div>
                        </div>
                        
                        <Button
                          size="sm"
                          onClick={() => sendFriendRequest(user.id)}
                          variant="outline"
                          disabled={isLoading}
                        >
                          Add Friend
                        </Button>
                      </div>
                    );
                  })}
                  
                  {!isLoadingOnlineUsers && onlineUsers.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <p className="text-sm">No other users found</p>
                      <p className="text-xs">Other users will appear here when they're active</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default FriendsPanel;
