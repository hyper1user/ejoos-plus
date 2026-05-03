import type { ReactNode } from 'react'

interface PageHeaderProps {
  eyebrow?: string
  title: string
  sub?: string
  actions?: ReactNode
}

export default function PageHeader({
  eyebrow,
  title,
  sub,
  actions,
}: PageHeaderProps): JSX.Element {
  return (
    <div className="page-header">
      <div className="titles">
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {sub && <div className="sub">{sub}</div>}
      </div>
      {actions && <div className="actions">{actions}</div>}
    </div>
  )
}
