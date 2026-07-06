'use client'

import { useEffect, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { ArrowLeft, Printer, Download } from 'lucide-react'
import {
  getInvoiceById,
  getInvoiceLines,
  getInvoicePaymentInfo,
  amountToFrenchWords,
  type Invoice,
  type InvoiceLine,
  type InvoicePaymentInfo,
} from '@/lib/invoice-data'
import { formatMAD } from '@/lib/stats-data'
import { getCompanySettings, type CompanySettings } from '@/lib/company-settings'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

// ─── Palette ──────────────────────────────────────────────────────
const BLUE = '#2563EB'
const BLUE_DARK = '#1E40AF'
const GRAY_50 = '#F9FAFB'
const GRAY_100 = '#F3F4F6'
const GRAY_200 = '#E5E7EB'
const GRAY_600 = '#6B7280'
const GRAY_900 = '#111827'
const RED = '#DC2626'
const RED_LIGHT = '#FEF2F2'
const ORANGE = '#F59E0B'
const GREEN = '#16A34A'
const WHITE = '#FFFFFF'

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Espèces',
  card: 'TPE',
  mobile: 'Mobile',
  mixed: 'Mixte',
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  PAID: { label: 'PAYÉE', color: GREEN, bg: '#F0FDF4' },
  PARTIAL: { label: 'PAIEMENT PARTIEL', color: ORANGE, bg: '#FFFBEB' },
  UNPAID: { label: 'IMPAYÉE', color: RED, bg: RED_LIGHT },
}

// ─── Vague décorative SOUS le bandeau texte — jamais de texte dessus ───
function WaveStrip() {
  return (
    <svg
      viewBox="0 0 800 40"
      preserveAspectRatio="none"
      style={{ display: 'block', width: '100%', height: '34px' }}
    >
      <path
        d="M0,0 H800 V10 C620,38 560,2 400,16 C240,30 160,4 0,20 Z"
        fill={BLUE}
      />
    </svg>
  )
}

// ─── Bandeau vague (bas), miroir du haut ──────────────────────────
function WaveFooter() {
  return (
    <svg
      viewBox="0 0 800 100"
      preserveAspectRatio="none"
      style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '70px', zIndex: 0, transform: 'scaleY(-1)' }}
    >
      <path
        d="M0,0 L800,0 L800,32 C620,88 560,8 400,42 C240,76 160,14 0,52 Z"
        fill={BLUE}
      />
    </svg>
  )
}

// ─── Logo de l'entreprise (vrai logo uploadé si présent, sinon losange) ───
function CompanyLogo({ logoUrl, companyName }: { logoUrl: string; companyName: string }) {
  if (logoUrl) {
    return (
      <div
        style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          background: WHITE,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          flexShrink: 0,
          border: `1.5px solid ${WHITE}`,
        }}
      >
        <img src={logoUrl} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      </div>
    )
  }
  return (
    <div
      style={{
        width: '20px',
        height: '20px',
        border: `2px solid ${WHITE}`,
        transform: 'rotate(45deg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <div style={{ width: '6px', height: '6px', background: WHITE, borderRadius: '1px' }} />
    </div>
  )
}

export default function InvoicePage() {
  const { t } = useTranslation()
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [lines, setLines] = useState<InvoiceLine[]>([])
  const [company, setCompany] = useState<CompanySettings | null>(null)
  const [paymentInfo, setPaymentInfo] = useState<InvoicePaymentInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const invoiceRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (id) loadInvoice()
  }, [id])

  const loadInvoice = async () => {
    try {
      const [invData, linesData, companyData] = await Promise.all([
        getInvoiceById(id),
        getInvoiceLines(id),
        getCompanySettings(),
      ])
      if (!invData) {
        toast.error('Facture introuvable')
        router.push('/dashboard/factures')
        return
      }
      setInvoice(invData)
      setLines(linesData)
      setCompany(companyData)

      if (invData.status !== 'PAID') {
        const payInfo = await getInvoicePaymentInfo(invData.id, invData.total)
        setPaymentInfo(payInfo)
      }
    } catch (error) {
      console.error(error)
      toast.error('Erreur chargement facture')
    } finally {
      setLoading(false)
    }
  }

  const handlePrint = () => window.print()
  const handleDownloadPDF = async () => {
    if (!invoiceRef.current) return
    setDownloading(true)
    try {
      const canvas = await html2canvas(invoiceRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF('p', 'mm', 'a4')
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight)
      pdf.save(`facture_${invoice?.invoiceNumber || 'facture'}.pdf`)
      toast.success('PDF téléchargé')
    } catch (error) {
      console.error(error)
      toast.error('Erreur lors du téléchargement')
    } finally {
      setDownloading(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Skeleton className="h-12 w-48 mb-4" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    )
  }

  if (!invoice || !company) {
    return (
      <div className="max-w-4xl mx-auto p-6 text-center">
        <h2 className="text-xl font-bold">Facture introuvable</h2>
        <Button onClick={() => router.push('/dashboard/factures')} className="mt-4">
          Retour aux factures
        </Button>
      </div>
    )
  }

  const totalHT = invoice.subtotal
  const totalTTC = invoice.total
  const taxAmount = invoice.tax
  const taxRate = totalHT > 0 ? Math.round((taxAmount / totalHT) * 100) : company.tvaRate || 0
  const totalDiscount = lines.reduce((acc, l) => acc + (l.unitPrice * l.qty * l.discount / 100), 0)

  const paymentMethod = (invoice as any)?.paymentMethod || (invoice as any)?.payment_method
  const paymentLabel = paymentMethod ? PAYMENT_METHOD_LABELS[paymentMethod] || paymentMethod : '—'

  const statusConfig = STATUS_CONFIG[invoice.status] || null
  const isNotFullyPaid = invoice.status === 'PARTIAL' || invoice.status === 'UNPAID'

  const dueDate = invoice.dueDate ? new Date(invoice.dueDate) : null
  const now = new Date()
  const isOverdue = isNotFullyPaid && dueDate && dueDate.getTime() < now.getTime()

  const amountInWords = amountToFrenchWords(totalTTC)

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #invoice-print-area, #invoice-print-area * { visibility: visible !important; }
          #invoice-print-area {
            position: fixed !important;
            top: 0; left: 0;
            width: 100vw;
            margin: 0;
            padding: 0;
            box-shadow: none !important;
          }
          @page { margin: 0; size: A4; }
        }
      `}</style>

      <div className="max-w-4xl mx-auto p-6 print:hidden">
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" onClick={() => router.push('/dashboard/factures')} className="gap-2 rounded-xl">
            <ArrowLeft className="h-4 w-4" /> Retour
          </Button>
          <div className="flex gap-2">
            <Button onClick={handlePrint} className="gap-2 rounded-xl text-white" style={{ backgroundColor: GRAY_900 }}>
              <Printer className="h-4 w-4" /> Imprimer
            </Button>
            <Button onClick={handleDownloadPDF} disabled={downloading} className="gap-2 rounded-xl text-white" style={{ backgroundColor: BLUE }}>
              <Download className="h-4 w-4" /> {downloading ? 'Génération...' : 'Télécharger PDF'}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 pb-10 print:p-0 print:max-w-none">
        <div
          id="invoice-print-area"
          ref={invoiceRef}
          style={{
            background: WHITE,
            fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            color: GRAY_900,
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
            minHeight: '297mm',
            position: 'relative',
          }}
        >
          {/* ─── BANDEAU HAUT : rectangle bleu solide (texte toujours lisible) ─── */}
          <div style={{ background: BLUE, padding: '20px 36px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 800, letterSpacing: '1.5px', color: WHITE }}>
                FACTURE
              </h1>
              <div style={{ textAlign: 'right' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                  <CompanyLogo logoUrl={company.logoUrl} companyName={company.companyName || 'Mon Entreprise'} />
                  <span style={{ fontSize: '13px', fontWeight: 700, color: WHITE }}>
                    {company.companyName || 'Mon Entreprise'}
                  </span>
                </div>
                {(company.phone || company.email) && (
                  <p style={{ margin: '4px 0 0', fontSize: '10px', color: '#DBEAFE' }}>
                    {[company.phone, company.email].filter(Boolean).join(' • ')}
                  </p>
                )}
              </div>
            </div>
          </div>
          {/* ─── Vague décorative, purement visuelle, aucun texte dessus ─── */}
          <WaveStrip />

          {/* ─── CORPS ─── */}
          <div style={{ padding: '0 36px 24px' }}>

            {/* ─── Boîte Invoice#/Date/Échéance + statut (chevauche légèrement la vague) ─── */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px', marginBottom: '20px' }}>
              <div style={{ textAlign: 'right' }}>
                {statusConfig && isNotFullyPaid && (
                  <span
                    style={{
                      display: 'inline-block',
                      marginBottom: '4px',
                      background: isOverdue ? RED_LIGHT : statusConfig.bg,
                      color: isOverdue ? RED : statusConfig.color,
                      border: `1px solid ${isOverdue ? RED : statusConfig.color}`,
                      borderRadius: '999px',
                      padding: '2px 10px',
                      fontSize: '10px',
                      fontWeight: 700,
                      letterSpacing: '0.4px',
                    }}
                  >
                    {isOverdue ? 'EN RETARD' : statusConfig.label}
                  </span>
                )}
                <div style={{ fontSize: '13px', fontWeight: 700, color: GRAY_900 }}>
                  Facture N° : {invoice.invoiceNumber}
                </div>
                <div style={{ fontSize: '12px', color: GRAY_600 }}>
                  Date : {new Date(invoice.createdAt).toLocaleDateString('fr-FR')}
                </div>
                {dueDate && (
                  <div style={{ fontSize: '12px', color: isOverdue ? RED : GRAY_600, fontWeight: isOverdue ? 700 : 400 }}>
                    Échéance : {dueDate.toLocaleDateString('fr-FR')}
                  </div>
                )}
                {invoice.poNumber && (
                  <div style={{ fontSize: '12px', color: GRAY_600 }}>
                    Réf. commande : {invoice.poNumber}
                  </div>
                )}
              </div>
            </div>

            {/* ─── Facturé à / Infos paiement ─── */}
            <div style={{ display: 'flex', gap: '40px', marginBottom: '24px' }}>
              <div style={{ flex: 1 }}>
                <p style={{ margin: '0 0 4px', fontSize: '11px', color: GRAY_600, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
                  Facturé à
                </p>
                <p style={{ margin: '0 0 2px', fontSize: '15px', fontWeight: 600, color: GRAY_900 }}>
                  {invoice.clientName || 'Client de passage'}
                </p>
                {invoice.clientAddress && (
                  <p style={{ margin: '2px 0', fontSize: '13px', color: GRAY_600 }}>{invoice.clientAddress}</p>
                )}
                {invoice.clientPhone && (
                  <p style={{ margin: '2px 0', fontSize: '13px', color: GRAY_600 }}>{invoice.clientPhone}</p>
                )}
                {invoice.clientEmail && (
                  <p style={{ margin: '2px 0', fontSize: '13px', color: GRAY_600 }}>{invoice.clientEmail}</p>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: '0 0 4px', fontSize: '11px', color: GRAY_600, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
                  Infos paiement
                </p>
                {paymentLabel !== '—' && (
                  <p style={{ margin: '2px 0', fontSize: '13px', color: GRAY_600 }}>
                    <span style={{ fontWeight: 600 }}>Mode :</span> {paymentLabel}
                  </p>
                )}
                {company.bankName && (
                  <p style={{ margin: '2px 0', fontSize: '13px', color: GRAY_600 }}>
                    <span style={{ fontWeight: 600 }}>Banque :</span> {company.bankName}
                  </p>
                )}
                {company.rib && (
                  <p style={{ margin: '2px 0', fontSize: '13px', color: GRAY_600 }}>
                    <span style={{ fontWeight: 600 }}>RIB :</span> {company.rib}
                  </p>
                )}
                {company.ice && (
                  <p style={{ margin: '2px 0', fontSize: '13px', color: GRAY_600 }}>
                    <span style={{ fontWeight: 600 }}>ICE :</span> {company.ice}
                  </p>
                )}
              </div>
            </div>

            {/* ─── Tableau des articles ─── */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', marginBottom: '20px' }}>
              <thead>
                <tr style={{ background: GRAY_100, color: GRAY_600 }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    N°
                  </th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Description
                  </th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Prix
                  </th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Qté
                  </th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, idx) => (
                  <tr
                    key={line.id}
                    style={{ borderBottom: idx === lines.length - 1 ? 'none' : `1px solid ${GRAY_200}` }}
                  >
                    <td style={{ padding: '10px 12px', color: GRAY_600, fontSize: '13px' }}>{idx + 1}.</td>
                    <td style={{ padding: '10px 12px', color: GRAY_900 }}>{line.productName || '—'}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: GRAY_900 }}>
                      {formatMAD(line.unitPrice)}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: GRAY_900 }}>{line.qty}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: GRAY_900 }}>
                      {formatMAD(line.subtotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* ─── Merci + Totaux (deux colonnes, comme le modèle) ─── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '24px', marginBottom: '16px' }}>
              <div style={{ flex: 1, paddingTop: '6px' }}>
                <p style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 600, color: GRAY_900 }}>
                  Merci pour votre confiance
                </p>
              </div>
              <div style={{ minWidth: '220px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '13px', borderBottom: `1px solid ${GRAY_200}` }}>
                  <span>Total HT :</span>
                  <span>{formatMAD(totalHT)}</span>
                </div>
                {totalDiscount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '13px', borderBottom: `1px solid ${GRAY_200}`, color: '#E67E22' }}>
                    <span>Remise :</span>
                    <span>- {formatMAD(Math.round(totalDiscount))}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '13px', borderBottom: `1px solid ${GRAY_200}` }}>
                  <span>TVA :</span>
                  <span>{taxRate}%</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0 4px', fontSize: '18px', fontWeight: 800 }}>
                  <span>Total :</span>
                  <span style={{ color: BLUE }}>{formatMAD(totalTTC)}</span>
                </div>
              </div>
            </div>

            {/* ─── Montant payé / Reste à payer ─── */}
            {isNotFullyPaid && paymentInfo && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
                <div style={{ minWidth: '220px', background: RED_LIGHT, borderRadius: '6px', padding: '10px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: GREEN }}>
                    <span>Payé :</span>
                    <span style={{ fontWeight: 600 }}>{formatMAD(paymentInfo.paidAmount)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 700, color: RED }}>
                    <span>Reste à payer :</span>
                    <span>{formatMAD(paymentInfo.remainingAmount)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* ─── Montant en toutes lettres ─── */}
            <div
              style={{
                background: GRAY_50,
                borderRadius: '6px',
                padding: '10px 14px',
                fontSize: '12px',
                color: GRAY_600,
                marginBottom: '16px',
                fontStyle: 'italic',
              }}
            >
              Montant en lettres : <strong>{amountInWords}</strong>
            </div>

            {/* ─── Termes & conditions ─── */}
            <div style={{ marginBottom: '12px', paddingTop: '10px', borderTop: `1px solid ${GRAY_200}` }}>
              <p style={{ margin: '0 0 4px', fontSize: '11px', color: GRAY_600, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
                Termes &amp; Conditions
              </p>
              <p style={{ margin: 0, fontSize: '11px', color: GRAY_600, lineHeight: 1.5 }}>
                {company.latePaymentPenaltyText || 'Paiement dû sous 30 jours. Tout retard peut entraîner des frais additionnels.'}
              </p>
            </div>

            {/* ─── Signature ─── */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px', marginBottom: '8px' }}>
              <div style={{ textAlign: 'center', minWidth: '160px' }}>
                <p style={{ margin: '0 0 28px', fontSize: '10px', color: GRAY_600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Signature autorisée
                </p>
                <div style={{ borderTop: `1px solid ${GRAY_200}`, width: '80%', margin: '0 auto' }} />
              </div>
            </div>

            {/* ─── Infos légales entreprise (ICE/RC/IF/CNSS déjà donné plus haut si présents dans Payment Info) ─── */}
            {(company.rc || company.ifNumber || company.cnss) && (
              <p style={{ fontSize: '10px', color: GRAY_600, textAlign: 'center', margin: '4px 0 0' }}>
                {[
                  company.rc && `RC : ${company.rc}`,
                  company.ifNumber && `IF : ${company.ifNumber}`,
                  company.cnss && `CNSS : ${company.cnss}`,
                ].filter(Boolean).join('   •   ')}
              </p>
            )}

            {/* ─── Pied de page personnalisé ─── */}
            {company.invoiceFooter && (
              <p style={{ fontSize: '10px', color: GRAY_600, textAlign: 'center', margin: '8px 0 0' }}>
                {company.invoiceFooter}
              </p>
            )}
          </div>

          {/* ─── BANDEAU VAGUE BAS (compact) ─── */}
          <div style={{ position: 'relative', height: '70px', marginTop: '8px' }}>
            <WaveFooter />
          </div>
        </div>
      </div>
    </>
  )
}