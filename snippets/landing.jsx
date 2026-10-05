export const ActionLinks = ({ links = [] }) => (
  <div className="km-actions">
    {links.map((link, index) => (
      <a key={link.href} className={index === 0 ? "km-button km-button-primary" : "km-button"} href={link.href}>
        {link.label}
        <span aria-hidden="true">↗</span>
      </a>
    ))}
  </div>
);

export const LandingHero = ({ title, subtitle, description, image, eyebrow, links = [] }) => (
  <header className="km-hero">
    <div className="km-hero-copy">
      {eyebrow ? <p className="km-eyebrow">{eyebrow}</p> : null}
      <h1>{title}</h1>
      <p className="km-hero-subtitle">{subtitle}</p>
      <p className="km-hero-description">{description}</p>
      <ActionLinks links={links} />
    </div>
    <img className="km-hero-icon" src={image} alt="" width="160" height="160" />
  </header>
);

export const MediaGallery = ({ images = [] }) => (
  <div className="km-gallery">
    {images.map((image) => (
      <figure key={image.src}>
        <img src={image.src} alt={image.caption} loading="lazy" />
        <figcaption>{image.caption}</figcaption>
      </figure>
    ))}
  </div>
);

export const LandingFooter = ({ lang = "zh" }) => {
  const english = lang === "en";
  return (
    <footer className="km-landing-footer">
      <a className="km-footer-brand" href={english ? "/en" : "/"}>
        <img src="/images/logo/kitemc.svg" alt="" width="24" height="24" />
        <span>KiteMC</span>
      </a>
      <nav aria-label={english ? "Community and resources" : "社区与资源"}>
        <a href="https://github.com/KiteMC/">GitHub</a>
        <a href={english ? "https://license.kitemc.com/en" : "https://license.kitemc.com/"}>{english ? "License Center" : "许可证中心"}</a>
        <a href={english ? "https://discord.gg/dcsBw5Z5ZT" : "https://qm.qq.com/q/R83fq82HWm"}>{english ? "Community" : "加入社区"}</a>
      </nav>
      <p>{english ? "Tools and plugins for your Minecraft server." : "为你的 Minecraft 服务器提供工具与插件。"}</p>
    </footer>
  );
};
