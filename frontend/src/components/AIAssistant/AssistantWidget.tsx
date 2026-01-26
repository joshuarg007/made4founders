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
  Expand,
  ExternalLink,
  ArrowLeft,
} from 'lucide-react';
import { useAssistant } from '../../context/AssistantContext';
import type { AIDataCard, AISuggestedAction } from '../../lib/api';
import { useNavigate } from 'react-router-dom';

type ViewMode = 'widget' | 'expanded' | 'fullscreen';

// Simple markdown parser for our specific format
function parseMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let inTable = false;
  let tableHeaders: string[] = [];
  let tableRows: string[][] = [];
  let listItems: string[] = [];
  let inList = false;

  const flushTable = () => {
    if (tableHeaders.length > 0 || tableRows.length > 0) {
      elements.push(
        <div key={`table-${elements.length}`} className="my-3 overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            {tableHeaders.length > 0 && (
              <thead>
                <tr className="border-b border-white/20">
                  {tableHeaders.map((h, i) => (
                    <th key={i} className="text-left py-2 px-3 font-semibold text-cyan-300 bg-white/5">
                      {formatInlineMarkdown(h.trim())}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {tableRows.map((row, ri) => (
                <tr key={ri} className="border-b border-white/10 hover:bg-white/5">
                  {row.map((cell, ci) => (
                    <td key={ci} className="py-2 px-3 text-gray-200">
                      {formatInlineMarkdown(cell.trim())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableHeaders = [];
      tableRows = [];
    }
    inTable = false;
  };

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${elements.length}`} className="my-2 space-y-1 ml-1">
          {listItems.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-gray-200">
              <span className="text-cyan-400 mt-0.5">•</span>
              <span>{formatInlineMarkdown(item)}</span>
            </li>
          ))}
        </ul>
      );
      listItems = [];
    }
    inList = false;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Table row detection
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      if (inList) flushList();

      const cells = line.split('|').slice(1, -1);

      // Check if this is a separator row (|---|---|)
      if (cells.every(c => /^[\s:-]+$/.test(c))) {
        continue; // Skip separator
      }

      if (!inTable) {
        inTable = true;
        tableHeaders = cells;
      } else {
        tableRows.push(cells);
      }
      continue;
    } else if (inTable) {
      flushTable();
    }

    // List item detection
    if (/^[\s]*[•\-\*]\s+/.test(line)) {
      if (inTable) flushTable();
      inList = true;
      const content = line.replace(/^[\s]*[•\-\*]\s+/, '');
      listItems.push(content);
      continue;
    } else if (/^[\s]*\d+\.\s+/.test(line)) {
      if (inTable) flushTable();
      inList = true;
      const content = line.replace(/^[\s]*\d+\.\s+/, '');
      listItems.push(content);
      continue;
    } else if (inList && line.trim() === '') {
      flushList();
      continue;
    } else if (inList) {
      flushList();
    }

    // Empty line
    if (line.trim() === '') {
      elements.push(<div key={`space-${i}`} className="h-2" />);
      continue;
    }

    // Headers
    if (line.startsWith('**') && line.endsWith('**') && !line.slice(2, -2).includes('**')) {
      elements.push(
        <h3 key={`h-${i}`} className="text-base font-bold text-white mt-3 mb-2">
          {line.slice(2, -2)}
        </h3>
      );
      continue;
    }

    // Regular paragraph
    elements.push(
      <p key={`p-${i}`} className="text-sm text-gray-200 leading-relaxed">
        {formatInlineMarkdown(line)}
      </p>
    );
  }

  // Flush any remaining content
  if (inTable) flushTable();
  if (inList) flushList();

  return elements;
}

// Format inline markdown (bold, italic, code, links)
function formatInlineMarkdown(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let keyIndex = 0;

  while (remaining.length > 0) {
    // Bold: **text**
    const boldMatch = remaining.match(/\*\*([^*]+)\*\*/);
    // Italic: *text* or _text_
    const italicMatch = remaining.match(/(?<!\*)\*([^*]+)\*(?!\*)|_([^_]+)_/);
    // Code: `text`
    const codeMatch = remaining.match(/`([^`]+)`/);
    // Strikethrough: ~~text~~
    const strikeMatch = remaining.match(/~~([^~]+)~~/);

    // Find the earliest match
    const matches = [
      boldMatch ? { match: boldMatch, type: 'bold' } : null,
      italicMatch ? { match: italicMatch, type: 'italic' } : null,
      codeMatch ? { match: codeMatch, type: 'code' } : null,
      strikeMatch ? { match: strikeMatch, type: 'strike' } : null,
    ].filter(Boolean).sort((a, b) => (a!.match.index || 0) - (b!.match.index || 0));

    const firstMatch = matches[0];
    if (!firstMatch || firstMatch.match.index === undefined) {
      parts.push(remaining);
      break;
    }

    const matchIndex = firstMatch.match.index;

    // Add text before match
    if (matchIndex > 0) {
      parts.push(remaining.slice(0, matchIndex));
    }

    // Add formatted content
    const content = firstMatch.match[1] || firstMatch.match[2];
    if (firstMatch.type === 'bold') {
      parts.push(<strong key={keyIndex++} className="font-semibold text-white">{content}</strong>);
    } else if (firstMatch.type === 'italic') {
      parts.push(<em key={keyIndex++} className="italic">{content}</em>);
    } else if (firstMatch.type === 'code') {
      parts.push(<code key={keyIndex++} className="px-1.5 py-0.5 bg-white/10 rounded text-cyan-300 text-xs font-mono">{content}</code>);
    } else if (firstMatch.type === 'strike') {
      parts.push(<del key={keyIndex++} className="text-gray-500">{content}</del>);
    }

    remaining = remaining.slice(matchIndex + firstMatch.match[0].length);
  }

  return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : <>{parts}</>;
}

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
  const [viewMode, setViewMode] = useState<ViewMode>('widget');
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

  // Reset view mode when closing
  useEffect(() => {
    if (!isOpen) {
      setViewMode('widget');
    }
  }, [isOpen]);

  // Handle escape key for fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && viewMode === 'fullscreen') {
        setViewMode('widget');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode]);

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
      if (card.trend === 'up') return <TrendingUp className="w-4 h-4 text-emerald-400" />;
      if (card.trend === 'down') return <TrendingDown className="w-4 h-4 text-red-400" />;
      return <Minus className="w-4 h-4 text-gray-400" />;
    };

    const getTrendBg = () => {
      if (card.trend === 'up') return 'border-emerald-500/30 bg-emerald-500/5';
      if (card.trend === 'down') return 'border-red-500/30 bg-red-500/5';
      return 'border-white/10 bg-white/5';
    };

    return (
      <div
        key={index}
        className={`rounded-lg p-3 border ${getTrendBg()} transition-all hover:scale-[1.02]`}
      >
        <div className="text-xs text-gray-400 mb-1 uppercase tracking-wide">{card.title}</div>
        <div className="flex items-center justify-between">
          <span className="text-lg font-bold text-white">{card.value}</span>
          {card.trend && getTrendIcon()}
        </div>
      </div>
    );
  };

  const renderMessage = (message: { id: number; role: string; content: string; data_cards?: AIDataCard[]; suggested_actions?: AISuggestedAction[] }) => {
    const isUser = message.role === 'user';

    return (
      <div
        key={message.id}
        className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
      >
        <div
          className={`max-w-[90%] rounded-2xl ${
            isUser
              ? 'bg-gradient-to-br from-cyan-600 to-blue-600 text-white px-4 py-3'
              : 'bg-[#252830] text-gray-100 px-5 py-4 border border-white/10'
          }`}
        >
          {isUser ? (
            <p className="text-sm">{message.content}</p>
          ) : (
            <div className="prose-sm">
              {parseMarkdown(message.content)}
            </div>
          )}

          {/* Data Cards */}
          {message.data_cards && message.data_cards.length > 0 && (
            <div className={`mt-4 grid gap-2 ${message.data_cards.length > 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {message.data_cards.map((card, i) => renderDataCard(card, i))}
            </div>
          )}

          {/* Suggested Actions */}
          {message.suggested_actions && message.suggested_actions.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {message.suggested_actions.map((action, i) => (
                <button
                  key={i}
                  onClick={() => handleActionClick(action)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 rounded-full transition border border-cyan-500/30"
                >
                  <ChevronRight className="w-3 h-3" />
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Floating button when closed
  if (!isOpen) {
    return (
      <button
        onClick={openAssistant}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40 transition-all hover:scale-110 flex items-center justify-center group"
        title="AI Assistant (Cmd/Ctrl + K)"
      >
        <Sparkles className="w-6 h-6 text-white" />
        <span className="absolute -top-10 right-0 bg-black/90 text-white text-xs px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition whitespace-nowrap shadow-xl">
          AI Assistant <kbd className="ml-1 px-1.5 py-0.5 bg-white/20 rounded text-[10px]">⌘K</kbd>
        </span>
      </button>
    );
  }

  // Minimized state
  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50 bg-[#1a1d24] rounded-2xl shadow-2xl border border-white/10 w-72">
        <div className="flex items-center justify-between p-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-medium text-white">AI Assistant</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={toggleMinimize}
              className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            <button
              onClick={closeAssistant}
              className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Get container classes based on view mode
  const getContainerClasses = () => {
    switch (viewMode) {
      case 'fullscreen':
        return 'fixed inset-4 z-50 bg-[#13151a] rounded-2xl shadow-2xl border border-white/10 flex flex-col';
      case 'expanded':
        return 'fixed bottom-6 right-6 z-50 bg-[#13151a] rounded-2xl shadow-2xl border border-white/10 w-[600px] max-h-[80vh] flex flex-col';
      default:
        return 'fixed bottom-6 right-6 z-50 bg-[#13151a] rounded-2xl shadow-2xl border border-white/10 w-[420px] max-h-[600px] flex flex-col';
    }
  };

  const getMessagesHeight = () => {
    switch (viewMode) {
      case 'fullscreen':
        return 'flex-1 min-h-0';
      case 'expanded':
        return 'min-h-[400px] max-h-[60vh]';
      default:
        return 'min-h-[300px] max-h-[400px]';
    }
  };

  // Full chat widget
  return (
    <>
      {/* Backdrop for fullscreen */}
      {viewMode === 'fullscreen' && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setViewMode('widget')}
        />
      )}

      <div className={getContainerClasses()}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-[#1a1d24] rounded-t-2xl">
          <div className="flex items-center gap-3">
            {viewMode === 'fullscreen' && (
              <button
                onClick={() => setViewMode('widget')}
                className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition mr-1"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">AI Assistant</h3>
              <p className="text-xs text-gray-400">Ask me anything about your business</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={startNewConversation}
              className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition"
              title="New conversation"
            >
              <Plus className="w-4 h-4" />
            </button>
            {viewMode !== 'fullscreen' && (
              <>
                <button
                  onClick={() => setViewMode(viewMode === 'expanded' ? 'widget' : 'expanded')}
                  className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition"
                  title={viewMode === 'expanded' ? 'Shrink' : 'Expand'}
                >
                  <Expand className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('fullscreen')}
                  className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition"
                  title="Pop out"
                >
                  <ExternalLink className="w-4 h-4" />
                </button>
                <button
                  onClick={toggleMinimize}
                  className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition"
                >
                  <Minimize2 className="w-4 h-4" />
                </button>
              </>
            )}
            <button
              onClick={closeAssistant}
              className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className={`${getMessagesHeight()} overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent`}>
          {messages.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-gradient-to-br from-cyan-500/20 to-blue-600/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="w-8 h-8 text-cyan-400" />
              </div>
              <h4 className="text-lg font-semibold text-white mb-2">How can I help?</h4>
              <p className="text-gray-400 text-sm mb-6 max-w-xs mx-auto">
                I can analyze your business data and provide insights on revenue, runway, expenses, and more.
              </p>
              {suggestions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Suggested questions</p>
                  <div className="flex flex-wrap justify-center gap-2 mt-3">
                    {suggestions.slice(0, 4).map((suggestion, i) => (
                      <button
                        key={i}
                        onClick={() => handleSuggestionClick(suggestion)}
                        className="px-4 py-2 rounded-full bg-white/5 text-sm text-gray-300 hover:bg-cyan-500/20 hover:text-cyan-300 transition border border-white/10 hover:border-cyan-500/30"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            messages.map(renderMessage)
          )}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-[#252830] rounded-2xl px-5 py-4 border border-white/10">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-sm text-gray-400">Thinking...</span>
                </div>
              </div>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-300 flex-1">{error}</p>
              <button
                onClick={clearError}
                className="text-red-400 hover:text-red-300 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="p-4 border-t border-white/10 bg-[#1a1d24] rounded-b-2xl">
          <div className="flex gap-3">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your business..."
              className="flex-1 bg-[#252830] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 transition"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="px-5 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed rounded-xl transition flex items-center justify-center shadow-lg shadow-cyan-500/20 disabled:shadow-none"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 text-white animate-spin" />
              ) : (
                <Send className="w-5 h-5 text-white" />
              )}
            </button>
          </div>
          <div className="flex items-center justify-center gap-2 mt-3">
            <span className="text-[10px] text-gray-500">Press</span>
            <kbd className="px-1.5 py-0.5 text-[10px] bg-white/5 border border-white/10 rounded text-gray-400">Enter</kbd>
            <span className="text-[10px] text-gray-500">to send</span>
            <span className="text-gray-600 mx-1">•</span>
            <kbd className="px-1.5 py-0.5 text-[10px] bg-white/5 border border-white/10 rounded text-gray-400">Esc</kbd>
            <span className="text-[10px] text-gray-500">to close</span>
          </div>
        </form>
      </div>
    </>
  );
}
