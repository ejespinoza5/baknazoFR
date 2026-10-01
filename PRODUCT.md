# Baknazo — Contexto de producto

Marketplace local de Ecuador para comprar, vender y contratar. App web móvil
prioritaria (la gente compra desde el teléfono, con datos móviles y en la
calle), donde conviven tres tipos de anuncio bajo la misma marca: **productos**
(segunda mano), **servicios** (oficios y trabajos) y **empleo** (checas y
vacantes).

## Quién es

Emprendedores, comerciantes de barrio y personas que ofrecen su oficio o
buscan chamba. No son usuarios expertos: navegan desde el celular, con prisa y a
veces con una sola mano. Todo lo que exige demasiado (muchos pasos, letra
chica, decisiones sin contexto) hace que se vayan.

## Estado

Demo sin backend. Las pantallas están reales y navegables; los datos son de
prueba y las acciones terminan en un aviso. Cuando lleguen las APIs, la
superficie de UI ya está decidida.

## Qué estamos construyendo ahora

**Publicar un anuncio.** Hoy es el único flujo con un hueco: el feed anuncia
"Publicar gratis" y no llevaba a ninguna parte. La pantalla nueva cierra el
ciclo: elige tipo, completa los datos, sube hasta 6 fotos, recorta y publica.

Decisiones ya tomadas con el usuario:

- La estructura viene de una plantilla de referencia; los colores, la tipografía
  y los componentes son los de la app (Geist, fondo `#fafaf7`, tarjetas
  blancas, bordes suaves). No se introduce la paleta verde de la plantilla.
- El botón "Publicar gratis" del feed es la entrada. En móvil vive en un
  flotante, porque el header no tiene espacio a 320 px.
- Al publicar: aviso de éxito, formulario limpio y vuelta al feed.
- Vista previa en vivo con la **misma** tarjeta del feed (`TarjetaAnuncio`), en
  columna lateral pegajosa en escritorio y plegada arriba en móvil.
- Hasta 6 fotos; la primera es la portada. Se elige con el selector existente
  (cámara en táctil, galería con ratón) y se recorta en 4:3.
- Se validan en línea los campos esenciales: título, categoría, ciudad, monto y
  al menos una foto. La descripción es opcional: es mejor un anuncio
  incompleto publicado que uno perfecto abandonado.
- Cambiar de tipo conserva los campos comunes y reinicia solo el específico
  (condición / modalidad de cobro / jornada).
- La pantalla se recuerda en `sessionStorage` durante F5, igual que Configuración.

## Restricciones

- **Es una demo.** Sin backend: no se guardan anuncios, no hay servidor ni
  persistencia. Los "datos de prueba" del feed son fijos.
- **Los tres pilares comparten tokens.** Cada tipo tiene su color (productos
  oro, servicios azul, empleo rojo, como la bandera) y ese color es la única señal de a qué
  categoría pertenece un anuncio. Nunca debe ser el único indicador: siempre
  acompaña a la etiqueta de texto.
- **Móvil primero.** Cualquier cosa que funcione a 320 px funciona en todas
  partes; el escritorio es la ampliación, no al revés.
- **Cero fricción de autenticación.** El usuario no debería tener que elegir
  "comprador" o "vendedor" antes de ver la app. Eso se pregunta después, en el
  primer momento que importa, o se infiere del contexto.
- **Las fotos se eligen con el sistema, no con un `<input type="file">` pelado.**
  En Android, un `accept` con lista de extensiones esconde la cámara.

## Errores que ya cometimos

- **Xvfb no arranca en Windows.** Toda verificación de navegador se hace con
  Chrome headless vía Puppeteer (`--no-sandbox`), no con Xvfb.
- **Tailwind no lee clases construidas por concatenación.** Las clases
  compuestas se escriben como literales completos; si no, desaparecen del CSS
  final sin aviso.
- **Los tokens de Tailwind no son colores arbitrarios en cualquier lugar.** Un
  color que solo existe dentro de un componente no es un token, y se pierde en
  el primer refactor.
