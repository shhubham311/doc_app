//import { useState } from 'react';

type PreviewModalProps = {
  originalText: string;
  suggestedText: string;
  editType: string;
  onConfirm: () => void;
  onCancel: () => void;
  isProcessing?: boolean;
};

export default function PreviewModal({
  originalText,
  suggestedText,
  editType,
  onConfirm,
  onCancel,
  isProcessing = false,
}: PreviewModalProps) {
  const getEditTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'edit': 'AI Enhancement',
      'shorten': 'Shortened Version',
      'lengthen': 'Expanded Version',
      'table': 'Table Format',
      'formal': 'Formal Tone',
      'casual': 'Casual Tone',
      'summary': 'Summary'
    };
    return labels[type] || 'AI Edit';
  };

  const renderContent = (text: string, isTable: boolean = false) => {
    if (isTable && editType === 'table') {
      return (
        <div 
          className="border p-4 rounded bg-gray-50 min-h-[200px] max-h-[400px] overflow-auto"
          dangerouslySetInnerHTML={{ __html: text }}
        />
      );
    }
    
    return (
      <div className="border p-4 rounded bg-gray-50 min-h-[200px] max-h-[400px] overflow-auto whitespace-pre-wrap">
        {text}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Preview Changes</h2>
          <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
            {getEditTypeLabel(editType)}
          </span>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6 flex-1 overflow-hidden">
          <div className="flex flex-col">
            <h3 className="font-semibold mb-2 text-gray-700">Original</h3>
            <div className="flex-1 overflow-hidden">
              {renderContent(originalText)}
            </div>
          </div>
          
          <div className="flex flex-col">
            <h3 className="font-semibold mb-2 text-blue-700">
              {getEditTypeLabel(editType)}
              {isProcessing && <span className="ml-2 text-sm animate-pulse">(Processing...)</span>}
            </h3>
            <div className="flex-1 overflow-hidden">
              {isProcessing ? (
                <div className="border p-4 rounded bg-blue-50 min-h-[200px] flex items-center justify-center">
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                    <span className="text-blue-600">Generating suggestion...</span>
                  </div>
                </div>
              ) : (
                renderContent(suggestedText, true)
              )}
            </div>
          </div>
        </div>
        
        {/* Word count comparison */}
        {!isProcessing && (
          <div className="mb-4 p-3 bg-gray-50 rounded text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Original: {originalText.split(' ').length} words</span>
              <span>Suggested: {suggestedText.split(' ').length} words</span>
              <span className={`font-medium ${
                suggestedText.split(' ').length > originalText.split(' ').length 
                  ? 'text-green-600' 
                  : suggestedText.split(' ').length < originalText.split(' ').length
                  ? 'text-orange-600'
                  : 'text-blue-600'
              }`}>
                {suggestedText.split(' ').length > originalText.split(' ').length 
                  ? `+${suggestedText.split(' ').length - originalText.split(' ').length} words`
                  : suggestedText.split(' ').length < originalText.split(' ').length
                  ? `-${originalText.split(' ').length - suggestedText.split(' ').length} words`
                  : 'Same length'
                }
              </span>
            </div>
          </div>
        )}
        
        <div className="flex justify-end space-x-4">
          <button
            onClick={onCancel}
            className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isProcessing}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? 'Processing...' : 'Apply Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}