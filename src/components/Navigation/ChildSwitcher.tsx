import React from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAppContext } from '@/contexts/Auth0Context';
import { User } from 'lucide-react';

export const ChildSwitcher = () => {
  const { childrenProfiles, selectedChild, setSelectedChild } = useAppContext();

  if (!childrenProfiles || childrenProfiles.length === 0) {
    return null;
  }

  if (childrenProfiles.length === 1) {
    const child = childrenProfiles[0];
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 rounded-lg">
        <span className="text-lg">{child.avatar || '👤'}</span>
        <span className="font-fredoka text-sm">{child.name}</span>
      </div>
    );
  }

  return (
    <Select 
      value={selectedChild?.id || ''} 
      onValueChange={(childId) => {
        const child = childrenProfiles.find(c => c.id === childId);
        if (child) setSelectedChild(child);
      }}
    >
      <SelectTrigger className="w-auto min-w-[120px] h-10 bg-primary/10 border-primary/20">
        <div className="flex items-center gap-2">
          <span className="text-lg">{selectedChild?.avatar || '👤'}</span>
          <SelectValue placeholder="Select child">
            {selectedChild ? (
              <span className="font-fredoka text-sm">{selectedChild.name}</span>
            ) : (
              <span className="font-fredoka text-sm">Select child</span>
            )}
          </SelectValue>
        </div>
      </SelectTrigger>
      <SelectContent>
        {childrenProfiles.map(child => (
          <SelectItem key={child.id} value={child.id}>
            <div className="flex items-center gap-2">
              <span className="text-lg">{child.avatar || '👤'}</span>
              <span className="font-fredoka">{child.name}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};