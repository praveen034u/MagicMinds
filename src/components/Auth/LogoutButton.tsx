import { useAppAuth } from '@/contexts/Auth0Context';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export const LogoutButton = () => {
  const { logout, isLoading } = useAppAuth();

  const handleLogout = async () => {
    try {
      // Set room_id to null for all children before logout
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Get all children profiles for this user
        const { data: children } = await supabase
          .from('children_profiles')
          .select('id')
          .eq('parent_id', (
            await supabase
              .from('parent_profiles')
              .select('id')
              .eq('auth0_user_id', user.id)
              .single()
          )?.data?.id);
        
        if (children && children.length > 0) {
          // Set all children's room_id to null (equivalent to leaving rooms)
          await supabase
            .from('children_profiles')
            .update({ room_id: null } as any)
            .in('id', children.map(c => c.id));
        }
      }
    } catch (error) {
      console.error('Error updating room status on logout:', error);
    }
    
    const returnTo = `${window.location.origin}/`;
    (logout as any)({ 
      logoutParams: { returnTo },
      openUrl: (url: string) => {
        try {
          if (window.top) {
            (window.top as Window).location.assign(url);
          } else {
            window.location.assign(url);
          }
        } catch (e) {
          window.open(url, '_blank', 'noopener,noreferrer');
        }
      }
    });
  };

  return (
    <Button 
      onClick={handleLogout} 
      disabled={isLoading}
      variant="outline"
      size="sm"
    >
      <LogOut className="w-4 h-4 mr-2" />
      {isLoading ? 'Loading...' : 'Logout'}
    </Button>
  );
};