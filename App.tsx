
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect } from 'react';
import { SERVICES, BUSINESS_INFO } from './constants';
import LiveAgent from './components/LiveAgent';
import { Settings, Wrench, Sun, Moon, Phone, ShieldCheck } from 'lucide-react';

const App: React.FC = () => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [activeTab, setActiveTab] = useState<'agent' | 'services'>('agent');
  
  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDarkMode]);

  const handleAdminSetup = async () => {
    if ((window as any).aistudio && (window as any).aistudio.openSelectKey) {
        await (window as any).aistudio.openSelectKey();
    }
  };

  return (
    <div className="h-screen w-screen bg-[#FDFDFD] dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100 font-sans overflow-hidden flex flex-col relative transition-colors duration-300">
      
      {/* Background Ambience */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
          <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-blue-50 dark:bg-blue-900/10 blur-3xl opacity-60"></div>
          <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-orange-50 dark:bg-orange-900/10 blur-3xl opacity-50"></div>
      </div>

      {/* Header */}
      <header className="relative z-50 w-full bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
           <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                 <Wrench size={20} className="text-white" />
              </div>
              <div>
                 <h1 className="text-lg font-bold tracking-tight">{BUSINESS_INFO.name}</h1>
                 <p className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold">{BUSINESS_INFO.tagline}</p>
              </div>
           </div>

           <nav className="hidden md:flex items-center gap-8">
              <button 
                onClick={() => setActiveTab('agent')}
                className={`text-sm font-medium transition-colors ${activeTab === 'agent' ? 'text-blue-600' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'}`}
              >
                AI Tech Support
              </button>
              <button 
                onClick={() => setActiveTab('services')}
                className={`text-sm font-medium transition-colors ${activeTab === 'services' ? 'text-blue-600' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'}`}
              >
                Service Menu
              </button>
           </nav>

           <div className="flex items-center gap-4">
              <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100" title="Toggle Theme">
                {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              <a href={`tel:${BUSINESS_INFO.phone}`} className="flex items-center gap-2 px-4 py-2 bg-zinc-100 dark:bg-zinc-900 rounded-full text-xs font-bold border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-200 transition-colors">
                 <Phone size={14} />
                 {BUSINESS_INFO.phone}
              </a>
           </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 relative overflow-hidden flex flex-col">
          {activeTab === 'agent' ? (
              <LiveAgent />
          ) : (
              <div className="flex-1 overflow-y-auto p-8 max-w-5xl mx-auto w-full">
                  <div className="mb-12 text-center">
                      <h2 className="text-4xl font-serif font-bold mb-4">Transparent Pricing</h2>
                      <p className="text-zinc-500">Quality repair doesn't have to break the bank.</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {SERVICES.map(service => (
                          <div key={service.id} className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-shadow">
                              <div className="flex justify-between items-start mb-4">
                                  <h3 className="text-xl font-bold">{service.title}</h3>
                                  <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-xs font-bold">{service.price}</span>
                              </div>
                              <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">{service.description}</p>
                          </div>
                      ))}
                  </div>
                  <div className="mt-12 p-8 bg-blue-600 rounded-3xl text-white text-center">
                      <h3 className="text-2xl font-bold mb-2">Can't find what you're looking for?</h3>
                      <p className="mb-6 opacity-90">Our AI Tech "Joe" can give you a custom estimate for any issue.</p>
                      <button onClick={() => setActiveTab('agent')} className="px-8 py-3 bg-white text-blue-600 rounded-full font-bold hover:bg-zinc-100 transition-colors">Talk to Joe Now</button>
                  </div>
              </div>
          )}
      </main>

      {/* Footer / Status Bar */}
      <footer className="h-10 border-t border-zinc-100 dark:border-zinc-900 bg-white dark:bg-zinc-950 flex items-center justify-between px-6 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
         <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            System Status: Online
         </div>
         <button 
            onClick={handleAdminSetup}
            className="flex items-center gap-1.5 opacity-40 hover:opacity-100 transition-opacity"
            title="Service Management (Owner Only)"
         >
            <Settings size={12} />
            Service Management
         </button>
      </footer>
    </div>
  );
};

export default App;
