import { supabase } from './supabaseClient';
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const HORARIOS_SEMANA = ["10:00 AM", "11:00 AM", "12:00 PM", "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM", "5:00 PM", "6:00 PM", "7:00 PM"];
const HORARIOS_SABADO = ["10:00 AM", "11:00 AM", "12:00 PM", "1:00 PM", "2:00 PM"];

const SERVICIOS = [
  { id: 'corte', nombre: 'Corte de Autor', precio: '$350', duracion: '45 min' },
  { id: 'barba', nombre: 'Perfilado de Barba', precio: '$250', duracion: '30 min' },
  { id: 'combo', nombre: 'Combo Imperial', precio: '$550', duracion: '75 min' }
];

const BARBEROS = ["David", "Jorge", "Francisco"];
const PIN_SEGURIDAD = "1234";

export default function BarberiaPremium() {
  const [step, setStep] = useState(1);
  const [reserva, setReserva] = useState({ servicio: null, barbero: null, horario: null });
  const [ocupados, setOcupados] = useState([]);
  
  // ESTADOS DEL PRISMA DASHBOARD
  const [modoAdmin, setModoAdmin] = useState(false);
  const [pinIngresado, setPinIngresado] = useState("");
  const [pinCorrecto, setPinCorrecto] = useState(false);
  const [citasDelDia, setCitasDelDia] = useState([]);
  const [errorPin, setErrorPin] = useState(false);

  const [fechaSeleccionada, setFechaSeleccionada] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  });

  // DETECTOR DE URL SECRETA
  useEffect(() => {
    const verificarRutaSecreta = () => {
      if (window.location.hash === '#admin') {
        setModoAdmin(true);
      } else {
        setModoAdmin(false);
        setPinCorrecto(false);
        setPinIngresado("");
      }
    };
    window.addEventListener('hashchange', verificarRutaSecreta);
    verificarRutaSecreta();
    return () => window.removeEventListener('hashchange', verificarRutaSecreta);
  }, []);

  const horariosAMostrar = () => {
    const dia = fechaSeleccionada.getDay();
    if (dia === 0) return []; 
    if (dia === 6) return HORARIOS_SABADO; 
    return HORARIOS_SEMANA;
  };

  const generarProximosDias = () => {
    const dias = [];
    for (let i = 0; i < 7; i++) {
      const fecha = new Date();
      fecha.setDate(fecha.getDate() + i);
      dias.push(fecha);
    }
    return dias;
  };

  const esBloqueado = (horaTexto) => {
    const ahora = new Date();
    const hoyReal = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
    const fechaSel = new Date(fechaSeleccionada.getFullYear(), fechaSeleccionada.getMonth(), fechaSeleccionada.getDate());

    if (fechaSel < hoyReal) return true;

    if (fechaSel.getTime() === hoyReal.getTime()) {
      let [h, m] = horaTexto.split(':');
      let horaNum = parseInt(h);
      if (horaTexto.includes('PM') && horaNum !== 12) horaNum += 12;
      if (horaTexto.includes('AM') && horaNum === 12) horaNum = 0;
      
      if (horaNum <= ahora.getHours()) return true;
    }
    return ocupados.includes(horaTexto);
  };

  // CONSULTA A SUPABASE (Ahora busca por barbero)
  useEffect(() => {
    const obtenerDatos = async () => {
      setOcupados([]); 
      const anio = fechaSeleccionada.getFullYear();
      const mes = String(fechaSeleccionada.getMonth() + 1).padStart(2, '0');
      const dia = String(fechaSeleccionada.getDate()).padStart(2, '0');
      const fechaFiltro = `${anio}-${mes}-${dia}`;
      
      let query = supabase.from('citas').select('*').eq('fecha', fechaFiltro);
      
      // Filtramos por barbero solo si estamos en la vista del cliente
      if (!modoAdmin && reserva.barbero) {
        query = query.eq('barbero', reserva.barbero);
      }

      const { data, error } = await query;
      if (data) {
        setCitasDelDia(data);
        if (!modoAdmin) setOcupados(data.map(c => c.horario));
      }
    };
    obtenerDatos();
  }, [fechaSeleccionada, reserva.barbero, modoAdmin]);

  const manejarLoginAdmin = (e) => {
    e.preventDefault();
    if (pinIngresado === PIN_SEGURIDAD) {
      setPinCorrecto(true);
      setErrorPin(false);
    } else {
      setErrorPin(true);
      setPinIngresado("");
    }
  };

  const calcularIngresosDelDia = () => {
  // Filtramos para que solo sume las citas que pertenecen a nuestros 3 barberos activos
  const citasFiltradas = citasDelDia.filter(cita => BARBEROS.includes(cita.barbero));
  
  return citasFiltradas.reduce((total, cita) => {
    const servicioEncontrado = SERVICIOS.find(s => s.nombre === cita.servicio);
    const precioNum = servicioEncontrado ? parseInt(servicioEncontrado.precio.replace('$', '')) : 350;
    return total + precioNum;
  }, 0);
};

  const finalizarCita = async () => {
    if (!reserva.servicio || !reserva.horario || !reserva.barbero) return;
    const fechaFinal = fechaSeleccionada.toISOString().split('T')[0];

    const { error } = await supabase.from('citas').insert([
      { 
        servicio: reserva.servicio.nombre, 
        horario: reserva.horario, 
        fecha: fechaFinal,
        barbero: reserva.barbero 
      }
    ]);

    if (error) {
      console.error("Error Supabase:", error);
      alert("Error al guardar, intenta de nuevo.");
      return;
    }

    const numeroTelefono = "523310942397";
    const texto = `¡Hola! 👋 Quiero agendar una cita:\n📌 *Servicio:* ${reserva.servicio.nombre}\n🪒 *Barbero:* ${reserva.barbero}\n📅 *Fecha:* ${fechaFinal}\n⏰ *Horario:* ${reserva.horario}`;
    window.open(`https://wa.me/${numeroTelefono}?text=${encodeURIComponent(texto)}`, '_blank');
  };

  // ==========================================
  // VISTA 2: PRISMA DASHBOARD (PANTALLA DE ADMIN)
  // ==========================================
  if (modoAdmin) {
    if (!pinCorrecto) {
      return (
        <div className="bg-[#121212] min-h-screen flex items-center justify-center font-sans p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-[#1a1a1a] border border-white/10 p-8 rounded-2xl w-full max-w-sm text-center shadow-2xl">
            <div className="text-xl font-black text-white mb-2">PRISMA<span className="text-[#d4af37]">DASHBOARD</span></div>
            <p className="text-[9px] uppercase tracking-widest text-[#d4af37] mb-8">Acceso exclusivo para empleados</p>
            <form onSubmit={manejarLoginAdmin} className="space-y-4">
              <input 
                type="password" maxLength={4} placeholder="INGRESAR PIN" 
                value={pinIngresado} onChange={(e) => setPinIngresado(e.target.value.replace(/\D/g, ''))}
                className="w-full bg-black/50 border border-white/10 text-center text-xl tracking-[0.5em] font-black text-[#d4af37] py-4 rounded-xl focus:outline-none focus:border-[#d4af37] transition-all"
              />
              {errorPin && <p className="text-red-500 text-[10px] uppercase font-bold tracking-wider">PIN Incorrecto.</p>}
              <button type="submit" className="w-full bg-[#d4af37] text-black text-xs font-black uppercase py-4 rounded-xl hover:bg-white transition-all">Entrar al Sistema</button>
            </form>
            <button onClick={() => { window.location.hash = ""; }} className="text-[9px] text-white/30 uppercase tracking-widest mt-6 hover:text-white underline block mx-auto">Regresar al sitio web</button>
          </motion.div>
        </div>
      );
    }

    return (
      <div className="bg-[#121212] text-[#f5f5f5] min-h-screen font-sans p-6">
        <nav className="flex justify-between items-center mb-10 border-b border-white/10 pb-6">
          <div>
            <div className="text-2xl font-black tracking-tighter text-white">PRISMA<span className="text-[#d4af37]">DASHBOARD</span></div>
            <p className="text-[10px] text-[#d4af37] tracking-[0.2em] uppercase mt-1">Ecosistema Multi-Barbero</p>
          </div>
          <button onClick={() => { window.location.hash = ""; }} className="text-xs uppercase font-bold text-white/50 hover:text-white border border-white/20 px-4 py-2 rounded-lg">Cerrar Sesión</button>
        </nav>
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-end mb-10">
            <div>
              <h2 className="text-3xl font-black uppercase tracking-tighter">Panel de Agendas</h2>
              <p className="text-xs text-white/40 uppercase tracking-wider mt-1">Fecha seleccionada: {fechaSeleccionada.toISOString().split('T')[0]}</p>
            </div>
            <div className="bg-white/5 px-6 py-3 rounded-xl border border-white/10 text-center">
              <span className="block text-[10px] text-white/40 uppercase tracking-widest">Caja Estimada Hoy</span>
              <span className="text-xl text-[#d4af37] font-black">${calcularIngresosDelDia()} MXN</span>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {BARBEROS.map((barbero) => {
              const citasDelBarbero = citasDelDia.filter(c => c.barbero === barbero);
              return (
                <div key={barbero} className="bg-white/5 border border-white/5 rounded-2xl p-4 flex flex-col min-h-[500px]">
                  <div className="flex justify-between items-center border-b border-white/10 pb-3 mb-4">
                    <h3 className="text-lg font-black uppercase tracking-wide text-white flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#d4af37]"></span> Sillas de {barbero}
                    </h3>
                    <span className="bg-white/10 text-white/70 px-2.5 py-0.5 rounded-full text-[10px] font-bold">{citasDelBarbero.length} citas</span>
                  </div>
                  <div className="space-y-3 flex-1 overflow-y-auto">
                    {citasDelBarbero.length === 0 ? (
                      <div className="h-full flex items-center justify-center border border-dashed border-white/5 rounded-xl py-12">
                        <p className="text-[10px] text-white/20 uppercase tracking-widest">Sin citas asignadas</p>
                      </div>
                    ) : (
                      citasDelBarbero.map((cita, idx) => (
                        <div key={idx} className="bg-black/40 border border-white/10 p-5 rounded-xl relative overflow-hidden group hover:border-[#d4af37]/40 transition-all">
                          <div className="flex justify-between items-start mb-3">
                            <span className="bg-[#d4af37]/10 text-[#d4af37] px-2 py-0.5 rounded text-[10px] font-black tracking-wider">{cita.horario}</span>
                          </div>
                          <h4 className="font-bold text-sm uppercase text-white">{cita.servicio}</h4>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // VISTA 1: SITIO WEB (VISTA CLIENTE)
  // ==========================================
  return (
    <div className="bg-[#121212] text-[#f5f5f5] min-h-screen font-sans selection:bg-[#d4af37] selection:text-black">
      <nav className="fixed w-full z-50 bg-black/90 backdrop-blur-md border-b border-white/5 px-6 py-5">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="text-2xl font-black tracking-tighter text-white">VINTAGE<span className="text-[#d4af37]">STUDIO</span></div>
          <a href="#reservar" className="text-[10px] font-bold uppercase tracking-widest text-[#d4af37] border border-[#d4af37]/30 px-4 py-2 hover:bg-[#d4af37] hover:text-black transition-all">Agendar Cita</a>
        </div>
      </nav>

      {/* 1. HERO SECTION */}
      <section className="relative h-[90vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img src="https://images.unsplash.com/photo-1503951914875-452162b0f3f1?q=80&w=2000" className="w-full h-full object-cover opacity-40 scale-105" alt="Barber Shop" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#121212] via-transparent to-black/60"></div>
        </div>
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1 }} className="relative z-10 text-center px-4">
          <span className="text-[#d4af37] tracking-[0.5em] uppercase text-xs font-black mb-6 block">Master Barber & Grooming</span>
          <h2 className="text-6xl md:text-[100px] font-black uppercase leading-[0.8] tracking-tighter mb-8">Estilo sin <br/> <span className="text-[#d4af37] italic font-light lowercase">esperas.</span></h2>
          <a href="#reservar" className="bg-[#d4af37] text-black px-12 py-5 font-black uppercase text-xs tracking-[0.2em] hover:bg-white transition-all shadow-xl shadow-[#d4af37]/20">Reservar lugar</a>
        </motion.div>
      </section>

      {/* 2. SECCIÓN DE GALERÍA DE CORTES (RESTAURADA) */}
      <section className="py-20 px-6 bg-black">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black uppercase tracking-tighter text-white">Nuestra <span className="text-[#d4af37]">Firma</span></h2>
            <p className="text-white/30 uppercase text-[10px] tracking-[0.4em] font-bold italic mt-2">Conoce nuestro trabajo</p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <motion.div className="rounded-xl border border-white/5 overflow-hidden group shadow-xl shadow-black/30 relative h-[350px]" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} viewport={{ once: true }}>
              <img src="https://images.unsplash.com/photo-1599351431202-1e0f0137899a?q=80&w=1000" className="w-full h-full object-cover transition duration-1000 group-hover:scale-110" alt="Corte de Autor" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent p-6 flex flex-col justify-end">
                <span className="text-white font-bold uppercase text-lg">Corte de Autor</span>
                <span className="text-[#d4af37] text-[10px] uppercase tracking-widest mt-1">Precisión</span>
              </div>
            </motion.div>
            <motion.div className="rounded-xl border border-white/5 overflow-hidden group shadow-xl shadow-black/30 relative h-[350px]" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }} viewport={{ once: true }}>
              <img src="https://images.pexels.com/photos/22610337/pexels-photo-22610337.jpeg" className="w-full h-full object-cover transition duration-1000 group-hover:scale-110" alt="Ritual de Barba" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent p-6 flex flex-col justify-end">
                <span className="text-white font-bold uppercase text-lg">Ritual Barba</span>
                <span className="text-[#d4af37] text-[10px] uppercase tracking-widest mt-1">Tradición</span>
              </div>
            </motion.div>
            <motion.div className="rounded-xl border border-white/5 overflow-hidden group shadow-xl shadow-black/30 relative h-[350px]" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }} viewport={{ once: true }}>
              <img src="https://images.pexels.com/photos/7781848/pexels-photo-7781848.jpeg" className="w-full h-full object-cover transition duration-1000 group-hover:scale-110" alt="Estilo Moderno" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent p-6 flex flex-col justify-end">
                <span className="text-white font-bold uppercase text-lg">Modern Style</span>
                <span className="text-[#d4af37] text-[10px] uppercase tracking-widest mt-1">Tendencia</span>
              </div>
            </motion.div>
            <motion.div className="rounded-xl border border-white/5 overflow-hidden group shadow-xl shadow-black/30 relative h-[350px]" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }} viewport={{ once: true }}>
              <img src="https://images.unsplash.com/photo-1503951914875-452162b0f3f1?q=80&w=600" className="w-full h-full object-cover transition duration-1000 group-hover:scale-110" alt="Afeitado Clásico" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent p-6 flex flex-col justify-end">
                <span className="text-white font-bold uppercase text-lg">Afeitado Pro</span>
                <span className="text-[#d4af37] text-[10px] uppercase tracking-widest mt-1">Hot Towel</span>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* 3. FUNNEL DE RESERVAS (4 PASOS) */}
      <section id="reservar" className="py-32 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black uppercase tracking-tighter mb-4 text-[#d4af37]">Reserva tu Experiencia</h2>
            <p className="text-white/30 uppercase text-[10px] tracking-[0.4em] font-bold italic">Selección en vivo</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-sm shadow-2xl">
            <div className="flex border-b border-white/10">
              {[1, 2, 3, 4].map((num) => (
                <div key={num} className={`flex-1 h-1 transition-all duration-700 ${step >= num ? 'bg-[#d4af37]' : 'bg-white/10'}`} />
              ))}
            </div>
            <div className="p-8 md:p-12">
              <AnimatePresence mode="wait">
                
                {/* PASO 1: SERVICIO */}
                {step === 1 && (
                  <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                    <h3 className="text-xs font-black uppercase tracking-[0.3em] text-white/40 mb-8">Paso 1: Selecciona el Servicio</h3>
                    <div className="grid gap-4">
                      {SERVICIOS.map((s) => (
                        <button key={s.id} onClick={() => { setReserva({ ...reserva, servicio: s }); setStep(2); }} className="flex justify-between items-center p-6 bg-white/5 border border-white/5 hover:border-[#d4af37] hover:bg-[#d4af37]/5 transition-all text-left group">
                          <div>
                            <p className="font-bold uppercase text-lg group-hover:text-[#d4af37]">{s.nombre}</p>
                            <p className="text-[10px] text-white/30 uppercase tracking-widest">{s.duracion}</p>
                          </div>
                          <span className="text-[#d4af37] font-black">{s.precio}</span>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* PASO 2: BARBERO */}
                {step === 2 && (
                  <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                    <h3 className="text-xs font-black uppercase tracking-[0.3em] text-white/40 mb-8">Paso 2: Selecciona tu Barbero</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {BARBEROS.map((barbero) => (
                        <button key={barbero} onClick={() => { setReserva({ ...reserva, barbero: barbero }); setStep(3); }} className="p-8 bg-white/5 border border-white/5 hover:border-[#d4af37] hover:bg-[#d4af37]/5 text-center transition-all rounded-xl group">
                          <div className="w-12 h-12 rounded-full bg-white/10 mx-auto flex items-center justify-center font-black text-lg text-[#d4af37] group-hover:bg-[#d4af37] group-hover:text-black transition-all mb-4">{barbero[0]}</div>
                          <p className="font-bold uppercase tracking-wide text-white">{barbero}</p>
                        </button>
                      ))}
                    </div>
                    <button onClick={() => setStep(1)} className="mt-8 text-[9px] uppercase tracking-widest text-white/20 hover:text-white underline block mx-auto">Volver a servicios</button>
                  </motion.div>
                )}

                {/* PASO 3: FECHA Y HORA */}
                {step === 3 && (
                  <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                    <h3 className="text-xs font-black uppercase tracking-[0.3em] text-white/40 mb-4">Paso 3: Horarios Disponibles para {reserva.barbero}</h3>
                    <div className="mb-8">
                      <div className="flex gap-3 overflow-x-auto pb-4 justify-start md:justify-center">
                        {generarProximosDias().map((fecha, index) => {
                          const isSelected = fecha.toDateString() === fechaSeleccionada.toDateString();
                          return (
                            <button key={index} onClick={() => setFechaSeleccionada(fecha)} className={`flex-shrink-0 min-w-[70px] p-3 rounded-xl border transition-all flex flex-col items-center ${isSelected ? "bg-[#d4af37] border-[#d4af37] text-black" : "bg-white/5 border-white/10 text-white/50"}`}>
                              <span className="text-[9px] uppercase font-bold">{fecha.toLocaleDateString('es-MX', { weekday: 'short' }).replace('.', '')}</span>
                              <span className="text-xl font-black my-1">{fecha.getDate()}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {horariosAMostrar().length > 0 ? (
                        horariosAMostrar().map((h) => {
                          const bloqueado = esBloqueado(h);
                          return (
                            <button key={h} disabled={bloqueado} onClick={() => { setReserva({ ...reserva, horario: h }); setStep(4); }} className={`p-4 border border-white/5 font-bold text-xs uppercase transition-all ${bloqueado ? "opacity-20 cursor-not-allowed bg-red-900/10" : "hover:bg-[#d4af37] hover:text-black bg-white/5"}`}>
                              {h} {bloqueado && "•"}
                            </button>
                          );
                        })
                      ) : (
                        <p className="col-span-full text-center text-white/40 py-10 uppercase text-xs tracking-widest">Domingos cerrado</p>
                      )}
                    </div>
                    <button onClick={() => setStep(2)} className="mt-8 text-[9px] uppercase tracking-widest text-white/20 hover:text-white underline block mx-auto">Volver a barberos</button>
                  </motion.div>
                )}

                {/* PASO 4: CONFIRMACIÓN */}
                {step === 4 && (
                  <motion.div key="step4" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-10">
                    <div className="mb-10 space-y-2">
                      <p className="text-[#d4af37] text-[10px] font-black uppercase tracking-[0.4em]">Resumen de tu Turno</p>
                      <h4 className="text-3xl font-black uppercase">{reserva.servicio?.nombre}</h4>
                      <p className="text-sm font-bold uppercase text-white/80">Especialista: <span className="text-[#d4af37]">{reserva.barbero}</span></p>
                      <p className="text-white/40 font-light italic">{fechaSeleccionada.toISOString().split('T')[0]} a las {reserva.horario}</p>
                    </div>
                    <button onClick={finalizarCita} className="w-full md:w-auto bg-[#d4af37] text-black px-12 py-5 font-black uppercase text-xs tracking-[0.2em] hover:bg-white transition-all">
                      Confirmar por WhatsApp
                    </button>
                    <br />
                    <button onClick={() => setStep(3)} className="mt-6 text-[9px] uppercase tracking-widest text-white/20 hover:text-white underline">Cambiar hora</button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-20 px-6 border-t border-white/5 bg-black text-center text-white/20 text-[10px] uppercase tracking-widest">
        <div className="text-xl font-black text-white mb-4">VINTAGE<span className="text-[#d4af37]">STUDIO</span></div>
        <p>© {new Date().getFullYear()} Luxury Grids Automation.</p>
      </footer>
    </div>
  );
}