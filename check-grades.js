require('dotenv').config({ path: '/root/docker/openvpn-server/pki/renewed/qis_checker/.env' });
const puppeteer = require("puppeteer");
const nodemailer = require("nodemailer");

// URLs from environment
const LOGIN_URL = process.env.LOGIN_URL;
const GRADES_URL = process.env.GRADES_URL;

// QIS credentials
const USERNAME = process.env.QIS_USER;
const PASSWORD = process.env.QIS_PASS;

// Email credentials
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const EMAIL_TO = process.env.EMAIL_TO;

// Target date
const TARGET_DATE = process.env.TARGET_DATE;

// Configure nodemailer
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS
  }
});

(async () => {
  if (!USERNAME || !PASSWORD) {
    console.error("❌ Missing QIS_USER or QIS_PASS in .env");
    process.exit(1);
  }

  const browser = await puppeteer.launch({
    headless: true,  // keep true for server/cron
    executablePath: '/root/docker/openvpn-server/pki/renewed/qis_checker/chrome/linux-145.0.7608.0/chrome-linux64/chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  // 1️⃣ Login
  await page.goto(LOGIN_URL, { waitUntil: "networkidle2" });
  await page.type('input[name="asdf"]', USERNAME);
  await page.type('input[name="fdsa"]', PASSWORD);

  await Promise.all([
    page.click('input[type="submit"]'),
    page.waitForNavigation({ waitUntil: "networkidle2" })
  ]);
  console.log("✅ Logged in");

  // 2️⃣ Grades page
  await page.goto(GRADES_URL, { waitUntil: "networkidle2" });

  // Wait for menu and click second last item
  await page.waitForSelector("ul.liste li a.auflistung");
  await Promise.all([
    page.evaluate(() => {
      const items = document.querySelectorAll("ul.liste li a.auflistung");
      if (items.length < 2) throw new Error("Not enough menu items found");
      items[items.length - 2].click();
    }),
    page.waitForNavigation({ waitUntil: "networkidle2" })
  ]);
  console.log("✅ Clicked: Leistungsübersicht (alle Leistungen)");

  // Click tree item to open the list
  await page.waitForSelector('ul.treelist li.treelist a[href*="next=list.vm"]');
  await Promise.all([
    page.click('ul.treelist li.treelist a[href*="next=list.vm"]'),
    page.waitForNavigation({ waitUntil: "networkidle2" })
  ]);
  console.log("✅ Opened Abschluss → Leistungen list");

  // 3️⃣ Get current update date
  const currentDate = await page.evaluate(() => {
    const cells = [...document.querySelectorAll("td.qis_kontoOnTop")];
    if (!cells.length) return null;
    const dateCell = cells.reverse().find(td => /\d{2}\.\d{2}\.\d{4}/.test(td.innerText));
    return dateCell ? dateCell.innerText.trim() : null;
  });
  console.log("📅 Current update date:", currentDate);

  // 4️⃣ Extract only the two target courses
  const courses = await page.evaluate(() => {
    const rows = [...document.querySelectorAll("tr")];
    return rows
      .map(row => {
        const cells = [...row.querySelectorAll("td")];
        if (cells.length < 4) return null;

        const courseName = cells[1]?.innerText.trim();
        let gradeText = cells[3]?.innerText.replace(/\s+/g, " ").trim();
        const grade = gradeText && /\d+,\d+/.test(gradeText) ? gradeText : null;

        if (
          courseName === "System Theory and Modeling" ||
          courseName === "Bisher erbrachte Credits und vorläufige Durchschnittsnote der PO-Version 3819"
        ) {
          const courseId = cells[0]?.innerText.trim();
          return { courseId, courseName, grade };
        }
        return null;
      })
      .filter(Boolean);
  });
  
  const now = new Date();

  // 5️⃣ Send email if date matches
  if (currentDate !== TARGET_DATE) {
    console.log("📅 Something changed:", currentDate);
    console.log("Courses to notify:", courses);

    const courseText = courses.map(c =>
      `Course ID: ${c.courseId}\nName: ${c.courseName}\nGrade: ${c.grade ?? "N/A"}`
    ).join("\n\n");

    await transporter.sendMail({
      from: `"STAMP Bot" <${EMAIL_USER}>`,
      to: EMAIL_TO,
      subject: `Grades Updated - ${TARGET_DATE}`,
      text: courseText
    });

    console.log("📧 Email sent to", EMAIL_TO, now);
  } else {
    console.log("No update till now.", now);
  }

  await browser.close();
})();
