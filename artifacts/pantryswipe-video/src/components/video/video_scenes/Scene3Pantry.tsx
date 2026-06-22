import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { sceneTransitions } from '@/lib/video/animations';

export function Scene3Pantry() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1500),
      setTimeout(() => setPhase(3), 2500),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-center overflow-hidden"
      {...sceneTransitions.splitHorizontal}
    >
      <div className="absolute inset-0 z-0">
         <img 
            src={`${import.meta.env.BASE_URL}images/pantry-bg.jpg`} 
            alt="Pantry bg" 
            className="w-full h-full object-cover opacity-60"
         />
         <div className="absolute inset-0 bg-black/60" />
      </div>

      <div className="relative z-10 w-full flex flex-col items-center">
        <motion.h2 
          className="text-[6vw] font-black text-white font-display text-center uppercase leading-[0.9]"
          initial={{ opacity: 0, y: -50 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: -50 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          WE KNOW WHAT'S IN<br/>
          <span className="text-secondary">YOUR FRIDGE</span>
        </motion.h2>

        <div className="flex gap-6 mt-12">
            {['Avocados', 'Chicken Breast', 'Garlic', 'Oat Milk'].map((item, i) => (
                <motion.div 
                    key={item}
                    className="bg-white/10 backdrop-blur-md border border-white/20 px-8 py-4 rounded-2xl text-white font-bold text-[1.5vw]"
                    initial={{ opacity: 0, scale: 0.8, y: 20 }}
                    animate={phase >= 2 ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.8, y: 20 }}
                    transition={{ type: 'spring', delay: i * 0.1, stiffness: 300 }}
                >
                    {item}
                </motion.div>
            ))}
        </div>

        <motion.div
            className="mt-12 text-[2vw] text-white/80 font-body"
            initial={{ opacity: 0 }}
            animate={phase >= 3 ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.8 }}
        >
            Smart expiration tracking + Auto-generated shopping lists.
        </motion.div>

      </div>
    </motion.div>
  );
}
