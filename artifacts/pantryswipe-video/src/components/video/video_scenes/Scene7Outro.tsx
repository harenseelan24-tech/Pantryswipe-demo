import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { sceneTransitions } from '@/lib/video/animations';

export function Scene7Outro() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1500),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-center overflow-hidden bg-primary"
      {...sceneTransitions.clipPolygon}
    >
      <div className="relative z-10 flex flex-col items-center">
        
        <motion.div 
          className="w-40 h-40 mb-10 bg-white rounded-[2.5rem] flex items-center justify-center shadow-2xl"
          initial={{ scale: 0, rotate: -45 }}
          animate={phase >= 1 ? { scale: 1, rotate: 0 } : { scale: 0, rotate: -45 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        </motion.div>

        <motion.h1 
          className="text-[8vw] font-black text-black leading-none font-display uppercase tracking-tight"
          initial={{ opacity: 0, y: 50 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30, delay: 0.1 }}
        >
          PANTRYSWIPE
        </motion.h1>

        <motion.div
            className="mt-12 flex gap-6"
            initial={{ opacity: 0, y: 20 }}
            animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ type: 'spring', stiffness: 300 }}
        >
            <div className="bg-black text-white px-10 py-5 rounded-full font-bold text-[2vw] flex items-center gap-3">
                Download on iOS
            </div>
            <div className="bg-black text-white px-10 py-5 rounded-full font-bold text-[2vw] flex items-center gap-3">
                Download on Android
            </div>
        </motion.div>

      </div>
    </motion.div>
  );
}
