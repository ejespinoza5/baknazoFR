import Emblema from '../../components/Emblema';
import { notificarExito } from '../../lib/notificar';
import { useSesionAdmin } from '../sesion';
import FormContrasena from './FormContrasena';

/**
 * Con una contraseña temporal (la inicial o una restablecida) no se puede
 * hacer nada más: el servidor rechaza el resto de rutas hasta cambiarla.
 */
export default function CambioObligatorio() {
  const { admin, actualizar, salir } = useSesionAdmin();
  return (
    <div className="grid min-h-dvh place-items-center bg-background px-4 py-10">
      <div className="w-full max-w-[440px]">
        <div className="flex items-center gap-2.5">
          <Emblema tamano={40} />
          <span className="text-[19px] font-semibold tracking-tight text-foreground">Baknazo</span>
          <span className="rounded-[5px] bg-carbon px-1.5 py-0.5 text-[10.5px] font-bold text-white">Panel</span>
        </div>
        <div className="mt-6 rounded-2xl border border-border bg-white p-6">
          <h1 className="text-[20px] font-semibold tracking-tight text-foreground">Crea tu contraseña</h1>
          <p className="mt-1 text-[13px] leading-relaxed text-muted">
            Hola, {admin.nombre}. Entraste con una contraseña temporal: cámbiala por una que solo tú conozcas para usar el panel. Se
            cerrarán tus demás sesiones.
          </p>
          <div className="mt-5">
            <FormContrasena
              textoBoton="Guardar y entrar"
              onCambiada={(a) => {
                notificarExito('Contraseña actualizada. Ya puedes usar el panel.');
                actualizar(a);
              }}
            />
          </div>
        </div>
        <button type="button" onClick={() => void salir()} className="mx-auto mt-4 block text-[13px] font-semibold text-muted hover:text-foreground">
          Salir
        </button>
      </div>
    </div>
  );
}
