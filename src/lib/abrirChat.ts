import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { iniciarConversacion } from '../api/chat';
import { useNavegacion } from './navegacion';
import { notificarError } from './notificar';

/**
 * Lo que hacen todos los botones de "Mensaje": abrir (o recuperar) la
 * conversación y llevar a ella.
 *
 * Con un anuncio la conversación queda ligada a él y la otra persona la decide
 * el servidor; desde un perfil es una conversación directa. Sin sesión, al
 * login: escribir siempre es con nombre.
 */
export function useAbrirChat() {
  const navegar = useNavigate();
  const { sesion, irAlLogin } = useNavegacion();
  const [abriendo, setAbriendo] = useState(false);

  const abrir = async (destino: { anuncioId: number } | { usuarioId: string }) => {
    if (!sesion) {
      irAlLogin();
      return;
    }
    if (abriendo) return;
    setAbriendo(true);
    try {
      const conversacion = await iniciarConversacion(destino);
      // La conversación viaja en el state: una recién creada todavía no sale en
      // la bandeja (no tiene mensajes) y así se pinta sin pedirla otra vez.
      navegar(`/mensajes/${conversacion.id}`, { state: { conversacion } });
    } catch (e) {
      notificarError(e instanceof Error ? e.message : 'No se pudo abrir la conversación.');
    } finally {
      setAbriendo(false);
    }
  };

  return { abrir, abriendo };
}
