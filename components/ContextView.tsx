
import React from 'react';
import { DocumentIcon } from './Icons';

export const ContextView: React.FC = () => {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-3xl text-center">
        <h2 className="text-2xl text-gray-400 mb-4">Context is Everything</h2>
        <p className="text-gray-500 mb-8">Upload documents, images, or other files for Alfie to reference in your conversations.</p>
        <div className="w-full p-8 border-2 border-dashed border-gray-700 rounded-lg flex flex-col items-center justify-center hover:border-amber-400/50 hover:bg-gray-900/20 transition-all duration-300">
          <DocumentIcon className="w-16 h-16 text-gray-600 mb-4" />
          <p className="text-gray-500">Drop files here or click to upload</p>
          <input type="file" className="absolute w-full h-full opacity-0 cursor-pointer" />
        </div>
      </div>
    </div>
  );
};
