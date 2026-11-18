// src/components/admin/assembly/assembly-studio.tsx
// Module d'assemblage éditeur : informations du livre, manuscrit, paramètres du dos carré collé,
// code-barres ISBN-13, aperçus et génération des deux PDF (corps du livre et couverture à plat).
// Tout se passe dans le navigateur : aucun serveur n'est sollicité pour générer les fichiers.
"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import {
  BookOpen,
  CircleCheck,
  Download,
  Image as ImageIcon,
  RotateCcw,
  TriangleAlert,
  Upload,
} from "lucide-react";
import {
  BLEED_MM,
  DEFAULT_YEAR,
  MIN_PAGES_PERFECT_BOUND,
  PAPER_OPTIONS,
  TRIM_FORMATS,
  spineWidthMm,
  type FontFamily,
  type PaperKey,
  type TrimKey,
} from "@/lib/assembly/constants";
import { analyseIsbn13 } from "@/lib/assembly/isbn";
import { luminance, prepareImageFile, type PreparedImage } from "@/lib/assembly/image-utils";
import {
  buildFallbackLogoSet,
  clearCustomLogo,
  loadInitialLogo,
  loadOfficialLogo,
  logoFromFile,
  type LogoSet,
} from "@/lib/assembly/logo";
import { generateBarcode, type BarcodeResult } from "@/lib/assembly/barcode";
import { docxToText, parseManuscript, readTextFile } from "@/lib/assembly/manuscript";
import { buildInteriorLayout, type InteriorLayout, type TextMeasurer } from "@/lib/assembly/interior-layout";
import { buildCoverScene } from "@/lib/assembly/cover-scene";
import {
  createMeasurer,
  renderCoverPdf,
  renderInteriorPdf,
  type PdfCtor,
} from "@/lib/assembly/pdf-export";
import { multiLine, singleLine, slugify } from "@/lib/assembly/text-utils";
import { InteriorPreview } from "@/components/admin/assembly/interior-preview";
import { CoverPreview } from "@/components/admin/assembly/cover-preview";

interface BookInfo {
  title: string;
  subtitle: string;
  author: string;
  summary: string;
  bio: string;
  isbn: string;
  year: string;
}

interface Settings {
  fontFamily: FontFamily;
  fontPt: number;
  lineFactor: number;
  justify: boolean;
  chapterOnRecto: boolean;
  colophonLast: boolean;
  restartNumbering: boolean;
  singleNewline: boolean;
  autoChapters: boolean;
}

interface CoverSettings {
  bgColor: string;
  textMode: "auto" | "white" | "dark";
  layout: "centered" | "full";
  band: boolean;
}

interface DraftData {
  info: BookInfo;
  manuscript: string;
  settings: Settings;
  trimKey: TrimKey;
  paperKey: PaperKey;
  cover: CoverSettings;
}

const DRAFT_KEY = "tl-assembly-draft-v1";
const MAX_DRAFT_MANUSCRIPT = 1_500_000;

const DEFAULT_INFO: BookInfo = {
  title: "",
  subtitle: "",
  author: "",
  summary: "",
  bio: "",
  isbn: "",
  year: DEFAULT_YEAR,
};

const DEFAULT_SETTINGS: Settings = {
  fontFamily: "times",
  fontPt: 11,
  lineFactor: 1.35,
  justify: true,
  chapterOnRecto: true,
  colophonLast: true,
  restartNumbering: false,
  singleNewline: true,
  autoChapters: true,
};

const DEFAULT_COVER: CoverSettings = {
  bgColor: "#312e81",
  textMode: "auto",
  layout: "centered",
  band: true,
};

type AlertLevel = "error" | "warn" | "ok" | "info";

interface AlertItem {
  level: AlertLevel;
  text: string;
}

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const handle = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(handle);
  }, [value, delay]);

  return debounced;
}

async function loadPdfCtor(): Promise<PdfCtor> {
  const mod = (await import("jspdf")) as unknown as { jsPDF?: PdfCtor; default?: PdfCtor };
  const ctor = mod.jsPDF ?? mod.default;

  if (!ctor) throw new Error("La bibliothèque jsPDF est introuvable.");
  return ctor;
}

function formatMm(value: number): string {
  return value.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function resolveTextColor(mode: CoverSettings["textMode"], bg: string, layout: CoverSettings["layout"], hasImage: boolean): string {
  if (mode === "white") return "#ffffff";
  if (mode === "dark") return "#111827";
  if (layout === "full" && hasImage) return "#ffffff";
  return luminance(bg) < 0.55 ? "#ffffff" : "#111827";
}

function Section({ title, children, hint }: { title: string; children: React.ReactNode; hint?: string }) {
  return (
    <section className="card space-y-4">
      <div>
        <h2 className="text-lg font-extrabold">{title}</h2>
        {hint && <p className="mt-1 text-sm text-slate-600">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 text-sm text-slate-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4"
      />
      <span>{label}</span>
    </label>
  );
}

export function AssemblyStudio() {
  const [info, setInfo] = useState<BookInfo>(DEFAULT_INFO);
  const [manuscript, setManuscript] = useState("");
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [trimKey, setTrimKey] = useState<TrimKey>("A5");
  const [paperKey, setPaperKey] = useState<PaperKey>("80");
  const [cover, setCover] = useState<CoverSettings>(DEFAULT_COVER);
  const [coverImage, setCoverImage] = useState<(PreparedImage & { name: string }) | null>(null);

  const [pdfCtor, setPdfCtor] = useState<PdfCtor | null>(null);
  const [measurer, setMeasurer] = useState<TextMeasurer | null>(null);
  const [logoSet, setLogoSet] = useState<LogoSet | null>(null);
  const [barcode, setBarcode] = useState<BarcodeResult | null>(null);
  const [layout, setLayout] = useState<InteriorLayout | null>(null);
  const [computing, setComputing] = useState(false);
  const [stats, setStats] = useState({ words: 0, chapters: 0, replaced: 0 });

  const [tab, setTab] = useState<"couverture" | "interieur">("couverture");
  const [pageIndex, setPageIndex] = useState(1);
  const [guides, setGuides] = useState(true);
  const [busy, setBusy] = useState<"idle" | "interior" | "cover">("idle");
  const [notice, setNotice] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);

  const trim = TRIM_FORMATS.find((format) => format.key === trimKey) ?? TRIM_FORMATS[0];
  const paper = PAPER_OPTIONS.find((option) => option.key === paperKey) ?? PAPER_OPTIONS[0];
  const isbn = useMemo(() => analyseIsbn13(info.isbn), [info.isbn]);

  const debouncedManuscript = useDebounced(manuscript, 700);
  const debouncedInfo = useDebounced(info, 500);

  // Bibliothèques et logo : chargés une seule fois, côté navigateur.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const ctor = await loadPdfCtor();
      let logo: LogoSet;

      try {
        logo = await loadInitialLogo();
      } catch {
        logo = await buildFallbackLogoSet();
      }

      if (cancelled) return;

      setPdfCtor(() => ctor);
      setMeasurer(createMeasurer(ctor));
      setLogoSet(logo);
    })().catch((error: unknown) => {
      if (!cancelled) {
        setProblem(error instanceof Error ? error.message : "Impossible de charger les outils de génération.");
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // Brouillon mémorisé sur cet appareil.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);

      if (raw) {
        const draft = JSON.parse(raw) as Partial<DraftData>;
        if (draft.info) setInfo({ ...DEFAULT_INFO, ...draft.info });
        if (typeof draft.manuscript === "string") setManuscript(draft.manuscript);
        if (draft.settings) setSettings({ ...DEFAULT_SETTINGS, ...draft.settings });
        if (draft.trimKey) setTrimKey(draft.trimKey);
        if (draft.paperKey) setPaperKey(draft.paperKey);
        if (draft.cover) setCover({ ...DEFAULT_COVER, ...draft.cover });
      }
    } catch {
      // Brouillon illisible : on repart de zéro.
    }

    setRestored(true);
  }, []);

  useEffect(() => {
    if (!restored) return;

    const handle = window.setTimeout(() => {
      try {
        const draft: DraftData = {
          info,
          manuscript: manuscript.length <= MAX_DRAFT_MANUSCRIPT ? manuscript : "",
          settings,
          trimKey,
          paperKey,
          cover,
        };
        window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      } catch {
        // Espace de stockage plein : le brouillon n'est pas mémorisé.
      }
    }, 1000);

    return () => window.clearTimeout(handle);
  }, [restored, info, manuscript, settings, trimKey, paperKey, cover]);

  // Code-barres ISBN-13.
  useEffect(() => {
    if (isbn.state !== "valid") {
      setBarcode(null);
      return;
    }

    let cancelled = false;

    generateBarcode(isbn.digits)
      .then((result) => {
        if (!cancelled) setBarcode(result);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setBarcode(null);
          setProblem(error instanceof Error ? error.message : "Code-barres impossible.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isbn.state, isbn.digits]);

  // Mise en page du corps du livre (calcul du nombre de pages).
  const layoutIsbn = isbn.state === "valid" ? isbn.display : null;

  useEffect(() => {
    if (!measurer) return;

    setComputing(true);

    const handle = window.setTimeout(() => {
      try {
        const parsed = parseManuscript(debouncedManuscript, {
          singleNewlineIsParagraph: settings.singleNewline,
          autoDetectChapters: settings.autoChapters,
        });

        const result = buildInteriorLayout({
          measurer,
          trim: { widthMm: trim.widthMm, heightMm: trim.heightMm },
          info: {
            title: singleLine(debouncedInfo.title),
            subtitle: singleLine(debouncedInfo.subtitle),
            author: singleLine(debouncedInfo.author),
            year: singleLine(debouncedInfo.year),
            isbnDisplay: layoutIsbn,
          },
          blocks: parsed.blocks,
          options: {
            fontFamily: settings.fontFamily,
            fontPt: settings.fontPt,
            lineFactor: settings.lineFactor,
            justify: settings.justify,
            chapterOnRecto: settings.chapterOnRecto,
            colophonLast: settings.colophonLast,
            restartNumbering: settings.restartNumbering,
          },
          logo: logoSet ? logoSet.fullDark : null,
        });

        setStats({ words: parsed.wordCount, chapters: parsed.chapterCount, replaced: parsed.replacedChars });
        setLayout(result);
        setProblem(null);
      } catch (error) {
        setProblem(error instanceof Error ? error.message : "La mise en page a échoué.");
      }

      setComputing(false);
    }, 30);

    return () => window.clearTimeout(handle);
  }, [measurer, debouncedManuscript, debouncedInfo, settings, trim, logoSet, layoutIsbn]);

  const totalPages = layout?.totalPages ?? 0;
  const spineMm = layout ? spineWidthMm(layout.totalPages, paper.sheetThicknessMm) : 0;

  useEffect(() => {
    setPageIndex((current) => Math.min(Math.max(current, 1), Math.max(totalPages, 1)));
  }, [totalPages]);

  const textColor = resolveTextColor(cover.textMode, cover.bgColor, cover.layout, coverImage !== null);
  const darkBackground = luminance(cover.bgColor) < 0.55 || (cover.layout === "full" && coverImage !== null);
  const lightInk = textColor === "#ffffff";

  const scene = useMemo(() => {
    if (!measurer || !layout || !logoSet) return null;

    const full = lightInk ? logoSet.fullLight : logoSet.fullDark;
    const icon = lightInk ? logoSet.iconLight : logoSet.iconDark;

    return buildCoverScene({
      measurer,
      trim: { widthMm: trim.widthMm, heightMm: trim.heightMm },
      spineMm,
      bleedMm: BLEED_MM,
      info: {
        title: singleLine(info.title),
        subtitle: singleLine(info.subtitle),
        author: singleLine(info.author),
        summary: multiLine(info.summary),
        bio: multiLine(info.bio),
        isbnDisplay: isbn.state === "valid" ? isbn.display : null,
      },
      style: {
        bgColor: cover.bgColor,
        textColor,
        fontFamily: settings.fontFamily,
        layout: cover.layout,
        band: cover.band,
      },
      frontImage: coverImage ? { dataUrl: coverImage.dataUrl, width: coverImage.width, height: coverImage.height } : null,
      logoFull: full,
      logoIcon: icon,
      logoPlate: !logoSet.recolorable && darkBackground,
      barcode: barcode ? { dataUrl: barcode.pngDataUrl, width: barcode.width, height: barcode.height } : null,
    });
  }, [measurer, layout, logoSet, trim, spineMm, info, isbn, cover, textColor, lightInk, darkBackground, settings.fontFamily, coverImage, barcode]);

  const alerts = useMemo<AlertItem[]>(() => {
    const list: AlertItem[] = [];

    if (!info.title.trim()) list.push({ level: "warn", text: "Le titre du livre n'est pas renseigné." });
    if (!info.author.trim()) list.push({ level: "warn", text: "Le nom de l'auteur n'est pas renseigné." });

    if (isbn.state === "invalid" && isbn.message) {
      list.push({ level: "error", text: `ISBN : ${isbn.message}` });
    } else if (isbn.state === "empty") {
      list.push({ level: "info", text: "Aucun ISBN : la couverture sera créée sans code-barres." });
    } else if (isbn.state === "valid") {
      list.push({ level: "ok", text: "ISBN-13 valide : le code-barres est généré." });
    }

    if (layout) {
      if (layout.missingForMinimum > 0) {
        list.push({
          level: "error",
          text: `Le livre ne compte que ${layout.totalPages} pages : il en manque ${layout.missingForMinimum} pour atteindre le minimum de ${MIN_PAGES_PERFECT_BOUND} pages du dos carré collé.`,
        });
      } else {
        list.push({
          level: "ok",
          text: `${layout.totalPages} pages : le minimum de ${MIN_PAGES_PERFECT_BOUND} pages du dos carré collé est atteint.`,
        });
      }

      if (layout.paddingPages > 0) {
        list.push({
          level: "info",
          text: `${layout.paddingPages} page(s) blanche(s) ajoutée(s) pour que le total soit un multiple de 4.`,
        });
      }
    }

    if (stats.replaced > 0) {
      list.push({
        level: "warn",
        text: `${stats.replaced} caractère(s) non pris en charge (alphabet non latin, emoji...) ont été remplacés par « ? ».`,
      });
    }

    for (const warning of scene?.warnings ?? []) {
      list.push({ level: "warn", text: warning });
    }

    return list;
  }, [info.title, info.author, isbn, layout, stats.replaced, scene]);

  const slug = slugify(info.title) || "livre";
  const working = busy !== "idle";

  function updateInfo(field: keyof BookInfo) {
    return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { value } = event.target;
      setInfo((previous) => ({ ...previous, [field]: value }));
    };
  }

  async function handleManuscriptFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setProblem(null);
    setNotice(null);

    try {
      const name = file.name.toLowerCase();
      let text: string;

      if (name.endsWith(".docx")) {
        text = await docxToText(file);
      } else if (name.endsWith(".txt") || name.endsWith(".md") || name.endsWith(".text")) {
        text = await readTextFile(file);
      } else {
        setProblem("Format non pris en charge : importez un fichier .txt, .md ou .docx.");
        return;
      }

      if (manuscript.trim().length > 200 && !window.confirm("Remplacer le texte du manuscrit actuel par ce fichier ?")) {
        return;
      }

      setManuscript(text);
      setNotice(`Manuscrit importé : ${file.name}`);
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "Lecture du fichier impossible.");
    }
  }

  async function handleCoverFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const prepared = await prepareImageFile(file);
      setCoverImage({ ...prepared, name: file.name });
      setProblem(null);
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "Image illisible.");
    }
  }

  async function handleLogoFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      setLogoSet(await logoFromFile(file));
      setProblem(null);
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "Logo illisible.");
    }
  }

  async function handleOfficialLogo() {
    clearCustomLogo();

    try {
      setLogoSet(await loadOfficialLogo());
    } catch {
      setLogoSet(await buildFallbackLogoSet());
    }
  }

  function clearDraft() {
    if (!window.confirm("Effacer tout le brouillon (informations, manuscrit et réglages) ?")) return;

    try {
      window.localStorage.removeItem(DRAFT_KEY);
    } catch {
      // Rien à faire.
    }

    setInfo(DEFAULT_INFO);
    setManuscript("");
    setSettings(DEFAULT_SETTINGS);
    setTrimKey("A5");
    setPaperKey("80");
    setCover(DEFAULT_COVER);
    setCoverImage(null);
    setNotice("Brouillon effacé.");
  }

  async function downloadInterior() {
    if (!layout || !pdfCtor) return;

    if (
      layout.missingForMinimum > 0 &&
      !window.confirm(
        `Le livre ne compte que ${layout.totalPages} pages (minimum ${MIN_PAGES_PERFECT_BOUND} pour le dos carré collé). Télécharger quand même ?`
      )
    ) {
      return;
    }

    setBusy("interior");
    setProblem(null);

    try {
      await new Promise<void>((resolve) => window.setTimeout(resolve, 30));
      const doc = await renderInteriorPdf(pdfCtor, layout, {
        title: singleLine(info.title),
        author: singleLine(info.author),
      });
      doc.save(`${slug}-interieur.pdf`);
    } catch (error) {
      setProblem(error instanceof Error ? `Génération du PDF intérieur impossible : ${error.message}` : "Génération impossible.");
    } finally {
      setBusy("idle");
    }
  }

  async function downloadCover() {
    if (!scene || !pdfCtor) return;

    if (!barcode && !window.confirm("Aucun code-barres ne sera imprimé (ISBN absent ou invalide). Télécharger quand même ?")) {
      return;
    }

    setBusy("cover");
    setProblem(null);

    try {
      await new Promise<void>((resolve) => window.setTimeout(resolve, 30));
      const doc = await renderCoverPdf(pdfCtor, scene, {
        title: singleLine(info.title),
        author: singleLine(info.author),
      });
      doc.save(`${slug}-couverture.pdf`);
    } catch (error) {
      setProblem(error instanceof Error ? `Génération du PDF de couverture impossible : ${error.message}` : "Génération impossible.");
    } finally {
      setBusy("idle");
    }
  }

  const ready = measurer !== null && logoSet !== null && layout !== null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="eyebrow text-brand-700">Administration</p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-extrabold">
          <BookOpen className="h-6 w-6 text-brand-600" aria-hidden="true" />
          Assemblage éditeur
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Assemblez un manuscrit en livre prêt à imprimer en dos carré collé : PDF du corps du livre et couverture
          complète à plat. Tout est généré dans votre navigateur ; rien n&apos;est envoyé sur le serveur.
        </p>
      </div>

      {problem && (
        <div className="alert-error" role="alert">
          {problem}
        </div>
      )}
      {notice && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{notice}</div>
      )}
      {!ready && !problem && (
        <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          Chargement des outils de mise en page...
        </p>
      )}

      <Section title="1. Logo" hint="Le logo « techlibrairie Edition » est appliqué automatiquement sur la couverture, la tranche, la 4e de couverture et la page de titre.">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex h-20 min-w-[8rem] items-center justify-center rounded-xl border border-slate-200 bg-white p-2">
            {logoSet ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoSet.fullDark.dataUrl} alt="Logo utilisé" className="max-h-16 w-auto" />
            ) : (
              <span className="text-xs text-slate-500">Chargement...</span>
            )}
          </div>

          <div className="space-y-2 text-sm">
            <p className="font-semibold">{logoSet?.label ?? "..."}</p>
            <div className="flex flex-wrap gap-2">
              <label className="btn-secondary cursor-pointer px-3 py-1.5 text-xs">
                <Upload className="h-4 w-4" aria-hidden="true" />
                Changer le logo
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleLogoFile} className="sr-only" />
              </label>
              <button type="button" onClick={() => void handleOfficialLogo()} className="btn-secondary px-3 py-1.5 text-xs">
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Logo officiel
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Fichier officiel attendu : <code>public/logo-edition.png</code>. Sans lui, un logo de secours est utilisé.
            </p>
          </div>
        </div>
      </Section>

      <Section title="2. Informations du livre">
        <div>
          <label htmlFor="as-title" className="label">
            Titre du livre
          </label>
          <input id="as-title" type="text" value={info.title} onChange={updateInfo("title")} className="input" />
        </div>

        <div>
          <label htmlFor="as-subtitle" className="label">
            Sous-titre (facultatif)
          </label>
          <input id="as-subtitle" type="text" value={info.subtitle} onChange={updateInfo("subtitle")} className="input" />
        </div>

        <div>
          <label htmlFor="as-author" className="label">
            Nom de l&apos;auteur
          </label>
          <input id="as-author" type="text" value={info.author} onChange={updateInfo("author")} className="input" />
        </div>

        <div>
          <label htmlFor="as-summary" className="label">
            Résumé (4e de couverture)
          </label>
          <textarea id="as-summary" rows={5} value={info.summary} onChange={updateInfo("summary")} className="input" />
        </div>

        <div>
          <label htmlFor="as-bio" className="label">
            Biographie de l&apos;auteur
          </label>
          <textarea id="as-bio" rows={3} value={info.bio} onChange={updateInfo("bio")} className="input" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="as-isbn" className="label">
              Numéro ISBN-13
            </label>
            <input
              id="as-isbn"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="9789999100007"
              value={info.isbn}
              onChange={updateInfo("isbn")}
              className="input"
              aria-invalid={isbn.state === "invalid"}
            />
            {isbn.state === "invalid" && isbn.message && <p className="field-error">{isbn.message}</p>}
          </div>

          <div>
            <label htmlFor="as-year" className="label">
              Dépôt légal / année de publication
            </label>
            <input id="as-year" type="text" inputMode="numeric" value={info.year} onChange={updateInfo("year")} className="input" />
          </div>
        </div>
      </Section>

      <Section title="3. Couverture">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Image de couverture (facultatif)</label>
            <div className="flex flex-wrap items-center gap-2">
              <label className="btn-secondary cursor-pointer px-3 py-1.5 text-xs">
                <ImageIcon className="h-4 w-4" aria-hidden="true" />
                {coverImage ? "Changer l'image" : "Importer une image"}
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleCoverFile} className="sr-only" />
              </label>
              {coverImage && (
                <button type="button" onClick={() => setCoverImage(null)} className="text-xs font-semibold text-red-700 hover:underline">
                  Retirer
                </button>
              )}
            </div>
            {coverImage && <p className="mt-1 text-xs text-slate-500">{coverImage.name}</p>}
          </div>

          <div>
            <label htmlFor="as-bg" className="label">
              Couleur de fond
            </label>
            <input
              id="as-bg"
              type="color"
              value={cover.bgColor}
              onChange={(event) => setCover((previous) => ({ ...previous, bgColor: event.target.value }))}
              className="h-11 w-full cursor-pointer rounded-xl border border-slate-300 bg-white p-1"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="as-layout" className="label">
              Disposition de la 1re de couverture
            </label>
            <select
              id="as-layout"
              value={cover.layout}
              onChange={(event) => setCover((previous) => ({ ...previous, layout: event.target.value === "full" ? "full" : "centered" }))}
              className="input"
            >
              <option value="centered">Titre en haut, image au centre</option>
              <option value="full">Image plein cadre</option>
            </select>
          </div>

          <div>
            <label htmlFor="as-textcolor" className="label">
              Couleur du texte
            </label>
            <select
              id="as-textcolor"
              value={cover.textMode}
              onChange={(event) => {
                const value = event.target.value;
                setCover((previous) => ({
                  ...previous,
                  textMode: value === "white" || value === "dark" ? value : "auto",
                }));
              }}
              className="input"
            >
              <option value="auto">Automatique (selon le fond)</option>
              <option value="white">Blanc</option>
              <option value="dark">Sombre</option>
            </select>
          </div>
        </div>

        {cover.layout === "full" && (
          <Toggle
            checked={cover.band}
            onChange={(value) => setCover((previous) => ({ ...previous, band: value }))}
            label="Bandeaux sombres semi-transparents derrière le titre et l'auteur (lisibilité)"
          />
        )}
      </Section>

      <Section
        title="4. Manuscrit"
        hint="Collez le texte, ou importez un fichier .txt, .md ou .docx. Titres de chapitres : lignes commençant par « # », ou « Chapitre 1 » détecté automatiquement."
      >
        <div className="flex flex-wrap items-center gap-2">
          <label className="btn-secondary cursor-pointer px-3 py-1.5 text-xs">
            <Upload className="h-4 w-4" aria-hidden="true" />
            Importer un fichier
            <input type="file" accept=".txt,.md,.text,.docx" onChange={(event) => void handleManuscriptFile(event)} className="sr-only" />
          </label>
          <span className="text-xs text-slate-500">
            {stats.words.toLocaleString("fr-FR")} mots · {stats.chapters} chapitre(s) détecté(s)
          </span>
        </div>

        <textarea
          rows={10}
          value={manuscript}
          onChange={(event) => setManuscript(event.target.value)}
          placeholder={"# Chapitre 1\n\nPremier paragraphe de votre livre..."}
          className="input min-h-[14rem] font-mono text-xs"
          aria-label="Texte du manuscrit"
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <Toggle
            checked={settings.singleNewline}
            onChange={(value) => setSettings((previous) => ({ ...previous, singleNewline: value }))}
            label="Un retour à la ligne = un nouveau paragraphe (recommandé pour un texte venant de Word)"
          />
          <Toggle
            checked={settings.autoChapters}
            onChange={(value) => setSettings((previous) => ({ ...previous, autoChapters: value }))}
            label="Détecter automatiquement « Chapitre 1 », « Prologue »..."
          />
        </div>
      </Section>

      <Section title="5. Paramètres d'impression (dos carré collé)">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="as-trim" className="label">
              Format
            </label>
            <select
              id="as-trim"
              value={trimKey}
              onChange={(event) => {
                const next = TRIM_FORMATS.find((format) => format.key === event.target.value) ?? TRIM_FORMATS[0];
                setTrimKey(next.key);
                setSettings((previous) => ({ ...previous, fontPt: next.defaultFontPt }));
              }}
              className="input"
            >
              {TRIM_FORMATS.map((format) => (
                <option key={format.key} value={format.key}>
                  {format.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="as-paper" className="label">
              Papier
            </label>
            <select
              id="as-paper"
              value={paperKey}
              onChange={(event) => setPaperKey(event.target.value === "90" ? "90" : "80")}
              className="input"
            >
              {PAPER_OPTIONS.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="as-font" className="label">
              Police
            </label>
            <select
              id="as-font"
              value={settings.fontFamily}
              onChange={(event) =>
                setSettings((previous) => ({ ...previous, fontFamily: event.target.value === "helvetica" ? "helvetica" : "times" }))
              }
              className="input"
            >
              <option value="times">Times (classique)</option>
              <option value="helvetica">Helvetica (moderne)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="as-size" className="label">
                Taille (pt)
              </label>
              <input
                id="as-size"
                type="number"
                min={8}
                max={16}
                step={0.5}
                value={settings.fontPt}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  if (Number.isFinite(value) && value >= 8 && value <= 16) {
                    setSettings((previous) => ({ ...previous, fontPt: value }));
                  }
                }}
                className="input"
              />
            </div>
            <div>
              <label htmlFor="as-leading" className="label">
                Interligne
              </label>
              <select
                id="as-leading"
                value={settings.lineFactor}
                onChange={(event) => setSettings((previous) => ({ ...previous, lineFactor: Number(event.target.value) }))}
                className="input"
              >
                <option value={1.25}>Serré (1,25)</option>
                <option value={1.35}>Normal (1,35)</option>
                <option value={1.5}>Aéré (1,5)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Toggle
            checked={settings.justify}
            onChange={(value) => setSettings((previous) => ({ ...previous, justify: value }))}
            label="Texte justifié"
          />
          <Toggle
            checked={settings.chapterOnRecto}
            onChange={(value) => setSettings((previous) => ({ ...previous, chapterOnRecto: value }))}
            label="Chaque chapitre commence sur une page de droite"
          />
          <Toggle
            checked={settings.colophonLast}
            onChange={(value) => setSettings((previous) => ({ ...previous, colophonLast: value }))}
            label="« Achevé d'imprimer » sur la toute dernière page (pages blanches avant)"
          />
          <Toggle
            checked={settings.restartNumbering}
            onChange={(value) => setSettings((previous) => ({ ...previous, restartNumbering: value }))}
            label="Numéroter à partir de 1 après les pages liminaires"
          />
        </div>
      </Section>

      <Section title="6. Résultats et vérifications">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
            <p className="text-xs text-slate-500">Pages totales</p>
            <p className="text-2xl font-extrabold text-brand-700">{ready ? totalPages : "..."}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
            <p className="text-xs text-slate-500">Pages du corps</p>
            <p className="text-2xl font-extrabold">{layout ? layout.bodyPages : "..."}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
            <p className="text-xs text-slate-500">Tranche</p>
            <p className="text-2xl font-extrabold text-accent-700">{layout ? `${formatMm(spineMm)} mm` : "..."}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
            <p className="text-xs text-slate-500">Couverture à plat</p>
            <p className="text-sm font-bold">
              {scene ? `${formatMm(scene.widthMm)} x ${formatMm(scene.heightMm)} mm` : "..."}
            </p>
          </div>
        </div>

        {computing && <p className="text-xs text-slate-500">Mise en page en cours...</p>}

        <ul className="space-y-2">
          {alerts.map((alert, index) => (
            <li
              key={`${alert.level}-${index}`}
              className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-sm ${
                alert.level === "error"
                  ? "border-red-200 bg-red-50 text-red-800"
                  : alert.level === "warn"
                    ? "border-amber-200 bg-amber-50 text-amber-900"
                    : alert.level === "ok"
                      ? "border-green-200 bg-green-50 text-green-800"
                      : "border-slate-200 bg-slate-50 text-slate-700"
              }`}
            >
              {alert.level === "ok" ? (
                <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              ) : (
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              )}
              <span>{alert.text}</span>
            </li>
          ))}
        </ul>

        <p className="text-xs text-slate-500">
          Épaisseur de la tranche = (nombre de pages / 2) x {paper.sheetThicknessMm.toString().replace(".", ",")} mm.
        </p>
      </Section>

      <Section title="7. Code-barres ISBN-13">
        {barcode && isbn.state === "valid" ? (
          <div className="flex flex-wrap items-center gap-5">
            <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
              <p className="mb-1 text-sm font-bold tracking-wide text-slate-900">ISBN {isbn.display}</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={barcode.pngDataUrl} alt={`Code-barres de l'ISBN ${isbn.digits}`} className="mx-auto h-auto w-56 max-w-full" />
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              <a href={barcode.pngDataUrl} download={`isbn-${isbn.digits}.png`} className="btn-secondary px-3 py-1.5">
                <Download className="h-4 w-4" aria-hidden="true" />
                PNG
              </a>
              <a
                href={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(barcode.svg)}`}
                download={`isbn-${isbn.digits}.svg`}
                className="btn-secondary px-3 py-1.5"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                SVG
              </a>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-600">
            Saisissez un ISBN-13 valide à l&apos;étape 2 : le code-barres s&apos;affiche ici et se place sur la 4e de couverture.
          </p>
        )}
      </Section>

      <Section title="8. Aperçu en direct">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 text-sm font-semibold">
            <button
              type="button"
              onClick={() => setTab("couverture")}
              className={`rounded-lg px-3 py-1.5 ${tab === "couverture" ? "bg-brand-600 text-white" : "text-slate-700"}`}
            >
              Couverture
            </button>
            <button
              type="button"
              onClick={() => setTab("interieur")}
              className={`rounded-lg px-3 py-1.5 ${tab === "interieur" ? "bg-brand-600 text-white" : "text-slate-700"}`}
            >
              Intérieur
            </button>
          </div>

          <Toggle checked={guides} onChange={setGuides} label="Repères (coupe, tranche, marges)" />
        </div>

        {tab === "couverture" ? (
          scene ? (
            <CoverPreview scene={scene} showGuides={guides} />
          ) : (
            <p className="text-sm text-slate-600">L&apos;aperçu apparaît dès que la mise en page est calculée.</p>
          )
        ) : layout ? (
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-3 text-sm">
              <button
                type="button"
                onClick={() => setPageIndex((current) => Math.max(1, current - 1))}
                disabled={pageIndex <= 1}
                className="btn-secondary px-3 py-1.5"
              >
                Précédente
              </button>
              <span className="font-semibold">
                Page {pageIndex} / {layout.totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPageIndex((current) => Math.min(layout.totalPages, current + 1))}
                disabled={pageIndex >= layout.totalPages}
                className="btn-secondary px-3 py-1.5"
              >
                Suivante
              </button>
            </div>

            <input
              type="range"
              min={1}
              max={layout.totalPages}
              value={pageIndex}
              onChange={(event) => setPageIndex(Number(event.target.value))}
              className="w-full"
              aria-label="Choisir la page à afficher"
            />

            <InteriorPreview layout={layout} pageIndex={pageIndex} showGuides={guides} />
          </div>
        ) : (
          <p className="text-sm text-slate-600">L&apos;aperçu apparaît dès que la mise en page est calculée.</p>
        )}
      </Section>

      <Section title="9. Fichiers prêts à imprimer">
        <div className="grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={() => void downloadInterior()} disabled={!ready || working} className="btn-primary py-3">
            <Download className="h-5 w-5" aria-hidden="true" />
            {busy === "interior" ? "Génération..." : "Télécharger le PDF Intérieur"}
          </button>

          <button type="button" onClick={() => void downloadCover()} disabled={!ready || !scene || working} className="btn-accent py-3">
            <Download className="h-5 w-5" aria-hidden="true" />
            {busy === "cover" ? "Génération..." : "Télécharger le PDF Couverture"}
          </button>
        </div>

        <p className="text-xs text-slate-500">
          PDF intérieur : {formatMm(trim.widthMm)} x {formatMm(trim.heightMm)} mm, marge de reliure 18 mm, marges extérieures 15 mm.
          PDF couverture : planche unique avec 3 mm de fonds perdus.
        </p>

        <button type="button" onClick={clearDraft} className="text-xs font-semibold text-red-700 hover:underline">
          Effacer le brouillon enregistré sur cet appareil
        </button>
      </Section>
    </div>
  );
            }
