import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { sceneTransitions } from '@/lib/video/animations';
import { Play, Check, Flame } from 'lucide-react';

export function Scene6Cook() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1500),
      setTimeout(() => setPhase(3), 2800),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden bg-[#141210]"
      {...sceneTransitions.scaleFade}
    >
      <div className="absolute inset-0 z-0">
         <img 
            src={`${import.meta.env.BASE_URL}images/cook-mode.jpg`} 
            alt="Cook mode bg" 
            className="w-full h-full object-cover opacity-40 blur-sm scale-105"
         />
         <div className="absolute inset-0 bg-black/50" />
         <div className="absolute inset-0 bg-gradient-to-t from-[#141210] via-transparent to-[#141210]/80" />
      </div>

      <div className="relative z-10 w-full flex flex-col items-center mt-[-10vh]">
        <motion.div 
            className="text-[1.5vw] font-black tracking-widest text-[#F5A623] mb-6 flex items-center gap-2 bg-[#F5A623]/10 px-6 py-2 rounded-full border border-[#F5A623]/20"
            initial={{ opacity: 0, y: 20 }}
            animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        >
            <Play fill="currentColor" size={20}/> COOK MODE
        </motion.div>

        <motion.h2 
          className="text-[6vw] font-black text-white font-display text-center uppercase leading-[0.9] tracking-tight"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={phase >= 1 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          Full Screen<br/>Guided Cooking
        </motion.h2>

        <div className="mt-16 relative">
            {/* Step Card */}
            <motion.div 
                className="w-[60vw] bg-white/10 backdrop-blur-2xl border border-white/20 p-10 rounded-[3rem] shadow-2xl"
                initial={{ opacity: 0, y: 50 }}
                animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
                transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            >
                <div className="flex justify-between items-center mb-6">
                    <span className="text-[#F5A623] font-bold text-[1.5vw] uppercase tracking-wider">Step 3 of 8</span>
                    <div className="w-16 h-16 rounded-full border-4 border-white/20 flex items-center justify-center">
                        <div className="text-white font-bold text-[1.2vw]">2:00</div>
                    </div>
                </div>
                
                <h3 className="text-[3vw] font-bold text-white leading-tight mb-8">
                    Add the diced onions and garlic to the pan. Sauté until fragrant.
                </h3>

                <div className="flex gap-4">
                    <div className="bg-[#4CAF76] text-black font-black text-[1.5vw] px-8 py-4 rounded-2xl flex items-center gap-2">
                        <Check size={24} strokeWidth={3}/> NEXT STEP
                    </div>
                </div>
            </motion.div>

            {/* Gamification popup */}
            {phase >= 3 && (
                <motion.div 
                    className="absolute -bottom-10 -right-10 bg-[#141210] border border-[#F5A623]/30 p-6 rounded-3xl shadow-[0_20px_50px_rgba(245,166,35,0.3)] flex items-center gap-6 z-20"
                    initial={{ opacity: 0, scale: 0, rotate: 10 }}
                    animate={{ opacity: 1, scale: 1, rotate: -5 }}
                    transition={{ type: 'spring', bounce: 0.6 }}
                >
                    <div className="w-16 h-16 bg-[#F5A623]/20 rounded-2xl flex items-center justify-center text-[#F5A623]">
                        <Flame size={32} fill="currentColor"/>
                    </div>
                    <div>
                        <div className="text-[1.2vw] text-white/60 font-bold uppercase tracking-wider">Streak Maintained</div>
                        <div className="text-[2vw] font-black text-white">14 Days Cooking</div>
                    </div>
                </motion.div>
            )}
        </div>

      </div>
    </motion.div>
  );
}
