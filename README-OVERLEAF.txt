What to upload to Overleaf

Files included:
- PFE_RAPPORT_LATEX.tex  (main LaTeX source)

How to compile on Overleaf:
1. Go to https://www.overleaf.com
2. New Project → Upload Project
3. Select `overleaf_project.zip` and upload
4. Overleaf will detect the main `.tex` file; press Recompile (pdfLaTeX)

Notes / required packages (Overleaf has these preinstalled):
- tikz, pgfplots (we set `\pgfplotsset{compat=1.18}`), microtype
- listings, algorithm/algpseudocode, hyperref, booktabs, subcaption

Troubleshooting:
- If compilation fails on Overleaf, open the Log and share the first error line with me.
- This project uses UTF-8 encoding; keep the file as UTF-8.

If you want, I can also:
- Add a `.bib` file and `\bibliography{...}` if you need references
- Replace accented characters with LaTeX commands
- Generate a PDF locally (requires TeX installation on your PC)
