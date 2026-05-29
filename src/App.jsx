import { supabase } from './supabaseClient';
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import html2pdf from 'html2pdf.js';


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
  const [vistaAdminTab, setVistaAdminTab] = useState("agenda"); // Puede ser "agenda" o "grafica"
  const [ocupados, setOcupados] = useState([]);
  const [datosSemanales, setDatosSemanales] = useState([]); // <-- NUEVO ESTADO PARA GRÁFICA
  const [cargandoGrafica, setCargandoGrafica] = useState(false); // <-- NUEVO ESTADO DE CARGA
  // Agrega estas líneas junto a tus otros estados (useState)
const [menuBarberoAbierto, setMenuBarberoAbierto] = useState(false);
const [menuServicioAbierto, setMenuServicioAbierto] = useState(false);
const [menuPagoAbierto, setMenuPagoAbierto] = useState(false);
  
  // ESTADOS DEL PRISMA DASHBOARD
  const [modoAdmin, setModoAdmin] = useState(false);
  const [pinIngresado, setPinIngresado] = useState("");
  const [pinCorrecto, setPinCorrecto] = useState(false);
  const [citasDelDia, setCitasDelDia] = useState([]);
  const [errorPin, setErrorPin] = useState(false);
  const [barberoLogueado, setBarberoLogueado] = useState(null); // Almacena el nombre del barbero activo
  const [citaEnPago, setCitaEnPago] = useState(null);
  // ESTADOS PARA WALK-IN
  const [mostrarModalWalkIn, setMostrarModalWalkIn] = useState(false);
  const [triggerRecarga, setTriggerRecarga] = useState(0);
  const [formWalkIn, setFormWalkIn] = useState({ 
    cliente: "", 
    servicio: SERVICIOS[0].nombre, 
    barbero: BARBEROS[0], 
    metodoPago: "efectivo" 
  });

  const [fechaSeleccionada, setFechaSeleccionada] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  });

  // REGISTRO AUTOMÁTICO DE LA APP (Va dentro de tu function App)
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(() => console.log("Ecosistema PWA Prisma Activo"))
        .catch(err => console.error("Error al registrar App:", err));
    }
  }, []);

  // DETECTOR DE URL SECRETA
 // DETECTOR DE URL SECRETA
  useEffect(() => {
    const verificarRutaSecreta = () => {
      // Si la URL termina en #admin o #login, mantenemos el modoAdmin activo
      if (window.location.hash === '#admin' || window.location.hash === '#login') {
        setModoAdmin(true); 
      } else {
        // Solo quitamos el modoAdmin si realmente nos vamos a otro lado
        setModoAdmin(false);
      }
    };
    window.addEventListener('hashchange', verificarRutaSecreta);
    verificarRutaSecreta();
    return () => window.removeEventListener('hashchange', verificarRutaSecreta);
  }, []);

  // ==========================================
  // EFECTO: CALCULAR VENTAS DE LA SEMANA PARA LA GRÁFICA
  // ==========================================
  useEffect(() => {
    if (modoAdmin && vistaAdminTab === "grafica") {
      async function obtenerVentasSemana() {
        try {
          setCargandoGrafica(true);
          const diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
          const deLaSemana = [];
          
          // 1. Estructurar el esqueleto de los últimos 7 días
          for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const tzOffset = d.getTimezoneOffset() * 60000;
            const fechaISO = new Date(d.getTime() - tzOffset).toISOString().split('T')[0];
            const nombreDia = i === 0 ? 'Hoy' : `${diasSemana[d.getDay()]} ${d.getDate()}`;
            deLaSemana.push({ fecha: fechaISO, dia: nombreDia, monto: 0, pct: 8, activo: i === 0 });
          }

          const fechaInicio = deLaSemana[0].fecha;
          const fechaFin = deLaSemana[6].fecha;

          // 2. Traer las citas de esa semana
          const { data, error } = await supabase
            .from('citas')
            .select('*')
            .gte('fecha', fechaInicio)
            .lte('fecha', fechaFin);

          if (error) throw error;

          if (data) {
            // 3. Mapear y sumar ingresos (Solo Efectivo/Tarjeta)
            deLaSemana.forEach(diaObj => {
              const citasDelDiaEsp = data.filter(c => 
                c.fecha === diaObj.fecha && 
                c.metodo_pago && 
                (c.metodo_pago.toLowerCase().trim() === 'efectivo' || c.metodo_pago.toLowerCase().trim() === 'tarjeta')
              );

              let totalDia = 0;
              citasDelDiaEsp.forEach(cita => {
                const s = SERVICIOS.find(serv => serv.nombre.toLowerCase().trim() === (cita.servicio ? cita.servicio.toLowerCase().trim() : ""));
                const precioNum = s ? parseInt(s.precio.replace('$', '')) : 350;
                totalDia += precioNum;
              });
              diaObj.monto = totalDia;
            });

            // 4. Calcular la altura de la barra en base a la venta máxima
            const maxVenta = Math.max(...deLaSemana.map(d => d.monto), 1);
            deLaSemana.forEach(diaObj => {
              diaObj.pct = diaObj.monto === 0 ? 8 : Math.round((diaObj.monto / maxVenta) * 85) + 10;
            });

            setDatosSemanales(deLaSemana);
          }
        } catch (err) {
          console.error("Error al cargar la gráfica semanal:", err);
        } finally {
          setCargandoGrafica(false);
        }
      }
      obtenerVentasSemana();
    }
  }, [modoAdmin, vistaAdminTab, citasDelDia]);
  
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

  // CONSULTA A SUPABASE
  // CONSULTA A SUPABASE CON ANTENA EN TIEMPO REAL (REALTIME)
  useEffect(() => {
    // 1. Función interna para traer los datos de la base de datos
    const obtenerDatos = async () => {
      setOcupados([]); 
      const anio = fechaSeleccionada.getFullYear();
      const mes = String(fechaSeleccionada.getMonth() + 1).padStart(2, '0');
      const dia = String(fechaSeleccionada.getDate()).padStart(2, '0');
      const fechaFiltro = `${anio}-${mes}-${dia}`;
      
      let query = supabase.from('citas').select('*').eq('fecha', fechaFiltro);
      
      // Si no es admin y es un barbero, filtramos solo sus citas
      if (!modoAdmin && reserva.barbero) {
        query = query.eq('barbero', reserva.barbero);
      }

      const { data, error } = await query;
      if (data) {
        setCitasDelDia(data);
        if (!modoAdmin) setOcupados(data.map(c => c.horario));
      }
    };

    // 2. Ejecución inicial al cargar la pantalla
    obtenerDatos();

    // 3. Conexión al canal en tiempo real de Supabase
    const canal = supabase
      .channel('cambios-en-citas')
      .on(
        'postgres_changes', 
        { 
          event: 'INSERT', // Escucha solo cuando entra una fila nueva
          schema: 'public', 
          table: 'citas' 
        }, 
        (payload) => {
          console.log('¡Nueva cita detectada en tiempo real!', payload);
          obtenerDatos(); // Refresca la pantalla automáticamente sin parpadeos
        }
      )
      .subscribe();

    // 4. Limpieza del canal cuando el componente se destruye
    return () => {
      supabase.removeChannel(canal);
    };
  }, [fechaSeleccionada, reserva.barbero, modoAdmin, triggerRecarga]);

  const manejarLoginAdmin = (e) => {
    e.preventDefault(); // 🔥 Evita que la página se recargue de golpe
    
    // Diccionario con PINs de 4 números para respetar el diseño de la pantalla
    const PINS_ACCESO = {
      "1234": "admin",        // Entras tú a la caja global
      "1111": "David",        // Entra David a su sillón
      "2222": "Jorge",        // Entra Jorge a su sillón
      "3333": "Francisco"     // Entra Francisco a su sillón
    };

    const usuarioEncontrado = PINS_ACCESO[pinIngresado];

    if (usuarioEncontrado === "admin") {
      setPinCorrecto(true);
      setModoAdmin(true);
      setBarberoLogueado(null);
      setErrorPin(false);
    } else if (usuarioEncontrado) {
      // Si es un barbero, lo logueamos directamente y activamos su vista
      setBarberoLogueado(usuarioEncontrado);
      setModoAdmin(false);
      setErrorPin(false);
    } else {
      // Si el PIN no existe en el diccionario, marca error
      setErrorPin(true);
      setPinIngresado("");
    }
  };

  const registrarWalkIn = async (e) => {
    e.preventDefault();
    await supabase.from('citas').insert([{ 
      fecha: fechaSeleccionada.toISOString().split('T')[0], 
      horario: new Date().toLocaleTimeString(), 
      barbero: formWalkIn.barbero, 
      servicio: formWalkIn.servicio,
      tipo_cita: 'walk-in',
      cliente_nombre: formWalkIn.cliente || 'Walk-in',
      metodo_pago: formWalkIn.metodoPago
    }]);
    setMostrarModalWalkIn(false);
    setTriggerRecarga(prev => prev + 1);
  };
  // 🔥 CORRECCIÓN: Función faltante para calcular la caja del día
 // 🔥 CORRECCIÓN: Función para calcular la caja del día sin ignorar pendientes
  const calcularIngresosDelDia = () => {
    if (!citasDelDia || citasDelDia.length === 0) return 0;

    return citasDelDia.reduce((total, cita) => {
      // Buscamos el precio del servicio en base a tu lista global SERVICIOS
      const s = SERVICIOS.find(serv => 
        serv.nombre.toLowerCase().trim() === (cita.servicio ? cita.servicio.toLowerCase().trim() : "")
      );
      
      // Si encuentra el servicio, usa su precio; si no, por seguridad usamos 350 de base
      const precioNum = s ? parseInt(s.precio.replace('$', '')) : 350;
      
      return total + precioNum;
    }, 0);
  };
  // 🚀 FUNCIÓN ESTRELLA: GENERADOR DE PDF DE AUDITORÍA (VERSIÓN DESGLOSE DE SERVICIOS Y MÉTODOS DE PAGO)
  const descargarCorteCaja = () => {
    const totalIngresos = calcularIngresosDelDia();
    const fechaFinal = fechaSeleccionada.toISOString().split('T')[0];
    const citasFiltradas = citasDelDia.filter(cita => BARBEROS.includes(cita.barbero));

    // VARIABLES PARA CONTADORES DE PAGO REALES
    let totalEfectivo = 0;
    let totalTarjeta = 0;
    let totalPendiente = 0;
    let conteoEfectivo = 0;
    let conteoTarjeta = 0;
    let conteoPendiente = 0;

    // Calculamos métricas individuales por barbero con desglose de servicios
    const metricasBarberos = BARBEROS.map(barbero => {
      const citasBarbero = citasFiltradas.filter(c => c.barbero === barbero);
      
      const conteoServicios = {};
      let ingresosBarbero = 0;
      
      citasBarbero.forEach(cita => {
        // Calcular ingresos
        const s = SERVICIOS.find(serv => serv.nombre === cita.servicio);
        const precioNum = s ? parseInt(s.precio.replace('$', '')) : 350;
        ingresosBarbero += precioNum;
        
        // Contar servicios
        if (conteoServicios[cita.servicio]) {
          conteoServicios[cita.servicio]++;
        } else {
          conteoServicios[cita.servicio] = 1;
        }

        // CONTROL DE MÉTODOS DE PAGO PARA EL RESUMEN SUPERIOR
        const metodo = cita.metodo_pago ? cita.metodo_pago.toLowerCase().trim() : 'pendiente';
        if (metodo === 'tarjeta') {
          totalTarjeta += precioNum;
          conteoTarjeta++;
        } else if (metodo === 'pendiente') {
          totalPendiente += precioNum;
          conteoPendiente++;
        } else {
          totalEfectivo += precioNum;
          conteoEfectivo++;
        }
      });

      const desglose = Object.entries(conteoServicios)
        .map(([nombre, cant]) => `<span style="display:inline-block; background:#eee; padding:2px 6px; border-radius:4px; margin:2px; font-size:8pt;">${cant}x ${nombre}</span>`)
        .join(' ');

      return { 
        barbero, 
        amount: citasBarbero.length, 
        ingresos: ingresosBarbero, 
        desglose: desglose || '<span style="color:#999; font-style:italic;">Sin servicios</span>' 
      };
    });

    // Construimos la tabla de citas (VERSIÓN ULTRA-COMPATIBLE SIN CORTES)
    const filasCitas = citasFiltradas.length > 0 
      ? citasFiltradas.map(cita => {
          const s = SERVICIOS.find(serv => serv.nombre === cita.servicio);
          const precio = s ? s.precio : '$350';
          
          const metodoTexto = cita.metodo_pago ? cita.metodo_pago.toUpperCase().trim() : 'PENDIENTE';
          
          let estadoPagoHTML = '';
          if (metodoTexto === 'TARJETA') {
            estadoPagoHTML = `<span style="color: #3b82f6; font-weight: bold; font-size: 9pt;">🔵 TARJETA</span>`;
          } else if (metodoTexto === 'PENDIENTE') {
            estadoPagoHTML = `<span style="color: #6b7280; font-weight: bold; font-size: 9pt;">⚪ PENDIENTE</span>`;
          } else {
            estadoPagoHTML = `<span style="color: #10b981; font-weight: bold; font-size: 9pt;">🟢 EFECTIVO</span>`;
          }
          
          return `
            <tr style="border-bottom: 1px solid #eeeeee;">
              <td style="padding: 14px 15px; font-weight: bold; color: #555; vertical-align: middle;">${cita.horario}</td>
              <td style="padding: 14px 15px; vertical-align: middle;"><span style="background-color: #f0f0f0; padding: 4px 10px; border-radius: 4px; font-size: 9pt; font-weight: bold; color: #333;">${cita.barbero}</span></td>
              <td style="padding: 14px 15px; vertical-align: middle; color: #333;">${cita.servicio}</td>
              <td style="padding: 14px 15px; vertical-align: middle;">
                ${estadoPagoHTML}
              </td>
              <td style="padding: 14px 15px; font-weight: bold; color: #b8922f; vertical-align: middle;">${precio}.00</td>
            </tr>
          `;
        }).join('')
      : `<tr><td colspan="5" style="text-align:center; padding: 30px; color: #999; font-style: italic;">No hay transacciones registradas en esta fecha.</td></tr>`;

    const filasMetricas = metricasBarberos.map(m => `
      <tr style="border-bottom: 1px solid #eeeeee;">
        <td style="padding: 12px 15px; font-weight: bold; color: #333;">${m.barbero}</td>
        <td style="padding: 12px 15px;">${m.amount} servicios</td>
        <td style="padding: 12px 15px; line-height: 1.5;">${m.desglose}</td>
        <td style="padding: 12px 15px; font-weight: bold; color: #b8922f;">$${m.ingresos}.00 MXN</td>
      </tr>
    `).join('');

    const htmlContent = `
      <style>
        tr { page-break-inside: avoid; }
        td, th { page-break-inside: avoid; }
        .section-container { page-break-inside: avoid; margin-bottom: 40px; }
        * { box-sizing: border-box; }
      </style>
      <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #222; padding: 30px; max-width: 800px; margin: 0 auto; background: #fff;">
        
        <div style="background-color: #111; color: #fff; padding: 35px; border-bottom: 6px solid #d4af37; border-radius: 10px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h1 style="margin: 0; font-size: 26pt; font-weight: 900; letter-spacing: -1px;">VINTAGE<span style="color: #d4af37;">STUDIO</span></h1>
            <p style="margin: 4px 0 0; font-size: 9pt; text-transform: uppercase; letter-spacing: 3px; color: #d4af37;">Master Barber & Grooming</p>
          </div>
          <div style="text-align: right;">
            <h2 style="margin: 0; color: #fff; font-size: 16pt; text-transform: uppercase;">Corte de Caja</h2>
            <p style="margin: 4px 0 0; color: #aaa; font-size: 10pt;">Reporte Operativo Diario</p>
          </div>
        </div>

        <div class="section-container" style="background-color: #fafafa; border: 1px solid #eaeaea; border-radius: 8px; padding: 20px;">
          <table style="width: 100%; text-align: center; border-collapse: collapse; margin-bottom: 15px;">
            <tr>
              <td style="border-right: 1px solid #ddd; width: 33%; padding: 10px;">
                <span style="font-size: 8pt; color: #777; text-transform: uppercase; display: block; margin-bottom: 5px; font-weight: bold;">Fecha Operativa</span>
                <span style="font-size: 14pt; font-weight: 900; color: #111;">${fechaFinal}</span>
              </td>
              <td style="border-right: 1px solid #ddd; width: 33%; padding: 10px;">
                <span style="font-size: 8pt; color: #777; text-transform: uppercase; display: block; margin-bottom: 5px; font-weight: bold;">Transacciones</span>
                <span style="font-size: 14pt; font-weight: 900; color: #111;">${citasFiltradas.length}</span>
              </td>
              <td style="width: 33%; padding: 10px;">
                <span style="font-size: 8pt; color: #777; text-transform: uppercase; display: block; margin-bottom: 5px; font-weight: bold;">Ingreso Bruto Total</span>
                <span style="font-size: 16pt; font-weight: 900; color: #d4af37;">$${totalIngresos}.00 MXN</span>
              </td>
            </tr>
          </table>
          
          <div style="border-top: 1px solid #eee; padding-top: 15px; display: flex; justify-content: space-around; font-size: 10pt;">
            <div style="text-align: center;">
              <span style="color: #10b981; font-weight: bold; display: block; font-size: 8pt; text-transform: uppercase;">💵 TOTAL EFECTIVO</span>
              <span style="font-size: 12pt; font-weight: 800; color: #333;">$${totalEfectivo}.00 MXN</span> <small style="color: #888;">(${conteoEfectivo} ventas)</small>
            </div>
            <div style="text-align: center;">
              <span style="color: #3b82f6; font-weight: bold; display: block; font-size: 8pt; text-transform: uppercase;">💳 TOTAL TARJETA</span>
              <span style="font-size: 12pt; font-weight: 800; color: #333;">$${totalTarjeta}.00 MXN</span> <small style="color: #888;">(${conteoTarjeta} ventas)</small>
            </div>
            <div style="text-align: center;">
              <span style="color: #6b7280; font-weight: bold; display: block; font-size: 8pt; text-transform: uppercase;">⚪ POR COBRAR (PENDIENTE)</span>
              <span style="font-size: 12pt; font-weight: 800; color: #6b7280;">$${totalPendiente}.00 MXN</span> <small style="color: #888;">(${conteoPendiente} citas)</small>
            </div>
          </div>
        </div>

        <div class="section-container">
          <h3 style="border-left: 4px solid #d4af37; padding-left: 12px; margin-bottom: 15px; text-transform: uppercase; font-size: 12pt; color: #111; font-weight: 800;">Rendimiento por Especialista</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 10pt; border: 1px solid #eee;">
            <thead>
              <tr style="background-color: #111; color: #fff; text-transform: uppercase; font-size: 9pt;">
                <th style="padding: 12px 15px; text-align: left;">Barbero</th>
                <th style="padding: 12px 15px; text-align: left;">Volumen</th>
                <th style="padding: 12px 15px; text-align: left;">Servicios Realizados</th>
                <th style="padding: 12px 15px; text-align: left;">Facturado</th>
              </tr>
            </thead>
            <tbody>${filasMetricas}</tbody>
          </table>
        </div>

        <div class="section-container">
          <h3 style="border-left: 4px solid #d4af37; padding-left: 12px; margin-bottom: 15px; text-transform: uppercase; font-size: 12pt; color: #111; font-weight: 800;">Desglose de Transacciones</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 10pt; border: 1px solid #eee;">
            <thead>
              <tr style="background-color: #111; color: #fff; text-transform: uppercase; font-size: 9pt;">
                <th style="padding: 12px 15px; text-align: left;">Horario</th>
                <th style="padding: 12px 15px; text-align: left;">Barbero</th>
                <th style="padding: 12px 15px; text-align: left;">Servicio Realizado</th>
                <th style="padding: 12px 15px; text-align: left;">Método Pago</th>
                <th style="padding: 12px 15px; text-align: left;">Monto</th>
              </tr>
            </thead>
            <tbody>${filasCitas}</tbody>
          </table>
        </div>

        <div style="text-align: center; margin-top: 40px; border-top: 1px solid #eee; padding-top: 20px;">
          <p style="font-size: 8pt; color: #999; text-transform: uppercase; letter-spacing: 1px;">Documento generado automáticamente por Prisma Studio MX POS</p>
        </div>
      </div>
    `;

    const opciones = {
      margin:       [10, 0, 10, 0],
      filename:     `Corte_de_Caja_VintageStudio_${fechaFinal}.pdf`,
      image:        { type: 'jpeg', quality: 1 },
      html2canvas:  { scale: 2, useCORS: true, letterRendering: true },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    const elemento = document.createElement('div');
    elemento.innerHTML = htmlContent;
    html2pdf().set(opciones).from(elemento).save();
  };
  const finalizarCita = async () => {
    // 1. Validamos datos
    if (!reserva.servicio || !reserva.horario || !reserva.barbero) {
      alert("Por favor completa todos los campos antes de confirmar.");
      return;
    }
    
    // 2. Preparamos datos
    const fechaFinal = fechaSeleccionada.toISOString().split('T')[0];
    const opcionesFecha = { weekday: 'long', day: 'numeric', month: 'long' };
    let fechaLegible = fechaSeleccionada.toLocaleDateString('es-MX', opcionesFecha);
    fechaLegible = fechaLegible.normalize("NFD").replace(/[\u0300-\u0301]/g, "");

    // 3. Guardamos en Supabase
    const { error } = await supabase.from('citas').insert([
      { 
        servicio: reserva.servicio.nombre, 
        horario: reserva.horario, 
        fecha: fechaFinal, 
        barbero: reserva.barbero,
        metodo_pago: 'PENDIENTE' // Aseguramos que inicie como pendiente
      }
    ]);

    if (error) {
      console.error("Error Supabase:", error);
      alert("Error al conectar con el sistema. Intenta de nuevo.");
      return;
    }

    // 4. Formateamos el mensaje de WhatsApp
    const numeroTelefono = "523310942397";
    const textoTicket = 
`BARBERIA VINTAGE STUDIO
--------------------------------------
¡Hola! Me gustaria confirmar mi cita agendada desde el sitio web. Aquí estan los detalles de mi turno:

- SERVICIO: ${reserva.servicio.nombre}
- BARBERO: ${reserva.barbero}
- FECHA: ${fechaLegible.toUpperCase()}
- HORARIO: ${reserva.horario}

--------------------------------------
Agradecemos su puntualidad. ¡Nos vemos pronto!`;
    // 5. APERTURA SEGURA: Usamos window.location.href en lugar de window.open
    // Esto es mucho más compatible con navegadores móviles (Chrome/Safari en iOS/Android)
    const urlWhatsapp = `https://wa.me/${numeroTelefono}?text=${encodeURIComponent(textoTicket)}`;
    
    // Cambiamos el comportamiento:
    window.location.href = urlWhatsapp; 
  };

 const confirmarPagoCita = async (cita, metodo) => {
  const metodoLimpio = metodo.toLowerCase().trim();

  // 1. Verificación: ¿Qué ID estamos buscando?
  console.log("Intentando actualizar ID:", cita.id); 

  // 2. Ejecución con manejo de error estricto
  const { data, error } = await supabase
    .from('citas')
    .update({ metodo_pago: metodoLimpio })
    .eq('id', cita.id)
    .select(); // <--- IMPORTANTE: Esto devuelve la fila actualizada

  // 3. Si hay error o si 'data' está vacío, sabremos que algo falló
  if (error) {
    console.error("ERROR CRÍTICO DE SUPABASE:", error);
    alert("Error de Supabase: " + error.message);
    return;
  }

  if (!data || data.length === 0) {
    console.warn("ADVERTENCIA: Se ejecutó el comando, pero no se encontró ninguna fila con ese ID.");
    alert("No se encontró la cita en la base de datos. ¿El ID es correcto?");
    return;
  }

  // 4. Si llegamos aquí, es que SÍ se actualizó
  alert("¡Guardado exitosamente!");
  setTriggerRecarga(prev => prev + 1);
};
  
  // ==========================================
  // VISTA 2: PRISMA DASHBOARD (PANTALLA DE ADMIN)
  // ==========================================
  if (modoAdmin) {
   if (!pinCorrecto) {
      return (
        <div className="bg-[#121212] min-h-screen flex items-center justify-center font-sans p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-[#1a1a1a] border border-white/10 p-8 rounded-2xl w-full max-w-sm text-center shadow-2xl">
            <div className="text-xl font-black text-white mb-2">Vintage Studio<span className="text-[#d4af37]">DASHBOARD</span></div>
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
 
    const citasPagadas = citasDelDia.filter(c => c.metodo_pago && (c.metodo_pago.toLowerCase().trim() === 'efectivo' || c.metodo_pago.toLowerCase().trim() === 'tarjeta'));
    const citasPendientes = citasDelDia.filter(c => !c.metodo_pago || (c.metodo_pago.toLowerCase().trim() !== 'efectivo' && c.metodo_pago.toLowerCase().trim() !== 'tarjeta'));
    
    return (
      <div className="bg-[#0f0f0f] text-white min-h-screen font-sans p-4 md:p-10 selection:bg-[#d4af37] selection:text-black antialiased pb-40">
        
        {/* BARRA SUPERIOR DE CONSOLA */}
        <nav className="flex justify-between items-center mb-8 border-b border-white/[0.02] pb-6">
          <div>
            <div className="text-2xl font-black tracking-wide text-white">
              PRISMA<span className="text-[#d4af37] font-light">DASHBOARD</span>
            </div>
            <p className="text-[9px] text-[#d4af37] tracking-[0.25em] uppercase mt-1 font-bold opacity-90">Ecosistema Multi-Barbero</p>
          </div>
          <button 
            onClick={() => { 
              setPinCorrecto(false);
              setPinIngresado("");
              setErrorPin(false);
              window.location.hash = "#login";
            }} 
            className="text-[11px] tracking-widest uppercase font-black text-neutral-300 hover:text-white border border-neutral-800 hover:border-neutral-700 px-5 py-2.5 rounded-xl transition-all"
          >
            Cerrar Sesión
          </button>
        </nav>

        <div className="w-full mx-auto space-y-6 max-w-md md:max-w-full">
          
          {vistaAdminTab === "agenda" ? (
            <>
              {/* --- CONTROL INTERNO: PESTAÑA AGENDA OPERATIVA --- */}
              <div className="flex flex-col lg:flex-row lg:justify-between lg:items-end gap-6 pb-2">
                <div>
                  <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight text-white">PANEL DE AGENDAS</h1>
                  <p className="text-[11px] text-neutral-500 uppercase tracking-wider mt-1 font-bold">
                    FECHA: <span className="font-mono text-neutral-400 font-black">2026-05-28</span>
                  </p>
                </div>
                
                <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3">
                  <button onClick={() => setMostrarModalWalkIn(true)} className="bg-[#d4af37] text-black py-3 px-5 rounded-xl font-black uppercase text-xs tracking-wider transition-all hover:bg-white">+ VENTA MOSTRADOR</button>
                  <button onClick={descargarCorteCaja} className="bg-[#161616] border border-neutral-800 text-[#d4af37] py-3 px-5 rounded-xl font-black uppercase text-xs tracking-wider transition-all hover:bg-neutral-900">📥 DESCARGAR PDF</button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 max-w-2xl">
                <div className="bg-[#161616] border border-neutral-800 px-4 py-3 rounded-xl flex justify-between items-center flex-1">
                  <span className="text-[10px] text-white uppercase tracking-wider font-black">✓ SERVICIOS LISTOS</span>
                  <span className="text-xs bg-[#0f0f0f] border border-neutral-800 px-2 py-0.5 rounded text-white font-black font-mono">{citasPagadas.length}</span>
                </div>
                <div className="bg-[#161616] border border-neutral-800 px-4 py-3 rounded-xl flex justify-between items-center flex-1">
                  <span className="text-[10px] text-white uppercase tracking-wider font-black">⏳ POR COBRAR</span>
                  <span className="text-xs bg-[#0f0f0f] border border-neutral-800 px-2 py-0.5 rounded text-white font-black font-mono">{citasPendientes.length}</span>
                </div>
              </div>
             
              {/* REJILLA DE SILLAS DE BARBEROS */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {BARBEROS.map((barbero) => {
                  const esperaDelBarbero = citasDelDia.filter(c => c.barbero === barbero && (!c.metodo_pago || (c.metodo_pago.toLowerCase().trim() !== 'efectivo' && c.metodo_pago.toLowerCase().trim() !== 'tarjeta')));
                  return (
                    <div key={barbero} className="bg-[#161616] border border-neutral-800 rounded-2xl p-5 flex flex-col justify-between shadow-xl">
                      <div className="border-b border-white/[0.03] pb-3 mb-4 flex justify-between items-center">
                        <h3 className="text-xs font-black uppercase text-white tracking-wider">SILLAS DE {barbero}</h3>
                        <span className="text-[9px] bg-[#0f0f0f] border border-neutral-800 text-neutral-400 px-2.5 py-0.5 rounded-full font-mono">{esperaDelBarbero.length} citas</span>
                      </div>
                      <div className="space-y-2 min-h-[160px] flex flex-col justify-center">
                        {esperaDelBarbero.length === 0 ? (
                          <div className="text-center py-10 border border-dashed border-neutral-800/80 rounded-xl">
                            <p className="text-[10px] text-neutral-500 uppercase tracking-widest font-black">SIN CITAS</p>
                          </div>
                        ) : (
                          esperaDelBarbero.map((cita, idx) => (
                            <div key={idx} className="bg-[#0f0f0f] p-3 rounded-xl border border-neutral-800">
                              <span className="text-[#d4af37] font-mono text-[9px] font-black block mb-1">• {cita.horario}</span>
                              <p className="text-xs font-black text-white uppercase">{cita.cliente_nombre || 'Cliente Online'}</p>
                              <p className="text-[10px] text-white/70 uppercase truncate">{cita.servicio}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* HISTORIAL DE VENTAS */}
              <div className="pt-4">
                <p className="text-xs text-white uppercase tracking-[0.15em] font-black mb-4">💰 HISTORIAL DE VENTAS LIQUIDADAS</p>
                <div className="bg-[#161616] border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/[0.04] bg-[#0f0f0f]/60 text-[9px] text-white uppercase font-black">
                        <th className="p-4 pl-6">Horario</th>
                        <th className="p-4">Barbero</th>
                        <th className="p-4">Servicio</th>
                        <th className="p-4 pr-6 text-right">Monto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.02] text-xs uppercase font-black text-white">
                      {citasPagadas.length === 0 ? (
                        <tr><td colSpan="4" className="p-8 text-center text-white/40 text-[9px] tracking-widest">NO HAY VENTAS HOY.</td></tr>
                      ) : (
                        citasPagadas.map((cita, idx) => {
                          const precioEncontrado = SERVICIOS.find(s => s.nombre.toLowerCase().trim() === (cita.servicio ? cita.servicio.toLowerCase().trim() : ""))?.precio || "$350";
                          return (
                            <tr key={idx} className="hover:bg-[#0f0f0f]/50 transition-colors">
                              <td className="p-4 pl-6 font-mono text-[#d4af37]">{cita.horario}</td>
                              <td className="p-4">{cita.barbero}</td>
                              <td className="p-4 text-white/80">{cita.servicio}</td>
                              <td className="p-4 pr-6 text-right font-mono">${precioEncontrado.replace('$', '')}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* --- CONTROL INTERNO: NUEVA PESTAÑA ANALÍTICA (MÉTRICAS E IMAGEN) --- */}
              <div>
                <h1 className="text-3xl font-black uppercase tracking-tight text-white">RENDIMIENTO</h1>
                <p className="text-[11px] text-neutral-500 uppercase tracking-wider mt-1 font-bold">Estadísticas comerciales de la semana</p>
              </div>

              {/* Caja de Ingresos Totales (Estilo Premium - DATOS REALES LIMPIOS) */}
            <div className="bg-[#161616] border border-neutral-800 rounded-2xl p-6 text-center shadow-lg">
              <span className="block text-[9px] text-neutral-500 uppercase tracking-widest font-black mb-1">Caja Estimada Hoy</span>
              <span className="text-3xl text-[#d4af37] font-black font-mono">${calcularIngresosDelDia().toLocaleString()} MXN</span>
              <span className="block text-[9px] text-neutral-600 uppercase tracking-wider mt-1 font-bold">Datos en vivo desde Supabase</span>
            </div>

            {/* GRÁFICA DE ALTA FIDELIDAD CON MARGEN DE SEGURIDAD PROTEGIDO */}
            <div className="bg-[#161616] border border-neutral-800 rounded-2xl p-5 shadow-2xl mb-8"></div>

              {/* GRÁFICA DE ALTA FIDELIDAD CON CONEXIÓN REAL A SUPABASE */}
              <div className="bg-[#161616] border border-neutral-800 rounded-2xl p-5 shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                  <span className="text-[10px] uppercase font-black tracking-wider text-neutral-400">Ingresos Semanales</span>
                  <span className="text-xs font-black text-white font-mono">
                    ${datosSemanales.reduce((acc, curr) => acc + curr.monto, 0).toLocaleString()} MXN
                  </span>
                </div>
                
                {/* Contenedor de Barras Reactivo con altura fija protegida */}
                <div className="h-44 w-full flex items-end justify-between px-2 pt-4 relative">
                  {/* Líneas Horizontales de Guía */}
                  <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-7 pt-4">
                    <div className="border-b border-neutral-900/60 w-full"></div>
                    <div className="border-b border-neutral-900/60 w-full"></div>
                    <div className="border-b border-neutral-900/60 w-full"></div>
                  </div>

                  {/* Renderizado estructural dinámico de los 7 días */}
                  {cargandoGrafica ? (
                    <div className="absolute inset-0 flex items-center justify-center text-[10px] text-[#d4af37] font-black uppercase tracking-widest z-20">
                      Calculando historial...
                    </div>
                  ) : (
                    datosSemanales.map((bar, i) => (
                      <div key={i} className="flex flex-col items-center flex-1 group relative z-10 mx-0.5 sm:mx-1 h-full justify-end">
                        {/* Burbuja informativa al pasar el cursor (Muestra el monto real) */}
                        <div className="absolute -top-7 bg-black border border-neutral-800 text-[#d4af37] font-mono text-[9px] font-black px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-xl z-30">
                          ${bar.monto.toLocaleString()}
                        </div>
                        
                        {/* Columna de la Barra */}
                        <div 
                          style={{ height: `${bar.pct}%` }} 
                          className={`w-full max-w-[24px] ${
                            bar.activo 
                              ? 'bg-[#d4af37] shadow-[0_0_12px_rgba(212,175,55,0.4)]' 
                              : 'bg-neutral-800/80 group-hover:bg-neutral-700'
                          } rounded-t-md transition-all duration-700 shadow-md`}
                        ></div>
                        
                        {/* Texto inferior (Día) */}
                        <span className={`text-[8px] sm:text-[9px] font-black uppercase tracking-tighter mt-2.5 ${bar.activo ? 'text-[#d4af37]' : 'text-neutral-500'}`}>
                          {bar.dia}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Espaciador de seguridad al final para evitar el corte de la barra de navegación */}
              <div className="h-12"></div>
            </>
          )}

        </div>

        {/* BARRA DE NAVEGACIÓN INFERIOR PREMIUM (Fija abajo flotando) */}
        <div className="fixed bottom-0 left-0 w-full bg-[#0a0a0a]/90 backdrop-blur-md border-t border-white/[0.03] flex justify-around items-center py-4 z-50 shadow-2xl">
           <button 
             onClick={() => setVistaAdminTab("agenda")} 
             className={`flex flex-col items-center gap-1.5 transition-all ${vistaAdminTab === 'agenda' ? 'text-[#d4af37] scale-105 font-black' : 'text-neutral-600 hover:text-neutral-400'}`}
           >
             <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/><path d="m9 16 2 2 4-4"/></svg>
             <span className="text-[9px] font-black uppercase tracking-widest">Ver Agenda</span>
           </button>
           
           <button 
             onClick={() => setVistaAdminTab("grafica")} 
             className={`flex flex-col items-center gap-1.5 transition-all ${vistaAdminTab === 'grafica' ? 'text-[#d4af37] scale-105 font-black' : 'text-neutral-600 hover:text-neutral-400'}`}
           >
             <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" x2="18" y1="20" y2="10"/><line x1="12" x2="12" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="14"/></svg>
             <span className="text-[9px] font-black uppercase tracking-widest">Ver Gráfica</span>
           </button>
        </div>

        {/* CONTENEDOR MODAL VENTA MOSTRADOR (Conserva intacta toda tu lógica de captura) */}
        {mostrarModalWalkIn && (
          <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-[#161616] border border-neutral-800 p-6 rounded-2xl w-full max-w-sm shadow-2xl">
              <div className="text-center mb-6">
                <h3 className="text-white font-black uppercase tracking-widest text-xs">Nueva Venta Mostrador</h3>
                <div className="h-[1px] w-12 bg-[#d4af37]/40 mx-auto mt-2"></div>
              </div>
              <form onSubmit={registrarWalkIn} className="space-y-4">
                <div>
                  <label className="block text-[9px] text-white uppercase font-black tracking-wider mb-1.5">Nombre del Cliente</label>
                  <input type="text" placeholder="Ej. Cliente Walk-In" onChange={(e) => setFormWalkIn({...formWalkIn, cliente: e.target.value})} className="w-full bg-[#0f0f0f] border border-neutral-800 focus:border-[#d4af37] p-3 rounded-xl text-white text-xs font-bold focus:outline-none transition-all" />
                </div>
                <div className="relative">
                  <label className="block text-[9px] text-white uppercase font-black tracking-wider mb-1.5">Seleccionar Barbero</label>
                  <div onClick={() => setMenuBarberoAbierto(!menuBarberoAbierto)} className="w-full bg-[#0f0f0f] border border-neutral-800 p-3 rounded-xl text-white text-xs font-bold cursor-pointer flex justify-between items-center transition-all">
                    <span className="uppercase">{formWalkIn.barbero}</span><span className="text-[9px] text-[#d4af37]">{menuBarberoAbierto ? '▲' : '▼'}</span>
                  </div>
                  {menuBarberoAbierto && (
                    <div className="absolute w-full bg-[#161616] border border-neutral-800 rounded-xl mt-1 z-50 max-h-40 overflow-y-auto">
                      {BARBEROS.map(b => <div key={b} onClick={() => { setFormWalkIn({...formWalkIn, barbero: b}); setMenuBarberoAbierto(false); }} className="p-3 hover:bg-[#d4af37] hover:text-black cursor-pointer text-xs uppercase font-black transition-all">{b}</div>)}
                    </div>
                  )}
                </div>
                <div className="relative">
                  <label className="block text-[9px] text-white uppercase font-black tracking-wider mb-1.5">Servicio Solicitado</label>
                  <div onClick={() => setMenuServicioAbierto(!menuServicioAbierto)} className="w-full bg-[#0f0f0f] border border-neutral-800 p-3 rounded-xl text-white text-xs font-bold cursor-pointer flex justify-between items-center transition-all">
                    <span className="uppercase text-white/90">{formWalkIn.servicio}</span><span className="text-[9px] text-[#d4af37]">{menuServicioAbierto ? '▲' : '▼'}</span>
                  </div>
                  {menuServicioAbierto && (
                    <div className="absolute w-full bg-[#161616] border border-neutral-800 rounded-xl mt-1 z-50 max-h-40 overflow-y-auto">
                      {SERVICIOS.map(s => <div key={s.id} onClick={() => { setFormWalkIn({...formWalkIn, servicio: s.nombre}); setMenuServicioAbierto(false); }} className="p-3 hover:bg-[#d4af37] hover:text-black cursor-pointer text-xs font-black flex justify-between uppercase transition-all"><span>{s.nombre}</span><span>{s.precio}</span></div>)}
                    </div>
                  )}
                </div>
                <div className="relative">
                  <label className="block text-[9px] text-white uppercase font-black tracking-wider mb-1.5">Método de Liquidación</label>
                  <div onClick={() => setMenuPagoAbierto(!menuPagoAbierto)} className="w-full bg-[#0f0f0f] border border-neutral-800 p-3 rounded-xl text-white text-xs font-bold cursor-pointer flex justify-between items-center transition-all">
                    <span className="font-black text-[#d4af37] uppercase text-xs">{formWalkIn.metodoPago === 'efectivo' ? '💵 Efectivo' : '💳 Tarjeta'}</span>
                    <span className="text-[9px] text-[#d4af37]">{menuPagoAbierto ? '▲' : '▼'}</span>
                  </div>
                  {menuPagoAbierto && (
                    <div className="absolute w-full bg-[#161616] border border-neutral-800 rounded-xl mt-1 z-50">
                      {['Efectivo', 'Tarjeta'].map(p => <div key={p} onClick={() => { setFormWalkIn({...formWalkIn, metodoPago: p.toLowerCase()}); setMenuPagoAbierto(false); }} className="p-3 hover:bg-[#d4af37] hover:text-black cursor-pointer text-xs font-black uppercase transition-all">{p === 'Efectivo' ? '💵 Efectivo' : '💳 Tarjeta'}</div>)}
                    </div>
                  )}
                </div>
                <div className="pt-4 space-y-2">
                  <button type="submit" className="w-full bg-[#d4af37] py-3 rounded-xl font-black text-black text-xs uppercase tracking-widest hover:bg-white">Completar Venta</button>
                  <button type="button" onClick={() => setMostrarModalWalkIn(false)} className="w-full text-center text-white/60 text-[10px] uppercase font-black tracking-widest pt-2 hover:text-white">Cerrar Ventana</button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    );
  }
     // ==========================================
// VISTA 3: PANEL EXCLUSIVO DE BARBEROS
// ==========================================
// ==========================================
  // VISTA 3: PANEL EXCLUSIVO DE BARBEROS
  // ==========================================
  if (barberoLogueado) {
    const misCitasDelDia = citasDelDia.filter(cita => cita.barbero === barberoLogueado && BARBEROS.includes(cita.barbero));
    const serviciosCompletados = misCitasDelDia.filter(c => c.metodo_pago && c.metodo_pago.toLowerCase().trim() !== 'pendiente').length;

    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white p-4 font-sans">
        <nav className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
          <div>
            <p className="text-[10px] text-[#d4af37] tracking-widest uppercase">Especialista Activo</p>
            <h1 className="text-xl font-black uppercase tracking-tight">💈 {barberoLogueado}</h1>
          </div>
          <button onClick={() => setBarberoLogueado(null)} className="text-[10px] uppercase font-bold text-white/40 border border-white/10 px-3 py-1.5 rounded-lg hover:text-white">
            Salir
          </button>
        </nav>

        <div className="bg-[#121212] border border-white/5 rounded-2xl p-4 mb-6 flex justify-between items-center">
          <div>
            <p className="text-xs text-white/50 uppercase">Servicios Hoy</p>
            <p className="text-2xl font-black text-[#d4af37]">{misCitasDelDia.length}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-white/50 uppercase">Completados</p>
            <p className="text-2xl font-black text-green-400">{serviciosCompletados}</p>
          </div>
        </div>

        <h2 className="text-xs font-black uppercase tracking-wider text-white/40 mb-3">Mi Agenda del Día</h2>
        <div className="space-y-3">
          {misCitasDelDia.length > 0 ? (
            misCitasDelDia.map((cita, index) => {
              const esPendiente = !cita.metodo_pago || cita.metodo_pago.toLowerCase().trim() === 'pendiente';
              return (
                <div key={index} className={`p-4 rounded-xl border transition-all ${esPendiente ? 'bg-[#161616] border-[#d4af37]/30' : 'bg-[#121212]/40 border-white/5 opacity-60'}`}>
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-sm font-black text-[#d4af37] bg-[#d4af37]/10 px-2 py-0.5 rounded-md">{cita.horario}</span>
                    <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-md ${esPendiente ? 'bg-amber-500/10 text-amber-400' : 'bg-green-500/10 text-green-400'}`}>
                      {esPendiente ? 'En Espera' : `✓ ${cita.metodo_pago.toUpperCase()}`}
                    </span>
                  </div>
                  <p className="font-bold text-white uppercase text-sm">{cita.cliente_nombre || "Cliente Online"}</p>
                  <p className="text-xs text-white/60 mt-0.5">{cita.servicio}</p>

                  {esPendiente && (
                    citaEnPago?.id === cita.id ? (
                      <div className="grid grid-cols-2 gap-2 mt-3">
                        <button type="button" onClick={() => confirmarPagoCita(cita, 'efectivo')} className="bg-green-600 text-white text-[10px] font-black py-2 rounded-lg uppercase">Efectivo</button>
                        <button type="button" onClick={() => confirmarPagoCita(cita, 'tarjeta')} className="bg-blue-600 text-white text-[10px] font-black py-2 rounded-lg uppercase">Tarjeta</button>
                        <button type="button" onClick={() => setCitaEnPago(null)} className="col-span-2 text-white/30 text-[9px] uppercase underline mt-1">Cancelar</button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => setCitaEnPago(cita)} className="w-full mt-3 bg-[#d4af37] text-black text-xs font-black py-2 rounded-lg uppercase tracking-wider active:scale-95 transition-transform">
                        Marcar como Listo
                      </button>
                    )
                  )}
                </div>
              );
            })
          ) : (
            <div className="text-center py-10 text-white/30 text-xs italic">No tienes servicios asignados para hoy todavía.</div>
          )}
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

      {/* 2. SECCIÓN DE GALERÍA DE CORTES */}
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

      {/* 3. FUNNEL DE RESERVAS */}
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

      <footer className="py-20 px-6 border-t border-white/5 bg-black text-center text-white/20 text-[10px] uppercase tracking-widest">
        <div className="text-xl font-black text-white mb-4">VINTAGE<span className="text-[#d4af37]">STUDIO</span></div>
        <p>© {new Date().getFullYear()} Luxury Grids Automation.</p>
      </footer>
    </div>
  );
}