import React, { useState, useMemo, useRef, useCallback } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useMarketData } from './useMarketData';
import {
  TrendingDown,
  AlertTriangle,
  ShieldCheck,
  Anchor,
  Fuel,
  ArrowRight,
  LayoutDashboard,
  FileText,
  Presentation,
  Settings,
  Plus,
  ChevronRight,
  Globe,
  Database,
  X,
  Trash2,
  Menu
} from 'lucide-react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';

/**
 * EROSION SENTINEL PRO - v1.2
 * Built for Dan Deigan / dandeigan.com
 * Antigravity Design System Applied
 * Industrial Dark Mode Dashboard for Margin Recovery
 */

const INITIAL_PROJECTS = [
  {
    id: '1',
    name: "JBL Q1 Equipment Move",
    origin: "Savannah, GA",
    destination: "Chicago, IL",
    quoteDate: "2025-10-15",
    originalCost: 2450,
    currentMargin: 25,
    volume: 12,
    status: 'at-risk'
  },
  {
    id: '2',
    name: "Standard Manufacturing - West",
    origin: "Los Angeles, CA",
    destination: "Phoenix, AZ",
    quoteDate: "2025-11-20",
    originalCost: 1800,
    currentMargin: 20,
    volume: 45,
    status: 'stable'
  },
  {
    id: '3',
    name: "Global Chemicals - East",
    origin: "Newark, NJ",
    destination: "Atlanta, GA",
    quoteDate: "2025-09-01",
    originalCost: 3100,
    currentMargin: 30,
    volume: 8,
    status: 'critical'
  }
];

export default function App() {
  const [view, setView] = useState('dashboard');
  const [projects, setProjects] = useState(INITIAL_PROJECTS);
  const [selectedProjectId, setSelectedProjectId] = useState(INITIAL_PROJECTS[0].id);
  const [showAddModal, setShowAddModal] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const handleDieselUpdate = useCallback((surchargePercent) => {
    setMarketIndices(prev => ({ ...prev, fuelSurchargeDelta: surchargePercent }));
  }, []);

  const { diesel, laneRates } = useMarketData(projects, handleDieselUpdate);
  const [exportingPDF, setExportingPDF] = useState(false);
  const presentationRef = useRef(null);
  const [newProject, setNewProject] = useState({
    name: '', origin: '', destination: '', quoteDate: '', originalCost: '', currentMargin: '', volume: '', status: 'stable'
  });
  const [marketIndices, setMarketIndices] = useState({
    fuelSurchargeDelta: 18.4,
    laneVolatilityIndex: 12.2,
    avgPortDelayDays: 6,
    portCostImpact: 450,
    datIQLanePremium: 15
  });

  const selectedProject = useMemo(() =>
    projects.find(p => p.id === selectedProjectId) || projects[0]
  , [selectedProjectId, projects]);

  const calculateErosion = (project) => {
    const live = laneRates[project.id];
    // If we have a live DAT spot rate, use the delta vs awarded cost as the lane premium
    // Otherwise fall back to the manual datIQLanePremium %
    let datPremiumVal;
    if (live?.spot?.perTrip && live.spot.perTrip > project.originalCost) {
      datPremiumVal = live.spot.perTrip - project.originalCost;
    } else {
      datPremiumVal = project.originalCost * (marketIndices.datIQLanePremium / 100);
    }
    const fuelImpact = project.originalCost * (marketIndices.fuelSurchargeDelta / 100);
    const totalCurrentCost = project.originalCost + datPremiumVal + fuelImpact + marketIndices.portCostImpact;
    const dollarErosion = totalCurrentCost - project.originalCost;
    const marginErosion = (dollarErosion / project.originalCost) * 100;

    return {
      dollarErosion,
      totalCurrentCost,
      newMargin: project.currentMargin - marginErosion,
      usingLiveRate: !!(live?.spot?.perTrip),
    };
  };

  const aggregateData = useMemo(() => {
    let totalPortfolioErosion = 0;
    projects.forEach(p => {
      const { dollarErosion } = calculateErosion(p);
      totalPortfolioErosion += (dollarErosion * p.volume);
    });
    return { totalPortfolioErosion };
  }, [projects, marketIndices]);

  const handleExportPDF = async () => {
    if (!presentationRef.current) return;
    setExportingPDF(true);
    try {
      const canvas = await html2canvas(presentationRef.current, {
        scale: 2,
        backgroundColor: '#020617',
        useCORS: true,
        logging: false,
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [canvas.width / 2, canvas.height / 2] });
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width / 2, canvas.height / 2);
      pdf.save(`${selectedProject.name.replace(/\s+/g, '-')}-erosion-audit.pdf`);
    } finally {
      setExportingPDF(false);
    }
  };

  const handleAddProject = () => {
    if (!newProject.name || !newProject.origin || !newProject.destination || !newProject.originalCost) return;
    setProjects(prev => [...prev, {
      ...newProject,
      id: Date.now().toString(),
      originalCost: Number(newProject.originalCost),
      currentMargin: Number(newProject.currentMargin) || 20,
      volume: Number(newProject.volume) || 1,
    }]);
    setNewProject({ name: '', origin: '', destination: '', quoteDate: '', originalCost: '', currentMargin: '', volume: '', status: 'stable' });
    setShowAddModal(false);
  };

  const handleDeleteProject = (id, e) => {
    e.stopPropagation();
    setProjects(prev => prev.filter(p => p.id !== id));
    if (selectedProjectId === id) setSelectedProjectId(projects[0]?.id);
  };

  const SidebarItem = ({ icon: Icon, label, active, onClick }) => (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all mb-1 ${active ? 'bg-emerald-500 text-slate-950 font-bold shadow-lg shadow-emerald-500/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
      <Icon size={20} />
      <span className="text-sm uppercase tracking-tight font-bold">{label}</span>
    </button>
  );

  const StatCard = ({ label, value, subValue, icon: Icon, colorClass }) => (
    <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl">
      <div className="flex justify-between items-start mb-2">
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</span>
        <Icon className={`${colorClass} w-5 h-5 opacity-70`} />
      </div>
      <div className={`text-3xl font-black ${colorClass}`}>{value}</div>
      <div className="text-[10px] text-slate-500 font-bold mt-1 uppercase tracking-tighter">{subValue}</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex" style={{fontFamily: 'Inter, system-ui, sans-serif'}}>
      {/* Mobile Header Bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-slate-950 border-b border-slate-900 flex items-center justify-between px-5 z-[150]">
        <h1 className="text-xl font-black italic tracking-tighter flex items-center gap-2 text-white">
          <div className="w-7 h-7 bg-emerald-500 rounded flex items-center justify-center text-slate-950 font-black text-sm">E</div>
          SENTINEL
        </h1>
        <button onClick={() => setMobileNavOpen(true)} className="p-2 text-slate-400 hover:text-white transition-colors">
          <Menu size={22} />
        </button>
      </div>

      {/* Mobile Nav Overlay */}
      {mobileNavOpen && (
        <div className="lg:hidden fixed inset-0 z-[160] flex">
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={() => setMobileNavOpen(false)} />
          <div className="relative w-72 bg-slate-950 border-r border-slate-900 h-full p-6 flex flex-col shadow-2xl">
            <div className="flex justify-between items-center mb-10">
              <h1 className="text-2xl font-black italic tracking-tighter flex items-center gap-2 text-white">
                <div className="w-7 h-7 bg-emerald-500 rounded flex items-center justify-center text-slate-950 font-black text-sm">E</div>
                SENTINEL
              </h1>
              <button onClick={() => setMobileNavOpen(false)} className="p-1.5 text-slate-500 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>
            <nav className="flex-1">
              <SidebarItem icon={LayoutDashboard} label="Command Center" active={view === 'dashboard'} onClick={() => { setView('dashboard'); setMobileNavOpen(false); }} />
              <SidebarItem icon={FileText} label="Project Audit" active={view === 'audit'} onClick={() => { setView('audit'); setMobileNavOpen(false); }} />
              <SidebarItem icon={Presentation} label="Client Mode" active={view === 'presentation'} onClick={() => { setView('presentation'); setMobileNavOpen(false); }} />
            </nav>
            <div className="mt-auto space-y-4 pt-8 border-t border-slate-900">
              <SidebarItem icon={Settings} label="Market Logic" active={view === 'settings'} onClick={() => { setView('settings'); setMobileNavOpen(false); }} />
              <div className="bg-slate-900/50 p-4 rounded-3xl border border-slate-900 text-center">
                <div className="text-[10px] text-emerald-500 font-black uppercase tracking-widest">Dan Deigan Verified</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Navigation Sidebar */}
      <aside className="hidden lg:flex flex-col w-72 border-r border-slate-900 h-screen sticky top-0 p-6 bg-slate-950/50 backdrop-blur-xl z-50">
        <div className="mb-12 px-2">
          <h1 className="text-3xl font-black italic tracking-tighter flex items-center gap-2 text-white">
            <div className="w-8 h-8 bg-emerald-500 rounded flex items-center justify-center text-slate-950 font-black">E</div>
            SENTINEL
          </h1>
          <div className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] mt-1 ml-10">Pro Edition</div>
        </div>
        <nav className="flex-1">
          <SidebarItem icon={LayoutDashboard} label="Command Center" active={view === 'dashboard'} onClick={() => setView('dashboard')} />
          <SidebarItem icon={FileText} label="Project Audit" active={view === 'audit'} onClick={() => setView('audit')} />
          <SidebarItem icon={Presentation} label="Client Mode" active={view === 'presentation'} onClick={() => setView('presentation')} />
        </nav>
        <div className="mt-auto space-y-4 pt-8 border-t border-slate-900">
          <SidebarItem icon={Settings} label="Market Logic" active={view === 'settings'} onClick={() => setView('settings')} />
          <div className="bg-slate-900/50 p-4 rounded-3xl border border-slate-900 text-center">
            <div className="text-[10px] text-emerald-500 font-black uppercase tracking-widest">Dan Deigan Verified</div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-6 pt-20 lg:pt-6 md:p-12 lg:p-12 overflow-y-auto">
        <div className="max-w-7xl mx-auto pb-20">

          {/* DASHBOARD */}
          {view === 'dashboard' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard label="Monthly Erosion" value={`$${aggregateData.totalPortfolioErosion.toLocaleString()}`} subValue="Total Margin Leakage" icon={TrendingDown} colorClass="text-red-500" />
                <StatCard label="Market Volatility" value={`+${marketIndices.laneVolatilityIndex}%`} subValue="National Freight Index" icon={Globe} colorClass="text-blue-400" />
                <StatCard label="Active Projects" value={projects.length} subValue="Live lanes under audit" icon={Database} colorClass="text-emerald-400" />
                <StatCard label="Carrier Trust" value="42%" subValue="Gouge Alert Threshold" icon={AlertTriangle} colorClass="text-orange-400" />
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
                <div className="p-8 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 backdrop-blur-md">
                  <h2 className="text-2xl font-black uppercase italic tracking-tighter text-white">Current Project Backlog</h2>
                  <button onClick={() => setShowAddModal(true)} className="p-3 bg-emerald-500 text-slate-950 rounded-xl hover:scale-105 transition-transform shadow-lg shadow-emerald-500/20">
                    <Plus size={20} />
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-950 text-slate-500 text-[11px] uppercase font-black tracking-widest">
                      <tr>
                        <th className="px-8 py-5">Project / Lane</th>
                        <th className="px-8 py-5">Current Erosion</th>
                        <th className="px-8 py-5">Net Margin %</th>
                        <th className="px-8 py-5">Risk Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {projects.map(p => {
                        const { dollarErosion, newMargin, usingLiveRate } = calculateErosion(p);
                        return (
                          <tr
                            key={p.id}
                            className="hover:bg-slate-800/50 transition-colors cursor-pointer"
                            onClick={() => { setSelectedProjectId(p.id); setView('audit'); }}
                          >
                            <td className="px-8 py-6">
                              <div className="font-bold text-slate-100 text-lg flex items-center gap-2">
                                {p.name}
                                {usingLiveRate && <span className="text-[9px] font-black text-blue-400 bg-blue-400/10 border border-blue-400/30 px-2 py-0.5 rounded-full uppercase tracking-widest">Live DAT</span>}
                              </div>
                              <div className="text-[11px] text-slate-500 uppercase font-black flex items-center gap-2 mt-1 italic tracking-widest">
                                {p.origin} <ArrowRight size={10} className="text-emerald-500" /> {p.destination}
                              </div>
                            </td>
                            <td className="px-8 py-6 font-mono text-red-400 font-black text-lg">
                              -${(dollarErosion * p.volume).toLocaleString()}
                            </td>
                            <td className={`px-8 py-6 font-mono font-black text-lg ${newMargin < 10 ? 'text-red-500' : 'text-orange-400'}`}>
                              {newMargin.toFixed(1)}%
                            </td>
                            <td className="px-8 py-6">
                              <div className="flex items-center gap-3">
                                <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                                  p.status === 'critical' ? 'bg-red-500/20 text-red-500 border-red-500' :
                                  p.status === 'at-risk' ? 'bg-orange-500/20 text-orange-500 border-orange-500' :
                                  'bg-emerald-500/20 text-emerald-500 border-emerald-500'
                                }`}>
                                  {p.status}
                                </span>
                                <button onClick={(e) => handleDeleteProject(p.id, e)} className="p-1.5 text-slate-600 hover:text-red-500 transition-colors rounded-lg hover:bg-red-500/10">
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* AUDIT */}
          {view === 'audit' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="space-y-6">
                <button onClick={() => setView('dashboard')} className="text-xs text-slate-500 hover:text-white uppercase font-black flex items-center gap-1 group">
                  <ChevronRight size={14} className="rotate-180 group-hover:text-emerald-500 transition-colors" /> Back to Backlog
                </button>
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-8">
                  <div>
                    <h2 className="text-3xl font-black uppercase mb-1 tracking-tighter italic border-l-4 border-emerald-500 pl-4 text-white">{selectedProject.name}</h2>
                    <p className="text-xs text-slate-500 uppercase font-black mt-2 tracking-widest flex items-center gap-2 italic">
                      {selectedProject.origin} <ArrowRight size={12} className="text-emerald-500" /> {selectedProject.destination}
                    </p>
                  </div>
                  <div className="space-y-4 font-mono">
                    <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800">
                      <div className="text-[10px] text-slate-500 font-black uppercase mb-1">Award Date Rate</div>
                      <div className="text-2xl font-black text-white">${selectedProject.originalCost}</div>
                    </div>
                    <div className="bg-slate-950 p-6 rounded-2xl border border-red-500/20">
                      <div className="text-[10px] text-red-500 font-black uppercase mb-1">Execution Cost (2026)</div>
                      <div className="text-2xl font-black text-red-500">${calculateErosion(selectedProject).totalCurrentCost.toFixed(0)}</div>
                    </div>
                  </div>
                </div>
                {/* Live DAT Rate Cards */}
                {(() => {
                  const live = laneRates[selectedProject.id];
                  const synced = !!live;
                  return (
                    <div className="space-y-3">
                      {/* Spot Rate */}
                      <div className={`bg-slate-950 p-5 rounded-2xl border ${synced ? 'border-blue-500/30' : 'border-slate-800'}`}>
                        <div className="text-[10px] text-blue-400 font-black uppercase mb-1 flex items-center gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full ${synced ? 'bg-blue-400 animate-pulse' : 'bg-slate-600'}`}></div>
                          DAT Spot Rate (8-Day)
                        </div>
                        {synced && live.spot ? (
                          <>
                            <div className="text-2xl font-black text-blue-400">
                              ${live.spot.perTrip?.toLocaleString() ?? '—'} <span className="text-sm font-bold text-slate-500">/ trip</span>
                            </div>
                            <div className="text-xs text-slate-500 font-bold mt-0.5">
                              {live.spot.perMile ? `$${live.spot.perMile.toFixed(2)}/mi` : ''}{live.spot.mileage ? ` · ${live.spot.mileage.toLocaleString()} mi` : ''}
                              {live.spot.maeLow && live.spot.maeHigh ? ` · MAE $${live.spot.maeLow}–$${live.spot.maeHigh}` : ''}
                            </div>
                          </>
                        ) : (
                          <div className="text-sm text-slate-600 font-bold animate-pulse">Fetching spot rate...</div>
                        )}
                      </div>
                      {/* Contract Rate */}
                      <div className={`bg-slate-950 p-5 rounded-2xl border ${synced ? 'border-purple-500/30' : 'border-slate-800'}`}>
                        <div className="text-[10px] text-purple-400 font-black uppercase mb-1 flex items-center gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full ${synced ? 'bg-purple-400 animate-pulse' : 'bg-slate-600'}`}></div>
                          DAT Contract Rate (52-Week)
                        </div>
                        {synced && live.contract ? (
                          <>
                            <div className="text-2xl font-black text-purple-400">
                              ${live.contract.perTrip?.toLocaleString() ?? '—'} <span className="text-sm font-bold text-slate-500">/ trip</span>
                            </div>
                            <div className="text-xs text-slate-500 font-bold mt-0.5">
                              {live.contract.perMile ? `$${live.contract.perMile.toFixed(2)}/mi` : ''}
                              {live.contract.maeLow && live.contract.maeHigh ? ` · MAE $${live.contract.maeLow}–$${live.contract.maeHigh}` : ''}
                            </div>
                          </>
                        ) : (
                          <div className="text-sm text-slate-600 font-bold animate-pulse">Fetching contract rate...</div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                <button
                  onClick={() => setView('presentation')}
                  className="w-full py-5 bg-emerald-500 text-slate-950 font-black rounded-2xl uppercase shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition-all text-sm tracking-tighter"
                >
                  Launch Negotiation View
                </button>
              </div>

              <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-10 h-[550px] shadow-2xl flex flex-col">
                <div className="flex justify-between items-center mb-10">
                  <h3 className="text-xl font-black uppercase italic tracking-tighter text-white">Profit Integrity Audit</h3>
                  <div className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div> Quote Status: Validated
                  </div>
                </div>
                <div className="flex-1 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[
                      { name: 'AWARDED', margin: selectedProject.currentMargin },
                      { name: 'REALITY', margin: calculateErosion(selectedProject).newMargin }
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} tick={{ fontWeight: 900 }} />
                      <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                      <Tooltip
                        cursor={{ fill: '#1e293b' }}
                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '16px', fontWeight: 900 }}
                      />
                      <Bar dataKey="margin" radius={[16, 16, 0, 0]} barSize={120}>
                        <Cell fill="#10b981" />
                        <Cell fill="#ef4444" />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* CLIENT MODE / PRESENTATION */}
          {view === 'presentation' && (
            <div ref={presentationRef} className="max-w-5xl mx-auto space-y-12 py-12">
              <div className="flex justify-between items-end border-b-8 border-emerald-500 pb-10">
                <div>
                  <div className="text-xs font-black text-emerald-500 uppercase tracking-widest mb-2">Internal Margin Protection Audit</div>
                  <h1 className="text-7xl font-black uppercase italic tracking-tighter text-white">{selectedProject.name}</h1>
                  <p className="text-slate-500 text-lg mt-2 font-black uppercase tracking-[0.3em] italic">Market Dynamics Review • Q1 2026</p>
                </div>
                <div className="text-right pb-2">
                  <ShieldCheck size={48} className="text-emerald-500 ml-auto mb-2" />
                  <div className="text-[11px] font-black text-slate-500 uppercase">Audit Verified</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="bg-slate-900 border border-slate-800 p-12 rounded-[3rem] text-center shadow-2xl relative overflow-hidden group">
                  <Fuel size={120} className="absolute -bottom-10 -right-10 text-slate-800 opacity-50 group-hover:text-red-500 group-hover:opacity-20 transition-all duration-700" />
                  <div className="text-xs font-black text-slate-400 uppercase mb-4 tracking-widest">Fuel Index Volatility</div>
                  <div className="text-8xl font-black text-red-500 tracking-tighter">+{marketIndices.fuelSurchargeDelta}%</div>
                  <p className="text-sm text-slate-500 mt-4 uppercase font-black italic">Market Change since {selectedProject.quoteDate}</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-12 rounded-[3rem] text-center shadow-2xl relative overflow-hidden group">
                  <Globe size={120} className="absolute -bottom-10 -right-10 text-slate-800 opacity-50 group-hover:text-orange-500 group-hover:opacity-20 transition-all duration-700" />
                  <div className="text-xs font-black text-slate-400 uppercase mb-4 tracking-widest">Capacity Availability</div>
                  <div className="text-8xl font-black text-orange-400 tracking-tighter">-{marketIndices.laneVolatilityIndex}%</div>
                  <p className="text-sm text-slate-500 mt-4 uppercase font-black italic">National Fleet Liquidity</p>
                </div>
              </div>

              <div className="bg-slate-900 border-4 border-emerald-500 rounded-[4rem] p-20 text-center shadow-2xl">
                <div className="text-[11px] font-black text-emerald-500 uppercase mb-4 tracking-[0.5em]">Required Recovery Adjustment</div>
                <div className="text-[10rem] font-black text-white italic tracking-tighter leading-none">
                  ${calculateErosion(selectedProject).dollarErosion.toFixed(0)}
                </div>
                <p className="text-xl text-slate-400 mt-8 font-black italic uppercase tracking-widest opacity-70">Adjusted Spot Premium per Unit (FLE)</p>
              </div>

              <div className="flex justify-center gap-6">
                <button onClick={() => setView('audit')} className="px-12 py-5 border-2 border-slate-700 rounded-2xl text-xs font-black uppercase hover:bg-white hover:text-slate-950 transition-all shadow-xl">
                  Exit Client View
                </button>
                <button
                  onClick={handleExportPDF}
                  disabled={exportingPDF}
                  className="px-12 py-5 bg-white text-slate-950 rounded-2xl text-xs font-black uppercase hover:bg-emerald-500 transition-all shadow-2xl disabled:opacity-50 disabled:cursor-wait"
                >
                  {exportingPDF ? 'Generating...' : 'Download Evidence (PDF)'}
                </button>
              </div>
            </div>
          )}

          {/* SETTINGS */}
          {view === 'settings' && (
            <div className="max-w-xl mx-auto bg-slate-900 border border-slate-800 rounded-[3rem] p-12 shadow-2xl">
              <h2 className="text-3xl font-black italic uppercase mb-10 tracking-tighter flex items-center gap-4 text-emerald-500">
                <Settings size={32} /> Market Data Overrides
              </h2>
              <div className="space-y-10 font-mono text-sm">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase mb-3 block tracking-widest italic">Current Fuel Surcharge (%)</label>
                  <input
                    type="number"
                    className="w-full bg-slate-950 border-2 border-slate-800 rounded-2xl p-5 text-2xl font-black text-white focus:border-emerald-500 focus:outline-none transition-all"
                    value={marketIndices.fuelSurchargeDelta}
                    onChange={(e) => setMarketIndices({ ...marketIndices, fuelSurchargeDelta: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase mb-3 block tracking-widest italic">DAT IQ Spot Lane Premium (%)</label>
                  <input
                    type="number"
                    className="w-full bg-slate-950 border-2 border-slate-800 rounded-2xl p-5 text-2xl font-black text-white focus:border-emerald-500 focus:outline-none transition-all"
                    value={marketIndices.datIQLanePremium}
                    onChange={(e) => setMarketIndices({ ...marketIndices, datIQLanePremium: Number(e.target.value) })}
                  />
                </div>
                <button
                  onClick={() => setView('dashboard')}
                  className="w-full py-6 bg-emerald-500 text-slate-950 font-black rounded-2xl uppercase tracking-tighter hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20 text-lg"
                >
                  Commit Parameters
                </button>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Persistent Live Ticker */}
      <div className="fixed bottom-0 left-0 right-0 h-12 bg-slate-900 border-t border-slate-800 flex items-center px-10 overflow-hidden z-50 backdrop-blur-xl">
        <div className="flex items-center gap-16 whitespace-nowrap text-[11px] font-black uppercase tracking-[0.2em]" style={{animation: 'marquee 35s linear infinite'}}>
          <span className="text-slate-400 flex items-center gap-2">
            <Fuel size={14} className="text-red-500" /> DOE DIESEL:{' '}
            {diesel.loading
              ? <span className="text-slate-500">SYNCING...</span>
              : <span className={parseFloat(diesel.change) >= 0 ? 'text-red-400' : 'text-emerald-400'}>
                  ${diesel.price} ({parseFloat(diesel.change) >= 0 ? '+' : ''}{diesel.change})
                </span>
            }
          </span>
          <span className="text-slate-400 flex items-center gap-2">
            <Globe size={14} className="text-emerald-500" /> DAT IQ BENCHMARK: <span className="text-white">VOLATILITY +12%</span>
          </span>
          <span className="text-slate-400 flex items-center gap-2">
            <Anchor size={14} className="text-orange-500" /> SAVANNAH PORT DWELL: <span className="text-white">6.2 DAYS</span>
          </span>
          <span className="text-emerald-500 font-bold tracking-[0.4em]">SYSTEM STATUS: FULL SYNC ACTIVE</span>
        </div>
      </div>

      {/* Add Project Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[200] flex items-center justify-center p-6">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-10 w-full max-w-lg shadow-2xl">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-black uppercase italic tracking-tighter text-white">New Project Lane</h2>
              <button onClick={() => setShowAddModal(false)} className="p-2 text-slate-500 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              {[
                { label: 'Project Name', key: 'name', placeholder: 'e.g. Acme Corp - Q2 Midwest Move' },
                { label: 'Origin', key: 'origin', placeholder: 'e.g. Savannah, GA' },
                { label: 'Destination', key: 'destination', placeholder: 'e.g. Chicago, IL' },
                { label: 'Quote Date', key: 'quoteDate', placeholder: '', type: 'date' },
                { label: 'Awarded Rate ($)', key: 'originalCost', placeholder: '2450', type: 'number' },
                { label: 'Current Margin (%)', key: 'currentMargin', placeholder: '25', type: 'number' },
                { label: 'Volume (loads)', key: 'volume', placeholder: '10', type: 'number' },
              ].map(({ label, key, placeholder, type }) => (
                <div key={key}>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">{label}</label>
                  <input
                    type={type || 'text'}
                    placeholder={placeholder}
                    value={newProject[key]}
                    onChange={e => setNewProject(p => ({ ...p, [key]: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white font-bold text-sm focus:border-emerald-500 focus:outline-none transition-all placeholder:text-slate-600"
                  />
                </div>
              ))}
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Risk Status</label>
                <select
                  value={newProject.status}
                  onChange={e => setNewProject(p => ({ ...p, status: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white font-bold text-sm focus:border-emerald-500 focus:outline-none transition-all"
                >
                  <option value="stable">Stable</option>
                  <option value="at-risk">At Risk</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>
            <div className="flex gap-4 mt-8">
              <button onClick={() => setShowAddModal(false)} className="flex-1 py-4 border border-slate-700 rounded-2xl text-xs font-black uppercase text-slate-400 hover:text-white transition-all">
                Cancel
              </button>
              <button onClick={handleAddProject} className="flex-1 py-4 bg-emerald-500 text-slate-950 rounded-2xl text-xs font-black uppercase hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20">
                Add to Backlog
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
      `}</style>
    </div>
  );
}
