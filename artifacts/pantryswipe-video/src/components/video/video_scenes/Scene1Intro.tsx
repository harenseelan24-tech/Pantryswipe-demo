import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { sceneTransitions } from '@/lib/video/animations';

export function Scene1Intro() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 1200),
      setTimeout(() => setPhase(3), 2000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-center overflow-hidden bg-[#141210]"
      {...sceneTransitions.zoomThrough}
    >
      <div className="absolute inset-0 z-0">
         <motion.div 
           className="absolute w-[100vw] h-[100vw] rounded-full blur-[150px] opacity-30 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
           style={{ background: 'radial-gradient(circle, #F5A623, transparent)' }}
           animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
           transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
         />
      </div>

      <div className="relative z-10 text-center flex flex-col items-center">
        <motion.div 
          className="mb-8"
          initial={{ scale: 0, opacity: 0, filter: 'blur(20px)' }}
          animate={phase >= 1 ? { scale: 1, opacity: 1, filter: 'blur(0px)' } : { scale: 0, opacity: 0, filter: 'blur(20px)' }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          <img 
            src={`${import.meta.env.BASE_URL}logo.png`} 
            alt="PantrySwipe Logo" 
            className="w-[20vw] h-[20vw] max-w-[240px] max-h-[240px] rounded-full shadow-[0_0_80px_rgba(245,166,35,0.4)] object-contain"
          />
        </motion.div>

        <motion.h1 
          className="text-[7vw] font-black text-white leading-none font-display uppercase tracking-tight"
          initial={{ opacity: 0, y: 50 }}
          animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        >
          Cook what you<br/><span className="text-primary">already have</span>
        </motion.h1>
      </div>
    </motion.div>
  );
}
