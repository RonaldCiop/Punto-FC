'use strict';

/**
 * Notifica via email all'arrivo di un compito inviato da un ospite.
 *
 * Si attiva quando viene creato un documento in users/{uid}/azioni/{taskId}
 * con origine === 'ospite' e invia:
 *   1) un avviso al TITOLARE del link (email presa da Firebase Auth via uid);
 *   2) una conferma all'OSPITE, se ha lasciato la sua email nel form.
 *
 * Le credenziali SMTP sono lette da Secret Manager (vedi functions/README.md).
 */

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { defineSecret } = require('firebase-functions/params');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

admin.initializeApp();
setGlobalOptions({ region: 'europe-west1', maxInstances: 10 });

const SMTP_HOST = defineSecret('SMTP_HOST');
const SMTP_PORT = defineSecret('SMTP_PORT');
const SMTP_USER = defineSecret('SMTP_USER');
const SMTP_PASS = defineSecret('SMTP_PASS');
const MAIL_FROM = defineSecret('MAIL_FROM'); // es: "Punto <no-reply@tuodominio.it>"

const fmtData = (d) => {
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return d || '—';
  const [y, m, g] = d.split('-');
  return `${g}/${m}/${y}`;
};

// Validazione essenziale di un indirizzo email (l'ospite è input non fidato)
const emailValida = (e) => typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 120;

exports.notificaCompitoOspite = onDocumentCreated(
  {
    document: 'users/{uid}/azioni/{taskId}',
    secrets: [SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM],
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const t = snap.data() || {};
    if (t.origine !== 'ospite') return; // solo i compiti arrivati dal link ospiti

    const uid = event.params.uid;
    const port = Number(SMTP_PORT.value()) || 587;
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST.value(),
      port,
      secure: port === 465, // 465 = SSL, 587 = STARTTLS
      auth: { user: SMTP_USER.value(), pass: SMTP_PASS.value() },
    });
    const from = MAIL_FROM.value() || SMTP_USER.value();

    const operatore = t.operatore || 'un ospite';
    const azienda = t.azienda ? ` — ${t.azienda}` : '';
    const scad = fmtData(t.dueDate);
    const titolo = t.titolo || '(senza titolo)';

    // 1) Avviso al titolare del link
    try {
      const owner = await admin.auth().getUser(uid);
      if (owner && owner.email) {
        await transporter.sendMail({
          from,
          to: owner.email,
          subject: `Nuovo compito da ${operatore}`,
          text:
            `${operatore} ti ha inviato un compito tramite il link.\n\n` +
            `• ${titolo}${azienda}\n` +
            `• Scadenza: ${scad}\n\n` +
            `Lo trovi nella tua lista di lavoro su Punto.`,
        });
      }
    } catch (err) {
      console.error('Email al titolare non inviata:', err);
    }

    // 2) Conferma all'ospite (solo se ha lasciato un'email valida)
    const emailOspite = String(t.emailOspite || '').trim();
    if (emailValida(emailOspite)) {
      try {
        await transporter.sendMail({
          from,
          to: emailOspite,
          subject: 'Compito inviato ✓',
          text:
            `Ciao ${operatore},\n\n` +
            `il tuo compito è stato inviato correttamente:\n\n` +
            `• ${titolo}${azienda}\n` +
            `• Scadenza: ${scad}\n\n` +
            `Grazie! — Punto`,
        });
      } catch (err) {
        console.error('Email di conferma all\'ospite non inviata:', err);
      }
    }
  }
);
