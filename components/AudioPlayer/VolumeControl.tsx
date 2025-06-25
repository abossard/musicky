import React, { useState } from 'react';
import { Group, ActionIcon, Slider, Popover } from '@mantine/core';
import { IconVolume, IconVolume2, IconVolume3, IconVolumeOff } from '@tabler/icons-react';

export interface VolumeControlProps {
  volume: number;
  onChange: (volume: number) => void;
}

export function VolumeControl({ volume, onChange }: VolumeControlProps) {
  const [isOpen, setIsOpen] = useState(false);

  const volumeIcons = [
    { threshold: 0, icon: <IconVolumeOff size={16} /> },
    { threshold: 0.33, icon: <IconVolume size={16} /> },
    { threshold: 0.66, icon: <IconVolume2 size={16} /> },
    { threshold: 1, icon: <IconVolume3 size={16} /> }
  ];

  const getVolumeIcon = () => {
    return volumeIcons.find(({ threshold }) => volume <= threshold || threshold === 1)?.icon || volumeIcons[0].icon;
  };

  const toggleMute = () => {
    onChange(volume === 0 ? 1 : 0);
  };

  return (
    <Group gap="xs">
      <ActionIcon
        variant="subtle"
        onClick={toggleMute}
        aria-label={volume === 0 ? 'Unmute' : 'Mute'}
      >
        {getVolumeIcon()}
      </ActionIcon>

      <Popover 
        opened={isOpen} 
        onChange={setIsOpen}
        position="top"
        width={120}
        trapFocus
        shadow="md"
      >
        <Popover.Target>
          <ActionIcon
            variant="subtle"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Volume control"
          >
            {getVolumeIcon()}
          </ActionIcon>
        </Popover.Target>
        
        <Popover.Dropdown>
          <Slider
            value={volume * 100}
            onChange={(value) => onChange(value / 100)}
            min={0}
            max={100}
            step={1}
            size="sm"
            color="violet"
            style={{ width: 100 }}
            aria-label="Volume"
          />
        </Popover.Dropdown>
      </Popover>
    </Group>
  );
}
