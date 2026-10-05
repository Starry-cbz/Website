export const ScreenshotPlaceholder = ({ image, src, title, caption, description, lang = "zh" }) => {
  const source = image || src;
  const label = title || caption || (lang === "en" ? "Gameplay screenshot" : "游戏截图");
  const [ready, setReady] = useState(false);
  const imageRef = useRef(null);

  useEffect(() => {
    const current = imageRef.current;
    setReady(Boolean(current && current.complete && current.naturalWidth > 0));
  }, [source]);

  return (
    <figure className="km-screenshot">
      <div className="km-screenshot-frame">
        {source ? (
          <img
            ref={imageRef}
            src={source}
            alt={label}
            className={ready ? "km-screenshot-image" : "km-screenshot-image km-screenshot-pending"}
            onLoad={() => setReady(true)}
            onError={() => setReady(false)}
          />
        ) : null}
        {!ready ? (
          <div className="km-screenshot-placeholder">
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden="true">
              <rect x="5" y="6" width="26" height="24" rx="4" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="13" cy="13" r="2.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M6 26L14 19L19 23L24 16L31 24" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
            <strong>{label}</strong>
            <p>{description || (lang === "en" ? "A real gameplay screenshot will be added here." : "此处预留真实游戏截图。")}</p>
          </div>
        ) : null}
      </div>
      <figcaption>{label}</figcaption>
    </figure>
  );
};
