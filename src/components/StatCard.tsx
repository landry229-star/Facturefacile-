import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import type { ReactNode } from 'react'

export function StatCard({ title, value, suffix, change, trend, icon, tone, period = true, detail, onClick, destination }: {
  title: string
  value: string
  suffix?: string
  change: string
  trend: 'up' | 'down'
  icon: ReactNode
  tone: string
  period?: boolean
  detail?: string
  onClick?: () => void
  destination?: string
}) {
  const content = <><div className={`stat-icon ${tone}`}>{icon}</div><p>{title}</p><strong>{value} <small>{suffix}</small></strong>{detail && <small className="stat-detail">{detail}</small>}<span className={trend === 'up' ? 'positive' : 'negative'}>{trend === 'up' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{change}{period && <em>ce mois</em>}{onClick && <em> · Voir {destination}</em>}</span></>
  return onClick
    ? <button type="button" className="stat-card stat-card-link" onClick={onClick} aria-label={`${title} : ${value} ${suffix ?? ''}. Ouvrir ${destination ?? 'le détail'}.`}>{content}</button>
    : <div className="stat-card">{content}</div>
}
