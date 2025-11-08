import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useAppAuth, useAppContext } from '@/contexts/Auth0Context';
import { Shield, Clock, Moon, ArrowRight } from 'lucide-react';
import { AppHeader } from '@/components/Navigation/AppHeader';

const ParentSetup = () => {
  const { user } = useAppAuth();
  const { parentProfile, selectedChild } = useAppContext();
  const navigate = useNavigate();
  
  // Parent Profile State
  const [parentName, setParentName] = useState(parentProfile?.name || user?.name || '');
  const [parentEmail, setParentEmail] = useState(parentProfile?.email || user?.email || '');
  
  // Screen Time Controls
  const [screenTimeEnabled, setScreenTimeEnabled] = useState(false);
  const [dailyLimitMinutes, setDailyLimitMinutes] = useState(120);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('20:00');
  
  // Bedtime Controls
  const [bedTimeEnabled, setBedTimeEnabled] = useState(false);
  const [bedTime, setBedTime] = useState('21:00');
  const [warningMinutes, setWarningMinutes] = useState(15);

  const handleSave = () => {
    // For now, we'll just navigate to modes since the parent profile
    // is already created in the database via Auth0Context
    // In a future version, we could store the control settings in the database
    navigate('/modes');
  };

  const handleSkip = () => {
    navigate('/modes');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/20 to-secondary/20">
      <AppHeader title="Parent Controls" showHomeButton={false} />
      
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto bg-gradient-primary rounded-full flex items-center justify-center mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <p className="text-muted-foreground font-comic">
            Set up screen time and bedtime controls for {selectedChild?.name} (Optional)
          </p>
        </div>

        <div className="space-y-6">
          {/* Parent Profile */}
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="font-fredoka flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Parent Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="font-comic font-bold">Parent Name</Label>
                <Input
                  value={parentName}
                  onChange={(e) => setParentName(e.target.value)}
                  placeholder="Enter your name"
                  className="h-12 text-lg font-comic rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label className="font-comic font-bold">Email</Label>
                <Input
                  value={parentEmail}
                  onChange={(e) => setParentEmail(e.target.value)}
                  placeholder="Enter email"
                  type="email"
                  className="h-12 text-lg font-comic rounded-xl"
                />
              </div>
            </CardContent>
          </Card>

          {/* Screen Time Controls */}
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="font-fredoka flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Screen Time Controls
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-comic font-bold">Enable Screen Time Limits</p>
                  <p className="text-sm text-muted-foreground">Control daily usage and hours</p>
                </div>
                <Switch
                  checked={screenTimeEnabled}
                  onCheckedChange={setScreenTimeEnabled}
                />
              </div>
              
              {screenTimeEnabled && (
                <div className="space-y-4 border-t pt-4">
                  <div className="space-y-2">
                    <Label className="font-comic font-bold">Daily Limit (minutes)</Label>
                    <Input
                      type="number"
                      value={dailyLimitMinutes}
                      onChange={(e) => setDailyLimitMinutes(Number(e.target.value))}
                      min="30"
                      max="480"
                      className="h-12 text-lg font-comic rounded-xl"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="font-comic font-bold">Start Time</Label>
                      <Input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="h-12 text-lg font-comic rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="font-comic font-bold">End Time</Label>
                      <Input
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="h-12 text-lg font-comic rounded-xl"
                      />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Bedtime Controls */}
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="font-fredoka flex items-center gap-2">
                <Moon className="w-5 h-5" />
                Bedtime Controls
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-comic font-bold">Enable Bedtime Reminders</p>
                  <p className="text-sm text-muted-foreground">Get warnings before bedtime</p>
                </div>
                <Switch
                  checked={bedTimeEnabled}
                  onCheckedChange={setBedTimeEnabled}
                />
              </div>
              
              {bedTimeEnabled && (
                <div className="space-y-4 border-t pt-4">
                  <div className="space-y-2">
                    <Label className="font-comic font-bold">Bedtime</Label>
                    <Input
                      type="time"
                      value={bedTime}
                      onChange={(e) => setBedTime(e.target.value)}
                      className="h-12 text-lg font-comic rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-comic font-bold">Warning (minutes before)</Label>
                    <Input
                      type="number"
                      value={warningMinutes}
                      onChange={(e) => setWarningMinutes(Number(e.target.value))}
                      min="5"
                      max="60"
                      className="h-12 text-lg font-comic rounded-xl"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <Button 
              variant="outline" 
              size="lg"
              className="flex-1"
              onClick={handleSkip}
            >
              Skip for Now
            </Button>
            <Button 
              variant="fun" 
              size="lg"
              className="flex-1"
              onClick={handleSave}
            >
              Save & Continue
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ParentSetup;