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
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border/80 to-transparent" />
      <div className="flex items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border/60 bg-muted/40 text-sm font-semibold text-foreground">
              A
            </div>
            <div className="leading-tight">
              <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Workspace</p>
              <p className="text-sm font-semibold text-foreground">{workspace.name}</p>
              <p className="text-xs text-muted-foreground">
                {membershipRole} {userRole === "ADMIN" && membershipRole !== "ADMIN" ? "(org admin)" : ""}
              </p>
            </div>
          </div>
          <div className="hidden h-8 w-px bg-border/60 md:block" />
          <nav className="flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 p-1 text-sm font-medium text-muted-foreground">
            {links.map((link) => {
              const isActive = pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "rounded-full px-3 py-1.5 transition-all hover:text-foreground",
                    isActive ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
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
                  "rounded-full px-3 py-1.5 transition-all hover:text-foreground",
                  pathname.startsWith("/admin") ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
                )}
              >
                Admin
              </Link>
            ) : null}
          </nav>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="hidden items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-xs text-muted-foreground md:flex">
            <span className="h-2 w-2 rounded-full bg-emerald-400/70" />
            <span className="max-w-[220px] truncate">{userEmail}</span>
          </div>
          <ThemeToggle />
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
