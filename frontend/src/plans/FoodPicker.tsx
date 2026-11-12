import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Plus, Search, UtensilsCrossed } from 'lucide-react'
import { Modal, ModalClose } from '../clients/ui'
import type { Dish, Meal } from './types'
import { numberValue, round, uid } from './utils'

type Props = {
  open: boolean
  onClose: () => void
  dishes: Dish[]
  categories: string[]
  units: { unit: string; grams: number }[]
  onAdd: (meal: Meal, keepOpen: boolean) => void
}

export default function FoodPicker({ open, onClose, dishes, categories, units, onAdd }: Props) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [keepOpen, setKeepOpen] = useState(true)
  const [tab, setTab] = useState<'catalogue' | 'manual'>('catalogue')
  const [manual, setManual] = useState({ name: '', qty: '1', unit: 'Serving', calories: '' })
  const [added, setAdded] = useState<string[]>([])
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) {
      setQuery('')
      setCategory('All')
      setTab('catalogue')
      setAdded([])
      setManual({ name: '', qty: '1', unit: 'Serving', calories: '' })
      return
    }
    const timer = window.setTimeout(() => searchRef.current?.focus(), 60)
    return () => window.clearTimeout(timer)
  }, [open])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return dishes.filter((dish) => {
      if (category !== 'All' && dish.category !== category) return false
      if (!needle) return true
      return dish.name.toLowerCase().includes(needle) || dish.category.toLowerCase().includes(needle)
    })
  }, [dishes, query, category])

  function addDish(dish: Dish) {
    const grams = units.find((unit) => unit.unit === dish.unit)?.grams ?? dish.grams
    onAdd(
      {
        id: uid('meal'),
        food_id: dish.id,
        name: dish.name,
        qty: 1,
        unit: dish.unit,
        portion: `1 ${dish.unit}`,
        grams_per_unit: round(grams, 2),
        kcal_per_unit: dish.kcal,
        protein_per_unit: dish.protein,
        carbs_per_unit: dish.carbs,
        fat_per_unit: dish.fat,
        calories: dish.kcal,
        protein: dish.protein,
        carbs: dish.carbs,
        fat: dish.fat,
        note: '',
        recipe: '',
        alternatives: []
      },
      keepOpen
    )
    setAdded((current) => [...current, dish.id])
  }

  function addManual() {
    const qty = Math.max(numberValue(manual.qty, 1), 0.01)
    const calories = Math.max(numberValue(manual.calories), 0)
    if (!manual.name.trim()) return
    onAdd(
      {
        id: uid('meal'),
        food_id: 'custom',
        name: manual.name.trim().toUpperCase(),
        qty,
        unit: manual.unit,
        portion: `${qty} ${manual.unit}`,
        grams_per_unit: units.find((unit) => unit.unit === manual.unit)?.grams ?? 30,
        kcal_per_unit: round(calories / qty, 4),
        protein_per_unit: 0,
        carbs_per_unit: 0,
        fat_per_unit: 0,
        calories,
        protein: 0,
        carbs: 0,
        fat: 0,
        note: '',
        recipe: '',
        alternatives: []
      },
      keepOpen
    )
    setManual({ name: '', qty: '1', unit: 'Serving', calories: '' })
    if (!keepOpen) onClose()
  }

  return (
    <Modal open={open} onClose={onClose} labelledBy="food-picker-title" className="pl-picker-modal">
      <div className="cf-modal-head">
        <div>
          <span className="eyebrow">Food catalogue</span>
          <h2 id="food-picker-title">Add food</h2>
          <p className="cf-modal-lede">
            {dishes.length} dishes with portions and calories. Pick one, or add a manual entry when the dish is not listed.
          </p>
        </div>
        <ModalClose onClose={onClose} />
      </div>

      <div className="pl-picker-tabs" role="tablist" aria-label="Add food mode">
        <button type="button" role="tab" aria-selected={tab === 'catalogue'} className={tab === 'catalogue' ? 'active' : ''} onClick={() => setTab('catalogue')}>
          <UtensilsCrossed size={14} /> Catalogue
        </button>
        <button type="button" role="tab" aria-selected={tab === 'manual'} className={tab === 'manual' ? 'active' : ''} onClick={() => setTab('manual')}>
          <Plus size={14} /> Manual entry
        </button>
      </div>

      {tab === 'catalogue' ? (
        <>
          <label className="pl-picker-search">
            <Search size={16} aria-hidden="true" />
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search dishes — eggs, dal, chapati, chicken…"
              aria-label="Search the food catalogue"
            />
            {query && (
              <button type="button" className="pl-link" onClick={() => setQuery('')}>Clear</button>
            )}
          </label>
          <div className="pl-chips" role="group" aria-label="Filter by category">
            {['All', ...categories].map((item) => (
              <button type="button" key={item} className={category === item ? 'pl-chip active' : 'pl-chip'} onClick={() => setCategory(item)}>
                {item}
              </button>
            ))}
          </div>
          <div className="pl-picker-list" role="list">
            {filtered.length === 0 && (
              <p className="pl-picker-empty">No dishes match “{query}”. Try a different word, or use a manual entry.</p>
            )}
            {filtered.map((dish) => (
              <button
                type="button"
                key={dish.id}
                role="listitem"
                className={`pl-dish ${added.includes(dish.id) ? 'added' : ''}`}
                onClick={() => addDish(dish)}
              >
                <span className="pl-dish-main">
                  <strong>{dish.name}</strong>
                  <small>
                    {dish.category} · 1 {dish.unit} · {Math.round(dish.grams)} g
                  </small>
                </span>
                <span className="pl-dish-kcal">
                  {round(dish.kcal, 1).toLocaleString()}
                  <small>kcal</small>
                </span>
                <span className="pl-dish-add" aria-hidden="true">{added.includes(dish.id) ? <Check size={15} /> : <Plus size={15} />}</span>
              </button>
            ))}
          </div>
          <label className="pl-keep-open">
            <input type="checkbox" checked={keepOpen} onChange={(event) => setKeepOpen(event.target.checked)} />
            Keep this window open to add several dishes
          </label>
        </>
      ) : (
        <form
          className="pl-manual"
          onSubmit={(event) => {
            event.preventDefault()
            addManual()
          }}
        >
          <label className="cf-field">
            <span className="cf-label">Dish name</span>
            <input value={manual.name} onChange={(event) => setManual({ ...manual, name: event.target.value })} placeholder="e.g. Homemade ragi dosa" autoFocus />
          </label>
          <div className="cf-two">
            <label className="cf-field">
              <span className="cf-label">Quantity</span>
              <input type="number" min={0} step="0.25" value={manual.qty} onChange={(event) => setManual({ ...manual, qty: event.target.value })} />
            </label>
            <label className="cf-field">
              <span className="cf-label">Unit</span>
              <select value={manual.unit} onChange={(event) => setManual({ ...manual, unit: event.target.value })}>
                {units.map((unit) => <option key={unit.unit} value={unit.unit}>{unit.unit}</option>)}
              </select>
            </label>
          </div>
          <label className="cf-field">
            <span className="cf-label">Calories for this portion</span>
            <input type="number" min={0} step="1" value={manual.calories} onChange={(event) => setManual({ ...manual, calories: event.target.value })} placeholder="e.g. 180" />
          </label>
          <p className="cf-hint">Use a manual entry when a dish is not in the catalogue or the client sends a home recipe. Macros stay blank.</p>
          <div className="cf-modal-actions">
            <button type="button" className="secondary-button" onClick={onClose}>Close</button>
            <button type="submit" className="primary-button" disabled={!manual.name.trim()}>
              <Plus size={15} /> Add manual entry
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}
