import { useEffect, useMemo, useState } from 'react'
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
  skeletal: 'Sistema esquelético',
  nervous: 'Sistema nervoso',
  respiratory: 'Sistema respiratório',
  digestive: 'Sistema digestório',
  sensory: 'Sistema sensorial',
  connective: 'Tecido conjuntivo',
  cardiac: 'Sistema cardíaco',
  reproductive: 'Sistema reprodutor',
  urinary: 'Sistema urinário',
  integumentary: 'Sistema tegumentar',
  endocrine: 'Sistema endócrino',
  lymphatic: 'Sistema linfático',
}

const PAGE_NAMES: Record<Page, string> = {
  atlas: 'Atlas 3D',
  explorar: 'Explorar estruturas',
  favoritos: 'Meus favoritos',
  estudo: 'Modo de estudo',
}

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
        if (!response.ok) throw new Error('Não foi possível carregar o atlas.')
        return response.json() as Promise<AtlasData>
      })
      .then(json => {
        if (active) setData(json)
      })
      .catch(() => {
        if (active) {
          setLoadError('Não foi possível carregar os dados anatômicos. Verifique se public/atlas foi copiado corretamente.')
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

  const filteredParts = useMemo(() => {
    if (!data) return []
    const normalized = query.trim().toLocaleLowerCase()

    return data.parts.filter(part => {
      if (system !== 'all' && part.system !== system) return false
      if (page === 'favoritos' && !favorites.includes(part.id)) return false
      if (!normalized) return true

      const concept = data.concepts.find(item => item.id === part.conceptId)
      return [
        part.name,
        part.id,
        part.conceptId,
        concept?.name ?? '',
      ].some(value => value.toLocaleLowerCase().includes(normalized))
    }).slice(0, 250)
  }, [data, query, system, page, favorites])

  const selectedConcept = selected && data
    ? data.concepts.find(item => item.id === selected.conceptId)
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

        <div className="nav-label">ESPAÇO DE ESTUDO</div>
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

        <div className="nav-label systems-label">SISTEMAS ANATÔMICOS</div>
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
          <p>Conteúdo para fins educacionais. Não substitui avaliação ou orientação clínica.</p>
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
          <div className="topbar-status"><span className="status-dot" /> Atlas disponível</div>
        </header>

        <div className="page-content">
          {page === 'atlas' && (
            <>
              <section className="welcome-row">
                <div>
                  <div className="eyebrow"><Layers3 size={14} /> ANATOMIA HUMANA</div>
                  <h1>Explore o corpo humano.</h1>
                  <p>Visualize estruturas em 3D e aprofunde seus estudos anatômicos.</p>
                </div>
                <button className="primary-button" onClick={() => selectPage('explorar')}>
                  <Search size={17} /> Buscar estruturas
                </button>
              </section>

              <section className="stats-grid">
                <div className="stat-card">
                  <div className="stat-icon purple"><Layers3 size={19} /></div>
                  <div><span>Partes anatômicas</span><strong>{data?.parts.length.toLocaleString('pt-BR') ?? '—'}</strong></div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon blue"><Activity size={19} /></div>
                  <div><span>Sistemas disponíveis</span><strong>{systems.length || '—'}</strong></div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon rose"><Heart size={19} /></div>
                  <div><span>Seus favoritos</span><strong>{favorites.length}</strong></div>
                </div>
              </section>

              <section className="atlas-card">
                <div className="section-heading">
                  <div><h2>Visualizador anatômico</h2><p>Use os controles do atlas para navegar pelo modelo.</p></div>
                  <a className="text-link" href="/atlas/" target="_blank" rel="noreferrer">
                    Abrir isolado <ExternalLink size={15} />
                  </a>
                </div>
                <div className="iframe-wrap">
                  <iframe title="Atlas anatômico humano em 3D" src="/atlas/" allow="fullscreen" />
                </div>
              </section>

              <section className="systems-section">
                <div className="section-heading"><div><h2>Explore por sistema</h2><p>Escolha uma área para encontrar estruturas.</p></div></div>
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
                  <div className="eyebrow"><Search size={14} /> CATÁLOGO ANATÔMICO</div>
                  <h1>{PAGE_NAMES[page]}</h1>
                  <p>{page === 'favoritos'
                    ? 'Reveja as estruturas que você salvou para estudar.'
                    : 'Pesquise estruturas, consulte seus identificadores e organize seus estudos.'}</p>
                </div>
              </section>

              <section className="catalog-layout">
                <div className="catalog-main">
                  <div className="search-panel">
                    <div className="search-input-wrap">
                      <Search size={19} />
                      <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar por nome, ID ou conceito..." aria-label="Buscar estrutura anatômica" />
                      {query && <button className="icon-button" onClick={() => setQuery('')} aria-label="Limpar busca"><X size={16} /></button>}
                    </div>
                    <div className="filter-row">
                      <label htmlFor="system-filter">Sistema anatômico</label>
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
                      <button key={part.id} className={`structure-row ${selected?.id === part.id ? 'structure-selected' : ''}`} onClick={() => setSelected(part)}>
                        <span className={`structure-symbol dot-${part.system}`}><Activity size={17} /></span>
                        <span className="structure-info"><strong>{part.name}</strong><small>{part.id} · {SYSTEM_NAMES[part.system] ?? part.system}</small></span>
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
                      <p className="list-limit">Mostrando até 250 resultados. Refine sua busca para localizar outras estruturas.</p>
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
                      {selectedConcept && <div className="metadata-block"><span>Conceito anatômico</span><strong>{selectedConcept.name}</strong></div>}
                      <div className="metadata-block"><span>Vértices do modelo</span><strong>{selected.vertexCount.toLocaleString('pt-BR')}</strong></div>
                      <button className={favorites.includes(selected.id) ? 'secondary-button favorited' : 'secondary-button'} onClick={() => toggleFavorite(selected.id)}>
                        <Heart size={17} fill={favorites.includes(selected.id) ? 'currentColor' : 'none'} />
                        {favorites.includes(selected.id) ? 'Salvo nos favoritos' : 'Adicionar aos favoritos'}
                      </button>
                      <div className="notes-heading"><StickyNote size={17} /><strong>Minhas anotações</strong></div>
                      <textarea value={notes[selected.id] ?? ''} onChange={event => setNotes(previous => ({ ...previous, [selected.id]: event.target.value }))} placeholder="Escreva suas observações sobre esta estrutura..." rows={5} />
                      <p className="autosave-note"><Check size={13} /> Anotações salvas neste navegador automaticamente</p>
                      <div className="integration-note"><Info size={16} /><span>O item foi localizado no catálogo. O destaque direto da malha 3D ainda não está integrado.</span></div>
                    </>
                  ) : (
                    <div className="details-empty"><div className="details-empty-icon"><CircleHelp size={23} /></div><h3>Detalhes da estrutura</h3><p>Selecione uma estrutura na lista para consultar seus identificadores, favoritar e escrever anotações.</p></div>
                  )}
                </aside>
              </section>
            </>
          )}

          {page === 'estudo' && (
            <>
              <section className="welcome-row compact">
                <div><div className="eyebrow"><BookOpen size={14} /> APRENDIZADO ATIVO</div><h1>Modo de estudo</h1><p>Pratique a identificação dos sistemas anatômicos com os dados do atlas.</p></div>
                <button className="secondary-button" onClick={restartStudy}><RotateCcw size={16} /> Reiniciar sessão</button>
              </section>

              <section className="study-stats">
                <div className="stat-card"><div className="stat-icon purple"><BookOpen size={19} /></div><div><span>Questões respondidas</span><strong>{studyAnswered}</strong></div></div>
                <div className="stat-card"><div className="stat-icon blue"><Check size={19} /></div><div><span>Respostas corretas</span><strong>{studyScore}</strong></div></div>
                <div className="stat-card"><div className="stat-icon rose"><Activity size={19} /></div><div><span>Aproveitamento</span><strong>{studyAnswered ? Math.round(studyScore / studyAnswered * 100) : 0}%</strong></div></div>
              </section>

              <section className="quiz-card">
                <div className="quiz-topline"><span><Dices size={17} /> IDENTIFICAÇÃO DE SISTEMAS</span><span>Questão {(studyIndex % Math.max(studyQuestions.length, 1)) + 1}</span></div>
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
                    <strong>{studyAnswer === currentQuestion.system ? 'Resposta correta!' : 'Ainda não — revise o sistema.'}</strong>
                    <p>A resposta é {SYSTEM_NAMES[currentQuestion.system] ?? currentQuestion.system}.</p>
                  </div>}
                  <div className="quiz-actions">
                    <span>Use o nome da estrutura como pista.</span>
                    <button className="primary-button" onClick={nextQuestion} disabled={studyAnswer === null}>Próxima questão <ChevronRight size={17} /></button>
                  </div>
                </> : <div className="empty-state">Carregando questões...</div>}
              </section>
              <p className="study-disclaimer"><Info size={15} /> Exercício introdutório para memorização. Não avalia domínio anatômico completo.</p>
            </>
          )}

          <footer className="app-footer">
            <span>Anatomia 3D · Plataforma de estudo</span>
            <span>Dados anatômicos para fins educacionais</span>
          </footer>
        </div>
      </main>
    </div>
  )
}

export default App
