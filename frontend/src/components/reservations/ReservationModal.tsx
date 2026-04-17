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
import toast from 'react-hot-toast'

const schema = z.object({
  customerName: z.string().min(2, 'En az 2 karakter'),
  customerPhone: z.string().min(10, 'Geçerli telefon').max(15),
  customerEmail: z.string().email('Geçersiz e-posta').optional().or(z.literal('')),
  guestCount: z.coerce.number().min(1).max(50),
  tableId: z.string().optional(),
  date: z.string().min(1, 'Tarih gerekli'),
  time: z.string().min(1, 'Saat gerekli'),
  endTime: z.string().optional(),
  deposit: z.coerce.number().min(0).optional(),
  note: z.string().optional(),
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
        customerName: reservation.customerName,
        customerPhone: reservation.customerPhone,
        customerEmail: reservation.customerEmail || '',
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
        customerName: '',
        customerPhone: '',
        customerEmail: '',
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
      endTime:       data.endTime       || undefined,
      tableId:       data.tableId       || undefined,
      customerEmail: data.customerEmail || undefined,
    }
    try {
      if (isEdit && reservation) {
        await reservationsApi.update(reservation.id, payload)
        toast.success('Rezervasyon güncellendi')
      } else {
        await reservationsApi.create(payload)
        toast.success('Rezervasyon oluşturuldu')
      }
      onSuccess()
      onClose()
    } catch {
      toast.error('İşlem başarısız')
    } finally {
      setIsLoading(false)
    }
  }

  const tableOptions = [
    { value: '', label: 'Masa seçin (isteğe bağlı)' },
    ...tables.map((t) => ({ value: t.id, label: `${t.name} (${t.capacity} kişi)` })),
  ]

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
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Müşteri Adı *"
            placeholder="Ad Soyad"
            error={errors.customerName?.message}
            {...register('customerName')}
          />
          <Input
            label="Telefon *"
            placeholder="0500 000 00 00"
            error={errors.customerPhone?.message}
            {...register('customerPhone')}
          />
        </div>

        <Input
          label="E-posta"
          type="email"
          placeholder="ornek@mail.com"
          error={errors.customerEmail?.message}
          {...register('customerEmail')}
        />

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
          label="Not"
          placeholder="Özel istek, allerji vb."
          {...register('note')}
        />
      </form>
    </Modal>
  )
}
