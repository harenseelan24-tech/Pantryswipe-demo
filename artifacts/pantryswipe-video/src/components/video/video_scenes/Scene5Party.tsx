import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { sceneTransitions } from '@/lib/video/animations';

export function Scene5Party() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1200),
      setTimeout(() => setPhase(3), 2000),
      setTimeout(() => setPhase(4), 2800),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-center overflow-hidden"
      {...sceneTransitions.zoomThrough}
    >
      <div className="absolute inset-0 z-0">
         <img 
            src={`${import.meta.env.BASE_URL}images/party-bg.jpg`} 
            alt="Party bg" 
            className="w-full h-full object-cover opacity-70"
         />
         <div className="absolute inset-0 bg-gradient-to-r from-bg-light via-bg-light/80 to-transparent" />
      </div>

      <div className="relative z-10 w-full flex px-16">
        <div className="w-1/2">
            <motion.h2 
                className="text-[6vw] font-black text-text-primary font-display uppercase leading-[0.9]"
                initial={{ opacity: 0, y: 50 }}
                animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
            >
                HOST LIKE<br/>
                <span className="text-error">A PRO</span>
            </motion.h2>
            <motion.p
                className="text-[2vw] text-text-secondary mt-6 font-body"
                initial={{ opacity: 0 }}
                animate={phase >= 2 ? { opacity: 1 } : { opacity: 0 }}
            >
                Party Planner Wizard generates full menus and timelines.
            </motion.p>
        </div>
        
        <div className="w-1/2 flex flex-col gap-6 pt-10">
            {[
                { time: "2:00 PM", task: "Marinate chicken", done: true },
                { time: "4:30 PM", task: "Prep vegetables", done: true },
                { time: "6:00 PM", task: "Guests arrive", done: false },
            ].map((item, i) => (
                <motion.div 
                    key={item.time}
                    className={`flex items-center gap-6 bg-white p-6 rounded-2xl shadow-xl border ${item.done ? 'border-success/50' : 'border-black/5'}`}
                    initial={{ opacity: 0, x: 50 }}
                    animate={phase >= 3 + i * 0.5 ? { opacity: 1, x: 0 } : { opacity: 0, x: 50 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white ${item.done ? 'bg-success' : 'bg-gray-300'}`}>
                        {item.done && "✓"}
                    </div>
                    <div>
                        <div className="text-text-muted text-[1.2vw] font-bold">{item.time}</div>
                        <div className={`text-[1.8vw] font-bold ${item.done ? 'text-text-secondary line-through' : 'text-text-primary'}`}>{item.task}</div>
                    </div>
                </motion.div>
            ))}
        </div>
      </div>
    </motion.div>
  );
}
