import React from 'react';
import phantomLogo from '../../assets/phantom-logo.svg';

interface PhantomLogoProps {
  className?: string;
}

/** Official Phantom mark, stored locally to keep wallet UI reliable offline. */
export const PhantomLogo: React.FC<PhantomLogoProps> = ({ className = 'h-6 w-6' }) => (
  <img src={phantomLogo} alt="Phantom" className={`shrink-0 object-contain ${className}`} />
);
