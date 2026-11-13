import React, { useState } from 'react';

interface Props {
  onEnter: () => void;
}

export const PrologueIntro: React.FC<Props> = ({ onEnter }) => {
  const [dispersing, setDispersing] = useState(false);

  const handleInitiate = () => {
    if (dispersing) return;
    setDispersing(true);
    // Allow text to disperse like stardust before triggering Earth zoom-out
    setTimeout(() => {
      onEnter();
    }, 1600);
  };

  return (
    <section className={`prologue-screen ${dispersing ? 'dispersing' : ''}`} aria-label="Prologue Introduction">
      {/* Dynamic Stardust Particles Background */}
      <div className="prologue-stars-layer" aria-hidden="true" />

      <div className={`prologue-content-box ${dispersing ? 'stardust-scatter' : ''}`}>
        <p className="prologue-eyebrow mono">
          <span>●</span> NASA SPACE APPS CHALLENGE 2026 <span>●</span>
        </p>

        <h1 className="prologue-quote">
          “Across the silent dust of worlds not our own, humanity left its machines behind.”
        </h1>

        <p className="prologue-reflection">
          They did not fall in defeat. They endured the harsh cosmic vacuum, transmitted humanity’s greatest discoveries,
          and remained in solitary vigil where their journeys ended.
        </p>

        <div className="prologue-arabic-statement" dir="rtl">
          مركباتٌ استقرت في صمت الفضاء الشاسع... لم تُهزم، بل بقيت شاهداً أبدياً على عظمة الفضول البشري.
        </div>

        <div className="prologue-action-area">
          <button
            className="prologue-init-btn"
            onClick={handleInitiate}
            disabled={dispersing}
          >
            <span className="btn-label">{dispersing ? 'DISPERSING INTO COSMOS...' : 'ENTER THE EXPEDITION // ابدأ الرحلة'}</span>
            <span className="btn-arrow">→</span>
          </button>
          <span className="prologue-hint mono">PRESS SPACEBAR OR CLICK TO INITIATE</span>
        </div>
      </div>
    </section>
  );
};
