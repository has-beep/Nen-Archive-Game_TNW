import { useEffect, useMemo, useState } from 'react'
import type { castView, eventView } from '../../sim/api/views'
import type { CharacterSpec } from '../../sim/player/create'
import { client } from '../client'
import { NEN_COLOR, NEN_NAME, Rich, useNav, useView } from '../ctx'
import type { PlaceDot } from '../components/MapView'

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <div className="veil" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className={`modal${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="row" style={{ justifyContent: 'space-between' }}><h2>{title}</h2><button className="btn small" onClick={onClose}>Close</button></div>
        {children}
      </div>
    </div>
  )
}

/* ---------------- A new world ---------------- */

export function NewWorld({ onClose, onStart }: { onClose: () => void; onStart: (o: { seed: number; ants: 'random' | 'yes' | 'no'; disasters: boolean; expeditions: boolean; plotArmor: boolean; lethality: number }) => void }) {
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e6))
  const [ants, setAnts] = useState<'random' | 'yes' | 'no'>('random')
  const [disasters, setDisasters] = useState(true)
  const [expeditions, setExpeditions] = useState(true)
  const [plotArmor, setPlotArmor] = useState(false)
  const [lethality, setLethality] = useState(0.5)
  return (
    <Modal title="A new world" onClose={onClose}>
      <p className="small" style={{ margin: 0 }}>The world starts on 1 December 1998, five weeks before the 287th Hunter Exam. Every canon character is where the story finds them. After that, nothing is written.</p>
      <div className="grid2">
        <div className="field"><label htmlFor="nw-seed">World seed</label><div className="row"><input id="nw-seed" type="number" value={seed} onChange={(e) => setSeed(+e.target.value | 0)} style={{ flex: 1 }} /><button className="btn small" onClick={() => setSeed(Math.floor(Math.random() * 1e6))}>Roll</button></div></div>
        <div className="field"><label htmlFor="nw-ants">The Chimera Ant queen</label><select id="nw-ants" value={ants} onChange={(e) => setAnts(e.target.value as typeof ants)}><option value="random">Might wash ashore</option><option value="yes">Will wash ashore</option><option value="no">Never comes</option></select></div>
        <div className="field"><label htmlFor="nw-leth">How deadly fights are</label><input id="nw-leth" type="range" min={0.2} max={1} step={0.1} value={lethality} onChange={(e) => setLethality(+e.target.value)} /></div>
        <div className="field">
          <label>World rules</label>
          <label className="row small"><input type="checkbox" checked={disasters} onChange={(e) => setDisasters(e.target.checked)} /> Natural disasters and plagues</label>
          <label className="row small"><input type="checkbox" checked={expeditions} onChange={(e) => setExpeditions(e.target.checked)} /> Expeditions to the Dark Continent</label>
          <label className="row small"><input type="checkbox" checked={plotArmor} onChange={(e) => setPlotArmor(e.target.checked)} /> Canon characters survive what should kill them</label>
        </div>
      </div>
      <div className="row"><button className="btn primary" onClick={() => onStart({ seed, ants, disasters, expeditions, plotArmor, lethality })}>Begin</button><span className="small muted">The same seed always gives the same world until someone interferes.</span></div>
    </Modal>
  )
}

/* ---------------- Choose who to follow ---------------- */

export function Cast({ onClose, onCreate }: { onClose: () => void; onCreate: () => void }) {
  const nav = useNav()
  const cast = useView<ReturnType<typeof castView>>({ k: 'view', view: 'cast' }, [], 60000)
  const [sel, setSel] = useState<number | null>(null)
  const pick = cast?.find((c) => c.id === sel)
  return (
    <Modal title="Who will you follow?" onClose={onClose} wide>
      <p className="small" style={{ margin: 0 }}>Follow anyone and watch their life unfold. Guide them and their crossroads become yours. Or make someone new, who starts with nothing.</p>
      {!cast ? <div className="empty">Loading the cast…</div> : (
        <div className="cast">
          {cast.map((c) => (
            <button key={c.id} aria-pressed={sel === c.id} style={{ borderTopColor: c.c }} onClick={() => setSel(c.id)}>
              <b>{c.name}</b><span className="small muted">{c.type} · {c.role}</span><span className="small muted">{c.at}</span>
            </button>
          ))}
        </div>
      )}
      {pick && <div className="card"><b>{pick.name}</b><span className="small">{pick.bio}</span></div>}
      <div className="row">
        <button className="btn" disabled={!pick} onClick={() => { if (!pick) return; nav.run({ k: 'follow', id: pick.id }).then(() => { nav.open({ k: 'person', id: pick.id }); onClose() }) }}>Follow {pick?.short ?? ''}</button>
        <button className="btn primary" disabled={!pick} onClick={() => { if (!pick) return; nav.run({ k: 'own', id: pick.id }).then((r) => { nav.toast((r as { msg: string }).msg); nav.open({ k: 'person', id: pick.id }); onClose() }) }}>Guide {pick?.short ?? ''}</button>
        <button className="btn" onClick={onCreate}>Create your own</button>
      </div>
    </Modal>
  )
}

/* ---------------- Character creator ---------------- */

const FACET_KEYS = ['bravery', 'aggression', 'empathy', 'honesty', 'loyalty', 'ambition', 'curiosity', 'discipline', 'pride', 'greed', 'cruelty', 'sociability']
const DREAMS = [['hunter', 'Become a Hunter'], ['strongest', 'Become the strongest'], ['explore', 'See the Dark Continent'], ['wealth', 'Get rich'], ['doctor', 'Become a doctor'], ['family', 'Have a family'], ['discover', 'Discover something new'], ['fame', 'Be famous'], ['protect', 'Protect the weak']] as const
const ROLES = [['drifter', 'Drifter'], ['student', 'Student'], ['fighter', 'Fighter'], ['thief', 'Thief'], ['scholar', 'Scholar'], ['doctor', 'Doctor'], ['merchant', 'Merchant'], ['mercenary', 'Mercenary'], ['civilian', 'Ordinary person']] as const

export function Creator({ places, onClose }: { places: PlaceDot[]; onClose: () => void }) {
  const nav = useNav()
  const homes = places.filter((p) => !p.hidden && !p.beyond && p.kind !== 'ship' && p.key !== 'greed')
  const [s, setS] = useState<CharacterSpec>({ name: '', sex: 'f', age: 15, type: -1, home: homes.find((h) => h.key === 'dolle')?.id ?? homes[0]?.id ?? 0, role: 'drifter', facets: {}, dreams: [{ k: 'hunter' }], talent: 'gifted', awakened: false, bio: '' })
  const set = (o: Partial<CharacterSpec>) => setS((x) => ({ ...x, ...o }))
  const go = () => nav.run({ k: 'create', spec: { ...s, name: s.name || 'Nameless' } }).then((r) => {
    const res = r as { ok: boolean; msg: string; id?: number }
    nav.toast(res.msg)
    if (res.ok && res.id != null) { nav.open({ k: 'person', id: res.id }); onClose() }
  })
  return (
    <Modal title="Create a character" onClose={onClose} wide>
      <p className="small" style={{ margin: 0 }}>Like a run on the Nen Archive, a new character starts young and unknown, with Nen locked until they earn it. Who they are decides what they do; you guide them at the moments that matter.</p>
      <div className="grid2">
        <div className="field"><label htmlFor="cr-name">Name</label><input id="cr-name" value={s.name} maxLength={40} onChange={(e) => set({ name: e.target.value })} placeholder="Their name" /></div>
        <div className="field"><label htmlFor="cr-home">Where they start</label><select id="cr-home" value={s.home} onChange={(e) => set({ home: +e.target.value })}>{homes.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</select></div>
        <div className="field"><label htmlFor="cr-sex">Sex</label><select id="cr-sex" value={s.sex} onChange={(e) => set({ sex: e.target.value as 'm' | 'f' })}><option value="f">Female</option><option value="m">Male</option></select></div>
        <div className="field"><label htmlFor="cr-age">Age: {s.age}</label><input id="cr-age" type="range" min={12} max={45} value={s.age} onChange={(e) => set({ age: +e.target.value })} /></div>
        <div className="field"><label htmlFor="cr-role">Life so far</label><select id="cr-role" value={s.role} onChange={(e) => set({ role: e.target.value as CharacterSpec['role'] })}>{ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        <div className="field"><label htmlFor="cr-type">Nen type</label><select id="cr-type" value={s.type} onChange={(e) => set({ type: +e.target.value as CharacterSpec['type'] })}><option value={-1}>Let water divination decide</option>{NEN_NAME.map((n, i) => <option key={i} value={i}>{n}</option>)}</select></div>
        <div className="field"><label htmlFor="cr-talent">Talent</label><select id="cr-talent" value={s.talent} onChange={(e) => set({ talent: e.target.value as CharacterSpec['talent'] })}><option value="ordinary">Ordinary</option><option value="gifted">Gifted</option><option value="prodigy">Prodigy (Coffee tier)</option></select></div>
        <div className="field"><label>Start</label><label className="row small"><input type="checkbox" checked={!!s.awakened} onChange={(e) => set({ awakened: e.target.checked })} /> Already awakened to Nen (Coffee tier)</label></div>
      </div>
      <div className="sec">
        <h3>Personality</h3>
        <div className="grid2">{FACET_KEYS.map((f) => (
          <div key={f} className="field"><label htmlFor={`cr-f-${f}`} style={{ textTransform: 'capitalize' }}>{f}: {(s.facets as Record<string, number>)[f] ?? 0 > 0 ? '+' : ''}{(s.facets as Record<string, number>)[f] ?? 0}</label><input id={`cr-f-${f}`} type="range" min={-40} max={40} value={(s.facets as Record<string, number>)[f] ?? 0} onChange={(e) => set({ facets: { ...s.facets, [f]: +e.target.value } })} /></div>
        ))}</div>
      </div>
      <div className="sec">
        <h3>What they want (up to three)</h3>
        <div className="row">{DREAMS.map(([k, l]) => {
          const on = !!s.dreams?.some((d) => d.k === k)
          return <button key={k} className={`chip${on ? ' on' : ''}`} style={{ cursor: 'pointer' }} onClick={() => set({ dreams: on ? s.dreams!.filter((d) => d.k !== k) : [...(s.dreams || []), { k: k as never }].slice(-3) })}>{l}</button>
        })}</div>
      </div>
      <div className="field"><label htmlFor="cr-bio">Their story so far (optional)</label><textarea id="cr-bio" rows={3} maxLength={500} value={s.bio} onChange={(e) => set({ bio: e.target.value })} /></div>
      <div className="row"><button className="btn primary" onClick={go}>Begin their life</button></div>
    </Modal>
  )
}

/* ---------------- The Forge ---------------- */

const EFFECTS = ['damage', 'bind', 'control', 'debuff', 'buff', 'transform', 'heal', 'shield', 'summon', 'stealth', 'teleport', 'reveal', 'seal', 'contract', 'drain', 'speed', 'sense', 'curse', 'clone', 'explode', 'poison'] as const
const EFFECT_NAME: Record<string, string> = { damage: 'Attack', bind: 'Restraint', control: 'Control', debuff: 'Weakening', buff: 'Strengthening', transform: 'Transformation', heal: 'Healing', shield: 'Defence', summon: 'Nen beast', stealth: 'Concealment', teleport: 'Teleport', reveal: 'Insight', seal: 'Sealing', contract: 'Contract', drain: 'Drain', speed: 'Speed', sense: 'Foresight', curse: 'Curse', clone: 'Copies', explode: 'Bomb', poison: 'Poison' }
const CONDS = [
  ['touch_first', 'Must touch the target first'], ['explain', 'Must explain how it works'], ['named', 'Must say its name aloud'], ['charge', 'Must charge before use'],
  ['close_range', 'Only at close range'], ['once_per_target', 'Once per target'], ['cooldown', 'Once per fight'], ['emotion', 'Only when angry or desperate'],
  ['self_harm', 'Hurts the user'], ['life_cost', 'Costs years of life'], ['zetsu_after', 'Leaves the user in Zetsu'], ['death_penalty', 'Breaking the rule kills the user'],
] as const

export function Forge({ pid, onClose }: { pid: number; onClose: () => void }) {
  const nav = useNav()
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [cats, setCats] = useState<[number, number][]>([[0, 1]])
  const [effects, setEffects] = useState<{ k: string; p: number; range: string }[]>([{ k: 'damage', p: 1.4, range: 'melee' }])
  const [conds, setConds] = useState<{ k: string; stars: number }[]>([])
  const power = useMemo(() => {
    const stars = conds.reduce((s, c) => s + c.stars, 0)
    const budget = effects.reduce((s, e) => s + e.p, 0)
    return { stars, budget, over: budget > 2.6 + stars * 0.25 }
  }, [conds, effects])
  const go = () => {
    const spec = {
      name: name || 'Unnamed', kind: 'custom', desc,
      cats: cats.map(([c, w]) => [c, w]) as [0, number][],
      effects: effects.map((e) => ({ k: e.k as never, p: e.p, range: e.range as never, dur: ['bind', 'buff', 'transform', 'speed', 'sense', 'summon', 'shield'].includes(e.k) ? 3 : undefined })),
      conds: conds.map((c) => ({ k: c.k as never, stars: c.stars, text: CONDS.find(([k]) => k === c.k)?.[1] || c.k })),
      base: 1,
    }
    nav.run({ k: 'forge', pid, spec }).then((r) => { const res = r as { ok: boolean; msg: string }; nav.toast(res.msg); if (res.ok) onClose() })
  }
  return (
    <Modal title="The Hatsu Forge" onClose={onClose} wide>
      <p className="small" style={{ margin: 0 }}>An ability is strongest in the categories its user is good at. Conditions and vows buy power: the harder the rule, the stronger the ability. The same 100-point logic as the Archive's ability builder.</p>
      <div className="grid2">
        <div className="field"><label htmlFor="fg-name">Name</label><input id="fg-name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} /></div>
        <div className="field"><label htmlFor="fg-desc">What it does, in your words</label><input id="fg-desc" value={desc} maxLength={300} onChange={(e) => setDesc(e.target.value)} /></div>
      </div>
      <div className="sec">
        <h3>Categories</h3>
        {cats.map(([c, w], i) => (
          <div key={i} className="row">
            <select aria-label="Category" value={c} onChange={(e) => setCats(cats.map((x, j) => (j === i ? [+e.target.value, x[1]] : x)))}>{NEN_NAME.map((n, k) => <option key={k} value={k}>{n}</option>)}</select>
            <input aria-label="Weight" type="range" min={0.1} max={1} step={0.05} value={w} onChange={(e) => setCats(cats.map((x, j) => (j === i ? [x[0], +e.target.value] : x)))} style={{ flex: 1, accentColor: NEN_COLOR[c] }} />
            {cats.length > 1 && <button className="btn small" onClick={() => setCats(cats.filter((_, j) => j !== i))}>Remove</button>}
          </div>
        ))}
        {cats.length < 3 && <button className="btn small" style={{ alignSelf: 'flex-start' }} onClick={() => setCats([...cats, [1, 0.4]])}>Add a category</button>}
      </div>
      <div className="sec">
        <h3>Effects</h3>
        {effects.map((e, i) => (
          <div key={i} className="row">
            <select aria-label="Effect" value={e.k} onChange={(ev) => setEffects(effects.map((x, j) => (j === i ? { ...x, k: ev.target.value } : x)))}>{EFFECTS.map((k) => <option key={k} value={k}>{EFFECT_NAME[k]}</option>)}</select>
            <select aria-label="Range" value={e.range} onChange={(ev) => setEffects(effects.map((x, j) => (j === i ? { ...x, range: ev.target.value } : x)))}>{['self', 'touch', 'melee', 'mid', 'far', 'area'].map((r) => <option key={r}>{r}</option>)}</select>
            <label className="small row" style={{ flex: 1 }}>Strength<input type="range" min={0.5} max={2.6} step={0.1} value={e.p} onChange={(ev) => setEffects(effects.map((x, j) => (j === i ? { ...x, p: +ev.target.value } : x)))} style={{ flex: 1 }} /><span className="mono">{e.p.toFixed(1)}</span></label>
            {effects.length > 1 && <button className="btn small" onClick={() => setEffects(effects.filter((_, j) => j !== i))}>Remove</button>}
          </div>
        ))}
        {effects.length < 3 && <button className="btn small" style={{ alignSelf: 'flex-start' }} onClick={() => setEffects([...effects, { k: 'buff', p: 1, range: 'self' }])}>Add an effect</button>}
      </div>
      <div className="sec">
        <h3>Conditions and vows</h3>
        <div className="row">{CONDS.map(([k, l]) => {
          const c = conds.find((x) => x.k === k)
          return <button key={k} className={`chip${c ? ' on' : ''}`} style={{ cursor: 'pointer' }} onClick={() => setConds(c ? conds.filter((x) => x.k !== k) : [...conds, { k, stars: k === 'death_penalty' || k === 'life_cost' ? 4 : 2 }].slice(0, 5))}>{l}</button>
        })}</div>
        {conds.map((c) => <div key={c.k} className="row small"><span style={{ flex: 1 }}>{CONDS.find(([k]) => k === c.k)?.[1]}</span><input aria-label="Severity" type="range" min={1} max={5} value={c.stars} onChange={(e) => setConds(conds.map((x) => (x.k === c.k ? { ...x, stars: +e.target.value } : x)))} /><span className="stars">{'★'.repeat(c.stars)}</span></div>)}
      </div>
      <div className="row"><button className="btn primary" onClick={go}>Develop it</button><span className="small" style={{ color: power.over ? 'var(--accent)' : 'var(--muted-fg)' }}>{power.over ? 'This is more power than the conditions pay for. It will come out weaker than you hope.' : `${power.stars} stars of conditions.`}</span></div>
    </Modal>
  )
}

/* ---------------- Fight replay ---------------- */

interface FightData { names: string[]; sides: number[]; hpMax: number[]; auraMax: number[]; people: number[]; types: number[]; beats: { by: number; x: string; hp: number[]; au: number[]; pos: [number, number][]; fx?: string; tgt?: number }[]; winner: number; how: string; why: string; exchanges: number }

export function FightReplay({ eventId, onClose }: { eventId: number; onClose: () => void }) {
  const [d, setD] = useState<NonNullable<ReturnType<typeof eventView>> | null>(null)
  const [i, setI] = useState(0)
  const [play, setPlay] = useState(true)
  useEffect(() => { client.call<NonNullable<ReturnType<typeof eventView>>>({ k: 'view', view: 'event', id: eventId }).then(setD) }, [eventId])
  const f = d?.fight as FightData | undefined
  useEffect(() => {
    if (!f || !play) return
    if (i >= f.beats.length - 1) { setPlay(false); return }
    const t = setTimeout(() => setI((x) => x + 1), 1300)
    return () => clearTimeout(t)
  }, [f, i, play])
  if (!d) return <Modal title="The fight" onClose={onClose}><div className="empty">Loading…</div></Modal>
  if (!f || !f.beats?.length) return <Modal title="The fight" onClose={onClose}><div className="small"><Rich text={d.event.text} names={d.names} /></div><div className="empty">This fight was too small to be recorded blow by blow.</div></Modal>
  const b = f.beats[Math.min(i, f.beats.length - 1)]
  const name = (k: number) => { const t = f.names[k]; const m = /^\{p(\d+)\}$/.exec(t); return m ? d.names.p[+m[1]]?.n?.split(' ')[0] ?? t : t }
  return (
    <Modal title="The fight" onClose={onClose} wide>
      <div className="small"><Rich text={d.event.text} names={d.names} /></div>
      <div className="arena">
        {b.tgt != null && b.tgt !== b.by && b.pos[b.by] && b.pos[b.tgt] && (
          <svg viewBox="0 0 40 24" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} aria-hidden="true">
            <line x1={b.pos[b.by][0]} y1={b.pos[b.by][1]} x2={b.pos[b.tgt][0]} y2={b.pos[b.tgt][1]} stroke={/miss|notice|cut/.test(b.fx || '') ? 'var(--muted-fg)' : /heal|buff|shield/.test(b.fx || '') ? 'var(--primary)' : 'var(--accent)'} strokeWidth="2" strokeDasharray={/miss/.test(b.fx || '') ? '4 4' : undefined} vectorEffect="non-scaling-stroke" opacity="0.75" />
          </svg>
        )}
        {b.pos.map(([x, y], k) => {
          const out = b.hp[k] <= 0
          const c = f.types[k] >= 0 ? NEN_COLOR[f.types[k]] : '#94a3b8'
          return (
            <div key={k} className={`f${out ? ' out' : ''}${b.by === k ? ' act' : ''}${b.tgt === k ? ' hit' : ''}`} style={{ left: `${x / 40 * 100}%`, top: `${y / 24 * 100}%` }}>
              <span className="disc" style={{ background: c, borderColor: f.sides[k] === 0 ? 'var(--primary)' : 'var(--accent)' }} />
              <span className="nm">{name(k)}</span>
            </div>
          )
        })}
      </div>
      <div className="beat"><Rich text={b.x} names={d.names} /></div>
      <div className="hpbars">
        {f.names.map((_, k) => (
          <div key={k} className="hpb">
            <span>{name(k)} <span className="muted">{f.sides[k] === 0 ? '(attacker)' : '(defender)'}</span></span>
            <div className="track"><i style={{ width: `${Math.max(0, b.hp[k] / f.hpMax[k] * 100)}%` }} /></div>
            {f.auraMax[k] > 0 && <div className="track aura"><i style={{ width: `${Math.max(0, b.au[k] / f.auraMax[k] * 100)}%` }} /></div>}
          </div>
        ))}
      </div>
      <div className="row">
        <button className="btn small" onClick={() => setI((x) => Math.max(0, x - 1))}>Back</button>
        <button className="btn small primary" onClick={() => setPlay((v) => !v)}>{play ? 'Pause' : 'Play'}</button>
        <button className="btn small" onClick={() => setI((x) => Math.min(f.beats.length - 1, x + 1))}>Next</button>
        <input aria-label="Moment in the fight" type="range" min={0} max={f.beats.length - 1} value={i} onChange={(e) => { setI(+e.target.value); setPlay(false) }} style={{ flex: 1 }} />
        <span className="mono small">{i + 1}/{f.beats.length}</span>
      </div>
    </Modal>
  )
}
