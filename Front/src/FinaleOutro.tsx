import React from 'react';

interface Props {
  onReplay: () => void;
}

export const FinaleOutro: React.FC<Props> = ({ onReplay }) => {
  return (
    <section className="finale-monumental-container" aria-label="Expedition Finale">
      {/* Cosmic Vignette Overlay */}
      <div className="finale-cosmic-vignette" aria-hidden="true" />

      {/* Main Monumental Typography */}
      <div className="finale-inner-content">
        <div className="finale-badge-row">
          <span className="live-pulse" />
          <span className="mono">EXPEDITION COMPLETE // NASA SPACE APPS CHALLENGE 2026</span>
        </div>

        {/* Giant typography that fills the screen */}
        <h1 className="finale-screen-filling-title">
          ABANDONED<br />
          <span className="highlight-text">BUT NOT FORGOTTEN</span>
        </h1>

        <p className="finale-monumental-quote">
          “We went looking for what we left behind. We found the immortal footprints of human curiosity across the cosmos.”
        </p>

        <p className="finale-arabic-quote" dir="rtl">
          مركباتٌ أصبحت شواهد خالدة على أن علمنا وشغفنا بالاستكشاف لا تحده حدود كوكب.
        </p>

        {/* Action Controls - Replay only */}
        <div className="finale-actions-row">
          <button className="primary" onClick={onReplay}>
            ↺ Replay Expedition / إعادة الرحلة
          </button>
        </div>
      </div>
    </section>
  );
};
