import { useEffect, useMemo, useState, useRef } from 'react'
import {
  Activity, BookOpen, Bookmark, Check, ChevronRight,
  CircleHelp, Dices, ExternalLink, Heart, Home, Info,
  Layers3, Menu, RotateCcw, Search, StickyNote, X
} from 'lucide-react'
import './App.css'

type Part = {
  id: string
  name: string
  conceptId: string
  system: string
  chunk: number
  vertexCount: number
  indexCount: number
}

type Concept = {
  id: string
  name: string
  elements: string[]
}

type AtlasData = {
  parts: Part[]
  concepts: Concept[]
  chunks: { url: string; bytes: number }[]
}

type Page = 'atlas' | 'explorar' | 'favoritos' | 'estudo'

const SYSTEM_NAMES: Record<string, string> = {
  arterial: 'Sistema arterial',
  venous: 'Sistema venoso',
  muscular: 'Sistema muscular',
  skeletal: 'Sistema esquelÃ©tico',
  nervous: 'Sistema nervoso',
  respiratory: 'Sistema respiratÃ³rio',
  digestive: 'Sistema digestÃ³rio',
  sensory: 'Sistema sensorial',
  connective: 'Tecido conjuntivo',
  cardiac: 'Sistema cardÃ­aco',
  reproductive: 'Sistema reprodutor',
  urinary: 'Sistema urinÃ¡rio',
  integumentary: 'Sistema tegumentar',
  endocrine: 'Sistema endÃ³crino',
  lymphatic: 'Sistema linfÃ¡tico',
}

const PAGE_NAMES: Record<Page, string> = {
  atlas: 'Atlas 3D',
  explorar: 'Explorar estruturas',
  favoritos: 'Meus favoritos',
  estudo: 'Modo de estudo',
}

// Normaliza acentos, espaÃ§os e diferenÃ§as entre maiÃºsculas/minÃºsculas.
function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim()
    .replace(/\s+/g, ' ')
}

// SinÃ´nimos para pesquisas comuns. Amplie o vocabulÃ¡rio
// conforme as traduÃ§Ãµes anatÃ´micas forem sendo validadas.
const SEARCH_SYNONYMS: Record<string, string[]> = {
  osso: ['osso', 'ossos', 'bone', 'bones', 'skeletal'],
  ossos: ['osso', 'ossos', 'bone', 'bones', 'skeletal'],
  esqueleto: ['esqueleto', 'skeletal', 'bone', 'bones'],
  esqueletico: ['skeletal', 'bone', 'bones'],
  dente: ['dente', 'dentes', 'tooth', 'teeth'],
  dentes: ['dente', 'dentes', 'tooth', 'teeth'],
  gengiva: ['gengiva', 'gengivas', 'gingiva', 'gum', 'gums'],
  gengivas: ['gengiva', 'gengivas', 'gingiva', 'gum', 'gums'],
  mandibula: ['mandibula', 'mandible', 'jaw'],
  maxila: ['maxila', 'maxilla', 'jaw'],
  femur: ['femur'],
  cranio: ['cranio', 'skull', 'cranial'],
  coluna: ['coluna', 'spine', 'vertebra', 'vertebral'],
  vertebra: ['vertebra', 'vertebrae', 'vertebral'],
  musculo: ['musculo', 'musculos', 'muscle', 'muscles', 'muscular'],
  muscular: ['muscular', 'muscle', 'muscles'],
  coracao: ['coracao', 'heart', 'cardiac'],
  cardiaco: ['cardiac', 'heart'],
  pulmao: ['pulmao', 'pulmoes', 'lung', 'lungs', 'pulmonary'],
  pulmoes: ['pulmao', 'pulmoes', 'lung', 'lungs', 'pulmonary'],
  cerebro: ['cerebro', 'brain', 'cerebral'],
  nervo: ['nervo', 'nervos', 'nerve', 'nerves', 'neural', 'nervous'],
  nervos: ['nervo', 'nervos', 'nerve', 'nerves', 'neural', 'nervous'],
  nervoso: ['nervoso', 'nervous', 'nerve', 'neural'],
  arteria: ['arteria', 'arterias', 'artery', 'arteries', 'arterial'],
  arterias: ['arteria', 'arterias', 'artery', 'arteries', 'arterial'],
  veia: ['veia', 'veias', 'vein', 'veins', 'venous'],
  veias: ['veia', 'veias', 'vein', 'veins', 'venous'],
  sangue: ['sangue', 'blood', 'vascular', 'arterial', 'venous'],
  pele: ['pele', 'skin', 'integumentary'],
  olho: ['olho', 'olhos', 'eye', 'eyes', 'ocular'],
  olhos: ['olho', 'olhos', 'eye', 'eyes', 'ocular'],
  ouvido: ['ouvido', 'orelha', 'ear', 'auditory'],
  orelha: ['ouvido', 'orelha', 'ear', 'auditory'],
  figado: ['figado', 'liver', 'hepatic'],
  estomago: ['estomago', 'stomach', 'gastric'],
  intestino: ['intestino', 'intestinos', 'intestine', 'intestinal', 'bowel'],
  rim: ['rim', 'rins', 'kidney', 'renal'],
  rins: ['rim', 'rins', 'kidney', 'renal'],
  bexiga: ['bexiga', 'bladder', 'urinary'],
  urina: ['urina', 'urinary', 'bladder'],
  respiratorio: ['respiratorio', 'respiratory', 'lung', 'lungs'],
  digestorio: ['digestorio', 'digestive', 'digestion'],
  digestivo: ['digestivo', 'digestive', 'digestion'],
  reprodutor: ['reprodutor', 'reproductive'],
  endocrino: ['endocrino', 'endocrine'],
  linfatico: ['linfatico', 'lymphatic'],
  conjuntivo: ['conjuntivo', 'connective'],
}

const SEARCH_STOP_WORDS = new Set([
  'a', 'o', 'as', 'os', 'de', 'da', 'do', 'das', 'dos',
  'e', 'em', 'no', 'na', 'nos', 'nas', 'sistema', 'sistemas',
])

function readStorage<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key)
    return value ? JSON.parse(value) as T : fallback
  } catch {
    return fallback
  }
}

function App() {
  const [page, setPage] = useState<Page>('atlas')
  const [data, setData] = useState<AtlasData | null>(null)
  const [loadError, setLoadError] = useState('')
  const [query, setQuery] = useState('')
  const [system, setSystem] = useState('all')
  const [selected, setSelected] = useState<Part | null>(null)
  const atlasFrameRef = useRef<HTMLIFrameElement | null>(null)
  useEffect(() => {
    if (!selected) return

    atlasFrameRef.current?.contentWindow?.postMessage(
      { type: 'ANATOMIA3D_SELECT', id: selected.id },
      window.location.origin
    )
  }, [selected])
  const [favorites, setFavorites] = useState<string[]>(
    () => readStorage('anatomia3d:favorites', [])
  )
  const [notes, setNotes] = useState<Record<string, string>>(
    () => readStorage('anatomia3d:notes', {})
  )
  const [mobileMenu, setMobileMenu] = useState(false)
  const [studyIndex, setStudyIndex] = useState(0)
  const [studyAnswer, setStudyAnswer] = useState<string | null>(null)
  const [studyScore, setStudyScore] = useState(0)
  const [studyAnswered, setStudyAnswered] = useState(0)

  useEffect(() => {
    let active = true

    fetch('/atlas/models/atlas.json')
      .then(response => {
        if (!response.ok) throw new Error('NÃ£o foi possÃ­vel carregar o atlas.')
        return response.json() as Promise<AtlasData>
      })
      .then(json => {
        if (active) setData(json)
      })
      .catch(() => {
        if (active) {
          setLoadError('NÃ£o foi possÃ­vel carregar os dados anatÃ´micos. Verifique se public/atlas foi copiado corretamente.')
        }
      })

    return () => { active = false }
  }, [])

  useEffect(() => {
    localStorage.setItem('anatomia3d:favorites', JSON.stringify(favorites))
  }, [favorites])

  useEffect(() => {
    localStorage.setItem('anatomia3d:notes', JSON.stringify(notes))
  }, [notes])

  const systems = useMemo(() => {
    if (!data) return []
    const counts = new Map<string, number>()
    data.parts.forEach(part => {
      counts.set(part.system, (counts.get(part.system) ?? 0) + 1)
    })
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id, count]) => ({ id, count, name: SYSTEM_NAMES[id] ?? id }))
  }, [data])

  const conceptsById = useMemo(() => {
    return new Map((data?.concepts ?? []).map(concept => [concept.id, concept]))
  }, [data])

  const indexedParts = useMemo(() => {
    if (!data) return []

    return data.parts.map(part => {
      const concept = conceptsById.get(part.conceptId)
      const systemName = SYSTEM_NAMES[part.system] ?? part.system

      return {
        part,
        searchText: normalizeSearch([
          part.name,
          part.id,
          part.conceptId,
          concept?.name ?? '',
          part.system,
          systemName,
        ].join(' ')),
      }
    })
  }, [data, conceptsById])

  const filteredParts = useMemo(() => {
    const tokens = normalizeSearch(query)
      .split(' ')
      .filter(token => token && !SEARCH_STOP_WORDS.has(token))

    const queryGroups = tokens.map(token =>
      (SEARCH_SYNONYMS[token] ?? [token]).map(normalizeSearch)
    )

    return indexedParts
      .filter(({ part, searchText }) => {
        if (system !== 'all' && part.system !== system) return false
        if (page === 'favoritos' && !favorites.includes(part.id)) return false

        return queryGroups.every(group =>
          group.some(term => searchText.includes(term))
        )
      })
      .map(({ part }) => part)
  }, [indexedParts, query, system, page, favorites])

  const selectedConcept = selected
    ? conceptsById.get(selected.conceptId)
    : undefined

  const studyQuestions = useMemo(() => {
    if (!data) return []
    return data.parts.filter(part => SYSTEM_NAMES[part.system])
  }, [data])

  const currentQuestion = studyQuestions.length
    ? studyQuestions[studyIndex % studyQuestions.length]
    : undefined

  const studyOptions = useMemo(() => {
    if (!currentQuestion) return []
    const correct = currentQuestion.system
    const others = [...new Set(
      studyQuestions.map(part => part.system).filter(value => value !== correct)
    )]
    const shuffled = others.sort((a, b) =>
      `${a}${currentQuestion.id}`.localeCompare(`${b}${currentQuestion.id}`)
    )
    return [correct, ...shuffled.slice(0, 3)].sort((a, b) =>
      `${a}${currentQuestion.id}`.localeCompare(`${b}${currentQuestion.id}`)
    )
  }, [currentQuestion, studyQuestions])

  function toggleFavorite(id: string) {
    setFavorites(previous =>
      previous.includes(id)
        ? previous.filter(value => value !== id)
        : [...previous, id]
    )
  }

  function selectPage(next: Page) {
    setPage(next)
    setMobileMenu(false)
    setQuery('')
    setSystem('all')
    setSelected(null)
  }

  function answerQuestion(answer: string) {
    if (!currentQuestion || studyAnswer !== null) return
    setStudyAnswer(answer)
    setStudyAnswered(value => value + 1)
    if (answer === currentQuestion.system) setStudyScore(value => value + 1)
  }

  function nextQuestion() {
    setStudyIndex(value => (value + 1) % Math.max(studyQuestions.length, 1))
    setStudyAnswer(null)
  }

  function restartStudy() {
    setStudyIndex(0)
    setStudyAnswer(null)
    setStudyScore(0)
    setStudyAnswered(0)
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenu ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <div className="brand-mark"><Activity size={24} /></div>
          <div>
            <strong>Anatomia 3D</strong>
            <span>PLATAFORMA DE ESTUDO</span>
          </div>
          <button className="icon-button close-menu" onClick={() => setMobileMenu(false)} aria-label="Fechar menu">
            <X size={19} />
          </button>
        </div>

        <div className="nav-label">ESPAÃ‡O DE ESTUDO</div>
        <nav className="main-nav">
          <button className={page === 'atlas' ? 'nav-item active' : 'nav-item'} onClick={() => selectPage('atlas')}>
            <Home size={19} /><span>Atlas 3D</span>
            <ChevronRight className="nav-arrow" size={16} />
          </button>
          <button className={page === 'explorar' ? 'nav-item active' : 'nav-item'} onClick={() => selectPage('explorar')}>
            <Search size={19} /><span>Explorar estruturas</span>
          </button>
          <button className={page === 'favoritos' ? 'nav-item active' : 'nav-item'} onClick={() => selectPage('favoritos')}>
            <Bookmark size={19} /><span>Meus favoritos</span>
            <span className="nav-count">{favorites.length}</span>
          </button>
          <button className={page === 'estudo' ? 'nav-item active' : 'nav-item'} onClick={() => selectPage('estudo')}>
            <BookOpen size={19} /><span>Modo de estudo</span>
          </button>
        </nav>

        <div className="nav-label systems-label">SISTEMAS ANATÃ”MICOS</div>
        <div className="system-nav">
          {systems.map(item => (
            <button key={item.id} className="system-nav-item" onClick={() => {
              setSystem(item.id)
              setPage('explorar')
              setMobileMenu(false)
            }}>
              <span className={`system-dot dot-${item.id}`} />
              <span>{item.name.replace('Sistema ', '')}</span>
              <span className="system-count">{item.count}</span>
            </button>
          ))}
        </div>

        <div className="sidebar-footer">
          <div className="footer-icon"><Info size={17} /></div>
          <p>ConteÃºdo para fins educacionais. NÃ£o substitui avaliaÃ§Ã£o ou orientaÃ§Ã£o clÃ­nica.</p>
        </div>
      </aside>

      {mobileMenu && <button className="mobile-overlay" onClick={() => setMobileMenu(false)} aria-label="Fechar menu" />}

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button mobile-menu-button" onClick={() => setMobileMenu(true)} aria-label="Abrir menu">
              <Menu size={21} />
            </button>
            <div className="breadcrumb"><span>Estudo</span><ChevronRight size={15} /><strong>{PAGE_NAMES[page]}</strong></div>
          </div>
          <div className="topbar-status"><span className="status-dot" /> Atlas disponÃ­vel</div>
        </header>

        <div className="page-content">
          {page === 'atlas' && (
            <>
              <section className="welcome-row">
                <div>
                  <div className="eyebrow"><Layers3 size={14} /> ANATOMIA HUMANA</div>
                  <h1>Explore o corpo humano.</h1>
                  <p>Visualize estruturas em 3D e aprofunde seus estudos anatÃ´micos.</p>
                </div>
                <button className="primary-button" onClick={() => selectPage('explorar')}>
                  <Search size={17} /> Buscar estruturas
                </button>
              </section>

              <section className="stats-grid">
                <div className="stat-card">
                  <div className="stat-icon purple"><Layers3 size={19} /></div>
                  <div><span>Partes anatÃ´micas</span><strong>{data?.parts.length.toLocaleString('pt-BR') ?? 'â€”'}</strong></div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon blue"><Activity size={19} /></div>
                  <div><span>Sistemas disponÃ­veis</span><strong>{systems.length || 'â€”'}</strong></div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon rose"><Heart size={19} /></div>
                  <div><span>Seus favoritos</span><strong>{favorites.length}</strong></div>
                </div>
              </section>

              <section className="atlas-card">
                <div className="section-heading">
                  <div><h2>Visualizador anatÃ´mico</h2><p>Use os controles do atlas para navegar pelo modelo.</p></div>
                  <a className="text-link" href="/atlas/" target="_blank" rel="noreferrer">
                    Abrir isolado <ExternalLink size={15} />
                  </a>
                </div>
                <div className="iframe-wrap">
                  <iframe title="Atlas anatÃ´mico humano em 3D" src="/atlas/" ref={atlasFrameRef} allow="fullscreen" onLoad={(event) => { if (selected) event.currentTarget.contentWindow?.postMessage({ type: 'ANATOMIA3D_SELECT', id: selected.id }, window.location.origin) }} />
                </div>
              </section>

              <section className="systems-section">
                <div className="section-heading"><div><h2>Explore por sistema</h2><p>Escolha uma Ã¡rea para encontrar estruturas.</p></div></div>
                <div className="system-cards">
                  {systems.slice(0, 8).map(item => (
                    <button key={item.id} className="system-card" onClick={() => {
                      setSystem(item.id)
                      setPage('explorar')
                    }}>
                      <span className={`system-card-icon dot-${item.id}`}><Activity size={19} /></span>
                      <span className="system-card-name">{item.name}</span>
                      <span className="system-card-count">{item.count} estruturas</span>
                      <ChevronRight className="system-card-arrow" size={17} />
                    </button>
                  ))}
                </div>
              </section>
            </>
          )}

          {(page === 'explorar' || page === 'favoritos') && (
            <>
              <section className="welcome-row compact">
                <div>
                  <div className="eyebrow"><Search size={14} /> CATÃLOGO ANATÃ”MICO</div>
                  <h1>{PAGE_NAMES[page]}</h1>
                  <p>{page === 'favoritos'
                    ? 'Reveja as estruturas que vocÃª salvou para estudar.'
                    : 'Pesquise estruturas, consulte seus identificadores e organize seus estudos.'}</p>
                </div>
              </section>

              <section className="catalog-layout">
                <div className="catalog-main">
                  <div className="search-panel">
                    <div className="search-input-wrap">
                      <Search size={19} />
                      <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar por nome, ID ou conceito..." aria-label="Buscar estrutura anatÃ´mica" />
                      {query && <button className="icon-button" onClick={() => setQuery('')} aria-label="Limpar busca"><X size={16} /></button>}
                    </div>
                    <div className="filter-row">
                      <label htmlFor="system-filter">Sistema anatÃ´mico</label>
                      <select id="system-filter" value={system} onChange={event => setSystem(event.target.value)}>
                        <option value="all">Todos os sistemas</option>
                        {systems.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                      </select>
                      <span className="result-count">{filteredParts.length} resultados exibidos</span>
                    </div>
                  </div>

                  {loadError && <div className="error-panel">{loadError}</div>}

                  <div className="structure-list">
                    {!data && !loadError && <div className="empty-state"><Activity size={26} /><strong>Carregando estruturas...</strong></div>}
                    {data && filteredParts.length === 0 && (
                      <div className="empty-state"><Search size={26} /><strong>Nenhuma estrutura encontrada</strong><p>Tente outro nome ou altere o filtro.</p></div>
                    )}
                    {filteredParts.map(part => (
                      <button key={part.id} className={`structure-row ${selected?.id === part.id ? 'structure-selected' : ''}`} onClick={() => { setSelected(part); setPage('atlas') }}>
                        <span className={`structure-symbol dot-${part.system}`}><Activity size={17} /></span>
                        <span className="structure-info"><strong>{part.name}</strong><small>{part.id} Â· {SYSTEM_NAMES[part.system] ?? part.system}</small></span>
                        <button className="favorite-inline" onClick={event => {
                          event.stopPropagation()
                          toggleFavorite(part.id)
                        }} aria-label={favorites.includes(part.id) ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}>
                          <Heart size={18} fill={favorites.includes(part.id) ? 'currentColor' : 'none'} />
                        </button>
                        <ChevronRight size={16} className="row-chevron" />
                      </button>
                    ))}
                    {data && filteredParts.length >= 250 && (
                      <p className="list-limit">Mostrando atÃ© 250 resultados. Refine sua busca para localizar outras estruturas.</p>
                    )}
                  </div>
                </div>

                <aside className="details-panel">
                  {selected ? (
                    <>
                      <div className="details-top"><span className="eyebrow">DETALHES DA ESTRUTURA</span>
                        <button className="icon-button" onClick={() => setSelected(null)} aria-label="Fechar detalhes"><X size={18} /></button>
                      </div>
                      <div className={`detail-symbol dot-${selected.system}`}><Activity size={25} /></div>
                      <h2>{selected.name}</h2>
                      <p className="detail-system">{SYSTEM_NAMES[selected.system] ?? selected.system}</p>
                      <div className="metadata-block"><span>ID da estrutura</span><strong>{selected.id}</strong></div>
                      <div className="metadata-block"><span>ID do conceito</span><strong>{selected.conceptId}</strong></div>
                      {selectedConcept && <div className="metadata-block"><span>Conceito anatÃ´mico</span><strong>{selectedConcept.name}</strong></div>}
                      <div className="metadata-block"><span>VÃ©rtices do modelo</span><strong>{selected.vertexCount.toLocaleString('pt-BR')}</strong></div>
                      <button className={favorites.includes(selected.id) ? 'secondary-button favorited' : 'secondary-button'} onClick={() => toggleFavorite(selected.id)}>
                        <Heart size={17} fill={favorites.includes(selected.id) ? 'currentColor' : 'none'} />
                        {favorites.includes(selected.id) ? 'Salvo nos favoritos' : 'Adicionar aos favoritos'}
                      </button>
                      <div className="notes-heading"><StickyNote size={17} /><strong>Minhas anotaÃ§Ãµes</strong></div>
                      <textarea value={notes[selected.id] ?? ''} onChange={event => setNotes(previous => ({ ...previous, [selected.id]: event.target.value }))} placeholder="Escreva suas observaÃ§Ãµes sobre esta estrutura..." rows={5} />
                      <p className="autosave-note"><Check size={13} /> AnotaÃ§Ãµes salvas neste navegador automaticamente</p>
                      <div className="integration-note"><Info size={16} /><span>O item foi localizado no catÃ¡logo. O destaque direto da malha 3D ainda nÃ£o estÃ¡ integrado.</span></div>
                    </>
                  ) : (
                    <div className="details-empty"><div className="details-empty-icon"><CircleHelp size={23} /></div><h3>Detalhes da estrutura</h3><p>Selecione uma estrutura na lista para consultar seus identificadores, favoritar e escrever anotaÃ§Ãµes.</p></div>
                  )}
                </aside>
              </section>
            </>
          )}

          {page === 'estudo' && (
            <>
              <section className="welcome-row compact">
                <div><div className="eyebrow"><BookOpen size={14} /> APRENDIZADO ATIVO</div><h1>Modo de estudo</h1><p>Pratique a identificaÃ§Ã£o dos sistemas anatÃ´micos com os dados do atlas.</p></div>
                <button className="secondary-button" onClick={restartStudy}><RotateCcw size={16} /> Reiniciar sessÃ£o</button>
              </section>

              <section className="study-stats">
                <div className="stat-card"><div className="stat-icon purple"><BookOpen size={19} /></div><div><span>QuestÃµes respondidas</span><strong>{studyAnswered}</strong></div></div>
                <div className="stat-card"><div className="stat-icon blue"><Check size={19} /></div><div><span>Respostas corretas</span><strong>{studyScore}</strong></div></div>
                <div className="stat-card"><div className="stat-icon rose"><Activity size={19} /></div><div><span>Aproveitamento</span><strong>{studyAnswered ? Math.round(studyScore / studyAnswered * 100) : 0}%</strong></div></div>
              </section>

              <section className="quiz-card">
                <div className="quiz-topline"><span><Dices size={17} /> IDENTIFICAÃ‡ÃƒO DE SISTEMAS</span><span>QuestÃ£o {(studyIndex % Math.max(studyQuestions.length, 1)) + 1}</span></div>
                {currentQuestion ? <>
                  <div className="quiz-progress"><span style={{ width: `${studyAnswered ? studyScore / studyAnswered * 100 : 0}%` }} /></div>
                  <div className="quiz-question"><span className="question-label">A QUAL SISTEMA PERTENCE ESTA ESTRUTURA?</span><h2>{currentQuestion.name}</h2><p>Identificador: {currentQuestion.id}</p></div>
                  <div className="quiz-options">
                    {studyOptions.map(option => {
                      const answered = studyAnswer !== null
                      const correct = option === currentQuestion.system
                      const chosen = option === studyAnswer
                      return <button key={option} disabled={answered} className={`quiz-option ${answered && correct ? 'correct' : ''} ${answered && chosen && !correct ? 'incorrect' : ''}`} onClick={() => answerQuestion(option)}>
                        <span className="option-letter">{String.fromCharCode(65 + studyOptions.indexOf(option))}</span>
                        <span>{SYSTEM_NAMES[option] ?? option}</span>
                        {answered && correct && <Check size={18} />}
                        {answered && chosen && !correct && <X size={18} />}
                      </button>
                    })}
                  </div>
                  {studyAnswer !== null && <div className={`answer-feedback ${studyAnswer === currentQuestion.system ? 'feedback-correct' : 'feedback-incorrect'}`}>
                    <strong>{studyAnswer === currentQuestion.system ? 'Resposta correta!' : 'Ainda nÃ£o â€” revise o sistema.'}</strong>
                    <p>A resposta Ã© {SYSTEM_NAMES[currentQuestion.system] ?? currentQuestion.system}.</p>
                  </div>}
                  <div className="quiz-actions">
                    <span>Use o nome da estrutura como pista.</span>
                    <button className="primary-button" onClick={nextQuestion} disabled={studyAnswer === null}>PrÃ³xima questÃ£o <ChevronRight size={17} /></button>
                  </div>
                </> : <div className="empty-state">Carregando questÃµes...</div>}
              </section>
              <p className="study-disclaimer"><Info size={15} /> ExercÃ­cio introdutÃ³rio para memorizaÃ§Ã£o. NÃ£o avalia domÃ­nio anatÃ´mico completo.</p>
            </>
          )}

          <footer className="app-footer">
            <span>Anatomia 3D Â· Plataforma de estudo</span>
            <span>Dados anatÃ´micos para fins educacionais</span>
          </footer>
        </div>
      </main>
    </div>
  )
}

export default App


