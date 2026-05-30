import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

export default async function handler(req, res) {
  // Solo permitimos peticiones POST (las que manda Supabase)
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    // Supabase nos manda la información de la nueva cita aquí:
    const { record: cita } = req.body;

    if (!cita) {
      return res.status(400).json({ error: 'No se encontraron datos de la cita' });
    }

    // 1. CONFIGURA TU CONEXIÓN A SUPABASE (Bypass RLS usando service_role)
    // ⚠️ IMPORTANTE: Reemplaza estos dos textos con tus credenciales reales de Supabase
    // GitHub no bloqueará esto porque los valores reales están ocultos
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 2. CONFIGURAR TUS LLAVES DE SEGURIDAD VAPID
    webpush.setVapidDetails(
      'mailto:contacto@vintagestudiogdl.com',
      'BOmw7H_04kS6j2X4L9_NzQ8uVw6Z8Yx9Cp1Gv7Bt3Rm8Wv9Xb4Nk7Mz2Pq5Lw8Vv9Yc3Bx6N8Mv4Nx1Zb5Kz7Qw==', // Tu Llave Pública
      'A-Nx8Vw3Mz2Lq5Pw9Vv8Yc6Bx4N8Mv2Nx1Zb5Kz7Q==' // Tu Llave Privada
    );

    // 3. BUSCAR DISPOSITIVOS: Trae los celulares de los Admins Y del Barbero asignado a la cita
    const { data: subs, error } = await supabase
      .from('suscripciones_push')
      .select('*')
      .or(`rol.eq.admin,nombre_barbero.eq.${cita.barbero}`);

    if (error) throw error;

    // Si nadie tiene las notificaciones activadas todavía, terminamos en paz
    if (!subs || subs.length === 0) {
      return res.status(200).json({ message: 'No hay dispositivos registrados para alertar.' });
    }

    // 4. DISPARAR EN PARALELO A CADA CELULAR DETECTADO
    const envios = subs.map(async (sub) => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          auth: sub.auth,
          p256dh: sub.p256dh
        }
      };

      // Mensaje por defecto para el Administrador / Recepción
      let titulo = "💈 ¡Nueva Cita Agendada!";
      let cuerpo = `${cita.cliente} reservó ${cita.servicio} a las ${cita.horario} con ${cita.barbero}.`;

      // Mensaje personalizado si el celular le pertenece al Barbero asignado
      if (sub.rol === 'barbero') {
        titulo = `✂️ ¡Tienes trabajo nuevo, ${sub.nombre_barbero}!`;
        cuerpo = `${cita.cliente} reservó un ${cita.servicio} contigo hoy a las ${cita.horario}.`;
      }

      try {
        // Enviar el paquete al servidor de Apple/Google para que despierte al cel
        await webpush.sendNotification(pushSubscription, JSON.stringify({ titulo, cuerpo }));
      } catch (err) {
        console.error(`Error al enviar al dispositivo ID ${sub.id}:`, err);
        // Limpieza automática: Si el usuario desinstaló la app, borramos su renglón viejo
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabase.from('suscripciones_push').delete().eq('id', sub.id);
        }
      }
    });

    // Esperar a que se procesen todos los envíos
    await Promise.all(envios);

    return res.status(200).json({ success: true, mensajes_enviados: subs.length });

  } catch (err) {
    console.error('Error maestro en el disparador:', err);
    return res.status(500).json({ error: err.message });
  }
}