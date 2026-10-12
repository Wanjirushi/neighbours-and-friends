# Neighbours and Friends website starter

## What is included
- Responsive landing page in `public/index.html`
- Multi-step questionnaire with location, interests, budget, availability and friendship questions
- Final M-PESA step for Till 1305656, Till name Family Forever, and transaction code
- Node.js backend that stores submissions, marks payments as pending, and includes a simple admin page
- Basic grouping logic: groups are capped at 15; after an admin confirms a payment, the member is placed in a group for the same county/neighbourhood, with similarity scoring for interests, budget, age, availability and friendship goals
- Kenya county list and a starter list of neighbourhoods, estates and towns, plus an Other option

## Run locally
Requires Node.js 20 or newer. No npm packages are required.

1. Unzip the project.
2. Open a terminal in the project folder.
3. Set a strong admin token, then run the server.

Linux/macOS:
```bash
ADMIN_TOKEN='replace-with-a-long-random-secret' node server.js
```

Windows PowerShell:
```powershell
$env:ADMIN_TOKEN='replace-with-a-long-random-secret'
node server.js
```

4. Visit http://localhost:3000
5. Admin page: http://localhost:3000/admin
6. Enter the same admin token to view registrations and confirm payments.

## Important before public launch
This is a functional starter, not a production-ready service. It stores personal information in `data.json`, so keep it private and do not use real customer data until hosting and security have been reviewed. Deploy behind HTTPS, use a managed database with access controls, backups and retention rules, add rate limiting and CSRF protection, and protect the admin area with a proper authentication system.

M-PESA payments are NOT automatically verified. The admin must check the transaction code against the actual M-PESA transaction before clicking "Confirm payment and match". The form does not initiate payments or know the fee amount, because a price was not supplied. Add the final fee and refund/cancellation policy before launch.

The matching engine is a starting point. It keeps each group at 15 or fewer and uses county/neighbourhood plus similarity scores, but a human should review group composition before sending WhatsApp invitations. The system does not create WhatsApp groups or send WhatsApp messages automatically.

## Hosting
The project can be deployed to a Node.js host that supports persistent storage, but `data.json` should be replaced with a managed database before accepting real registrations. You will need to connect a domain and configure HTTPS. Hosting is not performed by creating these files alone.
