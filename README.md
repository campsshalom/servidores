# FormCamps

Landing de inscripción de servidores para el **Campamento de jóvenes Shalom**.
Cada inscripción se guarda en una Google Sheet de tu Drive y el comprobante de pago se guarda en una carpeta de Drive.

```
index.html              ← la landing (formulario, datos de pago, validaciones)
apps-script/Code.gs     ← el código que guarda en Google Drive
apps-script/appsscript.json
```

Mientras la landing no esté conectada a Google, funciona en **modo de prueba**: se puede llenar y enviar, pero no guarda nada.

---

## 1. Conectar con Google Drive (10 minutos, una sola vez)

Hazlo con la cuenta de Google donde quieres que queden las inscripciones.

1. Entra a **https://script.google.com** y toca **Nuevo proyecto**. Ponle de nombre `FormCamps`.
2. Borra lo que tenga el archivo `Código.gs` y pega todo el contenido de [`apps-script/Code.gs`](apps-script/Code.gs). Guarda (ícono de disquete).
3. En la barra de arriba elige la función **`setup`** y toca **Ejecutar**.
   - Google pedirá permisos: **Revisar permisos** → elige tu cuenta → **Configuración avanzada** → **Ir a FormCamps (no seguro)** → **Permitir**. Es normal: el aviso sale porque el script es tuyo y no está publicado por Google.
   - Al terminar, en tu Drive aparecen la hoja **"Inscripciones Servidores Shalom"** y la carpeta **"Comprobantes de pago - Servidores Shalom"**.
4. Toca **Implementar → Nueva implementación**.
   - Tipo: **Aplicación web**.
   - Ejecutar como: **Yo**.
   - Quién tiene acceso: **Cualquier persona**.
   - Toca **Implementar** y copia la **URL de la aplicación web** (termina en `/exec`).
5. Abre `index.html`, busca `scriptUrl: ''` y pega la URL entre las comillas:
   ```js
   scriptUrl: 'https://script.google.com/macros/s/XXXXXXXX/exec',
   ```

> Si más adelante cambias `Code.gs`, ve a **Implementar → Gestionar implementaciones → Editar (lápiz) → Versión: Nueva versión → Implementar**. Así la URL no cambia.

**Aviso por correo (opcional):** en `Code.gs`, escribe tu correo en `NOTIFY_EMAIL` para recibir un email con cada inscripción.

## 2. Publicar la landing (GitHub Pages, gratis)

1. En GitHub, entra al repo → **Settings → Pages**.
2. En *Source* elige **Deploy from a branch**, rama **main**, carpeta **/ (root)** y guarda.
3. En 1–2 minutos queda en: `https://yinoxavier.github.io/FormCamps/`

## 3. Probar

1. Abre la landing desde el celular y envía una inscripción de prueba con un comprobante.
2. Revisa que aparezca la fila en la hoja y el archivo en la carpeta.
3. Borra la fila de prueba antes de compartir el enlace.

---

## Qué guarda cada inscripción

| Columna | Detalle |
|---|---|
| Fecha de registro | Automática |
| Nombre completo | Obligatorio |
| Cédula | Obligatorio, formato panameño (8-123-4567, PE-12-345, E-8-12345…) |
| WhatsApp | Opcional |
| ¿Cómo vas a llegar a la finca? | En mi auto / Requiero de bus |
| Grupo de oración / pastoral / movimiento | Texto |
| ¿Estás sirviendo? | Ya tengo un equipo / Aún no tengo equipo |
| Equipo o servicio | Solo aparece si eligió "Ya tengo un equipo" |
| Enfermedad / medicamentos | Texto |
| Alergias / intolerancias | Texto |
| Forma de pago | Obligatorio: Efectivo / Transferencia / Yappy |
| Comprobante de pago | Enlace al archivo en Drive (opcional, máx. 10 MB) |
| ¿Cédula repetida? | Marca "Sí" si esa cédula ya se había inscrito (útil cuando alguien vuelve a enviar para subir otra cuota) |

La hoja y los comprobantes son **privados**: solo los ve el dueño de la cuenta y quienes él comparta.

## Cambiar textos

Todo el texto está en `index.html`: nombre del campamento y año, precio, datos de pago y preguntas.
Si cambias el precio o los datos de pago, revisa la sección **Paquete para servidores**.
