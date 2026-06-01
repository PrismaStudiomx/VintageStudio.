import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const cita = req.body.record || req.body;

    if (!cita || (!cita.barbero && !cita.servicio)) {
      return res.status(400).json({ error: 'No se encontraron datos de la cita o el formato es incorrecto' });
    }

    const horarioFinal = cita.horario || cita.hora || "Hora no especificada";
    const clienteFinal = cita.cliente || cita.cliente_nombre || "Cliente Web";
    
    // OBTENER Y FORMATEAR LA FECHA CORRECTAMENTE
    let fechaFinal = cita.fecha || "Fecha no especificada";
    if (cita.fecha && cita.fecha.includes('-')) {
      try {
        // Convierte el formato YYYY-MM-DD a texto amigable ("miércoles, 3 de junio")
        fechaFinal = new Date(cita.fecha + 'T00:00:00').toLocaleDateString('es-MX', {
          weekday: 'long',
          day: 'numeric',
          month: 'long'
        });
      } catch (e) {
        fechaFinal = cita.fecha;
      }
    }

    // 1. VERIFICACIÓN DE VARIABLES DE ENTORNO
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Faltan las variables de entorno SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en Vercel.");
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 2. CONFIGURAR LLAVES VAPID
    const publicVapidKey = 'BBjLSrl4XnajLhVhd2SBxyMjWBCkP_YoH8XK5wzMjS_Lh_5cl-2Jz1r5LqkuWJsOOyIrzdrIQbuSSGZCAskH93U';
    const privateVapidKey = 'qGB1zPxtCSeY_PHlE0WrEUxx8Eo7z366NdOvn3nMLTk';

    try {
      webpush.setVapidDetails(
        'mailto:contacto@vintagestudiogdl.com',
        publicVapidKey,
        privateVapidKey
      );
    } catch (vapidErr) {
      throw new Error(`Error en las llaves VAPID: ${vapidErr.message}. Asegúrate de usar llaves reales.`);
    }

    // 3. BUSCAR DISPOSITIVOS
    const barberoBuscado = cita.barbero || "Ninguno";
    const { data: subs, error } = await supabase
      .from('suscripciones_push')
      .select('*')
      .or(`rol.eq.admin,nombre_barbero.eq.${barberoBuscado}`);

    if (error) throw new Error(`Error en la base de datos Supabase: ${error.message}`);

    if (!subs || subs.length === 0) {
      return res.status(200).json({ success: true, message: 'No hay dispositivos registrados para alertar.' });
    }

    // 4. DISPARAR NOTIFICACIONES
    const envios = subs.map(async (sub) => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: { auth: sub.auth, p256dh: sub.p256dh }
      };

      // Notificación por defecto (Dueño / Admin)
      let titulo = "💈 ¡Nueva Cita Agendada!";
      let cuerpo = `${clienteFinal} reservó ${cita.servicio} para el ${fechaFinal} a las ${horarioFinal} con ${cita.barbero}.`;

      // Notificación específica para el Barbero (Quitamos la palabra "hoy")
      if (sub.rol === 'barbero') {
        titulo = `✂️ ¡Tienes trabajo nuevo, ${sub.nombre_barbero}!`;
        cuerpo = `${clienteFinal} reservó un ${cita.servicio} contigo el ${fechaFinal} a las ${horarioFinal}.`;
      }

      try {
        await webpush.sendNotification(pushSubscription, JSON.stringify({ titulo, cuerpo }));
      } catch (err) {
        console.error(`Error al enviar al dispositivo ID ${sub.id}:`, err);
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabase.from('suscripciones_push').delete().eq('id', sub.id);
        }
      }
    });

    await Promise.all(envios);
    return res.status(200).json({ success: true, mensajes_enviados: subs.length });

  } catch (err) {
    console.error('Error maestro en el disparador:', err);
    return res.status(500).json({ 
      error: 'Error interno del servidor', 
      mensaje_exacto: err.message 
    });
  }
}