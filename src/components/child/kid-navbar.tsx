'use client';

import { usePathname } from 'next/navigation';
import { useSidebarOptions } from '@/hooks/use-sidebar-options';
import { Home, Wallet, ListChecks, Gift, Settings, ShoppingCart } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

type NavItem = {
  id: string;
  name: string;
  link: string;
  icon: React.ReactNode;
};

export function KidNavbar({ userId }: { userId: string }) {
  const pathname = usePathname();
  const { sidebarOptions, isLoading } = useSidebarOptions(userId);
  const [navItems, setNavItems] = useState<NavItem[]>([]);

  // Map icon names to actual icon components
  const getIconForNavItem = (name: string) => {
    switch (name.toLowerCase()) {
      case 'home':
        return <Home size={20} />;
      case 'allowance':
        return <Wallet size={20} />;
      case 'trade':
        return <ShoppingCart size={20} />;
      case 'gift cards':
        return <Gift size={20} />;
      case 'spend':
        return <ShoppingCart size={20} />;
      case 'chores':
        return <ListChecks size={20} />;
      case 'settings':
        return <Settings size={20} />;
      default:
        return <Home size={20} />;
    }
  };

  // Convert sidebar options to nav items with icons
  useEffect(() => {
    if (sidebarOptions.length > 0) {
      const items = sidebarOptions.map(option => ({
        id: option.id,
        name: option.name,
        link: option.link,
        icon: getIconForNavItem(option.name),
      }));
      setNavItems(items);
    } else if (!isLoading) {
      // Default options if no custom options are available
      setNavItems([
        { id: 'home', name: 'Home', link: '/', icon: <Home size={20} /> },
        { id: 'allowance', name: 'Allowance', link: '/allowance', icon: <Wallet size={20} /> },
      ]);
    }
  }, [sidebarOptions, isLoading]);

  if (isLoading) {
    return (
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 py-2 px-4 z-50">
        <div className="container mx-auto">
          <div className="flex justify-between items-center">
            {/* Loading skeleton */}
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex flex-col items-center justify-center gap-1 px-2 py-1">
                <div className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse"></div>
                <div className="w-12 h-3 rounded-md bg-gray-200 dark:bg-gray-700 animate-pulse"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 py-2 px-4 z-50">
      <div className="container mx-auto">
        <div className="flex justify-between items-center">
          {navItems.map(item => (
            <NavItem
              key={item.id}
              icon={item.icon}
              label={item.name}
              href={item.link}
              isActive={pathname === item.link}
            />
          ))}
        </div>
      </div>
    </nav>
  );
}

function NavItem({
  icon,
  label,
  href,
  isActive,
}: {
  icon: React.ReactNode;
  label: string;
  href: string;
  isActive: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex flex-col items-center justify-center gap-1 px-2 py-1 rounded-md transition-colors ${
        isActive
          ? 'text-primary bg-primary/10'
          : 'text-gray-500 hover:text-primary hover:bg-primary/5'
      }`}
    >
      {icon}
      <span className="text-xs font-medium">{label}</span>
    </Link>
  );
}
