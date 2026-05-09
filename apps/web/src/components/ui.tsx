import {
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PropsWithChildren,
  type ReactNode,
} from 'react'
import { Check, ChevronDown } from 'lucide-react'
import * as Checkbox from '@radix-ui/react-checkbox'
import * as Collapsible from '@radix-ui/react-collapsible'
import * as Popover from '@radix-ui/react-popover'
import * as Select from '@radix-ui/react-select'
import * as Switch from '@radix-ui/react-switch'
import * as ToggleGroup from '@radix-ui/react-toggle-group'

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

export const surfaceClass =
  'border border-bushiri-line bg-bushiri-surface/95 shadow-bushiri-panel backdrop-blur-[10px]'

export const mutedTextClass = 'text-bushiri-muted'

export const inputControlClass =
  'min-h-10 w-full rounded-lg border border-bushiri-line bg-bushiri-surface px-3 text-sm text-bushiri-ink outline-none transition focus:border-bushiri-primary focus:ring-2 focus:ring-bushiri-primary/15'

const controlClass = inputControlClass

const dropdownSurfaceClass =
  'z-30 overflow-hidden rounded-lg border border-bushiri-line bg-bushiri-surface shadow-bushiri-popover'
const scrollableDropdownSurfaceClass =
  'z-30 overflow-x-hidden overflow-y-auto overscroll-contain rounded-lg border border-bushiri-line bg-bushiri-surface shadow-bushiri-popover'

export function PageHeader({
  title,
  description,
  actions,
  eyebrow = 'BUSHIRI workspace',
}: {
  title: string
  description?: string
  actions?: ReactNode
  eyebrow?: string
}) {
  return (
    <section className="flex items-end justify-between gap-6 px-0.5 py-1 max-md:flex-col max-md:items-stretch">
      <div>
        <p className="mb-2 text-[0.72rem] font-bold uppercase text-bushiri-primary">{eyebrow}</p>
        <h1 className="m-0 text-[2.75rem] font-extrabold leading-[0.95] tracking-normal text-bushiri-ink max-md:text-4xl">
          {title}
        </h1>
        {description ? (
          <p className={cn('mt-2 max-w-[36ch] text-[0.98rem] leading-relaxed', mutedTextClass)}>
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-3 max-md:w-full">{actions}</div> : null}
    </section>
  )
}

export function Panel({
  title,
  subtitle,
  actions,
  children,
  className = '',
}: PropsWithChildren<{
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  className?: string
}>) {
  return (
    <section className={cn(surfaceClass, 'rounded-xl p-5', className)}>
      <header className="mb-4 flex items-center justify-between gap-4 border-b border-bushiri-line pb-4 max-md:flex-col max-md:items-stretch">
        <div>
          <h2 className="m-0 text-[1.02rem] font-bold leading-tight tracking-normal text-bushiri-ink">
            {title}
          </h2>
          {subtitle ? (
            <p className={cn('mt-1 max-w-[42ch] text-[0.88rem] leading-relaxed', mutedTextClass)}>
              {subtitle}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-3 max-md:w-full">{actions}</div> : null}
      </header>
      {children}
    </section>
  )
}

export function MetricGrid({
  children,
  className = '',
}: PropsWithChildren<{
  className?: string
}>) {
  return <div className={cn('grid grid-cols-4 gap-4 max-lg:grid-cols-1', className)}>{children}</div>
}

export function MetricCard({
  label,
  value,
  detail,
  className = '',
}: {
  label: string
  value: string
  detail?: string
  className?: string
}) {
  return (
    <article className={cn(surfaceClass, 'flex flex-col gap-1 rounded-lg bg-bushiri-surface/90 p-4 shadow-none', className)}>
      <span className={cn('text-[0.78rem] uppercase tracking-normal', mutedTextClass)}>{label}</span>
      <strong className="text-2xl font-bold tracking-normal text-bushiri-ink tabular-nums">{value}</strong>
      {detail ? <small className={cn('text-[0.78rem] leading-snug', mutedTextClass)}>{detail}</small> : null}
    </article>
  )
}

export function Button({
  children,
  onClick,
  disabled,
  tone = 'default',
  type = 'button',
}: PropsWithChildren<{
  onClick?: () => void
  disabled?: boolean
  tone?: 'default' | 'subtle'
  type?: 'button' | 'submit'
}>) {
  return (
    <button
      className={cn(
        'inline-flex min-h-10 items-center justify-center rounded-lg border px-4 text-sm font-bold transition duration-200 hover:-translate-y-px focus-visible:-translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bushiri-primary active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60',
        tone === 'subtle'
          ? 'border-bushiri-line bg-bushiri-surface text-bushiri-ink'
          : 'border-bushiri-primary bg-bushiri-primary text-white',
      )}
      disabled={disabled}
      onClick={onClick}
      type={type}
    >
      {children}
    </button>
  )
}

export function EmptyState({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="grid min-h-52 place-items-center rounded-lg border border-dashed border-bushiri-line bg-bushiri-surface-muted/70 p-6 text-center">
      <div>
        <h3 className="m-0 text-lg font-bold text-bushiri-ink">{title}</h3>
        <p className={cn('mt-2 leading-relaxed', mutedTextClass)}>{description}</p>
      </div>
    </div>
  )
}

export function ErrorState({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="rounded-lg border border-bushiri-danger/25 bg-bushiri-danger/10 p-5">
      <h3 className="m-0 text-lg font-bold text-bushiri-danger">{title}</h3>
      <p className="mt-2 leading-relaxed text-bushiri-danger">{description}</p>
    </div>
  )
}

export function LoadingBlock({
  rows = 4,
  className = '',
}: {
  rows?: number
  className?: string
}) {
  return (
    <div className={cn('grid gap-3', className)} aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className={cn(
            'h-13 animate-pulse rounded-lg bg-bushiri-line/45',
            className.includes('board') ? 'h-[72px] rounded-md odd:w-[calc(100%-1.5rem)]' : '',
          )}
        />
      ))}
    </div>
  )
}

export function Badge({
  label,
  tone = 'neutral',
}: {
  label: string
  tone?: 'neutral' | 'success' | 'warning' | 'danger'
}) {
  const toneClass = {
    neutral: 'border-bushiri-line bg-bushiri-surface-muted text-bushiri-muted',
    success: 'border-bushiri-success/30 bg-bushiri-success/10 text-bushiri-success',
    warning: 'border-bushiri-warning/30 bg-bushiri-warning/10 text-bushiri-warning',
    danger: 'border-bushiri-danger/30 bg-bushiri-danger/10 text-bushiri-danger',
  }[tone]

  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-bold normal-case', toneClass)}>
      {label}
    </span>
  )
}

export function DataTable({
  columns,
  rows,
  emptyTitle,
  emptyDescription,
}: {
  columns: Array<{ key: string; header: string; render: (row: any) => ReactNode }>
  rows: any[]
  emptyTitle: string
  emptyDescription: string
}) {
  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />
  }

  return (
    <div className="overflow-auto rounded-lg border border-bushiri-line bg-bushiri-surface">
      <table className="w-full min-w-[820px] border-separate border-spacing-0 text-left">
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className="border-b border-bushiri-line bg-bushiri-surface-muted px-4 py-3 text-[0.78rem] font-extrabold uppercase tracking-normal text-bushiri-muted"
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id ?? row.key ?? `${index}`} className="align-top">
              {columns.map((column) => (
                <td key={column.key} className="border-b border-bushiri-line px-4 py-4 text-sm text-bushiri-ink last:border-b-0">
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function LabeledField({
  label,
  helper,
  children,
  as = 'label',
}: PropsWithChildren<{
  label: string
  helper?: string
  as?: 'label' | 'div'
}>) {
  const content = (
    <>
      <span className="text-[0.78rem] font-extrabold tracking-normal text-bushiri-muted">{label}</span>
      {children}
      {helper ? <small className={cn('text-[0.76rem] leading-snug', mutedTextClass)}>{helper}</small> : null}
    </>
  )

  if (as === 'div') {
    return <div className="flex min-w-0 flex-col gap-2">{content}</div>
  }

  return (
    <label className="flex min-w-0 flex-col gap-2">
      {content}
    </label>
  )
}

export type SelectControlOption = {
  value: string
  label: ReactNode
  disabled?: boolean
}

export function SelectControl({
  value,
  onChange,
  options,
  ariaLabel,
  placeholder = '선택',
}: {
  value: string
  onChange: (value: string) => void
  options: SelectControlOption[]
  ariaLabel: string
  placeholder?: string
}) {
  return (
    <Select.Root value={value} onValueChange={onChange}>
      <Select.Trigger
        aria-label={ariaLabel}
        className={cn(controlClass, 'group inline-flex items-center justify-between gap-3 font-bold')}
      >
        <Select.Value placeholder={placeholder} />
        <Select.Icon className="shrink-0 text-bushiri-muted" aria-hidden="true">
          <ChevronDown
            className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180"
            strokeWidth={2.4}
          />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          className={dropdownSurfaceClass}
          position="popper"
          sideOffset={4}
        >
          <Select.Viewport className="max-h-[min(18rem,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] p-1">
            {options.map((option) => (
              <Select.Item
                className="relative flex min-h-9 cursor-pointer select-none items-center rounded-md py-2 pl-3 pr-8 text-sm font-bold text-bushiri-ink outline-none transition data-[disabled]:pointer-events-none data-[highlighted]:bg-bushiri-primary-soft data-[state=checked]:bg-bushiri-surface-muted data-[disabled]:opacity-50"
                disabled={option.disabled}
                key={option.value}
                value={option.value}
              >
                <Select.ItemText>{option.label}</Select.ItemText>
                <Select.ItemIndicator className="absolute right-3 inline-flex h-4 w-4 items-center justify-center text-bushiri-primary">
                  <Check className="h-4 w-4" strokeWidth={2.7} />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  )
}

export type SearchComboboxOption = {
  value: string
  label: string
  searchText?: string
}

export function SearchCombobox({
  value,
  onChange,
  options,
  ariaLabel,
  placeholder,
  emptyMessage = '검색 결과가 없습니다',
}: {
  value: string
  onChange: (value: string) => void
  options: SearchComboboxOption[]
  ariaLabel: string
  placeholder?: string
  emptyMessage?: string
}) {
  const listboxId = useId()
  const anchorRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const normalizedValue = value.trim().toLowerCase()
  const visibleOptions = useMemo(() => {
    const matchingOptions = normalizedValue
      ? options.filter((option) =>
          `${option.value} ${option.label} ${option.searchText ?? ''}`
            .toLowerCase()
            .includes(normalizedValue),
        )
      : options

    return matchingOptions.slice(0, 24)
  }, [normalizedValue, options])

  const selectOption = (nextValue: string) => {
    onChange(nextValue)
    setOpen(false)
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Anchor asChild>
        <div className="relative min-w-0" ref={anchorRef}>
          <input
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-expanded={open}
            aria-label={ariaLabel}
            className={cn(controlClass, 'pr-10')}
            onClick={() => setOpen(true)}
            onChange={(event) => {
              onChange(event.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing) {
                return
              }

              if (event.key === 'Escape') {
                setOpen(false)
              }

              if (event.key === 'Enter' && open && visibleOptions[0]) {
                event.preventDefault()
                selectOption(visibleOptions[0].value)
              }
            }}
            placeholder={placeholder}
            role="combobox"
            type="search"
            value={value}
          />
          <button
            aria-label={`${ariaLabel} 추천 열기`}
            className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-xs font-extrabold text-bushiri-muted transition hover:bg-bushiri-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bushiri-primary active:translate-y-px"
            onClick={() => setOpen((current) => !current)}
            onMouseDown={(event) => event.preventDefault()}
            type="button"
          >
            <ChevronDown
              aria-hidden="true"
              className={cn('h-4 w-4 transition-transform duration-200', open ? 'rotate-180' : '')}
              strokeWidth={2.4}
            />
          </button>
        </div>
      </Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          align="start"
          className={cn(
            scrollableDropdownSurfaceClass,
            'max-h-[min(20rem,var(--radix-popover-content-available-height))] p-1',
          )}
          onInteractOutside={(event) => {
            if (event.target && anchorRef.current?.contains(event.target as Node)) {
              event.preventDefault()
            }
          }}
          onOpenAutoFocus={(event) => event.preventDefault()}
          sideOffset={4}
          style={{ width: 'var(--radix-popover-trigger-width, 22rem)' } as CSSProperties}
        >
          <div id={listboxId} role="listbox" className="grid gap-1">
            {visibleOptions.length > 0 ? (
              visibleOptions.map((option) => (
                <button
                  aria-selected={option.value === value}
                  className={cn(
                    'flex min-h-9 w-full items-center rounded-md px-3 py-2 text-left text-sm font-bold text-bushiri-ink outline-none transition hover:bg-bushiri-primary-soft focus-visible:bg-bushiri-primary-soft',
                    option.value === value ? 'bg-bushiri-surface-muted text-bushiri-primary' : '',
                  )}
                  key={option.value}
                  onClick={() => selectOption(option.value)}
                  role="option"
                  type="button"
                >
                  <span className="truncate">{option.label}</span>
                </button>
              ))
            ) : (
              <div className="rounded-md px-3 py-2 text-sm font-bold text-bushiri-warning">
                {emptyMessage}
              </div>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

export function CheckboxControl({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
}) {
  return (
    <Checkbox.Root
      aria-label={label}
      checked={checked}
      className={cn(
        'grid h-4 w-4 shrink-0 place-items-center rounded border transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bushiri-primary active:translate-y-px',
        checked ? 'border-bushiri-primary bg-bushiri-primary' : 'border-bushiri-line bg-bushiri-surface',
      )}
      onCheckedChange={(nextChecked) => onChange(nextChecked === true)}
    >
      <Checkbox.Indicator>
        <span className="block h-1.5 w-1.5 rounded-sm bg-white" />
      </Checkbox.Indicator>
    </Checkbox.Root>
  )
}

export type SegmentedControlItem = {
  value: string
  label: ReactNode
  detail?: ReactNode
}

export function SegmentedControl({
  value,
  onChange,
  items,
  ariaLabel,
  className = '',
}: {
  value: string
  onChange: (value: string) => void
  items: SegmentedControlItem[]
  ariaLabel: string
  className?: string
}) {
  return (
    <ToggleGroup.Root
      aria-label={ariaLabel}
      className={cn('flex flex-wrap gap-2', className)}
      onValueChange={(nextValue) => {
        if (nextValue) {
          onChange(nextValue)
        }
      }}
      type="single"
      value={value}
    >
      {items.map((item) => (
        <ToggleGroup.Item
          className="group inline-flex min-h-10 items-center justify-center rounded-lg border border-bushiri-line bg-bushiri-surface px-4 text-sm font-extrabold text-bushiri-ink transition duration-200 hover:-translate-y-px focus-visible:-translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bushiri-primary active:translate-y-px data-[state=on]:border-bushiri-primary data-[state=on]:bg-bushiri-primary data-[state=on]:text-white"
          key={item.value}
          value={item.value}
        >
          {item.label}
          {item.detail ? (
            <span className="ml-2 text-xs text-bushiri-muted group-data-[state=on]:text-white/75">
              {item.detail}
            </span>
          ) : null}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  )
}

export function ToggleSwitch({
  checked,
  onChange,
  label,
  onLabel = '켜짐',
  offLabel = '꺼짐',
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  onLabel?: string
  offLabel?: string
}) {
  return (
    <Switch.Root
      aria-label={label}
      checked={checked}
      className="inline-flex min-h-10 w-full min-w-0 items-center justify-between gap-3 overflow-hidden rounded-lg border border-bushiri-line bg-bushiri-surface px-3 text-sm font-bold text-bushiri-ink transition duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bushiri-primary active:translate-y-px"
      onCheckedChange={onChange}
    >
      <span
        className={cn(
          'relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200',
          checked ? 'bg-bushiri-primary' : 'bg-bushiri-line',
        )}
      >
        <Switch.Thumb
          className={cn(
            'absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-bushiri-thumb transition-transform duration-200 will-change-transform',
            checked ? 'translate-x-5' : 'translate-x-0',
          )}
        />
      </span>
      <span className="min-w-0 truncate text-bushiri-muted">{checked ? onLabel : offLabel}</span>
    </Switch.Root>
  )
}

export function SparkBars({
  values,
}: {
  values: Array<{ label: string; value: number }>
}) {
  if (values.length === 0) {
    return (
      <EmptyState
        title="표시할 추이 값이 없습니다"
        description="관측값이 있는 어종을 선택하면 최근 시세 흐름을 막대 그래프로 볼 수 있습니다."
      />
    )
  }

  const maxValue = values.reduce((max, item) => Math.max(max, item.value), 0)
  const safeMax = maxValue > 0 ? maxValue : 1

  return (
    <div className="grid min-h-[260px] grid-cols-[repeat(auto-fit,minmax(28px,1fr))] items-end gap-3" aria-label="추이 막대 그래프">
      {values.map((item, index) => {
        const height = `${Math.max((item.value / safeMax) * 100, 8)}%`

        return (
          <div className="flex flex-col items-center gap-2" key={`${item.label}-${index}`}>
            <div className="flex min-h-[220px] w-full items-end">
              <div
                className="w-full rounded-t-md bg-bushiri-primary"
                style={{ height } as CSSProperties}
              />
            </div>
            <span className={cn('text-xs', mutedTextClass)}>{item.label}</span>
          </div>
        )
      })}
    </div>
  )
}

export function JsonDetails({ value }: { value: unknown }) {
  const [open, setOpen] = useState(false)

  return (
    <Collapsible.Root className="max-w-[28rem]" open={open} onOpenChange={setOpen}>
      <Collapsible.Trigger className="cursor-pointer text-sm font-bold text-bushiri-primary transition hover:-translate-y-px focus-visible:-translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bushiri-primary active:translate-y-px">
        {open ? '원본 payload 접기' : '원본 payload 보기'}
      </Collapsible.Trigger>
      <Collapsible.Content>
        <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-bushiri-ink-soft p-3 text-xs leading-relaxed text-bushiri-surface">
          {JSON.stringify(value, null, 2)}
        </pre>
      </Collapsible.Content>
    </Collapsible.Root>
  )
}
