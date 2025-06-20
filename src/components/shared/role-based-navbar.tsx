import React, { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { useRole } from '../role-provider';
import { useSidebarOptions } from '@/hooks/use-sidebar-options';
import {
    Home,
    Wallet,
    ListChecks,
    Gift,
    BarChart2,
    Settings,
    Users,
    ShoppingCart,
    BriefcaseBusiness,
    HandCoins,
} from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';

type NavItem = {
    id: string;
    name: string;
    link: string;
    icon: React.ReactNode;
};

// Memoize the icon mapping function since it doesn't depend on any props or state
const getIconForNavItem = (name: string) => {
    switch (name.toLowerCase()) {
        case 'home':
            return <Home size={20} />;
        case 'allowance':
            return <Wallet size={20} />;
        case 'children':
            return <Users size={20} />;
        case 'permissions':
            return <BarChart2 size={20} />;
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
        case 'portfolio':
            return <BriefcaseBusiness size={20} />;
        case 'earn':
            return <HandCoins size={20} />;
        default:
            return <Home size={20} />;
    }
};

// Memoize NavItem component to prevent unnecessary re-renders
const NavItem = React.memo(function NavItem({
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
            className={`flex flex-col items-center justify-center gap-1 px-2 py-1 rounded-md transition-colors ${isActive ? 'text-primary bg-primary/10' : 'text-black hover:text-primary hover:bg-primary/5'
                }`}
        >
            {icon}
            <span className="text-xs sm:text-sm font-medium max-[355px]:hidden overflow-hidden whitespace-nowrap">{label}</span>
        </Link>
    );
});

export function RoleBasedNavbar({ userId }: { userId?: string }) {
    const { role } = useRole();
    const pathname = usePathname();
    const { sidebarOptions } = useSidebarOptions(userId);

    // Memoize default nav items based on role
    const defaultNavItems = useMemo<NavItem[]>(
        () =>
            role === 'parent'
                ? [
                    { id: 'home', name: 'Home', link: '/', icon: <Home size={20} /> },
                    { id: 'allowance', name: 'Allowance', link: '/allowance', icon: <Wallet size={20} /> },
                    { id: 'children', name: 'Kids', link: '/children', icon: <Users size={20} /> },
                    { id: 'chores', name: 'Chores', link: '/chores', icon: <ListChecks size={20} /> },
                    { id: 'settings', name: 'Settings', link: '/settings', icon: <Settings size={20} /> },
                ]
                : [
                    { id: 'home', name: 'Home', link: '/', icon: <Home size={20} /> },
                    { id: 'earn', name: 'Earn', link: '/earn', icon: <HandCoins size={20} /> },
                    {
                        id: 'portfolio',
                        name: 'Portfolio',
                        link: '/portfolio',
                        icon: <BriefcaseBusiness size={20} />,
                    },
                    { id: 'spend', name: 'Spend', link: '/spend', icon: <ShoppingCart size={20} /> },
                    { id: 'settings', name: 'Settings', link: '/settings', icon: <Settings size={20} /> },
                ],
        [role]
    );

    // Memoize nav items based on sidebar options
    const navItems = useMemo(
        () =>
            sidebarOptions.map(option => ({
                id: option.id,
                name: option.name,
                link: option.link,
                icon: getIconForNavItem(option.name),
            })),
        [sidebarOptions]
    );

    // Memoize the final display items
    const displayNavItems = useMemo(
        () => (navItems.length > 0 ? navItems : defaultNavItems),
        [navItems, defaultNavItems]
    );

    return (
        <nav className="fixed bottom-0 left-0 right-0 py-2 px-2 z-50 w-full">
            <div className="w-full max-w-xl mx-auto px-2 py-3">
                <motion.div
                    className="flex justify-between sm:justify-around rounded-xl border-2 border-black bg-[#E87F4E]/90 p-1 sm:p-2 shadow-[-5px_5px_0px_#000000] shadow-yellow-700 backdrop-blur-sm w-full"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.3 }}
                >
                    {displayNavItems.map(item => (
                        <NavItem
                            key={item.id}
                            icon={item.icon}
                            label={item.name}
                            href={item.link}
                            isActive={pathname === item.link}
                        />
                    ))}
                </motion.div>
            </div>
        </nav>
    );
}

export default RoleBasedNavbar;
