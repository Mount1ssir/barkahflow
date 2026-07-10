// app/auth/reset-pin-sent/page.tsx
'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle } from 'lucide-react'

export default function ResetPinSentPage() {
  const router = useRouter()

  return (
    <div className="fixed inset-0 z-[100] bg-white dark:bg-zinc-900 flex flex-col items-center justify-center p-6">
      <Card className="max-w-md w-full rounded-2xl shadow-xl">
        <CardHeader>
          <CardTitle className="text-center">Email envoyé</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center mx-auto">
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
            <p className="text-gray-600 dark:text-gray-300">
              Un lien de réinitialisation a été envoyé à votre adresse email.
            </p>
            <p className="text-sm text-gray-400">
              Ouvrez l'email et cliquez sur le lien pour réinitialiser votre code PIN.
            </p>
            <Button
              onClick={() => router.push('/')}
              className="w-full mt-2 rounded-xl"
            >
              Retourner à la page de connexion
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}