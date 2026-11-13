import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SpaceScene, type AssetState } from './SpaceScene';
import { artifacts, fallbackAnswer, type Artifact } from './catalog';
import { buildTour, tourConfig, validateTour, type ArtifactId, type World } from './tour';
import { ASSET_CALIBRATIONS } from './calibration';
import { PrologueIntro } from './PrologueIntro';
import { FinaleOutro } from './FinaleOutro';

gsap.registerPlugin(ScrollTrigger);

export type ExperienceStage =
  | 'prologue'
  | 'welcome'
  | 'planetSelect'
  | 'artifactSelect'
  | 'travel'
  | 'discovery'
  | 'story'
  | 'worldTransition'
  | 'finale';

const API = import.meta.env.VITE_API_BASE_URL;
const chapterIds = ['mission', 'machine', 'journey', 'discoveries', 'what-remains'];

export default function App() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<SpaceScene | null>(null);
  const chapterScroll = useRef<HTMLDivElement>(null);

  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const manualChapterScroll = useRef(false);
  const programmaticScroll = useRef(false);
  const tourRef = useRef<ArtifactId[]>([]);
  const tourIndex = useRef(0);

  const pausedRef = useRef(false);
  const narratorPausedRef = useRef(false);
  const inspectingRef = useRef(false);

  // Experience Navigation State
  const [stage, setStage] = useState<ExperienceStage>('prologue');
  const [selectedWorld, setSelectedWorld] = useState<World>('moon');
  const [artifactId, setArtifactId] = useState<ArtifactId>('eagle');
  const [chapter, setChapter] = useState(0);
  const [narrationRun, setNarrationRun] = useState(0);

  const [paused, setPaused] = useState(false);
  const [narratorPaused, setNarratorPaused] = useState(false);
  const [caption, setCaption] = useState(true);
  const [manualScrollHint, setManualScrollHint] = useState(false);

  const [chat, setChat] = useState(false);
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<{ role: string; text: string; sources?: { title: string; url?: string }[] }[]>([]);
  const [busy, setBusy] = useState(false);

  const [transition, setTransition] = useState(false);
  const [loading, setLoading] = useState(false);
  const [inspecting, setInspecting] = useState(false);
  const [menu, setMenu] = useState(false);
  const [assetStates, setAssetStates] = useState<AssetState[]>([]);
  const [travelState, setTravelState] = useState('DEPARTURE');

  const artifact = artifacts.find(x => x.id === artifactId) || artifacts[0];
  const calib = ASSET_CALIBRATIONS[artifactId];
  const visualStatus = assetStates.find(x => x.id === `artifact-${artifactId}`);
  const manualMode = manualChapterScroll.current;
  const debugAssets = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debugAssets');

  pausedRef.current = paused;
  narratorPausedRef.current = narratorPaused;
  inspectingRef.current = inspecting;

  // 1. Initialize Scene Engine
  useEffect(() => {
    if (!canvas.current) return;
    const instance = new SpaceScene(canvas.current);
    instance.onAssets = setAssetStates;
    setAssetStates([...instance.assets]);

    instance.onBlackout = (black, loadingState) => {
      setTransition(black);
      setLoading(loadingState);
    };
    instance.onTravelState = setTravelState;

    scene.current = instance;
    instance.showPrologue();
    if (new URLSearchParams(window.location.search).has('debugAssets')) {
      void instance.showLrvDiagnostic();
    }

    return () => {
      if (autoTimer.current) clearTimeout(autoTimer.current);
      instance.dispose();
      scene.current = null;
    };
  }, []);

  // 2. Cancellation Helpers
  const cancelAuto = useCallback(() => {
    if (autoTimer.current) {
      clearTimeout(autoTimer.current);
      autoTimer.current = null;
    }
  }, []);

  const stopNarration = useCallback(() => {
    cancelAuto();
    if (typeof window !== 'undefined') {
      window.speechSynthesis?.cancel();
    }
  }, [cancelAuto]);

  const finish = useCallback(() => {
    stopNarration();
    setStage('finale');
    setPaused(false);
    setInspecting(false);
    void scene.current?.playFinaleZoomOut();
  }, [stopNarration]);

  const handlePrologueEnter = useCallback(() => {
    void scene.current?.playPrologueEarthIntro().then(() => {
      setStage('welcome');
    });
  }, []);

  const startPrologue = useCallback(() => {
    stopNarration();
    scene.current?.cancelJourney();
    scene.current?.showPrologue();
    setStage('prologue');
    setMenu(false);
  }, [stopNarration]);

  // 3. Artifact Arrival Orchestration
  const startArtifact = useCallback(
    (id: ArtifactId, index?: number) => {
      cancelAuto();
      stopNarration();

      const record = artifacts.find(x => x.id === id) || artifacts[0];
      setArtifactId(id);
      setSelectedWorld(record.planet);
      setChapter(0);
      setPaused(false);
      setNarratorPaused(false);
      setInspecting(false);
      manualChapterScroll.current = false;
      setManualScrollHint(false);

      if (typeof index === 'number') {
        tourIndex.current = index;
      }

      setStage('travel');
      const previousWorld = selectedWorld;
      void scene.current?.showArtifact(record, false, previousWorld).then(() => {
        setLoading(false);
        setStage('discovery');
      });
    },
    [cancelAuto, stopNarration, selectedWorld]
  );

  const enterStory = useCallback(() => {
    setStage('story');
    if (scene.current) {
      scene.current.mode = 'SCROLL_STORY';
      scene.current.setChapterProgress(0);
    }
  }, []);

  // 4. Chapter Navigation & Narration
  const advance = useCallback(() => {
    cancelAuto();
    if (chapter < tourConfig.chaptersPerArtifact - 1) {
      const next = chapter + 1;
      setChapter(next);
      scene.current?.setChapterProgress(next);
      programmaticScroll.current = true;

      const scroller = chapterScroll.current;
      const page = scroller?.querySelector<HTMLElement>(`[data-chapter="${next}"]`);
      if (scroller && page) {
        scroller.scrollTo({ top: page.offsetTop, behavior: 'smooth' });
      }
      setTimeout(() => {
        programmaticScroll.current = false;
      }, 900);
      return;
    }

    // Move to next artifact in tour
    const nextIndex = tourIndex.current + 1;
    if (nextIndex >= tourRef.current.length) {
      finish();
      return;
    }

    const upcoming = artifacts.find(x => x.id === tourRef.current[nextIndex]);
    if (upcoming && upcoming.planet !== selectedWorld && !tourConfig.autoTransition) {
      setStage('worldTransition');
      return;
    }

    startArtifact(tourRef.current[nextIndex], nextIndex);
  }, [cancelAuto, chapter, finish, selectedWorld, startArtifact]);

  const advanceRef = useRef(advance);
  advanceRef.current = advance;

  // Narration Synchronization
  useEffect(() => {
    if (stage !== 'story') return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();
    const narration = artifact.chapters[chapter]?.text;
    if (!narration) return;

    const utterance = new SpeechSynthesisUtterance(narration);
    utterance.rate = 0.88;
    const startedAt = Date.now();
    const minimumReadMs = Math.ceil((narration.trim().split(/\s+/).length / 2.4) * 1000);

    utterance.onend = () => {
      if (
        !tourConfig.autoAdvanceChapters ||
        manualChapterScroll.current ||
        pausedRef.current ||
        narratorPausedRef.current ||
        inspectingRef.current
      ) {
        return;
      }
      cancelAuto();
      autoTimer.current = setTimeout(
        () => advanceRef.current(),
        Math.max(1400, minimumReadMs - (Date.now() - startedAt) + 1400)
      );
    };

    window.speechSynthesis.speak(utterance);
    return () => {
      window.speechSynthesis.cancel();
      cancelAuto();
    };
  }, [stage, artifactId, chapter, cancelAuto, artifact, narrationRun]);

  useEffect(() => {
    if (stage !== 'story') return;
    if (paused || narratorPaused) {
      window.speechSynthesis?.pause();
    } else {
      window.speechSynthesis?.resume();
    }
  }, [paused, narratorPaused, stage]);

  // 5. Global Keyboard Shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'Escape') {
        if (inspecting) {
          scene.current?.resetView();
          scene.current?.returnGuided();
          setInspecting(false);
        } else if (chat) {
          setChat(false);
        } else if (menu) {
          setMenu(false);
        }
      }

      if (stage === 'story') {
        if (e.key === ' ') {
          e.preventDefault();
          paused ? resumeJourney() : pauseJourney();
        }
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault();
          advance();
        }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault();
          if (chapter > 0) {
            const prev = chapter - 1;
            setChapter(prev);
            scene.current?.setChapterProgress(prev);
            const page = chapterScroll.current?.querySelector<HTMLElement>(`[data-chapter="${prev}"]`);
            page?.scrollIntoView({ behavior: 'smooth' });
          }
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [stage, paused, inspecting, chat, menu, advance, chapter]);

  // 6. Chapter Scroll Synchronization
  useLayoutEffect(() => {
    if (stage !== 'story' || !chapterScroll.current) return;
    const scroller = chapterScroll.current;

    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>('.chapter-page').forEach((page, index) => {
        ScrollTrigger.create({
          trigger: page,
          scroller,
          start: 'top 52%',
          end: 'bottom 48%',
          onEnter: () => handleChapterScroll(index),
          onEnterBack: () => handleChapterScroll(index),
        });
      });
    }, scroller);

    return () => ctx.revert();
  }, [stage, artifactId]);

  const handleChapterScroll = (index: number) => {
    if (programmaticScroll.current || index === chapter) return;
    cancelAuto();
    manualChapterScroll.current = true;
    setManualScrollHint(true);
    setChapter(index);
    scene.current?.setChapterProgress(index);
  };

  // 7. Navigation Actions
  function handleStartJourney() {
    stopNarration();
    setSelectedWorld('moon');
    scene.current?.showPlanetSelection('moon');
    setStage('planetSelect');
  }

  function handleSelectPlanet(world: World) {
    setSelectedWorld(world);
    scene.current?.showPlanetSelection(world);
  }

  function handleConfirmPlanet() {
    stopNarration();
    setStage('artifactSelect');
  }

  function handleSelectFirstArtifact(id: ArtifactId) {
    const sequence = buildTour(selectedWorld, id);
    if (!validateTour(sequence)) {
      throw new Error('Generated tour did not contain all six artifacts exactly once.');
    }
    tourRef.current = sequence;
    tourIndex.current = 0;
    startArtifact(sequence[0], 0);
  }

  /** Skip Travel: Only fast-forwards active travel, NEVER exits artifact or expedition */
  function handleSkipTravel() {
    scene.current?.skipTravel();
    setLoading(false);
    setTransition(false);
    setStage('discovery');
  }

  /** Skip Story: Advances to next artifact in tour */
  function handleSkipStory() {
    const nextIndex = tourIndex.current + 1;
    if (nextIndex >= tourRef.current.length) {
      finish();
    } else {
      startArtifact(tourRef.current[nextIndex], nextIndex);
    }
  }

  /** Exit Current Artifact: Returns to artifact selector */
  function handleExitArtifact() {
    stopNarration();
    scene.current?.cancelJourney();
    setInspecting(false);
    setPaused(false);
    setStage('artifactSelect');
  }

  /** Exit Expedition: Returns safely to Welcome screen */
  function handleExitExpedition() {
    stopNarration();
    scene.current?.cancelJourney();
    scene.current?.showWelcome();
    setInspecting(false);
    setPaused(false);
    setStage('welcome');
  }

  function pauseJourney() {
    cancelAuto();
    window.speechSynthesis?.pause();
    scene.current?.pauseCamera(true);
    setPaused(true);
  }

  function resumeJourney() {
    setPaused(false);
    manualChapterScroll.current = false;
    setManualScrollHint(false);
    scene.current?.pauseCamera(false);
    if (narratorPaused) setNarratorPaused(false);
  }

  function skipNarration() {
    window.speechSynthesis?.cancel();
    setNarratorPaused(false);
    advance();
  }

  function replay() {
    handleExitExpedition();
    setMessages([]);
  }

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    const text = question.trim();
    if (!text) return;
    setQuestion('');
    setMessages(m => [...m, { role: 'user', text }]);
    setBusy(true);

    try {
      if (!API) throw new Error('Archive API not configured');
      const res = await fetch(`${API.replace(/\/$/, '')}/api/ai/ask/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artifact_id: artifact.id,
          chapter_id: chapterIds[chapter],
          question: text,
          history: messages.slice(-8).map(m => ({ role: m.role, content: m.text })),
        }),
      });
      if (!res.ok) throw new Error(`Archive returned ${res.status}`);
      const data = await res.json();
      setMessages(m => [...m, { role: 'assistant', text: data.answer ?? 'No answer was returned.', sources: data.sources ?? [] }]);
    } catch {
      const fallback = fallbackAnswer(artifact, text);
      setMessages(m => [...m, { role: 'assistant', text: fallback.answer, sources: fallback.sources }]);
    } finally {
      setBusy(false);
    }
  }

  // Progress metrics
  const planetArtifacts = artifacts.filter(x => x.planet === selectedWorld);
  const currentWorldNumber = selectedWorld === 'moon' ? 'MOON' : 'MARS';
  const artifactIndexInWorld = planetArtifacts.findIndex(x => x.id === artifactId) + 1;

  return (
    <main className="museum">
      <canvas ref={canvas} className="space" aria-label="Interactive 3D space scene" />
      <div className="shade" />

      {/* Top Header */}
      <header className="topbar">
        <button className="wordmark" onClick={replay}>
          <span className="mark">✳</span> ABANDONED <i>but not forgotten</i>
        </button>
        <div className="topmeta">
          <span className="live-dot" /> DIGITAL SPACE MUSEUM
          <span className="top-divider" />
          {stage === 'story' || stage === 'discovery'
            ? `${currentWorldNumber} · ${artifactIndexInWorld || 1}/3 · ${artifact.year} · ${artifact.name.toUpperCase()}`
            : stage === 'planetSelect'
            ? `SELECT DESTINATION`
            : stage === 'artifactSelect'
            ? `${selectedWorld.toUpperCase()} MISSIONS`
            : 'NASA SPACE APPS CHALLENGE 2026'}
        </div>
        <div className="header-actions">
          <button className="small-control" onClick={() => setCaption(v => !v)}>
            {caption ? 'CAPTIONS ON' : 'CAPTIONS OFF'}
          </button>
          <button className="small-control" onClick={() => setMenu(v => !v)}>
            EXPEDITION ▾
          </button>
        </div>
      </header>

      {/* HUD SCI-FI CORNER RETICLES */}
      <div className="sci-fi-reticle top-left" aria-hidden="true">
        <span className="reticle-mark">+</span>
        <small className="reticle-label">SYS: NOMINAL // LINK: DSN-70M</small>
      </div>
      <div className="sci-fi-reticle top-right" aria-hidden="true">
        <small className="reticle-label">{selectedWorld.toUpperCase()} TRAJECTORY</small>
        <span className="reticle-mark">+</span>
      </div>
      <div className="sci-fi-reticle bottom-left" aria-hidden="true">
        <span className="reticle-mark">+</span>
        <small className="reticle-label">SEC: 092 // ORBITAL ARCHIVE</small>
      </div>
      <div className="sci-fi-reticle bottom-right" aria-hidden="true">
        <small className="reticle-label">GRID: REL-ALPHA // 2026</small>
        <span className="reticle-mark">+</span>
      </div>

      {/* TOP-RIGHT LIVE TELEMETRY MODULE */}
      {stage !== 'welcome' && stage !== 'travel' && !transition && (
        <aside className="sci-fi-telemetry-module" aria-label="Planetary telemetry">
          <div className="telemetry-header">
            <span className="live-dot pulse" />
            <span className="telemetry-title">LIVE TELEMETRY // {selectedWorld.toUpperCase()}</span>
          </div>
          <div className="telemetry-grid">
            <div className="telemetry-cell">
              <span className="label">COORDINATES</span>
              <span className="value mono">{artifact?.specs?.coordinates || (selectedWorld === 'moon' ? '0.674° N, 23.473° E' : '19.33° N, 33.55° W')}</span>
            </div>
            <div className="telemetry-cell">
              <span className="label">SURFACE REGION</span>
              <span className="value">{artifact?.specs?.siteName || (selectedWorld === 'moon' ? 'Mare Tranquillitatis' : 'Ares Vallis')}</span>
            </div>
            <div className="telemetry-cell">
              <span className="label">ATMOSPHERE</span>
              <span className="value mono">{selectedWorld === 'moon' ? '10⁻¹² Pa (VACUUM)' : '610 Pa (CO₂ 95.3%)'}</span>
            </div>
            <div className="telemetry-cell">
              <span className="label">SOLAR FLUX / G</span>
              <span className="value mono">{selectedWorld === 'moon' ? '1,361 W/m² · 0.166g' : '590 W/m² · 0.379g'}</span>
            </div>
          </div>
        </aside>
      )}

      {/* CINEMATIC BLACKOUT SHUTTER / VEIL */}
      <div className={`cinematic-curtain ${transition ? 'active' : ''}`} aria-hidden="true" />

      {/* 0. STAGE: PROLOGUE CINEMATIC INTRO */}
      {stage === 'prologue' && (
        <PrologueIntro onEnter={handlePrologueEnter} />
      )}

      {/* 1. STAGE: WELCOME */}
      {stage === 'welcome' && (
        <section className="selector" style={{ maxWidth: '640px' }}>
          <p className="eyebrow">A DIGITAL MUSEUM OF MISSIONS THAT REMAIN</p>
          <h2>Some journeys never return.</h2>
          <p className="selector-sub">
            Across the Moon and Mars, humanity’s machines still rest in the dust — holding the trace of our greatest
            scientific questions.
          </p>
          <button className="primary" onClick={handleStartJourney}>
            Start Journey <span>→</span>
          </button>
        </section>
      )}

      {/* 2. STAGE: PLANET SELECTION */}
      {stage === 'planetSelect' && (
        <section className="selector">
          <p className="eyebrow">STEP 01 — SELECT STARTING PLANET</p>
          <h2>Where shall we begin?</h2>
          <p className="selector-sub">Choose a world to inspect its historic landing sites.</p>
          <div className="world-choice">
            <button
              className={selectedWorld === 'moon' ? 'selected' : ''}
              onClick={() => handleSelectPlanet('moon')}
            >
              <span className="world-index">DESTINATION 01</span>
              <strong>The Moon</strong>
              <small>Explore Apollo 11 (Eagle), Surveyor 3, and the Apollo 15 Lunar Rover.</small>
              <span className="choose-arrow">{selectedWorld === 'moon' ? '✓' : '↗'}</span>
            </button>
            <button
              className={selectedWorld === 'mars' ? 'selected' : ''}
              onClick={() => handleSelectPlanet('mars')}
            >
              <span className="world-index">DESTINATION 02</span>
              <strong>Mars</strong>
              <small>Explore Sojourner (Pathfinder), Spirit, and Opportunity.</small>
              <span className="choose-arrow">{selectedWorld === 'mars' ? '✓' : '↗'}</span>
            </button>
          </div>
          <div style={{ marginTop: '24px', display: 'flex', gap: '14px', alignItems: 'center' }}>
            <button className="primary" onClick={handleConfirmPlanet}>
              Continue to {selectedWorld === 'moon' ? 'The Moon' : 'Mars'} <span>→</span>
            </button>
            <button className="text-button" onClick={handleExitExpedition}>
              ← Back to welcome
            </button>
          </div>
        </section>
      )}

      {/* 3. STAGE: ARTIFACT SELECTION */}
      {stage === 'artifactSelect' && (
        <section className="selector artifact-selector">
          <p className="eyebrow">
            STEP 02 — {selectedWorld.toUpperCase()} · SELECT STARTING ARTIFACT
          </p>
          <h2>Choose where to begin.</h2>
          <p className="selector-sub">The remaining artifacts on this world will follow in canonical order.</p>
          <div className="artifact-choice">
            {artifacts
              .filter(x => x.planet === selectedWorld)
              .map((x, i) => (
                <button key={x.id} onClick={() => handleSelectFirstArtifact(x.id)}>
                  <span className="world-index">
                    0{i + 1} / {x.year}
                  </span>
                  <strong>{x.name}</strong>
                  <small>{x.summary}</small>
                  <span className="choose-arrow">↗</span>
                </button>
              ))}
          </div>
          <div style={{ marginTop: '24px' }}>
            <button
              className="text-button"
              onClick={() => {
                scene.current?.showPlanetSelection(selectedWorld);
                setStage('planetSelect');
              }}
            >
              ← Back to planet selection
            </button>
          </div>
        </section>
      )}

      {/* 4. STAGE: TRAVEL HUD & MINIMALIST TELEMETRY */}
      {stage === 'travel' && !transition && travelState !== 'REVEAL' && (
        <div className="travel-hud">
          <div className="travel-hud-badge">
            <span className="dot pulse" />
            <span>{travelState.replace('_', ' ')}</span>
          </div>
          <h2>
            {travelState === 'DESCENT'
              ? `Entering landing trajectory for ${selectedWorld === 'moon' ? 'the Moon' : 'Mars'}.`
              : travelState === 'APPROACH'
              ? `Target coordinates locked · Decelerating.`
              : 'In transit through deep space.'}
          </h2>
          <div className="travel-telemetry-row">
            <span>DESTINATION: {selectedWorld.toUpperCase()}</span>
            <span className="dot">·</span>
            <span>AUTONOMOUS DESCENT PROFILE</span>
          </div>
          <button className="small-control travel-skip-btn" onClick={handleSkipTravel}>
            Skip travel sequence ↗
          </button>
        </div>
      )}

      {/* 4B. STAGE: BLACKOUT TELEMETRY (CENTERED AT 100% BLACK) */}
      {transition && (
        <div className="blackout-telemetry">
          <span className="eyebrow">{loading ? 'DOWNLINKING ARTIFACT DATA' : 'DESCENT PROFILE'}</span>
          <h2>{loading ? 'Preparing authentic landing telemetry.' : 'Touchdown confirmed. Entering landing site.'}</h2>
          <div className="telemetry-bar">
            <span className="loading-indicator" />
          </div>
        </div>
      )}

      {/* 4C. STAGE: MONUMENTAL CINEMATIC MISSION TITLE CARD (REVEAL BEAT ~4 SECONDS) */}
      {stage === 'travel' && travelState === 'REVEAL' && !transition && (
        <div className="monumental-title-card" aria-live="polite">
          <div className="title-card-inner">
            <div className="title-badge">[ DEEP SPACE ARTIFACT RECORD // {selectedWorld.toUpperCase()} ]</div>
            <h1 className="title-mission-name">{artifact.name.toUpperCase()}</h1>
            <div className="title-meta-line">
              <span>{artifact.mission.toUpperCase()}</span>
              <span className="dot">·</span>
              <span>LAUNCH {artifact.year}</span>
              <span className="dot">·</span>
              <span>{artifact.specs?.siteName?.toUpperCase() || selectedWorld.toUpperCase()}</span>
            </div>
            <div className="title-rule-line" />
            <p className="title-tagline">{artifact.summary}</p>
          </div>
        </div>
      )}

      {/* QUICK PLANET VEHICLE NAVIGATION SWITCHER */}
      {(stage === 'discovery' || stage === 'story') && (
        <nav className="planet-quick-dock" aria-label="Quick vehicle switcher">
          <div className="dock-label">
            <span className="live-dot" />
            <span>{selectedWorld.toUpperCase()} MISSIONS:</span>
          </div>
          <div className="dock-pills">
            {planetArtifacts.map((art, idx) => {
              const isActive = art.id === artifactId;
              return (
                <button
                  key={art.id}
                  className={`dock-pill ${isActive ? 'active' : ''}`}
                  onClick={() => {
                    if (!isActive) {
                      startArtifact(art.id, idx);
                    }
                  }}
                  title={`Switch to ${art.name} (${art.year})`}
                >
                  <span className="dock-pill-idx">0{idx + 1}</span>
                  <span className="dock-pill-name">{art.name}</span>
                  {isActive && <span className="dock-pill-dot" />}
                </button>
              );
            })}
          </div>
        </nav>
      )}

      {/* 5. STAGE: DISCOVERY HERO REVEAL */}
      {stage === 'discovery' && (
        <>
          <div className="hero-reveal-card">
            <div className="hero-badge-row">
              <span className="badge-tech">[ RECORD 0{artifactIndexInWorld || 1} // AUTHENTIC SITE ]</span>
              <span className="hero-coords-pill">{artifact.specs?.coordinates}</span>
            </div>
            <p className="eyebrow">
              HISTORICAL LANDING SITE · {selectedWorld.toUpperCase()} SURFACE
            </p>
            <h1>{artifact.name}</h1>
            <div className="hero-meta-line">
              <span>{artifact.mission}</span>
              <span className="dot">·</span>
              <span>{artifact.year}</span>
              <span className="dot">·</span>
              <span className="tag-highlight">{artifact.tag}</span>
            </div>
            <p className="hero-summary">{artifact.summary}</p>
            <div className="hero-reveal-actions">
              <button className="primary" onClick={enterStory}>
                Explore Mission Story <span>↓</span>
              </button>
              {artifact.model && (
                <button
                  className="small-control hero-inspect-btn"
                  onClick={() => {
                    scene.current?.inspect();
                    setInspecting(true);
                    setStage('story');
                  }}
                >
                  Inspect 3D Hardware ↗
                </button>
              )}
            </div>
          </div>

          {/* RIGHT-SIDE SCI-FI VEHICLE ARCHIVE SPECS CARD */}
          {artifact.specs && (
            <aside className="sci-fi-specs-card" aria-label="Vehicle engineering specifications">
              <div className="specs-card-head">
                <span className="badge-tech">[ SPECIFICATION PROFILE ]</span>
                <h3>{artifact.name}</h3>
                <p className="sub">{artifact.tag}</p>
              </div>
              <div className="specs-card-body">
                <div className="spec-row">
                  <span className="spec-label">MISSION DURATION</span>
                  <span className="spec-val">{artifact.specs.duration}</span>
                </div>
                <div className="spec-row">
                  <span className="spec-label">TOTAL MASS</span>
                  <span className="spec-val">{artifact.specs.mass}</span>
                </div>
                <div className="spec-row">
                  <span className="spec-label">LANDING SITE</span>
                  <span className="spec-val">{artifact.specs.siteName}</span>
                </div>
                <div className="spec-row">
                  <span className="spec-label">SURFACE STATUS</span>
                  <span className="spec-val highlight">{artifact.specs.hardwareStatus}</span>
                </div>
              </div>
              <div className="specs-card-foot">
                <span className="tech-scanline" />
                <small>PERMANENT ARTIFACT · NASA DEEP SPACE ARCHIVE</small>
              </div>
            </aside>
          )}
        </>
      )}

      {/* 6. STAGE: CHAPTER STORYTELLING */}
      {stage === 'story' && (
        <>
          <aside className="narrative-rail">
            {/* Pinned rail header: mission identity, progress, and quick controls */}
            <div className="rail-header">
              <div className="rail-identity">
                <p className="eyebrow">{artifact.tag}</p>
                <h2>{artifact.name}</h2>
                <div className="mission-line">
                  <span>{artifact.mission}</span>
                  <span className="dot">·</span>
                  <span>{artifact.year}</span>
                </div>
              </div>

              {artifact.modelNote && <p className="model-note">{artifact.modelNote}</p>}
              {!artifact.model && (
                <p className="model-note">
                  Authentic 3D model unavailable. This archive record is presented in historical context.
                </p>
              )}

              <div className="rail-status-bar">
                <div className="chapter-progress">
                  <span>CHAPTER 0{chapter + 1} / 05</span>
                  <div className="progress">
                    {artifact.chapters.map((_, i) => (
                      <span key={i} className={i <= chapter ? 'active' : ''} />
                    ))}
                  </div>
                </div>

                <div className="rail-actions">
                  {artifact.model && visualStatus?.status === 'ready' && (
                    <button
                      className={`action-btn ${inspecting ? 'active' : ''}`}
                      onClick={() => {
                        if (inspecting) {
                          scene.current?.returnGuided();
                          setInspecting(false);
                          if (!window.speechSynthesis?.speaking) {
                            setNarrationRun(n => n + 1);
                          } else {
                            window.speechSynthesis?.resume();
                          }
                        } else {
                          cancelAuto();
                          window.speechSynthesis?.pause();
                          scene.current?.inspect();
                          setInspecting(true);
                        }
                      }}
                      title={inspecting ? 'Return to guided story' : 'Inspect authentic 3D model'}
                    >
                      {inspecting ? 'Guided Story' : '3D Inspect ↗'}
                    </button>
                  )}

                  {inspecting && (
                    <button
                      className="action-btn"
                      onClick={() => scene.current?.resetView()}
                      title="Reset camera view"
                    >
                      Reset View
                    </button>
                  )}

                  <button
                    className="action-btn"
                    onClick={() => {
                      if (narratorPaused) {
                        window.speechSynthesis?.resume();
                        setNarratorPaused(false);
                      } else {
                        window.speechSynthesis?.pause();
                        setNarratorPaused(true);
                      }
                    }}
                    title={narratorPaused ? 'Resume voice narrator' : 'Pause voice narrator'}
                  >
                    {narratorPaused ? '▶ Audio' : 'Ⅱ Audio'}
                  </button>

                  <button
                    className="action-btn"
                    onClick={skipNarration}
                    title="Skip voice narration"
                  >
                    Skip →
                  </button>

                  <button
                    className="action-btn archive-action"
                    onClick={() => setChat(true)}
                    title="Ask Archive AI about this mission"
                  >
                    Archive ✳
                  </button>
                </div>
              </div>

              {inspecting && (
                <p className="inspection-hint">
                  Drag to rotate · scroll or pinch to zoom · reset view
                </p>
              )}
            </div>

            {/* Scrollable Story Chapters */}
            <div className="chapter-scroll" ref={chapterScroll}>
              {artifact.chapters.map((item, i) => (
                <section className="chapter-page" data-chapter={i} key={item.title}>
                  <p className="chapter-number">
                    {artifact.tag} · CHAPTER 0{i + 1}
                  </p>
                  <h3>{item.title}</h3>
                  <p className="chapter-copy">{item.text}</p>
                  {caption && <p className="caption">{item.text}</p>}
                  <div className="chapter-footer">
                    <span>
                      {artifact.mission} · {artifact.year}
                    </span>
                    {i < artifact.chapters.length - 1 && (
                      <button
                        onClick={() => {
                          programmaticScroll.current = false;
                          manualChapterScroll.current = true;
                          handleChapterScroll(i + 1);
                          chapterScroll.current
                            ?.querySelector<HTMLElement>(`[data-chapter="${i + 1}"]`)
                            ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }}
                      >
                        Next chapter ↓
                      </button>
                    )}
                  </div>
                </section>
              ))}

              <section className="chapter-end">
                <p className="eyebrow">ARTIFACT COMPLETE</p>
                <h3>Carry the story forward.</h3>
                <p className="chapter-copy">
                  The expedition continues. Your guide will take you to the next historic artifact.
                </p>
                <div className="end-actions">
                  <button className="primary" onClick={advance}>
                    Continue expedition <span>→</span>
                  </button>
                  <button className="text-button" onClick={handleSkipStory}>
                    Skip to next artifact
                  </button>
                </div>
              </section>
            </div>
          </aside>

          {/* RIGHT-SIDE SCI-FI VEHICLE ARCHIVE SPECS CARD IN STORY MODE */}
          {artifact.specs && (
            <aside className="sci-fi-specs-card story-mode-specs" aria-label="Vehicle engineering specifications">
              <div className="specs-card-head">
                <span className="badge-tech">[ MISSION ARCHIVE // SPEC ]</span>
                <h3>{artifact.name}</h3>
                <p className="sub">{artifact.tag}</p>
              </div>
              <div className="specs-card-body">
                <div className="spec-row">
                  <span className="spec-label">COORDINATES</span>
                  <span className="spec-val mono highlight">{artifact.specs.coordinates}</span>
                </div>
                <div className="spec-row">
                  <span className="spec-label">LANDING SITE</span>
                  <span className="spec-val">{artifact.specs.siteName}</span>
                </div>
                <div className="spec-row">
                  <span className="spec-label">MISSION DURATION</span>
                  <span className="spec-val">{artifact.specs.duration}</span>
                </div>
                <div className="spec-row">
                  <span className="spec-label">VEHICLE MASS</span>
                  <span className="spec-val">{artifact.specs.mass}</span>
                </div>
                <div className="spec-row">
                  <span className="spec-label">HARDWARE DISPOSITION</span>
                  <span className="spec-val highlight">{artifact.specs.hardwareStatus}</span>
                </div>
              </div>
              <div className="specs-card-foot">
                <span className="tech-scanline" />
                <small>NASA DEEP SPACE REPOSITORY · ARCHIVED</small>
              </div>
            </aside>
          )}

          {manualScrollHint && !paused && (
            <div className="manual-hint">
              <span>You've taken manual control — scroll freely</span>
              <button
                onClick={() => {
                  resumeJourney();
                  setManualScrollHint(false);
                }}
              >
                Resume guided narration ↑
              </button>
            </div>
          )}
        </>
      )}

      {/* 7. STAGE: WORLD TRANSITION */}
      {stage === 'worldTransition' && (
        <div className="travel-blackout">
          <span className="eyebrow">INTERPLANETARY TRANSITION</span>
          <h2>Journey across the solar system?</h2>
          <p style={{ maxWidth: '480px', color: '#c3cbd5', marginBottom: '24px' }}>
            We have concluded our survey of the {selectedWorld}. Prepare to travel across deep space to our next
            destination.
          </p>
          <button
            className="primary"
            onClick={() => {
              const next = tourIndex.current + 1;
              startArtifact(tourRef.current[next], next);
            }}
          >
            Depart to next world <span>→</span>
          </button>
          <button className="text-button" onClick={() => setStage('story')}>
            Stay on {selectedWorld}
          </button>
        </div>
      )}

      {/* 8. STAGE: FINALE */}
      {stage === 'finale' && (
        <FinaleOutro onReplay={replay} />
      )}

      {/* EXPEDITION CONTROLS DRAWER */}
      {menu && (
        <>
          <button className="menu-scrim" onClick={() => setMenu(false)} />
          <aside className="expedition-menu">
            <div className="drawer-head">
              <div>
                <p className="eyebrow">EXPEDITION CONTROLS</p>
                <h3>{stage === 'story' || stage === 'discovery' ? artifact.name : 'Your Journey'}</h3>
              </div>
              <button className="close" onClick={() => setMenu(false)}>
                ×
              </button>
            </div>
            {stage === 'story' && (
              <>
                <button
                  onClick={() => {
                    paused ? resumeJourney() : pauseJourney();
                  }}
                >
                  {paused ? '▶ Resume Journey' : 'Ⅱ Pause Journey'}
                </button>
                {manualMode && (
                  <button
                    onClick={() => {
                      resumeJourney();
                      setMenu(false);
                    }}
                  >
                    Resume guided narration
                  </button>
                )}
                <button
                  onClick={() => {
                    skipNarration();
                    setMenu(false);
                  }}
                >
                  Skip current chapter
                </button>
                <button
                  onClick={() => {
                    handleSkipStory();
                    setMenu(false);
                  }}
                >
                  Skip current artifact
                </button>
                <button
                  onClick={() => {
                    handleExitArtifact();
                    setMenu(false);
                  }}
                >
                  Exit current artifact
                </button>
              </>
            )}
            <button
              onClick={startPrologue}
            >
              ↺ Replay Prologue / إعادة مشهد البداية
            </button>
            <button
              onClick={() => {
                finish();
                setMenu(false);
              }}
            >
              ★ Conclude Expedition (Finale) / إنهاء الرحلة
            </button>
            <button
              onClick={() => {
                handleExitExpedition();
                setMenu(false);
              }}
            >
              Exit expedition
            </button>
            <button
              onClick={() => {
                stopNarration();
                scene.current?.showPlanetSelection(selectedWorld);
                setStage('planetSelect');
                setMenu(false);
              }}
            >
              Return to planet selection
            </button>
          </aside>
        </>
      )}

      {/* ARCHIVE AI / CHAT */}
      {chat && (
        <>
          <button className="drawer-scrim" onClick={() => setChat(false)} />
          <aside className="drawer">
            <div className="drawer-head">
              <div>
                <p className="eyebrow">✳ THE ARCHIVE</p>
                <h3>Ask a question.</h3>
              </div>
              <button className="close" onClick={() => setChat(false)}>
                ×
              </button>
            </div>
            <p className="drawer-context">
              Current record · {artifact.name} / {artifact.chapters[chapter]?.title}
            </p>
            <div className="messages">
              {!messages.length && (
                <p className="empty">
                  Ask about this mission, its technical hardware, discoveries, or what remains on {selectedWorld}.
                </p>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`message ${m.role}`}>
                  <p>{m.text}</p>
                  {m.sources?.map((s, j) => (
                    <a key={j} href={s.url || '#'} target="_blank" rel="noreferrer">
                      Source {j + 1} · {s.title}
                    </a>
                  ))}
                </div>
              ))}
              {busy && <p className="empty">Searching the archive…</p>}
            </div>
            <form className="ask-form" onSubmit={ask}>
              <input
                value={question}
                onChange={e => setQuestion(e.target.value)}
                placeholder="Ask the Archive…"
              />
              <button disabled={busy}>Send ↗</button>
            </form>
            <p className="drawer-note">
              Offline replies are historical fallbacks. Connect the archive API for source-backed answers.
            </p>
          </aside>
        </>
      )}

      {/* ASSET DIAGNOSTICS (?debugAssets=1) */}
      {debugAssets && (
        <aside className="asset-debug">
          <div className="debug-head">
            <strong>ASSET DIAGNOSTICS</strong>
            <span>{assetStates.filter(x => x.status === 'ready').length} loaded</span>
          </div>
          {assetStates.map(item => (
            <div key={item.id} className="debug-row">
              <b className={`debug-dot ${item.status}`} />
              <span className="debug-id">{item.id}</span>
              <span className="debug-state">
                {item.status}
                {item.dimensions ? ` · ${item.dimensions}` : ''}
                {item.meshes !== undefined ? ` · ${item.meshes} meshes / ${item.textures} textures` : ''}
              </span>
              {item.error && <small title={item.error}>{item.error}</small>}
              {item.diagnostic && <small className="debug-path">{item.diagnostic}</small>}
              <small className="debug-path">{item.path}</small>
            </div>
          ))}
        </aside>
      )}

      {/* Footer */}
      <footer className="footer">
        <span>© 2026 · A SPACE APPS EXPERIENCE</span>
        <span className="footer-route">EARTH <i>—</i> MOON <i>—</i> MARS</span>
        <span className="footer-status">
          {stage === 'story' || stage === 'discovery' ? (
            <>
              <span className="live-dot" />
              {selectedWorld.toUpperCase()} SURFACE — {artifact.year} &nbsp;·&nbsp; {artifactIndexInWorld || 1}/3
            </>
          ) : (
            'NASA SPACE APPS CHALLENGE 2026'
          )}
        </span>
      </footer>
    </main>
  );
}
