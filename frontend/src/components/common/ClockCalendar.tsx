'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export function ClockCalendar() {
  const [time, setTime] = useState<Date | null>(null);

  useEffect(() => {
    setTime(new Date());
    const interval = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!time) {
    return <div className="card h-[280px] bg-white/5 animate-pulse rounded-2xl"></div>;
  }

  const timeString = time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  const dateString = time.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  // Calendar logic
  const year = time.getFullYear();
  const month = time.getMonth();
  const today = time.getDate();
  
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  const days = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="card flex flex-col p-6 bg-gradient-to-br from-violet-600/10 to-fuchsia-600/5 relative overflow-hidden"
    >
      <div className="absolute -top-10 -right-10 w-40 h-40 bg-violet-600/20 blur-[60px] rounded-full"></div>
      <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-fuchsia-600/20 blur-[60px] rounded-full"></div>
      
      <div className="relative z-10 flex flex-col sm:flex-row gap-6 items-center sm:items-stretch">
        {/* Clock Section */}
        <div className="flex-1 flex flex-col justify-center text-center sm:text-left sm:pr-6 sm:border-r sm:border-white/10">
          <h2 className="font-inter tabular-nums text-3xl md:text-4xl xl:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-violet-400 to-fuchsia-400 tracking-tight mb-2 whitespace-nowrap">
            {timeString}
          </h2>
          <p className="text-white/60 font-inter text-sm md:text-base font-medium tracking-wide">
            {dateString}
          </p>
        </div>

        {/* Calendar Section */}
        <div className="w-full sm:w-[220px] shrink-0">
          <div className="grid grid-cols-7 gap-1 text-center mb-2">
            {weekDays.map(d => (
              <div key={d} className="text-[10px] font-bold text-white/40 uppercase tracking-wider">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {days.map((day, i) => (
              <div 
                key={i} 
                className={`text-xs w-7 h-7 flex items-center justify-center mx-auto rounded-full transition-all ${
                  day === today 
                    ? 'bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-bold shadow-[0_0_10px_rgba(167,139,250,0.5)]' 
                    : day 
                      ? 'text-white/70 hover:bg-white/10 hover:text-white' 
                      : ''
                }`}
              >
                {day || ''}
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
