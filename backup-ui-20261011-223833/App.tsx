function App() {
  return (
    <main
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: '#f3f4f4',
      }}
    >
      <iframe
        title="Anatomia 3D — Atlas anatômico humano"
        src="/atlas/"
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          border: 0,
        }}
        allow="fullscreen"
      />
    </main>
  )
}

export default App
