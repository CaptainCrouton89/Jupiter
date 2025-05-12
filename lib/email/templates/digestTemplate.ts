export interface EmailSummaryItem {
  emailTitle: string; // Original subject or a title for this email's summary
  source: string; // Original sender
  category?: string; // Optional: category for this email
  summaryType: "sentence" | "bullets"; // Type of summary content
  content: string | string[]; // Holds the summary sentence or array of bullet points
  receivedAt?: string; // Added for displaying email date
}

export interface DigestEmailData {
  overallTitle: string;
  hookIntro: string;
  emailSummaries: EmailSummaryItem[];
  userName?: string; // Optional: for personalization
  categoryName?: string; // Added back for category-specific styling
}

// Define accent colors for categories (re-added)
const CATEGORY_ACCENT_COLORS: Record<string, string> = {
  newsletter: "#6989d0", // Softer Blue
  marketing: "#f0c76e", // Muted Yellow-Orange
  receipt: "#6bbd8b", // Softer Green
  invoice: "#d67a8c", // Muted Red-Pink
  finances: "#a48cb8", // Softer Purple
  "code-related": "#7ac5c1", // Muted Teal
  notification: "#7a8899", // Lighter Slate Grey
  "account-related": "#7ab3e8", // Softer Dodger Blue
  personal: "#7ec2bb", // Softer Teal/Turquoise
  default: "#9ca5ad", // Lighter Grey
};

// Helper function to darken/lighten a hex color (basic implementation - re-added)
function adjustColor(color: string, percent: number): string {
  let r = parseInt(color.substring(1, 3), 16);
  let g = parseInt(color.substring(3, 5), 16);
  let b = parseInt(color.substring(5, 7), 16);

  r = Math.min(255, Math.max(0, Math.round(r * (1 + percent))));
  g = Math.min(255, Math.max(0, Math.round(g * (1 + percent))));
  b = Math.min(255, Math.max(0, Math.round(b * (1 + percent))));

  return `#${r.toString(16).padStart(2, "0")}${g
    .toString(16)
    .padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

export function getDigestHtmlTemplate(data: DigestEmailData): string {
  const { overallTitle, hookIntro, emailSummaries, userName, categoryName } =
    data;

  const accentColor =
    categoryName && CATEGORY_ACCENT_COLORS[categoryName.toLowerCase()]
      ? CATEGORY_ACCENT_COLORS[categoryName.toLowerCase()]
      : CATEGORY_ACCENT_COLORS.default;

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
      background-color: ${accentColor};
      color: #ffffff;
      padding: 35px 25px;
      text-align: center;
      border-bottom: 5px solid ${adjustColor(accentColor, -0.2)};
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
      border-left: 4px solid ${accentColor};
    }
    .email-summary-item h2 {
      font-size: 1.25em; /* Email subject size */
      color: ${accentColor};
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
      color: ${
        accentColor === CATEGORY_ACCENT_COLORS.receipt ||
        accentColor === CATEGORY_ACCENT_COLORS.invoice
          ? "#20bf6b"
          : accentColor
      };
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
      color: ${accentColor};
      text-decoration: none;
      font-weight: 500;
    }
    .footer a:hover {
      text-decoration: underline;
    }
  `;

  const greeting = userName ? `<p class="greeting">Hi ${userName},</p>` : "";

  const emailSummariesHtml = emailSummaries
    .map((item) => {
      let summaryContentHtml = "";
      if (item.summaryType === "sentence") {
        summaryContentHtml = `<p>${item.content as string}</p>`;
      } else if (
        item.summaryType === "bullets" &&
        Array.isArray(item.content)
      ) {
        summaryContentHtml = `
          <ul>
            ${(item.content as string[])
              .map((point) => `<li>${point}</li>`)
              .join("")}
          </ul>
        `;
      }

      const dateString = item.receivedAt
        ? new Date(item.receivedAt).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          })
        : "";

      return `
        <div class="email-summary-item">
          <h2>${item.emailTitle}</h2>
          <p class="email-source">From: ${item.source}${
        dateString ? ` | Received: ${dateString}` : ""
      }</p>
          ${summaryContentHtml}
        </div>
      `;
    })
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
