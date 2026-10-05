// Mintlify bundles named exports separately. Every parent MDX page must import
// Downloads and all helper exports below, including transitive dependencies.
// Keep this file flat: snippet-to-snippet imports are not supported.
export const releaseSections = (releases) => {
  const publicReleases = releases.filter((release) => !release.draft);
  const stable = publicReleases.find((release) => !release.prerelease) || null;
  const preview = publicReleases[0]?.prerelease ? publicReleases[0] : null;
  return {
    stable,
    preview,
    history: publicReleases.filter(
      (release) => release.tag_name !== stable?.tag_name && release.tag_name !== preview?.tag_name,
    ),
  };
};

export const selectKiteMarketAssets = (release) => {
  const version = release.tag_name.replace(/^v/, "");
  if (!/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(version)) return null;
  const find = (name) => release.assets.find((asset) => asset.name === name) || null;
  return {
    runtime: ["legacy", "modern", "current"].map((id) => ({
      id,
      asset: find(`KiteMarket-${id}-${version}.jar`),
    })),
    sdks: ["API", "UI-API"].map((id) => ({
      id,
      jar: find(`KiteMarket-${id}-${version}.jar`),
      sources: find(`KiteMarket-${id}-${version}-sources.jar`),
      javadoc: find(`KiteMarket-${id}-${version}-javadoc.jar`),
    })),
    extras: [
      { id: "examples", asset: find(`KiteMarket-Examples-${version}.zip`) },
      { id: "zh", asset: find(`KiteMarket-config-zh_CN-${version}.zip`) },
      { id: "en", asset: find(`KiteMarket-config-en_US-${version}.zip`) },
      { id: "checksums", asset: find("SHA256SUMS.txt") },
    ],
  };
};

export const localizedReleaseBody = (body, lang) => {
  const chinese = /^###\s+(?:中文说明|中文)\s*$/im.exec(body);
  const english = /^###\s+English\s*$/im.exec(body);
  if (!chinese || !english || chinese.index >= english.index) return body;
  const heading = body.slice(0, chinese.index).trim();
  const content = lang === "zh"
    ? body.slice(chinese.index + chinese[0].length, english.index).trim()
    : body.slice(english.index + english[0].length).trim();
  return [heading, content].filter(Boolean).join("\n\n");
};

export const safeWebLink = (value) => {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
};

export const selectSingleAsset = (release) =>
  release.assets.find((asset) => asset.name.endsWith(".jar") && !asset.name.toLowerCase().includes("proxy")) ||
  release.assets.find((asset) => asset.name.endsWith(".zip")) ||
  release.assets.find((asset) => asset.name.endsWith(".jar")) ||
  null;

export const downloadUrl = (value, source, profile) => {
  const safe = safeWebLink(value);
  if (!safe || new URL(safe).hostname !== "github.com") return null;
  return profile !== "kitemarket" && source === "mirror"
    ? `https://v4.gh-proxy.org/${safe}`
    : safe;
};

export const normalizeReleases = (data, owner, repo) => {
  if (!Array.isArray(data)) throw new Error("Invalid GitHub release response");
  const repositoryPath = `/${owner}/${repo}/`.toLowerCase();
  return data.map((release) => {
    if (!release || typeof release.tag_name !== "string" || !Array.isArray(release.assets)) {
      throw new Error("Invalid GitHub release");
    }
    return {
      tag_name: release.tag_name,
      name: typeof release.name === "string" ? release.name : release.tag_name,
      body: typeof release.body === "string" ? release.body : "",
      published_at: typeof release.published_at === "string" ? release.published_at : "",
      prerelease: release.prerelease === true,
      draft: release.draft === true,
      html_url: `https://github.com/${owner}/${repo}/releases/tag/${encodeURIComponent(release.tag_name)}`,
      assets: release.assets.filter((asset) => {
        const safe = safeWebLink(asset?.browser_download_url);
        if (!safe || typeof asset.name !== "string" || !Number.isSafeInteger(asset.size) || asset.size < 0) return false;
        const url = new URL(safe);
        return url.protocol === "https:" && url.hostname === "github.com" &&
          url.pathname.toLowerCase().startsWith(`${repositoryPath}releases/download/`);
      }),
    };
  });
};

// UI rendering uses React hooks supplied by Mintlify, not an external React import.
export const Downloads = ({
  owner = "KiteMC",
  repo,
  lang = "zh",
  showProxy = false,
  showLanguagePacks = false,
  assetProfile = "single",
}) => {
  const requestKey = `${owner}/${repo}`;
  const [result, setResult] = useState({ key: "", status: "loading", releases: [] });
  const [retry, setRetry] = useState(0);
  const [page, setPage] = useState(1);
  const [source, setSource] = useState("github");
  const [expanded, setExpanded] = useState({});
  const releases = result.key === requestKey ? result.releases : [];
  const loading = result.key !== requestKey || result.status === "loading";
  const failed = result.key === requestKey && result.status === "error";
  const chinese = lang === "zh";
  const labels = chinese ? {
    loading: "正在读取 GitHub 版本…",
    error: "暂时无法读取版本。可以重试，或直接在 GitHub 下载。",
    retry: "重试",
    github: "在 GitHub 查看",
    empty: "暂无可下载版本。",
    stable: "最新稳定版",
    preview: "预览版本",
    history: "历史版本",
    prerelease: "预发布",
    stableBadge: "稳定版",
    download: "下载主插件",
    proxy: "代理端插件",
    unavailable: "该版本未提供此文件",
    runtime: "服务器运行包：只安装一份",
    sdk: "开发者 SDK：请勿放入 plugins",
    extras: "配置、示例与校验",
    examples: "可运行开发示例",
    zh: "中文配置包",
    en: "英文配置包",
    checksums: "SHA-256 校验文件",
    sources: "源码",
    bytecode: "字节码",
    notes: "更新说明",
    more: "展开说明",
    less: "收起说明",
    previous: "上一页",
    next: "下一页",
    page: "页",
    source: "下载源",
    direct: "GitHub 直连",
    mirror: "Cloudflare IPv4",
    missingVersion: "版本标签格式不匹配，请在 GitHub 查看该版本的文件。",
  } : {
    loading: "Reading releases from GitHub…",
    error: "Releases are temporarily unavailable. Retry or download directly on GitHub.",
    retry: "Retry",
    github: "View on GitHub",
    empty: "No downloadable versions available.",
    stable: "Latest stable release",
    preview: "Preview release",
    history: "Historical releases",
    prerelease: "Prerelease",
    stableBadge: "Stable",
    download: "Download server plugin",
    proxy: "Proxy plugin",
    unavailable: "Not included in this release",
    runtime: "Server plugin: install exactly one",
    sdk: "Developer SDKs: do not install in plugins",
    extras: "Configuration, examples and checksums",
    examples: "Runnable developer examples",
    zh: "Chinese configuration",
    en: "English configuration",
    checksums: "SHA-256 checksums",
    sources: "Sources",
    bytecode: "bytecode",
    notes: "Release notes",
    more: "Show more",
    less: "Show less",
    previous: "Previous",
    next: "Next",
    page: "Page",
    source: "Download source",
    direct: "GitHub",
    mirror: "Cloudflare IPv4",
    missingVersion: "The version tag does not match the asset format. View the release files on GitHub.",
  };
  const githubReleases = `https://github.com/${owner}/${repo}/releases`;
  const buttonClass = "inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800";
  const linkClass = "text-violet-700 underline underline-offset-4 hover:text-violet-900 dark:text-violet-300 dark:hover:text-violet-200";
  const subtleClass = "text-sm text-zinc-600 dark:text-zinc-400";
  const sections = releaseSections(releases);
  const pages = Math.max(1, Math.ceil(sections.history.length / 5));
  const currentPage = Math.min(page, pages);
  const history = sections.history.slice((currentPage - 1) * 5, currentPage * 5);

  useEffect(() => {
    let current = true;
    const controllers = [];
    const request = async (url) => {
      const controller = new AbortController();
      controllers.push(controller);
      const timer = setTimeout(() => controller.abort(), 10000);
      try {
        const response = await fetch(url, {
          headers: { Accept: "application/vnd.github+json" },
          credentials: "omit",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`GitHub API ${response.status}`);
        return normalizeReleases(await response.json(), owner, repo);
      } finally {
        clearTimeout(timer);
      }
    };
    setResult({ key: requestKey, status: "loading", releases: [] });
    setPage(1);
    setSource("github");
    setExpanded({});
    const api = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases?per_page=100`;
    request(api)
      .catch((error) => {
        if (!current) throw error;
        return request(`https://v4.gh-proxy.org/${api}`);
      })
      .then((result) => {
        if (current) setResult({ key: requestKey, status: "ready", releases: result });
      })
      .catch(() => {
        if (current) {
          setResult({ key: requestKey, status: "error", releases: [] });
        }
      });
    return () => {
      current = false;
      controllers.forEach((controller) => controller.abort());
    };
  }, [owner, repo, retry]);

  const size = (bytes) => {
    if (bytes === 0) return "0 B";
    const index = Math.min(3, Math.floor(Math.log(bytes) / Math.log(1024)));
    return `${Number((bytes / 1024 ** index).toFixed(2))} ${["B", "KB", "MB", "GB"][index]}`;
  };
  const date = (value) => {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? "" : parsed.toLocaleDateString(chinese ? "zh-CN" : "en-US", {
      year: "numeric", month: "short", day: "numeric",
    });
  };
  const assetLink = (asset, title, fullName = false) => {
    const url = asset && downloadUrl(asset.browser_download_url, source, assetProfile);
    return url ? (
      <a href={url} className={fullName ? `${buttonClass} flex-col items-start` : linkClass} title={asset.name}>
        <span>{title}{fullName ? ` · ${size(asset.size)}` : ""}</span>
        {fullName && <code className="break-all text-xs font-normal">{asset.name}</code>}
      </a>
    ) : (
      <span className={subtleClass}>{title} · {labels.unavailable}</span>
    );
  };
  const marketFiles = (release) => {
    const files = selectKiteMarketAssets(release);
    if (!files) return <p className={subtleClass}>{labels.missingVersion}</p>;
    const ranges = {
      legacy: ["Legacy", "1.16.5–1.20.4", "Java 11"],
      modern: ["Modern", "1.20.5–1.21.11", "Java 21"],
      current: ["Current", "26.2", "Java 25"],
    };
    return (
      <div className="space-y-4">
        <p className="font-semibold">{labels.runtime}</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {files.runtime.map((file) => (
            <div key={file.id} className="flex flex-col gap-2 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
              <strong>{ranges[file.id][0]}</strong>
              <span className={subtleClass}>Minecraft {ranges[file.id][1]}</span>
              <span className={subtleClass}>{ranges[file.id][2]} {labels.bytecode}</span>
              {assetLink(file.asset, chinese ? "下载" : "Download", true)}
            </div>
          ))}
        </div>
        <p className="font-semibold">{labels.sdk}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {files.sdks.map((sdk) => (
            <div key={sdk.id} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
              <strong>{sdk.id === "API" ? "Market API" : "UI API"}</strong>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
                {assetLink(sdk.jar, "JAR")}
                {assetLink(sdk.sources, labels.sources)}
                {assetLink(sdk.javadoc, "Javadoc")}
              </div>
            </div>
          ))}
        </div>
        <p className="font-semibold">{labels.extras}</p>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {files.extras.map((file) => <span key={file.id}>{assetLink(file.asset, labels[file.id])}</span>)}
        </div>
      </div>
    );
  };
  const inline = (text) => {
    const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g);
    return parts.map((part, index) => {
      if (part.startsWith("`") && part.endsWith("`")) return <code key={index}>{part.slice(1, -1)}</code>;
      if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
      const match = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
      const url = match && safeWebLink(match[2]);
      return url ? <a key={index} href={url} target="_blank" rel="noopener noreferrer" className={linkClass}>{match[1]}</a>
        : <span key={index}>{part}</span>;
    });
  };
  const notes = (body) => {
    const blocks = [];
    let list = [];
    let code = null;
    const flushList = () => {
      if (list.length) {
        blocks.push(<ul key={`list-${blocks.length}`} className="list-disc space-y-1 pl-5">{list.map((line, index) => <li key={index}>{inline(line)}</li>)}</ul>);
        list = [];
      }
    };
    body.split("\n").forEach((line) => {
      if (line.trim().startsWith("```")) {
        flushList();
        if (code) {
          blocks.push(<pre key={`code-${blocks.length}`} className="overflow-x-auto rounded-lg bg-zinc-100 p-3 text-xs dark:bg-zinc-900"><code>{code.join("\n")}</code></pre>);
          code = null;
        } else code = [];
      } else if (code) code.push(line);
      else if (/^\s*[-*]\s+/.test(line)) list.push(line.replace(/^\s*[-*]\s+/, ""));
      else {
        flushList();
        if (/^#{1,6}\s+/.test(line)) blocks.push(<p key={`heading-${blocks.length}`} className="pt-2 font-semibold">{inline(line.replace(/^#{1,6}\s+/, ""))}</p>);
        else if (line.trim() && !/^[-*_]{3,}$/.test(line.trim())) blocks.push(<p key={`text-${blocks.length}`}>{inline(line)}</p>);
      }
    });
    flushList();
    if (code) blocks.push(<pre key={`code-${blocks.length}`} className="overflow-x-auto rounded-lg bg-zinc-100 p-3 text-xs dark:bg-zinc-900"><code>{code.join("\n")}</code></pre>);
    return blocks;
  };
  const releaseCard = (release) => {
    const main = selectSingleAsset(release);
    const proxy = release.assets.find((asset) => asset.name.toLowerCase().includes("proxy") && asset.name.endsWith(".jar"));
    const languages = ["zh_CN", "en_US"].map((locale) =>
      release.assets.find((asset) => asset.name.toLowerCase().includes(`lang-${locale.toLowerCase()}`) && asset.name.endsWith(".zip")));
    const body = localizedReleaseBody(release.body, lang);
    const long = body.length > 200 || body.split("\n").length > 5;
    const visible = expanded[release.tag_name] || !long ? body : body.split("\n").slice(0, 5).join("\n").slice(0, 300);
    return (
      <article key={release.tag_name} className="space-y-4 rounded-2xl border border-zinc-200 p-5 text-zinc-900 dark:border-zinc-800 dark:text-zinc-100">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <a href={release.html_url} target="_blank" rel="noopener noreferrer" className="text-lg font-semibold">{release.name || release.tag_name}</a>
            <p className={subtleClass}>{date(release.published_at)} · {release.prerelease ? labels.prerelease : labels.stableBadge}</p>
          </div>
          <a href={release.html_url} target="_blank" rel="noopener noreferrer" className={buttonClass}>{labels.github}</a>
        </div>
        {assetProfile === "kitemarket" ? marketFiles(release) : (
          <div className="flex flex-wrap gap-3">
            {assetLink(main, labels.download, true)}
            {showProxy && assetLink(proxy, labels.proxy, true)}
            {showLanguagePacks && assetLink(languages[0], labels.zh)}
            {showLanguagePacks && assetLink(languages[1], labels.en)}
          </div>
        )}
        {body && (
          <div className="space-y-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <p className="font-semibold">{labels.notes}</p>
            <div className="space-y-2 break-words text-sm leading-relaxed">{notes(visible)}</div>
            {long && (
              <button type="button" className={linkClass} aria-expanded={Boolean(expanded[release.tag_name])}
                onClick={() => setExpanded((previous) => ({ ...previous, [release.tag_name]: !previous[release.tag_name] }))}>
                {expanded[release.tag_name] ? labels.less : labels.more}
              </button>
            )}
          </div>
        )}
      </article>
    );
  };

  return (
    <div className="not-prose my-6 space-y-5">
      {loading && <p role="status" aria-live="polite" className={subtleClass}>{labels.loading}</p>}
      {!loading && failed && (
        <div role="alert" className="space-y-3 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
          <p>{labels.error}</p>
          <div className="flex flex-wrap gap-3">
            <button type="button" className={buttonClass} onClick={() => setRetry((value) => value + 1)}>{labels.retry}</button>
            <a href={githubReleases} className={buttonClass} target="_blank" rel="noopener noreferrer">{labels.github}</a>
          </div>
        </div>
      )}
      {!loading && !failed && releases.filter((release) => !release.draft).length === 0 && (
        <div role="status" className="space-y-3 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
          <p>{labels.empty}</p>
          <a href={githubReleases} className={linkClass} target="_blank" rel="noopener noreferrer">{labels.github}</a>
        </div>
      )}
      {!loading && !failed && releases.some((release) => !release.draft) && (
        <>
          {assetProfile !== "kitemarket" && (
            <div role="group" aria-label={labels.source} className="flex flex-wrap items-center gap-2">
              <span className={subtleClass}>{labels.source}</span>
              {["github", "mirror"].map((value) => (
                <button key={value} type="button" className={buttonClass} aria-pressed={source === value} onClick={() => setSource(value)}>
                  {value === "github" ? labels.direct : labels.mirror}{source === value ? " ✓" : ""}
                </button>
              ))}
            </div>
          )}
          {sections.stable && <section className="space-y-3"><h3 className="text-xl font-semibold">{labels.stable}</h3>{releaseCard(sections.stable)}</section>}
          {sections.preview && <section className="space-y-3"><h3 className="text-xl font-semibold">{labels.preview}</h3>{releaseCard(sections.preview)}</section>}
          {sections.history.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-xl font-semibold">{labels.history}</h3>
              {history.map(releaseCard)}
              <nav aria-label={labels.history} className="flex flex-wrap items-center justify-center gap-3">
                <button type="button" className={buttonClass} disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>{labels.previous}</button>
                <span aria-live="polite" className={subtleClass}>{labels.page} {currentPage} / {pages}</span>
                <button type="button" className={buttonClass} disabled={currentPage === pages} onClick={() => setPage((value) => Math.min(pages, value + 1))}>{labels.next}</button>
              </nav>
            </section>
          )}
        </>
      )}
    </div>
  );
};
