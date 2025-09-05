"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, 
         List, ListOrdered, Quote, Code, Link, Image, Table, 
         Save, Share, Users, MessageCircle, Eye, EyeOff, 
         Zap, Wand2, FileText, Download, Upload, Settings,
         Palette, Type, Hash, Minus, Plus, RotateCcw, RotateCw,
         Check, X, ArrowLeftRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface User {
  id: string;
  name: string;
  email: string;
  color: string;
  cursor?: { x: number; y: number };
}

interface CollaborationMessage {
  id: string;
  userId: string;
  userName: string;
  message: string;
  timestamp: Date;
}

interface FloatingToolbarProps {
  position: { x: number; y: number };
  onAction: (action: string) => void;
  isProcessing: boolean;
  selectedText: string;
}

interface PreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalText: string;
  suggestedText: string;
  actionType: string;
  onAccept: () => void;
  onReject: () => void;
}

interface EditorToolbarProps {
  onAction: (action: string, value?: any) => void;
  isPreview: boolean;
  setIsPreview: (preview: boolean) => void;
  collaborators: User[];
  showChat: boolean;
  setShowChat: (show: boolean) => void;
  onLogout: () => void;
  currentUser: any;
}

interface CollaborationChatProps {
  messages: CollaborationMessage[];
  onSendMessage: (message: string) => void;
  currentUser: User;
  collaborators: User[];
  isConnected: boolean;
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

// Preview Modal Component
const PreviewModal: React.FC<PreviewModalProps> = ({ 
  isOpen, onClose, originalText, suggestedText, actionType, onAccept, onReject 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            AI Suggestion - {actionType.charAt(0).toUpperCase() + actionType.slice(1)}
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Review the changes and choose to accept or reject them
          </p>
        </div>
        
        <div className="p-6 overflow-y-auto max-h-96">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-gray-900 mb-2 flex items-center">
                <span className="w-3 h-3 bg-red-100 rounded-full mr-2"></span>
                Original Text
              </h4>
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 min-h-32">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{originalText}</p>
              </div>
            </div>
            
            <div>
              <h4 className="font-medium text-gray-900 mb-2 flex items-center">
                <span className="w-3 h-3 bg-green-100 rounded-full mr-2"></span>
                AI Suggestion
              </h4>
              <div className="border border-gray-200 rounded-lg p-4 bg-green-50 min-h-32">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{suggestedText}</p>
              </div>
            </div>
          </div>
          
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <div className="flex items-center">
              <ArrowLeftRight className="w-4 h-4 text-blue-600 mr-2" />
              <span className="text-sm text-blue-800">
                <strong>Changes:</strong> The AI has {actionType === 'shorten' ? 'shortened' : actionType === 'lengthen' ? 'expanded' : actionType === 'formal' ? 'made more formal' : actionType === 'casual' ? 'made more casual' : 'improved'} your text.
              </span>
            </div>
          </div>
        </div>
        
        <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
          <button
            onClick={onReject}
            className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center"
          >
            <X className="w-4 h-4 mr-2" />
            Keep Original
          </button>
          <button
            onClick={onAccept}
            className="px-4 py-2 bg-green-600 text-white hover:bg-green-700 rounded-lg transition-colors flex items-center"
          >
            <Check className="w-4 h-4 mr-2" />
            Accept Changes
          </button>
        </div>
      </div>
    </div>
  );
};

const FloatingToolbar: React.FC<FloatingToolbarProps> = ({ position, onAction, isProcessing, selectedText }) => {
  const actions = [
    { id: 'edit', label: 'Enhance', icon: Wand2, color: 'blue', description: 'Improve writing quality' },
    { id: 'shorten', label: 'Shorten', icon: Minus, color: 'green', description: 'Make more concise' },
    { id: 'lengthen', label: 'Expand', icon: Plus, color: 'purple', description: 'Add more details' },
    { id: 'table', label: 'Table', icon: Table, color: 'orange', description: 'Convert to table format' },
    { id: 'formal', label: 'Formal', icon: FileText, color: 'gray', description: 'Professional tone' },
    { id: 'casual', label: 'Casual', icon: MessageCircle, color: 'pink', description: 'Friendly tone' },
    { id: 'summary', label: 'Summary', icon: Hash, color: 'indigo', description: 'Create summary' },
  ];

  return (
    <div 
      className="fixed bg-white border border-gray-200 rounded-xl shadow-xl p-3 z-50 animate-in fade-in duration-200"
      style={{ 
        left: Math.min(position.x, window.innerWidth - 420),
        top: Math.max(position.y - 80, 10),
        maxWidth: '400px'
      }}
    >
      <div className="mb-2">
        <h4 className="text-xs font-medium text-gray-700 mb-1">AI Text Editor</h4>
        <p className="text-xs text-gray-500">
          {selectedText.length > 40 
            ? `"${selectedText.substring(0, 40)}..."` 
            : `"${selectedText}"`
          } ({selectedText.split(' ').length} words)
        </p>
      </div>
      
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.id}
              onClick={() => onAction(action.id)}
              disabled={isProcessing}
              className="flex items-center space-x-1 px-3 py-2 text-xs rounded-lg hover:bg-blue-50 border border-blue-200 text-blue-700 disabled:opacity-50 transition-all duration-200 hover:scale-105 bg-white"
              title={action.description}
            >
              <Icon className="w-3 h-3" />
              <span>{isProcessing ? '...' : action.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// [Rest of the components remain the same as in your original code...]
const EditorToolbar: React.FC<EditorToolbarProps> = ({ 
  onAction, isPreview, setIsPreview, collaborators, showChat, setShowChat, onLogout, currentUser
}) => {
  const [fontSize, setFontSize] = useState(16);

  const fontSizes = [12, 14, 16, 18, 20, 24];
  
  return (
    <div className="bg-white border-b border-gray-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1">
            <button onClick={() => onAction('save')} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="Save document">
              <Save className="w-4 h-4 text-gray-600" />
            </button>
            <button onClick={() => onAction('share')} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="Share document">
              <Share className="w-4 h-4 text-gray-600" />
            </button>
          </div>

          <div className="w-px h-6 bg-gray-300"></div>

          <div className="flex items-center space-x-1">
            <button onClick={() => onAction('bold')} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="Bold">
              <Bold className="w-4 h-4 text-gray-600" />
            </button>
            <button onClick={() => onAction('italic')} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="Italic">
              <Italic className="w-4 h-4 text-gray-600" />
            </button>
            <button onClick={() => onAction('underline')} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="Underline">
              <Underline className="w-4 h-4 text-gray-600" />
            </button>
          </div>

          <div className="w-px h-6 bg-gray-300"></div>

          <select
            value={fontSize}
            onChange={(e) => {
              const size = Number(e.target.value);
              setFontSize(size);
              onAction('fontSize', size);
            }}
            className="text-sm border border-gray-300 rounded px-2 py-1"
          >
            {fontSizes.map(size => (
              <option key={size} value={size}>{size}px</option>
            ))}
          </select>
        </div>

        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <div
              className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-xs font-semibold text-white bg-blue-500"
              title={currentUser?.name}
            >
              {currentUser?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <span>{currentUser?.name || 'User'}</span>
          </div>

          <div className="flex items-center space-x-2">
            <div className="flex -space-x-2">
              {collaborators.slice(0, 3).map((user) => (
                <div
                  key={user.id}
                  className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-xs font-semibold text-white"
                  style={{ backgroundColor: user.color }}
                  title={user.name}
                >
                  {user.name.charAt(0).toUpperCase()}
                </div>
              ))}
            </div>
            <Users className="w-4 h-4 text-gray-600" />
          </div>

          <div className="w-px h-6 bg-gray-300"></div>

          <button
            onClick={() => setShowChat(!showChat)}
            className={`p-2 rounded-lg transition-colors ${
              showChat ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-600'
            }`}
            title="Toggle chat"
          >
            <MessageCircle className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsPreview(!isPreview)}
            className={`p-2 rounded-lg transition-colors ${
              isPreview ? 'bg-green-100 text-green-600' : 'hover:bg-gray-100 text-gray-600'
            }`}
            title="Toggle preview"
          >
            {isPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>

          <button
            onClick={onLogout}
            className="p-2 hover:bg-red-100 text-red-600 rounded-lg transition-colors"
            title="Logout"
          >
            <span className="text-sm">Logout</span>
          </button>
        </div>
      </div>
    </div>
  );
};

const CollaborationChat: React.FC<CollaborationChatProps> = ({ 
  messages, onSendMessage, currentUser, collaborators, isConnected 
}) => {
  const [newMessage, setNewMessage] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim() && isConnected) {
      onSendMessage(newMessage.trim());
      setNewMessage('');
    }
  };

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col h-full">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">Team Chat</h3>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <p className="text-xs text-gray-500">
              {isConnected ? `${collaborators.length + 1} online` : 'Offline'}
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsMinimized(!isMinimized)}
          className="p-1 hover:bg-gray-100 rounded"
        >
          <Minus className="w-4 h-4 text-gray-600" />
        </button>
      </div>

      {!isMinimized && (
        <>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 ? (
              <div className="text-center text-black py-8">
                <MessageCircle className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm text-black">No messages yet</p>
                <p className="text-xs text-gray-600">Start a conversation!</p>
              </div>
            ) : (
              messages.map((message) => (
                <div key={message.id} className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold text-white"
                      style={{ 
                        backgroundColor: message.userId === currentUser.id 
                          ? currentUser.color 
                          : collaborators.find(u => u.id === message.userId)?.color || '#6B7280' 
                      }}
                    >
                      {message.userName.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm font-medium text-gray-900">{message.userName}</span>
                    <span className="text-xs text-gray-500">
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className={`ml-8 text-sm rounded-lg p-2 ${
                    message.userId === currentUser.id 
                      ? 'bg-blue-100 text-blue-900' 
                      : 'bg-gray-50 text-gray-700'
                  }`}>
                    {message.message}
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 border-t border-gray-200">
            <form onSubmit={handleSend} className="flex space-x-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder={isConnected ? "Type a message..." : "Connect to chat"}
                disabled={!isConnected}
                className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-400"
              />
              <button
                type="submit"
                disabled={!newMessage.trim() || !isConnected}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Send
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
};

export default function EnhancedEditor() {
  const { token, user, logout } = useAuth();
  
  const [content, setContent] = useState('<h1>Welcome to DocApp</h1><p>Start collaborating on your document...</p>');
  const [isPreview, setIsPreview] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [selectionPosition, setSelectionPosition] = useState({ x: 0, y: 0 });
  const [showFloatingToolbar, setShowFloatingToolbar] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [theme, setTheme] = useState('default');
  const [fontSize, setFontSize] = useState(16);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionChecked, setConnectionChecked] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [isContentLoaded, setIsContentLoaded] = useState(false);
  const [currentUserAccess, setCurrentUserAccess] = useState<'owner' | 'editor' | 'viewer'>('owner');
  const [documentId] = useState(() => `doc_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 9)}`);
  
  // Preview Modal State
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewData, setPreviewData] = useState({
    original: '',
    suggested: '',
    actionType: '',
    selectionRange: null as Range | null
  });
  
  // Collaboration state
  const [collaborators, setCollaborators] = useState<User[]>([
    { id: '2', name: 'Jane Smith', email: 'jane@example.com', color: '#10B981' },
    { id: '3', name: 'Bob Wilson', email: 'bob@example.com', color: '#F59E0B' },
  ]);
  
  const [chatMessages, setChatMessages] = useState<CollaborationMessage[]>([
    {
      id: '1',
      userId: '2',
      userName: 'Jane Smith',
      message: 'Hey everyone! Ready to work on this document?',
      timestamp: new Date(Date.now() - 300000)
    },
    {
      id: '2',
      userId: '3',
      userName: 'Bob Wilson',
      message: 'Absolutely! I have some great ideas for the introduction.',
      timestamp: new Date(Date.now() - 240000)
    },
  ]);

  const currentUser: User = { 
    id: user?.id || '1', 
    name: user?.name || 'User', 
    email: user?.email || 'user@example.com', 
    color: '#3B82F6' 
  };

  // Check backend connection
  const checkConnection = useCallback(async () => {
    if (!token) {
      setIsConnected(false);
      setConnectionChecked(true);
      return;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/health`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      setIsConnected(response.ok);
    } catch (error) {
      console.error('Connection check failed:', error);
      setIsConnected(false);
    } finally {
      setConnectionChecked(true);
    }
  }, [token]);

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  // Initialize content only once
  useEffect(() => {
    if (contentRef.current && !isContentLoaded) {
      contentRef.current.innerHTML = content;
      setIsContentLoaded(true);
    }
  }, [content, isContentLoaded]);

  // Expose editor functions to window for chat integration
  useEffect(() => {
    (window as any).editorInsertContent = (htmlContent: string, actionType: 'insert' | 'replace' | 'append' = 'insert') => {
      if (contentRef.current) {
        const selection = window.getSelection();
        if (actionType === 'replace' && selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          range.deleteContents();
          range.insertNode(document.createRange().createContextualFragment(htmlContent));
        } else if (actionType === 'append') {
          contentRef.current.innerHTML += htmlContent;
        } else {
          document.execCommand('insertHTML', false, htmlContent);
        }
      }
    };

    (window as any).getEditorContent = () => {
      return contentRef.current?.textContent || '';
    };

    (window as any).setEditorContent = (content: string) => {
      if (contentRef.current) {
        contentRef.current.innerHTML = `<p>${content}</p>`;
      }
    };

    return () => {
      delete (window as any).editorInsertContent;
      delete (window as any).getEditorContent;
      delete (window as any).setEditorContent;
    };
  }, []);

  // Handle text selection for floating toolbar
  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      const text = selection.toString().trim();
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      
      setSelectedText(text);
      setSelectionPosition({ x: rect.left + rect.width / 2, y: rect.top });
      setShowFloatingToolbar(true);
    } else {
      setShowFloatingToolbar(false);
    }
  }, []);

  // AI editing function with preview modal
  const callAIForEdit = async (text: string, action: string): Promise<string> => {
    if (!isConnected || !token) {
      throw new Error('Not connected to AI service or not authenticated');
    }

    try {
      const prompts = {
        'edit': `Please improve and refine this text while keeping its original meaning: "${text}"`,
        'shorten': `Please make this text shorter and more concise while keeping the key points: "${text}"`,
        'lengthen': `Please expand this text with more details and examples: "${text}"`,
        'table': `Convert this text into a well-formatted HTML table if applicable, or organize it in a structured format: "${text}"`,
        'formal': `Rewrite this text in a more formal, professional tone: "${text}"`,
        'casual': `Rewrite this text in a more casual, friendly tone: "${text}"`,
        'summary': `Create a brief summary of this text: "${text}"`
      };

      const response = await fetch(`${BACKEND_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          prompt: prompts[action as keyof typeof prompts] || prompts.edit,
          session_id: `editor_${Date.now()}`
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication failed. Please login again.');
        }
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();
      return data.response || text;
    } catch (error) {
      console.error('AI edit error:', error);
      throw error;
    }
  };

  // Handle floating toolbar actions with preview modal
  const handleFloatingAction = async (action: string) => {
    if (!selectedText || !isConnected) {
      if (!isConnected) {
        alert('Please check your connection to use AI editing features');
      }
      return;
    }
    
    setIsProcessing(true);
    setShowFloatingToolbar(false);
    
    try {
      const suggestion = await callAIForEdit(selectedText, action);
      const selection = window.getSelection();
      
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0).cloneRange();
        
        // Show preview modal
        setPreviewData({
          original: selectedText,
          suggested: suggestion,
          actionType: action,
          selectionRange: range
        });
        setShowPreviewModal(true);
      }
      
    } catch (error) {
      console.error('Floating action error:', error);
      alert(`AI editing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle preview modal accept
  const handlePreviewAccept = () => {
    if (previewData.selectionRange && previewData.suggested) {
      const range = previewData.selectionRange;
      range.deleteContents();
      range.insertNode(document.createTextNode(previewData.suggested));
      
      // Move cursor to end of inserted text
      range.collapse(false);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
    
    setShowPreviewModal(false);
    setPreviewData({ original: '', suggested: '', actionType: '', selectionRange: null });
  };

  // Handle preview modal reject
  const handlePreviewReject = () => {
    setShowPreviewModal(false);
    setPreviewData({ original: '', suggested: '', actionType: '', selectionRange: null });
  };

  // Handle toolbar actions
  const handleToolbarAction = (action: string, value?: any) => {
    if (!contentRef.current) return;

    switch (action) {
      case 'bold':
      case 'italic':
      case 'underline':
        document.execCommand(action, false);
        break;
      case 'fontSize':
        if (value) {
          setFontSize(value);
          contentRef.current.style.fontSize = `${value}px`;
        }
        break;
      case 'theme':
        setTheme(value);
        break;
      case 'save':
        const currentContent = contentRef.current.innerHTML;
        setContent(currentContent);
        console.log('Saving document...', currentContent);
        alert('Document saved successfully!');
        break;
      case 'share':
        console.log('Sharing document...');
        const shareUrl = `${window.location.origin}/document/${Date.now()}`;
        navigator.clipboard?.writeText(shareUrl).then(() => {
          alert('Share link copied to clipboard!');
        });
        break;
    }
  };

  // Send chat message
  const handleSendMessage = (message: string) => {
    const newMessage: CollaborationMessage = {
      id: Date.now().toString(),
      userId: currentUser.id,
      userName: currentUser.name,
      message,
      timestamp: new Date()
    };
    setChatMessages(prev => [...prev, newMessage]);
  };

  // Theme styles
  const getThemeStyles = () => {
    switch (theme) {
      case 'dark':
        return {
          backgroundColor: '#1F2937',
          color: '#F9FAFB',
          border: '1px solid #374151'
        };
      case 'minimal':
        return {
          backgroundColor: '#FFFFFF',
          color: '#1F2937',
          border: 'none',
          boxShadow: 'none'
        };
      case 'focus':
        return {
          backgroundColor: '#FEF3C7',
          color: '#92400E',
          border: '1px solid #F59E0B'
        };
      default:
        return {
          backgroundColor: '#FFFFFF',
          color: '#1F2937',
          border: '1px solid #E5E7EB'
        };
    }
  };

  // Simulate collaborative messages
  useEffect(() => {
    if (!isConnected) return;

    const interval = setInterval(() => {
      if (Math.random() < 0.05) {
        const randomUser = collaborators[Math.floor(Math.random() * collaborators.length)];
        const messages = [
          "Looking good so far!",
          "Should we expand on this section?",
          "Nice work on the formatting!",
          "I made some small edits above",
          "Ready to review when you are",
          "This flows really well",
          "Great progress today!"
        ];
        const randomMessage = messages[Math.floor(Math.random() * messages.length)];
        
        const newMessage: CollaborationMessage = {
          id: Date.now().toString() + Math.random(),
          userId: randomUser.id,
          userName: randomUser.name,
          message: randomMessage,
          timestamp: new Date()
        };
        setChatMessages(prev => [...prev.slice(-15), newMessage]);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [collaborators, isConnected]);

  // Show login prompt if not authenticated
  if (!token || !user) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8 bg-white rounded-lg shadow-lg max-w-md mx-auto">
          <h1 className="text-2xl font-bold mb-4 text-gray-900">DocApp Editor</h1>
          <p className="text-gray-600 mb-4">Please login to access the collaborative editor</p>
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-blue-600" />
          </div>
          <p className="text-sm text-gray-500">Login required for AI-powered editing and collaboration features</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Toolbar */}
      <EditorToolbar
        onAction={handleToolbarAction}
        isPreview={isPreview}
        setIsPreview={setIsPreview}
        collaborators={collaborators}
        showChat={showChat}
        setShowChat={setShowChat}
        onLogout={logout}
        currentUser={user}
      />

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="max-w-4xl mx-auto">
              {isPreview ? (
                <div
                  className="prose prose-lg max-w-none p-8 rounded-lg shadow-sm"
                  style={getThemeStyles()}
                  dangerouslySetInnerHTML={{ __html: contentRef.current?.innerHTML || content }}
                />
              ) : (
                <div
                  ref={contentRef}
                  contentEditable
                  suppressContentEditableWarning
                  className="min-h-[600px] p-8 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
                  style={{ 
                    ...getThemeStyles(), 
                    fontSize: `${fontSize}px`,
                    lineHeight: '1.6'
                  }}
                  onMouseUp={handleMouseUp}
                  onKeyDown={(e) => {
                    if (e.ctrlKey || e.metaKey) {
                      switch (e.key) {
                        case 'b':
                          e.preventDefault();
                          handleToolbarAction('bold');
                          break;
                        case 'i':
                          e.preventDefault();
                          handleToolbarAction('italic');
                          break;
                        case 'u':
                          e.preventDefault();
                          handleToolbarAction('underline');
                          break;
                        case 's':
                          e.preventDefault();
                          handleToolbarAction('save');
                          break;
                      }
                    }
                  }}
                />
              )}
            </div>
          </div>

          {/* Status bar */}
          <div className="bg-white border-t border-gray-200 px-6 py-2 flex justify-between items-center text-sm text-black">
            <div className="flex items-center space-x-4">
              <span>Words: {(contentRef.current?.textContent || '').split(/\s+/).filter(word => word.length > 0).length}</span>
              <span>Characters: {(contentRef.current?.textContent || '').length}</span>
              <span className="flex items-center">
                <div className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                {isConnected ? 'Connected' : 'Offline'}
              </span>
              <span className="flex items-center">
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  currentUserAccess === 'owner' ? 'bg-purple-100 text-purple-800' :
                  currentUserAccess === 'editor' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {currentUserAccess.charAt(0).toUpperCase() + currentUserAccess.slice(1)}
                </span>
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <span>Document: {documentId.slice(0, 8)}...</span>
              <span>Theme: {theme}</span>
              <span>Font: {fontSize}px</span>
              <span>User: {user?.name}</span>
              {!connectionChecked ? (
                <span className="text-yellow-600">Connecting...</span>
              ) : !isConnected && (
                <button 
                  onClick={checkConnection}
                  className="text-blue-600 hover:underline"
                >
                  Retry Connection
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Chat sidebar */}
        {showChat && (
          <CollaborationChat
            messages={chatMessages}
            onSendMessage={handleSendMessage}
            currentUser={currentUser}
            collaborators={collaborators}
            isConnected={isConnected}
          />
        )}
      </div>

      {/* Floating toolbar */}
      {showFloatingToolbar && selectedText && !isPreview && (
        <FloatingToolbar
          position={selectionPosition}
          onAction={handleFloatingAction}
          isProcessing={isProcessing}
          selectedText={selectedText}
        />
      )}

      {/* Preview Modal */}
      <PreviewModal
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        originalText={previewData.original}
        suggestedText={previewData.suggested}
        actionType={previewData.actionType}
        onAccept={handlePreviewAccept}
        onReject={handlePreviewReject}
      />
    </div>
  );
}
