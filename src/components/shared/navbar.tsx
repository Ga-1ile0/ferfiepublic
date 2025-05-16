'use client';

import { RoleBasedNavbar } from './role-based-navbar';
import { useAuth } from '@/contexts/authContext';

export function Navbar() {
  const { user } = useAuth();

  return <RoleBasedNavbar userId={user?.id} />;
}
