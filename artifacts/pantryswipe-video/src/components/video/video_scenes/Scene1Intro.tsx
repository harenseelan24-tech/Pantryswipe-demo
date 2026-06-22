import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { sceneTransitions } from '@/lib/video/animations';

export function Scene1Intro() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 1200),
      setTimeout(() => setPhase(3), 2500),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-center overflow-hidden"
      {...sceneTransitions.clipCircle}
    >
      <div className="absolute inset-0 z-0">
         <img 
            src={`${import.meta.env.BASE_URL}images/food-bg1.jpg`} 
            alt="Food bg" 
            className="w-full h-full object-cover opacity-40"
         />
         <div className="absolute inset-0 bg-black/50" />
      </div>

      <div className="relative z-10 text-center flex flex-col items-center">
        <motion.div 
          className="w-32 h-32 mb-8 bg-primary rounded-3xl flex items-center justify-center shadow-2xl shadow-primary/50"
          initial={{ scale: 0, rotate: -45 }}
          animate={phase >= 1 ? { scale: 1, rotate: 0 } : { scale: 0, rotate: -45 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        </motion.div>

        <motion.h1 
          className="text-[8vw] font-black text-white leading-none font-display uppercase tracking-tight"
          initial={{ opacity: 0, y: 50 }}
          animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        >
          PANTRYSWIPE
        </motion.h1>

        <motion.p
          className="text-[2.5vw] text-white/80 mt-4 font-body font-medium"
          initial={{ opacity: 0, filter: 'blur(10px)' }}
          animate={phase >= 3 ? { opacity: 1, filter: 'blur(0)' } : { opacity: 0, filter: 'blur(10px)' }}
          transition={{ duration: 0.8 }}
        >
          Stop eating boring food.
        </motion.p>
      </div>
    </motion.div>
  );
}
