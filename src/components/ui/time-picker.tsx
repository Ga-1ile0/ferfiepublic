'use client';

import type React from 'react';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronUp, ChevronDown, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TimePickerProps {
  value?: Date;
  onChange: (date: Date) => void;
  className?: string;
}

export function TimePicker({ value, onChange, className }: TimePickerProps) {
  const [hours, setHours] = useState(value ? value.getHours() : 23);
  const [minutes, setMinutes] = useState(value ? value.getMinutes() : 59);
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (value) {
      setHours(value.getHours());
      setMinutes(value.getMinutes());
    }
  }, [value]);

  const updateTime = (newHours: number, newMinutes: number) => {
    const newDate = value ? new Date(value) : new Date();
    newDate.setHours(newHours, newMinutes, 0, 0);
    onChange(newDate);
  };

  const adjustHours = (increment: boolean) => {
    const newHours = increment ? (hours + 1) % 24 : hours === 0 ? 23 : hours - 1;
    setHours(newHours);
    updateTime(newHours, minutes);
  };

  const adjustMinutes = (increment: boolean) => {
    const newMinutes = increment ? (minutes + 15) % 60 : minutes < 15 ? 45 : minutes - 15;
    setMinutes(newMinutes);
    updateTime(hours, newMinutes);
  };

  const toggleAmPm = () => {
    const newHours = hours < 12 ? hours + 12 : hours - 12;
    setHours(newHours);
    updateTime(newHours, minutes);
  };

  const startEditing = () => {
    const displayHour = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    const ampm = hours < 12 ? 'AM' : 'PM';
    setInputValue(`${displayHour}:${formatMinute(minutes)} ${ampm}`);
    setIsEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const finishEditing = () => {
    // Parse input like "3:30 PM" or "15:30" or "3:30"
    const input = inputValue.trim().toUpperCase();

    // Try 12-hour format first (3:30 PM)
    const twelveHourMatch = input.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (twelveHourMatch) {
      let hour = Number.parseInt(twelveHourMatch[1]);
      const minute = Number.parseInt(twelveHourMatch[2]);
      const ampm = twelveHourMatch[3].toUpperCase();

      if (hour >= 1 && hour <= 12 && minute >= 0 && minute <= 59) {
        if (ampm === 'PM' && hour !== 12) hour += 12;
        if (ampm === 'AM' && hour === 12) hour = 0;

        setHours(hour);
        setMinutes(minute);
        updateTime(hour, minute);
      }
    } else {
      // Try 24-hour format (15:30) or assume AM/PM based on current time
      const simpleMatch = input.match(/^(\d{1,2}):(\d{2})$/);
      if (simpleMatch) {
        let hour = Number.parseInt(simpleMatch[1]);
        const minute = Number.parseInt(simpleMatch[2]);

        if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
          setHours(hour);
          setMinutes(minute);
          updateTime(hour, minute);
        } else if (hour >= 1 && hour <= 12 && minute >= 0 && minute <= 59) {
          // Assume same AM/PM as current time for 1-12 range
          const currentAmPm = hours < 12 ? 'AM' : 'PM';
          if (currentAmPm === 'PM' && hour !== 12) hour += 12;
          if (currentAmPm === 'AM' && hour === 12) hour = 0;

          setHours(hour);
          setMinutes(minute);
          updateTime(hour, minute);
        }
      }
    }

    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      finishEditing();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
    }
  };

  const formatHour = (hour: number) => {
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return displayHour.toString();
  };

  const formatMinute = (minute: number) => minute.toString().padStart(2, '0');

  const getAmPm = (hour: number) => (hour < 12 ? 'AM' : 'PM');

  if (isEditing) {
    return (
      <div className={cn('flex items-center space-x-2', className)}>
        <Clock className="h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onBlur={finishEditing}
          onKeyDown={handleKeyDown}
          placeholder="3:30 PM"
          className="w-24 text-center text-sm"
        />
        <div className="text-xs text-muted-foreground">Press Enter</div>
      </div>
    );
  }

  return (
    <div className={cn('flex items-center space-x-3', className)}>
      <Clock className="h-4 w-4 text-muted-foreground" />

      {/* Hours */}
      <div className="flex flex-col items-center">
        <Button variant="ghost" size="sm" className="h-6 w-8 p-0" onClick={() => adjustHours(true)}>
          <ChevronUp className="h-3 w-3" />
        </Button>
        <button
          onClick={startEditing}
          className="bg-muted hover:bg-muted/80 rounded px-2 py-1 text-sm font-mono min-w-[2rem] text-center transition-colors cursor-pointer"
        >
          {formatHour(hours)}
        </button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-8 p-0"
          onClick={() => adjustHours(false)}
        >
          <ChevronDown className="h-3 w-3" />
        </Button>
      </div>

      <div className="text-lg font-bold text-muted-foreground">:</div>

      {/* Minutes */}
      <div className="flex flex-col items-center">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-8 p-0"
          onClick={() => adjustMinutes(true)}
        >
          <ChevronUp className="h-3 w-3" />
        </Button>
        <button
          onClick={startEditing}
          className="bg-muted hover:bg-muted/80 rounded px-2 py-1 text-sm font-mono min-w-[2rem] text-center transition-colors cursor-pointer"
        >
          {formatMinute(minutes)}
        </button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-8 p-0"
          onClick={() => adjustMinutes(false)}
        >
          <ChevronDown className="h-3 w-3" />
        </Button>
      </div>

      {/* AM/PM Toggle */}
      <Button
        variant="outline"
        size="sm"
        className="h-8 w-12 text-xs font-medium"
        onClick={toggleAmPm}
      >
        {getAmPm(hours)}
      </Button>
    </div>
  );
}
