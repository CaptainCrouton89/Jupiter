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
                  <SidebarMenuButton tooltip="Inbox" isActive>
                    <Inbox className="size-4" />
                    <span>Inbox</span>
                    <SidebarMenuBadge>24</SidebarMenuBadge>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton tooltip="Starred">
                    <Star className="size-4" />
                    <span>Starred</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton tooltip="Sent">
                    <Send className="size-4" />
                    <span>Sent</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton tooltip="Drafts">
                    <FileText className="size-4" />
                    <span>Drafts</span>
                    <SidebarMenuBadge>2</SidebarMenuBadge>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton tooltip="Archive">
                    <Archive className="size-4" />
                    <span>Archive</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton tooltip="Spam">
                    <AlertOctagon className="size-4" />
                    <span>Spam</span>
                    <SidebarMenuBadge>5</SidebarMenuBadge>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton tooltip="Trash">
                    <Trash2 className="size-4" />
                    <span>Trash</span>
                  </SidebarMenuButton>
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
