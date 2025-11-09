import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAppAuth, useAppContext } from '@/contexts/Auth0Context';
import { User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AppHeader } from '@/components/Navigation/AppHeader';

const AVATARS = ['🦄', '🐸', '🦋', '🐱', '🐶', '🦊', '🐯', '🐻'];
const AGE_GROUPS = [
  { value: 'toddler', label: '2-3 years (Toddler)' },
  { value: 'preschool', label: '4-5 years (Preschool)' },
  { value: 'elementary', label: '6-8 years (Elementary)' },
  { value: 'tween', label: '9-12 years (Tween)' }
];

const Profile = () => {
  const { user } = useAppAuth();
  const { parentProfile, selectedChild, setSelectedChild, childrenProfiles, refreshProfiles, isLoadingProfiles } = useAppContext();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [ageGroup, setAgeGroup] = useState<string>('');
  const [avatar, setAvatar] = useState('🦄');
  const [isEditing, setIsEditing] = useState(() => {
    // Wait for profiles to load before determining initial state
    // Default to false (show children list) to prevent flashing
    return false;
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Wait for profiles to finish loading before setting the correct state
    if (isLoadingProfiles) return;
    
    if (selectedChild) {
      setName(selectedChild.name);
      setAgeGroup(selectedChild.age_group);
      setAvatar(selectedChild.avatar || '🦄');
      setIsEditing(false); // Show children list when child is selected
    } else {
      // Only show editing mode if there are no children profiles at all
      const shouldEdit = !childrenProfiles || childrenProfiles.length === 0;
      setIsEditing(shouldEdit);
    }
  }, [selectedChild, childrenProfiles, isLoadingProfiles]);

  const handleSave = async () => {
    if (!user?.sub || !name.trim() || !ageGroup || !parentProfile) return;

    setIsLoading(true);
    try {
      const profileData = {
        name: name.trim(),
        age_group: ageGroup,
        avatar,
        parent_id: parentProfile.id
      };

      const { data, error } = await supabase.functions.invoke('manage-profiles', {
        body: {
          action: selectedChild ? 'update_child' : 'create_child',
          auth0_user_id: user.sub,
          profile_data: selectedChild ? { ...profileData, child_id: selectedChild.id } : profileData
        }
      });

      if (error) throw error;

      await refreshProfiles();
      
      if (!selectedChild && data?.data) {
        // Set the newly created child as selected
        setSelectedChild(data.data);
      }
      
      setIsEditing(false);
      
      if (!selectedChild) {
        // First time profile creation - redirect to modes
        navigate('/modes');
      }
    } catch (error) {
      console.error('Error saving profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/20 to-secondary/20">
      <AppHeader 
        title="Child Profiles" 
        showHomeButton={true}
      />
      
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        {/* Show loading state while profiles are loading */}
        {isLoadingProfiles && (
          <Card className="shadow-soft">
            <CardContent className="py-8">
              <div className="text-center">
                <div className="text-2xl mb-2">⏳</div>
                <p className="text-muted-foreground">Loading profiles...</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Existing Children List */}
        {!isLoadingProfiles && !isEditing && childrenProfiles && childrenProfiles.length > 0 && (
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="font-fredoka text-center">My Children</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {childrenProfiles.map(child => (
                  <div 
                    key={child.id}
                    className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
                      selectedChild?.id === child.id
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => setSelectedChild(child)}
                  >
                      <div className="text-center space-y-2">
                      <div className="text-3xl">{child.avatar || '👤'}</div>
                      <h3 className="font-fredoka font-bold">{child.name}</h3>
                      <p className="text-sm text-muted-foreground capitalize">{child.age_group}</p>
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedChild(child);
                            setIsEditing(true);
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={async (e) => {
                            e.stopPropagation();
                            // Confirm deletion
                            const confirmed = window.confirm(`Delete ${child.name}? This action cannot be undone.`);
                            if (!confirmed) return;

                            try {
                              // call supabase edge function to delete the child
                              await supabase.functions.invoke('manage-profiles', {
                                body: {
                                  action: 'delete_child',
                                  auth0_user_id: user?.sub,
                                  profile_data: { child_id: child.id }
                                }
                              });

                              // refresh profiles afterwards
                              await refreshProfiles();

                              // if the deleted child was selected, clear selection
                              if (selectedChild?.id === child.id) {
                                setSelectedChild(null);
                              }
                            } catch (err) {
                              console.error('Error deleting child profile:', err);
                              // minimal user feedback
                              alert('Failed to delete profile. Please try again.');
                            }
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 text-center space-y-3">
                {selectedChild && (
                  <Button 
                    variant="fun" 
                    size="kid" 
                    className="w-full"
                    onClick={() => navigate('/modes')}
                  >
                    🎮 Continue with {selectedChild.name}
                  </Button>
                )}
                <Button 
                  variant="outline"
                  onClick={() => {
                    setName('');
                    setAgeGroup('');
                    setAvatar('🦄');
                    setSelectedChild(null);
                    setIsEditing(true);
                  }}
                >
                  ➕ Add Another Child
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Profile Creation/Editing Form */}
        {!isLoadingProfiles && (isEditing || !childrenProfiles || childrenProfiles.length === 0) && (
          <Card className="shadow-soft">
            <CardHeader className="text-center">
              <div className="w-20 h-20 mx-auto bg-gradient-primary rounded-full flex items-center justify-center text-4xl shadow-soft">
                {avatar}
              </div>
              <CardTitle className="font-fredoka">
                {isEditing ? (selectedChild ? 'Edit Profile' : 'Add New Child') : 'Create Child Profile'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label className="font-comic font-bold">Child's Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter name"
                  className="h-12 text-lg font-comic rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label className="font-comic font-bold">Age Group</Label>
                <Select value={ageGroup} onValueChange={setAgeGroup}>
                  <SelectTrigger className="h-12 text-lg font-comic rounded-xl">
                    <SelectValue placeholder="Select age group" />
                  </SelectTrigger>
                  <SelectContent>
                    {AGE_GROUPS.map(group => (
                      <SelectItem key={group.value} value={group.value}>
                        {group.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="font-comic font-bold">Choose Avatar</Label>
                <div className="grid grid-cols-4 gap-3">
                  {AVATARS.map(emoji => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setAvatar(emoji)}
                      className={`w-12 h-12 text-2xl rounded-xl border-2 transition-all ${
                        avatar === emoji 
                          ? 'border-primary bg-primary/10 scale-110' 
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <Button 
                  variant="fun" 
                  size="kid" 
                  className="flex-1"
                  onClick={handleSave}
                  disabled={!name.trim() || !ageGroup || isLoading}
                >
                  {isLoading ? '💾 Saving...' : (selectedChild ? '💾 Save Changes' : '🚀 Create Profile')}
                </Button>
                {childrenProfiles && childrenProfiles.length > 0 && (
                  <Button 
                    variant="outline"
                    onClick={() => {
                      setIsEditing(false);
                      if (!selectedChild && childrenProfiles.length > 0) {
                        setSelectedChild(childrenProfiles[0]);
                      }
                    }}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Profile;