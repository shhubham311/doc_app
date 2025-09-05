'use client'

import { createContext, useContext, ReactNode } from 'react'

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface WebSearchResponse {
  type: 'search' | 'search_and_insert';
  query: string;
  results: SearchResult[];
  summary: string;
  total_results?: number;
}

export type AgentResponse = WebSearchResponse | {
  type: 'crawl' | 'summarize' | 'error';
  message: string;
  content?: string;
}

export interface AgentTools {
  webSearch: (query: string) => Promise<WebSearchResponse>;
  crawlUrl: (url: string) => Promise<string>;
  summarizeContent: (content: string) => Promise<string>;
}

type AgentContextType = {
  performWebSearch: (query: string) => Promise<WebSearchResponse>;
  insertToEditor: (content: AgentResponse | string) => void;
  processAgentCommand: (command: string) => Promise<AgentResponse>;
  tools: AgentTools;
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
          action: 'web_search',
          query,
        }),
      })

      if (!response.ok) {
        throw new Error('Search request failed')
      }

      const backendResult = await response.json()
      
      return {
        type: 'search',
        query,
        results: backendResult.results.map((result: SearchResult) => ({
          title: result.title,
          url: result.url,
          snippet: result.snippet,
        })),
        summary: backendResult.summary,
        total_results: backendResult.total_results,
      }
    } catch (error) {
      console.error('Error performing web search:', error)
      return {
        type: 'search',
        query,
        results: [],
        summary: 'Search failed',
        total_results: 0,
      }
    }
  }

  const insertToEditor = (content: AgentResponse | string) => {
    if (typeof window !== 'undefined' && window.editorInsertContent) {
      if (typeof content === 'string') {
        window.editorInsertContent(`<p>${content}</p>`);
      } else if ('results' in content) {
        // This is a WebSearchResponse
        const formattedContent = content.results
          .map((result: SearchResult) => `<h3>${result.title}</h3><p>${result.snippet}</p><p><a href="${result.url}" target="_blank">Read more</a></p>`)
          .join('\n\n');
        window.editorInsertContent(formattedContent);
      } else {
        // This is an error, crawl, or summarize response
        window.editorInsertContent(`<p>${content.message}</p>${content.content ? `<p>${content.content}</p>` : ''}`);
      }
    }
  }

  const processAgentCommand = async (command: string): Promise<AgentResponse> => {
    try {
      if (command.toLowerCase().includes('search')) {
        const query = command.replace(/search/i, '').trim()
        if (!query) {
          return {
            type: 'error',
            message: 'Please specify what to search for'
          }
        }
        
        const results = await performWebSearch(query)
        return {
          ...results,
          type: 'search_and_insert'
        }
      }

      if (command.toLowerCase().startsWith('crawl')) {
        const url = command.replace(/crawl/i, '').trim()
        if (!url) {
          return {
            type: 'crawl',
            message: 'Please specify a URL to crawl'
          }
        }

        try {
          const content = await tools.crawlUrl(url)
          return {
            type: 'crawl',
            message: 'Successfully crawled URL',
            content
          }
        } catch (error) {
          return {
            type: 'error',
            message: error instanceof Error ? error.message : 'Failed to crawl URL'
          }
        }
      }

      if (command.toLowerCase().startsWith('summarize')) {
        const content = command.replace(/summarize/i, '').trim()
        if (!content) {
          return {
            type: 'summarize',
            message: 'Please provide content to summarize or specify a URL to crawl first.'
          }
        }

        try {
          const summary = await tools.summarizeContent(content)
          return {
            type: 'summarize',
            message: 'Content summary:',
            content: summary
          }
        } catch (error) {
          return {
            type: 'error',
            message: error instanceof Error ? error.message : 'Failed to summarize content'
          }
        }
      }

      return {
        type: 'error',
        message: 'Unknown command. Available commands: search, crawl, summarize'
      }

    } catch (error) {
      return {
        type: 'error',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }

  const tools: AgentTools = {
    webSearch: performWebSearch,
    crawlUrl: async (url: string) => {
      const response = await fetch(`${BACKEND_URL}/api/agent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'crawl',
          url,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to crawl URL')
      }

      const data = await response.json()
      return data.content
    },
    summarizeContent: async (content: string) => {
      const response = await fetch(`${BACKEND_URL}/api/agent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'summarize',
          content,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to summarize content')
      }

      const data = await response.json()
      return data.summary
    },
  }

  return (
    <AgentContext.Provider
      value={{
        performWebSearch,
        insertToEditor,
        processAgentCommand,
        tools,
      }}
    >
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
