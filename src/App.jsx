import { supabase } from './supabaseClient';
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
const HORARIOS_SEMANA = ["10:00 AM", "11:00 AM", "12:00 PM", "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM", "5:00 PM", "6:00 PM", "7:00 PM"];
const HORARIOS_SABADO = ["10:00 AM", "11:00 AM", "12:00 PM", "1:00 PM", "2:00 PM"];

// CONFIGURACIÓN DE LA SECRETARIA (Fácil de editar)
const SERVICIOS = [
  { id: 'corte', nombre: 'Corte de Autor', precio: '$350', duracion: '45 min' },
  { id: 'barba', nombre: 'Perfilado de Barba', precio: '$250', duracion: '30 min' },
  { id: 'combo', nombre: 'Combo Imperial', precio: '$550', duracion: '75 min' }
];

const HORARIOS = ["10:00 AM", "11:00 AM", "12:00 PM", "1:00 PM", "4:00 PM", "5:00 PM", "6:00 PM"];

export default function BarberiaPremium() {
  const [step, setStep] = useState(1);
  const [reserva, setReserva] = useState({ servicio: null, horario: null });

  
  const [ocupados, setOcupados] = useState([]);
  // NUEVOS ESTADOS Y LÓGICA
  // Esto fuerza a que la fecha inicial sea "Hoy" sin importar la zona horaria
const [fechaSeleccionada, setFechaSeleccionada] = useState(() => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
});
  const horariosAMostrar = () => {
    const dia = fechaSeleccionada.getDay();
    if (dia === 0) return []; // Domingo cerrado
    if (dia === 6) return HORARIOS_SABADO; // Sábado 10-2
    return HORARIOS_SEMANA; // Lunes-Viernes 10-7
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
  
  // Creamos "Hoy" a las 00:00 para comparar solo fechas
  const hoyReal = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  const fechaSel = new Date(fechaSeleccionada.getFullYear(), fechaSeleccionada.getMonth(), fechaSeleccionada.getDate());

  // 1. Si la fecha elegida es menor a hoy (ayer, antier), bloqueado.
  if (fechaSel < hoyReal) return true;

  // 2. SI Y SOLO SI es HOY, revisamos la hora
  if (fechaSel.getTime() === hoyReal.getTime()) {
    let [h, m] = horaTexto.split(':');
    let horaNum = parseInt(h);
    if (horaTexto.includes('PM') && horaNum !== 12) horaNum += 12;
    if (horaTexto.includes('AM') && horaNum === 12) horaNum = 0;
    
    // Si la hora de la cita es menor o igual a la hora actual, se bloquea
    if (horaNum <= ahora.getHours()) return true;
  }

  // 3. Si no es hoy o es una hora futura de hoy, checamos Supabase
  return ocupados.includes(horaTexto);
};
  const hoy = new Date().toISOString().split('T')[0];

 useEffect(() => {
  const obtenerOcupados = async () => {
    setOcupados([]); // Limpiamos siempre al inicio

    // Obtenemos la fecha en formato YYYY-MM-DD local, sin desfases de horas
    const anio = fechaSeleccionada.getFullYear();
    const mes = String(fechaSeleccionada.getMonth() + 1).padStart(2, '0');
    const dia = String(fechaSeleccionada.getDate()).padStart(2, '0');
    const fechaFiltro = `${anio}-${mes}-${dia}`;
    
    console.log("Buscando citas para:", fechaFiltro); // Para que veas en consola qué día busca

    const { data, error } = await supabase
      .from('citas')
      .select('horario')
      .eq('fecha', fechaFiltro);

    if (data) {
      setOcupados(data.map(c => c.horario));
    }
  };

  obtenerOcupados();
}, [fechaSeleccionada]);
  // ... el resto de tus funciones
  // Lógica de automatización de WhatsApp
  // BIEN (Añadimos async)
const finalizarCita = async () => {
  if (!reserva.servicio || !reserva.horario) return;

  const fechaFinal = fechaSeleccionada.toISOString().split('T')[0];

  // 1. Guardamos en Supabase
  const { error } = await supabase.from('citas').insert([
    { 
      servicio: reserva.servicio.nombre, 
      horario: reserva.horario, 
      fecha: fechaFinal 
    }
  ]);

  if (error) {
    console.error("Error Supabase:", error);
    alert("Hubo un error al guardar tu cita, pero puedes contactarnos por WhatsApp.");
    // No detenemos el proceso, dejamos que abra el WhatsApp de todos modos
  }

  // 2. Preparamos el mensaje
  const numeroTelefono = "523310942397"; // <-- CAMBIA ESTO POR TU NÚMERO (sin espacios ni +)
  const texto = `¡Hola! 👋 Quiero agendar una cita:
📌 *Servicio:* ${reserva.servicio.nombre}
📅 *Fecha:* ${fechaFinal}
⏰ *Horario:* ${reserva.horario}`;

  const urlWhatsapp = `https://wa.me/${numeroTelefono}?text=${encodeURIComponent(texto)}`;

  // 3. Abrimos WhatsApp
  // Usamos un pequeño truco para que el navegador no lo bloquee
  const win = window.open(urlWhatsapp, '_blank');
  if (win) {
    win.focus();
  } else {
    // Si el navegador bloqueó la ventana, redirigimos en la misma pestaña
    window.location.href = urlWhatsapp;
  }
};
  return (
    <div className="bg-[#121212] text-[#f5f5f5] min-h-screen font-sans selection:bg-[#d4af37] selection:text-black">
      
      {/* SEO: H1 oculto para buscadores */}
      <h1 className="sr-only">Barbería Premium - Cortes de Autor y Perfilado de Barba en tu Ciudad</h1>

      {/* NAVBAR */}
      <nav className="fixed w-full z-50 bg-black/90 backdrop-blur-md border-b border-white/5 px-6 py-5">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="text-2xl font-black tracking-tighter text-white">
            VINTAGE<span className="text-[#d4af37]">STUDIO</span>
          </div>
          <a href="#reservar" className="text-[10px] font-bold uppercase tracking-widest text-[#d4af37] border border-[#d4af37]/30 px-4 py-2 hover:bg-[#d4af37] hover:text-black transition-all">
            Agendar Ahora
          </a>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section className="relative h-[90vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1503951914875-452162b0f3f1?q=80&w=2000" 
            className="w-full h-full object-cover opacity-40 scale-105"
            alt="Barber Shop Interior"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#121212] via-transparent to-black/60"></div>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 30 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 1 }}
          className="relative z-10 text-center px-4"
        >
          <span className="text-[#d4af37] tracking-[0.5em] uppercase text-xs font-black mb-6 block">Master Barber & Grooming</span>
          <h2 className="text-6xl md:text-[100px] font-black uppercase leading-[0.8] tracking-tighter mb-8">
            Estilo sin <br/> <span className="text-[#d4af37] italic font-light lowercase">esperas.</span>
          </h2>
          <p className="max-w-md mx-auto text-white/50 text-sm mb-10 tracking-wide uppercase font-bold">
            Tu tiempo es lo más valioso. Reserva tu Experiencia en segundos.
          </p>
          <a href="#reservar" className="bg-[#d4af37] text-black px-12 py-5 font-black uppercase text-xs tracking-[0.2em] hover:bg-white transition-all shadow-xl shadow-[#d4af37]/20">
            Reservar lugar
          </a>
        </motion.div>
      </section>

      {/* SECCIÓN AUTOMATIZACIÓN (POR QUÉ NOSOTROS) */}
      <section className="py-24 px-6 bg-[#1a1a1a]">
        <div className="max-w-7xl mx-auto grid md:grid-cols-3 gap-12">
          <div className="space-y-4">
            <div className="text-[#d4af37] text-3xl font-light">01.</div>
            <h3 className="text-xl font-bold uppercase">Sin Mensajes Largos</h3>
            <p className="text-white/40 text-sm leading-relaxed">Elige tu servicio y horario. La secretaria hace el resto. Sin llamadas, sin esperas.</p>
          </div>
          <div className="space-y-4">
            <div className="text-[#d4af37] text-3xl font-light">02.</div>
            <h3 className="text-xl font-bold uppercase">Confirmación Directa</h3>
            <p className="text-white/40 text-sm leading-relaxed">Recibes un mensaje listo para enviar a nuestro WhatsApp oficial con un solo clic.</p>
          </div>
          <div className="space-y-4">
            <div className="text-[#d4af37] text-3xl font-light">03.</div>
            <h3 className="text-xl font-bold uppercase">Recordatorio</h3>
            <p className="text-white/40 text-sm leading-relaxed">Tu cita queda registrada. Respetamos tu puntualidad tanto como tú la nuestra.</p>
          </div>
        </div>
      </section>
      {/* SECCIÓN AUTOMATIZACIÓN (POR QUÉ NOSOTROS) */}
{/* ... (Esta sección se mantiene igual) ... */}

{/* Mosaico de Galería: 4 Imágenes Equilibradas */}
<section className="py-20 px-6 bg-black">
  <div className="max-w-7xl mx-auto">
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      
      {/* Imagen 1: Corte de Autor */}
      <motion.div 
        className="rounded-xl border border-white/5 overflow-hidden group shadow-xl shadow-black/30 relative h-[350px]"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        viewport={{ once: true }}
      >
        <img 
          src="https://images.unsplash.com/photo-1599351431202-1e0f0137899a?q=80&w=1000" 
          className="w-full h-full object-cover transition duration-1000 group-hover:scale-110"
          alt="Corte de Autor"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent p-6 flex flex-col justify-end">
          <span className="text-white font-bold uppercase text-lg">Corte de Autor</span>
          <span className="text-[#d4af37] text-[10px] uppercase tracking-widest mt-1">Precisión</span>
        </div>
      </motion.div>

      {/* Imagen 2: Ritual de Barba */}
      <motion.div 
        className="rounded-xl border border-white/5 overflow-hidden group shadow-xl shadow-black/30 relative h-[350px]"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        viewport={{ once: true }}
      >
        <img 
          src="https://images.pexels.com/photos/22610337/pexels-photo-22610337.jpeg" 
          className="w-full h-full object-cover transition duration-1000 group-hover:scale-110"
          alt="Ritual de Barba"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent p-6 flex flex-col justify-end">
          <span className="text-white font-bold uppercase text-lg">Ritual Barba</span>
          <span className="text-[#d4af37] text-[10px] uppercase tracking-widest mt-1">Tradición</span>
        </div>
      </motion.div>

      {/* Imagen 3: Estilo Moderno */}
      <motion.div 
        className="rounded-xl border border-white/5 overflow-hidden group shadow-xl shadow-black/30 relative h-[350px]"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        viewport={{ once: true }}
      >
        <img 
          src="https://images.pexels.com/photos/7781848/pexels-photo-7781848.jpeg" 
          className="w-full h-full object-cover transition duration-1000 group-hover:scale-110"
          alt="Estilo Moderno"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent p-6 flex flex-col justify-end">
          <span className="text-white font-bold uppercase text-lg">Modern Style</span>
          <span className="text-[#d4af37] text-[10px] uppercase tracking-widest mt-1">Tendencia</span>
        </div>
      </motion.div>

      {/* Imagen 4: NUEVA - Afeitado Clásico */}
      <motion.div 
        className="rounded-xl border border-white/5 overflow-hidden group shadow-xl shadow-black/30 relative h-[350px]"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        viewport={{ once: true }}
      >
        <img 
          src="https://images.unsplash.com/photo-1503951914875-452162b0f3f1?q=80&w=600" 
          className="w-full h-full object-cover transition duration-1000 group-hover:scale-110"
          alt="Afeitado Clásico"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent p-6 flex flex-col justify-end">
          <span className="text-white font-bold uppercase text-lg">Afeitado Pro</span>
          <span className="text-[#d4af37] text-[10px] uppercase tracking-widest mt-1">Hot Towel</span>
        </div>
      </motion.div>

    </div>
  </div>
</section>

      {/* WIZARD DE CITAS (LA SECRETARIA VIRTUAL) */}
      <section id="reservar" className="py-32 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black uppercase tracking-tighter mb-4 text-[#d4af37]">Reserva tu Experiencia</h2>
            <p className="text-white/30 uppercase text-[10px] tracking-[0.4em] font-bold italic">Selecciona para agendar</p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-sm">
            {/* Indicador de pasos */}
            <div className="flex border-b border-white/10">
              {[1, 2, 3].map((num) => (
                <div key={num} className={`flex-1 h-1 transition-all duration-700 ${step >= num ? 'bg-[#d4af37]' : 'bg-white/10'}`} />
              ))}
            </div>

            <div className="p-8 md:p-12">
              <AnimatePresence mode="wait">
                {step === 1 && (
                  <motion.div 
                    key="step1" 
                    initial={{ opacity: 0, x: 20 }} 
                    animate={{ opacity: 1, x: 0 }} 
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <h3 className="text-xs font-black uppercase tracking-[0.3em] text-white/40 mb-8">Paso 1: ¿Qué servicio necesitas?</h3>
                    <div className="grid gap-4">
                      {SERVICIOS.map((s) => (
                        <button 
                          key={s.id}
                          onClick={() => { setReserva({ ...reserva, servicio: s }); setStep(2); }}
                          className="flex justify-between items-center p-6 bg-white/5 border border-white/5 hover:border-[#d4af37] hover:bg-[#d4af37]/5 transition-all text-left group"
                        >
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

                {step === 2 && (
  <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
    <h3 className="text-xs font-black uppercase tracking-[0.3em] text-white/40 mb-4">Paso 2: Elige Fecha y Horario</h3>
    
    {/* NUEVO: Selector de Fecha */}
    <div className="mb-8">
  <label className="text-[10px] uppercase tracking-[0.2em] text-[#d4af37] font-black mb-4 block text-center">
    Selecciona el día
  </label>
  
  {/* Contenedor con scroll horizontal por si son muchos días */}
  <div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar justify-start md:justify-center">
    {generarProximosDias().map((fecha, index) => {
      const isSelected = fecha.toDateString() === fechaSeleccionada.toDateString();
      const diaNombre = fecha.toLocaleDateString('es-MX', { weekday: 'short' }).replace('.', '');
      const diaNumero = fecha.getDate();
      const mesNombre = fecha.toLocaleDateString('es-MX', { month: 'short' }).replace('.', '');

      return (
        <button
          key={index}
          onClick={() => setFechaSeleccionada(fecha)}
          className={`flex-shrink-0 min-w-[70px] p-3 rounded-xl border transition-all flex flex-col items-center
            ${isSelected 
              ? "bg-[#d4af37] border-[#d4af37] text-black shadow-[0_0_15px_rgba(212,175,55,0.3)]" 
              : "bg-white/5 border-white/10 text-white/50 hover:border-white/30"}`}
        >
          <span className="text-[9px] uppercase font-bold">{diaNombre}</span>
          <span className="text-xl font-black my-1">{diaNumero}</span>
          <span className="text-[9px] uppercase font-medium">{mesNombre}</span>
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
            <button 
              key={h}
              disabled={bloqueado}
              onClick={() => { setReserva({ ...reserva, horario: h, fecha: fechaSeleccionada.toISOString().split('T')[0] }); setStep(3); }}
              className={`p-4 border border-white/5 font-bold text-xs uppercase transition-all
                ${bloqueado 
                  ? "opacity-20 cursor-not-allowed bg-red-900/10" 
                  : "hover:bg-[#d4af37] hover:text-black bg-white/5"}`}
            >
              {h} {bloqueado && "•"}
            </button>
          );
        })
      ) : (
        <p className="col-span-full text-center text-white/40 py-10 uppercase text-xs tracking-widest">Domingos cerrado</p>
      )}
    </div>
    <button onClick={() => setStep(1)} className="mt-8 text-[9px] uppercase tracking-widest text-white/20 hover:text-white underline">Volver a servicios</button>
  </motion.div>
)}

                {step === 3 && (
                  <motion.div 
                    key="step3" 
                    initial={{ opacity: 0, scale: 0.95 }} 
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-10"
                  >
                    <div className="mb-10 space-y-2">
                      <p className="text-[#d4af37] text-[10px] font-black uppercase tracking-[0.4em]">Confirmación Lista</p>
                      <h4 className="text-3xl font-black uppercase">{reserva.servicio?.nombre}</h4>
                      <p className="text-white/40 font-light italic">{reserva.horario}</p>
                    </div>
                    
                    <button 
                      onClick={finalizarCita}
                      className="w-full md:w-auto bg-[#d4af37] text-black px-12 py-5 font-black uppercase text-xs tracking-[0.2em] hover:bg-white transition-all"
                    >
                      Confirmar por WhatsApp
                    </button>
                    <br />
                    <button onClick={() => setStep(2)} className="mt-6 text-[9px] uppercase tracking-widest text-white/20 hover:text-white underline">Cambiar hora</button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-20 px-6 border-t border-white/5 bg-black text-center">
        <div className="text-xl font-black mb-6">VINTAGE<span className="text-[#d4af37]">STUDIO</span></div>
        <div className="flex justify-center gap-6 mb-8 text-white/30">
          <a href="#" className="hover:text-[#d4af37] transition-colors uppercase text-[10px] font-bold tracking-widest">Instagram</a>
          <a href="#" className="hover:text-[#d4af37] transition-colors uppercase text-[10px] font-bold tracking-widest">Facebook</a>
        </div>
        <p className="text-[8px] text-white/10 uppercase tracking-[0.5em]">© {new Date().getFullYear()} Luxury Grids Automation</p>
      </footer>
    </div>
  );
}