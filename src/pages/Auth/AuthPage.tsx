import { useAuth0 } from '@auth0/auth0-react';
import { LoginButton } from '@/components/Auth/LoginButton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export const AuthPage = () => {
  const { isAuthenticated, isLoading } = useAuth0();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/profile');
    }
  }, [isAuthenticated, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/20 to-secondary/20">
        <div className="text-2xl font-fredoka text-primary">Loading... 🎮</div>
      </div>
    );
  }

  if (isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" 
         style={{ background: 'linear-gradient(135deg, #E0C3FC 0%, #9BB5FF 100%)' }}>
      <Card className="w-full max-w-lg bg-white/95 backdrop-blur-sm shadow-2xl border-0 rounded-3xl">
        <CardHeader className="text-center pb-6">
          <CardTitle className="text-4xl font-fredoka font-bold">
            <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              StoryTeller 📚
            </span>
          </CardTitle>
          <CardDescription className="text-lg text-gray-600 mt-2">
            Create magical AI-powered stories with voice cloning for your children
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center mb-8">
            <h3 className="text-xl font-semibold text-gray-800 mb-6">Features:</h3>
            <div className="space-y-4">
              <div className="flex items-center space-x-3 p-3 rounded-xl bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200">
                <div className="text-2xl">⭐</div>
                <span className="font-medium text-gray-700">AI-powered story generation</span>
              </div>
              <div className="flex items-center space-x-3 p-3 rounded-xl bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200">
                <div className="text-2xl">👫</div>
                <span className="font-medium text-gray-700">Play with friends together</span>
              </div>
              <div className="flex items-center space-x-3 p-3 rounded-xl bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200">
                <div className="text-2xl">🎤</div>
                <span className="font-medium text-gray-700">Voice cloning technology</span>
              </div>
              <div className="flex items-center space-x-3 p-3 rounded-xl bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200">
                <div className="text-2xl">📚</div>
                <span className="font-medium text-gray-700">Personalized story library</span>
              </div>
              <div className="flex items-center space-x-3 p-3 rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200">
                <div className="text-2xl">🎮</div>
                <span className="font-medium text-gray-700">Fun & educational games</span>
              </div>
            </div>
          </div>
          <div className="pt-4">
            <LoginButton />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};