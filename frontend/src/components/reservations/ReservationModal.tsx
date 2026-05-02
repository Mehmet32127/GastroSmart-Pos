import React, { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { reservationsApi } from '@/api/reservations'
import { tablesApi } from '@/api/tables'
import type { Reservation, Table } from '@/types'
import { useState } from 'react'
import { Copy, Check, Printer } from 'lucide-react'
import toast from 'react-hot-toast'

const schema = z.object({
  guestCount: z.coerce.number().min(1).max(50),
  tableId: z.string().optional(),
  date: z.string().min(1, 'Tarih gerekli'),
  time: z.string().min(1, 'Saat gerekli'),
  endTime: z.string().optional(),
  deposit: z.coerce.number().min(0).optional(),
  note: z.string().max(200, 'En fazla 200 karakter').optional(),
})

type FormData = z.infer<typeof schema>

interface ReservationModalProps {
  isOpen: boolean
  onClose: () => void
  reservation?: Reservation
  onSuccess: () => void
}

export const ReservationModal: React.FC<ReservationModalProps> = ({
  isOpen, onClose, reservation, onSuccess,
}) => {
  const [tables, setTables] = useState<Table[]>([])
  const [isLoading, setIsLoading] = useState(false)
  // Yeni rezervasyon başarıyla oluşunca kodu burada tutar — ekranda büyük gösterilir
  const [createdReservation, setCreatedReservation] = useState<Reservation | null>(null)
  const [copied, setCopied] = useState(false)
  const isEdit = !!reservation

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      guestCount: 2,
    },
  })

  useEffect(() => {
    tablesApi.getAll().then(({ data }) => setTables(data.data || [])).catch(() => {})
  }, [])

  useEffect(() => {
    if (!isOpen) return
    if (reservation) {
      reset({
        guestCount: reservation.guestCount,
        tableId: reservation.tableId || '',
        date: reservation.date,
        time: reservation.time,
        endTime: reservation.endTime || '',
        deposit: reservation.deposit ?? 0,
        note: reservation.note || '',
      })
    } else {
      reset({
        guestCount: 2,
        tableId: '',
        date: new Date().toISOString().split('T')[0],
        time: '',
        endTime: '',
        deposit: 0,
        note: '',
      })
    }
  }, [reservation, reset, isOpen])

  const onSubmit = async (data: FormData) => {
    setIsLoading(true)
    // Boş optional string alanları undefined'a dönüştür — backend regex'ini geçemez
    const payload = {
      ...data,
      endTime: data.endTime || undefined,
      tableId: data.tableId || undefined,
    }
    try {
      if (isEdit && reservation) {
        await reservationsApi.update(reservation.id, payload)
        toast.success('Rezervasyon güncellendi')
        onSuccess()
        onClose()
      } else {
        const res = await reservationsApi.create(payload)
        const created = res.data.data
        if (created) {
          // Modal'ı kapatma — onay ekranına geç (kod görüntüsü)
          setCreatedReservation(created)
          onSuccess()
        } else {
          toast.success('Rezervasyon oluşturuldu')
          onSuccess()
          onClose()
        }
      }
    } catch {
      toast.error('İşlem başarısız')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopyCode = async () => {
    if (!createdReservation?.code) return
    try {
      await navigator.clipboard.writeText(createdReservation.code)
      setCopied(true)
      toast.success('Kod kopyalandı')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Kopyalanamadı — manuel olarak alın')
    }
  }

  const handlePrintCode = () => {
    if (!createdReservation?.code) return
    const code = createdReservation.code
    const tableInfo = createdReservation.tableName ? `Masa: ${createdReservation.tableName}` : ''
    const w = window.open('', '_blank', 'width=400,height=300')
    if (!w) return
    w.document.write(`
      <html>
        <head><title>Rezervasyon Kodu</title>
          <style>
            body { font-family: monospace; text-align: center; padding: 20px; }
            .code { font-size: 64px; font-weight: bold; letter-spacing: 8px; margin: 20px 0; padding: 20px; border: 2px dashed #000; }
            .info { margin: 8px 0; font-size: 14px; }
            .footer { margin-top: 20px; font-size: 11px; color: #666; }
          </style>
        </head>
        <body>
          <div class="info"><strong>REZERVASYON KODU</strong></div>
          <div class="code">${code}</div>
          <div class="info">${createdReservation.date} - ${createdReservation.time}</div>
          <div class="info">${createdReservation.guestCount} kişi</div>
          ${tableInfo ? `<div class="info">${tableInfo}</div>` : ''}
          <div class="footer">Bu kodu rezervasyon günü gelirken yanınızda bulundurun.</div>
          <script>window.print(); window.onafterprint = () => window.close();</script>
        </body>
      </html>
    `)
    w.document.close()
  }

  const handleCloseAll = () => {
    setCreatedReservation(null)
    setCopied(false)
    onClose()
  }

  const tableOptions = [
    { value: '', label: 'Masa seçin (isteğe bağlı)' },
    ...tables.map((t) => ({ value: t.id, label: `${t.name} (${t.capacity} kişi)` })),
  ]

  // Onay ekranı — yeni rezervasyon başarıyla oluşunca açılır
  if (createdReservation) {
    return (
      <Modal
        isOpen={true}
        onClose={handleCloseAll}
        title="Rezervasyon Oluşturuldu"
        size="md"
        footer={
          <Button onClick={handleCloseAll}>Tamam</Button>
        }
      >
        <div className="space-y-4 py-2">
          <p className="text-sm text-[var(--color-text-muted)] font-body text-center">
            Müşterinize bu kodu verin. Rezervasyon günü kodu söylediğinde sistemde aratılacak.
          </p>

          <div className="rounded-2xl border-2 border-dashed border-[var(--color-accent)]/40 bg-[var(--color-accent)]/5 p-6 text-center">
            <p className="text-xs text-[var(--color-text-muted)] font-body mb-2 uppercase tracking-wider">Rezervasyon Kodu</p>
            <p className="text-5xl font-bold font-mono text-[var(--color-accent)] tracking-[0.3em] select-all">
              {createdReservation.code}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-[var(--color-surface2)] rounded-xl p-3">
              <p className="text-[10px] text-[var(--color-text-muted)] font-body uppercase">Tarih</p>
              <p className="text-sm font-semibold font-body text-[var(--color-text)] mt-1">{createdReservation.date}</p>
            </div>
            <div className="bg-[var(--color-surface2)] rounded-xl p-3">
              <p className="text-[10px] text-[var(--color-text-muted)] font-body uppercase">Saat</p>
              <p className="text-sm font-semibold font-mono text-[var(--color-accent)] mt-1">{createdReservation.time}</p>
            </div>
            <div className="bg-[var(--color-surface2)] rounded-xl p-3">
              <p className="text-[10px] text-[var(--color-text-muted)] font-body uppercase">Kişi</p>
              <p className="text-sm font-semibold font-body text-[var(--color-text)] mt-1">{createdReservation.guestCount}</p>
            </div>
          </div>

          {createdReservation.tableName && (
            <div className="bg-[var(--color-surface2)] rounded-xl p-3 text-center">
              <p className="text-[10px] text-[var(--color-text-muted)] font-body uppercase">Masa</p>
              <p className="text-sm font-semibold font-body text-[var(--color-text)] mt-1">📍 {createdReservation.tableName}</p>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant="secondary"
              fullWidth
              icon={copied ? <Check size={14} /> : <Copy size={14} />}
              onClick={handleCopyCode}
            >
              {copied ? 'Kopyalandı' : 'Kodu Kopyala'}
            </Button>
            <Button
              variant="secondary"
              fullWidth
              icon={<Printer size={14} />}
              onClick={handlePrintCode}
            >
              Yazdır
            </Button>
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Rezervasyon Düzenle' : 'Yeni Rezervasyon'}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>İptal</Button>
          <Button loading={isLoading} onClick={handleSubmit(onSubmit)}>
            {isEdit ? 'Güncelle' : 'Oluştur'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <Input
            label="Kişi Sayısı *"
            type="number"
            min={1}
            error={errors.guestCount?.message}
            {...register('guestCount')}
          />
          <Input
            label="Tarih *"
            type="date"
            error={errors.date?.message}
            {...register('date')}
          />
          <Input
            label="Saat *"
            type="time"
            error={errors.time?.message}
            {...register('time')}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Bitiş Saati"
            type="time"
            {...register('endTime')}
          />
          <Input
            label="Kapora (₺)"
            type="number"
            min={0}
            placeholder="0"
            error={errors.deposit?.message}
            {...register('deposit')}
          />
        </div>

        <Select
          label="Masa"
          options={tableOptions}
          {...register('tableId')}
        />

        <Textarea
          label="Not (kısa, kişisel veri yazmayın)"
          placeholder="ör. pencere kenarı, doğum günü"
          {...register('note')}
        />
      </form>
    </Modal>
  )
}
