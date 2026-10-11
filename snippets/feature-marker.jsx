const defaultCopy = {
  zh: {
    badge: "v1.1",
    panelTitle: "v1.1 功能概览",
    panelLead: "按日常使用流程了解本次更新。",
    overview: "查看 v1.1 功能总览",
  },
  en: {
    badge: "v1.1",
    panelTitle: "V1.1 at a glance",
    panelLead: "Explore the update through everyday market workflows.",
    overview: "View the v1.1 overview",
  },
};

const ArrowIcon = () => (
  <svg className="km-v11-marker-arrow" viewBox="0 0 16 16" aria-hidden="true">
    <path d="M4 12L12 4M6 4h6v6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const V11PagePanel = ({ lang = "zh", items = [], title, lead, href }) => {
  const copy = defaultCopy[lang] || defaultCopy.zh;
  const target = href || (lang === "en" ? "/en/kitemarket/v1-1/overview" : "/kitemarket/v1-1/overview");
  const visibleItems = items.filter(Boolean).slice(0, 5);
  return (
    <section className="km-v11-page-panel" aria-label={title || copy.panelTitle}>
      <div className="km-v11-panel-heading">
        <span className="km-v11-panel-glyph" aria-hidden="true">✦</span>
        <div>
          <span className="km-v11-panel-badge">{copy.badge}</span>
          <strong>{title || copy.panelTitle}</strong>
        </div>
      </div>
      <p>{lead || copy.panelLead}</p>
      {visibleItems.length ? (
        <ul>
          {visibleItems.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
        </ul>
      ) : null}
      <a className="km-v11-panel-link" href={target}>
        {copy.overview}
        <ArrowIcon />
      </a>
    </section>
  );
};
