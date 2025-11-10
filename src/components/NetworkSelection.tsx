import { availableNetworks } from '@/lib/constants';
import { NetworkType } from '@/lib/types';
import React from 'react';

interface NetworkSelectionProps {
  onSelect: (network: NetworkType) => void;
}

export const NetworkSelection: React.FC<NetworkSelectionProps> = ({ onSelect }) => {
  return (
    <div className="text-center">
      <h2 className="mb-8 text-2xl font-semibold text-gray-700">Select Network</h2>
      <div className="flex flex-col gap-3">
        {availableNetworks.map(option => (
          <button
            key={option}
            onClick={() => onSelect(option)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white p-5 text-base font-medium text-gray-700 shadow-sm transition-transform duration-200 hover:-translate-y-0.5 hover:border-gray-300 hover:bg-gray-50 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-400"
          >
            <span>🌐</span> {option.charAt(0).toUpperCase() + option.slice(1)}
          </button>
        ))}
      </div>
    </div>
  );
};
