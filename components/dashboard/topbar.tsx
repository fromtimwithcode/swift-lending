"use client";

import { Menu, Settings } from "lucide-react";
import Link from "next/link";
import { NotificationBell } from "./notification-bell";

interface TopbarProps {
  onMenuClick: () => void;
}

export function Topbar({ onMenuClick }: TopbarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-background/80 px-4 backdrop-blur-sm sm:px-6">
      {/* Mobile menu button */}
      <button
        onClick={onMenuClick}
        className="lg:hidden rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <Menu className="size-5" />
      </button>

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        <NotificationBell />
        <Link
          href="/dashboard/settings"
          className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Settings"
        >
          <Settings className="size-5" />
        </Link>
      </div>
    </header>
  );
}
