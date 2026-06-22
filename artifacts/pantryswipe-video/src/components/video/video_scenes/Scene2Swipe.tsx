import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { sceneTransitions } from '@/lib/video/animations';
import { Heart, X, Star } from 'lucide-react';

export function Scene2Swipe() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1500),
      setTimeout(() => setPhase(3), 2800),
      setTimeout(() => setPhase(4), 3800),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-center overflow-hidden bg-[#141210]"
      {...sceneTransitions.slideLeft}
    >
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 right-0 w-[50vw] h-[50vw] bg-[#F5A623]/10 rounded-full blur-[100px] pointer-events-none" />
      </div>

      <div className="w-1/2 h-full flex flex-col justify-center px-16 z-10 relative">
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={phase >= 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: -50 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <h2 className="text-[7vw] font-black text-white leading-[0.9] font-display uppercase tracking-tight">
            Tinder<br/>
            <span className="text-[#F5A623]">for Recipes</span>
          </h2>
          <p className="text-[2vw] text-white/70 mt-6 font-body">
            Swipe right to cook.<br/>
            Swipe left to pass.
          </p>
        </motion.div>
      </div>

      <div className="w-1/2 h-full flex items-center justify-center relative">
        {/* Card 3 (Bottom) */}
        <motion.div 
          className="absolute w-[35vw] h-[45vw] bg-white/5 backdrop-blur-xl rounded-[2rem] border border-white/10 shadow-2xl p-4 flex flex-col overflow-hidden"
          initial={{ scale: 0.9, y: 40, opacity: 0 }}
          animate={{ scale: phase >= 2 ? 0.9 : 0.8, y: phase >= 2 ? 20 : 40, opacity: phase >= 2 ? 0.5 : 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        >
          <img src={`${import.meta.env.BASE_URL}images/food-bg1.jpg`} className="w-full h-[65%] object-cover rounded-xl" />
        </motion.div>

        {/* Card 2 (Middle) */}
        <motion.div 
          className="absolute w-[35vw] h-[45vw] bg-white/10 backdrop-blur-xl rounded-[2rem] border border-white/20 shadow-2xl p-4 flex flex-col overflow-hidden origin-bottom"
          initial={{ scale: 0.95, y: 20, opacity: 0 }}
          animate={
            phase >= 3 ? { scale: 0.95, y: 0, opacity: 0.8, rotate: -5 } : 
            { scale: 0.9, y: 20, opacity: 0.5 }
          }
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        >
          <img src={`${import.meta.env.BASE_URL}images/cook-mode.jpg`} className="w-full h-[65%] object-cover rounded-xl" />
          <div className="mt-6 px-2">
            <h3 className="text-[2.2vw] font-black text-white leading-tight">Spicy Salmon Bowl</h3>
            <p className="text-white/60 text-[1.4vw] font-bold mt-2">25 mins • High Protein</p>
          </div>
          
          {phase >= 4 && (
             <motion.div 
               className="absolute top-10 right-10 border-4 border-[#E84040] text-[#E84040] font-black px-6 py-2 rounded-2xl rotate-12 text-[2.5vw]"
               initial={{ opacity: 0, scale: 0 }}
               animate={{ opacity: 1, scale: 1 }}
               transition={{ type: 'spring', bounce: 0.5 }}
             >
               NOPE
             </motion.div>
          )}
        </motion.div>

        {/* Card 1 (Top) */}
        <motion.div 
          className="absolute w-[35vw] h-[45vw] bg-white/15 backdrop-blur-2xl rounded-[2rem] border border-white/30 shadow-[0_30px_60px_rgba(0,0,0,0.5)] p-4 flex flex-col overflow-hidden origin-bottom"
          initial={{ y: '100vh', rotate: 20 }}
          animate={
            phase === 1 ? { y: 0, rotate: 0 } : 
            phase === 2 ? { x: '100vw', rotate: 30, opacity: 0 } : 
            { x: '100vw', rotate: 20, opacity: 0 }
          }
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        >
          <div className="relative w-full h-[65%]">
            <img src={`${import.meta.env.BASE_URL}images/social-food.jpg`} className="w-full h-full object-cover rounded-xl" />
            <div className="absolute bottom-4 left-4 flex gap-2">
                <span className="bg-black/60 backdrop-blur-md text-white px-4 py-1.5 rounded-full text-[1vw] font-bold">🍝 Italian</span>
            </div>
          </div>
          <div className="mt-6 px-2">
            <h3 className="text-[2.5vw] font-black text-white leading-tight font-display tracking-tight">Truffle Pasta</h3>
            <p className="text-white/60 text-[1.4vw] font-bold mt-2 flex items-center gap-2">
                15 mins • <span className="text-[#4CAF76]">100% Match</span>
            </p>
          </div>
          
           {phase >= 2 && (
            <motion.div 
                className="absolute top-10 left-10 text-[#4CAF76] font-black px-6 py-2 rounded-2xl -rotate-12 text-[2.5vw] border-4 border-[#4CAF76] bg-black/40 backdrop-blur-sm"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            >
                LIKE
            </motion.div>
           )}
        </motion.div>

      </div>
    </motion.div>
  );
}
