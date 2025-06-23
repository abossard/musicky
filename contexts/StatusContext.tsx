import React, { createContext, useContext, useState, ReactNode } from 'react';

interface StatusContextType {
  status: string;
  statusColor: string;
  setStatus: (status: string, color?: string) => void;
  isMenuOpen: boolean;
  setIsMenuOpen: (isOpen: boolean) => void;
}

const StatusContext = createContext<StatusContextType | undefined>(undefined);

export function StatusProvider({ children }: { children: ReactNode }) {
  const [status, setStatusState] = useState("Ready");
  const [statusColor, setStatusColor] = useState("green");
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const setStatus = (newStatus: string, color: string = "green") => {
    setStatusState(newStatus);
    setStatusColor(color);
  };

  return (
    <StatusContext.Provider value={{ 
      status, 
      statusColor, 
      setStatus, 
      isMenuOpen, 
      setIsMenuOpen 
    }}>
      {children}
    </StatusContext.Provider>
  );
}

export function useStatus() {
  const context = useContext(StatusContext);
  if (context === undefined) {
    throw new Error('useStatus must be used within a StatusProvider');
  }
  return context;
}
