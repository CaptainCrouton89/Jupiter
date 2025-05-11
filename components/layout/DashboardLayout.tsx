import Link from "next/link";
import React from "react";
import { Header } from "./Header";
// import { Sidebar } from "./Sidebar";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";
// import { Sidebar as OldSidebarContent } from "./Sidebar"; // Renamed to avoid confusion
import {
  AlertOctagon,
  Archive,
  FileText,
  Inbox,
  Send,
  Star,
  Trash2,
} from "lucide-react"; // Added icons

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen flex-col flex-1">
        <Header />
        <div className="flex flex-1">
          <Sidebar>
            <SidebarHeader className="p-4">
              <span className="text-lg font-semibold">Jupiter</span>
            </SidebarHeader>
            <SidebarContent className="p-2">
              <SidebarMenu>
                <SidebarMenuItem>
                  <Link href="/inbox" passHref>
                    <SidebarMenuButton asChild tooltip="Inbox" isActive>
                      <Inbox className="size-4" />
                      <span>Inbox</span>
                      <SidebarMenuBadge>24</SidebarMenuBadge>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <Link href="/starred" passHref legacyBehavior>
                    <SidebarMenuButton asChild tooltip="Starred">
                      <Star className="size-4" />
                      <span>Starred</span>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <Link href="/sent" passHref legacyBehavior>
                    <SidebarMenuButton asChild tooltip="Sent">
                      <Send className="size-4" />
                      <span>Sent</span>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <Link href="/drafts" passHref legacyBehavior>
                    <SidebarMenuButton asChild tooltip="Drafts">
                      <FileText className="size-4" />
                      <span>Drafts</span>
                      <SidebarMenuBadge>2</SidebarMenuBadge>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <Link href="/archive" passHref legacyBehavior>
                    <SidebarMenuButton asChild tooltip="Archive">
                      <Archive className="size-4" />
                      <span>Archive</span>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <Link href="/spam" passHref legacyBehavior>
                    <SidebarMenuButton asChild tooltip="Spam">
                      <AlertOctagon className="size-4" />
                      <span>Spam</span>
                      <SidebarMenuBadge>5</SidebarMenuBadge>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <Link href="/trash" passHref legacyBehavior>
                    <SidebarMenuButton asChild tooltip="Trash">
                      <Trash2 className="size-4" />
                      <span>Trash</span>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarContent>
            {/* Example of SidebarFooter if needed later
            <SidebarFooter className="p-2 mt-auto">
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton tooltip="Settings">
                    <Settings2 className="size-4" />
                    <span>Settings</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton tooltip="Support">
                    <LifeBuoy className="size-4" />
                    <span>Support</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarFooter>
            */}
          </Sidebar>
          <SidebarInset className="p-6">{children}</SidebarInset>
        </div>
      </div>
    </SidebarProvider>
  );
}
