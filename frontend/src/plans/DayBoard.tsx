import { useMemo, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  Ban,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  GripVertical,
  Info,
  Moon,
  Plus,
  Salad,
  StickyNote,
  Trash2,
  UtensilsCrossed,
  Zap
} from 'lucide-react'
import type { DayDerived, Dish, Meal, PlanData, PlanDay, PlanReference, Slot } from './types'
import { dayStatusLabel, dayTotals, numberValue, portionText, recalcMeal, round, uid } from './utils'
import FoodPicker from './FoodPicker'

const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

type Props = {
  data: PlanData
  derivedDays: DayDerived[]
  reference: PlanReference
  dishes: Dish[]
  locked: boolean
  update: (path: (string | number)[], value: unknown) => void
  onToast: (message: string) => void
}

export default function DayBoard({ data, derivedDays, reference, dishes, locked, update, onToast }: Props) {
  const [selected, setSelected] = useState(0)
  const [pickerSlot, setPickerSlot] = useState<number | null>(null)
  const [expanded, setExpanded] = useState<string>('')
  const [showNotes, setShowNotes] = useState(false)
  const [copyOpen, setCopyOpen] = useState(false)
  const [addSlotOpen, setAddSlotOpen] = useState(false)
  const [dragSlot, setDragSlot] = useState<number | null>(null)
  const [dragMeal, setDragMeal] = useState<{ slot: number; meal: number } | null>(null)

  const day = data.days[selected]
  const derived = derivedDays.find((item) => item.day === day.day)
  const totals = useMemo(() => dayTotals(day), [day])
  const target = day.targets ?? data.targets
  const targetCalories = numberValue(target.calories)
  const diff = totals.calories - targetCalories

  function setDay(patch: Partial<PlanDay>) {
    update(['days', selected], { ...day, ...patch })
  }

  function setSlots(next: Slot[]) {
    setDay({ slots: next })
  }

  function addSlot(name: string, time: string) {
    const next = [...day.slots, { id: uid('slot'), name, time, note: '', meals: [] }]
    setSlots(next)
    setAddSlotOpen(false)
    setPickerSlot(next.length - 1)
  }

  function patchSlot(index: number, patch: Partial<Slot>) {
    setSlots(day.slots.map((slot, position) => (position === index ? { ...slot, ...patch } : slot)))
  }

  function removeSlot(index: number) {
    const slot = day.slots[index]
    if (slot.meals.length && !window.confirm(`Remove “${slot.name}” and its ${slot.meals.length} item(s)?`)) return
    setSlots(day.slots.filter((_, position) => position !== index))
  }

  function moveSlot(from: number, to: number) {
    if (to < 0 || to >= day.slots.length || from === to) return
    const next = day.slots.slice()
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    setSlots(next)
  }

  function addMeal(slotIndex: number, meal: Meal, keepOpen: boolean) {
    const slot = day.slots[slotIndex]
    patchSlot(slotIndex, { meals: [...slot.meals, meal] })
    setExpanded(meal.id)
    if (!keepOpen) setPickerSlot(null)
  }

  function patchMeal(slotIndex: number, mealIndex: number, patch: Partial<Meal>) {
    const slot = day.slots[slotIndex]
    const meal = slot.meals[mealIndex]
    let next: Meal = { ...meal, ...patch }
    if (patch.unit && patch.unit !== meal.unit) {
      const from = reference.units.find((item) => item.unit === meal.unit)?.grams ?? 30
      const to = reference.units.find((item) => item.unit === patch.unit)?.grams ?? 30
      const factor = from > 0 ? to / from : 1
      next = {
        ...next,
        grams_per_unit: round(numberValue(meal.grams_per_unit) * factor, 2),
        kcal_per_unit: round(numberValue(meal.kcal_per_unit) * factor, 4),
        protein_per_unit: round(numberValue(meal.protein_per_unit) * factor, 4),
        carbs_per_unit: round(numberValue(meal.carbs_per_unit) * factor, 4),
        fat_per_unit: round(numberValue(meal.fat_per_unit) * factor, 4),
        portion: ''
      }
    }
    if (patch.qty !== undefined || patch.unit) {
      next.portion = ''
    }
    if (patch.calories !== undefined && patch.calories !== meal.calories) {
      next.kcal_per_unit = round(numberValue(patch.calories) / Math.max(numberValue(next.qty), 0.01), 4)
    }
    next = recalcMeal(next)
    patchSlot(slotIndex, { meals: slot.meals.map((item, position) => (position === mealIndex ? next : item)) })
  }

  function removeMeal(slotIndex: number, mealIndex: number) {
    const slot = day.slots[slotIndex]
    patchSlot(slotIndex, { meals: slot.meals.filter((_, position) => position !== mealIndex) })
  }

  function moveMeal(slotIndex: number, from: number, to: number, targetSlot = slotIndex) {
    const slot = day.slots[slotIndex]
    if (to < 0 || to >= slot.meals.length || from === to) return
    const nextMeals = slot.meals.slice()
    const [item] = nextMeals.splice(from, 1)
    if (targetSlot !== slotIndex) {
      const targetList = day.slots[targetSlot].meals.slice()
      targetList.push(item)
      setSlots(
        day.slots.map((entry, position) => {
          if (position === slotIndex) return { ...entry, meals: nextMeals }
          if (position === targetSlot) return { ...entry, meals: targetList }
          return entry
        })
      )
      return
    }
    nextMeals.splice(to, 0, item)
    patchSlot(slotIndex, { meals: nextMeals })
  }

  function copyDay(targets: number[]) {
    const source = data.days[selected]
    const nextDays = data.days.map((entry, index) => {
      if (!targets.includes(index) || index === selected) return entry
      return {
        ...entry,
        slots: source.slots.map((slot) => ({
          ...slot,
          id: uid('slot'),
          meals: slot.meals.map((meal) => ({ ...meal, id: uid('meal') }))
        })),
        notes: source.notes,
        targets: source.targets
      }
    })
    update(['days'], nextDays)
    setCopyOpen(false)
    onToast(`Copied ${source.day} to ${targets.length} day${targets.length === 1 ? '' : 's'}`)
  }

  function clearDay() {
    if (!day.slots.length) return
    if (!window.confirm(`Remove every meal from ${day.day}?`)) return
    setDay({ slots: [] })
  }

  function matchTarget() {
    if (!totals.calories) return
    const ratio = target.ratio
    const grams = {
      protein: Math.round((totals.protein * 100) / 100),
      carbs: Math.round(totals.carbs),
      fat: Math.round(totals.fat)
    }
    setDay({
      targets: {
        calories: Math.round(totals.calories),
        protein_g: grams.protein,
        carbs_g: grams.carbs,
        fat_g: grams.fat,
        ratio: { ...ratio },
        source: 'day',
        note: 'Set from the planned day'
      }
    })
    onToast('Day target matched to the planned meals')
  }

  return (
    <div className="pl-board">
      <div className="pl-day-tabs" role="tablist" aria-label="Plan days">
        {data.days.map((entry, index) => {
          const stats = derivedDays.find((item) => item.day === entry.day)
          const dayStats = stats ?? { ...dayTotals(entry), target_calories: 0, diff: 0, status: entry.active ? 'empty' : 'rest' }
          const active = index === selected
          return (
            <button
              type="button"
              key={entry.day}
              role="tab"
              aria-selected={active}
              className={`pl-day-tab ${active ? 'active' : ''} ${entry.active ? '' : 'inactive'} ${dayStats.status}`}
              onClick={() => setSelected(index)}
            >
              <span className="pl-day-tab-name">{entry.day.slice(0, 3)}</span>
              <span className="pl-day-tab-kcal">{entry.active ? `${Math.round(dayStats.calories).toLocaleString()}` : 'Off'}</span>
              <span className="pl-day-tab-bar" aria-hidden="true">
                <i style={{ width: `${Math.min(100, dayStats.target_calories ? (dayStats.calories / dayStats.target_calories) * 100 : 0)}%` }} />
              </span>
            </button>
          )
        })}
      </div>

      <div className="pl-day-head">
        <div className="pl-day-title">
          <h3>{day.day}</h3>
          <p>
            {[data.meta.diet_type, day.fast_day ? 'Fast day' : '', day.notes ? 'Has diet notes' : ''].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="pl-day-totals">
          <div>
            <span>Calories</span>
            <strong>{Math.round(totals.calories).toLocaleString()}</strong>
            <small>
              {targetCalories ? `target ${targetCalories.toLocaleString()} · ${diff >= 0 ? '+' : '−'}${Math.abs(Math.round(diff)).toLocaleString()}` : 'no target'}
            </small>
          </div>
          <div><span>Protein</span><strong>{Math.round(totals.protein)}<em>g</em></strong><small>{target.protein_g ? `${target.protein_g} g target` : '—'}</small></div>
          <div><span>Carbs</span><strong>{Math.round(totals.carbs)}<em>g</em></strong><small>{target.carbs_g ? `${target.carbs_g} g target` : '—'}</small></div>
          <div><span>Fat</span><strong>{Math.round(totals.fat)}<em>g</em></strong><small>{target.fat_g ? `${target.fat_g} g target` : '—'}</small></div>
          <span className={`pl-day-status ${derived?.status ?? 'empty'}`}>{dayStatusLabel(derived?.status ?? 'empty')}</span>
        </div>
      </div>

      <div className="pl-day-toolbar">
        <button
          type="button"
          className="secondary-button compact"
          onClick={() => (day.slots.length ? setPickerSlot(0) : addSlot('Breakfast', '08:00'))}
          disabled={locked}
        >
          <UtensilsCrossed size={15} /> Add meal
        </button>
        <div className="pl-menu-wrap">
          <button type="button" className="secondary-button compact" onClick={() => setAddSlotOpen((value) => !value)} disabled={locked}>
            <Plus size={15} /> Add meal slot <ChevronDown size={13} />
          </button>
          {addSlotOpen && (
            <div className="pl-menu" role="menu">
              {reference.slot_presets.map((preset) => (
                <button type="button" key={preset.name} role="menuitem" onClick={() => addSlot(preset.name, preset.time)}>
                  <strong>{preset.name}</strong> <small>{preset.time}</small>
                </button>
              ))}
              <button type="button" role="menuitem" className="pl-menu-custom" onClick={() => addSlot('Custom slot', '')}>
                <Plus size={13} /> Custom slot
              </button>
            </div>
          )}
        </div>
        <button type="button" className="secondary-button compact" onClick={() => setShowNotes((value) => !value)} disabled={locked}>
          <StickyNote size={15} /> Diet notes
        </button>
        <div className="pl-menu-wrap">
          <button type="button" className="secondary-button compact" onClick={() => setCopyOpen((value) => !value)} disabled={locked}>
            <Copy size={15} /> Copy day <ChevronDown size={13} />
          </button>
          {copyOpen && (
            <div className="pl-menu pl-menu-copy" role="menu">
              {(data.days.some((entry) => entry.day === 'Saturday')
                ? (['weekdays', 'weekend', 'all'] as const)
                : (['all'] as const)
              ).map((mode) => (
                <button
                  type="button"
                  key={mode}
                  role="menuitem"
                  onClick={() =>
                    copyDay(
                      mode === 'all'
                        ? data.days.map((_, index) => index).filter((index) => index !== selected)
                        : data.days
                            .map((entry, index) => ({ entry, index }))
                            .filter(({ entry }) => (mode === 'weekdays' ? !['Saturday', 'Sunday'].includes(entry.day) : ['Saturday', 'Sunday'].includes(entry.day)))
                            .map(({ index }) => index)
                    )
                  }
                >
                  {mode === 'all' ? 'All other days' : mode === 'weekdays' ? 'Weekdays' : 'Weekend'}
                </button>
              ))}
            </div>
          )}
        </div>
        <button type="button" className="secondary-button compact" onClick={matchTarget} disabled={locked || !totals.calories}>
          <Zap size={15} /> Match target to meals
        </button>
        <label className={`pl-switch ${day.active ? 'on' : ''}`}>
          <input
            type="checkbox"
            checked={day.active}
            disabled={locked}
            onChange={(event) => setDay({ active: event.target.checked })}
          />
          <span aria-hidden="true" />
          Day active
        </label>
        <label className={`pl-switch ${day.fast_day ? 'on' : ''}`}>
          <input
            type="checkbox"
            checked={day.fast_day}
            disabled={locked}
            onChange={(event) => setDay({ fast_day: event.target.checked })}
          />
          <span aria-hidden="true" />
          Fast day
        </label>
        <button type="button" className="pl-danger-link" onClick={clearDay} disabled={locked || !day.slots.length}>
          <Trash2 size={14} /> Clear day
        </button>
      </div>

      {showNotes && (
        <div className="pl-notes">
          <label className="cf-field">
            <span className="cf-label">Diet notes for {day.day}</span>
            <textarea
              rows={3}
              value={day.notes}
              disabled={locked}
              placeholder="Notes, recipes, swaps or reminders that print with this day."
              onChange={(event) => setDay({ notes: event.target.value })}
            />
          </label>
          <small className="cf-hint">These notes print at the end of the day in the PDF.</small>
        </div>
      )}

      {!day.slots.length && (
        <div className="pl-empty-day">
          <span className="pl-empty-icon"><Salad size={22} /></span>
          <h4>No meals on {day.day} yet</h4>
          <p>Add a meal slot, then pick dishes from the catalogue or add a manual entry.</p>
          <div className="pl-empty-actions">
            <button type="button" className="primary-button compact" onClick={() => setPickerSlot(0)} disabled={locked}>
              <UtensilsCrossed size={15} /> Pick a dish
            </button>
            <button type="button" className="secondary-button compact" onClick={() => addSlot('Breakfast', '08:00')} disabled={locked}>
              <Plus size={15} /> Start with breakfast
            </button>
          </div>
        </div>
      )}

      <div className="pl-slots">
        {day.slots.map((slot, slotIndex) => (
          <section
            className={`pl-slot ${dragSlot === slotIndex ? 'dragging' : ''}`}
            key={slot.id}
            draggable={!locked}
            onDragStart={() => setDragSlot(slotIndex)}
            onDragEnd={() => setDragSlot(null)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              if (dragSlot !== null && dragSlot !== slotIndex) moveSlot(dragSlot, slotIndex)
              setDragSlot(null)
            }}
          >
            <header className="pl-slot-head">
              <span className="pl-drag" aria-hidden="true"><GripVertical size={15} /></span>
              <div className="pl-slot-name">
                <input
                  value={slot.name}
                  disabled={locked}
                  aria-label="Slot name"
                  onChange={(event) => patchSlot(slotIndex, { name: event.target.value })}
                  placeholder="Slot name"
                />
                <span className="pl-slot-time">
                  <Clock size={12} />
                  <input
                    value={slot.time}
                    disabled={locked}
                    aria-label="Slot time"
                    placeholder="08:00"
                    onChange={(event) => patchSlot(slotIndex, { time: event.target.value })}
                  />
                </span>
              </div>
              <span className="pl-slot-kcal">{Math.round(slot.meals.reduce((total, meal) => total + numberValue(meal.calories), 0))} kcal</span>
              <div className="pl-slot-actions">
                <button type="button" className="pl-icon" onClick={() => moveSlot(slotIndex, slotIndex - 1)} aria-label="Move slot up" disabled={locked || slotIndex === 0}>
                  <ArrowUp size={14} />
                </button>
                <button type="button" className="pl-icon" onClick={() => moveSlot(slotIndex, slotIndex + 1)} aria-label="Move slot down" disabled={locked || slotIndex === day.slots.length - 1}>
                  <ArrowDown size={14} />
                </button>
                <button type="button" className="pl-icon" onClick={() => setPickerSlot(slotIndex)} aria-label={`Add a dish to ${slot.name}`} disabled={locked}>
                  <Plus size={15} />
                </button>
                <button type="button" className="pl-icon danger" onClick={() => removeSlot(slotIndex)} aria-label={`Remove ${slot.name}`} disabled={locked}>
                  <Trash2 size={14} />
                </button>
              </div>
            </header>

            <div className="pl-slot-note">
              <StickyNote size={13} />
              <input
                value={slot.note}
                disabled={locked}
                placeholder="Add a meal note for this slot"
                aria-label="Slot note"
                onChange={(event) => patchSlot(slotIndex, { note: event.target.value })}
              />
            </div>

            <ul className="pl-meals">
              {slot.meals.map((meal, mealIndex) => {
                const isOpen = expanded === meal.id
                return (
                  <li
                    className={`pl-meal ${isOpen ? 'open' : ''}`}
                    key={meal.id}
                    draggable={!locked}
                    onDragStart={() => setDragMeal({ slot: slotIndex, meal: mealIndex })}
                    onDragEnd={() => setDragMeal(null)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.stopPropagation()
                      if (dragMeal && (dragMeal.slot !== slotIndex || dragMeal.meal !== mealIndex)) {
                        moveMeal(dragMeal.slot, dragMeal.meal, mealIndex, slotIndex)
                      }
                      setDragMeal(null)
                    }}
                  >
                    <div className="pl-meal-row">
                      <span className="pl-drag" aria-hidden="true"><GripVertical size={14} /></span>
                      <button type="button" className="pl-meal-name" onClick={() => setExpanded(isOpen ? '' : meal.id)} aria-expanded={isOpen}>
                        <span>
                          <strong>{meal.name}</strong>
                          {meal.note && <small>Note: {meal.note}</small>}
                          {!meal.note && meal.alternatives.length > 0 && <small>{meal.alternatives.length} alternative</small>}
                        </span>
                        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>
                      <label className="pl-portion">
                        <input
                          type="number"
                          min={0}
                          step="0.25"
                          value={meal.qty}
                          disabled={locked}
                          aria-label={`${meal.name} quantity`}
                          onChange={(event) => patchMeal(slotIndex, mealIndex, { qty: numberValue(event.target.value) })}
                        />
                        <select
                          value={meal.unit}
                          disabled={locked}
                          aria-label={`${meal.name} unit`}
                          onChange={(event) => patchMeal(slotIndex, mealIndex, { unit: event.target.value })}
                        >
                          {reference.units.map((unit) => <option key={unit.unit} value={unit.unit}>{unit.unit}</option>)}
                          {!reference.units.some((unit) => unit.unit === meal.unit) && <option value={meal.unit}>{meal.unit}</option>}
                        </select>
                      </label>
                      <label className="pl-kcal">
                        <input
                          type="number"
                          min={0}
                          step="0.5"
                          value={round(meal.calories, 2)}
                          disabled={locked}
                          aria-label={`${meal.name} calories`}
                          onChange={(event) => patchMeal(slotIndex, mealIndex, { calories: numberValue(event.target.value) })}
                        />
                        <span>kcal</span>
                      </label>
                      <div className="pl-meal-actions">
                        <button type="button" className="pl-icon" aria-label="Move dish up" disabled={locked || mealIndex === 0} onClick={() => moveMeal(slotIndex, mealIndex, mealIndex - 1)}>
                          <ArrowUp size={13} />
                        </button>
                        <button type="button" className="pl-icon" aria-label="Move dish down" disabled={locked || mealIndex === slot.meals.length - 1} onClick={() => moveMeal(slotIndex, mealIndex, mealIndex + 1)}>
                          <ArrowDown size={13} />
                        </button>
                        <button type="button" className="pl-icon danger" aria-label={`Remove ${meal.name}`} disabled={locked} onClick={() => removeMeal(slotIndex, mealIndex)}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                    {isOpen && (
                      <div className="pl-meal-detail">
                        <label className="cf-field">
                          <span className="cf-label">Note printed under the dish</span>
                          <input
                            value={meal.note}
                            disabled={locked}
                            placeholder="e.g. add salt and pepper"
                            onChange={(event) => patchMeal(slotIndex, mealIndex, { note: event.target.value })}
                          />
                        </label>
                        <label className="cf-field">
                          <span className="cf-label">Recipe / method (optional)</span>
                          <textarea
                            rows={2}
                            value={meal.recipe}
                            disabled={locked}
                            placeholder="Short method the client can follow"
                            onChange={(event) => patchMeal(slotIndex, mealIndex, { recipe: event.target.value })}
                          />
                        </label>
                        <div className="pl-alts">
                          <div className="pl-alts-head">
                            <span className="cf-label">Alternatives (“or”)</span>
                            <button
                              type="button"
                              className="pl-link"
                              disabled={locked}
                              onClick={() =>
                                patchMeal(slotIndex, mealIndex, {
                                  alternatives: [...meal.alternatives, { id: uid('alt'), name: '', portion: meal.portion, calories: meal.calories }]
                                })
                              }
                            >
                              <Plus size={13} /> Add alternative
                            </button>
                          </div>
                          {meal.alternatives.map((alt, altIndex) => (
                            <div className="pl-alt-row" key={alt.id}>
                              <input
                                value={alt.name}
                                disabled={locked}
                                placeholder="Alternative dish"
                                aria-label="Alternative name"
                                onChange={(event) =>
                                  patchMeal(slotIndex, mealIndex, {
                                    alternatives: meal.alternatives.map((item, position) => (position === altIndex ? { ...item, name: event.target.value } : item))
                                  })
                                }
                              />
                              <input
                                value={alt.portion}
                                disabled={locked}
                                placeholder="Portion"
                                aria-label="Alternative portion"
                                onChange={(event) =>
                                  patchMeal(slotIndex, mealIndex, {
                                    alternatives: meal.alternatives.map((item, position) => (position === altIndex ? { ...item, portion: event.target.value } : item))
                                  })
                                }
                              />
                              <input
                                type="number"
                                value={alt.calories}
                                disabled={locked}
                                aria-label="Alternative calories"
                                onChange={(event) =>
                                  patchMeal(slotIndex, mealIndex, {
                                    alternatives: meal.alternatives.map((item, position) => (position === altIndex ? { ...item, calories: numberValue(event.target.value) } : item))
                                  })
                                }
                              />
                              <button
                                type="button"
                                className="pl-icon danger"
                                aria-label="Remove alternative"
                                disabled={locked}
                                onClick={() => patchMeal(slotIndex, mealIndex, { alternatives: meal.alternatives.filter((_, position) => position !== altIndex) })}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          ))}
                        </div>
                        <p className="pl-meal-meta">
                          <Info size={12} /> {portionText(meal.qty, meal.unit)} · {Math.round(numberValue(meal.grams_per_unit) * numberValue(meal.qty))} g ·
                          {' '}P {round(meal.protein, 1)} g · C {round(meal.carbs, 1)} g · F {round(meal.fat, 1)} g
                        </p>
                      </div>
                    )}
                  </li>
                )
              })}
              {!slot.meals.length && (
                <li className="pl-meal-empty">
                  <button type="button" className="pl-link" onClick={() => setPickerSlot(slotIndex)} disabled={locked}>
                    <Plus size={14} /> Add the first dish to “{slot.name}”
                  </button>
                </li>
              )}
            </ul>
          </section>
        ))}
      </div>

      {!day.slots.length && (
        <p className="pl-foot-hint"><Moon size={13} /> Rest days can stay empty — turn the day off to exclude it from targets.</p>
      )}

      <FoodPicker
        open={pickerSlot !== null}
        onClose={() => setPickerSlot(null)}
        dishes={dishes}
        categories={reference.categories}
        units={reference.units}
        onAdd={(meal, keepOpen) => {
          if (pickerSlot === null) {
            const slotIndex = day.slots.length
            const nextSlot = { id: uid('slot'), name: 'Meal', time: '', note: '', meals: [meal] }
            setSlots([...day.slots, nextSlot])
            setPickerSlot(keepOpen ? slotIndex : null)
            return
          }
          addMeal(pickerSlot, meal, keepOpen)
        }}
      />
    </div>
  )
}
