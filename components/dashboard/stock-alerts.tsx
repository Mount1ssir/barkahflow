'use client'

import { useEffect, useState } from 'react'
import { Bell, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { getStockAlerts, type StockAlert } from '@/lib/stock-alerts-data'

// ✅ AJOUT : Imports pour les traductions
import { useTranslation } from 'react-i18next'
import '@/lib/i18n/config'

export function StockAlerts() {
  // ✅ AJOUT : Hook de traduction
  const { t } = useTranslation()

  const [alerts, setAlerts] = useState<StockAlert[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getStockAlerts(4)
      .then(setAlerts)
      .finally(() => setLoading(false))
  }, [])

  return (
    <Card className="rounded-2xl border shadow-sm h-full">
      <CardHeader>
        <CardTitle className="text-base font-semibold">
          {t('stock_alerts.title', 'Alertes & notifications')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex flex-col gap-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
          </div>
        ) : alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-10">
            <div className="h-20 w-20 rounded-full flex items-center justify-center mb-4 bg-amber-50">
              <Bell className="h-9 w-9" style={{ color: '#c9a84c' }} />
            </div>
            <h4 className="text-base font-semibold text-foreground mb-1">
              {t('stock_alerts.empty_title', 'Aucune alerte')}
            </h4>
            <p className="text-sm text-muted-foreground mb-5 max-w-[220px]">
              {t('stock_alerts.empty_description', 'Vous serez notifié ici des événements importants.')}
            </p>
            <Button variant="outline" className="gap-1 rounded-xl text-sm">
              {t('stock_alerts.view_all', 'Voir toutes les alertes')} <ChevronRight size={14} />
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {alerts.map((alert) => (
              <div key={alert.productId} className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium text-foreground">{alert.nameAr}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('stock_alerts.remaining', 'Stock restant')} : {alert.stockQty}
                  </p>
                </div>
                <Badge variant={alert.severity === 'critical' ? 'destructive' : 'secondary'}>
                  {alert.severity === 'critical'
                    ? t('stock_alerts.critical', 'Critique')
                    : t('stock_alerts.low', 'Faible')}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}