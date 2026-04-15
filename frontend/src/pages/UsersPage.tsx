import React, { useEffect, useState, useCallback } from 'react'
import { Plus, Edit2, Trash2, Key, ToggleLeft, ToggleRight, Shield } from 'lucide-react'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { Badge, Card, Spinner, EmptyState } from '@/components/ui/common'
import { usersApi } from '@/api/users'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { getInitials, cn, formatDateTime } from '@/utils/format'
import type { User, UserRole } from '@/types'
import toast from 'react-hot-toast'

const ROLE_CONFIG: Record<UserRole, { label: string; badge: 'default' | 'success' | 'warning' | 'info'; desc: string }> = {
  admin:   { label: 'Yönetici', badge: 'default', desc: 'Tüm yetkiler' },
  manager: { label: 'Müdür',    badge: 'warning',  desc: 'Rapor, tema, menü, ödeme' },
  waiter:  { label: 'Garson',   badge: 'success',  desc: 'Sipariş alma' },
}

const userSchema = z.object({
  username: z.string().min(3, 'En az 3 karakter'),
  fullName: z.string().min(2, 'Ad Soyad gerekli'),
  email: z.string().email('Geçersiz e-posta').optional().or(z.literal('')),
  phone: z.string().optional(),
  role: z.enum(['admin', 'manager', 'waiter']),
  password: z.string().min(8, 'En az 8 karakter').optional().or(z.literal('')),
})

type UserForm = z.infer<typeof userSchema>

export const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editUser, setEditUser] = useState<User | undefined>()
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [resetPwId, setResetPwId] = useState<string | null>(null)
  const [newPw, setNewPw] = useState('')
  const isEdit = !!editUser

  const { register, handleSubmit, reset, formState: { errors } } = useForm<UserForm>({
    resolver: zodResolver(userSchema),
    defaultValues: { role: 'waiter' },
  })

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const { data } = await usersApi.getAll()
      setUsers(data.data || [])
    } catch { toast.error('Kullanıcılar yüklenemedi') }
    finally { setIsLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const openModal = (user?: User) => {
    setEditUser(user)
    if (user) {
      reset({ username: user.username, fullName: user.fullName, email: user.email || '', phone: user.phone || '', role: user.role as 'admin' | 'manager' | 'waiter', password: '' })
    } else {
      reset({ role: 'waiter' })
    }
    setModalOpen(true)
  }

  const onSubmit = async (data: UserForm) => {
    try {
      if (isEdit && editUser) {
        const { password, ...rest } = data
        await usersApi.update(editUser.id, rest)
        toast.success('Kullanıcı güncellendi')
      } else {
        await usersApi.create(data as Parameters<typeof usersApi.create>[0])
        toast.success('Kullanıcı oluşturuldu')
      }
      setModalOpen(false)
      load()
    } catch { toast.error('İşlem başarısız') }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await usersApi.delete(deleteId)
      toast.success('Kullanıcı silindi')
      setDeleteId(null)
      load()
    } catch { toast.error('Silinemedi') }
  }

  const handleToggle = async (id: string) => {
    try {
      await usersApi.toggleActive(id)
      load()
    } catch { toast.error('Durum değiştirilemedi') }
  }

  const handleResetPw = async () => {
    if (!resetPwId || !newPw) return
    try {
      await usersApi.resetPassword(resetPwId, newPw)
      toast.success('Şifre sıfırlandı')
      setResetPwId(null)
      setNewPw('')
    } catch { toast.error('Şifre sıfırlanamadı') }
  }

  const roleOptions = [
    { value: 'admin',   label: 'Yönetici' },
    { value: 'manager', label: 'Müdür' },
    { value: 'waiter',  label: 'Garson' },
  ]

  return (
    <div className="p-5 max-w-5xl mx-auto space-y-5 overflow-y-auto h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-display text-[var(--color-text)]">Kullanıcılar</h1>
          <p className="text-sm text-[var(--color-text-muted)] font-body">{users.length} kullanıcı</p>
        </div>
        <Button icon={<Plus size={16} />} onClick={() => openModal()}>Yeni Kullanıcı</Button>
      </div>

      {/* Role legend */}
      <div className="grid grid-cols-3 gap-2">
        {(Object.entries(ROLE_CONFIG) as [UserRole, typeof ROLE_CONFIG[UserRole]][]).map(([role, cfg]) => (
          <Card key={role} padding="sm">
            <div className="flex items-center gap-2 mb-1">
              <Shield size={12} className="text-[var(--color-text-muted)]" />
              <Badge variant={cfg.badge}>{cfg.label}</Badge>
            </div>
            <p className="text-xs text-[var(--color-text-muted)] font-body">{cfg.desc}</p>
          </Card>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40"><Spinner size={32} /></div>
      ) : users.length === 0 ? (
        <EmptyState icon={<Shield size={24} />} title="Kullanıcı yok"
          action={<Button size="sm" icon={<Plus size={14} />} onClick={() => openModal()}>Ekle</Button>} />
      ) : (
        <div className="space-y-2">
          {users.map((user) => {
            const cfg = ROLE_CONFIG[user.role as UserRole] || { label: user.role, badge: 'default' as const, desc: '' }
            return (
              <div key={user.id}
                className="flex items-center gap-4 p-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl hover:border-[var(--color-accent)]/20 transition-all shadow-card">
                <div className="w-10 h-10 rounded-xl bg-[var(--color-accent)]/20 border border-[var(--color-accent)]/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-[var(--color-accent)] font-display font-bold text-sm">
                    {getInitials(user.fullName)}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-[var(--color-text)] font-body">{user.fullName}</p>
                    <Badge variant={cfg.badge}>{cfg.label}</Badge>
                    {!user.active && <Badge variant="danger">Pasif</Badge>}
                  </div>
                  <p className="text-xs text-[var(--color-text-muted)] font-body mt-0.5">
                    @{user.username}{user.email ? ` · ${user.email}` : ''}
                  </p>
                </div>

                <p className="text-xs text-[var(--color-text-muted)] font-body hidden md:block">
                  {formatDateTime(user.createdAt)}
                </p>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => handleToggle(user.id)}
                    className={cn('p-1.5 rounded-lg transition-colors',
                      user.active ? 'text-green-400 hover:bg-green-500/10' : 'text-red-400 hover:bg-red-500/10'
                    )} title={user.active ? 'Pasife Al' : 'Aktive Et'}>
                    {user.active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                  </button>
                  <button onClick={() => setResetPwId(user.id)}
                    className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-amber-500/10 hover:text-amber-400 transition-colors" title="Şifre Sıfırla">
                    <Key size={14} />
                  </button>
                  <button onClick={() => openModal(user)}
                    className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface2)] transition-colors">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => setDeleteId(user.id)}
                    className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-red-500/10 hover:text-red-400 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)}
        title={isEdit ? 'Kullanıcı Düzenle' : 'Yeni Kullanıcı'} size="md"
        footer={<>
          <Button variant="secondary" onClick={() => setModalOpen(false)}>İptal</Button>
          <Button onClick={handleSubmit(onSubmit)}>{isEdit ? 'Güncelle' : 'Oluştur'}</Button>
        </>}>
        <form className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Ad Soyad *" error={errors.fullName?.message} {...register('fullName')} />
            <Input label="Kullanıcı Adı *" error={errors.username?.message} {...register('username')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="E-posta" type="email" {...register('email')} />
            <Input label="Telefon" {...register('phone')} />
          </div>
          <Select label="Rol *" options={roleOptions} {...register('role')} />
          {!isEdit && (
            <Input label="Şifre *" type="password" error={errors.password?.message} {...register('password')} />
          )}
        </form>
      </Modal>

      <Modal isOpen={!!resetPwId} onClose={() => setResetPwId(null)} title="Şifre Sıfırla" size="sm"
        footer={<>
          <Button variant="secondary" onClick={() => setResetPwId(null)}>İptal</Button>
          <Button onClick={handleResetPw} disabled={newPw.length < 8}>Sıfırla</Button>
        </>}>
        <Input label="Yeni Şifre" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)}
          hint="En az 8 karakter" />
      </Modal>

      <ConfirmDialog isOpen={!!deleteId} onConfirm={handleDelete} onCancel={() => setDeleteId(null)}
        title="Kullanıcı Sil" message="Bu kullanıcıyı silmek istediğinizden emin misiniz?" confirmText="Sil" danger />
    </div>
  )
}
