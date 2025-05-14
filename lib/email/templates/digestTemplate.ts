import {
  CATEGORY_ACCENT_COLORS,
  adjustColorBrightness,
  getCategoryColor,
} from "@/lib/email/categoryColors";

export interface EmailSummaryItem {
  emailTitle: string; // Original subject or a title for this email's summary
  emailContent: string; // Original content of the email
  source: string; // Original sender
  category: string;
  summaryType: "sentence" | "sentence-only" | "bullets";
  title: string; // Title for this email's summary
  content?: string;
  bullets?: string[];
  receivedAt: string; // Added for displaying email date
  categoryName?: string; // Added back for category-specific styling
}

export interface DigestEmailData {
  overallTitle: string;
  hookIntro: string;
  emailSummaries: EmailSummaryItem[];
  userName?: string; // Optional: for personalization
  categoryName?: string; // Added back for category-specific styling
}

export function getDigestHtmlTemplate(data: DigestEmailData): string {
  const { overallTitle, hookIntro, emailSummaries, userName, categoryName } =
    data;

  const accentColor = getCategoryColor(categoryName);

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
      border-bottom: 5px solid ${adjustColorBrightness(accentColor, -20)};
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
    .email-summary-item .summary-title-only { /* Style for sentence-only type */
      font-size: 1.1em;
      color: #333; /* Main text color */
      margin-top: 0;
      margin-bottom: 8px;
      font-weight: 500;
    }
    .email-summary-item .summary-content-paragraph { /* Style for sentence type content */
      font-size: 1em;
      color: #444;
      margin-top: 8px;
      margin-bottom: 0;
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
        accentColor === CATEGORY_ACCENT_COLORS.payments
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
      let titleHtml = `<h2>${item.title || item.emailTitle}</h2>`; // Default title

      if (item.summaryType === "sentence") {
        summaryContentHtml = `<p class="summary-content-paragraph">${
          item.content || ""
        }</p>`;
      } else if (item.summaryType === "sentence-only") {
        // For sentence-only, the 'title' field IS the sentence. No separate h2.
        titleHtml = ""; // Clear default h2
        summaryContentHtml = `<p class="summary-title-only">${
          item.title || ""
        }</p>`;
      } else if (item.summaryType === "bullets") {
        // The existing Array.isArray(item.content) check was incorrect here as per EmailSummaryItem.
        // bullets are in item.bullets
        if (Array.isArray(item.bullets) && item.bullets.length > 0) {
          summaryContentHtml = `
            <ul>
              ${item.bullets.map((point) => `<li>${point}</li>`).join("")}
            </ul>
          `;
        } else {
          // Fallback if bullets are expected but not present or empty
          summaryContentHtml = "<p><em>No bullet points available.</em></p>";
        }
      } else if (item.summaryType === "title-only") {
        // For title-only, the 'title' field IS the title. No separate h2.
        titleHtml = ""; // Clear default h2
        summaryContentHtml = `<p class="summary-title-only">${
          item.title || ""
        }</p>`;
      } else {
        // Fallback for unknown or undefined summaryType
        summaryContentHtml =
          "<p><em>Summary not available in the expected format.</em></p>";
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
          ${titleHtml}
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
