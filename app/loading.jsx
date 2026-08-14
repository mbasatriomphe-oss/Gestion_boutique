export default function Loading() {
  return (
    <div style={{display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center'}}>
      <div style={{textAlign: 'center'}}>
        <div style={{width: 40, height: 40, border: '4px solid #ccc', borderTopColor: '#333', borderRadius: '50%', margin: '0 auto', animation: 'spin 1s linear infinite'}} />
        <p style={{marginTop: 12}}>Chargement…</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
