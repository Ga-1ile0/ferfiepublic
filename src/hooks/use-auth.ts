//No need for this.. CHECK
'use client';

import { useContext } from 'react';
import { AuthContext } from '@/contexts/authContext';

export const useAuth = () => {
  return useContext(AuthContext);
};
