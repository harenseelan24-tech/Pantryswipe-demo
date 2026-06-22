import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { sceneTransitions } from '@/lib/video/animations';

export function Scene6Cook() {
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
      {...sceneTransitions.slideLeft}
    >
      <div className="absolute inset-0 z-0">
         <img 
            src={`${import.meta.env.BASE_URL}images/cook-mode.jpg`} 
            alt="Cook mode bg" 
            className="w-full h-full object-cover opacity-50"
         />
         <div className="absolute inset-0 bg-black/60" />
      </div>

      <div className="relative z-10 w-full flex flex-col items-center">
        <motion.div 
            className="text-[1.5vw] font-bold tracking-widest text-primary mb-4"
            initial={{ opacity: 0, y: 20 }}
            animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        >
            COOK MODE & GAMIFICATION
        </motion.div>

        <motion.h2 
          className="text-[5vw] font-black text-white font-display text-center uppercase leading-[1]"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={phase >= 1 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          FULL SCREEN GUIDED COOKING
        </motion.h2>

        <motion.div 
            className="mt-12 flex items-center gap-8 bg-white/10 backdrop-blur-xl border border-white/20 p-8 rounded-3xl"
            initial={{ opacity: 0, y: 50 }}
            animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        >
            <div className="flex flex-col items-center gap-2 pr-8 border-r border-white/20">
                <div className="text-[3vw] font-black text-primary">14</div>
                <div className="text-[1vw] text-white/60 uppercase font-bold tracking-wider">Day Streak</div>
            </div>
            <div className="flex flex-col gap-2 pl-4">
                <div className="text-[1.5vw] font-bold text-white flex items-center gap-3">
                    <span className="bg-success text-black px-3 py-1 rounded-lg text-sm">Level Up!</span> Master Chef
                </div>
                <div className="w-[20vw] h-3 bg-white/20 rounded-full overflow-hidden">
                    <motion.div 
                        className="h-full bg-primary"
                        initial={{ width: '40%' }}
                        animate={phase >= 3 ? { width: '85%' } : { width: '40%' }}
                        transition={{ duration: 1, ease: 'easeInOut' }}
                    />
                </div>
            </div>
        </motion.div>

      </div>
    </motion.div>
  );
}
