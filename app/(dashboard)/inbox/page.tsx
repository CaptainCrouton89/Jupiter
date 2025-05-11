import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Check, Paperclip, Star } from "lucide-react";

// Dummy email data
const emails = [
  {
    id: "1",
    from: { name: "GitHub", email: "noreply@github.com" },
    subject: "Your repository has a new star!",
    preview:
      "Your repository 'jupiter-email' has received a new star on GitHub...",
    date: "2023-05-10T14:30:00Z",
    read: false,
    starred: true,
    hasAttachments: false,
  },
  {
    id: "2",
    from: { name: "Tailwind CSS", email: "news@tailwindcss.com" },
    subject: "Tailwind CSS v4 is here!",
    preview:
      "We're excited to announce the release of Tailwind CSS v4, with a completely new...",
    date: "2023-05-09T10:15:00Z",
    read: true,
    starred: false,
    hasAttachments: true,
  },
  {
    id: "3",
    from: { name: "Vercel", email: "support@vercel.com" },
    subject: "Your deployment is complete",
    preview:
      "Your project 'jupiter-email' has been successfully deployed to production...",
    date: "2023-05-08T18:45:00Z",
    read: true,
    starred: false,
    hasAttachments: false,
  },
  {
    id: "4",
    from: { name: "Anne Wilson", email: "anne@example.com" },
    subject: "Meeting notes from yesterday",
    preview:
      "Here are the meeting notes from our discussion yesterday. We covered the following topics...",
    date: "2023-05-07T09:30:00Z",
    read: false,
    starred: false,
    hasAttachments: true,
  },
  {
    id: "5",
    from: { name: "Sarah Johnson", email: "sarah@example.com" },
    subject: "Weekend plans",
    preview:
      "Hey, I was wondering if you'd like to join us for the hiking trip this weekend. We're planning to...",
    date: "2023-05-06T15:20:00Z",
    read: true,
    starred: true,
    hasAttachments: false,
  },
];

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();

  // Today
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  // Within the last 7 days
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays <= 7) {
    return date.toLocaleDateString([], { weekday: "short" });
  }

  // This year
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  }

  // Older
  return date.toLocaleDateString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function InboxPage() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Inbox</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            Refresh
          </Button>
          <Button variant="outline" size="sm">
            Archive
          </Button>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[30px]"></TableHead>
              <TableHead className="w-[30px]"></TableHead>
              <TableHead className="w-[30px]"></TableHead>
              <TableHead className="w-[200px]">From</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead className="w-[30px]"></TableHead>
              <TableHead className="text-right w-[100px]">Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {emails.map((email) => (
              <TableRow
                key={email.id}
                className={`cursor-pointer ${
                  !email.read ? "font-medium bg-muted/30" : ""
                }`}
              >
                <TableCell className="px-2">
                  <div className="flex items-center justify-center h-4 w-4 rounded border">
                    {email.read && <Check className="h-3 w-3 text-primary" />}
                  </div>
                </TableCell>
                <TableCell className="px-2">
                  <Star
                    className={`h-4 w-4 ${
                      email.starred
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-muted-foreground"
                    }`}
                  />
                </TableCell>
                <TableCell className="px-2">
                  {email.hasAttachments && (
                    <Paperclip className="h-4 w-4 text-muted-foreground" />
                  )}
                </TableCell>
                <TableCell>{email.from.name}</TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className={!email.read ? "font-semibold" : ""}>
                      {email.subject}
                    </span>
                    <span className="text-muted-foreground text-sm truncate max-w-[400px]">
                      {email.preview}
                    </span>
                  </div>
                </TableCell>
                <TableCell></TableCell>
                <TableCell className="text-right text-muted-foreground text-sm">
                  {formatDate(email.date)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
