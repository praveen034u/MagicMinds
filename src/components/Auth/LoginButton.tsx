import { useAuth0 } from '@auth0/auth0-react';
import { Button } from '@/components/ui/button';
import { LogIn } from 'lucide-react';

export const LoginButton = () => {
  const { loginWithRedirect, isLoading } = useAuth0();

  const handleLogin = () => {
    const inIframe = window.self !== window.top;

    if (inIframe) {
      // Open Auth0 in the top window to avoid CSP frame-ancestors errors
      (loginWithRedirect as any)({
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
    } else {
      loginWithRedirect();
    }
  };

  return (
    <Button 
      onClick={handleLogin} 
      disabled={isLoading}
      className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white border-0 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 py-6 text-lg font-medium rounded-2xl"
      size="lg"
    >
      <LogIn className="w-5 h-5 mr-2" />
      {isLoading ? 'Loading...' : 'Log In / Sign Up'}
    </Button>
  );
};