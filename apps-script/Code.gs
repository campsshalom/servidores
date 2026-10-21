/**
 * FormCamps · Recepción de inscripciones de servidores (Campamento Shalom)
 *
 * Qué hace:
 *  - Recibe cada inscripción enviada desde la landing (index.html).
 *  - Guarda una fila en la Google Sheet "Inscripciones Servidores Shalom".
 *  - Guarda el comprobante de pago (si lo suben) en una carpeta de Google Drive
 *    y pone el enlace en la fila.
 *
 * Instalación: ver README.md del repositorio (sección "Conectar con Google Drive").
 * 1) Ejecuta la función `setup` una vez y acepta los permisos.
 * 2) Implementa como "Aplicación web" (Ejecutar como: Yo · Acceso: Cualquier persona).
 * 3) Copia la URL /exec en CONFIG.scriptUrl dentro de index.html.
 */

const SETTINGS = {
  SPREADSHEET_NAME: 'Inscripciones Servidores Shalom',
  SHEET_NAME: 'Inscripciones',
  FOLDER_NAME: 'Comprobantes de pago - Servidores Shalom',
  MAX_FILE_MB: 10,
  // Si quieres recibir un correo con cada inscripción, escribe aquí tu correo. Déjalo vacío para no recibir.
  NOTIFY_EMAIL: ''
};

const HEADERS = [
  'Fecha de registro',
  'Nombre completo',
  'Cédula',
  'WhatsApp',
  '¿Cómo vas a llegar a la finca?',
  'Grupo de oración / pastoral / movimiento',
  '¿Estás sirviendo?',
  'Equipo o servicio',
  'Enfermedad / medicamentos',
  'Alergias / intolerancias',
  'Forma de pago',
  'Comprobante de pago',
  '¿Cédula repetida?'
];

const ALLOWED_MIME = [
  'image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp', 'image/gif',
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/octet-stream'
];

const PAGO_OPCIONES = ['Efectivo', 'Transferencia', 'Yappy'];

/* ------------------------------------------------------------------ */
/* Configuración inicial: ejecútala UNA vez desde el editor            */
/* ------------------------------------------------------------------ */
function setup() {
  const ss = getSpreadsheet_();
  const folder = getFolder_();
  Logger.log('Hoja de inscripciones: ' + ss.getUrl());
  Logger.log('Carpeta de comprobantes: ' + folder.getUrl());
  Logger.log('Listo. Ahora implementa el proyecto como Aplicación web.');
}

/* ------------------------------------------------------------------ */
/* Endpoints                                                            */
/* ------------------------------------------------------------------ */
function doGet() {
  return json_({ ok: true, status: 'FormCamps activo' });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return json_({ ok: false, error: 'No llegaron datos.' });
    }

    const data = JSON.parse(e.postData.contents);

    // Campo trampa para bots: si viene lleno, respondemos "ok" sin guardar.
    if (data.website) return json_({ ok: true });

    const error = validate_(data);
    if (error) return json_({ ok: false, error: error });

    // El archivo se guarda antes de tomar el candado para no bloquear a otros envíos.
    let fileUrl = '';
    if (data.comprobante && data.comprobante.data) {
      fileUrl = saveFile_(data);
    }

    lock.waitLock(20000);
    const sheet = getSheet_();
    const cedula = clean_(data.cedula, 20).toUpperCase();
    const repetida = isDuplicate_(sheet, cedula) ? 'Sí' : '';

    sheet.appendRow([
      new Date(),
      safe_(clean_(data.nombre, 120)),
      safe_(cedula),
      safe_(clean_(data.whatsapp, 20)),
      safe_(clean_(data.transporte, 40)),
      safe_(clean_(data.grupo, 200)),
      safe_(clean_(data.sirviendo, 40)),
      safe_(clean_(data.equipo, 200)),
      safe_(clean_(data.salud, 1000)),
      safe_(clean_(data.alergias, 1000)),
      safe_(clean_(data.pago, 20)),
      fileUrl,
      repetida
    ]);
    SpreadsheetApp.flush();
    lock.releaseLock();

    notify_(data, fileUrl, repetida);
    return json_({ ok: true });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: 'No se pudo guardar la inscripción. Inténtalo de nuevo en unos minutos.' });
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

/* ------------------------------------------------------------------ */
/* Validación                                                           */
/* ------------------------------------------------------------------ */
function validate_(d) {
  const nombre = clean_(d.nombre, 200);
  if (nombre.length < 3) return 'Falta el nombre completo.';

  const cedula = clean_(d.cedula, 40).toUpperCase().replace(/\s+/g, '');
  if (!/^(PE|E|N|[1-9]|1[0-3])(AV|PI)?-\d{1,4}-\d{1,6}$/.test(cedula)) {
    return 'La cédula no tiene un formato válido.';
  }

  if (PAGO_OPCIONES.indexOf(d.pago) === -1) return 'Falta la forma de pago.';

  if (d.comprobante && d.comprobante.data) {
    const mime = String(d.comprobante.type || '');
    if (ALLOWED_MIME.indexOf(mime) === -1) return 'El tipo de archivo del comprobante no se acepta.';
    const approxBytes = Math.floor(String(d.comprobante.data).length * 3 / 4);
    if (approxBytes > SETTINGS.MAX_FILE_MB * 1024 * 1024) {
      return 'El comprobante pesa más de ' + SETTINGS.MAX_FILE_MB + ' MB.';
    }
  }
  return '';
}

/* ------------------------------------------------------------------ */
/* Drive y Sheets                                                       */
/* ------------------------------------------------------------------ */
function saveFile_(d) {
  const folder = getFolder_();
  const original = clean_(d.comprobante.name, 120) || 'comprobante';
  const extMatch = original.match(/\.[A-Za-z0-9]{2,5}$/);
  const ext = extMatch ? extMatch[0].toLowerCase() : '';
  const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HHmm');
  const fileName = [clean_(d.cedula, 20).toUpperCase(), clean_(d.nombre, 80), stamp].join(' - ') + ext;

  const bytes = Utilities.base64Decode(String(d.comprobante.data));
  const blob = Utilities.newBlob(bytes, String(d.comprobante.type || 'application/octet-stream'), fileName);
  // El archivo queda privado: solo el dueño de la carpeta (y quienes él comparta) pueden verlo.
  return folder.createFile(blob).getUrl();
}

function getSpreadsheet_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('SPREADSHEET_ID');
  if (id) {
    try { return SpreadsheetApp.openById(id); } catch (_) { /* fue borrada: se crea otra */ }
  }
  const ss = SpreadsheetApp.create(SETTINGS.SPREADSHEET_NAME);
  props.setProperty('SPREADSHEET_ID', ss.getId());
  prepareSheet_(ss.getSheets()[0]);
  return ss;
}

function getSheet_() {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName(SETTINGS.SHEET_NAME);
  if (!sheet) {
    sheet = ss.getSheets()[0];
    if (sheet.getLastRow() > 0) sheet = ss.insertSheet(SETTINGS.SHEET_NAME);
    prepareSheet_(sheet);
  }
  return sheet;
}

function prepareSheet_(sheet) {
  sheet.setName(SETTINGS.SHEET_NAME);
  sheet.getRange(1, 1, 1, HEADERS.length)
    .setValues([HEADERS])
    .setFontWeight('bold')
    .setBackground('#1F6B4A')
    .setFontColor('#FFFFFF')
    .setWrap(true);
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(2);
  sheet.getRange('A:A').setNumberFormat('dd/MM/yyyy HH:mm');
  sheet.getRange('C:D').setNumberFormat('@');
  sheet.setColumnWidths(1, HEADERS.length, 180);
  sheet.setColumnWidth(2, 220);
}

function getFolder_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('FOLDER_ID');
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (_) { /* fue borrada: se crea otra */ }
  }
  const folder = DriveApp.createFolder(SETTINGS.FOLDER_NAME);
  props.setProperty('FOLDER_ID', folder.getId());
  return folder;
}

function isDuplicate_(sheet, cedula) {
  const last = sheet.getLastRow();
  if (last < 2) return false;
  const values = sheet.getRange(2, 3, last - 1, 1).getValues();
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0]).replace(/^'/, '').toUpperCase() === cedula) return true;
  }
  return false;
}

function notify_(d, fileUrl, repetida) {
  if (!SETTINGS.NOTIFY_EMAIL) return;
  try {
    const body = [
      'Nueva inscripción de servidor(a):',
      '',
      'Nombre: ' + clean_(d.nombre, 120),
      'Cédula: ' + clean_(d.cedula, 20),
      'WhatsApp: ' + (clean_(d.whatsapp, 20) || '—'),
      'Forma de pago: ' + clean_(d.pago, 20),
      'Comprobante: ' + (fileUrl || 'No adjuntó'),
      repetida ? '\nAtención: esta cédula ya estaba registrada.' : '',
      '',
      'Hoja: ' + getSpreadsheet_().getUrl()
    ].join('\n');
    MailApp.sendEmail(SETTINGS.NOTIFY_EMAIL, 'Nueva inscripción: ' + clean_(d.nombre, 80), body);
  } catch (err) {
    console.error('No se pudo enviar el aviso por correo', err);
  }
}

/* ------------------------------------------------------------------ */
/* Utilidades                                                           */
/* ------------------------------------------------------------------ */
function clean_(value, max) {
  return String(value == null ? '' : value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
}

// Evita que un texto que empiece con = + - @ se interprete como fórmula en la hoja.
function safe_(value) {
  return /^[=+\-@]/.test(value) ? "'" + value : value;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
