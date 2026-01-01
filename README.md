QIS-Checker 🤖📊

QIS-Checker is an automated bot that logs into the Frankfurt University of Applied Sciences HIS/QIS portal, checks for grade updates, and sends an email notification when new grades or changes are detected.

This tool is ideal for students who want to be notified immediately when their exam results are published instead of manually checking the portal.

✨ Features

🔐 Secure login to the HIS/QIS portal using environment variables

🧭 Fully automated browser navigation with Puppeteer

📅 Detects updates by comparing the last update date

🎯 Tracks specific courses and grades

📧 Sends email notifications via Gmail (Nodemailer)

🕒 Can be run via cron for periodic checks

🖥️ Runs headless (server-friendly)

🛠️ Tech Stack

Node.js

Puppeteer

Nodemailer

dotenv

📂 Project Structure
Qis-Checker/
├── index.js          # Main automation script
├── .env              # Environment variables (ignored by git)
├── package.json
└── README.md
