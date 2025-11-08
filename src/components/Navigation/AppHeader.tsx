import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { LogoutButton } from '@/components/Auth/LogoutButton';
import { Home, ArrowLeft, User } from 'lucide-react';
import { ChildSwitcher } from './ChildSwitcher';

interface AppHeaderProps {
  title?: string;
  showHomeButton?: boolean;
  showBackButton?: boolean;
  customBackAction?: () => void;
}

export const AppHeader = ({ 
  title, 
  showHomeButton = true, 
  showBackButton = false,
  customBackAction 
}: AppHeaderProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleHome = () => {
    navigate('/modes');
  };

  const handleBack = () => {
    if (customBackAction) {
      customBackAction();
    } else {
      navigate(-1);
    }
  };

  // Don't show home button if we're already on the home page
  const isHomePage = location.pathname === '/modes';

  return (
    <header className="w-full bg-background/80 backdrop-blur-sm border-b border-border sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {showBackButton && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleBack}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
            )}
            {title && (
              <h1 className="text-xl font-fredoka font-semibold text-foreground">
                {title}
              </h1>
            )}
          </div>

          <div className="flex items-center gap-2">
            <ChildSwitcher />
            {showHomeButton && !isHomePage && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleHome}
                className="flex items-center gap-2"
              >
                <Home className="w-4 h-4" />
                Home
              </Button>
            )}
            <LogoutButton />
          </div>
        </div>
      </div>
    </header>
  );
};