'use client';

import { useEffect, useState } from 'react';
import { useRole } from '@/components/role-provider';
import { getUserSidebarOptions } from '@/server/sidebar';

type SidebarOption = {
  id: string;
  name: string;
  link: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
};

export function useSidebarOptions(userId?: string) {
  const [sidebarOptions, setSidebarOptions] = useState<SidebarOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { role } = useRole();

  useEffect(() => {
    const fetchSidebarOptions = async () => {
      if (!userId) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const response = await getUserSidebarOptions(userId);

        if (response.status === 200 && response.data) {
          setSidebarOptions(response.data);
        } else {
          // If no custom sidebar options, use default based on role
          const defaultOptions =
            role === 'parent'
              ? [
                  { id: 'home', name: 'Home', link: '/' },
                  { id: 'allowance', name: 'Allowance', link: '/allowance' },
                  { id: 'children', name: 'Children', link: '/children' },
                  { id: 'permissions', name: 'Permissions', link: '/permissions' },
                  { id: 'chores', name: 'Chores', link: '/chores' },
                  { id: 'settings', name: 'Settings', link: '/settings' },
                ]
              : [
                  { id: 'home', name: 'Home', link: '/' },
                  { id: 'earn', name: 'Earn', link: '/earn' },
                  { id: 'portfolio', name: 'Portfolio', link: '/portfolio' },
                  { id: 'spend', name: 'Spend', link: '/spend' },
                  { id: 'settings', name: 'Settings', link: '/settings' },
                ];

          setSidebarOptions(defaultOptions as SidebarOption[]);
        }
      } catch (error) {
        console.error('Error fetching sidebar options:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSidebarOptions();
  }, [userId, role]);

  return { sidebarOptions, isLoading };
}
