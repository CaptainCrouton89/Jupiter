export interface EmailSummaryItem {
  emailTitle: string; // Original subject or a title for this email's summary
  source: string; // Original sender
  bulletPoints: string[]; // Summary points for THIS email
}

export interface DigestEmailData {
  overallTitle: string;
  hookIntro: string;
  emailSummaries: EmailSummaryItem[];
  userName?: string; // Optional: for personalization
}

export function getDigestHtmlTemplate(data: DigestEmailData): string {
  const { overallTitle, hookIntro, emailSummaries, userName } = data;

  // Basic styling - recommend using a more robust email framework or inlining tool for production
  const styles = `
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol';
      margin: 0;
      padding: 0;
      background-color: #f0f2f5; /* Light grey-blue background */
      color: #333;
      line-height: 1.6;
      font-size: 16px;
    }
    .container {
      max-width: 680px; /* Slightly wider for better content layout */
      margin: 20px auto;
      background-color: #ffffff;
      border: 1px solid #e0e0e0; /* Softer border */
      border-radius: 12px; /* More rounded corners */
      overflow: hidden;
      box-shadow: 0 6px 18px rgba(0,0,0,0.07);
    }
    .header {
      background-color: #3867d6; /* Vibrant blue */
      color: #ffffff;
      padding: 35px 25px;
      text-align: center;
      border-bottom: 5px solid #2d52a8; /* Darker blue accent */
    }
    .header h1 {
      margin: 0;
      font-size: 26px; /* Slightly reduced for balance */
      font-weight: 600; /* Bolder */
      letter-spacing: 0.5px;
    }
    .content {
      padding: 25px 30px 30px; /* Adjusted padding */
    }
    .greeting {
      font-size: 1.1em;
      font-weight: 500;
      margin-bottom: 15px;
      color: #2c3e50; /* Darker text color */
    }
    .intro-paragraph {
      font-size: 1.05em;
      margin-bottom: 25px;
      color: #555;
      font-style: italic;
    }
    .email-summary-item {
      margin-bottom: 25px;
      padding: 18px;
      background-color: #f9f9f9; /* Light background for each item */
      border-radius: 8px;
      border-left: 4px solid #3867d6; /* Accent border */
    }
    .email-summary-item h2 {
      font-size: 1.25em; /* Email subject size */
      color: #3867d6; /* Match accent color */
      margin-top: 0;
      margin-bottom: 5px;
    }
    .email-source {
      font-size: 0.9em;
      color: #7f8c8d; /* Grey for source */
      margin-bottom: 12px;
    }
    .content ul {
      list-style-type: none;
      padding-left: 0;
      margin-top: 0; /* Remove top margin for lists within summary item */
    }
    .content li {
      margin-bottom: 0.7em;
      padding-left: 28px;
      position: relative;
      font-size: 0.95em;
    }
    .content li::before {
      content: "✔"; /* Checkmark character */
      color: #27ae60; /* Green for checkmark */
      font-size: 16px;
      font-weight: bold;
      display: inline-block;
      position: absolute;
      left: 0;
      top: 1px; /* Fine-tune alignment */
    }
    .footer {
      background-color: #e9ecef;
      color: #6c757d;
      text-align: center;
      padding: 25px;
      font-size: 13px;
      border-top: 1px solid #dee2e6;
    }
    .footer a {
      color: #3867d6;
      text-decoration: none;
      font-weight: 500;
    }
    .footer a:hover {
      text-decoration: underline;
    }
  `;

  const greeting = userName ? `<p class="greeting">Hi ${userName},</p>` : "";

  const emailSummariesHtml = emailSummaries
    .map(
      (item) => `
        <div class="email-summary-item">
          <h2>${item.emailTitle}</h2>
          <p class="email-source">From: ${item.source}</p>
          <ul>
            ${item.bulletPoints.map((point) => `<li>${point}</li>`).join("")}
          </ul>
        </div>
      `
    )
    .join("");

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${overallTitle}</title>
      <style>
        ${styles}
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${overallTitle}</h1>
        </div>
        <div class="content">
          ${greeting}
          <p class="intro-paragraph">${hookIntro}</p>
          ${emailSummariesHtml}
          <p>Hope you find this weekly update useful!</p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} Jupiter Mail. All rights reserved.</p>
          <p>This digest was automatically generated for you.</p>
          <!-- <p><a href="#">Unsubscribe</a> | <a href="#">Manage Preferences</a></p> -->
        </div>
      </div>
    </body>
    </html>
  `;
}
