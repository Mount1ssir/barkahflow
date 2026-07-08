"use client";

import { useEffect, useState } from 'react'
import { supabase } from '@/src/lib/supabase'
import { Sidebar } from '@/components/dashboard/sidebar'
import { TopBar } from '@/components/dashboard/topbar'
import { PinProvider, usePin } from '@/components/pin/pin-context'
import { PinLockScreen } from '@/components/pin/PinLockScreen'
import { isPinEnabled } from '@/lib/pin-storage'
import { NotificationProvider } from '@/context/NotificationContext'

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { isLocked, unlockApp } = usePin()
  const [user, setUser] = useState<any>(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const isPlaceholder =
        !process.env.NEXT_PUBLIC_SUPABASE_URL ||
        process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder");
      if (!data.session && !isPlaceholder) {
        window.location.href = "/";
      } else {
        const dummyUser = data.session?.user || {
          email: "dev@barkahflow.com",
          user_metadata: { full_name: "Developer" },
        };
        setUser(dummyUser);
        setChecking(false);
      }
    });
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div
          className="w-8 h-8 rounded-full border-2 animate-spin"
          style={{ borderColor: "#c9a84c", borderTopColor: "transparent" }}
        />
      </div>
    );
  }

  return (
<<<<<<< HEAD
    <>
      <div className="flex min-h-screen bg-muted/30 dark:bg-background">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar user={user} />
          <main className="flex-1 overflow-auto p-6">
            {children}
          </main>
        </div>
      </div>

      {isPinEnabled() && isLocked && (
        <PinLockScreen onSuccess={unlockApp} />
      )}
    </>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <PinProvider>
      <NotificationProvider>
        <DashboardContent>{children}</DashboardContent>
      </NotificationProvider>
    </PinProvider>
  )
}
=======
    <div className="flex min-h-screen bg-muted/30 dark:bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar user={user} />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
>>>>>>> main
