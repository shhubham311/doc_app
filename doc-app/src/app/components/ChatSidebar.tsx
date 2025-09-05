'use client';

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Send, Search, Edit3, FileText, Zap } from 'lucide-react';

type AIMessage = {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  hasEditorAction?: boolean;
  editorActionType?: 'insert' | 'replace' | 'append';
  editorContent?: string;
};

type SearchResult = {
  title: string;
  url: string;
  snippet: string;
};

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export default function ChatSidebar() {
  const { token, user } = useAuth();
  const [messages, setMessages] = useState<AIMessage[]>([
    {
      id: 'welcome',
      content: `Hi ${user?.name || 'there'}! I'm your AI assistant. I can help you with:\n\n• Writing and editing content\n• Searching the web for information\n• Grammar and style improvements\n• Directly modifying your editor content\n\nTry commands like:\n- 'Write a paragraph about renewable energy and insert it'\n- 'Search for latest React updates and add summary'\n- 'Fix grammar in the selected text'\n- 'Make the content more professional'`,
      role: 'assistant'
    }
  ]);
  const [input, setInput] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(() => `session_${Date.now()}`);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking');

  const checkBackendConnection = React.useCallback(async () => {
    if (!token) {
      setConnectionStatus('disconnected');
      return;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        setConnectionStatus('connected');
      } else {
        setConnectionStatus('disconnected');
      }
    } catch (error) {
      console.error('Backend connection check failed:', error);
      setConnectionStatus('disconnected');
    }
  }, [token, setConnectionStatus]);

  React.useEffect(() => {
    if (token) {
      checkBackendConnection();
    }
  }, [token, checkBackendConnection]);

  const handleWebSearch = async (query: string) => {
    if (connectionStatus !== 'connected' || !token) {
      throw new Error('Backend is not connected or user not authenticated');
    }

    setIsSearching(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/agent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ 
          query,
          action: 'web_search'
        }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.status === 'success' && data.result && data.result.results) {
        const results = data.result.results.map((result: any) => ({
          title: result.title,
          url: result.url,
          snippet: result.snippet
        }));
        setSearchResults(results);
        return results;
      } else {
        console.error('Unexpected search response format:', data);
        return [];
      }
    } catch (error) {
      console.error('Search failed:', error);
      throw error;
    } finally {
      setIsSearching(false);
    }
  };

  const detectIntent = (message: string) => {
    const lower = message.toLowerCase();
    
    // Direct editor modification intents
    if (lower.includes('fix grammar') || lower.includes('correct') || lower.includes('improve writing')) {
      return { type: 'editor_modify', action: 'grammar' };
    }
    
    if (lower.includes('make professional') || lower.includes('formal tone')) {
      return { type: 'editor_modify', action: 'professional' };
    }
    
    if (lower.includes('make casual') || lower.includes('friendly tone')) {
      return { type: 'editor_modify', action: 'casual' };
    }
    
    if (lower.includes('summarize') || lower.includes('make shorter')) {
      return { type: 'editor_modify', action: 'summarize' };
    }
    
    // Content creation with insertion
    if ((lower.includes('write') || lower.includes('create')) && (lower.includes('insert') || lower.includes('add'))) {
      return { type: 'create_and_insert' };
    }
    
    // Search intents
    if (lower.includes('search') || lower.includes('find') || lower.includes('look up')) {
      return { type: 'search', needsEditor: lower.includes('insert') || lower.includes('add') };
    }
    
    // Regular editor actions
    if (lower.includes('insert') || lower.includes('add to editor')) {
      return { type: 'editor_insert' };
    }
    
    return { type: 'chat' };
  };

  const insertIntoEditor = (content: string, actionType: 'insert' | 'replace' | 'append' = 'insert') => {
    if (typeof window !== 'undefined' && (window as any).editorInsertContent) {
      (window as any).editorInsertContent(content, actionType);
      return true;
    }
    return false;
  };

  const modifyEditorContent = async (action: string) => {
    // Get current editor content
    if (typeof window !== 'undefined' && (window as any).getEditorContent) {
      const currentContent = (window as any).getEditorContent();
      if (!currentContent || currentContent.trim() === '') {
        return "No content found in the editor to modify.";
      }

      // Send to AI for modification
      const prompts = {
        grammar: `Please fix any grammar, spelling, and punctuation errors in this text while keeping the original meaning: ${currentContent}`,
        professional: `Rewrite this text in a professional, formal tone: ${currentContent}`,
        casual: `Rewrite this text in a casual, friendly tone: ${currentContent}`,
        summarize: `Create a concise summary of this text: ${currentContent}`
      };

      try {
        const response = await fetch(`${BACKEND_URL}/api/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            prompt: prompts[action as keyof typeof prompts],
            session_id: sessionId
          }),
        });
        
        if (response.ok) {
          const data = await response.json();
          const improvedContent = data.response;
          
          // Replace editor content
          if ((window as any).setEditorContent) {
            (window as any).setEditorContent(improvedContent);
            return `Content has been ${action === 'grammar' ? 'corrected' : action === 'professional' ? 'made more professional' : action === 'casual' ? 'made more casual' : 'summarized'} in your editor.`;
          }
        }
      } catch (error) {
        console.error('Content modification failed:', error);
        return "Failed to modify content. Please try again.";
      }
    }
    
    return "Unable to access editor content. Please ensure the editor is ready.";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    if (connectionStatus !== 'connected' || !token) {
      alert('Please login first or check your connection.');
      return;
    }

    const userMessage: AIMessage = {
      id: Date.now().toString(),
      content: input,
      role: 'user'
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setIsLoading(true);

    try {
      const intent = detectIntent(currentInput);
      let assistantContent = '';
      let hasEditorAction = false;
      let editorActionType: 'insert' | 'replace' | 'append' = 'insert';
      let editorContent = '';

      if (intent.type === 'editor_modify') {
        assistantContent = await modifyEditorContent(intent.action || 'grammar');
        hasEditorAction = true;
        editorActionType = 'replace';
      } else if (intent.type === 'create_and_insert') {
        // Generate content and insert - with clear prompt for clean output
        const response = await fetch(`${BACKEND_URL}/api/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            prompt: `${currentInput.replace(/and insert|insert|add to editor|add it/gi, '')}. Return only the content without any explanations or introductory text.`,
            session_id: sessionId
          }),
        });
        
        if (response.ok) {
          const data = await response.json();
          const aiResponse = data.response;
          
          // Extract clean generated content
          const generatedContent = aiResponse.trim();
          editorContent = generatedContent;
          
          const inserted = insertIntoEditor(`<p>${generatedContent}</p>`, 'insert');
          if (inserted) {
            assistantContent = `I've generated and inserted the content into your editor:\n\n"${generatedContent.substring(0, 100)}${generatedContent.length > 100 ? '...' : ''}"`;
            hasEditorAction = true;
            editorActionType = 'insert';
          } else {
            assistantContent = `Generated content: ${generatedContent}\n\n⚠️ Could not insert into editor automatically.`;
          }
        } else {
          assistantContent = 'Sorry, I could not generate the requested content.';
        }
      } else if (intent.type === 'search') {
        try {
          const searchQuery = currentInput.replace(/search|find|look up|for|please|insert|add/gi, '').trim();
          const results = await handleWebSearch(searchQuery);
          
          if (results.length > 0) {
            assistantContent = `Found ${results.length} results for "${searchQuery}":\n\n${results
              .map((r: {title: string; snippet: string}) => `• ${r.title}: ${r.snippet}`)
              .join('\n\n')}`;
            
            if (intent.needsEditor) {
              const formattedContent = results
                .map((result: SearchResult) => `<h3>${result.title}</h3><p>${result.snippet}</p><p><a href="${result.url}" target="_blank">Read more</a></p>`)
                .join('<br/><br/>');
              
              const inserted = insertIntoEditor(formattedContent);
              if (inserted) {
                assistantContent += '\n\n✅ Search results have been inserted into your editor!';
                hasEditorAction = true;
                editorContent = formattedContent;
              }
            }
          } else {
            assistantContent = `No results found for "${searchQuery}". Please try a different search term.`;
          }
        } catch (error) {
          assistantContent = 'Sorry, web search is currently unavailable. Please try again later.';
        }
      } else {
        // Regular chat
        const response = await fetch(`${BACKEND_URL}/api/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            prompt: currentInput,
            session_id: sessionId
          }),
        });
        
        if (response.ok) {
          const data = await response.json();
          assistantContent = data.response || 'Sorry, I could not process your request.';
        } else {
          assistantContent = 'Sorry, I encountered an error processing your request.';
        }
      }

      const assistantMessage: AIMessage = {
        id: (Date.now() + 1).toString(),
        content: assistantContent,
        role: 'assistant',
        hasEditorAction,
        editorActionType,
        editorContent
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      
    } catch (error) {
      console.error('Chat error:', error);
      
      let errorMessage = 'Sorry, I encountered an error processing your request.';
      if (error instanceof Error) {
        if (error.message.includes('Failed to fetch')) {
          errorMessage = 'Unable to connect to the AI service. Please check if the backend is running.';
        } else if (error.message.includes('401')) {
          errorMessage = 'Authentication error. Please login again.';
        }
      }
      
      const assistantMessage: AIMessage = {
        id: (Date.now() + 1).toString(),
        content: errorMessage,
        role: 'assistant'
      };
      setMessages(prev => [...prev, assistantMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const quickActions = [
    "Fix grammar in the editor",
    "Make content more professional",
    "Search for React best practices and insert",
    "Write a paragraph about AI and add it",
    "Summarize the current content"
  ];

  if (!token || !user) {
    return (
      <div className="w-80 border-l border-gray-200 h-full flex flex-col items-center justify-center p-4">
        <div className="text-center">
          <h2 className="text-lg font-semibold mb-2 text-black">AI Assistant</h2>
          <p className="text-sm text-black mb-4">Please login to use AI features</p>
          <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center mb-2">
            <span className="text-black">AI</span>
          </div>
          <p className="text-xs text-black">Login required for chat and editor integration</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 border-l border-gray-200 h-full flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-black">AI Assistant</h2>
        <p className="text-xs text-black">Chat • Web Search • Direct Editor Integration</p>
        <div className="flex items-center mt-2">
          <div className={`w-2 h-2 rounded-full mr-2 ${
            connectionStatus === 'connected' ? 'bg-green-500' : 
            connectionStatus === 'disconnected' ? 'bg-red-500' : 
            'bg-yellow-500'
          }`}></div>
          <span className="text-xs text-black">
            {connectionStatus === 'connected' ? 'Connected' : 
             connectionStatus === 'disconnected' ? 'Disconnected' : 
             'Checking...'}
          </span>
          {connectionStatus === 'disconnected' && (
            <button 
              onClick={checkBackendConnection}
              className="ml-2 text-xs text-blue-500 hover:underline"
            >
              Retry
            </button>
          )}
        </div>
        <p className="text-xs text-black mt-1">Logged in as {user.name}</p>
      </div>
      
      {/* Quick Actions */}
      <div className="p-3 border-b border-gray-100">
        <p className="text-xs font-medium text-black mb-2">Quick Actions:</p>
        <div className="grid grid-cols-1 gap-1">
          {quickActions.map((action, index) => (
            <button
              key={index}
              onClick={() => setInput(action)}
              className="text-left text-xs p-2 rounded bg-gray-50 hover:bg-gray-100 transition-colors text-black flex items-center"
              disabled={isLoading || connectionStatus !== 'connected'}
            >
              {action.includes('Fix grammar') && <Edit3 className="w-3 h-3 mr-1" />}
              {action.includes('Search') && <Search className="w-3 h-3 mr-1" />}
              {action.includes('Write') && <FileText className="w-3 h-3 mr-1" />}
              {action.includes('professional') && <Zap className="w-3 h-3 mr-1" />}
              {action}
            </button>
          ))}
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div 
            key={message.id} 
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div 
              className={`max-w-xs p-3 rounded-lg ${message.role === 'user' 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-100 text-black'}`}
            >
              <div className="whitespace-pre-wrap text-sm">{message.content}</div>
              {message.hasEditorAction && (
                <div className="mt-2 px-2 py-1 bg-green-100 text-green-800 text-xs rounded flex items-center">
                  <span className="mr-1">✅</span>
                  Editor {message.editorActionType === 'replace' ? 'modified' : 'updated'}
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="max-w-xs p-3 rounded-lg bg-gray-100 text-black">
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                <span className="text-sm">AI is working...</span>
              </div>
            </div>
          </div>
        )}
      </div>
      
      <div className="p-4 border-t border-gray-200">
        <form onSubmit={handleSubmit} className="space-y-2">
          <div className="flex space-x-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
              placeholder="Ask AI to modify editor or search web..."
              disabled={isLoading || connectionStatus !== 'connected'}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim() || connectionStatus !== 'connected'}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 text-sm flex items-center"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          
          <div className="text-xs text-black">
            <p>💡 Try: "Fix grammar", "Make professional", "Search [topic] and insert"</p>
          </div>
        </form>
      </div>
    </div>
  );
}
