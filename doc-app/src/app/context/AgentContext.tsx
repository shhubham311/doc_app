'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface WebSearchResponse {
  query: string;
  results: SearchResult[];
  summary: string;
  total_results?: number;
}

export interface AgentTools {
  webSearch: (query: string) => Promise<WebSearchResponse>;
  crawlUrl: (url: string) => Promise<string>;
  summarizeContent: (content: string) => Promise<string>;
}

type AgentContextType = {
  performWebSearch: (query: string) => Promise<WebSearchResponse>
  insertToEditor: (content: WebSearchResponse | string) => void
  processAgentCommand: (command: string) => Promise<any>
  tools: AgentTools
}

// Configuration for backend URL - adjust this based on your deployment
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

const AgentContext = createContext<AgentContextType | undefined>(undefined)

export function AgentProvider({ children }: { children: ReactNode }) {
  
  const performWebSearch = async (query: string): Promise<WebSearchResponse> => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/agent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          action: 'web_search'
        }),
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.status !== 'success' || !data.result) {
        throw new Error('Invalid response format from server');
      }

      // Transform the backend response to match our interface
      const backendResult = data.result;
      
      return {
        query: backendResult.query || query,
        results: backendResult.results.map((result: any) => ({
          title: result.title || 'Untitled',
          url: result.url || '#',
          snippet: result.snippet || 'No description available'
        })),
        summary: backendResult.summary || `Found ${backendResult.results.length} results for: ${query}`,
        total_results: backendResult.total_results || backendResult.results.length
      };
      
    } catch (error) {
      console.error('Error performing web search:', error);
      
      // Return a user-friendly error response
      let errorMessage = 'Error performing search';
      if (error instanceof Error) {
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
          errorMessage = 'Unable to connect to search service. Please check if the backend is running.';
        } else if (error.message.includes('web_search')) {
          errorMessage = 'Search feature is not available at the moment.';
        }
      }
      
      return {
        query: query,
        results: [],
        summary: errorMessage,
        total_results: 0
      };
    }
  }

  const crawlUrl = async (url: string): Promise<string> => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/agent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: url,
          action: 'crawl_url'
        }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data.result?.content || 'Unable to crawl URL';
    } catch (error) {
      console.error('Error crawling URL:', error);
      return 'Error: Unable to crawl the specified URL';
    }
  };

  const summarizeContent = async (content: string): Promise<string> => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: `Please provide a concise summary of the following content:\n\n${content}`,
          session_id: `agent_summary_${Date.now()}`
        }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data.response || 'Unable to summarize content';
    } catch (error) {
      console.error('Error summarizing content:', error);
      return 'Error: Unable to summarize the provided content';
    }
  };

  const processAgentCommand = async (command: string): Promise<any> => {
    try {
      // Parse different types of agent commands
      const lowerCommand = command.toLowerCase();
      
      if (lowerCommand.includes('search') && lowerCommand.includes('insert')) {
        // Extract search query
        const searchQuery = command.replace(/search|for|and|insert|into|editor|please/gi, '').trim();
        const results = await performWebSearch(searchQuery);
        
        // Auto-insert into editor
        insertToEditor(results);
        
        return {
          type: 'search_and_insert',
          results,
          message: `Searched for "${searchQuery}" and inserted ${results.results.length} results into editor.`
        };
      }
      
      if (lowerCommand.includes('crawl') || lowerCommand.includes('fetch')) {
        // Extract URL
        const urlMatch = command.match(/https?:\/\/[^\s]+/);
        if (urlMatch) {
          const content = await crawlUrl(urlMatch[0]);
          return {
            type: 'crawl',
            content,
            message: `Crawled content from ${urlMatch[0]}`
          };
        } else {
          throw new Error('No valid URL found in command');
        }
      }
      
      if (lowerCommand.includes('summarize')) {
        // This would need additional context or content to summarize
        return {
          type: 'summarize',
          message: 'Please provide content to summarize or specify a URL to crawl first.'
        };
      }
      
      // Default to web search
      const results = await performWebSearch(command);
      return {
        type: 'search',
        results,
        message: `Found ${results.results.length} results for: ${command}`
      };
      
    } catch (error) {
      console.error('Error processing agent command:', error);
      return {
        type: 'error',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  };

  const insertToEditor = (content: WebSearchResponse | string) => {
    console.log('Content to insert into editor:', content);
    
    // Dispatch a custom event that the Editor component listens for
    const event = new CustomEvent('insertContent', { 
      detail: { content } 
    });
    window.dispatchEvent(event);
    
    // Also try the direct method if available
    if (typeof window !== 'undefined' && (window as any).editorInsertContent) {
      if (typeof content === 'string') {
        (window as any).editorInsertContent(`<p>${content}</p>`);
      } else {
        const formattedContent = content.results
          .map(result => `<h3>${result.title}</h3><p>${result.snippet}</p><p><a href="${result.url}" target="_blank">Read more</a></p>`)
          .join('<br/><br/>');
        (window as any).editorInsertContent(formattedContent);
      }
      return true;
    }
    
    return false;
  }

  // Agent tools object
  const tools: AgentTools = {
    webSearch: performWebSearch,
    crawlUrl,
    summarizeContent
  };

  return (
    <AgentContext.Provider value={{ 
      performWebSearch, 
      insertToEditor, 
      processAgentCommand,
      tools 
    }}>
      {children}
    </AgentContext.Provider>
  )
}

export function useAgent() {
  const context = useContext(AgentContext)
  if (context === undefined) {
    throw new Error('useAgent must be used within an AgentProvider')
  }
  return context
}