import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { sceneTransitions } from '@/lib/video/animations';
import { PartyPopper, Clock, Users, Calendar } from 'lucide-react';

export function Scene5Party() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1500),
      setTimeout(() => setPhase(3), 2500),
      setTimeout(() => setPhase(4), 3200),
      setTimeout(() => setPhase(5), 3900),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  const timeline = [
      { time: "2:00 PM", task: "Marinate chicken & prep veggies", icon: <Clock size={20}/> },
      { time: "5:30 PM", task: "Start the oven", icon: <Clock size={20}/> },
      { time: "6:30 PM", task: "Guests arrive! 🎉", icon: <PartyPopper size={20}/> },
  ];

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-center overflow-hidden bg-[#141210]"
      {...sceneTransitions.slideLeft}
    >
      <div className="absolute inset-0 z-0">
         <img 
            src={`${import.meta.env.BASE_URL}images/party-bg.jpg`} 
            alt="Party bg" 
            className="w-full h-full object-cover opacity-30"
         />
         <div className="absolute inset-0 bg-gradient-to-r from-[#141210] via-[#141210]/90 to-transparent" />
      </div>

      <div className="relative z-10 w-full flex px-20">
        <div className="w-[45%] flex flex-col justify-center">
            <motion.div
                className="flex items-center gap-3 bg-[#E84040]/20 text-[#E84040] w-fit px-4 py-2 rounded-full font-bold text-[1.2vw] mb-6 border border-[#E84040]/30"
                initial={{ opacity: 0, y: -20 }}
                animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: -20 }}
            >
                <Calendar size={18} /> PARTY PLANNER
            </motion.div>
            <motion.h2 
                className="text-[6.5vw] font-black text-white font-display uppercase leading-[0.9] tracking-tight"
                initial={{ opacity: 0, y: 50 }}
                animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
            >
                Host Like<br/>
                <span className="text-[#E84040]">A Pro</span>
            </motion.h2>
            <motion.p
                className="text-[2vw] text-white/70 mt-8 font-body leading-tight"
                initial={{ opacity: 0 }}
                animate={phase >= 2 ? { opacity: 1 } : { opacity: 0 }}
            >
                Generate full menus, shopping lists, and a minute-by-minute prep timeline.
            </motion.p>
            
            {phase >= 2 && (
                <motion.div 
                    className="flex gap-4 mt-8"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                >
                    <div className="bg-white/10 backdrop-blur-md border border-white/20 px-6 py-3 rounded-2xl flex items-center gap-3">
                        <Users className="text-[#E84040]" />
                        <span className="text-white font-bold text-[1.5vw]">8 Guests</span>
                    </div>
                    <div className="bg-white/10 backdrop-blur-md border border-white/20 px-6 py-3 rounded-2xl flex items-center gap-3">
                        <span className="text-white font-bold text-[1.5vw]">🌮 Italian Theme</span>
                    </div>
                </motion.div>
            )}
        </div>
        
        <div className="w-[55%] flex flex-col justify-center pl-10 relative">
            <div className="absolute left-[3rem] top-10 bottom-10 w-[2px] bg-white/10" />
            
            <div className="flex flex-col gap-8">
                {timeline.map((item, i) => {
                    const isPhase = phase >= 3 + i;
                    return (
                        <motion.div 
                            key={item.time}
                            className="flex items-center gap-8 relative z-10"
                            initial={{ opacity: 0, x: 50 }}
                            animate={isPhase ? { opacity: 1, x: 0 } : { opacity: 0, x: 50 }}
                            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                        >
                            <div className="w-16 h-16 rounded-full bg-[#141210] border-4 border-[#E84040] flex items-center justify-center text-[#E84040] shadow-[0_0_20px_rgba(232,64,64,0.3)] shrink-0">
                                {item.icon}
                            </div>
                            <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-6 rounded-3xl flex-1 shadow-2xl">
                                <div className="text-[#E84040] text-[1.2vw] font-black uppercase tracking-widest">{item.time}</div>
                                <div className="text-[1.8vw] font-bold text-white mt-1">{item.task}</div>
                            </div>
                        </motion.div>
                    );
                })}
            </div>
        </div>
      </div>
    </motion.div>
  );
}
