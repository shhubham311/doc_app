'use client'

import { useState } from 'react'
import { useAgent } from '../context/AgentContext'
import type { WebSearchResponse, SearchResult } from '../context/AgentContext'

export default function AgentCommand() {
  const [command, setCommand] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState<WebSearchResponse | string | null>(null)
  const { performWebSearch, insertToEditor } = useAgent()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsProcessing(true)
    try {
      const searchResults = await performWebSearch(command)
      setResult(searchResults)
      
      // Insert result into editor if available
      if (command.toLowerCase().includes('insert into editor')) {
        insertToEditor(searchResults)
        setResult('Content inserted into editor!')
      }
    } catch (error) {
      console.error('Error processing agent command:', error)
      setResult('Error processing command')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="flex space-x-2">
        <input
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          placeholder="Ask agent to search or insert content..."
          className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          disabled={isProcessing}
        />
        <button
          type="submit"
          disabled={isProcessing}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          {isProcessing ? 'Processing...' : 'Execute'}
        </button>
      </form>
      {result && (
        <div className="p-4 bg-gray-100 rounded-md">
          {typeof result === 'string' ? (
            <p>{result}</p>
          ) : (
            <>
              <h3 className="font-bold">Results for: {result.query}</h3>
              <p className="mb-4">{result.summary}</p>
              
              <div className="space-y-2">
                {result.results.map((item: SearchResult, index: number) => (
                  <div key={index} className="p-2 border rounded">
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      {item.title}
                    </a>
                    <p className="text-sm text-gray-600">{item.snippet}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}