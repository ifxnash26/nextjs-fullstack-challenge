"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { SignOutButton } from "./sign-out-button";
import { type RoleValue } from "@/lib/constants";
import { ThemeToggle } from "./theme-toggle";

interface WorkspaceHeaderProps {
  workspace: { id: string; name: string };
  membershipRole: RoleValue;
  userRole: RoleValue;
  userEmail?: string | null;
}

export function WorkspaceHeader({ workspace, membershipRole, userRole, userEmail }: WorkspaceHeaderProps) {
  const pathname = usePathname();
  const links = [
    { href: `/w/${workspace.id}/assets`, label: "Table" },
    { href: `/w/${workspace.id}/assets/board`, label: "Board" },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-primary/15 text-primary flex items-center justify-center font-semibold">A</div>
            <div>
              <p className="text-sm font-semibold text-foreground">{workspace.name}</p>
              <p className="text-xs text-muted-foreground">
                {membershipRole} {userRole === "ADMIN" && membershipRole !== "ADMIN" ? "(org admin)" : ""}
              </p>
            </div>
          </div>
          <nav className="flex items-center gap-3 text-sm font-medium text-muted-foreground">
            {links.map((link) => {
              const isActive = pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "rounded-full px-3 py-1 transition-colors hover:text-foreground",
                    isActive ? "bg-muted text-foreground" : "",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
            {userRole === "ADMIN" ? (
              <Link
                href="/admin/users"
                className={cn(
                  "rounded-full px-3 py-1 transition-colors hover:text-foreground",
                  pathname.startsWith("/admin") ? "bg-muted text-foreground" : "",
                )}
              >
                Admin
              </Link>
            ) : null}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <ThemeToggle />
          <span className="hidden md:inline">{userEmail}</span>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
