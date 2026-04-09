import { startTransition, useEffect, useRef, useState } from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
const DEFAULT_USERNAME = "instagram";
const EXAMPLE_USERNAMES = ["instagram", "netflix", "nba"];

const compactNumberFormatter = new Intl.NumberFormat("pt-BR", {
  notation: "compact",
  maximumFractionDigits: 1
});

const integerFormatter = new Intl.NumberFormat("pt-BR");

const percentFormatter = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  maximumFractionDigits: 1
});

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric"
});

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit"
});

const DATE_RANGE_OPTIONS = [
  { value: "all", label: "Todo periodo" },
  { value: "7", label: "Ultimos 7 dias" },
  { value: "30", label: "Ultimos 30 dias" },
  { value: "90", label: "Ultimos 90 dias" }
];

const SORT_OPTIONS = [
  { value: "publishedAt", label: "Data" },
  { value: "views", label: "Views" },
  { value: "likes", label: "Likes" },
  { value: "comments", label: "Comentarios" },
  { value: "interactions", label: "Interacoes" }
];

function sanitizeUsername(value) {
  return value.trim().replace(/^@+/, "");
}

function formatCompactNumber(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "-";
  }

  return compactNumberFormatter.format(value);
}

function formatInteger(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "-";
  }

  return integerFormatter.format(Math.round(value));
}

function formatDate(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return dateFormatter.format(date);
}

function formatDateTime(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return dateTimeFormatter.format(date);
}

function getInteractionCount(reel) {
  const likes = typeof reel?.likes === "number" ? reel.likes : 0;
  const comments = typeof reel?.comments === "number" ? reel.comments : 0;

  return likes + comments;
}

function calculateAverageMetric(reels, metricName) {
  const values = reels
    .map((reel) => reel?.[metricName])
    .filter((value) => typeof value === "number" && Number.isFinite(value));

  if (!values.length) {
    return null;
  }

  const total = values.reduce((accumulator, value) => accumulator + value, 0);

  return total / values.length;
}

function calculateAverageInteractions(reels) {
  if (!reels.length) {
    return null;
  }

  const total = reels.reduce((accumulator, reel) => accumulator + getInteractionCount(reel), 0);

  return total / reels.length;
}

function calculateAverageEngagementRate(reels) {
  const rates = reels
    .map((reel) => {
      if (typeof reel.views !== "number" || reel.views <= 0) {
        return null;
      }

      return getInteractionCount(reel) / reel.views;
    })
    .filter((value) => typeof value === "number" && Number.isFinite(value));

  if (!rates.length) {
    return null;
  }

  return rates.reduce((accumulator, value) => accumulator + value, 0) / rates.length;
}

function calculateCadenceInfo(reels) {
  const timestamps = reels
    .map((reel) => new Date(reel.publishedAt).getTime())
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => b - a);

  if (timestamps.length < 2) {
    return {
      display: "-",
      label: "Sem leitura",
      tone: "muted",
      description: "Sao necessarios pelo menos 2 Reels visiveis para estimar a frequencia."
    };
  }

  let totalGapMs = 0;

  for (let index = 0; index < timestamps.length - 1; index += 1) {
    totalGapMs += timestamps[index] - timestamps[index + 1];
  }

  const averageGapHours = totalGapMs / (timestamps.length - 1) / (1000 * 60 * 60);
  const display = averageGapHours < 24
    ? `${averageGapHours.toFixed(1)}h`
    : `${(averageGapHours / 24).toFixed(1)} dias`;

  if (averageGapHours <= 48) {
    return {
      display,
      label: "Alta frequencia",
      tone: "success",
      description: "O perfil publica com ritmo forte e consistente na amostra atual."
    };
  }

  if (averageGapHours <= 120) {
    return {
      display,
      label: "Frequencia media",
      tone: "warning",
      description: "Ha recorrencia de publicacao, mas com janelas maiores entre os posts."
    };
  }

  return {
    display,
    label: "Baixa frequencia",
    tone: "danger",
    description: "O intervalo entre Reels e mais longo e pode reduzir constancia de campanha."
  };
}

function buildEngagementInfo(engagementRate) {
  if (typeof engagementRate !== "number" || !Number.isFinite(engagementRate)) {
    return {
      display: "-",
      label: "Sem leitura",
      tone: "muted",
      description: "Nao ha views suficientes na amostra filtrada para estimar o engajamento."
    };
  }

  if (engagementRate >= 0.05) {
    return {
      display: percentFormatter.format(engagementRate),
      label: "Muito forte",
      tone: "success",
      description: "Interacao muito alta para o alcance recente."
    };
  }

  if (engagementRate >= 0.03) {
    return {
      display: percentFormatter.format(engagementRate),
      label: "Forte",
      tone: "success",
      description: "Bom equilibrio entre alcance e resposta do publico."
    };
  }

  if (engagementRate >= 0.015) {
    return {
      display: percentFormatter.format(engagementRate),
      label: "Saudavel",
      tone: "warning",
      description: "Ha resposta do publico, mas ainda com espaco para maior intensidade."
    };
  }

  return {
    display: percentFormatter.format(engagementRate),
    label: "Baixo",
    tone: "danger",
    description: "A resposta do publico esta mais fria em relacao ao alcance."
  };
}

function findExtremeInteractionReel(reels, pickHigher) {
  return reels.reduce((selectedReel, candidateReel) => {
    if (!selectedReel) {
      return candidateReel;
    }

    const selectedInteractions = getInteractionCount(selectedReel);
    const candidateInteractions = getInteractionCount(candidateReel);

    if (pickHigher ? candidateInteractions > selectedInteractions : candidateInteractions < selectedInteractions) {
      return candidateReel;
    }

    return selectedReel;
  }, null);
}

function buildDisplayedSummary(reels) {
  return {
    averages: {
      views: calculateAverageMetric(reels, "views"),
      likes: calculateAverageMetric(reels, "likes"),
      comments: calculateAverageMetric(reels, "comments")
    },
    interactions: {
      most: findExtremeInteractionReel(reels, true),
      least: findExtremeInteractionReel(reels, false)
    }
  };
}

function parseThreshold(value) {
  if (!value.trim()) {
    return null;
  }

  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue < 0) {
    return null;
  }

  return parsedValue;
}

function doesMetricMatchThreshold(value, threshold) {
  if (threshold == null) {
    return true;
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    return false;
  }

  return value >= threshold;
}

function doesDateMatchRange(publishedAt, dateRangeInDays) {
  if (dateRangeInDays === "all") {
    return true;
  }

  const publishedAtTimestamp = new Date(publishedAt).getTime();

  if (!Number.isFinite(publishedAtTimestamp)) {
    return false;
  }

  const rangeStart = Date.now() - Number(dateRangeInDays) * 24 * 60 * 60 * 1000;

  return publishedAtTimestamp >= rangeStart;
}

function sortReels(reels, sortBy, sortDirection) {
  const sortedReels = [...reels];

  sortedReels.sort((leftReel, rightReel) => {
    let leftValue;
    let rightValue;

    if (sortBy === "publishedAt") {
      leftValue = new Date(leftReel.publishedAt).getTime();
      rightValue = new Date(rightReel.publishedAt).getTime();
    } else if (sortBy === "interactions") {
      leftValue = getInteractionCount(leftReel);
      rightValue = getInteractionCount(rightReel);
    } else {
      leftValue = leftReel?.[sortBy] ?? -1;
      rightValue = rightReel?.[sortBy] ?? -1;
    }

    const normalizedLeftValue = Number.isFinite(leftValue) ? leftValue : -1;
    const normalizedRightValue = Number.isFinite(rightValue) ? rightValue : -1;

    if (sortDirection === "asc") {
      return normalizedLeftValue - normalizedRightValue;
    }

    return normalizedRightValue - normalizedLeftValue;
  });

  return sortedReels;
}

function buildReelFlags(reel, displayedSummary) {
  const flags = [];

  if (displayedSummary.interactions.most?.id === reel.id) {
    flags.push("Top Reel");
  }

  if (displayedSummary.interactions.least?.id === reel.id) {
    flags.push("Menor performance");
  }

  return flags;
}

function buildMetricCards(displayedSummary, averageInteractions, engagementInfo, cadenceInfo) {
  return [
    {
      key: "views",
      label: "Views medias",
      value: formatCompactNumber(displayedSummary.averages.views),
      note: "Principal sinal de alcance recente.",
      badge: "Prioridade alta",
      tone: "primary"
    },
    {
      key: "interactions",
      label: "Interacoes medias",
      value: formatCompactNumber(averageInteractions),
      note: "Likes + comentarios por Reel.",
      badge: "Performance",
      tone: "accent"
    },
    {
      key: "engagement",
      label: "Engajamento medio",
      value: engagementInfo.display,
      note: engagementInfo.description,
      badge: engagementInfo.label,
      tone: engagementInfo.tone
    },
    {
      key: "likes",
      label: "Likes medios",
      value: formatCompactNumber(displayedSummary.averages.likes),
      note: "Resposta imediata ao conteudo.",
      badge: "Interesse",
      tone: "default"
    },
    {
      key: "comments",
      label: "Comentarios medios",
      value: formatCompactNumber(displayedSummary.averages.comments),
      note: "Volume de conversa gerada.",
      badge: "Conversas",
      tone: "muted"
    },
    {
      key: "frequency",
      label: "Frequencia",
      value: cadenceInfo.display,
      note: cadenceInfo.description,
      badge: cadenceInfo.label,
      tone: cadenceInfo.tone
    }
  ];
}

async function requestProfileReport(username) {
  const response = await fetch(`${API_BASE_URL}/api/reels/${encodeURIComponent(username)}`);
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = payload?.message || "Nao foi possivel carregar os dados deste perfil.";
    throw new Error(message);
  }

  return {
    payload
  };
}

function CaptionCell({ caption, isExpanded, onToggle }) {
  const captionRef = useRef(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    const captionElement = captionRef.current;

    if (!captionElement) {
      return undefined;
    }

    let animationFrameId = 0;
    let resizeObserver;

    const measureOverflow = () => {
      const nextIsOverflowing =
        captionElement.scrollHeight > captionElement.clientHeight + 1 ||
        captionElement.scrollWidth > captionElement.clientWidth + 1;

      setIsOverflowing((currentState) => currentState || nextIsOverflowing);
    };

    const scheduleMeasure = () => {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = window.requestAnimationFrame(measureOverflow);
    };

    scheduleMeasure();

    if (typeof ResizeObserver === "function") {
      resizeObserver = new ResizeObserver(scheduleMeasure);
      resizeObserver.observe(captionElement);
    }

    window.addEventListener("resize", scheduleMeasure);

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", scheduleMeasure);
    };
  }, [caption]);

  return (
    <div className="caption-block">
      <span
        ref={captionRef}
        className={`caption-preview ${isExpanded ? "caption-preview--expanded" : ""}`}
        title={caption}
      >
        {caption}
      </span>

      {isOverflowing ? (
        <button className="caption-toggle" type="button" onClick={onToggle}>
          {isExpanded ? "Ler menos" : "Ler mais"}
        </button>
      ) : null}
    </div>
  );
}

function App() {
  const [usernameInput, setUsernameInput] = useState(DEFAULT_USERNAME);
  const [report, setReport] = useState(null);
  const [activeUsername, setActiveUsername] = useState(DEFAULT_USERNAME);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [dateRange, setDateRange] = useState("all");
  const [minViews, setMinViews] = useState("");
  const [minLikes, setMinLikes] = useState("");
  const [minComments, setMinComments] = useState("");
  const [minInteractions, setMinInteractions] = useState("");
  const [sortBy, setSortBy] = useState("publishedAt");
  const [sortDirection, setSortDirection] = useState("desc");
  const [expandedCaptions, setExpandedCaptions] = useState({});

  useEffect(() => {
    void loadProfileReport(DEFAULT_USERNAME);
  }, []);

  async function loadProfileReport(nextUsername) {
    const normalizedUsername = sanitizeUsername(nextUsername);

    if (!normalizedUsername) {
      setErrorMessage("Digite um username publico do Instagram.");
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      const nextReport = await requestProfileReport(normalizedUsername);

      startTransition(() => {
        setReport(nextReport);
        setActiveUsername(normalizedUsername);
        setExpandedCaptions({});
      });
    } catch (error) {
      setErrorMessage(error.message || "Falha ao carregar o perfil informado.");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    void loadProfileReport(usernameInput);
  }

  function resetFilters() {
    setDateRange("all");
    setMinViews("");
    setMinLikes("");
    setMinComments("");
    setMinInteractions("");
    setSortBy("publishedAt");
    setSortDirection("desc");
  }

  function toggleCaptionExpansion(reelId) {
    setExpandedCaptions((currentState) => ({
      ...currentState,
      [reelId]: !currentState[reelId]
    }));
  }

  const rawReels = report?.payload?.reels || [];
  const filteredReels = rawReels.filter((reel) => {
    if (!doesDateMatchRange(reel.publishedAt, dateRange)) {
      return false;
    }

    if (!doesMetricMatchThreshold(reel.views, parseThreshold(minViews))) {
      return false;
    }

    if (!doesMetricMatchThreshold(reel.likes, parseThreshold(minLikes))) {
      return false;
    }

    if (!doesMetricMatchThreshold(reel.comments, parseThreshold(minComments))) {
      return false;
    }

    if (!doesMetricMatchThreshold(getInteractionCount(reel), parseThreshold(minInteractions))) {
      return false;
    }

    return true;
  });
  const displayedReels = sortReels(filteredReels, sortBy, sortDirection);
  const displayedSummary = buildDisplayedSummary(displayedReels);
  const averageInteractions = calculateAverageInteractions(displayedReels);
  const averageEngagementRate = calculateAverageEngagementRate(displayedReels);
  const cadenceInfo = calculateCadenceInfo(displayedReels);
  const engagementInfo = buildEngagementInfo(averageEngagementRate);
  const metricCards = buildMetricCards(displayedSummary, averageInteractions, engagementInfo, cadenceInfo);

  return (
    <div className="app-shell">
      <main className="page">
        <header className="topbar">
          <div>
            <p className="kicker">Radar de Reels</p>
            <h1>Avalie creators por performance recente.</h1>
            <p className="subtitle">
              Consulte um perfil publico do Instagram e leia alcance, engajamento,
              frequencia e os Reels que realmente puxam a media para cima ou para baixo.
            </p>
          </div>
        </header>

        <section className="panel search-panel">
          <form className="search-form" onSubmit={handleSubmit}>
            <label className="visually-hidden" htmlFor="username">
              Username do Instagram
            </label>

            <div className="input-wrap">
              <span className="input-prefix">@</span>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="off"
                spellCheck="false"
                placeholder="ex.: mariasaad"
                value={usernameInput}
                onChange={(event) => setUsernameInput(event.target.value)}
              />
            </div>

            <button type="submit" disabled={loading}>
              {loading ? "Analisando..." : "Buscar perfil"}
            </button>
          </form>

          <div className="search-footer">
            <div className="chip-row">
              {EXAMPLE_USERNAMES.map((username) => (
                <button
                  key={username}
                  className="chip-button"
                  type="button"
                  onClick={() => {
                    setUsernameInput(username);
                    void loadProfileReport(username);
                  }}
                >
                  @{username}
                </button>
              ))}
            </div>

            {report ? (
              <div className="inline-meta">
                <span>@{activeUsername}</span>
                <span>{displayedReels.length} de {rawReels.length} Reels</span>
                <span>Atualizado em {formatDateTime(report.payload.fetchedAt)}</span>
              </div>
            ) : null}
          </div>

          {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}
        </section>

        {!report && loading ? (
          <section className="loading-grid" aria-label="Carregando resultados">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="skeleton-card" />
            ))}
          </section>
        ) : null}

        {report ? (
          <>
            <section className="overview-grid">
              {metricCards.map((item) => (
                <article
                  key={item.key}
                  className={`panel metric-card metric-card--${item.tone} ${item.key === "views" ? "metric-card--featured" : ""}`}
                >
                  <div className="metric-card-head">
                    <span className="metric-label">{item.label}</span>
                    <span className={`metric-badge metric-badge--${item.tone}`}>{item.badge}</span>
                  </div>

                  <strong className="metric-value">{item.value}</strong>
                  <p className="metric-note">{item.note}</p>
                </article>
              ))}
            </section>

            <section className="insight-grid">
              <article className="panel insight-card insight-card--top">
                <div className="insight-head">
                  <div>
                    <span className="insight-kicker">Top Reel</span>
                    <strong className="insight-value">
                      {displayedSummary.interactions.most
                        ? formatCompactNumber(getInteractionCount(displayedSummary.interactions.most))
                        : "-"}
                    </strong>
                  </div>

                  {displayedSummary.interactions.most?.url ? (
                    <a
                      className="insight-link"
                      href={displayedSummary.interactions.most.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Abrir Reel
                    </a>
                  ) : null}
                </div>

                <div className="insight-pills">
                  <span>Views {formatInteger(displayedSummary.interactions.most?.views)}</span>
                  <span>Likes {formatInteger(displayedSummary.interactions.most?.likes)}</span>
                  <span>Comentarios {formatInteger(displayedSummary.interactions.most?.comments)}</span>
                </div>

                <p className="insight-note">
                  O Reel com melhor performance dentro da selecao atual de filtros.
                </p>
              </article>

              <article className="panel insight-card insight-card--low">
                <div className="insight-head">
                  <div>
                    <span className="insight-kicker">Menor performance</span>
                    <strong className="insight-value">
                      {displayedSummary.interactions.least
                        ? formatCompactNumber(getInteractionCount(displayedSummary.interactions.least))
                        : "-"}
                    </strong>
                  </div>

                  {displayedSummary.interactions.least?.url ? (
                    <a
                      className="insight-link"
                      href={displayedSummary.interactions.least.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Abrir Reel
                    </a>
                  ) : null}
                </div>

                <div className="insight-pills">
                  <span>Views {formatInteger(displayedSummary.interactions.least?.views)}</span>
                  <span>Likes {formatInteger(displayedSummary.interactions.least?.likes)}</span>
                  <span>Comentarios {formatInteger(displayedSummary.interactions.least?.comments)}</span>
                </div>

                <p className="insight-note">
                  O ponto mais fraco da amostra atual para comparacao rapida.
                </p>
              </article>
            </section>

            <section className="panel table-panel">
              <div className="section-header">
                <div>
                  <h2>Reels recentes</h2>
                  <p className="section-subtitle">
                    Filtre, ordene e encontre rapidamente os Reels que puxam a performance.
                  </p>
                </div>

                <button className="ghost-button" type="button" onClick={resetFilters}>
                  Limpar filtros
                </button>
              </div>

              <div className="filters-panel">
                <div className="filters-grid">
                  <label className="filter-field">
                    <span>Periodo</span>
                    <select value={dateRange} onChange={(event) => setDateRange(event.target.value)}>
                      {DATE_RANGE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="filter-field">
                    <span>Min. views</span>
                    <input
                      type="number"
                      min="0"
                      value={minViews}
                      onChange={(event) => setMinViews(event.target.value)}
                      placeholder="0"
                    />
                  </label>

                  <label className="filter-field">
                    <span>Min. likes</span>
                    <input
                      type="number"
                      min="0"
                      value={minLikes}
                      onChange={(event) => setMinLikes(event.target.value)}
                      placeholder="0"
                    />
                  </label>

                  <label className="filter-field">
                    <span>Min. comentarios</span>
                    <input
                      type="number"
                      min="0"
                      value={minComments}
                      onChange={(event) => setMinComments(event.target.value)}
                      placeholder="0"
                    />
                  </label>

                  <label className="filter-field">
                    <span>Min. interacoes</span>
                    <input
                      type="number"
                      min="0"
                      value={minInteractions}
                      onChange={(event) => setMinInteractions(event.target.value)}
                      placeholder="0"
                    />
                  </label>

                  <label className="filter-field">
                    <span>Ordenar por</span>
                    <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                      {SORT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="filter-field">
                    <span>Ordem</span>
                    <select
                      value={sortDirection}
                      onChange={(event) => setSortDirection(event.target.value)}
                    >
                      <option value="desc">Maior para menor</option>
                      <option value="asc">Menor para maior</option>
                    </select>
                  </label>
                </div>
              </div>

              <div className="table-wrap">
                <table>
                  <colgroup>
                    <col className="col-reel" />
                    <col className="col-date" />
                    <col className="col-views" />
                    <col className="col-likes" />
                    <col className="col-comments" />
                    <col className="col-interactions" />
                    <col className="col-open" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Reel</th>
                      <th>Data</th>
                      <th className="numeric-col">Views</th>
                      <th className="numeric-col">Likes</th>
                      <th className="numeric-col">Comentarios</th>
                      <th className="numeric-col">Interacoes</th>
                      <th>Abrir</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedReels.map((reel, index) => {
                      const flags = buildReelFlags(reel, displayedSummary);
                      const isTopReel = displayedSummary.interactions.most?.id === reel.id;
                      const isLowReel = displayedSummary.interactions.least?.id === reel.id;
                      const caption = reel.caption || "Sem legenda";
                      const isCaptionExpanded = expandedCaptions[reel.id] === true;
                      const rowClassName = isTopReel
                        ? "reel-row reel-row--top"
                        : isLowReel
                          ? "reel-row reel-row--low"
                          : "reel-row";

                      return (
                        <tr key={reel.id} className={rowClassName}>
                          <td>
                            <div className="reel-cell">
                              <div className="reel-meta">
                                <span className="row-index">#{index + 1}</span>
                                {flags.map((flag) => (
                                  <span
                                    key={flag}
                                    className={`status-flag ${flag === "Top Reel" ? "status-flag--top" : "status-flag--low"}`}
                                  >
                                    {flag}
                                  </span>
                                ))}
                              </div>

                              <CaptionCell
                                caption={caption}
                                isExpanded={isCaptionExpanded}
                                onToggle={() => toggleCaptionExpansion(reel.id)}
                              />
                            </div>
                          </td>
                          <td>{formatDate(reel.publishedAt)}</td>
                          <td className="numeric-col metric-col metric-col--views">
                            {formatInteger(reel.views)}
                          </td>
                          <td className="numeric-col metric-col metric-col--likes">
                            {formatInteger(reel.likes)}
                          </td>
                          <td className="numeric-col metric-col metric-col--comments">
                            {formatInteger(reel.comments)}
                          </td>
                          <td className="numeric-col metric-col metric-col--interactions">
                            {formatInteger(getInteractionCount(reel))}
                          </td>
                          <td>
                            <a
                              className="insight-link table-link"
                              href={reel.url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Ver
                            </a>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {!displayedReels.length ? (
                <p className="empty-state">
                  Nenhum Reel atende aos filtros atuais. Ajuste os criterios para continuar.
                </p>
              ) : null}
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}

export default App;
