'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import { memo } from 'react';

// Memoize the Static component to prevent unnecessary re-renders
export const Static = memo(() => {
  return (
    <>
      <div className="border-2 border-black fixed top-[120px] left-0 w-[100vw] h-[100vh] bg-[#fab049] bg-[url('/Confetti.png')] bg-repeat -skew-y-[200deg] origin-bottom-right -z-[100] pointer-events-none"></div>
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-[200] bg-[#E87F4E]"></div>
      {/* <div className="pointer-events-none fixed inset-0 h-full w-full overflow-hidden">
        <motion.div
          initial={{ transform: 'translateX(-10%) translateY(-10%)' }}
          animate={{
            transform: 'translateX(10%) translateY(10%)',
          }}
          transition={{
            repeat: Number.POSITIVE_INFINITY,
            duration: 0.2,
            ease: 'linear',
            repeatType: 'mirror',
          }}
          style={{
            backgroundImage: 'url("/static.png")',
          }}
          className="absolute -inset-[100%] opacity-[15%]"
        />
      </div> */}
    </>
  );
});

Static.displayName = 'Static';
