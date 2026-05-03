export default function InjuriesLosses(): JSX.Element {
  return (
    <>
      <div className="page-header">
        <div className="titles">
          <div className="eyebrow">медичні · поранення / небойові</div>
          <h1>Поранення та втрати</h1>
          <div className="sub">
            Облік поранень та небойових втрат з датами та обставинами
          </div>
        </div>
      </div>
      <div className="card" style={{ padding: 24 }}>
        <div style={{ color: 'var(--fg-2)', fontSize: 13, lineHeight: 1.6 }}>
          Облік поранень та небойових втрат з датами та обставинами. Ведення статистики за період.
          <br />
          <span className="dim">Буде реалізовано у наступних тижнях.</span>
        </div>
      </div>
    </>
  )
}
