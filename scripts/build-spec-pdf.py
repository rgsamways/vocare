import markdown
from pathlib import Path

repo = Path(__file__).resolve().parent.parent
md_path = repo / "vocare-project-specification.md"
html_out = repo / "scripts" / "_spec-render.html"
pdf_out = repo / "docs" / "Vocare-Project-Specification.pdf"
pdf_out.parent.mkdir(exist_ok=True)

md_text = md_path.read_text(encoding="utf-8")

body_html = markdown.markdown(
    md_text,
    extensions=["tables", "fenced_code", "sane_lists", "toc", "nl2br"],
    extension_configs={"toc": {"toc_depth": "2-3"}},
)

# Exact mark/wordmark from mockups/interface-v1.html's approved header, scaled 2x uniformly
# (svg 19x14 -> 38x28, gap 4px -> 8px, top -2px -> -4px, font-size 19px -> 38px) so every
# dimension scales in lockstep from the tuned values rather than being re-approximated.
MARK_SVG = '''<svg width="38" height="28" viewBox="0 0 46 33" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M6 30C6 30 14 8 23 8C32 8 40 30 40 30" stroke="#3f5d54" stroke-width="4" stroke-linecap="round"/>
<circle cx="6" cy="30" r="2" fill="#3f5d54"/><circle cx="40" cy="30" r="2" fill="#3f5d54"/>
<path d="M13 24C13 24 18 13 23 13C28 13 33 24 33 24" stroke="#3f5d54" stroke-width="3.4" stroke-linecap="round" opacity="0.6"/>
</svg>'''

template = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Vocare — Project Specification</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,500&family=Source+Sans+3:wght@400;500;600;700&family=Source+Code+Pro:wght@400;500&display=swap" rel="stylesheet">
<style>
  @page {{ size: Letter; margin: 22mm 18mm 20mm 18mm; }}
  :root {{
    --ink: #2b2924; --ink-soft: #5c584f; --accent: #3f5d54; --accent-soft: #e7ede9;
    --line: #ddd7c8; --bg-tint: #f7f4ee;
  }}
  * {{ box-sizing: border-box; }}
  body {{
    font-family: 'Source Sans 3', -apple-system, "Segoe UI", Helvetica, Arial, sans-serif;
    color: var(--ink); font-size: 10.3pt; line-height: 1.55; margin: 0;
  }}
  .cover {{
    height: 235mm; display: flex; flex-direction: column; justify-content: center;
    align-items: flex-start; page-break-after: always;
  }}
  .cover .brandrow {{ display: flex; align-items: baseline; gap: 8px; margin-bottom: 46px; }}
  .cover .brandrow svg {{ position: relative; top: -4px; }}
  .cover .brandrow span {{
    font-family: 'Fraunces', serif; font-style: italic; font-weight: 500; font-size: 38px;
    color: var(--accent); letter-spacing: -0.01em;
  }}
  .cover h1 {{
    font-family: 'Fraunces', serif; font-style: italic; font-weight: 500; font-size: 27pt;
    color: var(--ink); margin: 0 0 10px; line-height: 1.15; max-width: 480px;
  }}
  .cover .subtitle {{ font-size: 13pt; color: var(--ink-soft); max-width: 460px; margin-bottom: 40px; }}
  .cover .meta {{ font-size: 10pt; color: var(--ink-soft); line-height: 1.9; border-top: 1px solid var(--line); padding-top: 18px; max-width: 460px; }}
  .cover .meta b {{ color: var(--ink); }}

  h1, h2, h3, h4 {{ font-family: 'Fraunces', serif; font-weight: 500; color: var(--ink); page-break-after: avoid; }}
  h1 {{ font-size: 17pt; border-bottom: 2px solid var(--accent); padding-bottom: 6px; margin: 30px 0 14px; }}
  h2 {{ font-size: 14pt; margin: 26px 0 10px; color: var(--accent); }}
  h3 {{ font-size: 11.5pt; margin: 18px 0 6px; font-style: italic; }}
  h4 {{ font-size: 10.5pt; margin: 14px 0 4px; }}
  h3:first-child, h2:first-child {{ margin-top: 0; }}

  p {{ margin: 0 0 10px; }}
  blockquote {{
    margin: 10px 0; padding: 8px 16px; background: var(--bg-tint); border-left: 3px solid var(--accent);
    font-size: 9.7pt; color: var(--ink-soft);
  }}
  code {{ font-family: 'Source Code Pro', monospace; font-size: 9pt; background: var(--bg-tint); padding: 1px 5px; border-radius: 3px; color: var(--accent); }}
  pre {{ background: var(--bg-tint); padding: 10px; border-radius: 6px; overflow-x: auto; font-size: 8.7pt; page-break-inside: avoid; }}
  pre code {{ background: none; padding: 0; }}
  ul, ol {{ margin: 6px 0 12px; padding-left: 22px; }}
  li {{ margin-bottom: 4px; }}
  hr {{ border: none; border-top: 1px solid var(--line); margin: 26px 0; }}
  a {{ color: var(--accent); text-decoration: none; }}

  table {{ border-collapse: collapse; width: 100%; margin: 10px 0 16px; font-size: 9pt; page-break-inside: auto; }}
  thead {{ display: table-header-group; }}
  tr {{ page-break-inside: avoid; }}
  th, td {{ border: 1px solid var(--line); padding: 6px 8px; text-align: left; vertical-align: top; }}
  th {{ background: var(--accent-soft); color: var(--accent); font-family: 'Fraunces', serif; font-weight: 500; font-style: italic; }}
  tr:nth-child(even) td {{ background: #fbfaf7; }}

  .footer-note {{ font-size: 8pt; color: var(--ink-soft); text-align: center; margin-top: 36px; padding-top: 12px; border-top: 1px solid var(--line); }}
</style>
</head>
<body>

<div class="cover">
  <div class="brandrow">
    {MARK_SVG}
    <span>vocare</span>
  </div>
  <h1>Project Specification</h1>
  <div class="subtitle">An AI-Conversational Interview Practice App with Tiered, Consent-Walled Data Monetization</div>
  <div class="meta">
    <b>Owner:</b> Robin Samways<br>
    <b>Status:</b> Pre-build planning document, verified pass<br>
    <b>Development process:</b> two-instance Claude model for sensitive modules (M1 auth/payments, M2 crisis-safety, M7 anonymization) — one instance proposes/applies via OpenSpec, an independent second instance grades the work from the persisted proposal/tasks/design files; single-instance acceptable for lower-stakes modules. Instances are named <b>chat</b> (proposes/grades) and <b>cli</b> (applies) for handoff messages between them.<br>
    <b>Generated:</b> 2026-07-21
  </div>
</div>

{body_html}

<div class="footer-note">Vocare — Project Specification — generated from vocare-project-specification.md, 2026-07-21</div>

</body>
</html>
"""

html_out.write_text(template, encoding="utf-8")
print(f"Wrote {html_out}")
