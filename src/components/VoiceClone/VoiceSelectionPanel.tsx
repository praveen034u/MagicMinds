import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

type Voice = {
  id: string;
  name: string;
  type: "default" | "cloned";
  preview?: string;
};

type VoiceSelectionPanelProps = {
  onSelectVoice: (voice: Voice) => void;
  selectedVoice?: Voice;
};

const defaultVoices: Voice[] = [
  { id: "v1", name: "Adult Male", type: "default" },
  { id: "v2", name: "Adult Female", type: "default" },
  { id: "v3", name: "Child", type: "default" },
  { id: "v4", name: "Elderly", type: "default" },
];

export const VoiceSelectionPanel = ({ onSelectVoice, selectedVoice }: VoiceSelectionPanelProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [userVoices, setUserVoices] = useState<Voice[]>([]);
  const [newVoiceName, setNewVoiceName] = useState("");
  const [showCloneDialog, setShowCloneDialog] = useState(false);
  const [cloneMethod, setCloneMethod] = useState<"record" | "upload">("record");
  const [hasSubscription, setHasSubscription] = useState(false); // TODO: Get this from your auth context
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/wav' });
        setRecordedBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      toast({
        title: "Recording started",
        description: "Speak clearly into your microphone"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Could not access microphone",
        variant: "destructive"
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type.startsWith('audio/')) {
        setRecordedBlob(file);
        toast({
          title: "File uploaded",
          description: "Audio file successfully uploaded"
        });
      } else {
        toast({
          title: "Invalid file",
          description: "Please upload an audio file",
          variant: "destructive"
        });
      }
    }
  };

  const handleSaveVoice = () => {
    if (!newVoiceName || !recordedBlob) return;

    const newVoice: Voice = {
      id: `cloned-${Date.now()}`,
      name: newVoiceName,
      type: "cloned",
      preview: URL.createObjectURL(recordedBlob),
    };

    setUserVoices((prev) => [...prev, newVoice]);
    setShowCloneDialog(false);
    setNewVoiceName("");
    setRecordedBlob(null);

    toast({
      title: "Voice cloned successfully",
      description: `${newVoiceName} has been added to your voices`,
    });
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-lg font-semibold">Voice Selection</h2>
        <Dialog open={showCloneDialog} onOpenChange={setShowCloneDialog}>
          <Button 
            variant="outline" 
            className="gap-2"
            onClick={() => {
              if (!hasSubscription) {
                navigate('/pricing');
              } else {
                setShowCloneDialog(true);
              }
            }}
          >
            🎙️ Clone Voice
          </Button>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Clone Your Voice</DialogTitle>
              <DialogDescription>
                Record your voice or upload an existing recording
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                placeholder="Voice name"
                value={newVoiceName}
                onChange={(e) => setNewVoiceName(e.target.value)}
                className="w-full"
              />

              <Tabs defaultValue="record" onValueChange={(value) => setCloneMethod(value as "record" | "upload")}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="record">Record Voice</TabsTrigger>
                  <TabsTrigger value="upload">Upload Voice</TabsTrigger>
                </TabsList>

                <TabsContent value="record" className="space-y-4">
                  <div className="flex justify-center">
                    {!isRecording ? (
                      <Button 
                        onClick={startRecording} 
                        className="gap-2 bg-gradient-to-r from-yellow-200 via-pink-200 to-sky-200 hover:from-yellow-300 hover:via-pink-300 hover:to-sky-300 text-gray-700 shadow-lg transition-all duration-300 transform hover:scale-105 font-medium rounded-full px-6"
                      >
                        🎤 Start Recording
                      </Button>
                    ) : (
                      <Button onClick={stopRecording} variant="destructive" className="gap-2">
                        ⏹️ Stop Recording
                      </Button>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="upload" className="space-y-4">
                  <div className="flex flex-col gap-2">
                    <Input
                      type="file"
                      accept="audio/*"
                      onChange={handleFileUpload}
                      className="w-full"
                    />
                    <p className="text-sm text-muted-foreground text-center">
                      Supported formats: MP3, WAV, M4A
                    </p>
                  </div>
                </TabsContent>
              </Tabs>

              {recordedBlob && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Preview:</p>
                  <audio controls className="w-full">
                    <source src={URL.createObjectURL(recordedBlob)} type={recordedBlob.type || 'audio/wav'} />
                  </audio>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={() => {
                setShowCloneDialog(false);
                setRecordedBlob(null);
                setNewVoiceName("");
              }}>
                Cancel
              </Button>
              <Button onClick={handleSaveVoice} disabled={!recordedBlob || !newVoiceName}>
                Save Voice
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="default" className="flex-1">
        <TabsList className="w-full">
          <TabsTrigger value="default" className="flex-1">Default</TabsTrigger>
          <TabsTrigger value="cloned" className="flex-1">My Voices</TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1 p-4">
          <TabsContent value="default" className="m-0">
            <div className="space-y-2">
              {defaultVoices.map((voice) => (
                <VoiceCard
                  key={voice.id}
                  voice={voice}
                  isSelected={selectedVoice?.id === voice.id}
                  onSelect={() => onSelectVoice(voice)}
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="cloned" className="m-0">
            <div className="space-y-2">
              {userVoices.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  No cloned voices yet. Click "Clone Voice" to add one!
                </div>
              ) : (
                userVoices.map((voice) => (
                  <VoiceCard
                    key={voice.id}
                    voice={voice}
                    isSelected={selectedVoice?.id === voice.id}
                    onSelect={() => onSelectVoice(voice)}
                  />
                ))
              )}
            </div>
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );
};

const VoiceCard = ({
  voice,
  isSelected,
  onSelect,
  onPreview
}: {
  voice: Voice;
  isSelected: boolean;
  onSelect: () => void;
  onPreview?: () => void;
}) => {
  return (
    <Card
      className={`transition-all duration-200 hover:bg-accent/5 ${
        isSelected ? 'bg-primary/5 border-primary' : ''
      }`}
    >
      <CardContent className="p-4 flex items-center justify-between">
        <div className="flex-1">
          <div className="font-medium">{voice.name}</div>
          <Badge variant={voice.type === 'default' ? 'secondary' : 'default'} className="mt-1">
            {voice.type === 'default' ? 'Default' : 'Cloned'}
          </Badge>
        </div>
        <div className="flex gap-2">
          {onPreview && (
            <Button variant="ghost" size="icon" onClick={onPreview}>
              🔊
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onSelect}>
            {isSelected ? 'Selected' : 'Select'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};