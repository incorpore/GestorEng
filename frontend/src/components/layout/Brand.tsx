import { useQuery } from '@tanstack/react-query'
import { Building } from 'lucide-react'
import { api } from '@/core/api'
import { absUrl } from '@/core/platform'

export function useMarca() {
  return useQuery({ queryKey: ['marca'], queryFn: () => api.get('/publico/marca'), staleTime: 3600_000, retry: 1 })
}

export function Brand({ big = false }: { big?: boolean }) {
  const { data } = useMarca()
  return (
    <div className="flex items-center gap-2.5">
      {data?.tem_logo ? <img src={absUrl('/api/publico/logo')} alt="" className={big ? 'h-12' : 'h-8'} />
        : <span className="rounded-lg bg-primary p-1.5 text-white"><Building className={big ? 'h-7 w-7' : 'h-5 w-5'} /></span>}
      <span className={big ? 'text-2xl font-bold tracking-tight' : 'text-base font-semibold tracking-tight'}>{data?.nome || 'Struvia'}</span>
    </div>
  )
}
