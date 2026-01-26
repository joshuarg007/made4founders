import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import {
  sendAIMessage,
  getAISuggestions,
  getAIConversations,
  AIConversationListItem,
  AIChatResponse,
  AIDataCard,
  AISuggestedAction,
} from '../lib/api';

interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  data_cards?: AIDataCard[];
  suggested_actions?: AISuggestedAction[];
  timestamp: Date;
}

interface AssistantContextType {
  isOpen: boolean;
  isMinimized: boolean;
  isLoading: boolean;
  messages: Message[];
  conversationId: number | null;
  conversations: AIConversationListItem[];
  suggestions: string[];
  error: string | null;

  // Actions
  openAssistant: () => void;
  closeAssistant: () => void;
  toggleMinimize: () => void;
  sendMessage: (message: string) => Promise<void>;
  startNewConversation: () => void;
  loadConversation: (id: number) => void;
  refreshSuggestions: () => void;
  clearError: () => void;
}

const AssistantContext = createContext<AssistantContextType | null>(null);

export function AssistantProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [conversations, setConversations] = useState<AIConversationListItem[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Load suggestions when page changes
  useEffect(() => {
    if (isOpen) {
      refreshSuggestions();
    }
  }, [location.pathname, isOpen]);

  // Keyboard shortcut: Cmd/Ctrl + K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
        if (!isOpen) {
          setIsMinimized(false);
        }
      }
      // Escape to close
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const refreshSuggestions = useCallback(async () => {
    try {
      const response = await getAISuggestions(location.pathname);
      setSuggestions(response.suggestions);
    } catch (err) {
      console.error('Failed to load suggestions:', err);
    }
  }, [location.pathname]);

  const loadConversations = useCallback(async () => {
    try {
      const data = await getAIConversations();
      setConversations(data);
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  }, []);

  const openAssistant = useCallback(() => {
    setIsOpen(true);
    setIsMinimized(false);
    refreshSuggestions();
    loadConversations();
  }, [refreshSuggestions, loadConversations]);

  const closeAssistant = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggleMinimize = useCallback(() => {
    setIsMinimized(prev => !prev);
  }, []);

  const sendMessage = useCallback(async (message: string) => {
    if (!message.trim()) return;

    setIsLoading(true);
    setError(null);

    // Add user message immediately
    const userMessage: Message = {
      id: Date.now(),
      role: 'user',
      content: message,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);

    try {
      const response: AIChatResponse = await sendAIMessage({
        message,
        conversation_id: conversationId || undefined,
        context: { current_page: location.pathname },
      });

      // Update conversation ID if new
      if (!conversationId) {
        setConversationId(response.conversation_id);
      }

      // Add assistant response
      const assistantMessage: Message = {
        id: response.message_id,
        role: 'assistant',
        content: response.response,
        data_cards: response.data_cards,
        suggested_actions: response.suggested_actions,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);

    } catch (err: unknown) {
      console.error('Failed to send message:', err);
      setError(err instanceof Error ? err.message : 'Failed to send message. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, location.pathname]);

  const startNewConversation = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setError(null);
    refreshSuggestions();
  }, [refreshSuggestions]);

  const loadConversation = useCallback(async (id: number) => {
    // This would load a full conversation - simplified for now
    setConversationId(id);
    // TODO: Fetch full conversation messages
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return (
    <AssistantContext.Provider
      value={{
        isOpen,
        isMinimized,
        isLoading,
        messages,
        conversationId,
        conversations,
        suggestions,
        error,
        openAssistant,
        closeAssistant,
        toggleMinimize,
        sendMessage,
        startNewConversation,
        loadConversation,
        refreshSuggestions,
        clearError,
      }}
    >
      {children}
    </AssistantContext.Provider>
  );
}

export function useAssistant() {
  const context = useContext(AssistantContext);
  if (!context) {
    throw new Error('useAssistant must be used within an AssistantProvider');
  }
  return context;
}
