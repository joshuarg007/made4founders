import { useState, useRef, useEffect } from 'react';
import {
  MessageSquare,
  X,
  Minimize2,
  Maximize2,
  Send,
  Sparkles,
  Plus,
  Loader2,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertCircle,
} from 'lucide-react';
import { useAssistant } from '../../context/AssistantContext';
import { AIDataCard, AISuggestedAction } from '../../lib/api';
import { useNavigate } from 'react-router-dom';

export default function AssistantWidget() {
  const navigate = useNavigate();
  const {
    isOpen,
    isMinimized,
    isLoading,
    messages,
    suggestions,
    error,
    openAssistant,
    closeAssistant,
    toggleMinimize,
    sendMessage,
    startNewConversation,
    clearError,
  } = useAssistant();

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when opening
  useEffect(() => {
    if (isOpen && !isMinimized) {
      inputRef.current?.focus();
    }
  }, [isOpen, isMinimized]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const message = input;
    setInput('');
    await sendMessage(message);
  };

  const handleSuggestionClick = async (suggestion: string) => {
    setInput('');
    await sendMessage(suggestion);
  };

  const handleActionClick = (action: AISuggestedAction) => {
    if (action.action === 'navigate') {
      navigate(action.target);
      closeAssistant();
    } else if (action.action === 'query') {
      sendMessage(action.target);
    }
  };

  const renderDataCard = (card: AIDataCard, index: number) => {
    const getTrendIcon = () => {
      if (card.trend === 'up') return <TrendingUp className="w-4 h-4 text-green-400" />;
      if (card.trend === 'down') return <TrendingDown className="w-4 h-4 text-red-400" />;
      return <Minus className="w-4 h-4 text-gray-400" />;
    };

    return (
      <div
        key={index}
        className="bg-white/5 rounded-lg p-3 border border-white/10"
      >
        <div className="text-xs text-gray-400 mb-1">{card.title}</div>
        <div className="flex items-center justify-between">
          <span className="text-lg font-semibold text-white">{card.value}</span>
          {card.trend && getTrendIcon()}
        </div>
      </div>
    );
  };

  // Floating button when closed
  if (!isOpen) {
    return (
      <button
        onClick={openAssistant}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full shadow-lg hover:shadow-cyan-500/25 transition-all hover:scale-105 flex items-center justify-center group"
        title="AI Assistant (Cmd/Ctrl + K)"
      >
        <Sparkles className="w-6 h-6 text-white" />
        <span className="absolute -top-8 right-0 bg-black/80 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap">
          Cmd/Ctrl + K
        </span>
      </button>
    );
  }

  // Minimized state
  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50 bg-[#1a1d24] rounded-xl shadow-2xl border border-white/10 w-72">
        <div className="flex items-center justify-between p-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-cyan-400" />
            <span className="text-sm font-medium text-white">AI Assistant</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={toggleMinimize}
              className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            <button
              onClick={closeAssistant}
              className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Full chat widget
  return (
    <div className="fixed bottom-6 right-6 z-50 bg-[#1a1d24] rounded-xl shadow-2xl border border-white/10 w-96 max-h-[600px] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">AI Assistant</h3>
            <p className="text-xs text-gray-400">Ask me anything about your business</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={startNewConversation}
            className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition"
            title="New conversation"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={toggleMinimize}
            className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition"
          >
            <Minimize2 className="w-4 h-4" />
          </button>
          <button
            onClick={closeAssistant}
            className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[300px] max-h-[400px]">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 text-sm mb-4">
              Hi! I can help you understand your business data.
            </p>
            {suggestions.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Try asking:</p>
                {suggestions.slice(0, 4).map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="block w-full text-left px-3 py-2 rounded-lg bg-white/5 text-sm text-gray-300 hover:bg-white/10 hover:text-white transition"
                  >
                    "{suggestion}"
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-xl px-4 py-2.5 ${
                  message.role === 'user'
                    ? 'bg-cyan-600 text-white'
                    : 'bg-white/10 text-gray-100'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>

                {/* Data Cards */}
                {message.data_cards && message.data_cards.length > 0 && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {message.data_cards.map((card, i) => renderDataCard(card, i))}
                  </div>
                )}

                {/* Suggested Actions */}
                {message.suggested_actions && message.suggested_actions.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {message.suggested_actions.map((action, i) => (
                      <button
                        key={i}
                        onClick={() => handleActionClick(action)}
                        className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition"
                      >
                        <ChevronRight className="w-3 h-3" />
                        {action.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white/10 rounded-xl px-4 py-3">
              <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <p className="text-sm text-red-300">{error}</p>
            <button
              onClick={clearError}
              className="ml-auto text-red-400 hover:text-red-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-white/10">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your business..."
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition flex items-center justify-center"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 text-white animate-spin" />
            ) : (
              <Send className="w-4 h-4 text-white" />
            )}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2 text-center">
          Powered by Ollama
        </p>
      </form>
    </div>
  );
}
