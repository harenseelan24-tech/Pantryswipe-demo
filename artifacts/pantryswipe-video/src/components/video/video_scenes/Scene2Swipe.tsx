import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { sceneTransitions } from '@/lib/video/animations';

export function Scene2Swipe() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 400),
      setTimeout(() => setPhase(2), 1500),
      setTimeout(() => setPhase(3), 2800),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center overflow-hidden bg-bg-light"
      {...sceneTransitions.wipe}
    >
      <div className="w-1/2 h-full flex flex-col justify-center px-16 z-10 relative">
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={phase >= 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: -50 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <h2 className="text-[6vw] font-black text-text-primary leading-[0.9] font-display uppercase">
            TINDER<br/>
            <span className="text-primary">FOR RECIPES</span>
          </h2>
          <p className="text-[2vw] text-text-secondary mt-6 font-body">
            Swipe right to cook.<br/>
            Swipe left to skip.
          </p>
        </motion.div>
      </div>

      <div className="w-1/2 h-full flex items-center justify-center relative">
        <motion.div 
          className="absolute w-[30vw] h-[40vw] bg-white rounded-3xl shadow-2xl p-4 flex flex-col"
          initial={{ x: '100vw', rotate: 20 }}
          animate={
            phase === 1 ? { x: 0, rotate: -5 } : 
            phase === 2 ? { x: '100vw', rotate: 30, opacity: 0 } : 
            { x: '100vw', rotate: 20 }
          }
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        >
          <img src={`${import.meta.env.BASE_URL}images/food-bg1.jpg`} className="w-full h-[60%] object-cover rounded-2xl" />
          <div className="mt-4">
            <h3 className="text-[2vw] font-bold text-text-primary">Spicy Salmon Bowl</h3>
            <p className="text-text-secondary text-[1.2vw]">25 mins • High Protein</p>
          </div>
          <div className="absolute top-8 right-8 bg-error text-white font-black px-6 py-2 rounded-xl rotate-12 text-[2vw] border-4 border-error">
            NOPE
          </div>
        </motion.div>

        <motion.div 
          className="absolute w-[30vw] h-[40vw] bg-white rounded-3xl shadow-2xl p-4 flex flex-col"
          initial={{ x: '100vw', rotate: 20 }}
          animate={
            phase >= 2 ? { x: 0, rotate: 5 } : 
            { x: '100vw', rotate: 20 }
          }
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        >
          <img src={`${import.meta.env.BASE_URL}images/social-food.jpg`} className="w-full h-[60%] object-cover rounded-2xl" />
          <div className="mt-4">
            <h3 className="text-[2vw] font-bold text-text-primary">Truffle Pasta</h3>
            <p className="text-text-secondary text-[1.2vw]">15 mins • Comfort Food</p>
          </div>
           {phase >= 3 && (
            <motion.div 
                className="absolute top-8 left-8 text-success font-black px-6 py-2 rounded-xl -rotate-12 text-[2vw] border-4 border-success"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            >
                COOK IT
            </motion.div>
           )}
        </motion.div>

      </div>
    </motion.div>
  );
}
