'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { ArrowLeft, Printer, Download } from 'lucide-react'
import { getInvoiceById, getInvoiceLines, type Invoice, type InvoiceLine } from '@/lib/invoice-data'
import { formatMAD } from '@/lib/stats-data'
import { getCompanySettings, type CompanySettings } from '@/lib/company-settings'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

// ─── Palette bleu ciel ───
const BLUE = '#38BDF8'
const BLUE_LIGHT = '#E0F2FE'
const BLUE_DARK = '#0284C7'
const GRAY_50 = '#F9FAFB'
const GRAY_100 = '#F3F4F6'
const GRAY_200 = '#E5E7EB'
const GRAY_600 = '#6B7280'
const GRAY_900 = '#111827'

export default function InvoicePage() {
  const { t } = useTranslation()
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [lines, setLines] = useState<InvoiceLine[]>([])
  const [company, setCompany] = useState<CompanySettings | null>(null)
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
            background: '#ffffff',
            fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            color: GRAY_900,
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
            minHeight: '297mm',
            padding: '32px 36px',
            position: 'relative',
          }}
        >
          {/* ─── HEADER ─── */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: '28px',
              borderBottom: `1px solid ${GRAY_200}`,
              paddingBottom: '20px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  background: BLUE_LIGHT,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  flexShrink: 0,
                  border: `1px solid ${GRAY_200}`,
                }}
              >
                {company.logoUrl ? (
                  <img
                    src={company.logoUrl}
                    alt="Logo"
                    style={{ width: '48px', height: '48px', objectFit: 'contain' }}
                  />
                ) : (
                  <span style={{ fontSize: '22px', fontWeight: 700, color: BLUE }}>
                    {(company.companyName || 'E').charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div>
                <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: GRAY_900 }}>
                  {company.companyName || 'Mon Entreprise'}
                </h1>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: GRAY_600 }}>
                  Facture N° {invoice.invoiceNumber}
                </p>
              </div>
            </div>
            <div style={{ textAlign: 'right', fontSize: '13px', color: GRAY_600, lineHeight: 1.6 }}>
              {company.phone && <div>📞 {company.phone}</div>}
              {company.email && <div>✉ {company.email}</div>}
              {(company.address || company.city) && (
                <div>📍 {[company.address, company.city].filter(Boolean).join(', ')}</div>
              )}
              <div style={{ marginTop: '6px', fontSize: '12px', color: GRAY_600 }}>
                Date : {new Date(invoice.createdAt).toLocaleDateString('fr-FR')}
              </div>
            </div>
          </div>

          {/* ─── CORPS ─── */}
          <div>
            {/* Client */}
            <div
              style={{
                background: GRAY_50,
                borderRadius: '10px',
                padding: '14px 18px',
                marginBottom: '28px',
                borderLeft: `3px solid ${BLUE}`,
              }}
            >
              <p style={{ margin: '0 0 4px', fontSize: '11px', color: GRAY_600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Facturé à
              </p>
              <p style={{ margin: '0 0 2px', fontSize: '15px', fontWeight: 600, color: GRAY_900 }}>
                {invoice.clientName || 'Client de passage'}
              </p>
              {invoice.clientAddress && (
                <p style={{ margin: '2px 0', fontSize: '13px', color: GRAY_600 }}>{invoice.clientAddress}</p>
              )}
              {invoice.clientPhone && (
                <p style={{ margin: '2px 0', fontSize: '13px', color: GRAY_600 }}>📞 {invoice.clientPhone}</p>
              )}
              {invoice.clientEmail && (
                <p style={{ margin: '2px 0', fontSize: '13px', color: GRAY_600 }}>✉ {invoice.clientEmail}</p>
              )}
            </div>

            {/* Tableau des articles — structure inchangée */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', marginBottom: '28px' }}>
              <thead>
                <tr style={{ background: GRAY_100, color: GRAY_600 }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    Articles
                  </th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    Description
                  </th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    Qté
                  </th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    Prix HT
                  </th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    Remise
                  </th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    Montant HT
                  </th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, idx) => (
                  <tr
                    key={line.id}
                    style={{
                      borderBottom: idx === lines.length - 1 ? 'none' : `1px solid ${GRAY_200}`,
                    }}
                  >
                    <td style={{ padding: '10px 12px', fontWeight: 500, color: GRAY_900 }}>
                      Article {idx + 1}
                    </td>
                    <td style={{ padding: '10px 12px', color: GRAY_600 }}>{line.productName || '—'}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: GRAY_900 }}>
                      {line.qty}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: GRAY_900 }}>
                      {formatMAD(line.unitPrice)}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: line.discount > 0 ? '#E67E22' : GRAY_200 }}>
                      {line.discount > 0 ? `${line.discount}%` : '—'}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: GRAY_900 }}>
                      {formatMAD(line.subtotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totaux */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
              <div style={{ minWidth: '260px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: '13px', color: GRAY_600, borderBottom: `1px solid ${GRAY_200}` }}>
                  <span>Total HT</span>
                  <span>{formatMAD(totalHT)}</span>
                </div>
                {totalDiscount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: '13px', color: '#E67E22', borderBottom: `1px solid ${GRAY_200}` }}>
                    <span>Remise totale</span>
                    <span>- {formatMAD(Math.round(totalDiscount))}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: '13px', color: GRAY_600, borderBottom: `1px solid ${GRAY_200}` }}>
                  <span>TVA {taxRate}%</span>
                  <span>{formatMAD(taxAmount)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0 4px', fontSize: '18px', fontWeight: 800, borderTop: `2px solid ${BLUE}`, color: GRAY_900 }}>
                  <span>TOTAL TTC</span>
                  <span style={{ color: BLUE }}>{formatMAD(totalTTC)}</span>
                </div>
              </div>
            </div>

            {/* Informations légales */}
            {(company.ice || company.rc || company.ifNumber || company.cnss || company.bankName || company.rib) && (
              <div style={{ background: GRAY_50, borderRadius: '8px', padding: '10px 14px', fontSize: '11px', color: GRAY_600, marginBottom: '16px', display: 'flex', flexWrap: 'wrap', gap: '6px 20px' }}>
                {company.ice && <span><strong>ICE :</strong> {company.ice}</span>}
                {company.rc && <span><strong>RC :</strong> {company.rc}</span>}
                {company.ifNumber && <span><strong>IF :</strong> {company.ifNumber}</span>}
                {company.cnss && <span><strong>CNSS :</strong> {company.cnss}</span>}
                {company.bankName && <span><strong>Banque :</strong> {company.bankName}</span>}
                {company.rib && <span><strong>RIB :</strong> {company.rib}</span>}
              </div>
            )}

            {/* Pied de page personnalisé */}
            {company.invoiceFooter && (
              <p style={{ fontSize: '11px', color: GRAY_600, textAlign: 'center', margin: '0', borderTop: `1px solid ${GRAY_200}`, paddingTop: '16px' }}>
                {company.invoiceFooter}
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  )
}