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

    // 1. VERIFICACIÓN DE VARIABLES DE ENTORNO
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Faltan las variables de entorno SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en Vercel.");
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 2. CONFIGURAR LLAVES VAPID
    // ⚠️ REEMPLAZA ESTAS LLAVES POR UNAS REALES GENERADAS CON 'npx web-push generate-vapid-keys'
    const publicVapidKey = 'BOmw7H_04kS6j2X4L9_NzQ8uVw6Z8Yx9Cp1Gv7Bt3Rm8Wv9Xb4Nk7Mz2Pq5Lw8Vv9Yc3Bx6N8Mv4Nx1Zb5Kz7Qw==';
    const privateVapidKey = 'A-Nx8Vw3Mz2Lq5Pw9Vv8Yc6Bx4N8Mv2Nx1Zb5Kz7Q==';

    try {
      webpush.setVapidDetails(
        'mailto:contacto@vintagestudiogdl.com',
        publicVapidKey,
        privateVapidKey
      );
    } catch (vapidErr) {
      throw new Error(`Error en las llaves VAPID: ${vapidErr.message}. Asegúrate de usar llaves reales.`);
    }

    // 3. BUSCAR DISPOSITIVOS (Control de seguridad por si barbero viene vacío)
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

      let titulo = "💈 ¡Nueva Cita Agendada!";
      let cuerpo = `${clienteFinal} reservó ${cita.servicio} a las ${horarioFinal} con ${cita.barbero}.`;

      if (sub.rol === 'barbero') {
        titulo = `✂️ ¡Tienes trabajo nuevo, ${sub.nombre_barbero}!`;
        cuerpo = `${clienteFinal} reservó un ${cita.servicio} contigo hoy a las ${horarioFinal}.`;
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
    // 🔥 AQUÍ ESTÁ EL TRUCO: Devolvemos el mensaje exacto al frontend para diagnosticarlo rápido
    console.error('Error maestro en el disparador:', err);
    return res.status(500).json({ 
      error: 'Error interno del servidor', 
      mensaje_exacto: err.message 
    });
  }
}