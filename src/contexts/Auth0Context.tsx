import { Auth0Provider, useAuth0 } from '@auth0/auth0-react';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ParentProfile {
  id: string;
  auth0_user_id: string;
  email: string;
  name?: string;
  created_at: string;
  updated_at: string;
}

interface ChildProfile {
  id: string;
  parent_id: string;
  name: string;
  age_group: string;
  avatar?: string;
  voice_clone_enabled: boolean;
  voice_clone_url?: string;
  created_at: string;
  updated_at: string;
}

interface VoiceSubscription {
  id: string;
  parent_id: string;
  stripe_subscription_id?: string;
  stripe_customer_id?: string;
  status: string;
  plan_type: string;
  created_at: string;
  updated_at: string;
}

interface AppContextType {
  parentProfile: ParentProfile | null;
  childrenProfiles: ChildProfile[];
  selectedChild: ChildProfile | null;
  voiceSubscription: VoiceSubscription | null;
  setSelectedChild: (child: ChildProfile | null) => void;
  refreshProfiles: () => Promise<void>;
  isLoadingProfiles: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const Auth0ProviderWrapper = ({ children }: { children: ReactNode }) => {
  return (
    <Auth0Provider
      domain="dev-jbrriuc5vyjmiwtx.us.auth0.com"
      clientId="eh3lkyPjejB7dngFewuGp6FSP1l6j39D"
      authorizationParams={{
        redirect_uri: `${window.location.origin}/`,
        audience: "https://dev-jbrriuc5vyjmiwtx.us.auth0.com/userinfo",
        scope: "openid profile email"
      }}
      useRefreshTokens={true}
      cacheLocation="localstorage"
    >
      <AppContextProvider>
        {children}
      </AppContextProvider>
    </Auth0Provider>
  );
};

export const AppContextProvider = ({ children }: { children: ReactNode }) => {
  const { user, isAuthenticated, getAccessTokenSilently, isLoading } = useAuth0();
  const [parentProfile, setParentProfile] = useState<ParentProfile | null>(null);
  const [childrenProfiles, setChildrenProfiles] = useState<ChildProfile[]>([]);
  const [selectedChild, setSelectedChild] = useState<ChildProfile | null>(null);
  const [voiceSubscription, setVoiceSubscription] = useState<VoiceSubscription | null>(null);
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(false);

  const setCurrentUser = async (auth0UserId: string) => {
    // Set the current Auth0 user ID for RLS policies  
    try {
      await supabase.rpc('set_config', {
        setting: 'app.current_auth0_user_id',
        value: auth0UserId
      } as any);
    } catch (error) {
      console.error('Error setting current user:', error);
    }
  };

  const updateChildOnlineStatus = async (childId: string, isOnline: boolean) => {
    try {
      await supabase.functions.invoke('manage-profiles', {
        body: {
          action: 'set_child_online_status',
          child_id: childId,
          profile_data: { is_online: isOnline }
        }
      });
    } catch (error) {
      console.error('Error updating child online status:', error);
    }
  };

  const refreshProfiles = async () => {
    if (!isAuthenticated || !user?.sub) return;
    
    setIsLoadingProfiles(true);
    try {
      await setCurrentUser(user.sub);
      console.log('Auth0 user:', user); // Debug log

      // Fetch parent profile via Edge Function (ensures RLS context)
      const { data: parentResp, error: parentFnError } = await supabase.functions.invoke('manage-profiles', {
        body: {
          action: 'get_parent',
          auth0_user_id: user.sub,
          profile_data: {}
        }
      });

      console.log('Parent profile fetch (edge):', { parentResp, parentFnError }); // Debug log

      if (parentFnError) {
        console.error('Error fetching parent profile (edge):', parentFnError);
      } else if (parentResp?.data) {
        const fetchedParent = parentResp.data as ParentProfile;
        setParentProfile(fetchedParent);

        // Fetch children profiles via Edge Function
        const { data: childrenResp, error: childrenFnError } = await supabase.functions.invoke('manage-profiles', {
          body: {
            action: 'get_children',
            auth0_user_id: user.sub,
            profile_data: { parent_id: fetchedParent.id }
          }
        });

        if (childrenFnError) {
          console.error('Error fetching children profiles (edge):', childrenFnError);
        } else {
          const childrenData = (childrenResp?.data || []) as ChildProfile[];
          setChildrenProfiles(childrenData);
          
          // Set all children as online when parent logs in
          for (const child of childrenData) {
            updateChildOnlineStatus(child.id, true);
          }
          
          // Auto-select the first child if none is selected and we have children
          if (childrenData.length > 0 && !selectedChild) {
            setSelectedChild(childrenData[0]);
          }
        }

        // Fetch voice subscription (keep existing approach; optional)
        const { data: subscriptionData, error: subscriptionError } = await supabase
          .from('voice_subscriptions')
          .select('*')
          .eq('parent_id', fetchedParent.id)
          .single();

        if (subscriptionError && subscriptionError.code !== 'PGRST116') {
          console.error('Error fetching subscription:', subscriptionError);
        } else if (subscriptionData) {
          setVoiceSubscription(subscriptionData);
        }
      } else if (user?.email) {
        // Create parent profile if it doesn't exist (via Edge Function to bypass RLS)
        console.log('Creating new parent profile for user:', user.sub); // Debug log
        const newProfile = {
          email: user.email as string,
          name: (user.name || user.email) as string
        };

        const { data: createResponse, error: createFnError } = await supabase.functions.invoke('manage-profiles', {
          body: {
            action: 'create_parent',
            auth0_user_id: user.sub,
            profile_data: newProfile
          }
        });

        console.log('Profile creation result (edge function):', { createResponse, createFnError });

        if (createFnError) {
          console.error('Error creating parent profile (edge):', createFnError);
        } else if (createResponse?.data) {
          setParentProfile(createResponse.data);
        }
      }
    } catch (error) {
      console.error('Error refreshing profiles:', error);
    } finally {
      setIsLoadingProfiles(false);
    }
  };

  // Handle logout - set all children offline
  useEffect(() => {
    if (!isLoading && !isAuthenticated && childrenProfiles.length > 0) {
      // Set all children offline when parent logs out
      childrenProfiles.forEach(child => {
        updateChildOnlineStatus(child.id, false);
      });
    }
  }, [isAuthenticated, isLoading, childrenProfiles]);

  useEffect(() => {
    if (!isLoading && isAuthenticated && user?.sub) {
      refreshProfiles();
    }
  }, [isAuthenticated, isLoading, user?.sub]);

  return (
    <AppContext.Provider value={{
      parentProfile,
      childrenProfiles,
      selectedChild,
      voiceSubscription,
      setSelectedChild,
      refreshProfiles,
      isLoadingProfiles
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppContextProvider');
  }
  return context;
};

export const useAppAuth = () => {
  return useAuth0();
};