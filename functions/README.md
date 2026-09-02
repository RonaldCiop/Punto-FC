# Notifiche email dei compiti ospite

Cloud Function che invia un'email quando un ospite aggiunge un compito dal link:

- **al titolare** del link (email presa da Firebase Auth in base all'`uid`);
- **all'ospite**, come conferma, se ha lasciato la sua email nel form.

## Requisiti

- Piano **Blaze** (pay-as-you-go) del progetto Firebase. Le Cloud Functions
  hanno un ampio piano gratuito, ma servono connessioni di rete in uscita
  (SMTP), non disponibili sul piano Spark.
- Un mittente SMTP. Per una buona recapitabilità consiglio un servizio
  transazionale (Brevo, SendGrid, Mailgun, Postmark…). Per volumi bassi va
  bene anche Gmail con una **password per le app**.

## 1. Installazione

```bash
cd functions
npm install
```

## 2. Impostare le credenziali SMTP (Secret Manager)

Esegui una volta e incolla il valore quando richiesto:

```bash
firebase functions:secrets:set SMTP_HOST   # es: smtp-relay.brevo.com
firebase functions:secrets:set SMTP_PORT   # es: 587
firebase functions:secrets:set SMTP_USER   # utente/login SMTP
firebase functions:secrets:set SMTP_PASS   # password / API key SMTP
firebase functions:secrets:set MAIL_FROM   # es: Punto <no-reply@tuodominio.it>
```

> Nota: il mittente `MAIL_FROM` dovrebbe essere un dominio che hai
> autorizzato nel provider SMTP, altrimenti le email finiscono nello spam.

## 3. Deploy

```bash
firebase deploy --only functions
```

(La regione impostata è `europe-west1`; puoi cambiarla in `index.js`.)

## Come funziona

- Trigger: creazione di `users/{uid}/azioni/{taskId}`.
- Filtra su `origine === 'ospite'`, così le voci inserite dal titolare non
  generano email.
- L'email dell'ospite (`emailOspite`) è validata prima dell'invio.

## Sicurezza / note

- L'email dell'ospite è un dato non fidato inserito da chi ha il link: viene
  solo validata e usata come destinatario della conferma. Per limitare
  eventuali abusi (invii massivi) valuta **Firebase App Check** sul flusso
  ospiti e/o un limite di frequenza.
- L'email del titolare non viene mai esposta all'ospite: la conferma parte
  dal mittente SMTP configurato.
