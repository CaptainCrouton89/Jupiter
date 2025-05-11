import * as z from "zod";

export const emailConnectionSchema = z.object({
  emailAddress: z.string().email({ message: "Invalid email address" }),
  password: z.string().min(1, { message: "Password is required" }),
  imapServer: z.string().min(1, { message: "IMAP server is required" }),
  imapPort: z.coerce
    .number()
    .min(1, { message: "IMAP port is required" })
    .max(65535, { message: "Invalid port number" }),
  smtpServer: z.string().min(1, { message: "SMTP server is required" }),
  smtpPort: z.coerce
    .number()
    .min(1, { message: "SMTP port is required" })
    .max(65535, { message: "Invalid port number" }),
  security: z.enum(["SSL/TLS", "STARTTLS", "None"], {
    required_error: "Security type is required",
  }),
  accountName: z
    .string()
    .min(1, { message: "Account name is required" })
    .optional(), // Optional, user can name this connection
});

export type EmailConnectionFormValues = z.infer<typeof emailConnectionSchema>;
