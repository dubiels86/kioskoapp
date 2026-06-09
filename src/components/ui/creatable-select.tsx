'use client'

import * as React from 'react'
import { Check, ChevronsUpDown, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

interface CreatableSelectProps {
  options: { value: string; label: string }[]
  value: string
  onValueChange: (value: string) => void
  onCreate: (value: string) => Promise<string | void>
  placeholder?: string
  searchPlaceholder?: string
  createLabel?: string
  emptyLabel?: string
  className?: string
  disabled?: boolean
}

export function CreatableSelect({
  options,
  value,
  onValueChange,
  onCreate,
  placeholder = 'Seleccionar...',
  searchPlaceholder = 'Buscar...',
  createLabel = "Crear '{0}'",
  emptyLabel = 'No se encontraron resultados.',
  className,
  disabled = false,
}: CreatableSelectProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const [creating, setCreating] = React.useState(false)

  const selectedOption = options.find((option) => option.value === value)

  // Determine if the current search text matches any option (case-insensitive)
  const searchLower = search.trim().toLowerCase()
  const hasExactMatch = options.some(
    (option) => option.label.toLowerCase() === searchLower
  )
  const showCreateOption = searchLower.length > 0 && !hasExactMatch

  const handleCreate = async () => {
    const trimmed = search.trim()
    if (!trimmed) return

    setCreating(true)
    try {
      const result = await onCreate(trimmed)
      const newValue = result ?? trimmed
      onValueChange(newValue)
      setOpen(false)
      setSearch('')
    } finally {
      setCreating(false)
    }
  }

  const handleSelect = (currentValue: string) => {
    onValueChange(currentValue === value ? '' : currentValue)
    setOpen(false)
    setSearch('')
  }

  return (
    <Popover open={open} onOpenChange={(nextOpen) => {
      setOpen(nextOpen)
      if (!nextOpen) setSearch('')
    }}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn('w-full justify-between font-normal', className)}
        >
          {selectedOption ? selectedOption.label : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>{emptyLabel}</CommandEmpty>
            <CommandGroup>
              {options
                .filter((option) =>
                  option.label.toLowerCase().includes(searchLower)
                )
                .map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    onSelect={handleSelect}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === option.value ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    {option.label}
                  </CommandItem>
                ))}
              {showCreateOption && (
                <CommandItem
                  onSelect={handleCreate}
                  disabled={creating}
                  className="text-primary"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {createLabel.replace('{0}', search.trim())}
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
