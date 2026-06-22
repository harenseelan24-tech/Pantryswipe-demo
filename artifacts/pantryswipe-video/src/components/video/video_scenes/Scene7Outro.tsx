import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { sceneTransitions } from '@/lib/video/animations';

export function Scene7Outro() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1500),
      setTimeout(() => setPhase(3), 2200),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-center overflow-hidden bg-[#141210]"
      {...sceneTransitions.clipPolygon}
    >
      <div className="absolute inset-0 z-0 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-t from-[#F5A623]/20 to-transparent opacity-50" />
      </div>

      <div className="relative z-10 flex flex-col items-center">
        
        <motion.div 
          className="mb-10"
          initial={{ scale: 0, rotate: -45, filter: 'blur(20px)' }}
          animate={phase >= 1 ? { scale: 1, rotate: 0, filter: 'blur(0px)' } : { scale: 0, rotate: -45, filter: 'blur(20px)' }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          <img 
            src={`${import.meta.env.BASE_URL}logo.png`} 
            alt="PantrySwipe Logo" 
            className="w-[18vw] h-[18vw] max-w-[200px] max-h-[200px] rounded-full shadow-[0_0_80px_rgba(245,166,35,0.6)] object-contain"
          />
        </motion.div>

        <motion.h1 
          className="text-[8vw] font-black text-white leading-none font-display uppercase tracking-tight text-center"
          initial={{ opacity: 0, y: 50 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30, delay: 0.1 }}
        >
          PANTRYSWIPE
        </motion.h1>

        <motion.p
          className="text-[2.5vw] text-white/80 mt-6 font-body font-bold tracking-wide"
          initial={{ opacity: 0, filter: 'blur(10px)' }}
          animate={phase >= 2 ? { opacity: 1, filter: 'blur(0)' } : { opacity: 0, filter: 'blur(10px)' }}
        >
          Stop eating boring food.
        </motion.p>

        <motion.div
            className="mt-14 flex gap-6"
            initial={{ opacity: 0, y: 30 }}
            animate={phase >= 3 ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
            transition={{ type: 'spring', stiffness: 300 }}
        >
            <div className="bg-white text-black px-10 py-5 rounded-full font-black text-[1.8vw] flex items-center gap-3 shadow-xl hover:scale-105 transition-transform">
                Download on iOS
            </div>
            <div className="bg-white text-black px-10 py-5 rounded-full font-black text-[1.8vw] flex items-center gap-3 shadow-xl hover:scale-105 transition-transform">
                Download on Android
            </div>
        </motion.div>

      </div>
    </motion.div>
  );
}
